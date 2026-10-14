import { describe, expect, it, vi } from 'vitest';
import {
  getLegacyMidiScheduledTime,
  parseMidiClipJson,
} from '@/core/midi/utils';
import { MidiClip, MidiEvent } from '@/core/midi/types';
import { SequencerModule } from './SequencerModule';

type ScheduledMidiFrame = {
  tick: number;
  timeSeconds: number;
  events: MidiEvent[];
};

describe('SequencerModule MIDI clip scheduling', () => {
  it('exposes loop as a declarative transport parameter', () => {
    const sequencer = new SequencerModule('sequencer-loop-test');

    expect(sequencer.getParameterValue('loop')).toBe(true);
  });

  it('wraps loop-boundary noteOff into the next loop start frame', () => {
    const sequencer = new SequencerModule('sequencer-test');
    const clip = parseMidiClipJson(
      sequencer.getParameterValue('clip') as string
    );
    const scheduledFrames = (
      sequencer as unknown as {
        buildScheduledEvents: (clip: MidiClip) => ScheduledMidiFrame[];
      }
    ).buildScheduledEvents(clip);

    const finalNote = clip.notes.find((note) => note.midi === 72);
    const firstFrame = scheduledFrames.find((frame) => frame.tick === 0);
    const finalNoteOff = firstFrame?.events.find(
      (event) => event.type === 'noteOff' && event.noteId === finalNote?.id
    );
    const firstNoteOn = firstFrame?.events.find(
      (event) => event.type === 'noteOn' && event.midi === 60
    );

    expect(finalNoteOff).toMatchObject({
      type: 'noteOff',
      noteId: finalNote?.id,
      midi: 72,
      tick: 0,
    });
    expect(firstNoteOn).toMatchObject({ type: 'noteOn', midi: 60, tick: 0 });
    expect(firstFrame?.events.map((event) => event.type)).toEqual([
      'noteOff',
      'noteOn',
    ]);
  });

  it('batches noteOff and noteOn when events share the same tick', () => {
    const sequencer = new SequencerModule('sequencer-overlap-test');
    const clip = parseMidiClipJson(
      JSON.stringify({
        ppq: 480,
        bars: 1,
        timeSignature: [4, 4],
        notes: [
          {
            id: 'first',
            midi: 60,
            startTick: 0,
            durationTicks: 480,
            velocity: 0.8,
          },
          {
            id: 'second',
            midi: 64,
            startTick: 480,
            durationTicks: 480,
            velocity: 0.8,
          },
        ],
        events: [],
      })
    );
    const scheduledFrames = (
      sequencer as unknown as {
        buildScheduledEvents: (clip: MidiClip) => ScheduledMidiFrame[];
      }
    ).buildScheduledEvents(clip);
    const frameAtSecondBeat = scheduledFrames.find(
      (frame) => frame.tick === 480
    );

    expect(frameAtSecondBeat?.events.map((event) => event.type)).toEqual([
      'noteOff',
      'noteOn',
    ]);
  });

  it('keeps legacy activeNotes monophonic across contiguous default clip loops', () => {
    const sequencer = new SequencerModule('sequencer-active-notes-test');
    (
      sequencer as unknown as {
        Tone: {
          Frequency: (
            value: number,
            unit: string
          ) => { toFrequency: () => number };
        };
      }
    ).Tone = {
      Frequency: (value: number) => ({
        toFrequency: () => value,
      }),
    };
    const clip = parseMidiClipJson(
      sequencer.getParameterValue('clip') as string
    );
    const scheduledFrames = (
      sequencer as unknown as {
        buildScheduledEvents: (clip: MidiClip) => ScheduledMidiFrame[];
      }
    ).buildScheduledEvents(clip);
    const applyMidiEvents = (
      sequencer as unknown as {
        applyMidiEvents: (events: MidiEvent[]) => void;
      }
    ).applyMidiEvents.bind(sequencer);

    const activeNotesByFrame = [...scheduledFrames, ...scheduledFrames].map(
      (frame) => {
        applyMidiEvents(frame.events);
        return sequencer.outputPorts['activeNotes'].getValue();
      }
    );

    expect(activeNotesByFrame).toEqual([
      [60],
      [64],
      [67],
      [72],
      [60],
      [64],
      [67],
      [72],
    ]);
  });

  it('emits MIDI ahead of time but publishes legacy ports at the audio deadline', () => {
    vi.useFakeTimers();
    let audioTime = 12.245;
    const sequencer = new SequencerModule('sequencer-clock-test');
    const drawSchedule = vi.fn();
    (
      sequencer as unknown as {
        Tone: {
          immediate: () => number;
          Draw: { schedule: typeof drawSchedule };
          Frequency: (value: number) => { toFrequency: () => number };
        };
        scheduleFrame: (frame: ScheduledMidiFrame, time: number) => void;
      }
    ).Tone = {
      immediate: () => audioTime,
      Draw: { schedule: drawSchedule },
      Frequency: (value: number) => ({ toFrequency: () => value }),
    };

    (
      sequencer as unknown as {
        scheduleFrame: (frame: ScheduledMidiFrame, time: number) => void;
      }
    ).scheduleFrame(
      {
        tick: 0,
        timeSeconds: 0,
        events: [{ type: 'noteOn', noteId: 'clock-note', midi: 69, velocity: 0.8 }],
      },
      12.345
    );

    expect(sequencer.outputPorts['midi'].getValue()).toMatchObject({
      scheduledTime: 12.345,
      activeNotes: [{ id: 'clock-note', midi: 69 }],
      events: [{ type: 'noteOn', noteId: 'clock-note' }],
    });
    expect(sequencer.outputPorts['activeNotes'].getValue()).toEqual([]);
    audioTime = 12.345;
    vi.advanceTimersByTime(101);
    const legacyNotes = sequencer.outputPorts['activeNotes'].getValue();
    expect(legacyNotes).toEqual([69]);
    expect(getLegacyMidiScheduledTime(legacyNotes)).toBe(12.345);
    // Draw 只适合 DOM 工作，经由它转发 MIDI 会引入抖动并在停止后残留回调。
    expect(drawSchedule).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('cancels queued legacy noteOn when stopped during look-ahead', () => {
    vi.useFakeTimers();
    const sequencer = new SequencerModule('legacy-stop');
    const internal = sequencer as unknown as {
      Tone: { immediate: () => number; Frequency: (midi: number) => { toFrequency: () => number } };
      scheduleFrame: (frame: ScheduledMidiFrame, time: number) => void;
      allNotesOff: () => void;
    };
    let audioTime = 0;
    internal.Tone = {
      immediate: () => audioTime,
      Frequency: (midi) => ({ toFrequency: () => midi }),
    };
    internal.scheduleFrame({ tick: 0, timeSeconds: 0, events: [
      { type: 'noteOn', noteId: 'future', midi: 60, velocity: 1 },
    ] }, 0.1);
    internal.allNotesOff();
    audioTime = 1;
    vi.advanceTimersByTime(1000);
    expect(sequencer.outputPorts.activeNotes.getValue()).toEqual([]);
    expect(sequencer.outputPorts.gate.getValue()).toBe(0);
    vi.useRealTimers();
  });

  it('cancels scheduled playback and emits allNotesOff when disposed', () => {
    const sequencer = new SequencerModule('sequencer-stop-test');
    const cancel = vi.fn();
    const dispose = vi.fn();
    (
      sequencer as unknown as {
        Tone: {
          now: () => number;
          Draw: { cancel: (time: number) => void };
          Transport: { state: string; stop: () => void; position: number };
          Frequency: (value: number) => { toFrequency: () => number };
        };
        sequencePart: { cancel: typeof cancel; dispose: typeof dispose };
        scheduleFrame: (frame: ScheduledMidiFrame, time: number) => void;
      }
    ).Tone = {
      now: () => 3,
      Draw: { cancel },
      Transport: { state: 'stopped', stop: vi.fn(), position: 0 },
      Frequency: (value: number) => ({ toFrequency: () => value }),
    };
    (
      sequencer as unknown as {
        sequencePart: { cancel: typeof cancel; dispose: typeof dispose };
        scheduleFrame: (frame: ScheduledMidiFrame, time: number) => void;
      }
    ).sequencePart = { cancel, dispose };
    (
      sequencer as unknown as {
        scheduleFrame: (frame: ScheduledMidiFrame, time: number) => void;
      }
    ).scheduleFrame(
      { tick: 0, timeSeconds: 0, events: [{ type: 'noteOn', noteId: 'live', midi: 60, velocity: 1 }] },
      3
    );

    sequencer.dispose();

    expect(cancel).toHaveBeenCalledWith(0);
    expect(dispose).toHaveBeenCalledOnce();
    expect(sequencer.outputPorts['midi'].getValue()).toMatchObject({
      activeNotes: [],
      events: [{ type: 'allNotesOff' }],
    });
  });
});
