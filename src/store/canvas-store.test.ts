import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { moduleManager } from '@/core/services/ModuleManager';
import { moduleInitManager } from '@/core/services/ModuleInitManager';
import { parseMidiClipJson } from '@/core/midi/utils';
import { useFlowStore } from './canvas-store';

function resetCanvasStore(): void {
  moduleManager.disposeAllModules();
  moduleInitManager.reset();
  useFlowStore.setState({
    nodes: [],
    edges: [],
    currentProjectId: '',
    canUndo: false,
    canRedo: false,
    history: {
      past: [],
      future: [],
    },
  });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('canvas store import', () => {
  beforeEach(() => {
    resetCanvasStore();
  });

  it('rejects unknown module types without clearing the current module graph', () => {
    useFlowStore
      .getState()
      .addNode('numberinput', 'Existing', { x: 0, y: 0 }, 'existing');

    const invalidCanvas = JSON.stringify({
      version: '1.0',
      timestamp: Date.now(),
      nodes: [
        {
          id: 'unknown-node',
          position: { x: 0, y: 0 },
          data: {
            type: 'missing-module-type',
            label: 'Unknown',
          },
        },
      ],
      edges: [],
    });

    const imported = useFlowStore
      .getState()
      .importCanvasFromJson(invalidCanvas);

    expect(imported).toBe(false);
    expect(useFlowStore.getState().nodes.map((node) => node.id)).toEqual([
      'existing',
    ]);
    expect(moduleManager.getModule('existing')).toBeDefined();
  });

  it('filters imported edges that cannot be bound to real ports', () => {
    const canvas = JSON.stringify({
      version: '1.0',
      timestamp: Date.now(),
      nodes: [
        {
          id: 'number',
          position: { x: 0, y: 0 },
          data: {
            type: 'numberinput',
            label: 'Number',
            parameters: {
              value: 7,
            },
          },
        },
        {
          id: 'calculator',
          position: { x: 200, y: 0 },
          data: {
            type: 'calculator',
            label: 'Calculator',
          },
        },
      ],
      edges: [
        {
          source: 'number',
          target: 'calculator',
          sourceHandle: 'output',
          targetHandle: 'a',
        },
        {
          source: 'number',
          target: 'calculator',
          sourceHandle: 'missing-output',
          targetHandle: 'a',
        },
        {
          source: 'number',
          target: 'missing-target',
          sourceHandle: 'output',
          targetHandle: 'a',
        },
      ],
    });

    const imported = useFlowStore
      .getState()
      .importCanvasFromJson(canvas, 'project-123');

    expect(imported).toBe(true);
    expect(useFlowStore.getState().currentProjectId).toBe('project-123');
    expect(useFlowStore.getState().edges).toEqual([
      expect.objectContaining({
        source: 'number',
        target: 'calculator',
        sourceHandle: 'output',
        targetHandle: 'a',
      }),
    ]);
    expect(moduleManager.getModule('calculator')?.getInputValue('a')).toBe(7);
  });

  it('keeps only one imported edge for each single-value input port', () => {
    const canvas = JSON.stringify({
      version: '1.0',
      timestamp: Date.now(),
      nodes: [
        {
          id: 'number-a',
          position: { x: 0, y: 0 },
          data: {
            type: 'numberinput',
            label: 'Number A',
            parameters: {
              value: 7,
            },
          },
        },
        {
          id: 'number-b',
          position: { x: 0, y: 100 },
          data: {
            type: 'numberinput',
            label: 'Number B',
            parameters: {
              value: 11,
            },
          },
        },
        {
          id: 'calculator',
          position: { x: 200, y: 0 },
          data: {
            type: 'calculator',
            label: 'Calculator',
          },
        },
      ],
      edges: [
        {
          source: 'number-a',
          target: 'calculator',
          sourceHandle: 'output',
          targetHandle: 'a',
        },
        {
          source: 'number-b',
          target: 'calculator',
          sourceHandle: 'output',
          targetHandle: 'a',
        },
      ],
    });

    const imported = useFlowStore.getState().importCanvasFromJson(canvas);

    expect(imported).toBe(true);
    expect(useFlowStore.getState().edges).toEqual([
      expect.objectContaining({
        source: 'number-a',
        target: 'calculator',
        sourceHandle: 'output',
        targetHandle: 'a',
      }),
    ]);
    expect(moduleManager.getModule('calculator')?.getInputValue('a')).toBe(7);
    expect(
      moduleManager.getModule('number-b')?.getOutputConnections('output')
    ).toHaveLength(0);
  });

  it('migrates legacy sequencer sequence data into MidiClip parameters', () => {
    const canvas = JSON.stringify({
      version: '1.0',
      timestamp: Date.now(),
      nodes: [
        {
          id: 'sequencer',
          position: { x: 0, y: 0 },
          data: {
            type: 'sequencer',
            label: 'Legacy Sequencer',
            parameters: {
              sequence: JSON.stringify([
                { note: 'C4', velocity: 0.8, duration: '4n' },
                { note: 'E4', velocity: 0.6, duration: '8n' },
              ]),
            },
          },
        },
      ],
      edges: [],
    });

    const imported = useFlowStore.getState().importCanvasFromJson(canvas);

    expect(imported).toBe(true);
    const sequencer = moduleManager.getModule('sequencer');
    const clipValue = sequencer?.getParameterValue('clip');
    expect(typeof clipValue).toBe('string');
    expect(parseMidiClipJson(clipValue as string).notes).toMatchObject([
      { midi: 60, startTick: 0, durationTicks: 480, velocity: 0.8 },
      { midi: 64, startTick: 480, durationTicks: 240, velocity: 0.6 },
    ]);
    const exported = JSON.parse(useFlowStore.getState().exportCanvasToJson());
    expect(exported.nodes[0].data.parameters).not.toHaveProperty('sequence');
    expect(exported.nodes[0].data.parameters).toHaveProperty('clip');
  });
});

describe('canvas store connections', () => {
  beforeEach(() => {
    resetCanvasStore();
  });

  it('replaces the previous visual and module binding for single-value input ports', () => {
    useFlowStore
      .getState()
      .addNode('numberinput', 'Number A', { x: 0, y: 0 }, 'number-a');
    useFlowStore
      .getState()
      .addNode('numberinput', 'Number B', { x: 0, y: 100 }, 'number-b');
    useFlowStore
      .getState()
      .addNode('calculator', 'Calculator', { x: 200, y: 0 }, 'calculator');

    moduleManager.getModule('number-a')?.updateParameter('value', 7);
    moduleManager.getModule('number-b')?.updateParameter('value', 11);

    useFlowStore.getState().onConnect({
      source: 'number-a',
      target: 'calculator',
      sourceHandle: 'output',
      targetHandle: 'a',
    });
    useFlowStore.getState().onConnect({
      source: 'number-b',
      target: 'calculator',
      sourceHandle: 'output',
      targetHandle: 'a',
    });

    expect(useFlowStore.getState().edges).toEqual([
      expect.objectContaining({
        source: 'number-b',
        target: 'calculator',
        sourceHandle: 'output',
        targetHandle: 'a',
      }),
    ]);
    expect(moduleManager.getModule('calculator')?.getInputValue('a')).toBe(11);
    expect(
      moduleManager.getModule('number-a')?.getOutputConnections('output')
    ).toHaveLength(0);
    expect(
      moduleManager.getModule('number-b')?.getOutputConnections('output')
    ).toHaveLength(1);
  });

  it('restores previous single-value input bindings when replacement binding fails', () => {
    useFlowStore
      .getState()
      .addNode('numberinput', 'Number A', { x: 0, y: 0 }, 'number-a');
    useFlowStore
      .getState()
      .addNode('numberinput', 'Number B', { x: 0, y: 100 }, 'number-b');
    useFlowStore
      .getState()
      .addNode('calculator', 'Calculator', { x: 200, y: 0 }, 'calculator');

    useFlowStore.getState().onConnect({
      source: 'number-a',
      target: 'calculator',
      sourceHandle: 'output',
      targetHandle: 'a',
    });

    const bindSpy = vi.spyOn(moduleManager, 'bindModules');
    bindSpy.mockImplementationOnce(() => false);

    useFlowStore.getState().onConnect({
      source: 'number-b',
      target: 'calculator',
      sourceHandle: 'output',
      targetHandle: 'a',
    });

    expect(useFlowStore.getState().edges).toEqual([
      expect.objectContaining({
        source: 'number-a',
        target: 'calculator',
        sourceHandle: 'output',
        targetHandle: 'a',
      }),
    ]);
    expect(
      moduleManager.getModule('number-a')?.getOutputConnections('output')
    ).toHaveLength(1);
    expect(
      moduleManager.getModule('number-b')?.getOutputConnections('output')
    ).toHaveLength(0);
  });
});

describe('canvas store history', () => {
  beforeEach(() => {
    resetCanvasStore();
  });

  it('undoes and redoes node creation', () => {
    useFlowStore
      .getState()
      .addNode('numberinput', 'Number', { x: 0, y: 0 }, 'number');

    expect(useFlowStore.getState().nodes.map((node) => node.id)).toEqual([
      'number',
    ]);
    expect(useFlowStore.getState().canUndo).toBe(true);

    useFlowStore.getState().undo();

    expect(useFlowStore.getState().nodes).toEqual([]);
    expect(moduleManager.getModule('number')).toBeUndefined();
    expect(useFlowStore.getState().canRedo).toBe(true);

    useFlowStore.getState().redo();

    expect(useFlowStore.getState().nodes.map((node) => node.id)).toEqual([
      'number',
    ]);
    expect(moduleManager.getModule('number')).toBeDefined();
  });

  it('restores a deleted node and its connection bindings', () => {
    useFlowStore
      .getState()
      .addNode('numberinput', 'Number', { x: 0, y: 0 }, 'number');
    useFlowStore
      .getState()
      .addNode('calculator', 'Calculator', { x: 200, y: 0 }, 'calculator');

    moduleManager.getModule('number')?.updateParameter('value', 7);
    useFlowStore.getState().onConnect({
      source: 'number',
      target: 'calculator',
      sourceHandle: 'output',
      targetHandle: 'a',
    });

    useFlowStore.getState().deleteNode('number');

    expect(useFlowStore.getState().nodes.map((node) => node.id)).toEqual([
      'calculator',
    ]);
    expect(moduleManager.getModule('number')).toBeUndefined();

    useFlowStore.getState().undo();

    expect(
      useFlowStore
        .getState()
        .nodes.map((node) => node.id)
        .sort()
    ).toEqual(['calculator', 'number']);
    expect(useFlowStore.getState().edges).toHaveLength(1);
    expect(moduleManager.getModule('calculator')?.getInputValue('a')).toBe(7);
    expect(
      moduleManager.getModule('number')?.getOutputConnections('output')
    ).toHaveLength(1);
  });

  it('undoes and redoes module parameter updates', () => {
    useFlowStore
      .getState()
      .addNode('numberinput', 'Number', { x: 0, y: 0 }, 'number');

    useFlowStore.getState().updateModuleParameter('number', 'value', 42);

    expect(moduleManager.getModule('number')?.getParameterValue('value')).toBe(
      42
    );

    useFlowStore.getState().undo();

    expect(moduleManager.getModule('number')?.getParameterValue('value')).toBe(
      120
    );

    useFlowStore.getState().redo();

    expect(moduleManager.getModule('number')?.getParameterValue('value')).toBe(
      42
    );
  });

  it('coalesces continuous parameter edits into one undo step', () => {
    useFlowStore
      .getState()
      .addNode('numberinput', 'Number', { x: 0, y: 0 }, 'number');

    useFlowStore.getState().beginHistoryTransaction();
    useFlowStore.getState().updateModuleParameter('number', 'value', 130);
    useFlowStore.getState().updateModuleParameter('number', 'value', 140);
    useFlowStore.getState().updateModuleParameter('number', 'value', 150);
    useFlowStore.getState().commitHistoryTransaction();

    expect(moduleManager.getModule('number')?.getParameterValue('value')).toBe(
      150
    );

    useFlowStore.getState().undo();

    expect(moduleManager.getModule('number')?.getParameterValue('value')).toBe(
      120
    );
    expect(useFlowStore.getState().canUndo).toBe(true);
  });

  it('undoes replacement connections on single-value input ports', () => {
    useFlowStore
      .getState()
      .addNode('numberinput', 'Number A', { x: 0, y: 0 }, 'number-a');
    useFlowStore
      .getState()
      .addNode('numberinput', 'Number B', { x: 0, y: 100 }, 'number-b');
    useFlowStore
      .getState()
      .addNode('calculator', 'Calculator', { x: 200, y: 0 }, 'calculator');

    moduleManager.getModule('number-a')?.updateParameter('value', 7);
    moduleManager.getModule('number-b')?.updateParameter('value', 11);

    useFlowStore.getState().onConnect({
      source: 'number-a',
      target: 'calculator',
      sourceHandle: 'output',
      targetHandle: 'a',
    });
    useFlowStore.getState().onConnect({
      source: 'number-b',
      target: 'calculator',
      sourceHandle: 'output',
      targetHandle: 'a',
    });

    expect(moduleManager.getModule('calculator')?.getInputValue('a')).toBe(11);

    useFlowStore.getState().undo();

    expect(useFlowStore.getState().edges).toEqual([
      expect.objectContaining({
        source: 'number-a',
        target: 'calculator',
        sourceHandle: 'output',
        targetHandle: 'a',
      }),
    ]);
    expect(moduleManager.getModule('calculator')?.getInputValue('a')).toBe(7);
    expect(
      moduleManager.getModule('number-a')?.getOutputConnections('output')
    ).toHaveLength(1);
    expect(
      moduleManager.getModule('number-b')?.getOutputConnections('output')
    ).toHaveLength(0);
  });

  it('clears history when importing a project', () => {
    useFlowStore
      .getState()
      .addNode('numberinput', 'Number', { x: 0, y: 0 }, 'number');

    const canvas = JSON.stringify({
      version: '1.0',
      timestamp: Date.now(),
      nodes: [],
      edges: [],
    });

    const imported = useFlowStore.getState().importCanvasFromJson(canvas);

    expect(imported).toBe(true);
    expect(useFlowStore.getState().canUndo).toBe(false);
    expect(useFlowStore.getState().canRedo).toBe(false);
  });
});
