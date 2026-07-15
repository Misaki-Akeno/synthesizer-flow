'use client';

import { cn } from '@/lib/utils';
import dynamic from 'next/dynamic';
import { Button } from '@/components/ui/shadcn/button';
import { Maximize2, Minimize2, X } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  WorkbenchPanel,
  WorkbenchPanelBody,
  WorkbenchPanelHeader,
} from '@/components/layout/WorkbenchPanel';

const MidiClipEditorPanel = dynamic(
  () =>
    import('@/components/workbench/panels/midi/MidiClipEditorPanel').then(
      (module) => module.MidiClipEditorPanel
    ),
  { loading: () => <div className="h-full animate-pulse bg-muted/20" /> }
);

interface BottomDrawerProps {
  className?: string;
  isMaximized?: boolean;
  onToggleMaximize?: () => void;
  onClosePanel?: () => void;
}

export function BottomDrawer({
  className,
  isMaximized = false,
  onToggleMaximize,
  onClosePanel,
}: BottomDrawerProps) {
  const t = useTranslations('Workbench');
  const router = useRouter();
  const searchParams = useSearchParams();
  const bottomPanel = searchParams.get('bottomPanel');
  const moduleId = searchParams.get('moduleId');

  const closePanel = () => {
    onClosePanel?.();
    const params = new URLSearchParams(searchParams);
    params.delete('bottomPanel');
    params.delete('moduleId');
    router.replace(`?${params.toString()}`, { scroll: false });
  };

  if (!bottomPanel) return null;

  return (
    <WorkbenchPanel className={cn('border-t', className)}>
      <WorkbenchPanelHeader
        title={
          bottomPanel === 'midi-editor' ? t('panels.midiEditor') : bottomPanel
        }
        actions={
          <>
            {onToggleMaximize && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-foreground"
                onClick={onToggleMaximize}
                aria-label={
                  isMaximized ? t('panels.restore') : t('panels.maximize')
                }
              >
                {isMaximized ? (
                  <Minimize2 size={15} />
                ) : (
                  <Maximize2 size={15} />
                )}
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-foreground"
              onClick={closePanel}
              aria-label={t('panels.close')}
            >
              <X size={15} />
            </Button>
          </>
        }
      />
      <WorkbenchPanelBody className="overflow-hidden">
        {bottomPanel === 'midi-editor' && (
          <MidiClipEditorPanel key={moduleId ?? 'midi-editor'} />
        )}
      </WorkbenchPanelBody>
    </WorkbenchPanel>
  );
}
