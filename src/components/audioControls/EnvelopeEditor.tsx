'use client';

import { useCallback, useMemo, useRef } from 'react';

type EnvelopeParameterMap = {
  attack: string;
  decay: string;
  sustain: string;
  sustainTime?: string;
  release: string;
};

interface EnvelopeEditorProps {
  paramValues: Record<string, number | boolean | string>;
  onParamChange: (paramKey: string, value: number) => void;
  onEditStart?: () => void;
  onEditEnd?: () => void;
  parameters?: Partial<EnvelopeParameterMap>;
}

type EnvelopeHandle = 'attack' | 'decay' | 'sustain' | 'release';

const VIEWBOX_WIDTH = 260;
const VIEWBOX_HEIGHT = 106;
const BASELINE_Y = 72;
const PEAK_Y = 14;
const ATTACK_MIN_X = 28;
const ATTACK_MAX_X = 68;
const DECAY_MIN_GAP = 28;
const DECAY_MAX_GAP = 70;
const GATE_X = 196;
const RELEASE_MIN_X = 218;
const RELEASE_MAX_X = 250;

const DEFAULT_PARAMETERS: EnvelopeParameterMap = {
  attack: 'attack',
  decay: 'decay',
  sustain: 'sustain',
  sustainTime: 'sustainTime',
  release: 'release',
};

const PARAMETER_RANGES = {
  attack: { min: 0.001, max: 5, step: 0.001 },
  decay: { min: 0.001, max: 5, step: 0.001 },
  sustain: { min: 0, max: 1, step: 0.01 },
  release: { min: 0.001, max: 10, step: 0.001 },
} as const;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function readNumber(
  values: EnvelopeEditorProps['paramValues'],
  key: string | undefined,
  fallback: number
): number {
  const value = key ? values[key] : undefined;
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function toLogRatio(value: number, min: number, max: number): number {
  const safeValue = clamp(value, min, max);
  return Math.log(safeValue / min) / Math.log(max / min);
}

function fromLogRatio(ratio: number, min: number, max: number): number {
  return min * Math.pow(max / min, clamp(ratio, 0, 1));
}

function formatTime(value: number): string {
  if (value < 1) return `${Math.round(value * 1000)}ms`;
  return `${value.toFixed(value < 10 ? 2 : 1)}s`;
}

function formatSustain(value: number): string {
  return `${Math.round(value * 100)}%`;
}

export default function EnvelopeEditor({
  paramValues,
  onParamChange,
  onEditStart,
  onEditEnd,
  parameters,
}: EnvelopeEditorProps) {
  const keys = useMemo<EnvelopeParameterMap>(
    () => ({
      attack: parameters?.attack ?? DEFAULT_PARAMETERS.attack,
      decay: parameters?.decay ?? DEFAULT_PARAMETERS.decay,
      sustain: parameters?.sustain ?? DEFAULT_PARAMETERS.sustain,
      sustainTime: parameters?.sustainTime ?? DEFAULT_PARAMETERS.sustainTime,
      release: parameters?.release ?? DEFAULT_PARAMETERS.release,
    }),
    [
      parameters?.attack,
      parameters?.decay,
      parameters?.release,
      parameters?.sustain,
      parameters?.sustainTime,
    ]
  );
  const activeHandleRef = useRef<EnvelopeHandle | null>(null);

  const attack = clamp(
    readNumber(paramValues, keys.attack, 0.2),
    PARAMETER_RANGES.attack.min,
    PARAMETER_RANGES.attack.max
  );
  const decay = clamp(
    readNumber(paramValues, keys.decay, 0.5),
    PARAMETER_RANGES.decay.min,
    PARAMETER_RANGES.decay.max
  );
  const sustain = clamp(
    readNumber(paramValues, keys.sustain, 0.7),
    PARAMETER_RANGES.sustain.min,
    PARAMETER_RANGES.sustain.max
  );
  const sustainTime = Math.max(0, readNumber(paramValues, keys.sustainTime, 0));
  const release = clamp(
    readNumber(paramValues, keys.release, 0.8),
    PARAMETER_RANGES.release.min,
    PARAMETER_RANGES.release.max
  );

  const attackX =
    ATTACK_MIN_X +
    toLogRatio(
      attack,
      PARAMETER_RANGES.attack.min,
      PARAMETER_RANGES.attack.max
    ) *
      (ATTACK_MAX_X - ATTACK_MIN_X);
  const decayX =
    attackX +
    DECAY_MIN_GAP +
    toLogRatio(decay, PARAMETER_RANGES.decay.min, PARAMETER_RANGES.decay.max) *
      (DECAY_MAX_GAP - DECAY_MIN_GAP);
  const sustainY = BASELINE_Y - sustain * (BASELINE_Y - PEAK_Y);
  const releaseX =
    RELEASE_MIN_X +
    toLogRatio(
      release,
      PARAMETER_RANGES.release.min,
      PARAMETER_RANGES.release.max
    ) *
      (RELEASE_MAX_X - RELEASE_MIN_X);

  const updateFromPoint = useCallback(
    (handle: EnvelopeHandle, x: number, y: number) => {
      if (handle === 'attack') {
        const ratio =
          (clamp(x, ATTACK_MIN_X, ATTACK_MAX_X) - ATTACK_MIN_X) /
          (ATTACK_MAX_X - ATTACK_MIN_X);
        onParamChange(
          keys.attack,
          fromLogRatio(
            ratio,
            PARAMETER_RANGES.attack.min,
            PARAMETER_RANGES.attack.max
          )
        );
        return;
      }

      if (handle === 'decay') {
        const gap = clamp(x - attackX, DECAY_MIN_GAP, DECAY_MAX_GAP);
        const ratio = (gap - DECAY_MIN_GAP) / (DECAY_MAX_GAP - DECAY_MIN_GAP);
        onParamChange(
          keys.decay,
          fromLogRatio(
            ratio,
            PARAMETER_RANGES.decay.min,
            PARAMETER_RANGES.decay.max
          )
        );
        return;
      }

      if (handle === 'sustain') {
        const ratio =
          (BASELINE_Y - clamp(y, PEAK_Y, BASELINE_Y)) / (BASELINE_Y - PEAK_Y);
        onParamChange(keys.sustain, ratio);
        return;
      }

      const ratio =
        (clamp(x, RELEASE_MIN_X, RELEASE_MAX_X) - RELEASE_MIN_X) /
        (RELEASE_MAX_X - RELEASE_MIN_X);
      onParamChange(
        keys.release,
        fromLogRatio(
          ratio,
          PARAMETER_RANGES.release.min,
          PARAMETER_RANGES.release.max
        )
      );
    },
    [attackX, keys, onParamChange]
  );

  const handlePointerMove = useCallback(
    (event: React.PointerEvent<SVGSVGElement>) => {
      const handle = activeHandleRef.current;
      if (!handle) return;

      const rect = event.currentTarget.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;

      const x = ((event.clientX - rect.left) / rect.width) * VIEWBOX_WIDTH;
      const y = ((event.clientY - rect.top) / rect.height) * VIEWBOX_HEIGHT;
      updateFromPoint(handle, x, y);
    },
    [updateFromPoint]
  );

  const beginPointerEdit = useCallback(
    (event: React.PointerEvent<SVGCircleElement>, handle: EnvelopeHandle) => {
      event.preventDefault();
      event.stopPropagation();
      activeHandleRef.current = handle;
      event.currentTarget.setPointerCapture?.(event.pointerId);
      onEditStart?.();
    },
    [onEditStart]
  );

  const endPointerEdit = useCallback(() => {
    if (!activeHandleRef.current) return;
    activeHandleRef.current = null;
    onEditEnd?.();
  }, [onEditEnd]);

  const handleKeyboardEdit = useCallback(
    (event: React.KeyboardEvent<SVGCircleElement>, handle: EnvelopeHandle) => {
      const direction =
        event.key === 'ArrowRight' || event.key === 'ArrowUp'
          ? 1
          : event.key === 'ArrowLeft' || event.key === 'ArrowDown'
            ? -1
            : 0;
      if (direction === 0) return;

      event.preventDefault();
      const range = PARAMETER_RANGES[handle];
      const key = keys[handle];
      const current = { attack, decay, sustain, release }[handle];
      const multiplier = event.shiftKey ? 10 : 1;
      const next = clamp(
        current + range.step * multiplier * direction,
        range.min,
        range.max
      );

      onEditStart?.();
      onParamChange(key, next);
      onEditEnd?.();
    },
    [
      attack,
      decay,
      keys,
      onEditEnd,
      onEditStart,
      onParamChange,
      release,
      sustain,
    ]
  );

  const curvePath = `M 10 ${BASELINE_Y} L ${attackX.toFixed(2)} ${PEAK_Y} C ${(attackX + 10).toFixed(2)} ${PEAK_Y}, ${(decayX - 18).toFixed(2)} ${sustainY.toFixed(2)}, ${decayX.toFixed(2)} ${sustainY.toFixed(2)} L ${GATE_X} ${sustainY.toFixed(2)} C ${(GATE_X + 12).toFixed(2)} ${sustainY.toFixed(2)}, ${(releaseX - 10).toFixed(2)} ${BASELINE_Y}, ${releaseX.toFixed(2)} ${BASELINE_Y} L 250 ${BASELINE_Y} Z`;
  const fadePath =
    sustainTime > 0
      ? `M ${decayX.toFixed(2)} ${sustainY.toFixed(2)} C ${(decayX + 24).toFixed(2)} ${sustainY.toFixed(2)}, ${(GATE_X - 24).toFixed(2)} ${BASELINE_Y}, ${GATE_X} ${BASELINE_Y}`
      : null;

  return (
    <div
      className="nodrag nowheel mb-3 w-[260px] max-w-full rounded-md border bg-muted/20 p-2"
      data-testid="envelope-editor"
    >
      <div className="mb-1 flex items-center justify-between">
        <span className="text-[11px] font-medium text-foreground">包络</span>
        {sustainTime > 0 ? (
          <span className="text-[10px] text-muted-foreground">
            延音渐弱 {formatTime(sustainTime)}
          </span>
        ) : null}
      </div>

      <svg
        viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
        className="block h-[106px] w-full touch-none select-none"
        aria-label="ADSR 包络曲线编辑器"
        onPointerMove={handlePointerMove}
        onPointerUp={endPointerEdit}
        onPointerCancel={endPointerEdit}
        onPointerLeave={(event) => {
          if (event.buttons === 0) endPointerEdit();
        }}
      >
        <line
          x1="10"
          x2="250"
          y1={BASELINE_Y}
          y2={BASELINE_Y}
          className="stroke-border"
          strokeWidth="1"
        />
        <line
          x1={GATE_X}
          x2={GATE_X}
          y1="10"
          y2={BASELINE_Y}
          className="stroke-muted-foreground/40"
          strokeDasharray="3 3"
          strokeWidth="1"
        />
        <path
          d={curvePath}
          className="fill-primary/10 stroke-primary"
          strokeWidth="2"
          strokeLinejoin="round"
        />
        {fadePath ? (
          <path
            d={fadePath}
            fill="none"
            className="stroke-primary/50"
            strokeDasharray="3 3"
            strokeWidth="1.5"
          />
        ) : null}

        <EnvelopeHandleCircle
          label="起音时间"
          value={attack}
          min={PARAMETER_RANGES.attack.min}
          max={PARAMETER_RANGES.attack.max}
          x={attackX}
          y={PEAK_Y}
          onPointerDown={(event) => beginPointerEdit(event, 'attack')}
          onKeyDown={(event) => handleKeyboardEdit(event, 'attack')}
        />
        <EnvelopeHandleCircle
          label="衰减时间"
          value={decay}
          min={PARAMETER_RANGES.decay.min}
          max={PARAMETER_RANGES.decay.max}
          x={decayX}
          y={sustainY}
          onPointerDown={(event) => beginPointerEdit(event, 'decay')}
          onKeyDown={(event) => handleKeyboardEdit(event, 'decay')}
        />
        <EnvelopeHandleCircle
          label="持续音量"
          value={sustain}
          min={PARAMETER_RANGES.sustain.min}
          max={PARAMETER_RANGES.sustain.max}
          x={GATE_X}
          y={sustainY}
          onPointerDown={(event) => beginPointerEdit(event, 'sustain')}
          onKeyDown={(event) => handleKeyboardEdit(event, 'sustain')}
        />
        <EnvelopeHandleCircle
          label="释音时间"
          value={release}
          min={PARAMETER_RANGES.release.min}
          max={PARAMETER_RANGES.release.max}
          x={releaseX}
          y={BASELINE_Y}
          onPointerDown={(event) => beginPointerEdit(event, 'release')}
          onKeyDown={(event) => handleKeyboardEdit(event, 'release')}
        />

        <text x="10" y="96" className="fill-muted-foreground text-[9px]">
          A {formatTime(attack)}
        </text>
        <text x="72" y="96" className="fill-muted-foreground text-[9px]">
          D {formatTime(decay)}
        </text>
        <text x="137" y="96" className="fill-muted-foreground text-[9px]">
          S {formatSustain(sustain)}
        </text>
        <text x="199" y="96" className="fill-muted-foreground text-[9px]">
          R {formatTime(release)}
        </text>
      </svg>
    </div>
  );
}

function EnvelopeHandleCircle({
  label,
  value,
  min,
  max,
  x,
  y,
  onPointerDown,
  onKeyDown,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  x: number;
  y: number;
  onPointerDown: (event: React.PointerEvent<SVGCircleElement>) => void;
  onKeyDown: (event: React.KeyboardEvent<SVGCircleElement>) => void;
}) {
  return (
    <circle
      cx={x}
      cy={y}
      r="5"
      role="slider"
      tabIndex={0}
      aria-label={label}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={Number(value.toFixed(3))}
      className="cursor-pointer fill-background stroke-primary outline-none hover:[r:6px] focus:[r:6px] focus:[stroke-width:3px]"
      strokeWidth="2"
      onPointerDown={onPointerDown}
      onKeyDown={onKeyDown}
    />
  );
}
