import type { ParameterValue } from '@/core/graph/types';

export const TRANSPORT_DOCUMENT_VERSION = 3;
export const TRANSPORT_PPQ = 480;
export const DEFAULT_TRANSPORT_BPM = 120;

export interface AutomationPoint {
  tick: number;
  value: ParameterValue;
}

export interface AutomationLane {
  id: string;
  moduleId: string;
  parameterKey: string;
  interpolation: 'linear' | 'step';
  points: AutomationPoint[];
}

export type AutomationMode = 'read' | 'touch' | 'latch' | 'write';

export interface TransportLoopRange {
  startTick: number;
  endTick: number;
}

export interface MidiControlMapping {
  id: string;
  moduleId: string;
  parameterKey: string;
  channel: number;
  controller: number;
  min: number;
  max: number;
}

/**
 * 随工程保存的 Transport 声明数据。
 * 播放位置、播放中和录制中等瞬时状态不进入项目文件。
 */
export interface TransportDocument {
  version: typeof TRANSPORT_DOCUMENT_VERSION;
  bpm: number;
  timeSignature: [number, number];
  loopEnabled: boolean;
  loopRange: TransportLoopRange;
  automationMode: AutomationMode;
  automationLanes: AutomationLane[];
  midiMappings: MidiControlMapping[];
}

export function createDefaultTransportDocument(): TransportDocument {
  return {
    version: TRANSPORT_DOCUMENT_VERSION,
    bpm: DEFAULT_TRANSPORT_BPM,
    timeSignature: [4, 4],
    loopEnabled: true,
    loopRange: {
      startTick: 0,
      endTick: TRANSPORT_PPQ * 4 * 4,
    },
    automationMode: 'touch',
    automationLanes: [],
    midiMappings: [],
  };
}
