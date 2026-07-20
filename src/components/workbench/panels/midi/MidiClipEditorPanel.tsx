'use client';

import {
  PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/shadcn/button';
import { Input } from '@/components/ui/shadcn/input';
import { Slider } from '@/components/ui/shadcn/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/shadcn/select';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/shadcn/tooltip';
import { cn } from '@/lib/utils';
import { useFlowStore } from '@/store/canvas-store';
import { useRuntimeModule } from '@/core/hooks/useRuntimeModule';
import { MidiClip, MidiNote } from '@/core/midi/types';
import {
  clamp,
  createMidiNoteId,
  getClipLengthTicks,
  midiToNoteName,
  normalizeMidiClip,
  parseMidiClipJson,
} from '@/core/midi/utils';
import {
  Copy,
  Eraser,
  MousePointer2,
  Pencil,
  Piano,
  Play,
  Scissors,
  Square,
  Trash2,
} from 'lucide-react';

const KEYBOARD_WIDTH = 72;
const INSPECTOR_WIDTH = 260;
const TIMELINE_HEIGHT = 28;
const ROW_HEIGHT = 22;
const BEAT_WIDTH = 56;
const MIN_MIDI = 36;
const MAX_MIDI = 84;
const DEFAULT_NOTE_VELOCITY = 0.8;

type EditorTool = 'select' | 'draw' | 'erase';
type LaneKind = 'velocity' | 'pressure' | 'timbre' | 'pitchBend';
type DragKind = 'move' | 'resize-start' | 'resize-end' | 'lane';

interface DragState {
  kind: DragKind;
  noteId: string;
  startClientX: number;
  startClientY: number;
  originalNote: MidiNote;
}

function getSnapOptions(ppq: number): Array<{ label: string; value: number }> {
  return [
    { label: '1/4', value: ppq },
    { label: '1/8', value: Math.round(ppq / 2) },
    { label: '1/16', value: Math.round(ppq / 4) },
    { label: '1/32', value: Math.round(ppq / 8) },
  ];
}

function quantizeTick(tick: number, snapTicks: number): number {
  return Math.round(tick / snapTicks) * snapTicks;
}

function sortNotes(notes: MidiNote[]): MidiNote[] {
  return [...notes].sort(
    (a, b) => a.startTick - b.startTick || a.midi - b.midi
  );
}

function stringifyClip(clip: MidiClip): string {
  return JSON.stringify(clip);
}

function getNoteLaneValue(note: MidiNote, lane: LaneKind): number {
  if (lane === 'velocity') return note.velocity;
  if (lane === 'pressure') return note.pressure ?? 0;
  if (lane === 'timbre') return note.timbre ?? 0;
  return ((note.pitchBend ?? 0) + 1) / 2;
}

function getNoteLaneTranslationKey(
  lane: LaneKind
): 'velocity' | 'pressure' | 'timbre' | 'pitchBend' {
  return lane;
}

function applyLaneValue(
  note: MidiNote,
  lane: LaneKind,
  normalizedValue: number
): MidiNote {
  const value = clamp(normalizedValue, 0, 1);
  if (lane === 'velocity') return { ...note, velocity: value };
  if (lane === 'pressure') return { ...note, pressure: value };
  if (lane === 'timbre') return { ...note, timbre: value };
  return { ...note, pitchBend: value * 2 - 1 };
}

export function MidiClipEditorPanel() {
  const t = useTranslations('Workbench.midi');
  const searchParams = useSearchParams();
  const moduleId = searchParams.get('moduleId');
  const node = useFlowStore((state) =>
    state.nodes.find((item) => item.id === moduleId)
  );
  const snapshot = useRuntimeModule(moduleId ?? undefined);
  const updateModuleParameter = useFlowStore(
    (state) => state.updateModuleParameter
  );
  const rollScrollRef = useRef<HTMLDivElement | null>(null);
  const rollRef = useRef<HTMLDivElement | null>(null);
  const laneRef = useRef<HTMLDivElement | null>(null);
  const [tool, setTool] = useState<EditorTool>('select');
  const [lane, setLane] = useState<LaneKind>('velocity');
  const [dragState, setDragState] = useState<DragState | null>(null);

  const initialClip = useMemo(() => {
    const value = snapshot?.parameters.clip;
    return parseMidiClipJson(typeof value === 'string' ? value : '');
  }, [snapshot?.parameters.clip]);
  const [clip, setClip] = useState<MidiClip>(initialClip);
  const clipRef = useRef<MidiClip>(initialClip);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(
    () => initialClip.notes[0]?.id ?? null
  );

  const lengthTicks = getClipLengthTicks(clip);
  const beatCount = Math.max(1, Math.ceil(lengthTicks / clip.ppq));
  const rollWidth = Math.max(720, beatCount * BEAT_WIDTH);
  const gridHeight = (MAX_MIDI - MIN_MIDI + 1) * ROW_HEIGHT;
  const snapOptions = useMemo(() => getSnapOptions(clip.ppq), [clip.ppq]);
  const [snapTicks, setSnapTicks] = useState(() =>
    Math.round(initialClip.ppq / 4)
  );
  const activeSnapTicks = snapOptions.some(
    (option) => option.value === snapTicks
  )
    ? snapTicks
    : (snapOptions[2]?.value ?? Math.round(clip.ppq / 4));
  const selectedNote =
    clip.notes.find((note) => note.id === selectedNoteId) ?? null;
  const bpmValue = snapshot?.parameters.bpm;
  const runningValue = snapshot?.parameters.running;
  const bpm =
    typeof bpmValue === 'number' && Number.isFinite(bpmValue) ? bpmValue : 120;
  const isRunning = typeof runningValue === 'boolean' ? runningValue : false;

  const normalizeEditorClip = useCallback((nextClip: MidiClip) => {
    return normalizeMidiClip({
      ...nextClip,
      notes: sortNotes(nextClip.notes),
    });
  }, []);

  const previewClip = useCallback(
    (nextClip: MidiClip) => {
      const normalized = normalizeEditorClip(nextClip);
      clipRef.current = normalized;
      setClip(normalized);
    },
    [normalizeEditorClip]
  );

  useEffect(() => {
    clipRef.current = initialClip;
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      setClip(initialClip);
      setSelectedNoteId(initialClip.notes[0]?.id ?? null);
      setSnapTicks(Math.round(initialClip.ppq / 4));
      setDragState(null);
    });

    return () => {
      cancelled = true;
    };
  }, [initialClip, moduleId]);

  const saveClip = useCallback(
    (nextClip: MidiClip) => {
      if (!moduleId) return;
      const normalized = normalizeEditorClip(nextClip);
      clipRef.current = normalized;
      setClip(normalized);
      updateModuleParameter(moduleId, 'clip', stringifyClip(normalized));
    },
    [moduleId, normalizeEditorClip, updateModuleParameter]
  );

  const updateNote = useCallback(
    (noteId: string, updater: (note: MidiNote) => MidiNote, commit = true) => {
      const currentClip = clipRef.current;
      const nextClip = {
        ...currentClip,
        notes: currentClip.notes.map((note) =>
          note.id === noteId ? updater(note) : note
        ),
      };

      if (commit) {
        saveClip(nextClip);
      } else {
        previewClip(nextClip);
      }
    },
    [previewClip, saveClip]
  );

  const tickToX = useCallback(
    (tick: number) => (tick / lengthTicks) * rollWidth,
    [lengthTicks, rollWidth]
  );
  const xToTick = useCallback(
    (x: number) => (x / rollWidth) * lengthTicks,
    [lengthTicks, rollWidth]
  );
  const pitchToY = useCallback(
    (midi: number) => (MAX_MIDI - midi) * ROW_HEIGHT,
    []
  );
  const yToPitch = useCallback(
    (y: number) =>
      clamp(MAX_MIDI - Math.floor(y / ROW_HEIGHT), MIN_MIDI, MAX_MIDI),
    []
  );

  useEffect(() => {
    if (!rollScrollRef.current) return;
    rollScrollRef.current.scrollTop = pitchToY(72);
  }, [pitchToY]);

  const getPointerPosition = useCallback(
    (event: PointerEvent | ReactPointerEvent) => {
      const rect = rollRef.current?.getBoundingClientRect();
      if (!rect) return null;
      return {
        x: clamp(event.clientX - rect.left - KEYBOARD_WIDTH, 0, rollWidth),
        y: clamp(event.clientY - rect.top - TIMELINE_HEIGHT, 0, gridHeight),
      };
    },
    [gridHeight, rollWidth]
  );

  const commitNoteFromPoint = useCallback(
    (event: ReactPointerEvent) => {
      const point = getPointerPosition(event);
      if (!point || !moduleId) return;

      const startTick = clamp(
        quantizeTick(xToTick(point.x), activeSnapTicks),
        0,
        Math.max(0, lengthTicks - activeSnapTicks)
      );
      const durationTicks = Math.min(activeSnapTicks, lengthTicks - startTick);
      const nextNote: MidiNote = {
        id: createMidiNoteId('editor'),
        midi: yToPitch(point.y),
        startTick,
        durationTicks: Math.max(1, durationTicks),
        velocity: DEFAULT_NOTE_VELOCITY,
      };

      setSelectedNoteId(nextNote.id);
      saveClip({ ...clip, notes: [...clip.notes, nextNote] });
    },
    [
      activeSnapTicks,
      clip,
      getPointerPosition,
      lengthTicks,
      moduleId,
      saveClip,
      xToTick,
      yToPitch,
    ]
  );

  const removeSelectedNote = useCallback(() => {
    if (!selectedNoteId) return;
    const nextNotes = clip.notes.filter((note) => note.id !== selectedNoteId);
    saveClip({ ...clip, notes: nextNotes });
    setSelectedNoteId(nextNotes[0]?.id ?? null);
  }, [clip, saveClip, selectedNoteId]);

  const duplicateSelectedNote = useCallback(() => {
    if (!selectedNote) return;
    const nextStartTick = clamp(
      selectedNote.startTick + activeSnapTicks,
      0,
      Math.max(0, lengthTicks - selectedNote.durationTicks)
    );
    const copy: MidiNote = {
      ...selectedNote,
      id: createMidiNoteId('copy'),
      startTick: nextStartTick,
    };
    setSelectedNoteId(copy.id);
    saveClip({ ...clip, notes: [...clip.notes, copy] });
  }, [activeSnapTicks, clip, lengthTicks, saveClip, selectedNote]);

  const quantizeSelection = useCallback(() => {
    const targetId = selectedNoteId;
    saveClip({
      ...clip,
      notes: clip.notes.map((note) => {
        if (targetId && note.id !== targetId) return note;
        const startTick = clamp(
          quantizeTick(note.startTick, activeSnapTicks),
          0,
          Math.max(0, lengthTicks - 1)
        );
        const durationTicks = Math.max(
          activeSnapTicks,
          quantizeTick(note.durationTicks, activeSnapTicks)
        );
        return {
          ...note,
          startTick,
          durationTicks: Math.min(durationTicks, lengthTicks - startTick),
        };
      }),
    });
  }, [activeSnapTicks, clip, lengthTicks, saveClip, selectedNoteId]);

  const handleGridPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    if (tool === 'draw') {
      commitNoteFromPoint(event);
    } else {
      setSelectedNoteId(null);
    }
  };

  const handleNotePointerDown = (
    event: ReactPointerEvent<HTMLElement>,
    note: MidiNote,
    kind: DragKind
  ) => {
    if (event.button !== 0) return;
    event.stopPropagation();

    if (tool === 'erase') {
      saveClip({
        ...clip,
        notes: clip.notes.filter((item) => item.id !== note.id),
      });
      setSelectedNoteId(null);
      return;
    }

    setSelectedNoteId(note.id);
    setDragState({
      kind,
      noteId: note.id,
      startClientX: event.clientX,
      startClientY: event.clientY,
      originalNote: note,
    });
  };

  const updateLaneFromPointer = useCallback(
    (event: PointerEvent | ReactPointerEvent, noteId: string) => {
      const rect = laneRef.current?.getBoundingClientRect();
      if (!rect) return;
      const normalized = clamp(
        1 - (event.clientY - rect.top) / rect.height,
        0,
        1
      );
      updateNote(
        noteId,
        (note) => applyLaneValue(note, lane, normalized),
        false
      );
    },
    [lane, updateNote]
  );

  const handleLanePointerDown = (
    event: ReactPointerEvent<HTMLDivElement>,
    note: MidiNote
  ) => {
    if (event.button !== 0) return;
    event.stopPropagation();
    setSelectedNoteId(note.id);
    updateLaneFromPointer(event, note.id);
    setDragState({
      kind: 'lane',
      noteId: note.id,
      startClientX: event.clientX,
      startClientY: event.clientY,
      originalNote: note,
    });
  };

  useEffect(() => {
    if (!dragState) return;

    const handlePointerMove = (event: PointerEvent) => {
      if (dragState.kind === 'lane') {
        updateLaneFromPointer(event, dragState.noteId);
        return;
      }

      const deltaTicks = quantizeTick(
        ((event.clientX - dragState.startClientX) / rollWidth) * lengthTicks,
        activeSnapTicks
      );
      const deltaRows = Math.round(
        (event.clientY - dragState.startClientY) / ROW_HEIGHT
      );
      const original = dragState.originalNote;
      const minDuration = Math.max(1, Math.round(activeSnapTicks / 2));

      updateNote(
        dragState.noteId,
        () => {
          if (dragState.kind === 'resize-start') {
            const maxStartTick =
              original.startTick + original.durationTicks - minDuration;
            const startTick = clamp(
              original.startTick + deltaTicks,
              0,
              maxStartTick
            );
            return {
              ...original,
              startTick,
              durationTicks:
                original.startTick + original.durationTicks - startTick,
            };
          }

          if (dragState.kind === 'resize-end') {
            const durationTicks = clamp(
              original.durationTicks + deltaTicks,
              minDuration,
              lengthTicks - original.startTick
            );
            return { ...original, durationTicks };
          }

          return {
            ...original,
            midi: clamp(original.midi - deltaRows, MIN_MIDI, MAX_MIDI),
            startTick: clamp(
              original.startTick + deltaTicks,
              0,
              Math.max(0, lengthTicks - original.durationTicks)
            ),
          };
        },
        false
      );
    };

    const handlePointerUp = () => {
      saveClip(clipRef.current);
      setDragState(null);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp, { once: true });
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [
    activeSnapTicks,
    dragState,
    lengthTicks,
    rollWidth,
    saveClip,
    updateLaneFromPointer,
    updateNote,
  ]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement
      )
        return;

      if (event.key === 'Backspace' || event.key === 'Delete') {
        event.preventDefault();
        removeSelectedNote();
      }
      if (event.key.toLowerCase() === 'd' && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        duplicateSelectedNote();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [duplicateSelectedNote, removeSelectedNote]);

  if (!moduleId || !node || !snapshot) {
    return (
      <div className="flex h-full items-center justify-center bg-background text-sm text-muted-foreground">
        {t('selectModule')}
      </div>
    );
  }

  const noteRows = Array.from(
    { length: MAX_MIDI - MIN_MIDI + 1 },
    (_, index) => MAX_MIDI - index
  );

  return (
    <div className="grid h-full grid-rows-[46px_1fr_84px] bg-background text-foreground">
      <div className="flex min-w-0 items-center gap-2 border-b bg-card px-3">
        <Piano className="h-4 w-4 text-chart-5" />
        <div className="mr-1 min-w-0">
          <div className="truncate text-sm font-semibold leading-5 text-foreground">
            {node.data.label}
          </div>
          <div className="text-[11px] leading-3 text-muted-foreground">
            {t('summary', {
              notes: clip.notes.length,
              bars: clip.bars,
              numerator: clip.timeSignature[0],
              denominator: clip.timeSignature[1],
            })}
          </div>
        </div>

        <div className="ml-1 flex items-center gap-1 rounded-md border bg-muted/35 p-1">
          <ToolButton
            active={tool === 'select'}
            label={t('select')}
            onClick={() => setTool('select')}
          >
            <MousePointer2 className="h-4 w-4" />
          </ToolButton>
          <ToolButton
            active={tool === 'draw'}
            label={t('draw')}
            onClick={() => setTool('draw')}
          >
            <Pencil className="h-4 w-4" />
          </ToolButton>
          <ToolButton
            active={tool === 'erase'}
            label={t('erase')}
            onClick={() => setTool('erase')}
          >
            <Eraser className="h-4 w-4" />
          </ToolButton>
        </div>

        <ToolbarDivider />

        <ToolButton
          active={isRunning}
          label={isRunning ? t('stop') : t('play')}
          onClick={() => updateModuleParameter(moduleId, 'running', !isRunning)}
        >
          {isRunning ? (
            <Square className="h-4 w-4" />
          ) : (
            <Play className="h-4 w-4" />
          )}
        </ToolButton>

        <NumberField
          label={t('bpm')}
          value={bpm}
          min={20}
          max={320}
          onChange={(value) => updateModuleParameter(moduleId, 'bpm', value)}
        />
        <NumberField
          label={t('bars')}
          value={clip.bars}
          min={1}
          max={64}
          onChange={(value) => saveClip({ ...clip, bars: Math.round(value) })}
        />

        <Select
          value={String(activeSnapTicks)}
          onValueChange={(value) => setSnapTicks(Number(value))}
        >
          <SelectTrigger size="sm" className="h-8 w-[86px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {snapOptions.map((option) => (
              <SelectItem key={option.value} value={String(option.value)}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <ToolbarDivider />

        <ToolButton label={t('quantize')} onClick={quantizeSelection}>
          <Scissors className="h-4 w-4" />
        </ToolButton>
        <ToolButton
          label={t('duplicate')}
          disabled={!selectedNote}
          onClick={duplicateSelectedNote}
        >
          <Copy className="h-4 w-4" />
        </ToolButton>
        <ToolButton
          label={t('delete')}
          disabled={!selectedNote}
          onClick={removeSelectedNote}
        >
          <Trash2 className="h-4 w-4" />
        </ToolButton>
      </div>

      <div
        className="grid min-h-0 grid-cols-[1fr_var(--inspector-width)]"
        style={
          { '--inspector-width': `${INSPECTOR_WIDTH}px` } as React.CSSProperties
        }
      >
        <div ref={rollScrollRef} className="min-w-0 overflow-auto bg-muted/20">
          <div
            ref={rollRef}
            className="relative"
            style={{
              width: KEYBOARD_WIDTH + rollWidth,
              height: TIMELINE_HEIGHT + gridHeight,
            }}
          >
            <div
              className="sticky top-0 z-30 border-b bg-card"
              style={{
                left: 0,
                width: KEYBOARD_WIDTH + rollWidth,
                height: TIMELINE_HEIGHT,
              }}
            >
              <div
                className="sticky left-0 z-40 flex h-full items-center border-r bg-card px-2 text-[10px] text-muted-foreground"
                style={{ width: KEYBOARD_WIDTH }}
              >
                {t('key')}
              </div>
              {Array.from({ length: beatCount + 1 }, (_, index) => (
                <div
                  key={index}
                  className={cn(
                    'absolute top-0 flex h-full items-center border-l px-1 text-[10px]',
                    index % clip.timeSignature[0] === 0
                      ? 'border-chart-5/45 text-chart-5'
                      : 'border-border text-muted-foreground'
                  )}
                  style={{ left: KEYBOARD_WIDTH + index * BEAT_WIDTH }}
                >
                  {index + 1}
                </div>
              ))}
            </div>

            <div
              className="absolute left-0 z-20"
              style={{
                top: TIMELINE_HEIGHT,
                width: KEYBOARD_WIDTH,
                height: gridHeight,
              }}
            >
              {noteRows.map((midi) => {
                const isBlackKey = midiToNoteName(midi).includes('#');
                return (
                  <div
                    key={midi}
                    className={cn(
                      'sticky left-0 flex items-center border-r border-b px-2 text-[10px]',
                      isBlackKey
                        ? 'bg-muted text-foreground'
                        : 'bg-card text-muted-foreground'
                    )}
                    style={{ width: KEYBOARD_WIDTH, height: ROW_HEIGHT }}
                  >
                    {midiToNoteName(midi)}
                  </div>
                );
              })}
            </div>

            <div
              className="absolute cursor-crosshair overflow-hidden bg-[linear-gradient(90deg,color-mix(in_oklab,var(--chart-5)_28%,transparent)_1px,transparent_1px),linear-gradient(90deg,color-mix(in_oklab,var(--border)_70%,transparent)_1px,transparent_1px),linear-gradient(0deg,color-mix(in_oklab,var(--border)_70%,transparent)_1px,transparent_1px)]"
              style={{
                left: KEYBOARD_WIDTH,
                top: TIMELINE_HEIGHT,
                width: rollWidth,
                height: gridHeight,
                backgroundSize: `${BEAT_WIDTH * clip.timeSignature[0]}px 100%, ${BEAT_WIDTH}px 100%, 100% ${ROW_HEIGHT}px`,
              }}
              onPointerDown={handleGridPointerDown}
            >
              {clip.notes.map((note) => {
                const selected = note.id === selectedNoteId;
                return (
                  <div
                    key={note.id}
                    className={cn(
                      'group absolute flex h-[18px] items-center rounded-[5px] border px-1 text-[10px] font-medium shadow-sm transition-colors',
                      selected
                        ? 'border-chart-2/70 bg-chart-2 text-background shadow-sm'
                        : 'border-chart-5/60 bg-chart-5 text-background hover:bg-chart-5/85'
                    )}
                    style={{
                      left: tickToX(note.startTick),
                      top: pitchToY(note.midi) + 2,
                      width: Math.max(10, tickToX(note.durationTicks)),
                    }}
                    onPointerDown={(event) =>
                      handleNotePointerDown(event, note, 'move')
                    }
                    title={`${midiToNoteName(note.midi)} · ${note.startTick}`}
                  >
                    <span
                      className="absolute left-0 top-0 h-full w-2 cursor-ew-resize rounded-l-[5px] bg-black/10 opacity-0 group-hover:opacity-100"
                      onPointerDown={(event) =>
                        handleNotePointerDown(event, note, 'resize-start')
                      }
                    />
                    <span className="min-w-0 truncate">
                      {midiToNoteName(note.midi)}
                    </span>
                    <span
                      className="absolute right-0 top-0 h-full w-2 cursor-ew-resize rounded-r-[5px] bg-black/10 opacity-0 group-hover:opacity-100"
                      onPointerDown={(event) =>
                        handleNotePointerDown(event, note, 'resize-end')
                      }
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <Inspector
          clip={clip}
          note={selectedNote}
          lane={lane}
          onChangeNote={(updater, commit = true) => {
            if (!selectedNote) return;
            updateNote(selectedNote.id, updater, commit);
          }}
        />
      </div>

      <div
        className="grid min-h-0 grid-cols-[1fr_var(--inspector-width)] border-t bg-card"
        style={
          { '--inspector-width': `${INSPECTOR_WIDTH}px` } as React.CSSProperties
        }
      >
        <div className="min-w-0 overflow-x-auto overflow-y-hidden px-3 py-2">
          <div className="mb-2 flex items-center gap-2">
            <div className="w-[70px] text-[10px] font-medium uppercase text-muted-foreground">
              {t(getNoteLaneTranslationKey(lane))}
            </div>
            <Select
              value={lane}
              onValueChange={(value) => setLane(value as LaneKind)}
            >
              <SelectTrigger size="sm" className="h-7 w-[116px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="velocity">{t('velocity')}</SelectItem>
                <SelectItem value="pressure">{t('pressure')}</SelectItem>
                <SelectItem value="timbre">{t('timbre')}</SelectItem>
                <SelectItem value="pitchBend">{t('pitchBend')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div
            ref={laneRef}
            className="relative"
            style={{ width: KEYBOARD_WIDTH + rollWidth, height: 42 }}
          >
            <div
              className="sticky left-0 z-10 h-full border-r bg-card"
              style={{ width: KEYBOARD_WIDTH }}
            />
            <div
              className="absolute rounded-sm bg-muted/45"
              style={{ left: KEYBOARD_WIDTH, width: rollWidth, height: 42 }}
            >
              {lane === 'pitchBend' && (
                <div className="absolute left-0 right-0 top-1/2 h-px bg-chart-2/45" />
              )}
              {clip.notes.map((note) => {
                const value = getNoteLaneValue(note, lane);
                const selected = note.id === selectedNoteId;
                return (
                  <div
                    key={note.id}
                    className={cn(
                      'absolute bottom-0 cursor-ns-resize rounded-t border-t',
                      selected
                        ? 'border-chart-2/70 bg-chart-2'
                        : 'border-chart-5/70 bg-chart-5/85'
                    )}
                    style={{
                      left: tickToX(note.startTick),
                      width: Math.max(4, tickToX(note.durationTicks)),
                      height: Math.max(3, value * 40),
                    }}
                    title={`${t(getNoteLaneTranslationKey(lane))} ${value.toFixed(2)}`}
                    onPointerDown={(event) =>
                      handleLanePointerDown(event, note)
                    }
                  />
                );
              })}
            </div>
          </div>
        </div>
        <div className="border-l bg-card px-3 py-2 text-[11px] text-muted-foreground">
          <div className="mb-1 text-xs font-semibold text-foreground">
            {t('mpeLanes')}
          </div>
          <div>{t('mpeDescription')}</div>
        </div>
      </div>
    </div>
  );
}

function ToolbarDivider() {
  return <div className="mx-1 h-6 w-px bg-border" />;
}

function ToolButton({
  active,
  label,
  children,
  ...props
}: React.ComponentProps<typeof Button> & { active?: boolean; label: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            'h-8 w-8 text-muted-foreground hover:bg-accent hover:text-accent-foreground',
            active && 'bg-accent text-chart-5'
          )}
          aria-label={label}
          {...props}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent sideOffset={6}>{label}</TooltipContent>
    </Tooltip>
  );
}

function NumberField({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}) {
  const [inputValue, setInputValue] = useState(String(value));

  useEffect(() => {
    setInputValue(String(value));
  }, [value]);

  const commitValue = () => {
    const nextValue = Number(inputValue);
    if (!Number.isFinite(nextValue)) {
      setInputValue(String(value));
      return;
    }

    const normalized = clamp(nextValue, min, max);
    setInputValue(String(normalized));
    if (normalized !== value) {
      onChange(normalized);
    }
  };

  return (
    <label className="flex items-center gap-1 text-[11px] text-muted-foreground">
      {label}
      <Input
        type="number"
        value={inputValue}
        min={min}
        max={max}
        className="h-8 w-[66px] px-2 text-xs"
        onChange={(event) => setInputValue(event.target.value)}
        onBlur={commitValue}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.currentTarget.blur();
          }
        }}
      />
    </label>
  );
}

function Inspector({
  clip,
  note,
  lane,
  onChangeNote,
}: {
  clip: MidiClip;
  note: MidiNote | null;
  lane: LaneKind;
  onChangeNote: (
    updater: (note: MidiNote) => MidiNote,
    commit?: boolean
  ) => void;
}) {
  const t = useTranslations('Workbench.midi');

  if (!note) {
    return (
      <div className="border-l bg-card p-3">
        <div className="mb-3 text-xs font-semibold text-foreground">
          {t('inspector')}
        </div>
        <div className="text-xs text-muted-foreground">
          {t('noNoteSelected')}
        </div>
      </div>
    );
  }

  const lengthTicks = getClipLengthTicks(clip);

  return (
    <div className="min-h-0 overflow-y-auto border-l bg-card p-3">
      <div className="mb-3 flex items-center justify-between">
        <div className="text-xs font-semibold text-foreground">
          {t('inspector')}
        </div>
        <div className="rounded border bg-muted px-2 py-0.5 text-[11px] text-chart-5">
          {midiToNoteName(note.midi)}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <InspectorNumber
          label={t('pitch')}
          value={note.midi}
          min={0}
          max={127}
          onChange={(value) =>
            onChangeNote((current) => ({ ...current, midi: Math.round(value) }))
          }
        />
        <InspectorNumber
          label={t('start')}
          value={note.startTick}
          min={0}
          max={lengthTicks - 1}
          onChange={(value) =>
            onChangeNote((current) => ({
              ...current,
              startTick: Math.round(value),
            }))
          }
        />
        <InspectorNumber
          label={t('duration')}
          value={note.durationTicks}
          min={1}
          max={lengthTicks - note.startTick}
          onChange={(value) =>
            onChangeNote((current) => ({
              ...current,
              durationTicks: Math.round(value),
            }))
          }
        />
        <label className="text-[11px] text-muted-foreground">
          {t('channel')}
          <Select
            value={note.channel ? String(note.channel) : 'auto'}
            onValueChange={(value) =>
              onChangeNote((current) => ({
                ...current,
                channel: value === 'auto' ? undefined : Number(value),
              }))
            }
          >
            <SelectTrigger size="sm" className="mt-1 h-8 w-full text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="auto">{t('auto')}</SelectItem>
              {Array.from({ length: 16 }, (_, index) => (
                <SelectItem key={index + 1} value={String(index + 1)}>
                  Ch {index + 1}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
      </div>

      <div className="mt-4 space-y-4">
        <InspectorSlider
          label={t('velocity')}
          value={note.velocity}
          min={0}
          max={1}
          step={0.01}
          onChange={(value, commit) =>
            onChangeNote((current) => ({ ...current, velocity: value }), commit)
          }
        />
        <InspectorSlider
          label={t('pressure')}
          value={note.pressure ?? 0}
          min={0}
          max={1}
          step={0.01}
          onChange={(value, commit) =>
            onChangeNote((current) => ({ ...current, pressure: value }), commit)
          }
        />
        <InspectorSlider
          label={t('timbre')}
          value={note.timbre ?? 0}
          min={0}
          max={1}
          step={0.01}
          onChange={(value, commit) =>
            onChangeNote((current) => ({ ...current, timbre: value }), commit)
          }
        />
        <InspectorSlider
          label={t('pitchBend')}
          value={note.pitchBend ?? 0}
          min={-1}
          max={1}
          step={0.01}
          onChange={(value, commit) =>
            onChangeNote(
              (current) => ({ ...current, pitchBend: value }),
              commit
            )
          }
        />
      </div>

      <div className="mt-4 rounded-md border bg-muted/40 p-2 text-[11px] text-muted-foreground">
        {t('activeLane', { lane: t(getNoteLaneTranslationKey(lane)) })}
      </div>
    </div>
  );
}

function InspectorNumber({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}) {
  const [inputValue, setInputValue] = useState(String(value));

  useEffect(() => {
    setInputValue(String(value));
  }, [value]);

  const commitValue = () => {
    const nextValue = Number(inputValue);
    if (!Number.isFinite(nextValue)) {
      setInputValue(String(value));
      return;
    }

    const normalized = clamp(nextValue, min, max);
    setInputValue(String(normalized));
    if (normalized !== value) {
      onChange(normalized);
    }
  };

  return (
    <label className="text-[11px] text-muted-foreground">
      {label}
      <Input
        type="number"
        value={inputValue}
        min={min}
        max={max}
        className="mt-1 h-8 px-2 text-xs"
        onChange={(event) => setInputValue(event.target.value)}
        onBlur={commitValue}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.currentTarget.blur();
          }
        }}
      />
    </label>
  );
}

function InspectorSlider({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number, commit: boolean) => void;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-[11px] text-muted-foreground">
        <span>{label}</span>
        <span className="tabular-nums text-foreground">{value.toFixed(2)}</span>
      </div>
      <Slider
        value={[value]}
        min={min}
        max={max}
        step={step}
        className="[&_[data-slot=slider-range]]:bg-chart-5 [&_[data-slot=slider-thumb]]:border-chart-5"
        onValueChange={(values) => onChange(values[0] ?? value, false)}
        onValueCommit={(values) => onChange(values[0] ?? value, true)}
      />
    </div>
  );
}
