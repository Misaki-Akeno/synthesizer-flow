import 'server-only';

import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'crypto';
import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { users } from '@/db/schema';
import { DEFAULT_AI_SETTINGS, AIModelSettings } from './defaults';
import { env } from '@/lib/env';
import {
  AI_PROVIDER_IDS,
  getAIProvider,
  inferAIProviderId,
  isAIProviderId,
  type AIProviderId,
} from './providers';

interface EncryptedSecret {
  version: 1;
  iv: string;
  authTag: string;
  ciphertext: string;
}

interface StoredAIProviderSettings {
  modelName?: string;
  apiEndpoint?: string;
  apiKey?: EncryptedSecret;
  updatedAt?: string;
}

type UserSettings = Record<string, unknown> & {
  ai?: unknown;
};

interface StoredAISettingsState {
  version: 2;
  activeProviderId: AIProviderId;
  providers: Partial<Record<AIProviderId, StoredAIProviderSettings>>;
}

export interface PublicAISettings {
  providerId: AIProviderId;
  modelName: string;
  apiEndpoint: string;
  hasServerApiKey: boolean;
}

export interface SaveAISettingsInput {
  providerId?: AIProviderId;
  modelName?: string;
  apiEndpoint?: string;
  apiKey?: string;
  clearApiKey?: boolean;
}

export class AISettingsValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AISettingsValidationError';
  }
}

function getEncryptionKey(): Buffer {
  return createHash('sha256').update(env.NEXTAUTH_SECRET).digest();
}

export function encryptSecret(secret: string): EncryptedSecret {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', getEncryptionKey(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(secret, 'utf8'),
    cipher.final(),
  ]);

  return {
    version: 1,
    iv: iv.toString('base64'),
    authTag: cipher.getAuthTag().toString('base64'),
    ciphertext: ciphertext.toString('base64'),
  };
}

export function decryptSecret(secret: EncryptedSecret): string {
  const decipher = createDecipheriv(
    'aes-256-gcm',
    getEncryptionKey(),
    Buffer.from(secret.iv, 'base64')
  );
  decipher.setAuthTag(Buffer.from(secret.authTag, 'base64'));

  return Buffer.concat([
    decipher.update(Buffer.from(secret.ciphertext, 'base64')),
    decipher.final(),
  ]).toString('utf8');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isEncryptedSecret(value: unknown): value is EncryptedSecret {
  return (
    isRecord(value) &&
    value.version === 1 &&
    typeof value.iv === 'string' &&
    typeof value.authTag === 'string' &&
    typeof value.ciphertext === 'string'
  );
}

function getUserSettings(value: unknown): UserSettings {
  return isRecord(value) ? (value as UserSettings) : {};
}

function getStoredAISettingsState(value: unknown): StoredAISettingsState {
  const userSettings = getUserSettings(value);
  const stored = userSettings.ai;

  if (isRecord(stored) && stored.version === 2) {
    const activeProviderId = isAIProviderId(stored.activeProviderId)
      ? stored.activeProviderId
      : DEFAULT_AI_SETTINGS.providerId;
    const providers: StoredAISettingsState['providers'] = {};

    if (isRecord(stored.providers)) {
      for (const providerId of AI_PROVIDER_IDS) {
        const providerSettings = stored.providers[providerId];
        if (isRecord(providerSettings)) {
          providers[providerId] = providerSettings;
        }
      }

      // version 2 早期使用 qwen 作为提供商 ID；无数据库迁移地映射到 ModelScope。
      const legacyQwenSettings = stored.providers.qwen;
      if (!providers.modelscope && isRecord(legacyQwenSettings)) {
        providers.modelscope = legacyQwenSettings;
      }
    }

    return { version: 2, activeProviderId, providers };
  }

  // 兼容旧版的单连接结构，实际写入时自动升级为 version 2。
  const legacy = isRecord(stored) ? stored : {};
  const legacyEndpoint =
    typeof legacy.apiEndpoint === 'string' ? legacy.apiEndpoint : undefined;
  const activeProviderId = inferAIProviderId(legacyEndpoint);
  return {
    version: 2,
    activeProviderId,
    providers: {
      [activeProviderId]: {
        modelName:
          typeof legacy.modelName === 'string' ? legacy.modelName : undefined,
        apiEndpoint: legacyEndpoint,
        apiKey: isEncryptedSecret(legacy.apiKey) ? legacy.apiKey : undefined,
        updatedAt:
          typeof legacy.updatedAt === 'string' ? legacy.updatedAt : undefined,
      },
    },
  };
}

function normalizeOptionalText(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed || undefined;
}

function normalizeOptionalEndpoint(
  value: string | undefined
): string | undefined {
  const trimmed = normalizeOptionalText(value);
  if (!trimmed) {
    return undefined;
  }

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new AISettingsValidationError('apiEndpoint must be a valid URL');
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new AISettingsValidationError('apiEndpoint must use http or https');
  }

  return trimmed;
}

function resolveProviderEndpoint(
  providerId: AIProviderId,
  inputEndpoint: string | undefined,
  existingEndpoint: string | undefined
): string {
  const provider = getAIProvider(providerId);
  if (!provider.allowsCustomEndpoint) {
    return provider.apiEndpoint;
  }

  const endpoint = normalizeOptionalEndpoint(inputEndpoint ?? existingEndpoint);
  if (!endpoint) {
    throw new AISettingsValidationError(
      'apiEndpoint is required for custom providers'
    );
  }
  return endpoint;
}

function toPublicAISettings(
  state: StoredAISettingsState,
  providerId: AIProviderId = state.activeProviderId
): PublicAISettings {
  const provider = getAIProvider(providerId);
  const stored = state.providers[providerId];
  return {
    providerId,
    modelName: stored?.modelName || provider.defaultModel,
    apiEndpoint: provider.allowsCustomEndpoint
      ? stored?.apiEndpoint || ''
      : provider.apiEndpoint,
    hasServerApiKey: isEncryptedSecret(stored?.apiKey),
  };
}

async function getUserSettingsRow(userId: string) {
  const rows = await db
    .select({ settings: users.settings })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  return rows[0] ?? null;
}

export async function getPublicAISettings(
  userId: string,
  providerId?: AIProviderId
): Promise<PublicAISettings> {
  const row = await getUserSettingsRow(userId);
  const state = getStoredAISettingsState(row?.settings);
  return toPublicAISettings(state, providerId ?? state.activeProviderId);
}

export async function resolveAISettingsForUser(
  userId: string,
  fallback?: AIModelSettings
): Promise<AIModelSettings> {
  const row = await getUserSettingsRow(userId);
  const userSettings = getUserSettings(row?.settings);
  const hasStoredAISettings = isRecord(userSettings.ai);
  const state = getStoredAISettingsState(userSettings);
  const providerId = hasStoredAISettings
    ? state.activeProviderId
    : fallback?.providerId || state.activeProviderId;
  const provider = getAIProvider(providerId);
  const stored = state.providers[providerId];
  const matchingFallback =
    fallback?.providerId === providerId ? fallback : undefined;
  const fallbackApiKey = matchingFallback?.apiKey?.trim() || '';

  let apiKey = fallbackApiKey;
  let hasServerApiKey = false;

  if (isEncryptedSecret(stored?.apiKey)) {
    try {
      apiKey = decryptSecret(stored.apiKey);
      hasServerApiKey = true;
    } catch {
      if (!fallbackApiKey) {
        throw new AISettingsValidationError(
          'Saved AI API key could not be decrypted. Please save it again.'
        );
      }
    }
  }

  return {
    providerId,
    modelName:
      stored?.modelName || matchingFallback?.modelName || provider.defaultModel,
    apiEndpoint: provider.allowsCustomEndpoint
      ? stored?.apiEndpoint || matchingFallback?.apiEndpoint || ''
      : provider.apiEndpoint,
    apiKey,
    hasServerApiKey,
  };
}

export async function saveAISettingsForUser(
  userId: string,
  input: SaveAISettingsInput
): Promise<PublicAISettings> {
  if (input.providerId !== undefined && !isAIProviderId(input.providerId)) {
    throw new AISettingsValidationError('providerId is not supported');
  }
  if (input.providerId === 'custom' && input.apiEndpoint !== undefined) {
    normalizeOptionalEndpoint(input.apiEndpoint);
  }
  const modelName = normalizeOptionalText(input.modelName);
  const apiKey = normalizeOptionalText(input.apiKey);
  const row = await getUserSettingsRow(userId);
  const existingSettings = getUserSettings(row?.settings);
  const existingAI = getStoredAISettingsState(existingSettings);
  const providerId = input.providerId ?? existingAI.activeProviderId;
  const provider = getAIProvider(providerId);
  const existingProvider = existingAI.providers[providerId];
  const apiEndpoint = resolveProviderEndpoint(
    providerId,
    input.apiEndpoint,
    existingProvider?.apiEndpoint
  );

  const resolvedModelName = modelName || existingProvider?.modelName;
  if (!resolvedModelName && !provider.defaultModel) {
    throw new AISettingsValidationError('modelName is required');
  }

  const nextProvider: StoredAIProviderSettings = {
    ...existingProvider,
    modelName: resolvedModelName || provider.defaultModel,
    apiEndpoint,
    updatedAt: new Date().toISOString(),
  };

  if (apiKey) {
    nextProvider.apiKey = encryptSecret(apiKey);
  } else if (input.clearApiKey) {
    delete nextProvider.apiKey;
  }

  const nextAI: StoredAISettingsState = {
    version: 2,
    activeProviderId: providerId,
    providers: {
      ...existingAI.providers,
      [providerId]: nextProvider,
    },
  };

  const nextSettings: UserSettings = {
    ...existingSettings,
    ai: nextAI,
  };

  await db
    .update(users)
    .set({ settings: nextSettings, updatedAt: new Date() })
    .where(eq(users.id, userId));

  return toPublicAISettings(nextAI);
}
