import { describe, expect, it } from 'vitest';
import type { Edge } from '@xyflow/react';
import {
  edgeMatchesDisconnectOperation,
  getDisconnectEdgeChanges,
} from './clientOperations';

const defaultEdge: Edge = {
  id: 'edge-1',
  source: 'source',
  target: 'target',
};

describe('client operation helpers', () => {
  it('matches explicit default handles against edges with omitted handles', () => {
    expect(
      edgeMatchesDisconnectOperation(defaultEdge, {
        source: 'source',
        target: 'target',
        sourceHandle: 'output',
        targetHandle: 'input',
      })
    ).toBe(true);
  });

  it('treats omitted operation handles as wildcards', () => {
    expect(
      edgeMatchesDisconnectOperation(
        {
          ...defaultEdge,
          sourceHandle: 'audio out',
          targetHandle: 'audio in',
        },
        {
          source: 'source',
          target: 'target',
        }
      )
    ).toBe(true);
  });

  it('does not match a different explicit handle', () => {
    expect(
      edgeMatchesDisconnectOperation(defaultEdge, {
        source: 'source',
        target: 'target',
        sourceHandle: 'audio out',
        targetHandle: 'input',
      })
    ).toBe(false);
  });

  it('creates remove changes for every matching edge when handles are omitted', () => {
    const edges: Edge[] = [
      defaultEdge,
      {
        id: 'edge-2',
        source: 'source',
        target: 'target',
        sourceHandle: 'audio out',
        targetHandle: 'audio in',
      },
      {
        id: 'edge-3',
        source: 'other-source',
        target: 'target',
      },
    ];

    expect(
      getDisconnectEdgeChanges(edges, {
        source: 'source',
        target: 'target',
      })
    ).toEqual([
      { type: 'remove', id: 'edge-1' },
      { type: 'remove', id: 'edge-2' },
    ]);
  });

  it('creates remove changes only for the matching explicit handle', () => {
    const edges: Edge[] = [
      defaultEdge,
      {
        id: 'edge-2',
        source: 'source',
        target: 'target',
        sourceHandle: 'audio out',
        targetHandle: 'audio in',
      },
    ];

    expect(
      getDisconnectEdgeChanges(edges, {
        source: 'source',
        target: 'target',
        sourceHandle: 'audio out',
        targetHandle: 'audio in',
      })
    ).toEqual([{ type: 'remove', id: 'edge-2' }]);
  });
});
