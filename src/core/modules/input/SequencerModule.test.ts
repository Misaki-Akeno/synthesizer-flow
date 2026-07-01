import { describe, expect, it } from 'vitest';
import { parseMidiClipJson } from '@/core/midi/utils';
import { MidiClip, MidiEvent } from '@/core/midi/types';
import { SequencerModule } from './SequencerModule';

type ScheduledMidiFrame = {
  tick: number;
  timeSeconds: number;
  events: MidiEvent[];
};

describe('SequencerModule MIDI clip scheduling', () => {
  it('wraps loop-boundary noteOff into the next loop start frame', () => {
    const sequencer = new SequencerModule('sequencer-test');
    const clip = parseMidiClipJson(sequencer.getParameterValue('clip') as string);
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
    expect(firstFrame?.events.map((event) => event.type)).toEqual(['noteOff', 'noteOn']);
  });

  it('batches noteOff and noteOn when events share the same tick', () => {
    const sequencer = new SequencerModule('sequencer-overlap-test');
    const clip = parseMidiClipJson(
      JSON.stringify({
        ppq: 480,
        bars: 1,
        timeSignature: [4, 4],
        notes: [
          { id: 'first', midi: 60, startTick: 0, durationTicks: 480, velocity: 0.8 },
          { id: 'second', midi: 64, startTick: 480, durationTicks: 480, velocity: 0.8 },
        ],
        events: [],
      })
    );
    const scheduledFrames = (
      sequencer as unknown as {
        buildScheduledEvents: (clip: MidiClip) => ScheduledMidiFrame[];
      }
    ).buildScheduledEvents(clip);
    const frameAtSecondBeat = scheduledFrames.find((frame) => frame.tick === 480);

    expect(frameAtSecondBeat?.events.map((event) => event.type)).toEqual(['noteOff', 'noteOn']);
  });

  it('keeps legacy activeNotes monophonic across contiguous default clip loops', () => {
    const sequencer = new SequencerModule('sequencer-active-notes-test');
    (
      sequencer as unknown as {
        Tone: { Frequency: (value: number, unit: string) => { toFrequency: () => number } };
      }
    ).Tone = {
      Frequency: (value: number) => ({
        toFrequency: () => value,
      }),
    };
    const clip = parseMidiClipJson(sequencer.getParameterValue('clip') as string);
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

    const activeNotesByFrame = [...scheduledFrames, ...scheduledFrames].map((frame) => {
      applyMidiEvents(frame.events);
      return sequencer.outputPorts['activeNotes'].getValue();
    });

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
});
