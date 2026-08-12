'use client';

import { useEffect } from 'react';
import { useFlowStore } from '@/store/canvas-store';
import {
  getCanvasDataSignature,
  useProjectStore,
} from '@/store/projects-store';

const DRAFT_DEBOUNCE_MS = 900;

/**
 * 画布变化先写入 IndexedDB 草稿，不等待网络，也不把选择状态写入工程。
 */
export function useCanvasDraftAutosave(): void {
  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout> | null = null;
    let lastSignature = getCanvasDataSignature(
      useFlowStore.getState().exportCanvasToJson()
    );

    const capture = () => {
      const projectState = useProjectStore.getState();
      const currentProjectId =
        projectState.currentProject?.id ||
        useFlowStore.getState().currentProjectId ||
        'untitled';
      const recoveryBlocksAutosave =
        projectState.recoveryDraftAvailable &&
        projectState.localDraft?.projectId === currentProjectId;
      if (!recoveryBlocksAutosave) {
        projectState.captureLocalDraft();
      }
    };

    const unsubscribe = useFlowStore.subscribe(() => {
      const serialized = useFlowStore.getState().exportCanvasToJson();
      const signature = getCanvasDataSignature(serialized);
      if (signature === lastSignature) return;
      lastSignature = signature;
      if (timeout) clearTimeout(timeout);
      timeout = setTimeout(capture, DRAFT_DEBOUNCE_MS);
    });

    const handlePageHide = () => {
      if (timeout) clearTimeout(timeout);
      capture();
    };
    window.addEventListener('pagehide', handlePageHide);

    return () => {
      unsubscribe();
      if (timeout) clearTimeout(timeout);
      window.removeEventListener('pagehide', handlePageHide);
    };
  }, []);
}
