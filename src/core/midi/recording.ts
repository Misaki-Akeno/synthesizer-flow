import type { MidiClip, MidiEvent, MidiFrame, MidiNote } from './types';
import { clamp, createMidiNoteId, getClipLengthTicks } from './utils';

interface PendingNote {
  recordedId: string;
  event: Extract<MidiEvent, { type: 'noteOn' }>;
  startTick: number;
}

export interface MidiRecordingResult {
  notes: MidiNote[];
  events: MidiEvent[];
}

export function quantizeTickWithStrength(
  tick: number,
  gridTicks: number,
  strength: number
): number {
  const safeGrid = Math.max(1, gridTicks);
  const target = Math.round(tick / safeGrid) * safeGrid;
  return Math.round(tick + (target - tick) * clamp(strength, 0, 1));
}

export class MidiClipRecorder {
  private pending = new Map<string, PendingNote>();
  private notes: MidiNote[] = [];
  private events: MidiEvent[] = [];

  constructor(private readonly lengthTicks?: number) {}

  recordFrame(frame: MidiFrame, tick: number): void {
    const rawPosition = Math.max(0, Math.round(tick));
    const position = this.lengthTicks
      ? rawPosition % this.lengthTicks
      : rawPosition;
    frame.events.forEach((event) => {
      if (event.type === 'noteOn') {
        this.pending.set(event.noteId, {
          recordedId: createMidiNoteId('recorded'),
          event,
          startTick: position,
        });
        return;
      }
      if (event.type === 'noteOff') {
        const started = this.pending.get(event.noteId);
        if (!started) return;
        this.notes.push({
          id: started.recordedId,
          midi: started.event.midi,
          startTick: started.startTick,
          durationTicks: Math.max(
            1,
            position >= started.startTick
              ? position - started.startTick
              : (this.lengthTicks ?? 0) - started.startTick + position
          ),
          velocity: started.event.velocity,
          channel: started.event.channel,
          pitchBend: started.event.pitchBend,
          pressure: started.event.pressure,
          timbre: started.event.timbre,
        });
        this.pending.delete(event.noteId);
        return;
      }
      if (event.type === 'allNotesOff') {
        this.pending.forEach((started) => {
          this.notes.push(this.createRecordedNote(started, position));
        });
        this.pending.clear();
        return;
      }
      if (event.type !== 'controlChange') {
        const pending = event.noteId
          ? this.pending.get(event.noteId)
          : undefined;
        this.events.push({
          ...event,
          ...(pending ? { noteId: pending.recordedId } : {}),
          tick: position,
        });
      }
    });
  }

  private createRecordedNote(started: PendingNote, endTick: number): MidiNote {
    return {
      id: started.recordedId,
      midi: started.event.midi,
      startTick: started.startTick,
      durationTicks: Math.max(
        1,
        endTick >= started.startTick
          ? endTick - started.startTick
          : (this.lengthTicks ?? 0) - started.startTick + endTick
      ),
      velocity: started.event.velocity,
      channel: started.event.channel,
      pitchBend: started.event.pitchBend,
      pressure: started.event.pressure,
      timbre: started.event.timbre,
    };
  }

  finish(tick: number): MidiRecordingResult {
    const rawEndTick = Math.max(0, Math.round(tick));
    const endTick = this.lengthTicks
      ? rawEndTick % this.lengthTicks
      : Math.max(1, rawEndTick);
    this.pending.forEach((started) => {
      this.notes.push(this.createRecordedNote(started, endTick));
    });
    this.pending.clear();
    return { notes: [...this.notes], events: [...this.events] };
  }
}

export function mergeMidiRecording(
  clip: MidiClip,
  recording: MidiRecordingResult,
  gridTicks: number,
  quantizeStrength: number
): MidiClip {
  const length = getClipLengthTicks(clip);
  const notes = recording.notes.map((note) => {
    const startTick = clamp(
      quantizeTickWithStrength(note.startTick, gridTicks, quantizeStrength),
      0,
      length - 1
    );
    const quantizedEndTick = quantizeTickWithStrength(
      note.startTick + note.durationTicks,
      gridTicks,
      quantizeStrength
    );
    // 跨循环边界的音符允许结束位置超过 clip length；Sequencer 会在调度
    // note-off 时取模。把 endTick 裁到 length 会错误缩短循环末尾的录音。
    const durationTicks = clamp(quantizedEndTick - startTick, 1, length);
    return { ...note, startTick, durationTicks };
  });
  return {
    ...clip,
    notes: [...clip.notes, ...notes],
    events: [...clip.events, ...recording.events],
  };
}
