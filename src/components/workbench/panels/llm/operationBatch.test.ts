import { describe, expect, it, vi } from 'vitest';
import type { ClientOperation } from '@/agent/core/types';
import {
  applyClientOperationsAtomically,
  isCanvasResponseCurrent,
  type ClientOperationBatchAdapter,
} from './operationBatch';

function createAdapter(): ClientOperationBatchAdapter {
  const nodes = new Map<
    string,
    { type: string; parameters: Record<string, unknown> }
  >();
  const connections = new Set<string>();
  const key = (
    operation: Extract<
      ClientOperation,
      { type: 'CONNECT_MODULES' | 'DISCONNECT_MODULES' }
    >
  ) =>
    `${operation.data.source}:${operation.data.sourceHandle || 'output'}>${operation.data.target}:${operation.data.targetHandle || 'input'}`;
  return {
    begin: vi.fn(),
    commit: vi.fn(),
    cancel: vi.fn(),
    hasNode: (id) => nodes.has(id),
    getNodeType: (id) => nodes.get(id)?.type,
    add: (operation) =>
      nodes.set(operation.data.id, {
        type: operation.data.type,
        parameters: {},
      }),
    delete: (operation) => nodes.delete(operation.data.id),
    update: (operation) =>
      nodes.get(operation.data.id)?.parameters &&
      (nodes.get(operation.data.id)!.parameters[operation.data.key] =
        operation.data.value),
    readParameter: (id, keyName) => nodes.get(id)?.parameters[keyName],
    hasConnection: (operation) => connections.has(key(operation)),
    connect: (operation) => connections.add(key(operation)),
    disconnect: (operation) => connections.delete(key(operation)),
  };
}

describe('applyClientOperationsAtomically', () => {
  it('rejects a response bound to an earlier canvas revision or another project', () => {
    expect(
      isCanvasResponseCurrent(
        { projectId: 'project-a', revision: 2 },
        { projectId: 'project-a', revision: 3 }
      )
    ).toBe(false);
    expect(
      isCanvasResponseCurrent(
        { projectId: 'project-a', revision: 2 },
        { projectId: 'project-b', revision: 2 }
      )
    ).toBe(false);
  });

  it('commits an operation batch as one transaction', () => {
    const adapter = createAdapter();
    applyClientOperationsAtomically(
      [
        {
          type: 'ADD_MODULE',
          data: {
            id: 'a',
            type: 'numberinput',
            label: 'A',
            position: { x: 0, y: 0 },
          },
        },
        {
          type: 'UPDATE_MODULE_PARAM',
          data: { id: 'a', key: 'value', value: 440 },
        },
      ],
      adapter
    );
    expect(adapter.begin).toHaveBeenCalledOnce();
    expect(adapter.commit).toHaveBeenCalledOnce();
    expect(adapter.cancel).not.toHaveBeenCalled();
  });

  it('cancels the entire transaction when a runtime outcome cannot be validated', () => {
    const adapter = createAdapter();
    applyClientOperationsAtomically(
      [
        {
          type: 'ADD_MODULE',
          data: {
            id: 'a',
            type: 'numberinput',
            label: 'A',
            position: { x: 0, y: 0 },
          },
        },
      ],
      adapter
    );
    const invalidAdapter = { ...adapter, readParameter: () => undefined };
    expect(() =>
      applyClientOperationsAtomically(
        [
          {
            type: 'UPDATE_MODULE_PARAM',
            data: { id: 'a', key: 'value', value: 440 },
          },
        ],
        invalidAdapter
      )
    ).toThrow('未能更新参数');
    expect(adapter.cancel).toHaveBeenCalledOnce();
  });
});
