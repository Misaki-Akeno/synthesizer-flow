import { describe, expect, it } from 'vitest';
import { ModuleBase, PortType } from '@/core/base/ModuleBase';
import { ModuleManager } from './ModuleManager';

class TestNumberSource extends ModuleBase {
  constructor(id: string) {
    super(
      'test-number-source',
      id,
      id,
      {},
      {},
      {
        out: { type: PortType.NUMBER, value: 1 },
      }
    );
  }

  protected setupInternalBindings(): void {}

  emit(value: number): void {
    this.setOutputValue('out', value);
  }
}

class TestArraySource extends ModuleBase {
  constructor(id: string) {
    super(
      'test-array-source',
      id,
      id,
      {},
      {},
      {
        out: { type: PortType.ARRAY, value: [] },
      }
    );
  }

  protected setupInternalBindings(): void {}
}

class TestAudioSource extends ModuleBase {
  constructor(id: string) {
    super(
      'test-audio-source',
      id,
      id,
      {},
      {},
      {
        out: { type: PortType.AUDIO, value: 0 },
      }
    );
  }

  protected setupInternalBindings(): void {}
}

class TestNumberTarget extends ModuleBase {
  constructor(id: string) {
    super(
      'test-number-target',
      id,
      id,
      {},
      {
        in: { type: PortType.NUMBER, value: 0 },
      },
      {}
    );
  }

  protected setupInternalBindings(): void {}
}

class TestAudioTarget extends ModuleBase {
  constructor(id: string) {
    super(
      'test-audio-target',
      id,
      id,
      {},
      {
        in: { type: PortType.AUDIO, value: 0 },
      },
      {}
    );
  }

  protected setupInternalBindings(): void {}
}

function registerModules(manager: ModuleManager, modules: ModuleBase[]): void {
  const managerWithRegistry = manager as unknown as {
    moduleInstances: Map<string, ModuleBase>;
  };

  modules.forEach((module) => {
    managerWithRegistry.moduleInstances.set(module.id, module);
  });
}

describe('ModuleManager', () => {
  it('rejects unknown module types instead of falling back to another module', () => {
    const manager = new ModuleManager();

    expect(() => {
      manager.createModuleInstance('missing-module-type', 'missing');
    }).toThrow('未知模块类型');
  });

  it('binds compatible ports and propagates values', () => {
    const manager = new ModuleManager();
    const source = new TestNumberSource('source');
    const target = new TestNumberTarget('target');
    registerModules(manager, [source, target]);

    expect(manager.bindModules('source', 'target', 'out', 'in')).toBe(true);

    source.emit(42);

    expect(target.getInputValue('in')).toBe(42);
  });

  it('keeps output connection records unique when the same edge is rebound', () => {
    const manager = new ModuleManager();
    const source = new TestNumberSource('source');
    const target = new TestNumberTarget('target');
    registerModules(manager, [source, target]);

    expect(manager.bindModules('source', 'target', 'out', 'in')).toBe(true);
    expect(manager.bindModules('source', 'target', 'out', 'in')).toBe(true);

    expect(source.getOutputConnections('out')).toHaveLength(1);

    manager.removeEdgeBinding({
      id: 'edge-1',
      source: 'source',
      target: 'target',
      sourceHandle: 'out',
      targetHandle: 'in',
    });

    expect(source.getOutputConnections('out')).toHaveLength(0);
  });

  it('removes previous output records when rebinding a single-value input to a new source', () => {
    const manager = new ModuleManager();
    const sourceA = new TestNumberSource('source-a');
    const sourceB = new TestNumberSource('source-b');
    const target = new TestNumberTarget('target');
    registerModules(manager, [sourceA, sourceB, target]);

    expect(manager.bindModules('source-a', 'target', 'out', 'in')).toBe(true);
    expect(manager.bindModules('source-b', 'target', 'out', 'in')).toBe(true);

    expect(sourceA.getOutputConnections('out')).toHaveLength(0);
    expect(sourceB.getOutputConnections('out')).toHaveLength(1);

    sourceB.emit(7);
    expect(target.getInputValue('in')).toBe(7);

    sourceA.emit(42);
    expect(target.getInputValue('in')).toBe(7);
  });

  it('keeps multiple output records for audio input ports', () => {
    const manager = new ModuleManager();
    const sourceA = new TestAudioSource('source-a');
    const sourceB = new TestAudioSource('source-b');
    const target = new TestAudioTarget('target');
    registerModules(manager, [sourceA, sourceB, target]);

    expect(manager.bindModules('source-a', 'target', 'out', 'in')).toBe(true);
    expect(manager.bindModules('source-b', 'target', 'out', 'in')).toBe(true);

    expect(sourceA.getOutputConnections('out')).toHaveLength(1);
    expect(sourceB.getOutputConnections('out')).toHaveLength(1);
  });

  it('does not create visual edges when binding fails', () => {
    const manager = new ModuleManager();
    const source = new TestNumberSource('source');
    const target = new TestNumberTarget('target');
    registerModules(manager, [source, target]);

    const edge = manager.createEdgeWithBinding(
      'source',
      'target',
      'missing-output',
      'in'
    );

    expect(edge).toBeNull();
    expect(target.getInputValue('in')).toBe(0);
  });

  it('rejects connections between mismatched port types', () => {
    const manager = new ModuleManager();
    const source = new TestArraySource('source');
    const target = new TestNumberTarget('target');
    registerModules(manager, [source, target]);

    expect(manager.bindModules('source', 'target', 'out', 'in')).toBe(false);
    expect(target.getInputValue('in')).toBe(0);
  });
});
