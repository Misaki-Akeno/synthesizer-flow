import type { FlowNode } from '@/core/graph/types';
import { moduleDefinitionRegistry } from '@/core/graph/ModuleDefinitionRegistry';

interface ConnectionLike {
  source?: string | null;
  target?: string | null;
  sourceHandle?: string | null;
  targetHandle?: string | null;
}

export function isValidModuleConnection(
  nodes: FlowNode[],
  connection: ConnectionLike
): boolean {
  const { source, target, sourceHandle, targetHandle } = connection;

  if (!source || !target || !sourceHandle || !targetHandle) {
    return false;
  }

  const sourceNode = nodes.find((node) => node.id === source);
  const targetNode = nodes.find((node) => node.id === target);

  if (!sourceNode || !targetNode) {
    return false;
  }

  const sourcePortType = moduleDefinitionRegistry.get(sourceNode.data.type)
    ?.outputPortTypes[sourceHandle];
  const targetPortType = moduleDefinitionRegistry.get(targetNode.data.type)
    ?.inputPortTypes[targetHandle];

  return Boolean(
    sourcePortType && targetPortType && sourcePortType === targetPortType
  );
}
