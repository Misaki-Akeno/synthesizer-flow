import { afterEach, describe, expect, it, vi } from 'vitest';
import { MIDIInputModule } from './MIDIInputModule';

interface MidiInputModuleInternals {
  midiInputs: WebMidi.MIDIInput[];
  connectToDevice: (deviceId: string) => void;
}

describe('MIDIInputModule lifecycle', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('removes the exact MIDI message listener registered on the device', () => {
    vi.useFakeTimers();
    const addEventListener = vi.fn();
    const removeEventListener = vi.fn();
    const input = {
      id: 'midi-device-1',
      name: 'Test Controller',
      manufacturer: 'Test',
      addEventListener,
      removeEventListener,
    } as unknown as WebMidi.MIDIInput;
    const midiModule = new MIDIInputModule('midi-1');
    const internals = midiModule as unknown as MidiInputModuleInternals;

    internals.midiInputs = [input];
    internals.connectToDevice(input.id);

    const registeredListener = addEventListener.mock.calls[0]?.[1];
    expect(registeredListener).toEqual(expect.any(Function));

    midiModule.dispose();

    expect(removeEventListener).toHaveBeenCalledWith(
      'midimessage',
      registeredListener
    );
  });
});
