import {
  DEFAULT_PPQ,
  LegacySequenceStep,
  MIDI_CLIP_VERSION,
  MidiActiveNote,
  MidiClip,
  MidiEvent,
  MidiFrame,
  MidiNote,
} from './types';

const NOTE_NAMES = [
  'C',
  'C#',
  'D',
  'D#',
  'E',
  'F',
  'F#',
  'G',
  'G#',
  'A',
  'A#',
  'B',
];

let frameSerial = 0;
let generatedNoteId = 0;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function normalize01(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? clamp(value, 0, 1)
    : fallback;
}

export function normalizePitchBend(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? clamp(value, -1, 1)
    : 0;
}

export function createMidiNoteId(prefix = 'note'): string {
  generatedNoteId += 1;
  return `${prefix}_${generatedNoteId.toString(36)}`;
}

export function createMidiFrame(
  activeNotes: MidiActiveNote[] = [],
  events: MidiEvent[] = []
): MidiFrame {
  frameSerial += 1;
  return {
    type: 'midi-frame',
    serial: frameSerial,
    activeNotes: activeNotes.map(normalizeActiveNote),
    events: events
      .map(normalizeMidiEvent)
      .filter((event): event is MidiEvent => Boolean(event)),
  };
}

export function isMidiFrame(value: unknown): value is MidiFrame {
  return (
    isRecord(value) &&
    value.type === 'midi-frame' &&
    typeof value.serial === 'number' &&
    Array.isArray(value.activeNotes) &&
    Array.isArray(value.events)
  );
}

export function midiFrameToLegacyArrays(frame: MidiFrame): {
  notes: number[];
  velocities: number[];
} {
  return {
    notes: frame.activeNotes.map((note) => note.midi),
    velocities: frame.activeNotes.map((note) => note.velocity),
  };
}

export function legacyArraysToMidiFrame(
  notes: unknown[],
  velocities: unknown[] = [],
  source = 'legacy'
): MidiFrame {
  const activeNotes: MidiActiveNote[] = [];

  notes.forEach((noteValue, index) => {
    if (typeof noteValue !== 'number' || !Number.isFinite(noteValue)) {
      return;
    }

    const midi = clamp(Math.round(noteValue), 0, 127);
    activeNotes.push({
      id: `${source}_${midi}`,
      midi,
      velocity: normalize01(velocities[index], 0.7),
      pitchBend: 0,
      pressure: 0,
      timbre: 0,
      source,
    });
  });

  return createMidiFrame(activeNotes, []);
}

export function noteNameToMidi(noteName: string): number | null {
  const match = noteName.trim().match(/^([A-Ga-g])([#b]?)(-?\d+)$/);
  if (!match) {
    return null;
  }

  const [, rawName, accidental, octaveText] = match;
  let noteIndex = NOTE_NAMES.indexOf(rawName.toUpperCase());
  if (noteIndex < 0) {
    return null;
  }

  if (accidental === '#') {
    noteIndex += 1;
  } else if (accidental === 'b') {
    noteIndex -= 1;
  }

  const octave = Number.parseInt(octaveText, 10);
  const midi = (octave + 1) * 12 + noteIndex;
  return clamp(midi, 0, 127);
}

export function midiToNoteName(midi: number): string {
  const rounded = clamp(Math.round(midi), 0, 127);
  const noteName = NOTE_NAMES[rounded % 12];
  const octave = Math.floor(rounded / 12) - 1;
  return `${noteName}${octave}`;
}

export function durationToTicks(duration: string, ppq = DEFAULT_PPQ): number {
  const trimmed = duration.trim();
  const noteMatch = trimmed.match(/^(\d+)n$/);
  if (noteMatch) {
    const denominator = Number.parseInt(noteMatch[1], 10);
    if (denominator > 0) {
      return Math.max(1, Math.round((ppq * 4) / denominator));
    }
  }

  const barsMatch = trimmed.match(/^(\d+)m$/);
  if (barsMatch) {
    return Number.parseInt(barsMatch[1], 10) * ppq * 4;
  }

  const numeric = Number(trimmed);
  if (Number.isFinite(numeric) && numeric > 0) {
    return Math.max(1, Math.round(numeric * ppq));
  }

  return ppq;
}

export function ticksPerBar(
  clip: Pick<MidiClip, 'ppq' | 'timeSignature'>
): number {
  return Math.round(
    clip.ppq * 4 * (clip.timeSignature[0] / clip.timeSignature[1])
  );
}

export function getClipLengthTicks(
  clip: Pick<MidiClip, 'ppq' | 'bars' | 'timeSignature'>
): number {
  return ticksPerBar(clip) * clip.bars;
}

export function createDefaultMidiClip(): MidiClip {
  return {
    version: MIDI_CLIP_VERSION,
    ppq: DEFAULT_PPQ,
    bars: 1,
    timeSignature: [4, 4],
    notes: [
      {
        id: 'note_c4',
        midi: 60,
        startTick: 0,
        durationTicks: DEFAULT_PPQ,
        velocity: 0.8,
      },
      {
        id: 'note_e4',
        midi: 64,
        startTick: DEFAULT_PPQ,
        durationTicks: DEFAULT_PPQ,
        velocity: 0.8,
      },
      {
        id: 'note_g4',
        midi: 67,
        startTick: DEFAULT_PPQ * 2,
        durationTicks: DEFAULT_PPQ,
        velocity: 0.8,
      },
      {
        id: 'note_c5',
        midi: 72,
        startTick: DEFAULT_PPQ * 3,
        durationTicks: DEFAULT_PPQ,
        velocity: 0.8,
      },
    ],
    events: [],
  };
}

export function legacyStepsToMidiClip(
  steps: LegacySequenceStep[],
  ppq = DEFAULT_PPQ
): MidiClip {
  const notes: MidiNote[] = [];
  let cursor = 0;

  steps.forEach((step, index) => {
    const midi = noteNameToMidi(step.note);
    const durationTicks = durationToTicks(step.duration || '4n', ppq);
    if (midi !== null) {
      notes.push({
        id: `legacy_${index}_${midi}`,
        midi,
        startTick: cursor,
        durationTicks,
        velocity: normalize01(step.velocity, 0.8),
      });
    }
    cursor += durationTicks;
  });

  const bars = Math.max(1, Math.ceil(cursor / (ppq * 4)));
  return {
    version: MIDI_CLIP_VERSION,
    ppq,
    bars,
    timeSignature: [4, 4],
    notes,
    events: [],
  };
}

export function parseMidiClipJson(value: string): MidiClip {
  try {
    const parsed = JSON.parse(value);
    return normalizeMidiClip(parsed);
  } catch {
    return createDefaultMidiClip();
  }
}

export function normalizeMidiClip(value: unknown): MidiClip {
  if (Array.isArray(value)) {
    return legacyStepsToMidiClip(value as LegacySequenceStep[]);
  }

  if (!isRecord(value)) {
    return createDefaultMidiClip();
  }

  const ppq =
    typeof value.ppq === 'number' && Number.isFinite(value.ppq) && value.ppq > 0
      ? Math.round(value.ppq)
      : DEFAULT_PPQ;
  const timeSignature = normalizeTimeSignature(value.timeSignature);
  const notes = Array.isArray(value.notes)
    ? value.notes
        .map(normalizeMidiNote)
        .filter((note): note is MidiNote => Boolean(note))
    : [];
  const events = Array.isArray(value.events)
    ? value.events
        .map(normalizeMidiEvent)
        .filter((event): event is MidiEvent => Boolean(event))
    : [];
  const lastTick = notes.reduce(
    (max, note) => Math.max(max, note.startTick + note.durationTicks),
    ppq * 4
  );
  const bars =
    typeof value.bars === 'number' &&
    Number.isFinite(value.bars) &&
    value.bars > 0
      ? Math.ceil(value.bars)
      : Math.max(
          1,
          Math.ceil(
            lastTick /
              Math.round(ppq * 4 * (timeSignature[0] / timeSignature[1]))
          )
        );

  return {
    version: MIDI_CLIP_VERSION,
    ppq,
    bars,
    timeSignature,
    notes,
    events,
  };
}

function normalizeTimeSignature(value: unknown): [number, number] {
  if (
    Array.isArray(value) &&
    typeof value[0] === 'number' &&
    typeof value[1] === 'number' &&
    value[0] > 0 &&
    value[1] > 0
  ) {
    return [Math.round(value[0]), Math.round(value[1])];
  }
  return [4, 4];
}

function normalizeMidiNote(value: unknown): MidiNote | null {
  if (!isRecord(value) || typeof value.midi !== 'number') {
    return null;
  }

  const midi = clamp(Math.round(value.midi), 0, 127);
  return {
    id:
      typeof value.id === 'string' && value.id ? value.id : createMidiNoteId(),
    midi,
    startTick:
      typeof value.startTick === 'number' && Number.isFinite(value.startTick)
        ? Math.max(0, Math.round(value.startTick))
        : 0,
    durationTicks:
      typeof value.durationTicks === 'number' &&
      Number.isFinite(value.durationTicks)
        ? Math.max(1, Math.round(value.durationTicks))
        : DEFAULT_PPQ,
    velocity: normalize01(value.velocity, 0.8),
    channel:
      typeof value.channel === 'number' && Number.isFinite(value.channel)
        ? clamp(Math.round(value.channel), 1, 16)
        : undefined,
    pitchBend: normalizePitchBend(value.pitchBend),
    pressure: normalize01(value.pressure, 0),
    timbre: normalize01(value.timbre, 0),
  };
}

function normalizeActiveNote(value: MidiActiveNote): MidiActiveNote {
  return {
    ...value,
    midi: clamp(Math.round(value.midi), 0, 127),
    velocity: normalize01(value.velocity, 0.7),
    pitchBend: normalizePitchBend(value.pitchBend),
    pressure: normalize01(value.pressure, 0),
    timbre: normalize01(value.timbre, 0),
  };
}

function normalizeMidiEvent(value: unknown): MidiEvent | null {
  if (!isRecord(value) || typeof value.type !== 'string') {
    return null;
  }

  const base = {
    noteId: typeof value.noteId === 'string' ? value.noteId : undefined,
    channel:
      typeof value.channel === 'number' && Number.isFinite(value.channel)
        ? clamp(Math.round(value.channel), 1, 16)
        : undefined,
    tick:
      typeof value.tick === 'number' && Number.isFinite(value.tick)
        ? Math.max(0, Math.round(value.tick))
        : undefined,
  };

  if (value.type === 'noteOn' && typeof value.midi === 'number') {
    return {
      type: 'noteOn',
      noteId: base.noteId || createMidiNoteId(),
      midi: clamp(Math.round(value.midi), 0, 127),
      velocity: normalize01(value.velocity, 0.7),
      channel: base.channel,
      pitchBend: normalizePitchBend(value.pitchBend),
      pressure: normalize01(value.pressure, 0),
      timbre: normalize01(value.timbre, 0),
      tick: base.tick,
    };
  }

  if (value.type === 'noteOff' && typeof value.midi === 'number') {
    return {
      type: 'noteOff',
      noteId:
        base.noteId || `${base.channel ?? 'note'}_${Math.round(value.midi)}`,
      midi: clamp(Math.round(value.midi), 0, 127),
      channel: base.channel,
      tick: base.tick,
    };
  }

  if (value.type === 'pitchBend') {
    return {
      type: 'pitchBend',
      noteId: base.noteId,
      channel: base.channel,
      value: normalizePitchBend(value.value),
      tick: base.tick,
    };
  }

  if (value.type === 'pressure') {
    return {
      type: 'pressure',
      noteId: base.noteId,
      channel: base.channel,
      value: normalize01(value.value, 0),
      tick: base.tick,
    };
  }

  if (value.type === 'timbre') {
    return {
      type: 'timbre',
      noteId: base.noteId,
      channel: base.channel,
      value: normalize01(value.value, 0),
      tick: base.tick,
    };
  }

  if (value.type === 'controlChange' && typeof value.controller === 'number') {
    return {
      type: 'controlChange',
      controller: clamp(Math.round(value.controller), 0, 127),
      channel: base.channel,
      value: normalize01(value.value, 0),
      tick: base.tick,
    };
  }

  if (value.type === 'allNotesOff') {
    return { type: 'allNotesOff', channel: base.channel, tick: base.tick };
  }

  return null;
}
