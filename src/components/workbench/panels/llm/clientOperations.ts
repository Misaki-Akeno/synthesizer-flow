import type { Edge, EdgeChange } from '@xyflow/react';
import type { ClientOperation } from '@/agent/core/types';

type ConnectionOperationData = Extract<
  ClientOperation,
  { type: 'CONNECT_MODULES' | 'DISCONNECT_MODULES' }
>['data'];

function normalizeSourceHandle(handle: string | null | undefined): string {
  return handle || 'output';
}

function normalizeTargetHandle(handle: string | null | undefined): string {
  return handle || 'input';
}

export function edgeMatchesDisconnectOperation(
  edge: Edge,
  operation: ConnectionOperationData
): boolean {
  if (edge.source !== operation.source || edge.target !== operation.target) {
    return false;
  }

  const sourceMatches =
    !operation.sourceHandle ||
    normalizeSourceHandle(edge.sourceHandle) === operation.sourceHandle;
  const targetMatches =
    !operation.targetHandle ||
    normalizeTargetHandle(edge.targetHandle) === operation.targetHandle;

  return sourceMatches && targetMatches;
}

export function getDisconnectEdgeChanges(
  edges: Edge[],
  operation: ConnectionOperationData
): EdgeChange[] {
  return edges
    .filter((edge) => edgeMatchesDisconnectOperation(edge, operation))
    .map((edge) => ({ type: 'remove', id: edge.id }));
}
