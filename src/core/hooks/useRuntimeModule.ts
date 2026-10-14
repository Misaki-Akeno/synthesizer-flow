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

/**
 * 订阅端口遥测（端口值）。只在确实显示端口值的组件里使用，
 * 避免高频端口变化驱动整张节点卡片重渲染。
 */
export function useRuntimeModuleTelemetry(moduleId: string | undefined) {
  const subscribe = useCallback(
    (listener: () => void) => {
      if (!moduleId) {
        return () => undefined;
      }
      return audioGraphRuntime.subscribeModuleTelemetry(moduleId, listener);
    },
    [moduleId]
  );
  const getSnapshot = useCallback(
    () =>
      moduleId ? audioGraphRuntime.getModuleTelemetry(moduleId) : undefined,
    [moduleId]
  );
  const getServerSnapshot = useCallback(() => undefined, []);

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
