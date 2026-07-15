import type { StructuredTool } from '@langchain/core/tools';

export type AgentTool = StructuredTool;

export type AgentToolGroupId =
  | 'inspection'
  | 'modules'
  | 'connections'
  | 'knowledge'
  | 'skills';

export interface AgentToolEntry {
  tool: AgentTool;
  requiresApproval?: boolean;
}

export interface AgentToolGroup {
  id: AgentToolGroupId;
  label: string;
  description: string;
  entries: AgentToolEntry[];
}

export interface AgentToolRegistry {
  groups: AgentToolGroup[];
  tools: AgentTool[];
  approvalRequiredToolNames: string[];
}
