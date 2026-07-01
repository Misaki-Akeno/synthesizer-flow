export const MIDI_CLIP_VERSION = 2;
export const DEFAULT_PPQ = 480;
export const DEFAULT_PITCH_BEND_RANGE = 48;

export interface MidiExpression {
  pitchBend: number;
  pressure: number;
  timbre: number;
}

export interface MidiNote {
  id: string;
  midi: number;
  startTick: number;
  durationTicks: number;
  velocity: number;
  channel?: number;
  pitchBend?: number;
  pressure?: number;
  timbre?: number;
}

export type MidiEvent =
  | {
      type: 'noteOn';
      noteId: string;
      midi: number;
      velocity: number;
      channel?: number;
      pitchBend?: number;
      pressure?: number;
      timbre?: number;
      tick?: number;
    }
  | { type: 'noteOff'; noteId: string; midi: number; channel?: number; tick?: number }
  | { type: 'pitchBend'; noteId?: string; channel?: number; value: number; tick?: number }
  | { type: 'pressure'; noteId?: string; channel?: number; value: number; tick?: number }
  | { type: 'timbre'; noteId?: string; channel?: number; value: number; tick?: number }
  | { type: 'allNotesOff'; channel?: number; tick?: number };

export interface MidiActiveNote extends MidiExpression {
  id: string;
  midi: number;
  velocity: number;
  channel?: number;
  source?: string;
}

export interface MidiFrame {
  type: 'midi-frame';
  serial: number;
  activeNotes: MidiActiveNote[];
  events: MidiEvent[];
}

export interface MidiClip {
  version: typeof MIDI_CLIP_VERSION;
  ppq: number;
  bars: number;
  timeSignature: [number, number];
  notes: MidiNote[];
  events: MidiEvent[];
}

export interface LegacySequenceStep {
  note: string;
  velocity: number;
  duration: string;
}
