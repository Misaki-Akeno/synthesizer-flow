import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  decryptSecret,
  encryptSecret,
  getPublicAISettings,
  resolveAISettingsForUser,
  saveAISettingsForUser,
} from './server-settings';

const mockDbState = vi.hoisted(() => ({
  selectResults: [] as unknown[][],
  updateSets: [] as unknown[],
  updateWhere: [] as unknown[],
}));

const mockDb = vi.hoisted(() => {
  const createSelectChain = (result: unknown[]) => {
    const chain: Record<string, unknown> = {};
    chain.from = vi.fn(() => chain);
    chain.where = vi.fn(() => chain);
    chain.limit = vi.fn(async () => result);
    return chain;
  };

  return {
    select: vi.fn(() =>
      createSelectChain(mockDbState.selectResults.shift() ?? [])
    ),
    update: vi.fn(() => ({
      set: vi.fn((value: unknown) => {
        mockDbState.updateSets.push(value);
        return {
          where: vi.fn(async (condition: unknown) => {
            mockDbState.updateWhere.push(condition);
          }),
        };
      }),
    })),
  };
});

vi.mock('server-only', () => ({}));

vi.mock('@/lib/env', () => ({
  env: {
    NEXTAUTH_SECRET: 'test-secret',
  },
}));

vi.mock('@/db/client', () => ({
  db: mockDb,
}));

vi.mock('@/db/schema', () => ({
  users: {
    id: 'users.id',
    settings: 'users.settings',
  },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((column: unknown, value: unknown) => ({
    op: 'eq',
    column,
    value,
  })),
}));

describe('server AI settings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDbState.selectResults = [];
    mockDbState.updateSets = [];
    mockDbState.updateWhere = [];
  });

  it('encrypts and decrypts API keys without storing plaintext', () => {
    const encrypted = encryptSecret('sk-test-secret');

    expect(encrypted.ciphertext).not.toContain('sk-test-secret');
    expect(encrypted.iv).toBeTruthy();
    expect(encrypted.authTag).toBeTruthy();
    expect(decryptSecret(encrypted)).toBe('sk-test-secret');
  });

  it('returns public settings without exposing the server API key', async () => {
    const encrypted = encryptSecret('sk-server');
    mockDbState.selectResults = [
      [
        {
          settings: {
            ai: {
              modelName: 'qwen-plus',
              apiEndpoint: 'https://example.com/v1',
              apiKey: encrypted,
            },
          },
        },
      ],
    ];

    const result = await getPublicAISettings('user-1');

    expect(result).toEqual({
      providerId: 'custom',
      modelName: 'qwen-plus',
      apiEndpoint: 'https://example.com/v1',
      hasServerApiKey: true,
    });
    expect(JSON.stringify(result)).not.toContain('sk-server');
  });

  it('does not treat malformed API key settings as saved server keys', async () => {
    mockDbState.selectResults = [
      [
        {
          settings: {
            ai: {
              apiKey: 'legacy-plaintext-key',
            },
          },
        },
      ],
    ];

    const result = await getPublicAISettings('user-1');

    expect(result.hasServerApiKey).toBe(false);
  });

  it('prefers encrypted server settings when resolving settings for agent calls', async () => {
    const encrypted = encryptSecret('sk-server');
    mockDbState.selectResults = [
      [
        {
          settings: {
            ai: {
              modelName: 'server-model',
              apiEndpoint: 'https://server.example/v1',
              apiKey: encrypted,
            },
          },
        },
      ],
    ];

    const result = await resolveAISettingsForUser('user-1', {
      providerId: 'custom',
      modelName: 'fallback-model',
      apiEndpoint: 'https://fallback.example/v1',
      apiKey: 'sk-fallback',
    });

    expect(result).toEqual({
      providerId: 'custom',
      modelName: 'server-model',
      apiEndpoint: 'https://server.example/v1',
      apiKey: 'sk-server',
      hasServerApiKey: true,
    });
  });

  it('falls back to the current request API key when a saved key cannot decrypt', async () => {
    const encrypted = encryptSecret('sk-server');
    mockDbState.selectResults = [
      [
        {
          settings: {
            ai: {
              apiEndpoint: 'https://fallback.example/v1',
              apiKey: {
                ...encrypted,
                authTag: encryptSecret('other-key').authTag,
              },
            },
          },
        },
      ],
    ];

    const result = await resolveAISettingsForUser('user-1', {
      providerId: 'custom',
      modelName: 'fallback-model',
      apiEndpoint: 'https://fallback.example/v1',
      apiKey: 'sk-fallback',
    });

    expect(result.apiKey).toBe('sk-fallback');
    expect(result.hasServerApiKey).toBe(false);
  });

  it('uses the request provider for users without saved AI settings', async () => {
    mockDbState.selectResults = [[{ settings: null }]];

    const result = await resolveAISettingsForUser('user-1', {
      providerId: 'openai',
      modelName: 'gpt-5.6-sol',
      apiEndpoint: 'https://api.openai.com/v1',
      apiKey: 'sk-request',
    });

    expect(result).toEqual({
      providerId: 'openai',
      modelName: 'gpt-5.6-sol',
      apiEndpoint: 'https://api.openai.com/v1',
      apiKey: 'sk-request',
      hasServerApiKey: false,
    });
  });

  it('does not mix fallback credentials from a different provider', async () => {
    mockDbState.selectResults = [
      [
        {
          settings: {
            ai: {
              version: 2,
              activeProviderId: 'modelscope',
              providers: {
                modelscope: {
                  modelName: 'Qwen/Qwen3.5-35B-A3B',
                },
              },
            },
          },
        },
      ],
    ];

    const result = await resolveAISettingsForUser('user-1', {
      providerId: 'openai',
      modelName: 'gpt-5.6-sol',
      apiEndpoint: 'https://api.openai.com/v1',
      apiKey: 'sk-openai',
    });

    expect(result.providerId).toBe('modelscope');
    expect(result.apiKey).toBe('');
  });

  it('asks users to resave the API key when saved key decryption fails without fallback', async () => {
    const encrypted = encryptSecret('sk-server');
    mockDbState.selectResults = [
      [
        {
          settings: {
            ai: {
              apiKey: {
                ...encrypted,
                ciphertext: encrypted.ciphertext.slice(0, -4),
              },
            },
          },
        },
      ],
    ];

    await expect(resolveAISettingsForUser('user-1')).rejects.toThrow(
      /could not be decrypted/
    );
  });

  it('updates nested AI settings while preserving unrelated user settings', async () => {
    mockDbState.selectResults = [
      [
        {
          settings: {
            theme: 'dark',
            ai: {
              modelName: 'old-model',
              apiEndpoint: 'https://old.example/v1',
            },
          },
        },
      ],
    ];

    const result = await saveAISettingsForUser('user-1', {
      providerId: 'custom',
      modelName: 'new-model',
      apiEndpoint: 'https://new.example/v1',
      apiKey: 'sk-new',
    });

    expect(result).toEqual({
      providerId: 'custom',
      modelName: 'new-model',
      apiEndpoint: 'https://new.example/v1',
      hasServerApiKey: true,
    });
    expect(mockDbState.updateSets).toHaveLength(1);

    const savedSettings = mockDbState.updateSets[0] as {
      settings: {
        theme?: string;
        ai?: {
          version?: number;
          activeProviderId?: string;
          providers?: Record<
            string,
            {
              modelName?: string;
              apiEndpoint?: string;
              apiKey?: unknown;
            }
          >;
        };
      };
    };

    expect(savedSettings.settings.theme).toBe('dark');
    expect(savedSettings.settings.ai?.version).toBe(2);
    expect(savedSettings.settings.ai?.activeProviderId).toBe('custom');
    expect(savedSettings.settings.ai?.providers?.custom?.modelName).toBe(
      'new-model'
    );
    expect(savedSettings.settings.ai?.providers?.custom?.apiEndpoint).toBe(
      'https://new.example/v1'
    );
    expect(JSON.stringify(savedSettings)).not.toContain('sk-new');
    expect(mockDbState.updateWhere).toEqual([
      { op: 'eq', column: 'users.id', value: 'user-1' },
    ]);
  });

  it('rejects invalid API endpoints before reading or updating user settings', async () => {
    await expect(
      saveAISettingsForUser('user-1', {
        providerId: 'custom',
        apiEndpoint: 'javascript:alert(1)',
      })
    ).rejects.toThrow(/apiEndpoint/);

    expect(mockDb.select).not.toHaveBeenCalled();
    expect(mockDb.update).not.toHaveBeenCalled();
  });

  it('trims saved settings before persisting them', async () => {
    mockDbState.selectResults = [
      [
        {
          settings: {
            ai: {},
          },
        },
      ],
    ];

    await saveAISettingsForUser('user-1', {
      providerId: 'custom',
      modelName: '  qwen-plus  ',
      apiEndpoint: '  https://example.com/v1  ',
      apiKey: '  sk-trimmed  ',
    });

    const savedSettings = mockDbState.updateSets[0] as {
      settings: {
        ai?: {
          providers?: Record<
            string,
            {
              modelName?: string;
              apiEndpoint?: string;
              apiKey?: { ciphertext: string };
            }
          >;
        };
      };
    };

    expect(savedSettings.settings.ai?.providers?.custom?.modelName).toBe(
      'qwen-plus'
    );
    expect(savedSettings.settings.ai?.providers?.custom?.apiEndpoint).toBe(
      'https://example.com/v1'
    );
    expect(JSON.stringify(savedSettings)).not.toContain('sk-trimmed');
  });

  it('switches the active provider without overwriting other provider profiles', async () => {
    const qwenKey = encryptSecret('sk-qwen');
    mockDbState.selectResults = [
      [
        {
          settings: {
            ai: {
              version: 2,
              activeProviderId: 'qwen',
              providers: {
                qwen: {
                  modelName: 'qwen-max',
                  apiKey: qwenKey,
                },
              },
            },
          },
        },
      ],
    ];

    const result = await saveAISettingsForUser('user-1', {
      providerId: 'anthropic',
      modelName: 'claude-haiku-4-5',
      apiKey: 'sk-anthropic',
    });

    expect(result).toEqual({
      providerId: 'anthropic',
      modelName: 'claude-haiku-4-5',
      apiEndpoint: 'https://api.anthropic.com',
      hasServerApiKey: true,
    });

    const savedSettings = mockDbState.updateSets[0] as {
      settings: {
        ai: {
          activeProviderId: string;
          providers: Record<string, { modelName?: string; apiKey?: unknown }>;
        };
      };
    };
    expect(savedSettings.settings.ai.activeProviderId).toBe('anthropic');
    expect(savedSettings.settings.ai.providers.modelscope).toEqual({
      modelName: 'qwen-max',
      apiKey: qwenKey,
    });
    expect(savedSettings.settings.ai.providers.anthropic.modelName).toBe(
      'claude-haiku-4-5'
    );
    expect(JSON.stringify(savedSettings)).not.toContain('sk-anthropic');
  });
});
