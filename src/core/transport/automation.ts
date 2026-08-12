import type { ParameterValue } from '@/core/graph/types';
import {
  createDefaultTransportDocument,
  TRANSPORT_DOCUMENT_VERSION,
  TRANSPORT_PPQ,
  type AutomationLane,
  type AutomationPoint,
  type TransportDocument,
} from './types';

const MIN_BPM = 20;
const MAX_BPM = 320;
const RECORD_POINT_TOLERANCE_TICKS = 12;

function isParameterValue(value: unknown): value is ParameterValue {
  return (
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    typeof value === 'string'
  );
}

function normalizePoint(value: unknown): AutomationPoint | null {
  if (!value || typeof value !== 'object') return null;
  const point = value as Partial<AutomationPoint>;
  if (!Number.isFinite(point.tick) || !isParameterValue(point.value)) {
    return null;
  }
  return {
    tick: Math.max(0, Math.round(point.tick as number)),
    value: point.value,
  };
}

function normalizeLane(value: unknown): AutomationLane | null {
  if (!value || typeof value !== 'object') return null;
  const lane = value as Partial<AutomationLane>;
  if (
    typeof lane.id !== 'string' ||
    typeof lane.moduleId !== 'string' ||
    typeof lane.parameterKey !== 'string' ||
    !Array.isArray(lane.points)
  ) {
    return null;
  }
  const points = lane.points
    .map(normalizePoint)
    .filter((point): point is AutomationPoint => Boolean(point))
    .sort((a, b) => a.tick - b.tick);
  return {
    id: lane.id,
    moduleId: lane.moduleId,
    parameterKey: lane.parameterKey,
    interpolation: lane.interpolation === 'linear' ? 'linear' : 'step',
    points,
  };
}

export function normalizeTransportDocument(value: unknown): TransportDocument {
  const fallback = createDefaultTransportDocument();
  if (!value || typeof value !== 'object') return fallback;
  const candidate = value as Partial<TransportDocument>;
  const numerator = candidate.timeSignature?.[0];
  const denominator = candidate.timeSignature?.[1];
  const loopStart = candidate.loopRange?.startTick;
  const loopEnd = candidate.loopRange?.endTick;
  const normalizedLoopStart = Number.isFinite(loopStart)
    ? Math.max(0, Math.round(loopStart as number))
    : fallback.loopRange.startTick;
  const normalizedLoopEnd = Number.isFinite(loopEnd)
    ? Math.max(
        normalizedLoopStart + TRANSPORT_PPQ,
        Math.round(loopEnd as number)
      )
    : fallback.loopRange.endTick;
  const automationMode = candidate.automationMode;
  return {
    version: TRANSPORT_DOCUMENT_VERSION,
    bpm: Number.isFinite(candidate.bpm)
      ? Math.min(MAX_BPM, Math.max(MIN_BPM, candidate.bpm as number))
      : fallback.bpm,
    timeSignature:
      Number.isInteger(numerator) &&
      Number.isInteger(denominator) &&
      (numerator as number) > 0 &&
      (denominator as number) > 0
        ? [numerator as number, denominator as number]
        : fallback.timeSignature,
    loopEnabled:
      typeof candidate.loopEnabled === 'boolean'
        ? candidate.loopEnabled
        : fallback.loopEnabled,
    loopRange: {
      startTick: normalizedLoopStart,
      endTick: normalizedLoopEnd,
    },
    automationMode:
      automationMode === 'read' ||
      automationMode === 'touch' ||
      automationMode === 'latch' ||
      automationMode === 'write'
        ? automationMode
        : fallback.automationMode,
    automationLanes: Array.isArray(candidate.automationLanes)
      ? candidate.automationLanes
          .map(normalizeLane)
          .filter((lane): lane is AutomationLane => Boolean(lane))
      : [],
  };
}

function simplifyNumericPoints(
  points: AutomationPoint[],
  tolerance: number
): AutomationPoint[] {
  if (points.length < 3) return points;
  const simplified = [points[0]];
  for (let index = 1; index < points.length - 1; index += 1) {
    const previous = simplified[simplified.length - 1];
    const current = points[index];
    const next = points[index + 1];
    if (
      typeof previous.value !== 'number' ||
      typeof current.value !== 'number' ||
      typeof next.value !== 'number' ||
      next.tick === previous.tick
    ) {
      simplified.push(current);
      continue;
    }
    const progress =
      (current.tick - previous.tick) / (next.tick - previous.tick);
    const expected = previous.value + (next.value - previous.value) * progress;
    if (Math.abs(current.value - expected) > tolerance) {
      simplified.push(current);
    }
  }
  simplified.push(points[points.length - 1]);
  return simplified;
}

/** 压缩录制产生的冗余线性关键点，保留开关和列表值的精确变化。 */
export function simplifyAutomationDocument(
  document: TransportDocument,
  tolerance = 0.002
): TransportDocument {
  return {
    ...document,
    automationLanes: document.automationLanes.map((lane) => ({
      ...lane,
      points:
        lane.interpolation === 'linear'
          ? simplifyNumericPoints(lane.points, tolerance)
          : lane.points,
    })),
  };
}

export function automationLaneId(
  moduleId: string,
  parameterKey: string
): string {
  return `${moduleId}:${parameterKey}`;
}

export function upsertAutomationPoint(
  document: TransportDocument,
  moduleId: string,
  parameterKey: string,
  value: ParameterValue,
  tick: number
): TransportDocument {
  const laneId = automationLaneId(moduleId, parameterKey);
  const nextTick = Math.max(0, Math.round(tick));
  const existingLane = document.automationLanes.find(
    (lane) => lane.id === laneId
  );
  const interpolation = typeof value === 'number' ? 'linear' : 'step';
  const points = [...(existingLane?.points ?? [])];
  const nearbyIndex = points.findIndex(
    (point) => Math.abs(point.tick - nextTick) <= RECORD_POINT_TOLERANCE_TICKS
  );
  const nextPoint = { tick: nextTick, value };
  if (nearbyIndex >= 0) {
    points[nearbyIndex] = nextPoint;
  } else {
    points.push(nextPoint);
  }
  points.sort((a, b) => a.tick - b.tick);

  const lane: AutomationLane = {
    id: laneId,
    moduleId,
    parameterKey,
    interpolation,
    points,
  };
  return {
    ...document,
    automationLanes: existingLane
      ? document.automationLanes.map((item) =>
          item.id === laneId ? lane : item
        )
      : [...document.automationLanes, lane],
  };
}

export function getAutomationValueAtTick(
  lane: AutomationLane,
  tick: number
): ParameterValue | undefined {
  if (lane.points.length === 0) return undefined;
  const first = lane.points[0];
  if (tick <= first.tick) return first.value;

  for (let index = 1; index < lane.points.length; index += 1) {
    const next = lane.points[index];
    if (tick > next.tick) continue;
    const previous = lane.points[index - 1];
    if (
      lane.interpolation !== 'linear' ||
      typeof previous.value !== 'number' ||
      typeof next.value !== 'number' ||
      next.tick === previous.tick
    ) {
      return previous.value;
    }
    const progress = (tick - previous.tick) / (next.tick - previous.tick);
    return previous.value + (next.value - previous.value) * progress;
  }

  return lane.points[lane.points.length - 1].value;
}

export function removeAutomationLane(
  document: TransportDocument,
  laneId: string
): TransportDocument {
  return {
    ...document,
    automationLanes: document.automationLanes.filter(
      (lane) => lane.id !== laneId
    ),
  };
}
