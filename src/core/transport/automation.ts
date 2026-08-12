import type { ParameterValue } from '@/core/graph/types';
import {
  createDefaultTransportDocument,
  TRANSPORT_DOCUMENT_VERSION,
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
    automationLanes: Array.isArray(candidate.automationLanes)
      ? candidate.automationLanes
          .map(normalizeLane)
          .filter((lane): lane is AutomationLane => Boolean(lane))
      : [],
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
