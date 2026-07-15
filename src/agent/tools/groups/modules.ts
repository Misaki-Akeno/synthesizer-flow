import { z } from 'zod';
import type { ToolExecutor } from '../executor';
import { createStructuredTool } from '../create-tool';
import type { AgentToolGroup } from '../types';
import type { AgentSkillSession } from '@/agent/skills';

const addModuleSchema = z.object({
  type: z.string().trim().min(1).describe('模块类型；应先通过 skill_load 获取'),
  label: z.string().trim().min(1).max(80).describe('画布显示名称'),
  position: z
    .object({ x: z.number().finite(), y: z.number().finite() })
    .optional()
    .describe('可选画布位置；省略时自动寻找空位'),
});

const updateModuleSchema = z.object({
  moduleId: z.string().trim().min(1).describe('真实模块 ID'),
  parameter: z.string().trim().min(1).describe('参数 key'),
  value: z.union([z.string(), z.number().finite(), z.boolean()]),
});

const deleteModuleSchema = z.object({
  moduleId: z.string().trim().min(1).describe('要删除的真实模块 ID'),
});

export function createModuleToolGroup(
  executor: ToolExecutor,
  skillSession: AgentSkillSession
): AgentToolGroup {
  return {
    id: 'modules',
    label: '模块编辑',
    description: '创建、配置和删除模块',
    entries: [
      {
        tool: createStructuredTool({
          name: 'module_add',
          description:
            '添加模块。使用前应加载对应 module:* Skill，确认模块 type、端口与推荐配置。',
          schema: addModuleSchema,
          func: ({ type, label, position }) => {
            if (!skillSession.hasModuleGuide(type)) {
              return {
                success: false,
                error: `添加 ${type} 前必须先加载模块 Skill`,
                requiredSkillId: `module:${type.toLowerCase()}`,
              };
            }
            return executor.addModule(type, label, position);
          },
        }),
      },
      {
        tool: createStructuredTool({
          name: 'module_update',
          description:
            '更新一个模块参数。必须先通过 canvas_inspect(moduleId) 获取真实参数 key 和当前值。',
          schema: updateModuleSchema,
          func: ({ moduleId, parameter, value }) =>
            executor.updateModuleParameter(moduleId, parameter, value),
        }),
      },
      {
        requiresApproval: true,
        tool: createStructuredTool({
          name: 'module_delete',
          description:
            '删除模块及其相关连接。这是破坏性操作，必须使用 canvas_inspect 确认真实 ID。',
          schema: deleteModuleSchema,
          func: ({ moduleId }) => executor.deleteModule(moduleId),
        }),
      },
    ],
  };
}
