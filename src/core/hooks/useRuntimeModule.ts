import { useCallback, useSyncExternalStore } from 'react';
import { audioGraphRuntime } from '@/core/runtime/AudioGraphRuntime';

export function useRuntimeModule(moduleId: string | undefined) {
  const subscribe = useCallback(
    (listener: () => void) => {
      if (!moduleId) {
        return () => undefined;
      }
      return audioGraphRuntime.subscribeModule(moduleId, listener);
    },
    [moduleId]
  );
  const getSnapshot = useCallback(
    () =>
      moduleId ? audioGraphRuntime.getModuleSnapshot(moduleId) : undefined,
    [moduleId]
  );
  const getServerSnapshot = useCallback(() => undefined, []);

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
