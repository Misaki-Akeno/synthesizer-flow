import type { ToolExecutor } from './executor';
import { createInspectionToolGroup } from './groups/inspection';
import { createModuleToolGroup } from './groups/modules';
import { createConnectionToolGroup } from './groups/connections';
import { createKnowledgeToolGroup } from './groups/knowledge';
import { createSkillToolGroup } from './groups/skills';
import type { AgentToolRegistry } from './types';
import { AgentSkillSession } from '@/agent/skills';

/**
 * 创建按能力域组织的 Agent 工具注册表。
 * Graph 从注册表读取审批策略，避免在工作流中重复维护危险工具名单。
 */
export function createAgentToolRegistry(
  executor: ToolExecutor
): AgentToolRegistry {
  const skillSession = new AgentSkillSession();
  const groups = [
    createInspectionToolGroup(executor),
    createModuleToolGroup(executor, skillSession),
    createConnectionToolGroup(executor),
    createKnowledgeToolGroup(executor),
    createSkillToolGroup(skillSession),
  ];
  const entries = groups.flatMap((group) => group.entries);

  return {
    groups,
    tools: entries.map((entry) => entry.tool),
    approvalRequiredToolNames: entries
      .filter((entry) => entry.requiresApproval)
      .map((entry) => entry.tool.name),
  };
}

/**
 * 兼容只需要扁平工具数组的调用点；新代码优先使用 createAgentToolRegistry。
 */
export function createTools(executor: ToolExecutor) {
  return createAgentToolRegistry(executor).tools;
}

export type { AgentTool, AgentToolGroup, AgentToolRegistry } from './types';
