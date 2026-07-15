/* eslint-disable @typescript-eslint/no-explicit-any */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ToolExecutor } from './executor';
import { createAgentToolRegistry, createTools } from './definitions';
import type { GraphStateSnapshot } from '../core/types';

// Mock dependencies
vi.mock('@/lib/logger', () => ({
  createModuleLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }),
}));

vi.mock('@/lib/rag/vectorStore', () => ({
  searchDocuments: vi.fn(),
}));

// Mock types for testing
const mockInitialState: GraphStateSnapshot = {
  nodes: [
    {
      id: 'node-1',
      type: 'numberinput',
      data: {
        type: 'numberinput',
        label: 'Number 1',
        parameters: { value: 440 },
        ports: {
          inputs: { input: 'number' },
          outputs: { output: 'number' },
        },
      },
      position: { x: 0, y: 0 },
    },
    {
      id: 'node-2',
      type: 'calculator',
      data: {
        type: 'calculator',
        label: 'Calculator 1',
        parameters: { operation: 'add' },
        ports: {
          inputs: { input: 'number' },
          outputs: { output: 'number' },
        },
      },
      position: { x: 200, y: 0 },
    },
  ],
  edges: [
    {
      id: 'edge-1',
      source: 'node-1',
      target: 'node-2',
      sourceHandle: 'output',
      targetHandle: 'input',
    },
  ],
};

describe('ToolExecutor', () => {
  let executor: ToolExecutor;

  beforeEach(() => {
    executor = new ToolExecutor(mockInitialState);
  });

  it('should initialize with correct state', () => {
    const operations = executor.getOperations();
    expect(operations).toEqual([]);

    const canvas = executor.getCanvas();
    expect(canvas.data.modules).toHaveLength(2);
    expect(canvas.data.modules[0].id).toBe('node-1');
  });

  describe('getCanvas', () => {
    it('should return all modules and connections', () => {
      const result = executor.getCanvas();
      expect(result.success).toBe(true);
      expect(result.data.totalModules).toBe(2);
      expect(result.data.modules).toHaveLength(2);
      expect(result.data.totalConnections).toBe(1);
      expect(result.data.connections).toHaveLength(1);
    });
  });

  describe('getModuleDetails', () => {
    it('should return details for existing module', () => {
      const result = executor.getModuleDetails('node-1');
      expect(result.success).toBe(true);
      expect(result.data?.module.id).toBe('node-1');
      expect(result.data?.connections.outgoing).toHaveLength(1);
    });

    it('should return error for non-existent module', () => {
      const result = executor.getModuleDetails('non-existent');
      expect(result.success).toBe(false);
      expect(result.error).toContain('未找到模块');
    });

    it('should prefer runtime module parameter values when available', () => {
      const runtimeExecutor = new ToolExecutor({
        nodes: [
          {
            id: 'runtime-node',
            type: 'numberinput',
            data: {
              type: 'numberinput',
              label: 'Runtime Number',
              parameters: { value: 440 },
              module: {
                parameters: {
                  value: { getValue: () => 880 },
                },
                inputPortTypes: {},
                outputPortTypes: { output: 'number' },
              },
            },
            position: { x: 0, y: 0 },
          },
        ],
        edges: [],
      });

      const result = runtimeExecutor.getModuleDetails('runtime-node');

      expect(result.success).toBe(true);
      expect(result.data?.module.parameters).toEqual({ value: 880 });
      expect(result.data?.module.ports.outputs).toEqual({ output: 'number' });
    });
  });

  describe('addModule', () => {
    it('should add a module and record operation', () => {
      const result = executor.addModule('numberinput', 'Number 2', {
        x: 100,
        y: 100,
      });
      expect(result.success).toBe(true);

      const operations = executor.getOperations();
      expect(operations).toHaveLength(1);
      expect(operations[0].type).toBe('ADD_MODULE');
      expect((operations[0] as any).data.type).toBe('numberinput');

      const canvas = executor.getCanvas();
      expect(canvas.data.modules).toHaveLength(3);
    });

    it('should reject unknown module types', () => {
      const result = executor.addModule('filter', 'Filter 1', {
        x: 100,
        y: 100,
      });
      expect(result.success).toBe(false);
      expect(executor.getOperations()).toHaveLength(0);
    });
  });

  describe('deleteModule', () => {
    it('should delete a module and associated edges', () => {
      const result = executor.deleteModule('node-1');
      expect(result.success).toBe(true);

      const operations = executor.getOperations();
      expect(operations).toHaveLength(1);
      expect(operations[0].type).toBe('DELETE_MODULE');

      const canvas = executor.getCanvas();
      expect(canvas.data.modules).toHaveLength(1);
      expect(canvas.data.modules[0].id).toBe('node-2'); // Only node-2 remains
      expect(canvas.data.connections).toHaveLength(0); // Edge should be removed
    });
  });

  describe('updateModuleParameter', () => {
    it('should update parameter and record operation', () => {
      const result = executor.updateModuleParameter('node-1', 'value', 880);
      expect(result.success).toBe(true);

      const operations = executor.getOperations();
      expect(operations).toHaveLength(1);
      expect(operations[0].type).toBe('UPDATE_MODULE_PARAM');
      expect((operations[0] as any).data.value).toBe(880);

      const details = executor.getModuleDetails('node-1');
      expect(details.data?.module.parameters['value']).toBe(880);
    });

    it('should reject unknown parameters without recording operations', () => {
      const result = executor.updateModuleParameter('node-1', 'freq', 880);

      expect(result.success).toBe(false);
      expect(result.error).toContain('参数不存在');
      expect(executor.getOperations()).toHaveLength(0);
    });

    it('should reject parameter type mismatches without recording operations', () => {
      const result = executor.updateModuleParameter('node-1', 'value', '880');

      expect(result.success).toBe(false);
      expect(result.error).toContain('参数类型不匹配');
      expect(executor.getOperations()).toHaveLength(0);
    });
  });

  describe('connectModules', () => {
    it('should connect modules and record operation', () => {
      // Create a disconnect first to have a clean slate for connection test or just connect new ones
      // Let's connect node-1 to something else if valid, or just add a new connection between existing nodes (even if redundant for graph logic, valid for executor)
      const result = executor.connectModules('node-2', 'node-1'); // Cycle? Doesn't matter for executor logic
      expect(result.success).toBe(true);

      const operations = executor.getOperations();
      expect(operations).toHaveLength(1);
      expect(operations[0].type).toBe('CONNECT_MODULES');

      const canvas = executor.getCanvas();
      expect(canvas.data.connections).toHaveLength(2);
    });

    it('should auto-resolve ports when connecting', () => {
      // Setup nodes with ports for this test
      // Mock nodes in executor are shallow copies, modify internal nodes directly for this specific test setup
      // or rely on mockInitialState if we can update it globally.
      // Let's update the mockInitialState at the top of the file instead for simplicity,
      // but here we just need to assume it works or modify executor.nodes

      // Manually inject ports into node-1 and node-2 for this test
      const node1 = (executor as any).nodes.find((n: any) => n.id === 'node-1');
      const node2 = (executor as any).nodes.find((n: any) => n.id === 'node-2');

      if (node1) {
        node1.data.ports = {
          outputs: { 'audio out': 'audio' },
          inputs: {},
        };
      }
      if (node2) {
        node2.data.ports = {
          inputs: { 'audio in': 'audio' },
          outputs: {},
        };
      }

      // Connect without handles
      const result = executor.connectModules('node-1', 'node-2');

      expect(result.success).toBe(true);
      if (!result.success) {
        throw new Error(result.error);
      }
      expect(result.data?.message).toContain('audio out'); // Should mention resolved ports
      expect(result.data?.message).toContain('audio in');

      const op = executor
        .getOperations()
        .find(
          (o) =>
            o.type === 'CONNECT_MODULES' &&
            o.data.source === 'node-1' &&
            o.data.target === 'node-2' &&
            o.data.sourceHandle === 'audio out'
        );
      expect(op).toBeDefined();
      expect((op as any).data.sourceHandle).toBe('audio out');
      expect((op as any).data.targetHandle).toBe('audio in');
    });

    it('should reject mismatched port types', () => {
      const node2 = (executor as any).nodes.find((n: any) => n.id === 'node-2');
      if (node2) {
        node2.data.ports = {
          inputs: { input: 'audio' },
          outputs: { output: 'number' },
        };
      }

      const result = executor.connectModules(
        'node-1',
        'node-2',
        'output',
        'input'
      );
      expect(result.success).toBe(false);
      expect(executor.getOperations()).toHaveLength(0);
    });

    it('should treat missing edge handles as default handles when checking duplicates', () => {
      (executor as any).edges = [
        {
          id: 'edge-default',
          source: 'node-1',
          target: 'node-2',
        },
      ];

      const result = executor.connectModules('node-1', 'node-2');

      expect(result.success).toBe(false);
      expect(result.error).toBe('连接已存在');
      expect(executor.getOperations()).toHaveLength(0);
      expect(executor.getCanvas().data.connections).toHaveLength(1);
    });

    it('should replace previous connections to single-value input ports', () => {
      (executor as any).nodes.push({
        id: 'node-3',
        type: 'numberinput',
        data: {
          label: 'Number 3',
          parameters: { value: 220 },
          ports: {
            inputs: {},
            outputs: { output: 'number' },
          },
        },
        position: { x: 0, y: 100 },
      });

      const result = executor.connectModules(
        'node-3',
        'node-2',
        'output',
        'input'
      );

      expect(result.success).toBe(true);
      const operations = executor.getOperations();
      expect(operations).toHaveLength(2);
      expect(operations[0]).toMatchObject({
        type: 'DISCONNECT_MODULES',
        data: {
          source: 'node-1',
          target: 'node-2',
          sourceHandle: 'output',
          targetHandle: 'input',
        },
      });
      expect(operations[1]).toMatchObject({
        type: 'CONNECT_MODULES',
        data: {
          source: 'node-3',
          target: 'node-2',
          sourceHandle: 'output',
          targetHandle: 'input',
        },
      });

      const canvas = executor.getCanvas();
      expect(canvas.data.connections).toHaveLength(1);
      expect(canvas.data.connections[0]).toMatchObject({
        source: 'node-3',
        target: 'node-2',
        sourceHandle: 'output',
        targetHandle: 'input',
      });

      const targetDetails = executor.getModuleDetails('node-2');
      expect(targetDetails.data?.connections.incoming).toEqual([
        {
          fromModule: 'node-3',
          fromHandle: 'output',
          toHandle: 'input',
        },
      ]);
    });

    it('should allow multiple connections to audio input ports', () => {
      const node1 = (executor as any).nodes.find((n: any) => n.id === 'node-1');
      const node2 = (executor as any).nodes.find((n: any) => n.id === 'node-2');

      node1.data.ports = {
        inputs: {},
        outputs: { output: 'audio' },
      };
      node2.data.ports = {
        inputs: { input: 'audio' },
        outputs: {},
      };
      (executor as any).nodes.push({
        id: 'node-3',
        type: 'oscillator',
        data: {
          label: 'Oscillator 2',
          parameters: {},
          ports: {
            inputs: {},
            outputs: { output: 'audio' },
          },
        },
        position: { x: 0, y: 100 },
      });

      const result = executor.connectModules(
        'node-3',
        'node-2',
        'output',
        'input'
      );

      expect(result.success).toBe(true);
      expect(executor.getOperations()).toEqual([
        expect.objectContaining({
          type: 'CONNECT_MODULES',
          data: expect.objectContaining({
            source: 'node-3',
            target: 'node-2',
          }),
        }),
      ]);
      expect(executor.getCanvas().data.connections).toHaveLength(2);
    });
  });

  describe('disconnectModules', () => {
    it('should disconnect modules and record operation', () => {
      const result = executor.disconnectModules(
        'node-1',
        'node-2',
        'output',
        'input'
      );
      expect(result.success).toBe(true);

      const operations = executor.getOperations();
      expect(operations).toHaveLength(1);
      expect(operations[0].type).toBe('DISCONNECT_MODULES');

      const canvas = executor.getCanvas();
      expect(canvas.data.connections).toHaveLength(0);
    });

    it('should treat missing edge handles as default handles when disconnecting', () => {
      (executor as any).edges = [
        {
          id: 'edge-default',
          source: 'node-1',
          target: 'node-2',
        },
      ];

      const result = executor.disconnectModules(
        'node-1',
        'node-2',
        'output',
        'input'
      );

      expect(result.success).toBe(true);
      expect(executor.getOperations()).toEqual([
        expect.objectContaining({
          type: 'DISCONNECT_MODULES',
          data: {
            source: 'node-1',
            target: 'node-2',
            sourceHandle: 'output',
            targetHandle: 'input',
          },
        }),
      ]);
      expect(executor.getCanvas().data.connections).toHaveLength(0);
    });

    it('should return error if connection not found', () => {
      const result = executor.disconnectModules(
        'node-1',
        'node-2',
        'wrong',
        'input'
      );
      expect(result.success).toBe(false);
    });
  });

  describe('ragSearch', () => {
    it('should call searchDocuments', async () => {
      const { searchDocuments } = await import('@/lib/rag/vectorStore');
      (searchDocuments as any).mockResolvedValue(['result1', 'result2']);

      const result = await executor.ragSearch('query', 5);
      expect(result.success).toBe(true);
      expect(searchDocuments).toHaveBeenCalledWith('query', 5);
    });

    it('should normalize topK like the RAG API route', async () => {
      const { searchDocuments } = await import('@/lib/rag/vectorStore');
      (searchDocuments as any).mockClear();
      (searchDocuments as any).mockResolvedValue({ matches: [] });

      await executor.ragSearch('query', 0);
      await executor.ragSearch('query', 3.9);
      await executor.ragSearch('query', 0);

      expect(searchDocuments).toHaveBeenNthCalledWith(1, 'query', 1);
      expect(searchDocuments).toHaveBeenNthCalledWith(2, 'query', 3);
      expect(searchDocuments).toHaveBeenNthCalledWith(3, 'query', 1);
    });
  });
});

describe('Tool Definitions', () => {
  let executor: ToolExecutor;

  beforeEach(() => {
    executor = new ToolExecutor(mockInitialState);
  });

  it('should create all tools', () => {
    const tools = createTools(executor);
    expect(tools).toHaveLength(9);

    const toolNames = tools.map((t) => t.name);
    expect(toolNames).toContain('canvas_inspect');
    expect(toolNames).toContain('module_add');
    expect(toolNames).toContain('knowledge_search');
    expect(toolNames).toContain('skill_list');
    expect(toolNames).toContain('skill_load');
  });

  it('organizes tools into capability groups with declarative approval policy', () => {
    const registry = createAgentToolRegistry(executor);

    expect(registry.groups.map((group) => group.id)).toEqual([
      'inspection',
      'modules',
      'connections',
      'knowledge',
      'skills',
    ]);
    expect(registry.approvalRequiredToolNames).toEqual([
      'module_delete',
      'connection_disconnect',
    ]);
  });

  it('tools should invoke executor methods', async () => {
    const tools = createTools(executor);
    const addTool = tools.find((t) => t.name === 'module_add');
    const loadSkillTool = tools.find((t) => t.name === 'skill_load');

    expect(addTool).toBeDefined();
    expect(loadSkillTool).toBeDefined();
    if (!addTool || !loadSkillTool) return;

    await loadSkillTool.call({ skillId: 'module:numberinput' });

    await addTool.call({
      type: 'numberinput',
      label: 'Test',
      position: { x: 0, y: 0 },
    });

    const operations = executor.getOperations();
    expect(operations).toHaveLength(1);
    expect(operations[0].type).toBe('ADD_MODULE');
  });

  it('requires a module Skill before adding that module type', async () => {
    const tools = createTools(executor);
    const addTool = tools.find((tool) => tool.name === 'module_add');

    expect(addTool).toBeDefined();
    if (!addTool) return;

    const result = JSON.parse(
      await addTool.call({
        type: 'numberinput',
        label: 'Needs Skill',
      })
    );

    expect(result).toEqual({
      success: false,
      error: '添加 numberinput 前必须先加载模块 Skill',
      requiredSkillId: 'module:numberinput',
    });
    expect(executor.getOperations()).toHaveLength(0);
  });

  it('rejects malformed tool arguments before mutating executor state', async () => {
    const tools = createTools(executor);
    const addTool = tools.find((t) => t.name === 'module_add');

    expect(addTool).toBeDefined();
    if (!addTool) return;

    await expect(
      addTool.invoke({
        type: 'numberinput',
        label: 'Broken',
        position: { x: 'bad', y: 0 },
      })
    ).rejects.toThrow();

    expect(executor.getOperations()).toHaveLength(0);
  });

  it('loads module Skills through the skills tool group', async () => {
    const tools = createTools(executor);
    const loadSkillTool = tools.find((tool) => tool.name === 'skill_load');

    expect(loadSkillTool).toBeDefined();
    if (!loadSkillTool) return;

    const result = JSON.parse(
      await loadSkillTool.call({ skillId: 'module:numberinput' })
    );

    expect(result.success).toBe(true);
    expect(result.data.moduleType).toBe('numberinput');
    expect(result.data.parameters).toEqual([
      expect.objectContaining({ key: 'value', min: 0, max: 999 }),
    ]);
    expect(result.data.ports.outputs).toEqual([
      { key: 'output', type: 'number' },
    ]);
  });
});
