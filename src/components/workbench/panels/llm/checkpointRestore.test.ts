import { describe, expect, it } from 'vitest';
import type { GraphStateSnapshot } from '@/agent';
import { graphStateToSerializedCanvas } from './checkpointRestore';

describe('checkpoint restore helpers', () => {
  it('converts graph snapshots into serialized canvas data', () => {
    const graphState: GraphStateSnapshot = {
      nodes: [
        {
          id: 'number',
          type: 'default',
          position: { x: 10, y: 20 },
          data: {
            type: 'numberinput',
            label: 'Number',
            parameters: { value: 7 },
            ports: {
              inputs: {},
              outputs: { output: 'number' },
            },
            module: undefined,
          },
        },
      ],
      edges: [
        {
          id: 'edge-1',
          source: 'number',
          target: 'calculator',
          sourceHandle: 'output',
          targetHandle: 'a',
        },
      ],
    };

    expect(graphStateToSerializedCanvas(graphState, 123)).toEqual({
      version: '1.0',
      timestamp: 123,
      nodes: [
        {
          id: 'number',
          position: { x: 10, y: 20 },
          data: {
            type: 'numberinput',
            label: 'Number',
            parameters: { value: 7 },
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
      ],
    });
  });

  it('rejects nodes without a restorable module type', () => {
    const graphState = {
      nodes: [
        {
          id: 'node-1',
          type: 'default',
          position: { x: 0, y: 0 },
          data: {
            label: 'Missing Type',
          },
        },
      ],
      edges: [],
    } as unknown as GraphStateSnapshot;

    expect(graphStateToSerializedCanvas(graphState, 123)).toBeNull();
  });

  it('rejects non-serializable parameter values', () => {
    const graphState = {
      nodes: [
        {
          id: 'node-1',
          position: { x: 0, y: 0 },
          data: {
            type: 'numberinput',
            parameters: {
              nested: { value: 1 },
            },
          },
        },
      ],
      edges: [],
    } as unknown as GraphStateSnapshot;

    expect(graphStateToSerializedCanvas(graphState, 123)).toBeNull();
  });

  it('normalizes null edge handles from React Flow snapshots', () => {
    const graphState: GraphStateSnapshot = {
      nodes: [
        {
          id: 'number',
          position: { x: 0, y: 0 },
          data: {
            type: 'numberinput',
          },
        },
      ],
      edges: [
        {
          source: 'number',
          target: 'calculator',
          sourceHandle: null,
          targetHandle: null,
        },
      ],
    };

    expect(graphStateToSerializedCanvas(graphState, 123)?.edges).toEqual([
      {
        source: 'number',
        target: 'calculator',
        sourceHandle: undefined,
        targetHandle: undefined,
      },
    ]);
  });
});
