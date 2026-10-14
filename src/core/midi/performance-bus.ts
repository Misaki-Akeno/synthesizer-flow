import type { MidiFrame } from './types';

export interface MidiPerformanceMessage {
  sourceId: string;
  frame: MidiFrame;
}

type MidiPerformanceListener = (message: MidiPerformanceMessage) => void;

/** 运行时 MIDI 事件总线；不进入画布、历史或项目 JSON。 */
class MidiPerformanceBus {
  private listeners = new Set<MidiPerformanceListener>();

  publish(message: MidiPerformanceMessage): void {
    this.listeners.forEach((listener) => listener(message));
  }

  subscribe(listener: MidiPerformanceListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}

export const midiPerformanceBus = new MidiPerformanceBus();
