import { describe, expect, it } from 'vitest';
import { createMidiFrame, normalizeMidiClip } from './utils';
import {
  mergeMidiRecording,
  MidiClipRecorder,
  quantizeTickWithStrength,
} from './recording';

describe('MIDI recording', () => {
  it('pairs note events into notes and preserves expression', () => {
    const recorder = new MidiClipRecorder();
    recorder.recordFrame(
      createMidiFrame(
        [],
        [{ type: 'noteOn', noteId: 'n1', midi: 60, velocity: 0.8 }]
      ),
      101
    );
    recorder.recordFrame(
      createMidiFrame([], [{ type: 'pitchBend', noteId: 'n1', value: 0.25 }]),
      180
    );
    recorder.recordFrame(
      createMidiFrame([], [{ type: 'noteOff', noteId: 'n1', midi: 60 }]),
      351
    );

    const result = recorder.finish(400);
    expect(result.notes[0]).toMatchObject({
      midi: 60,
      startTick: 101,
      durationTicks: 250,
    });
    expect(result.events[0]).toMatchObject({
      type: 'pitchBend',
      noteId: result.notes[0].id,
      tick: 180,
    });
  });

  it('keeps note duration when a take crosses the loop boundary', () => {
    const recorder = new MidiClipRecorder(1920);
    recorder.recordFrame(
      createMidiFrame(
        [],
        [{ type: 'noteOn', noteId: 'looped', midi: 67, velocity: 1 }]
      ),
      1800
    );
    recorder.recordFrame(
      createMidiFrame([], [{ type: 'noteOff', noteId: 'looped', midi: 67 }]),
      120
    );

    const recording = recorder.finish(120);
    expect(recording.notes[0].durationTicks).toBe(240);

    const clip = normalizeMidiClip({ notes: [], bars: 1 });
    const merged = mergeMidiRecording(clip, recording, 120, 1);
    expect(merged.notes[0]).toMatchObject({
      startTick: 1800,
      durationTicks: 240,
    });
  });

  it('quantizes non-destructively using a strength between zero and one', () => {
    expect(quantizeTickWithStrength(100, 120, 0)).toBe(100);
    expect(quantizeTickWithStrength(100, 120, 0.5)).toBe(110);
    expect(quantizeTickWithStrength(100, 120, 1)).toBe(120);

    const clip = normalizeMidiClip({ notes: [], bars: 1 });
    const merged = mergeMidiRecording(
      clip,
      {
        notes: [
          {
            id: 'take',
            midi: 64,
            startTick: 100,
            durationTicks: 250,
            velocity: 1,
          },
        ],
        events: [],
      },
      120,
      0.5
    );
    expect(merged.notes[0]).toMatchObject({
      startTick: 110,
      durationTicks: 245,
    });
  });
});
