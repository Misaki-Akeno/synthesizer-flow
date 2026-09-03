import { describe, expect, it } from 'vitest';
import { isMidiFrame } from '@/core/midi/utils';
import { KeyboardInputModule } from './KeyboardInputModule';

describe('KeyboardInputModule expression', () => {
  it('keeps note-on velocity stable while pointer aftertouch changes', () => {
    const keyboard = new KeyboardInputModule('keyboard-expression');
    keyboard.handleNoteOn(60, 0.4);
    keyboard.updateVelocity(60, 0.9);

    const frame = keyboard.outputPorts.midi.getValue();
    expect(isMidiFrame(frame)).toBe(true);
    expect(isMidiFrame(frame) && frame.activeNotes[0]).toMatchObject({
      midi: 60,
      velocity: 0.4,
      pressure: 0.9,
    });
    expect(keyboard.outputPorts.activeVelocities.getValue()).toEqual([0.4]);
    expect(
      isMidiFrame(frame) &&
        frame.events.some(
          (event) => event.type === 'pressure' && event.value === 0.9
        )
    ).toBe(true);

    keyboard.dispose();
  });
});
