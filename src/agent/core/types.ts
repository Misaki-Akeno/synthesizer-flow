export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export type ClientOperation = 
  | { type: 'ADD_MODULE'; data: { id: string; type: string; label: string; position: { x: number; y: number } } }
  | { type: 'DELETE_MODULE'; data: { id: string } }
  | { type: 'UPDATE_MODULE_PARAM'; data: { id: string; key: string; value: unknown } }
  | { type: 'CONNECT_MODULES'; data: { source: string; target: string; sourceHandle?: string; targetHandle?: string } }
  | { type: 'DISCONNECT_MODULES'; data: { source: string; target: string; sourceHandle?: string; targetHandle?: string } }
  | { type: 'ERROR'; data: { message: string } };

export interface GraphStateSnapshot {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  nodes: any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  edges: any[];
}

export interface ChatResponse {
  message: ChatMessage;
  toolCalls?: ToolCall[];
  hasToolUse: boolean;
  clientOperations?: ClientOperation[];
}
