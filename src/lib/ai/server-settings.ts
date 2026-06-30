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

interface EncryptedSecret {
  version: 1;
  iv: string;
  authTag: string;
  ciphertext: string;
}

interface StoredAISettings {
  modelName?: string;
  apiEndpoint?: string;
  apiKey?: EncryptedSecret;
  updatedAt?: string;
}

type UserSettings = Record<string, unknown> & {
  ai?: StoredAISettings;
};

export interface PublicAISettings {
  modelName: string;
  apiEndpoint: string;
  hasServerApiKey: boolean;
}

export interface SaveAISettingsInput {
  modelName?: string;
  apiEndpoint?: string;
  apiKey?: string;
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

function getStoredAISettings(value: unknown): StoredAISettings {
  if (!isRecord(value)) return {};
  return isRecord(value.ai) ? (value.ai as StoredAISettings) : {};
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

async function getUserSettingsRow(userId: string) {
  const rows = await db
    .select({ settings: users.settings })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  return rows[0] ?? null;
}

export async function getPublicAISettings(
  userId: string
): Promise<PublicAISettings> {
  const row = await getUserSettingsRow(userId);
  const stored = getStoredAISettings(row?.settings);

  return {
    modelName: stored.modelName || DEFAULT_AI_SETTINGS.modelName,
    apiEndpoint: stored.apiEndpoint || DEFAULT_AI_SETTINGS.apiEndpoint,
    hasServerApiKey: isEncryptedSecret(stored.apiKey),
  };
}

export async function resolveAISettingsForUser(
  userId: string,
  fallback?: AIModelSettings
): Promise<AIModelSettings> {
  const row = await getUserSettingsRow(userId);
  const stored = getStoredAISettings(row?.settings);
  const fallbackApiKey = fallback?.apiKey?.trim() || '';

  let apiKey = fallbackApiKey;
  let hasServerApiKey = false;

  if (isEncryptedSecret(stored.apiKey)) {
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
    modelName:
      stored.modelName || fallback?.modelName || DEFAULT_AI_SETTINGS.modelName,
    apiEndpoint:
      stored.apiEndpoint ||
      fallback?.apiEndpoint ||
      DEFAULT_AI_SETTINGS.apiEndpoint,
    apiKey,
    hasServerApiKey,
  };
}

export async function saveAISettingsForUser(
  userId: string,
  input: SaveAISettingsInput
): Promise<PublicAISettings> {
  const modelName = normalizeOptionalText(input.modelName);
  const apiEndpoint = normalizeOptionalEndpoint(input.apiEndpoint);
  const apiKey = normalizeOptionalText(input.apiKey);
  const row = await getUserSettingsRow(userId);
  const existingSettings = getUserSettings(row?.settings);
  const existingAI = getStoredAISettings(existingSettings);

  const nextAI: StoredAISettings = {
    ...existingAI,
    modelName: modelName || existingAI.modelName,
    apiEndpoint: apiEndpoint || existingAI.apiEndpoint,
    updatedAt: new Date().toISOString(),
  };

  if (apiKey) {
    nextAI.apiKey = encryptSecret(apiKey);
  }

  const nextSettings: UserSettings = {
    ...existingSettings,
    ai: nextAI,
  };

  await db
    .update(users)
    .set({ settings: nextSettings })
    .where(eq(users.id, userId));

  return {
    modelName: nextAI.modelName || DEFAULT_AI_SETTINGS.modelName,
    apiEndpoint: nextAI.apiEndpoint || DEFAULT_AI_SETTINGS.apiEndpoint,
    hasServerApiKey: Boolean(nextAI.apiKey),
  };
}
