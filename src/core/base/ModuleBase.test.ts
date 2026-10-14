import { describe, expect, it } from 'vitest';
import { ModuleBase, PortType } from './ModuleBase';
import { createMidiFrame, isMidiFrame } from '@/core/midi/utils';

class MidiSourceModule extends ModuleBase {
  constructor() {
    super(
      'midi-source',
      'midi-source',
      'MIDI Source',
      {},
      {},
      {
        midi: {
          type: PortType.MIDI,
          value: createMidiFrame(),
        },
      }
    );
  }
}

class MidiTargetModule extends ModuleBase {
  constructor() {
    super(
      'midi-target',
      'midi-target',
      'MIDI Target',
      {},
      {
        midi: {
          type: PortType.MIDI,
          value: createMidiFrame(),
        },
      }
    );
  }
}

class NumberSourceModule extends ModuleBase {
  constructor() {
    super(
      'number-source',
      'number-source',
      'Number Source',
      {},
      {},
      { output: { type: PortType.NUMBER, value: 0 } }
    );
  }
}

class NumberTargetModule extends ModuleBase {
  constructor() {
    super(
      'number-target',
      'number-target',
      'Number Target',
      {},
      { modulation: { type: PortType.NUMBER, value: 0.5 } }
    );
  }
}

describe('ModuleBase MIDI connections', () => {
  it('publishes all-notes-off when a MIDI connection is removed', () => {
    const source = new MidiSourceModule();
    const target = new MidiTargetModule();
    source.connectOutput('midi', target, 'midi');
    source.outputPorts.midi.next(
      createMidiFrame([
        {
          id: 'held-note',
          midi: 60,
          velocity: 0.8,
          pitchBend: 0,
          pressure: 0,
          timbre: 0,
        },
      ])
    );

    source.disconnectOutput('midi', target, 'midi');

    const released = target.inputPorts.midi.getValue();
    expect(isMidiFrame(released)).toBe(true);
    expect(isMidiFrame(released) && released.activeNotes).toHaveLength(0);
    expect(
      isMidiFrame(released) &&
        released.events.some((event) => event.type === 'allNotesOff')
    ).toBe(true);
  });

  it('restores the declared input default when a number connection is removed', () => {
    const source = new NumberSourceModule();
    const target = new NumberTargetModule();
    source.connectOutput('output', target, 'modulation');
    source.outputPorts.output.next(1);
    expect(target.inputPorts.modulation.getValue()).toBe(1);

    source.disconnectOutput('output', target, 'modulation');

    expect(target.inputPorts.modulation.getValue()).toBe(0.5);
  });
});
