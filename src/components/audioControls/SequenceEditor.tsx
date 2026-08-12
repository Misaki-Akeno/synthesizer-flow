'use client';

import React, { useMemo } from 'react';
import { Button } from '@/components/ui/shadcn/button';
import { Input } from '@/components/ui/shadcn/input';
import {
  getClipLengthTicks,
  midiToNoteName,
  parseMidiClipJson,
} from '@/core/midi/utils';
import { Play, Square, PanelBottomOpen, Music2 } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useFlowStore } from '@/store/canvas-store';
import { useTransportRuntimeStore } from '@/store/transport-runtime-store';

interface SequenceEditorProps {
  moduleId?: string;
  paramValues: Record<string, number | boolean | string>;
  onParamChange: (paramKey: string, value: number | boolean | string) => void;
  clipParam?: string;
  bpmParam?: string;
  runningParam?: string;
}

const SequenceEditor: React.FC<SequenceEditorProps> = ({
  moduleId,
  paramValues,
  clipParam = 'clip',
  bpmParam,
  runningParam,
}) => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const serializedClip = paramValues[clipParam] as string;
  const clip = useMemo(
    () => parseMidiClipJson(serializedClip || ''),
    [serializedClip]
  );
  const transport = useFlowStore((state) => state.transport);
  const setTransportBpm = useFlowStore((state) => state.setTransportBpm);
  const setSequencersRunning = useFlowStore(
    (state) => state.setSequencersRunning
  );
  const applyAutomationAtTick = useFlowStore(
    (state) => state.applyAutomationAtTick
  );
  const isRunning = useTransportRuntimeStore((state) => state.isPlaying);
  const positionTicks = useTransportRuntimeStore((state) => state.positionTicks);
  const clipLengthTicks = Math.max(1, getClipLengthTicks(clip));
  const playheadPercent =
    ((positionTicks % clipLengthTicks) / clipLengthTicks) * 100;

  const pitchRange = useMemo(() => {
    if (clip.notes.length === 0) {
      return { min: 60, max: 72 };
    }
    return clip.notes.reduce(
      (range, note) => ({
        min: Math.min(range.min, note.midi),
        max: Math.max(range.max, note.midi),
      }),
      { min: clip.notes[0].midi, max: clip.notes[0].midi }
    );
  }, [clip.notes]);

  const openEditor = () => {
    const params = new URLSearchParams(searchParams);
    params.set('bottomPanel', 'midi-editor');
    if (moduleId) {
      params.set('moduleId', moduleId);
    }
    router.replace(`?${params.toString()}`, { scroll: false });
  };

  const toggleRunning = () => {
    const runtime = useTransportRuntimeStore.getState();
    if (runtime.isPlaying) {
      runtime.stop();
      setSequencersRunning(false);
      applyAutomationAtTick(0);
    } else {
      runtime.play();
      setSequencersRunning(true);
    }
  };

  return (
    <div className="w-full overflow-hidden rounded-md border bg-card text-card-foreground shadow-inner">
      <div className="flex items-center justify-between border-b px-2 py-1.5">
        <div className="flex min-w-0 items-center gap-1.5">
          <Music2 className="h-3.5 w-3.5 text-chart-5" />
          <div className="truncate text-[11px] font-semibold uppercase tracking-[0.12em] text-foreground">
            MIDI Clip
          </div>
        </div>
        <div className="flex items-center gap-1">
          {runningParam && (
            <Button
              size="icon"
              variant={isRunning ? 'destructive' : 'secondary'}
              className="h-6 w-6"
              onClick={toggleRunning}
              aria-label={isRunning ? 'Stop MIDI clip' : 'Play MIDI clip'}
            >
              {isRunning ? <Square size={12} fill="currentColor" /> : <Play size={12} fill="currentColor" />}
            </Button>
          )}
          <Button size="icon" variant="outline" className="h-6 w-6" onClick={openEditor} aria-label="Open MIDI editor">
            <PanelBottomOpen size={13} />
          </Button>
        </div>
      </div>

      {bpmParam && (
        <div className="flex items-center gap-2 border-b px-2 py-1.5">
          <span className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">BPM</span>
          <Input
            key={transport.bpm}
            type="number"
            className="h-6 w-16 px-2 text-xs"
            defaultValue={transport.bpm}
            onBlur={(event) =>
              setTransportBpm(Number.parseFloat(event.target.value))
            }
            onKeyDown={(event) => {
              if (event.key === 'Enter') event.currentTarget.blur();
            }}
          />
          <span className="ml-auto text-[10px] text-muted-foreground">
            {clip.bars} bar{clip.bars === 1 ? '' : 's'} / {clip.notes.length} notes
          </span>
        </div>
      )}

      <div className="relative h-20 bg-[linear-gradient(90deg,color-mix(in_oklab,var(--chart-5)_18%,transparent)_1px,transparent_1px),linear-gradient(0deg,color-mix(in_oklab,var(--border)_70%,transparent)_1px,transparent_1px)] bg-[length:25%_100%,100%_20%]">
        <div
          className={`pointer-events-none absolute bottom-0 top-0 z-20 w-px bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.6)] ${isRunning ? 'opacity-100' : 'opacity-30'}`}
          style={{ left: `${playheadPercent}%` }}
        />
        {clip.notes.map((note) => {
          const lengthTicks = clipLengthTicks;
          const top =
            pitchRange.max === pitchRange.min
              ? 34
              : 8 + ((pitchRange.max - note.midi) / (pitchRange.max - pitchRange.min)) * 52;
          const left = (note.startTick / lengthTicks) * 100;
          const width = Math.max(4, (note.durationTicks / lengthTicks) * 100);

          return (
            <div
              key={note.id}
              className="absolute h-3 rounded-[3px] border border-chart-5/50 bg-chart-5/80 shadow-sm"
              title={`${midiToNoteName(note.midi)} velocity ${note.velocity.toFixed(2)}`}
              style={{
                top,
                left: `${left}%`,
                width: `${width}%`,
                opacity: 0.55 + note.velocity * 0.45,
              }}
            />
          );
        })}
        {clip.notes.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center text-[11px] text-muted-foreground">
            Empty clip
          </div>
        )}
      </div>
    </div>
  );
};

export default SequenceEditor;
