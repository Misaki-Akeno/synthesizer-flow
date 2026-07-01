import { describe, expect, it } from 'vitest';
import {
  createMidiFrame,
  durationToTicks,
  legacyArraysToMidiFrame,
  legacyStepsToMidiClip,
  midiFrameToLegacyArrays,
  noteNameToMidi,
  parseMidiClipJson,
} from './utils';

describe('MIDI utilities', () => {
  it('converts note names and durations to MIDI clip ticks', () => {
    expect(noteNameToMidi('C4')).toBe(60);
    expect(noteNameToMidi('D#4')).toBe(63);
    expect(durationToTicks('4n')).toBe(480);
    expect(durationToTicks('8n')).toBe(240);
  });

  it('migrates legacy sequence steps into MidiClip notes', () => {
    const clip = legacyStepsToMidiClip([
      { note: 'C4', velocity: 0.8, duration: '4n' },
      { note: 'E4', velocity: 0.6, duration: '8n' },
    ]);

    expect(clip.version).toBe(2);
    expect(clip.notes).toMatchObject([
      { midi: 60, startTick: 0, durationTicks: 480, velocity: 0.8 },
      { midi: 64, startTick: 480, durationTicks: 240, velocity: 0.6 },
    ]);
  });

  it('parses legacy JSON arrays through the clip parser', () => {
    const clip = parseMidiClipJson(
      JSON.stringify([{ note: 'G4', velocity: 1, duration: '2n' }])
    );

    expect(clip.notes[0]).toMatchObject({
      midi: 67,
      durationTicks: 960,
      velocity: 1,
    });
  });

  it('bridges MidiFrame and legacy note arrays', () => {
    const frame = createMidiFrame([
      { id: 'a', midi: 60, velocity: 0.5, pitchBend: 0, pressure: 0, timbre: 0 },
      { id: 'b', midi: 64, velocity: 0.9, pitchBend: 0, pressure: 0, timbre: 0 },
    ]);

    expect(midiFrameToLegacyArrays(frame)).toEqual({
      notes: [60, 64],
      velocities: [0.5, 0.9],
    });

    expect(legacyArraysToMidiFrame([60], [0.7]).activeNotes[0]).toMatchObject({
      midi: 60,
      velocity: 0.7,
    });
  });
});
