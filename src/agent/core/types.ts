export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  toolCalls?: ToolCall[];
  approval?: {
    status: 'pending' | 'approved' | 'rejected';
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

export interface ChatResponse {
  message: ChatMessage;
  toolCalls?: ToolCall[];
  hasToolUse: boolean;
  clientOperations?: ClientOperation[];
  approvalRequired?: boolean;
  threadId?: string;
}
