'use client';

import { useEffect, useRef } from 'react';
import { useFlowStore } from '@/store/canvas-store';
import { usePersistStore } from '@/store/projects-store';
import { useSettings } from '@/store/settings-store';
import { canvasFingerprint } from '@/core/types/canvasContent';

const AUTOSAVE_DEBOUNCE_MS = 800;

function hasCanvasContent(jsonData: string): boolean {
  try {
    const parsed = JSON.parse(jsonData) as {
      nodes?: unknown[];
      edges?: unknown[];
    };
    return Boolean(parsed.nodes?.length || parsed.edges?.length);
  } catch {
    return false;
  }
}

/**
 * 在内容版本变化后先保存 IndexedDB 草稿，再同步当前可写云端项目。
 * 草稿先行使离线、网络错误和乐观锁冲突都不会丢失用户编辑。
 */
export function useCanvasAutosave(): void {
  const revision = useFlowStore((state) => state.revision);
  const autoSave = useSettings((state) => state.canvas.autoSave);
  const currentProjectId = usePersistStore((state) => state.currentProject?.id);
  const saveLocalDraft = usePersistStore((state) => state.saveLocalDraft);
  const syncCurrentProjectDraft = usePersistStore(
    (state) => state.syncCurrentProjectDraft
  );
  const hasObservedRevision = useRef(false);
  const pendingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!autoSave || !currentProjectId) return;
    const { currentProject, localDrafts } = usePersistStore.getState();
    if (currentProject?.isLocalDraft || currentProject?.isBuiltIn) return;
    // 首次保存到云端改变项目 ID，但没有新的内容 revision；主动提交迁移后的草稿。
    if (localDrafts[currentProjectId]) {
      void syncCurrentProjectDraft(currentProjectId);
    }
  }, [autoSave, currentProjectId, syncCurrentProjectDraft]);

  useEffect(() => {
    if (!autoSave) {
      return;
    }

    if (!hasObservedRevision.current) {
      hasObservedRevision.current = true;
      return;
    }

    if (pendingTimer.current) {
      clearTimeout(pendingTimer.current);
    }

    pendingTimer.current = setTimeout(async () => {
      pendingTimer.current = null;
      const canvasData = useFlowStore.getState().exportCanvasToJson();
      const currentProject = usePersistStore.getState().currentProject;
      const currentData = currentProject?.data;
      // 空白欢迎页可能因加载状态变化而递增 revision；在首次实际编辑前不
      // 创建草稿，也不改变地址栏。
      if (!currentProject && !hasCanvasContent(canvasData)) {
        return;
      }
      // import/load/project-id 也会递增 revision 以供其他流程失效，但不能把
      // 刚加载的内容当作用户修改后再写一遍云端。
      if (
        currentData &&
        canvasFingerprint(currentData) === canvasFingerprint(canvasData)
      ) {
        return;
      }
      const projectIdBeforeSave = currentProject?.id;
      if (await saveLocalDraft(canvasData)) {
        await syncCurrentProjectDraft(projectIdBeforeSave);
      }
    }, AUTOSAVE_DEBOUNCE_MS);

    return () => {
      if (pendingTimer.current) {
        clearTimeout(pendingTimer.current);
        pendingTimer.current = null;
      }
    };
  }, [autoSave, revision, saveLocalDraft, syncCurrentProjectDraft]);

  useEffect(() => {
    if (!autoSave) {
      return;
    }

    const flushLocalDraft = () => {
      if (!hasObservedRevision.current) {
        return;
      }
      if (pendingTimer.current) {
        clearTimeout(pendingTimer.current);
        pendingTimer.current = null;
      }
      const canvasData = useFlowStore.getState().exportCanvasToJson();
      const currentProject = usePersistStore.getState().currentProject;
      const currentData = currentProject?.data;
      if (
        (currentProject || hasCanvasContent(canvasData)) &&
        (!currentData ||
          canvasFingerprint(currentData) !== canvasFingerprint(canvasData))
      ) {
        void saveLocalDraft(canvasData);
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        flushLocalDraft();
      }
    };

    window.addEventListener('pagehide', flushLocalDraft);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('pagehide', flushLocalDraft);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [autoSave, saveLocalDraft]);
}
