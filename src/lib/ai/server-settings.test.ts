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
      modelName: 'fallback-model',
      apiEndpoint: 'https://fallback.example/v1',
      apiKey: 'sk-fallback',
    });

    expect(result).toEqual({
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
      modelName: 'fallback-model',
      apiEndpoint: 'https://fallback.example/v1',
      apiKey: 'sk-fallback',
    });

    expect(result.apiKey).toBe('sk-fallback');
    expect(result.hasServerApiKey).toBe(false);
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
      modelName: 'new-model',
      apiEndpoint: 'https://new.example/v1',
      apiKey: 'sk-new',
    });

    expect(result).toEqual({
      modelName: 'new-model',
      apiEndpoint: 'https://new.example/v1',
      hasServerApiKey: true,
    });
    expect(mockDbState.updateSets).toHaveLength(1);

    const savedSettings = mockDbState.updateSets[0] as {
      settings: {
        theme?: string;
        ai?: {
          modelName?: string;
          apiEndpoint?: string;
          apiKey?: unknown;
        };
      };
    };

    expect(savedSettings.settings.theme).toBe('dark');
    expect(savedSettings.settings.ai?.modelName).toBe('new-model');
    expect(savedSettings.settings.ai?.apiEndpoint).toBe(
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
      modelName: '  qwen-plus  ',
      apiEndpoint: '  https://example.com/v1  ',
      apiKey: '  sk-trimmed  ',
    });

    const savedSettings = mockDbState.updateSets[0] as {
      settings: {
        ai?: {
          modelName?: string;
          apiEndpoint?: string;
          apiKey?: {
            ciphertext: string;
          };
        };
      };
    };

    expect(savedSettings.settings.ai?.modelName).toBe('qwen-plus');
    expect(savedSettings.settings.ai?.apiEndpoint).toBe(
      'https://example.com/v1'
    );
    expect(JSON.stringify(savedSettings)).not.toContain('sk-trimmed');
  });
});
