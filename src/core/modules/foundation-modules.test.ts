import { afterEach, describe, expect, it, vi } from 'vitest';
import { PortType } from '@/core/base/ModuleBase';
import { moduleDefinitionRegistry } from '@/core/graph/ModuleDefinitionRegistry';
import { moduleClassMap } from '@/core/modules';
import { EnvelopeModule } from './modulation/EnvelopeModule';

const EXPECTED_PORTS = {
  vca: {
    inputs: { input: PortType.AUDIO, cv: PortType.NUMBER },
    outputs: { output: PortType.AUDIO },
  },
  filter: {
    inputs: { input: PortType.AUDIO, cutoffMod: PortType.NUMBER },
    outputs: { output: PortType.AUDIO },
  },
  envelope: {
    inputs: { gate: PortType.NUMBER },
    outputs: { envelope: PortType.NUMBER },
  },
  mixer: {
    inputs: {
      input1: PortType.AUDIO,
      input2: PortType.AUDIO,
      input3: PortType.AUDIO,
      input4: PortType.AUDIO,
    },
    outputs: { output: PortType.AUDIO },
  },
  noise: { inputs: {}, outputs: { output: PortType.AUDIO } },
  masterlimiter: {
    inputs: { input: PortType.AUDIO },
    outputs: { output: PortType.AUDIO },
  },
  masterrecorder: {
    inputs: { input: PortType.AUDIO },
    outputs: { output: PortType.AUDIO },
  },
};

describe('foundation audio modules', () => {
  afterEach(() => {
    vi.useRealTimers();
    moduleDefinitionRegistry.clear();
  });

  it('registers serializable definitions with typed ports', () => {
    Object.entries(EXPECTED_PORTS).forEach(([type, ports]) => {
      expect(moduleClassMap[type]).toBeDefined();
      const definition = moduleDefinitionRegistry.resolve(type);
      expect(definition).toMatchObject({
        type,
        inputPortTypes: ports.inputs,
        outputPortTypes: ports.outputs,
      });
    });
  });

  it('generates an ADSR control signal from a gate', () => {
    vi.useFakeTimers();
    const envelope = new EnvelopeModule('env');
    envelope.updateParameter('attack', 0.01);
    envelope.updateParameter('decay', 0.01);
    envelope.updateParameter('sustain', 0.5);

    envelope.inputPorts.gate.next(1);
    vi.advanceTimersByTime(48);
    expect(envelope.outputPorts.envelope.getValue()).toBeCloseTo(0.5, 1);

    envelope.inputPorts.gate.next(0);
    vi.advanceTimersByTime(600);
    expect(envelope.outputPorts.envelope.getValue()).toBe(0);
    envelope.dispose();
  });
});
