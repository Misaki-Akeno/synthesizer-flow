import type { StateStorage } from 'zustand/middleware';

const noopStorage: StateStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
};

export function getNoopStorage(): StateStorage {
  return noopStorage;
}

function canUseStorage(storage: Storage): boolean {
  const probeKey = '__synthesizerflow_storage_probe__';

  try {
    storage.setItem(probeKey, '1');
    storage.removeItem(probeKey);
    return (
      typeof storage.getItem === 'function' &&
      typeof storage.setItem === 'function' &&
      typeof storage.removeItem === 'function'
    );
  } catch {
    return false;
  }
}

export function getBrowserStorage(
  getStorage: () => Storage | undefined
): StateStorage {
  if (typeof window === 'undefined') {
    return noopStorage;
  }

  try {
    const storage = getStorage();
    return storage && canUseStorage(storage) ? storage : noopStorage;
  } catch {
    return noopStorage;
  }
}

interface IndexedDbStorageOptions {
  databaseName: string;
  storeName: string;
  getFallbackStorage: () => Storage | undefined;
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.addEventListener('success', () => resolve(request.result), {
      once: true,
    });
    request.addEventListener('error', () => reject(request.error), {
      once: true,
    });
  });
}

function transactionToPromise(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.addEventListener('complete', () => resolve(), { once: true });
    transaction.addEventListener(
      'abort',
      () =>
        reject(transaction.error ?? new Error('IndexedDB transaction aborted')),
      { once: true }
    );
    transaction.addEventListener('error', () => reject(transaction.error), {
      once: true,
    });
  });
}

/**
 * 为体积可能较大的 Zustand 状态提供 IndexedDB 存储。
 *
 * 项目画布可能超过 localStorage 的同步容量限制；这里优先使用 IndexedDB，
 * 并在首次读取时自动迁移旧的 localStorage 缓存。浏览器禁用 IndexedDB 时，
 * 仍会安全回退到原有存储。
 */
export function getIndexedDbStorage({
  databaseName,
  storeName,
  getFallbackStorage,
}: IndexedDbStorageOptions): StateStorage {
  const fallbackStorage = getBrowserStorage(getFallbackStorage);

  if (typeof window === 'undefined' || typeof indexedDB === 'undefined') {
    return fallbackStorage;
  }

  let databasePromise: Promise<IDBDatabase> | null = null;

  const getDatabase = (): Promise<IDBDatabase> => {
    if (databasePromise) {
      return databasePromise;
    }

    databasePromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(databaseName, 1);

      request.addEventListener('upgradeneeded', () => {
        if (!request.result.objectStoreNames.contains(storeName)) {
          request.result.createObjectStore(storeName);
        }
      });
      request.addEventListener(
        'success',
        () => {
          request.result.addEventListener('versionchange', () => {
            request.result.close();
            databasePromise = null;
          });
          resolve(request.result);
        },
        { once: true }
      );
      request.addEventListener(
        'error',
        () => {
          databasePromise = null;
          reject(request.error);
        },
        { once: true }
      );
      request.addEventListener(
        'blocked',
        () => {
          databasePromise = null;
          reject(new Error('IndexedDB upgrade was blocked'));
        },
        { once: true }
      );
    });

    return databasePromise;
  };

  const read = async (key: string): Promise<string | null> => {
    try {
      const database = await getDatabase();
      const transaction = database.transaction(storeName, 'readonly');
      const transactionComplete = transactionToPromise(transaction);
      const result = await requestToPromise(
        transaction.objectStore(storeName).get(key)
      );
      await transactionComplete;

      if (typeof result === 'string') {
        return result;
      }

      // 兼容旧版本：读取一次 localStorage 后迁移到 IndexedDB。
      const legacyValue = await fallbackStorage.getItem(key);
      if (legacyValue !== null) {
        await write(key, legacyValue);
        await fallbackStorage.removeItem(key);
      }
      return legacyValue;
    } catch {
      return fallbackStorage.getItem(key);
    }
  };

  const write = async (key: string, value: string): Promise<void> => {
    try {
      const database = await getDatabase();
      const transaction = database.transaction(storeName, 'readwrite');
      const transactionComplete = transactionToPromise(transaction);
      await requestToPromise(
        transaction.objectStore(storeName).put(value, key)
      );
      await transactionComplete;
      await fallbackStorage.removeItem(key);
    } catch {
      await fallbackStorage.setItem(key, value);
    }
  };

  const remove = async (key: string): Promise<void> => {
    try {
      const database = await getDatabase();
      const transaction = database.transaction(storeName, 'readwrite');
      const transactionComplete = transactionToPromise(transaction);
      await requestToPromise(transaction.objectStore(storeName).delete(key));
      await transactionComplete;
    } catch {
      // IndexedDB 不可用时，清理回退存储即可。
    }
    await fallbackStorage.removeItem(key);
  };

  return {
    getItem: read,
    setItem: write,
    removeItem: remove,
  };
}
