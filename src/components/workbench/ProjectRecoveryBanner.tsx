'use client';

import {
  AlertTriangle,
  Check,
  CloudDownload,
  CopyPlus,
  RotateCcw,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/shadcn/button';
import { useFlowStore } from '@/store/canvas-store';
import { useProjectStore } from '@/store/projects-store';
import { useShallow } from 'zustand/react/shallow';

function formatDraftTime(value: string | null): string {
  if (!value) return '';
  return new Date(value).toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export function ProjectRecoveryBanner() {
  const canvasProjectId = useFlowStore((state) => state.currentProjectId);
  const {
    currentProject,
    localDraft,
    recoveryDraftAvailable,
    saveConflict,
    saveStatus,
    lastLocalSaveAt,
    isLoading,
    restoreLocalDraft,
    discardLocalDraft,
    reloadConflictRemote,
    saveConflictAsCopy,
  } = useProjectStore(
    useShallow((state) => ({
      currentProject: state.currentProject,
      localDraft: state.localDraft,
      recoveryDraftAvailable: state.recoveryDraftAvailable,
      saveConflict: state.saveConflict,
      saveStatus: state.saveStatus,
      lastLocalSaveAt: state.lastLocalSaveAt,
      isLoading: state.isLoading,
      restoreLocalDraft: state.restoreLocalDraft,
      discardLocalDraft: state.discardLocalDraft,
      reloadConflictRemote: state.reloadConflictRemote,
      saveConflictAsCopy: state.saveConflictAsCopy,
    }))
  );

  if (saveConflict) {
    return (
      <div className="absolute top-4 left-1/2 z-50 flex w-[min(680px,calc(100%-2rem))] -translate-x-1/2 items-center gap-3 rounded-2xl border border-amber-400/40 bg-background/95 p-3 shadow-2xl backdrop-blur-xl">
        <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-amber-500/12 text-amber-600 dark:text-amber-400">
          <AlertTriangle className="size-4.5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">检测到云端版本冲突</p>
          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
            本地修改已完整保留。可另存为副本，或加载云端 revision{' '}
            {saveConflict.remoteProject?.revision ?? '—'}。
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <Button
            size="sm"
            variant="outline"
            className="h-8 gap-1.5 text-xs"
            disabled={isLoading}
            onClick={() => void saveConflictAsCopy()}
          >
            <CopyPlus className="size-3.5" />
            另存副本
          </Button>
          <Button
            size="sm"
            className="h-8 gap-1.5 text-xs"
            disabled={!saveConflict.remoteProject?.data || isLoading}
            onClick={reloadConflictRemote}
          >
            <CloudDownload className="size-3.5" />
            加载云端
          </Button>
        </div>
      </div>
    );
  }

  const activeProjectId = currentProject?.id || canvasProjectId || 'untitled';
  const canRecover =
    recoveryDraftAvailable && localDraft?.projectId === activeProjectId;
  if (canRecover && localDraft) {
    return (
      <div className="absolute top-4 left-1/2 z-50 flex w-[min(620px,calc(100%-2rem))] -translate-x-1/2 items-center gap-3 rounded-2xl border border-violet-400/35 bg-background/95 p-3 shadow-2xl backdrop-blur-xl">
        <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-violet-500/12 text-violet-600 dark:text-violet-400">
          <RotateCcw className="size-4.5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">发现未提交的本地草稿</p>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {localDraft.projectName} · {formatDraftTime(localDraft.savedAt)}
          </p>
        </div>
        <Button
          size="sm"
          className="h-8 gap-1.5 text-xs"
          onClick={() => restoreLocalDraft()}
        >
          <RotateCcw className="size-3.5" />
          恢复
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="size-8"
          onClick={discardLocalDraft}
          aria-label="忽略本地草稿"
          title="忽略草稿（历史版本仍保留）"
        >
          <X className="size-4" />
        </Button>
      </div>
    );
  }

  if (saveStatus !== 'dirty' || !lastLocalSaveAt) return null;

  return (
    <div className="pointer-events-none absolute top-3 right-3 z-40 flex items-center gap-1.5 rounded-full border bg-background/80 px-2.5 py-1 text-[10px] font-medium text-muted-foreground shadow-sm backdrop-blur">
      <Check className="size-3 text-emerald-600" />
      本地草稿 {formatDraftTime(lastLocalSaveAt)}
    </div>
  );
}
