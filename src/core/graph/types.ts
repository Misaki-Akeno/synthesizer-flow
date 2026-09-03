import type { Edge, Node } from '@xyflow/react';
import type {
  ModuleInterface,
  ParameterType,
  PortType,
} from '@/core/base/ModuleBase';

export type ParameterValue = number | boolean | string;

/**
 * React Flow 只保存可序列化的声明数据，不持有音频运行时实例。
 */
export interface FlowNodeData extends Record<string, unknown> {
  type: string;
  label: string;
  parameters: Record<string, ParameterValue>;
  enabled: boolean;
}

export type FlowNode = Node<FlowNodeData>;

export interface AudioModuleSpec {
  id: string;
  type: string;
  name: string;
  parameters: Record<string, ParameterValue>;
  enabled: boolean;
}

export interface AudioConnectionSpec {
  source: string;
  target: string;
  sourcePort: string;
  targetPort: string;
}

export interface AudioGraphDocument {
  revision: number;
  modules: AudioModuleSpec[];
  connections: AudioConnectionSpec[];
}

export interface RuntimeParameterMeta {
  type: ParameterType;
  min?: number;
  max?: number;
  step?: number;
  options?: string[];
  uiOptions?: Record<string, unknown>;
}

export interface RuntimeCustomUI {
  type: string;
  props: Record<string, unknown>;
  actions: string[];
}

/**
 * UI 可观察的运行时快照。所有字段都必须可序列化，禁止泄漏 AudioNode。
 */
export interface RuntimeModuleSnapshot {
  id: string;
  type: string;
  name: string;
  enabled: boolean;
  canEnable: boolean;
  parameters: Record<string, ParameterValue>;
  parameterMeta: Record<string, RuntimeParameterMeta>;
  inputPortTypes: Record<string, PortType>;
  outputPortTypes: Record<string, PortType>;
  inputValues: Record<string, ModuleInterface>;
  outputValues: Record<string, ModuleInterface>;
  customUI?: RuntimeCustomUI;
}

export type GraphPatch =
  | { type: 'createModule'; module: AudioModuleSpec }
  | { type: 'disposeModule'; moduleId: string }
  | { type: 'renameModule'; moduleId: string; name: string }
  | {
      type: 'setParameter';
      moduleId: string;
      key: string;
      value: ParameterValue;
    }
  | { type: 'setEnabled'; moduleId: string; enabled: boolean }
  | { type: 'connect'; connection: AudioConnectionSpec }
  | { type: 'disconnect'; connection: AudioConnectionSpec };

export interface RuntimeCommitResult {
  appliedPatches: GraphPatch[];
  failedConnections: AudioConnectionSpec[];
}

export interface GraphCommitResult extends RuntimeCommitResult {
  document: AudioGraphDocument;
}

export function connectionSpecFromEdge(edge: Edge): AudioConnectionSpec {
  return {
    source: edge.source,
    target: edge.target,
    sourcePort: edge.sourceHandle ?? 'output',
    targetPort: edge.targetHandle ?? 'input',
  };
}

export function edgeFromConnectionSpec(
  connection: AudioConnectionSpec,
  id: string
): Edge {
  return {
    id,
    source: connection.source,
    target: connection.target,
    sourceHandle: connection.sourcePort,
    targetHandle: connection.targetPort,
  };
}
