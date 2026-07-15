import type { GraphStateSnapshot } from '@/agent/core/types';
import type { SerializedCanvas } from '@/core/types/SerializationTypes';

function isPosition(value: unknown): value is { x: number; y: number } {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { x?: unknown }).x === 'number' &&
    typeof (value as { y?: unknown }).y === 'number'
  );
}

function isParameters(
  value: unknown
): value is Record<string, number | boolean | string> {
  if (value === undefined) {
    return true;
  }

  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }

  return Object.values(value).every(
    (entry) =>
      typeof entry === 'number' ||
      typeof entry === 'boolean' ||
      typeof entry === 'string'
  );
}

export function graphStateToSerializedCanvas(
  graphState: GraphStateSnapshot,
  timestamp = Date.now()
): SerializedCanvas | null {
  if (!Array.isArray(graphState.nodes) || !Array.isArray(graphState.edges)) {
    return null;
  }

  const nodes: SerializedCanvas['nodes'] = [];
  for (const rawNode of graphState.nodes) {
    const type = rawNode.data?.type;
    const parameters = rawNode.data?.parameters;

    if (
      typeof rawNode.id !== 'string' ||
      !rawNode.id.trim() ||
      !isPosition(rawNode.position) ||
      typeof type !== 'string' ||
      !type.trim() ||
      !isParameters(parameters)
    ) {
      return null;
    }

    nodes.push({
      id: rawNode.id,
      position: rawNode.position,
      data: {
        type,
        label:
          typeof rawNode.data?.label === 'string'
            ? rawNode.data.label
            : rawNode.id,
        parameters,
      },
    });
  }

  const edges: SerializedCanvas['edges'] = [];
  for (const rawEdge of graphState.edges) {
    if (
      typeof rawEdge.source !== 'string' ||
      !rawEdge.source.trim() ||
      typeof rawEdge.target !== 'string' ||
      !rawEdge.target.trim() ||
      (rawEdge.sourceHandle !== undefined &&
        rawEdge.sourceHandle !== null &&
        typeof rawEdge.sourceHandle !== 'string') ||
      (rawEdge.targetHandle !== undefined &&
        rawEdge.targetHandle !== null &&
        typeof rawEdge.targetHandle !== 'string')
    ) {
      return null;
    }

    edges.push({
      source: rawEdge.source,
      target: rawEdge.target,
      sourceHandle:
        rawEdge.sourceHandle === null ? undefined : rawEdge.sourceHandle,
      targetHandle:
        rawEdge.targetHandle === null ? undefined : rawEdge.targetHandle,
    });
  }

  return {
    version: '1.0',
    timestamp,
    nodes,
    edges,
  };
}
