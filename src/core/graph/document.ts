import type { Edge } from '@xyflow/react';
import type { AudioGraphDocument, AudioModuleSpec, FlowNode } from './types';
import { connectionSpecFromEdge } from './types';

export function audioModuleSpecFromNode(node: FlowNode): AudioModuleSpec {
  return {
    id: node.id,
    type: node.data.type,
    name: node.data.label,
    parameters: { ...node.data.parameters },
    enabled: node.data.enabled,
  };
}

export function createAudioGraphDocument(
  nodes: FlowNode[],
  edges: Edge[],
  revision: number
): AudioGraphDocument {
  return {
    revision,
    modules: nodes.map(audioModuleSpecFromNode),
    connections: edges.map(connectionSpecFromEdge),
  };
}

export function emptyAudioGraphDocument(): AudioGraphDocument {
  return {
    revision: 0,
    modules: [],
    connections: [],
  };
}
