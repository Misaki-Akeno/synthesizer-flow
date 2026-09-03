import { afterEach, describe, expect, it, vi } from 'vitest';
import { MIDIInputModule } from './MIDIInputModule';
import { isMidiFrame } from '@/core/midi/utils';

interface MidiInputModuleInternals {
  midiAccess: WebMidi.MIDIAccess | null;
  midiInputs: WebMidi.MIDIInput[];
  connectToDevice: (deviceId: string) => void;
  handleMIDIMessage: (event: WebMidi.MIDIMessageEvent) => void;
  midiStateChangeListener: (event: WebMidi.MIDIConnectionEvent) => void;
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

  it('holds note-off events while the sustain pedal is down', () => {
    vi.useFakeTimers();
    const midiModule = new MIDIInputModule('midi-sustain');
    const internals = midiModule as unknown as MidiInputModuleInternals;
    const send = (data: number[]) =>
      internals.handleMIDIMessage({
        data,
      } as unknown as WebMidi.MIDIMessageEvent);

    send([0x90, 60, 100]);
    send([0xb0, 64, 127]);
    send([0x80, 60, 0]);

    const held = midiModule.outputPorts.midi.getValue();
    expect(isMidiFrame(held) && held.activeNotes).toHaveLength(1);

    send([0xb0, 64, 0]);
    const released = midiModule.outputPorts.midi.getValue();
    expect(isMidiFrame(released) && released.activeNotes).toHaveLength(0);
    expect(
      isMidiFrame(released) &&
        released.events.some((event) => event.type === 'noteOff')
    ).toBe(true);
    midiModule.dispose();
  });

  it('releases active notes when the selected device is unplugged', () => {
    vi.useFakeTimers();
    const addEventListener = vi.fn();
    const removeEventListener = vi.fn();
    const input = {
      id: 'midi-device-unplugged',
      name: 'Unplugged Controller',
      manufacturer: 'Test',
      state: 'connected',
      addEventListener,
      removeEventListener,
    } as unknown as WebMidi.MIDIInput;
    const midiAccess = {
      inputs: {
        values: () => [input].values(),
      },
      removeEventListener: vi.fn(),
    } as unknown as WebMidi.MIDIAccess;
    const midiModule = new MIDIInputModule('midi-unplugged');
    const internals = midiModule as unknown as MidiInputModuleInternals;
    internals.midiAccess = midiAccess;
    internals.midiInputs = [input];
    internals.connectToDevice(input.id);
    internals.handleMIDIMessage({
      data: [0x90, 60, 100],
    } as unknown as WebMidi.MIDIMessageEvent);

    (input as unknown as { state: string }).state = 'disconnected';
    internals.midiStateChangeListener({
      port: input,
    } as unknown as WebMidi.MIDIConnectionEvent);

    const released = midiModule.outputPorts.midi.getValue();
    expect(removeEventListener).toHaveBeenCalledWith(
      'midimessage',
      expect.any(Function)
    );
    expect(isMidiFrame(released) && released.activeNotes).toHaveLength(0);
    expect(
      isMidiFrame(released) &&
        released.events.some((event) => event.type === 'allNotesOff')
    ).toBe(true);
    expect(midiModule.getParameterValue('inputDevice')).toBe('');

    midiModule.dispose();
  });
});
