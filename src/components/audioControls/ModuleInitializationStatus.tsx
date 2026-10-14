'use client';

import { type ReactElement, useEffect, useState } from 'react';
import {
  ModuleInitStatus,
  ModuleLifecycleEvent,
  moduleInitManager,
} from '@/core/services/ModuleInitManager';
import { useFlowStore } from '@/store/canvas-store';

interface ModuleInitializationStatusProps {
  moduleId: string;
}

function readStatus(moduleId: string): ModuleInitStatus | undefined {
  return moduleInitManager.getModuleStatus(moduleId);
}

/** Small node-local recovery affordance for failed asynchronous audio setup. */
export function ModuleInitializationStatus({
  moduleId,
}: ModuleInitializationStatusProps): ReactElement | null {
  const retryAudioModule = useFlowStore((state) => state.retryAudioModule);
  const [status, setStatus] = useState(() => readStatus(moduleId));
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    const update = (changedId: string) => {
      if (changedId === moduleId) setStatus(readStatus(moduleId));
    };
    const unsubscribe = [
      ModuleLifecycleEvent.REGISTERED,
      ModuleLifecycleEvent.INITIALIZED,
      ModuleLifecycleEvent.ERROR,
      ModuleLifecycleEvent.DISPOSED,
    ].map((event) => moduleInitManager.subscribeToLifecycle(event, update));
    setStatus(readStatus(moduleId));
    return () => unsubscribe.forEach((remove) => remove());
  }, [moduleId]);

  if (status === undefined || status === 'initialized' || status === 'disposed') {
    return null;
  }

  if (status === 'pending') {
    return (
      <p className="mt-1 text-xs text-muted-foreground" aria-live="polite">
        Initializing audio…
      </p>
    );
  }

  const failure = moduleInitManager.getModuleFailure(moduleId);
  const retry = async (): Promise<void> => {
    setRetrying(true);
    try {
      await retryAudioModule(moduleId);
    } finally {
      setRetrying(false);
      setStatus(readStatus(moduleId));
    }
  };

  return (
    <div className="mt-2 rounded border border-destructive/40 bg-destructive/10 p-2 text-xs" role="alert">
      <p>Audio initialization failed{failure?.message ? `: ${failure.message}` : '.'}</p>
      <button
        type="button"
        className="mt-1 rounded bg-background px-2 py-1 font-medium underline disabled:cursor-wait disabled:opacity-60"
        disabled={retrying}
        onClick={() => void retry()}
      >
        {retrying ? 'Retrying…' : 'Retry audio'}
      </button>
    </div>
  );
}
