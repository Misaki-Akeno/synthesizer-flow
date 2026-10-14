import { beforeAll, describe, expect, it } from 'vitest';
import { PortType } from '@/core/base/ModuleBase';
import type { FlowNode } from '@/core/graph/types';
import { moduleDefinitionRegistry } from '@/core/graph/ModuleDefinitionRegistry';
import { isValidModuleConnection } from './connectionValidation';

function createNode(id: string, type: string): FlowNode {
  return {
    id,
    type: 'default',
    position: { x: 0, y: 0 },
    data: { type, label: id, parameters: {}, enabled: true },
  };
}

describe('isValidModuleConnection', () => {
  beforeAll(() => {
    moduleDefinitionRegistry.registerSnapshot({
      id: 'source',
      type: 'test-source',
      name: 'Source',
      enabled: true,
      canEnable: false,
      parameters: {},
      parameterMeta: {},
      inputPortTypes: {},
      outputPortTypes: {
        numberOut: PortType.NUMBER,
        audioOut: PortType.AUDIO,
      },
      inputValues: {},
      outputValues: {},
    });
    moduleDefinitionRegistry.registerSnapshot({
      id: 'target',
      type: 'test-target',
      name: 'Target',
      enabled: true,
      canEnable: false,
      parameters: {},
      parameterMeta: {},
      inputPortTypes: {
        numberIn: PortType.NUMBER,
        audioIn: PortType.AUDIO,
      },
      outputPortTypes: {},
      inputValues: {},
      outputValues: {},
    });
  });

  const nodes = [
    createNode('source', 'test-source'),
    createNode('target', 'test-target'),
  ];

  it('allows existing ports with matching types', () => {
    expect(
      isValidModuleConnection(nodes, {
        source: 'source',
        target: 'target',
        sourceHandle: 'numberOut',
        targetHandle: 'numberIn',
      })
    ).toBe(true);
  });

  it('rejects missing ports instead of defaulting them to number', () => {
    expect(
      isValidModuleConnection(nodes, {
        source: 'source',
        target: 'target',
        sourceHandle: 'missingOut',
        targetHandle: 'numberIn',
      })
    ).toBe(false);
  });

  it('rejects existing ports with mismatched types', () => {
    expect(
      isValidModuleConnection(nodes, {
        source: 'source',
        target: 'target',
        sourceHandle: 'audioOut',
        targetHandle: 'numberIn',
      })
    ).toBe(false);
  });
});
