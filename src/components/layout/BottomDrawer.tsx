'use client';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/shadcn/button';
import { Maximize2, Minimize2, X } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { MidiClipEditorPanel } from '@/components/workbench/panels/midi/MidiClipEditorPanel';
import {
  WorkbenchPanel,
  WorkbenchPanelBody,
  WorkbenchPanelHeader,
} from '@/components/layout/WorkbenchPanel';

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
        title={bottomPanel === 'midi-editor' ? 'MIDI Editor' : bottomPanel}
        actions={
          <>
            {onToggleMaximize && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-foreground"
                onClick={onToggleMaximize}
                aria-label={isMaximized ? 'Restore bottom panel' : 'Maximize bottom panel'}
              >
                {isMaximized ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-foreground"
              onClick={closePanel}
              aria-label="Close bottom panel"
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
