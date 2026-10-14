'use client';

import { useTranslations } from 'next-intl';
import { useProjectStore } from '@/store/projects-store';
import { useSettings } from '@/store/settings-store';

/** 在画布常驻区域显示实际保存结果，不要求用户先打开项目面板。 */
export function ProjectSaveStatus() {
  const t = useTranslations('Workbench.saveStatus');
  const status = useProjectStore((state) => state.syncStatus);
  const error = useProjectStore((state) => state.syncError);
  const autoSave = useSettings((state) => state.canvas.autoSave);
  const failed = status === 'error' || status === 'conflict';
  const label = !autoSave && !failed ? t('disabled') : t(status);

  if (autoSave && status === 'idle') return null;

  return (
    <span
      role="status"
      aria-live="polite"
      data-testid="project-save-status"
      title={error || label}
      className={`hidden shrink-0 text-xs sm:inline ${failed ? 'text-destructive' : 'text-muted-foreground'}`}
    >
      {label}
    </span>
  );
}
