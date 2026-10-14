'use client';

import React, { memo, useEffect, useMemo, useRef } from 'react';
import { Button } from '@/components/ui/shadcn/button';
import { Input } from '@/components/ui/shadcn/input';
import {
  getClipLengthTicks,
  midiToNoteName,
  parseMidiClipJson,
} from '@/core/midi/utils';
import type { MidiNote } from '@/core/midi/types';
import { Pause, Play, PanelBottomOpen, Music2 } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useFlowStore } from '@/store/canvas-store';
import { useTransportRuntimeStore } from '@/store/transport-runtime-store';
import { audioGraphRuntime } from '@/core/runtime/AudioGraphRuntime';

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
  const isRunning = useTransportRuntimeStore((state) => state.isPlaying);
  const clipLengthTicks = Math.max(1, getClipLengthTicks(clip));

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
      runtime.pause();
      audioGraphRuntime.pauseTransport();
    } else {
      runtime.play();
      if (runtime.hasStarted) audioGraphRuntime.resumeTransport();
      else setSequencersRunning(true);
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
              {isRunning ? (
                <Pause size={12} fill="currentColor" />
              ) : (
                <Play size={12} fill="currentColor" />
              )}
            </Button>
          )}
          <Button
            size="icon"
            variant="outline"
            className="h-6 w-6"
            onClick={openEditor}
            aria-label="Open MIDI editor"
          >
            <PanelBottomOpen size={13} />
          </Button>
        </div>
      </div>

      {bpmParam && (
        <div className="flex items-center gap-2 border-b px-2 py-1.5">
          <span className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
            BPM
          </span>
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
            {clip.bars} bar{clip.bars === 1 ? '' : 's'} / {clip.notes.length}{' '}
            notes
          </span>
        </div>
      )}

      <div className="relative h-20 bg-[linear-gradient(90deg,color-mix(in_oklab,var(--chart-5)_18%,transparent)_1px,transparent_1px),linear-gradient(0deg,color-mix(in_oklab,var(--border)_70%,transparent)_1px,transparent_1px)] bg-[length:25%_100%,100%_20%]">
        <SequencePlayhead
          clipLengthTicks={clipLengthTicks}
          isRunning={isRunning}
        />
        <SequenceNotePreview
          notes={clip.notes}
          clipLengthTicks={clipLengthTicks}
        />
      </div>
    </div>
  );
};

/**
 * 播放头每帧移动，但只通过 store 订阅直接改 DOM transform，
 * 不让音序器卡片随播放位置以 60fps 重渲染。
 */
const SequencePlayhead = ({
  clipLengthTicks,
  isRunning,
}: {
  clipLengthTicks: number;
  isRunning: boolean;
}) => {
  const trackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    let lastPercent: number | undefined;
    const apply = (positionTicks: number) => {
      const percent =
        ((positionTicks % clipLengthTicks) / clipLengthTicks) * 100;
      if (percent === lastPercent) return;
      lastPercent = percent;
      track.style.transform = `translateX(${percent}%)`;
    };
    apply(useTransportRuntimeStore.getState().positionTicks);
    return useTransportRuntimeStore.subscribe((state) =>
      apply(state.positionTicks)
    );
  }, [clipLengthTicks]);

  return (
    <div
      ref={trackRef}
      data-testid="sequence-playhead"
      className="pointer-events-none absolute inset-0 z-20 will-change-transform"
    >
      <div
        className={`absolute bottom-0 left-0 top-0 w-px bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.6)] ${isRunning ? 'opacity-100' : 'opacity-30'}`}
      />
    </div>
  );
};

/** 音符网格只随 clip 内容变化；LOD 精简模式也复用它作为静态缩略图。 */
export const SequenceNotePreview = memo(
  ({
    notes,
    clipLengthTicks,
  }: {
    notes: MidiNote[];
    clipLengthTicks: number;
  }) => {
    const pitchRange = useMemo(() => {
      if (notes.length === 0) {
        return { min: 60, max: 72 };
      }
      return notes.reduce(
        (range, note) => ({
          min: Math.min(range.min, note.midi),
          max: Math.max(range.max, note.midi),
        }),
        { min: notes[0].midi, max: notes[0].midi }
      );
    }, [notes]);

    return (
      <>
        {notes.map((note) => {
          const top =
            pitchRange.max === pitchRange.min
              ? 34
              : 8 +
                ((pitchRange.max - note.midi) /
                  (pitchRange.max - pitchRange.min)) *
                  52;
          const left = (note.startTick / clipLengthTicks) * 100;
          const width = Math.max(
            4,
            (note.durationTicks / clipLengthTicks) * 100
          );

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
        {notes.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center text-[11px] text-muted-foreground">
            Empty clip
          </div>
        )}
      </>
    );
  }
);
SequenceNotePreview.displayName = 'SequenceNotePreview';

export default SequenceEditor;
