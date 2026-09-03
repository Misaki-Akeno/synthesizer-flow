import { afterEach, describe, expect, it } from 'vitest';
import { PortType } from '@/core/base/ModuleBase';
import { moduleDefinitionRegistry } from '@/core/graph/ModuleDefinitionRegistry';
import { moduleClassMap } from '@/core/modules';

const EXPECTED_PORTS = {
  vca: {
    inputs: { input: PortType.AUDIO, cv: PortType.NUMBER },
    outputs: { output: PortType.AUDIO },
  },
  filter: {
    inputs: { input: PortType.AUDIO, cutoffMod: PortType.NUMBER },
    outputs: { output: PortType.AUDIO },
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

});
