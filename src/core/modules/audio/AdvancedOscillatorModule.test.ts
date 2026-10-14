import { describe, expect, it, vi } from 'vitest';
import { AdvancedOscillatorModule } from './AdvancedOscillatorModule';

describe('AdvancedOscillatorModule scheduled MIDI handling', () => {
  it('cancels future attacks for all voices, including voices with a scheduled release', () => {
    const cancel = vi.fn();
    const triggerRelease = vi.fn();
    const oscillator = Object.assign(Object.create(AdvancedOscillatorModule.prototype), {
      Tone: { now: () => 0.1, immediate: () => 0 },
      mixer: {},
      isEnabled: () => true,
      voices: new Map([['future-note', {
        active: false,
        envelope: { cancel, triggerRelease },
      }]]),
    });
    oscillator.handleMidiFrame({ activeNotes: [], events: [{ type: 'allNotesOff' }] });
    expect(cancel).toHaveBeenCalledWith(0);
    expect(triggerRelease).toHaveBeenCalledWith(0);
  });
  it('releases a sounding voice without cancelling its in-progress attack ramp', () => {
    const cancel = vi.fn();
    const triggerRelease = vi.fn();
    const oscillator = Object.assign(Object.create(AdvancedOscillatorModule.prototype), {
      Tone: { now: () => 0.1, immediate: () => 0 },
      voices: new Map([['note', {
        active: true,
        envelope: { cancel, triggerRelease, getValueAtTime: () => 0.3 },
      }]]),
    });
    oscillator.releaseVoice('note', 1.2);
    expect(cancel).not.toHaveBeenCalled();
    expect(triggerRelease).toHaveBeenCalledWith(1.2);
  });
  it.each([0, 1.5])('schedules attack, sustain fade (%s), and note-off on the audio clock', (sustainFade) => {
    const triggerAttack = vi.fn();
    const releaseDurations: number[] = [];
    const triggerRelease = vi.fn(function (this: { release: number }, _time: number) {
      releaseDurations.push(this.release);
    });
    const oscillator = Object.create(AdvancedOscillatorModule.prototype) as {
      Tone: { now: () => number };
      attackTime: number;
      decayTime: number;
      sustainLevel: number;
      sustainFade: number;
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
    oscillator.sustainFade = sustainFade;
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
        release: 0,
        releaseCurve: 'exponential',
      },
    };
    oscillator.voices = new Map([['note', voice]]);

    oscillator.triggerEnvelope(voice, 0.8, 7.25);
    // 提前释放仍应使用正常 release，不能沿用延音渐弱的时长。
    oscillator.releaseVoice('note', 7.30);

    expect(triggerAttack).toHaveBeenCalledWith(7.25);
    if (sustainFade > 0) {
      expect(triggerRelease.mock.calls[0][0]).toBeCloseTo(7.36);
      expect(releaseDurations).toEqual([sustainFade, 0.2]);
    } else {
      expect(releaseDurations).toEqual([0.2]);
    }
    expect(triggerRelease).toHaveBeenLastCalledWith(7.30);
    expect(voice.envelope.releaseCurve).toBe('exponential');
  });
});
