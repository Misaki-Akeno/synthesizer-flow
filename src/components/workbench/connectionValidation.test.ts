import { describe, expect, it } from 'vitest';
import { ModuleBase, PortType } from '@/core/base/ModuleBase';
import { FlowNode } from '@/core/services/ModuleManager';
import { isValidModuleConnection } from './connectionValidation';

class TestSource extends ModuleBase {
  constructor(id: string) {
    super(
      'test-source',
      id,
      id,
      {},
      {},
      {
        numberOut: { type: PortType.NUMBER, value: 1 },
        audioOut: { type: PortType.AUDIO, value: null },
      }
    );
  }

  protected setupInternalBindings(): void {}
}

class TestTarget extends ModuleBase {
  constructor(id: string) {
    super(
      'test-target',
      id,
      id,
      {},
      {
        numberIn: { type: PortType.NUMBER, value: 0 },
        audioIn: { type: PortType.AUDIO, value: null },
      },
      {}
    );
  }

  protected setupInternalBindings(): void {}
}

function createNode(id: string, module: ModuleBase): FlowNode {
  return {
    id,
    type: 'default',
    position: { x: 0, y: 0 },
    data: {
      module,
      label: id,
      type: module.moduleType,
    },
  };
}

describe('isValidModuleConnection', () => {
  const nodes = [
    createNode('source', new TestSource('source')),
    createNode('target', new TestTarget('target')),
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
