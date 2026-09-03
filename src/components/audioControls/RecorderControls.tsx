'use client';

import { Circle, Download, Square } from 'lucide-react';
import { Button } from '@/components/ui/shadcn/button';
import { cn } from '@/lib/utils';

interface RecorderControlsProps {
  recording?: boolean;
  startRecording?: () => void;
  stopAndExport?: () => void;
}

export default function RecorderControls({
  recording = false,
  startRecording,
  stopAndExport,
}: RecorderControlsProps) {
  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded-xl border p-2',
        recording
          ? 'border-red-500/40 bg-red-500/[0.07]'
          : 'border-border/80 bg-muted/35'
      )}
    >
      <div className="flex min-w-0 flex-1 items-center gap-2 px-1">
        <span
          className={cn(
            'grid size-7 place-items-center rounded-full bg-background shadow-sm',
            recording && 'text-red-500'
          )}
        >
          {recording ? (
            <Square className="size-3 fill-current" />
          ) : (
            <Download className="size-3.5" />
          )}
        </span>
        <div className="min-w-0">
          <div className="truncate text-xs font-semibold">
            {recording ? '正在捕获主总线' : 'WAV 录音就绪'}
          </div>
          <div className="truncate text-[10px] text-muted-foreground">
            {recording ? '停止后自动下载' : '16-bit PCM · 直通监听'}
          </div>
        </div>
      </div>
      <Button
        type="button"
        size="sm"
        variant={recording ? 'destructive' : 'outline'}
        className="h-8 gap-1.5 rounded-lg px-2.5 text-xs"
        onClick={recording ? stopAndExport : startRecording}
      >
        {recording ? (
          <Square className="size-3 fill-current" />
        ) : (
          <Circle className="size-3 fill-red-500 text-red-500" />
        )}
        {recording ? '停止并导出' : '开始录音'}
      </Button>
    </div>
  );
}
