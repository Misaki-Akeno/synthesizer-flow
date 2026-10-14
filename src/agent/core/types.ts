export interface ChatMessage {
  /** 客户端生成的稳定消息 ID，用于避免重试或恢复时重复写入图状态。 */
  id?: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  toolCalls?: ToolCall[];
  approval?: {
    status: 'pending' | 'approved' | 'rejected';
    projectId?: string;
    canvasRevision?: number;
  };
}

export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
  result?: string;
}

export type ClientOperation =
  | {
      type: 'ADD_MODULE';
      data: {
        id: string;
        type: string;
        label: string;
        position: { x: number; y: number };
      };
    }
  | { type: 'DELETE_MODULE'; data: { id: string } }
  | {
      type: 'UPDATE_MODULE_PARAM';
      data: { id: string; key: string; value: unknown };
    }
  | {
      type: 'CONNECT_MODULES';
      data: {
        source: string;
        target: string;
        sourceHandle?: string;
        targetHandle?: string;
      };
    }
  | {
      type: 'DISCONNECT_MODULES';
      data: {
        source: string;
        target: string;
        sourceHandle?: string;
        targetHandle?: string;
      };
    }
  | { type: 'ERROR'; data: { message: string } };

export type GraphStateParameterValue = number | boolean | string;

export interface GraphStateSnapshotNode {
  id: string;
  type?: string;
  position: { x: number; y: number };
  data: {
    type: string;
    label?: string;
    parameters?: Record<string, GraphStateParameterValue>;
    ports?: {
      inputs?: Record<string, string>;
      outputs?: Record<string, string>;
    };
    module?: unknown;
  };
  selected?: boolean;
}

export interface GraphStateSnapshotEdge {
  id?: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
}

export interface GraphStateSnapshot {
  nodes: GraphStateSnapshotNode[];
  edges: GraphStateSnapshotEdge[];
}

/**
 * 会被 LangGraph checkpoint 序列化的工具运行时。它只保存可 JSON 化的
 * 影子画布与待客户端落地的操作，不能保存 ToolExecutor 或模块实例本身。
 */
export interface AgentExecutionContext {
  shadowState: GraphStateSnapshot;
  pendingOperations: ClientOperation[];
  loadedSkillIds: string[];
}

export interface ChatResponse {
  message: ChatMessage;
  toolCalls?: ToolCall[];
  hasToolUse: boolean;
  clientOperations?: ClientOperation[];
  approvalRequired?: boolean;
  threadId?: string;
}
