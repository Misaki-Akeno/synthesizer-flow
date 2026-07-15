import { describe, expect, it, vi } from 'vitest';
import { getBrowserStorage, getIndexedDbStorage } from './persist-storage';

function createMemoryStorage(): Storage {
  const values = new Map<string, string>();

  return {
    get length() {
      return values.size;
    },
    clear: vi.fn(() => values.clear()),
    getItem: vi.fn((key: string) => values.get(key) ?? null),
    key: vi.fn((index: number) => Array.from(values.keys())[index] ?? null),
    removeItem: vi.fn((key: string) => {
      values.delete(key);
    }),
    setItem: vi.fn((key: string, value: string) => {
      values.set(key, value);
    }),
  };
}

describe('getBrowserStorage', () => {
  it('returns a working browser storage implementation', () => {
    const storage = createMemoryStorage();

    const resolved = getBrowserStorage(() => storage);
    resolved.setItem('theme', 'dark');

    expect(resolved.getItem('theme')).toBe('dark');
  });

  it('falls back when accessing browser storage throws', () => {
    const resolved = getBrowserStorage(() => {
      throw new Error('storage blocked');
    });

    expect(resolved.getItem('theme')).toBeNull();
    expect(() => resolved.setItem('theme', 'dark')).not.toThrow();
  });

  it('falls back when storage cannot write probe values', () => {
    const storage = createMemoryStorage();
    vi.mocked(storage.setItem).mockImplementation(() => {
      throw new Error('quota exceeded');
    });

    const resolved = getBrowserStorage(() => storage);

    expect(resolved.getItem('theme')).toBeNull();
    expect(resolved).not.toBe(storage);
  });
});

describe('getIndexedDbStorage', () => {
  it('falls back to browser storage when IndexedDB is unavailable', async () => {
    const storage = createMemoryStorage();
    vi.stubGlobal('indexedDB', undefined);

    const resolved = getIndexedDbStorage({
      databaseName: 'test',
      storeName: 'state',
      getFallbackStorage: () => storage,
    });

    await resolved.setItem('project', 'large-canvas');

    expect(await resolved.getItem('project')).toBe('large-canvas');
    vi.unstubAllGlobals();
  });
});
