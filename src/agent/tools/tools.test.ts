/* eslint-disable @typescript-eslint/no-explicit-any */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ToolExecutor } from './executor';
import { createTools } from './definitions';

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
const mockInitialState = {
    nodes: [
        {
            id: 'node-1',
            type: 'oscillator',
            data: { label: 'Oscillator 1', parameters: { freq: 440 } },
            position: { x: 0, y: 0 },
        },
        {
            id: 'node-2',
            type: 'gain',
            data: { label: 'Gain 1', parameters: { gain: 0.5 } },
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
    });

    describe('addModule', () => {
        it('should add a module and record operation', () => {
            const result = executor.addModule('filter', 'Filter 1', { x: 100, y: 100 });
            expect(result.success).toBe(true);

            const operations = executor.getOperations();
            expect(operations).toHaveLength(1);
            expect(operations[0].type).toBe('ADD_MODULE');
            expect((operations[0] as any).data.type).toBe('filter');

            const canvas = executor.getCanvas();
            expect(canvas.data.modules).toHaveLength(3);
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
            const result = executor.updateModuleParameter('node-1', 'freq', 880);
            expect(result.success).toBe(true);

            const operations = executor.getOperations();
            expect(operations).toHaveLength(1);
            expect(operations[0].type).toBe('UPDATE_MODULE_PARAM');
            expect((operations[0] as any).data.value).toBe(880);

            const details = executor.getModuleDetails('node-1');
            expect(details.data?.module.parameters['freq']).toBe(880);
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
                    inputs: {}
                };
            }
            if (node2) {
                node2.data.ports = {
                    inputs: { 'audio in': 'audio' },
                    outputs: {}
                };
            }

            // Connect without handles
            const result = executor.connectModules('node-1', 'node-2');

            expect(result.success).toBe(true);
            expect(result.data.message).toContain('audio out'); // Should mention resolved ports
            expect(result.data.message).toContain('audio in');

            const op = executor.getOperations().find(o => o.type === 'CONNECT_MODULES' && o.data.source === 'node-1' && o.data.target === 'node-2' && o.data.sourceHandle === 'audio out');
            expect(op).toBeDefined();
            expect((op as any).data.sourceHandle).toBe('audio out');
            expect((op as any).data.targetHandle).toBe('audio in');
        });
    });

    describe('disconnectModules', () => {
        it('should disconnect modules and record operation', () => {
            const result = executor.disconnectModules('node-1', 'node-2', 'output', 'input');
            expect(result.success).toBe(true);

            const operations = executor.getOperations();
            expect(operations).toHaveLength(1);
            expect(operations[0].type).toBe('DISCONNECT_MODULES');

            const canvas = executor.getCanvas();
            expect(canvas.data.connections).toHaveLength(0);
        });

        it('should return error if connection not found', () => {
            const result = executor.disconnectModules('node-1', 'node-2', 'wrong', 'input');
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
    });
});

describe('Tool Definitions', () => {
    let executor: ToolExecutor;

    beforeEach(() => {
        executor = new ToolExecutor(mockInitialState);
    });

    it('should create all tools', () => {
        const tools = createTools(executor);
        expect(tools).toHaveLength(8);

        const toolNames = tools.map(t => t.name);
        expect(toolNames).toContain('get_canvas');
        expect(toolNames).toContain('add_module');
        expect(toolNames).toContain('rag_search');
    });

    it('tools should invoke executor methods', async () => {
        const tools = createTools(executor);
        const addTool = tools.find(t => t.name === 'add_module');

        expect(addTool).toBeDefined();
        if (!addTool) return;

        await addTool.call({ type: 'test', label: 'Test', position: { x: 0, y: 0 } });

        const operations = executor.getOperations();
        expect(operations).toHaveLength(1);
        expect(operations[0].type).toBe('ADD_MODULE');
    });
});
