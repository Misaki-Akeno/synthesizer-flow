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
