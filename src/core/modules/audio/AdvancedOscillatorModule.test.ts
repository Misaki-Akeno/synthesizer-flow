import { describe, expect, it, vi } from 'vitest';
import { AdvancedOscillatorModule } from './AdvancedOscillatorModule';

describe('AdvancedOscillatorModule scheduled MIDI handling', () => {
  it('passes the Tone.Part audio timestamp to envelope attack and release', () => {
    const triggerAttack = vi.fn();
    const triggerRelease = vi.fn();
    const oscillator = Object.create(AdvancedOscillatorModule.prototype) as {
      Tone: { now: () => number };
      attackTime: number;
      decayTime: number;
      sustainLevel: number;
      releaseTime: number;
      getAttackTime: (velocity: number) => number;
      triggerEnvelope: (voice: unknown, velocity: number, scheduledTime: number) => void;
      releaseVoice: (noteId: string, scheduledTime: number) => void;
      voices: Map<string, unknown>;
    };
    oscillator.Tone = { now: () => 1 };
    oscillator.attackTime = 0.01;
    oscillator.decayTime = 0.1;
    oscillator.sustainLevel = 0.7;
    oscillator.releaseTime = 0.2;
    oscillator.getAttackTime = () => 0.01;
    const voice = {
      noteId: 'note',
      active: true,
      velocitySignal: { value: 0 },
      velocityGain: { gain: { value: 0 } },
      envelope: {
        triggerAttack,
        triggerRelease,
      },
    };
    oscillator.voices = new Map([['note', voice]]);

    oscillator.triggerEnvelope(voice, 0.8, 7.25);
    oscillator.releaseVoice('note', 7.75);

    expect(triggerAttack).toHaveBeenCalledWith(7.25);
    expect(triggerRelease).toHaveBeenCalledWith(7.75);
  });
});
