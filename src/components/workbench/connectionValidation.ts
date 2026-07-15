import { FlowNode } from '@/core/services/ModuleManager';

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

  const sourceModule = nodes.find((node) => node.id === source)?.data?.module;
  const targetModule = nodes.find((node) => node.id === target)?.data?.module;

  if (!sourceModule || !targetModule) {
    return false;
  }

  const sourcePortType = sourceModule.outputPortTypes[sourceHandle];
  const targetPortType = targetModule.inputPortTypes[targetHandle];

  return Boolean(sourcePortType && targetPortType && sourcePortType === targetPortType);
}
