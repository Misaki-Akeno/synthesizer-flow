'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  Circle,
  ListMusic,
  Pause,
  Play,
  Repeat2,
  Square,
  Trash2,
} from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { Button } from '@/components/ui/shadcn/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/shadcn/dialog';
import { Input } from '@/components/ui/shadcn/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/shadcn/select';
import { Slider } from '@/components/ui/shadcn/slider';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/shadcn/tooltip';
import { audioGraphRuntime } from '@/core/runtime/AudioGraphRuntime';
import { ensureAudioContextReady } from '@/core/audio/audio-context';
import { getClipLengthTicks, parseMidiClipJson } from '@/core/midi/utils';
import { TRANSPORT_PPQ } from '@/core/transport/types';
import { cn } from '@/lib/utils';
import { useFlowStore } from '@/store/canvas-store';
import { useTransportRuntimeStore } from '@/store/transport-runtime-store';

const AUTOMATION_FRAME_INTERVAL_MS = 1000 / 30;

function getProjectLengthTicks(
  nodes: ReturnType<typeof useFlowStore.getState>['nodes'],
  timeSignature: [number, number]
): number {
  const clipLengths = nodes
    .filter((node) => node.data.type === 'sequencer')
    .map((node) => {
      const clip = node.data.parameters.clip;
      return typeof clip === 'string'
        ? getClipLengthTicks(parseMidiClipJson(clip))
        : 0;
    });
  const ticksPerBar = TRANSPORT_PPQ * timeSignature[0] * (4 / timeSignature[1]);
  return Math.max(ticksPerBar * 4, ...clipLengths);
}

function formatPosition(
  positionTicks: number,
  timeSignature: [number, number]
): string {
  const ticksPerBeat = TRANSPORT_PPQ * (4 / timeSignature[1]);
  const ticksPerBar = ticksPerBeat * timeSignature[0];
  const bar = Math.floor(positionTicks / ticksPerBar) + 1;
  const withinBar = positionTicks % ticksPerBar;
  const beat = Math.floor(withinBar / ticksPerBeat) + 1;
  const sixteenth =
    Math.floor((withinBar % ticksPerBeat) / (TRANSPORT_PPQ / 4)) + 1;
  return `${String(bar).padStart(2, '0')}.${beat}.${sixteenth}`;
}

export function TransportBar() {
  const t = useTranslations('Workbench.transport');
  const [automationOpen, setAutomationOpen] = useState(false);
  const lastAutomationFrame = useRef(0);
  const {
    nodes,
    transport,
    setTransportBpm,
    setTransportLoopEnabled,
    setTransportLoopRange,
    setAutomationMode,
    beginAutomationRecording,
    finishAutomationRecording,
    setSequencersRunning,
    applyAutomationAtTick,
    clearAutomationLane,
    clearAllAutomation,
  } = useFlowStore(
    useShallow((state) => ({
      nodes: state.nodes,
      transport: state.transport,
      setTransportBpm: state.setTransportBpm,
      setTransportLoopEnabled: state.setTransportLoopEnabled,
      setTransportLoopRange: state.setTransportLoopRange,
      setAutomationMode: state.setAutomationMode,
      beginAutomationRecording: state.beginAutomationRecording,
      finishAutomationRecording: state.finishAutomationRecording,
      setSequencersRunning: state.setSequencersRunning,
      applyAutomationAtTick: state.applyAutomationAtTick,
      clearAutomationLane: state.clearAutomationLane,
      clearAllAutomation: state.clearAllAutomation,
    }))
  );
  const { isPlaying, hasStarted, isRecording, positionTicks } =
    useTransportRuntimeStore(
      useShallow((state) => ({
        isPlaying: state.isPlaying,
        hasStarted: state.hasStarted,
        isRecording: state.isRecording,
        positionTicks: state.positionTicks,
      }))
    );
  const projectLengthTicks = useMemo(
    () => getProjectLengthTicks(nodes, transport.timeSignature),
    [nodes, transport.timeSignature]
  );

  useEffect(() => {
    if (!isPlaying) return;
    let animationFrame = 0;
    const renderFrame = (now: number) => {
      const result = useTransportRuntimeStore
        .getState()
        .advance(
          now,
          transport.bpm,
          projectLengthTicks,
          transport.loopEnabled,
          transport.loopRange.startTick,
          transport.loopRange.endTick,
          audioGraphRuntime.getTransportPositionTicks()
        );
      if (result.wrapped) {
        audioGraphRuntime.seekTransport(result.positionTicks);
      }
      if (
        now - lastAutomationFrame.current >= AUTOMATION_FRAME_INTERVAL_MS ||
        result.wrapped ||
        result.ended
      ) {
        applyAutomationAtTick(result.positionTicks);
        lastAutomationFrame.current = now;
      }
      if (result.ended) {
        setSequencersRunning(false);
        return;
      }
      animationFrame = window.requestAnimationFrame(renderFrame);
    };
    animationFrame = window.requestAnimationFrame(renderFrame);
    return () => window.cancelAnimationFrame(animationFrame);
  }, [
    applyAutomationAtTick,
    isPlaying,
    projectLengthTicks,
    setSequencersRunning,
    transport.bpm,
    transport.loopEnabled,
    transport.loopRange.endTick,
    transport.loopRange.startTick,
  ]);

  const togglePlayback = () => {
    void ensureAudioContextReady().then((ready) => {
      if (ready) audioGraphRuntime.activateOutputModules();
    });
    const runtime = useTransportRuntimeStore.getState();
    if (runtime.isPlaying) {
      runtime.pause();
      audioGraphRuntime.pauseTransport();
      if (runtime.isRecording) finishAutomationRecording();
      return;
    }
    runtime.play();
    if (runtime.hasStarted) {
      audioGraphRuntime.resumeTransport();
    } else {
      setSequencersRunning(true);
    }
  };

  const stopPlayback = () => {
    const runtime = useTransportRuntimeStore.getState();
    if (runtime.isRecording) finishAutomationRecording();
    runtime.stop();
    setSequencersRunning(false);
    applyAutomationAtTick(0);
  };

  const toggleRecording = () => {
    void ensureAudioContextReady().then((ready) => {
      if (ready) audioGraphRuntime.activateOutputModules();
    });
    const runtime = useTransportRuntimeStore.getState();
    if (transport.automationMode === 'read') return;
    const nextRecording = !runtime.isRecording;
    runtime.setRecording(nextRecording);
    if (nextRecording) beginAutomationRecording();
    else finishAutomationRecording();
    if (nextRecording && !runtime.isPlaying) {
      runtime.play();
      if (runtime.hasStarted) audioGraphRuntime.resumeTransport();
      else setSequencersRunning(true);
    }
  };

  const seek = (tick: number) => {
    const nextTick = Math.max(0, Math.min(projectLengthTicks, tick));
    useTransportRuntimeStore.getState().seek(nextTick);
    audioGraphRuntime.seekTransport(nextTick);
    applyAutomationAtTick(nextTick);
  };

  const commitBpm = (value: string) => {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      setTransportBpm(parsed);
    }
  };

  const position = formatPosition(positionTicks, transport.timeSignature);
  const automationCount = transport.automationLanes.length;
  const ticksPerBar =
    TRANSPORT_PPQ *
    transport.timeSignature[0] *
    (4 / transport.timeSignature[1]);

  return (
    <>
      <div
        className={cn(
          'flex h-9 min-w-0 items-center gap-1 rounded-lg border border-border/80',
          'bg-muted/55 px-1.5 shadow-[inset_0_1px_0_hsl(var(--background)/0.8)] backdrop-blur-sm',
          isRecording && 'border-red-500/45 bg-red-500/[0.06]'
        )}
        data-testid="global-transport"
      >
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                className={cn(
                  'h-7 w-7 rounded-md',
                  isPlaying &&
                    'bg-amber-400 text-amber-950 hover:bg-amber-300 hover:text-amber-950'
                )}
                onClick={togglePlayback}
                aria-label={isPlaying ? t('pause') : t('play')}
                aria-pressed={isPlaying}
              >
                {isPlaying ? (
                  <Pause className="h-3.5 w-3.5 fill-current" />
                ) : (
                  <Play className="h-4 w-4 fill-current" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              {isPlaying ? t('pause') : t('play')}
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 rounded-md text-muted-foreground"
                onClick={stopPlayback}
                aria-label={t('stop')}
                disabled={!hasStarted && positionTicks === 0}
              >
                <Square className="h-3.5 w-3.5 fill-current" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">{t('stop')}</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                className={cn(
                  'relative h-7 w-7 rounded-md',
                  isRecording &&
                    'bg-red-500 text-white hover:bg-red-500 hover:text-white'
                )}
                onClick={toggleRecording}
                aria-label={isRecording ? t('stopRecording') : t('record')}
                aria-pressed={isRecording}
                disabled={transport.automationMode === 'read'}
              >
                <Circle
                  className={cn(
                    'h-3.5 w-3.5 fill-red-500 text-red-500',
                    isRecording && 'animate-pulse fill-white text-white'
                  )}
                />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              {isRecording ? t('stopRecording') : t('record')}
            </TooltipContent>
          </Tooltip>

          <div className="mx-0.5 h-5 w-px bg-border" aria-hidden="true" />

          <div className="min-w-[66px] px-1 text-center font-mono text-[13px] font-semibold tabular-nums tracking-[0.08em] text-foreground">
            {position}
          </div>

          <Slider
            value={[Math.min(positionTicks, projectLengthTicks)]}
            min={0}
            max={Math.max(1, projectLengthTicks)}
            step={TRANSPORT_PPQ / 4}
            onValueChange={([tick]) => seek(tick)}
            aria-label={t('seek')}
            className="hidden w-20 xl:flex [&_[data-slot=slider-thumb]]:size-3"
          />

          <div className="flex h-7 items-center rounded-md border bg-background/75 px-1.5">
            <Input
              key={transport.bpm}
              defaultValue={transport.bpm}
              onBlur={(event) => commitBpm(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') event.currentTarget.blur();
              }}
              inputMode="numeric"
              aria-label={t('bpm')}
              className="h-5 w-9 border-0 bg-transparent p-0 text-right font-mono text-xs tabular-nums shadow-none focus-visible:ring-0"
            />
            <span className="ml-1 text-[9px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              BPM
            </span>
          </div>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                className={cn(
                  'h-7 w-7 rounded-md text-muted-foreground',
                  transport.loopEnabled &&
                    'bg-foreground text-background hover:bg-foreground/85 hover:text-background'
                )}
                onClick={() => setTransportLoopEnabled(!transport.loopEnabled)}
                aria-label={t('loop')}
                aria-pressed={transport.loopEnabled}
              >
                <Repeat2 className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">{t('loop')}</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="sm"
                variant="ghost"
                className={cn(
                  'h-7 gap-1 rounded-md px-2 text-muted-foreground',
                  automationCount > 0 && 'text-foreground'
                )}
                onClick={() => setAutomationOpen(true)}
                aria-label={t('automation')}
              >
                <ListMusic className="h-3.5 w-3.5" />
                <span className="font-mono text-[10px] tabular-nums">
                  {automationCount}
                </span>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">{t('automation')}</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      <Dialog open={automationOpen} onOpenChange={setAutomationOpen}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>{t('automationTitle')}</DialogTitle>
            <DialogDescription>{t('automationDescription')}</DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 rounded-xl border bg-muted/25 p-3 sm:grid-cols-[1fr_1fr_1.25fr]">
            <label className="space-y-1.5 text-xs font-medium text-muted-foreground">
              {t('loopStart')}
              <Input
                key={`loop-start-${transport.loopRange.startTick}`}
                defaultValue={transport.loopRange.startTick / ticksPerBar + 1}
                min={1}
                step={1}
                type="number"
                className="h-8 bg-background font-mono text-foreground"
                onBlur={(event) => {
                  const bar = Math.max(1, Number(event.target.value) || 1);
                  setTransportLoopRange(
                    (bar - 1) * ticksPerBar,
                    transport.loopRange.endTick
                  );
                }}
              />
            </label>
            <label className="space-y-1.5 text-xs font-medium text-muted-foreground">
              {t('loopEnd')}
              <Input
                key={`loop-end-${transport.loopRange.endTick}`}
                defaultValue={transport.loopRange.endTick / ticksPerBar}
                min={2}
                step={1}
                type="number"
                className="h-8 bg-background font-mono text-foreground"
                onBlur={(event) => {
                  const bar = Math.max(2, Number(event.target.value) || 2);
                  setTransportLoopRange(
                    transport.loopRange.startTick,
                    bar * ticksPerBar
                  );
                }}
              />
            </label>
            <label className="space-y-1.5 text-xs font-medium text-muted-foreground">
              {t('automationMode')}
              <Select
                value={transport.automationMode}
                onValueChange={(mode) =>
                  setAutomationMode(
                    mode as 'read' | 'touch' | 'latch' | 'write'
                  )
                }
              >
                <SelectTrigger size="sm" className="w-full bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="read">{t('modeRead')}</SelectItem>
                  <SelectItem value="touch">{t('modeTouch')}</SelectItem>
                  <SelectItem value="latch">{t('modeLatch')}</SelectItem>
                  <SelectItem value="write">{t('modeWrite')}</SelectItem>
                </SelectContent>
              </Select>
            </label>
          </div>

          <div className="max-h-[360px] space-y-2 overflow-auto py-2">
            {automationCount === 0 ? (
              <div className="rounded-lg border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
                {t('automationEmpty')}
              </div>
            ) : (
              transport.automationLanes.map((lane) => {
                const node = nodes.find((item) => item.id === lane.moduleId);
                const snapshot = audioGraphRuntime.getModuleSnapshot(
                  lane.moduleId
                );
                const parameterLabel =
                  snapshot?.parameterMeta[lane.parameterKey]?.uiOptions?.label;
                return (
                  <div
                    key={lane.id}
                    className="flex items-center justify-between rounded-lg border bg-muted/30 px-3 py-2.5"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">
                        {node?.data.label ?? lane.moduleId}
                      </div>
                      <div className="mt-0.5 text-xs text-muted-foreground">
                        {typeof parameterLabel === 'string'
                          ? parameterLabel
                          : lane.parameterKey}
                        <span className="mx-1.5">·</span>
                        {t('pointCount', { count: lane.points.length })}
                      </div>
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={() => clearAutomationLane(lane.id)}
                      aria-label={t('deleteLane')}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                );
              })
            )}
          </div>

          <DialogFooter>
            {automationCount > 0 && (
              <Button
                variant="outline"
                className="text-destructive hover:text-destructive"
                onClick={clearAllAutomation}
              >
                {t('clearAll')}
              </Button>
            )}
            <Button onClick={() => setAutomationOpen(false)}>
              {t('done')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
