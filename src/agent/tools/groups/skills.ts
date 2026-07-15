import { z } from 'zod';
import type { AgentSkillSession } from '@/agent/skills';
import { createStructuredTool } from '../create-tool';
import type { AgentToolGroup } from '../types';

const listSkillsSchema = z.object({
  query: z
    .string()
    .trim()
    .max(100)
    .optional()
    .describe('按模块名、用途、标签或描述过滤'),
  category: z.string().trim().max(40).optional().describe('可选模块分类过滤'),
});

const loadSkillSchema = z.object({
  skillId: z
    .string()
    .trim()
    .min(1)
    .describe('skill_list 返回的 ID，例如 module:reverb'),
});

export function createSkillToolGroup(
  skillSession: AgentSkillSession
): AgentToolGroup {
  return {
    id: 'skills',
    label: '模块 Skills',
    description: '发现并按需加载与真实模块实现同步的操作指南',
    entries: [
      {
        tool: createStructuredTool({
          name: 'skill_list',
          description:
            '列出可用 Skills 的轻量摘要。需要选择模块但不确定准确 type 时先调用此工具。',
          schema: listSkillsSchema,
          func: (options) => {
            const skills = skillSession.list(options);
            return {
              success: true,
              data: {
                total: skills.length,
                skills,
                next: '选择相关 skillId 后调用 skill_load 获取完整参数与端口指南',
              },
            };
          },
        }),
      },
      {
        tool: createStructuredTool({
          name: 'skill_load',
          description:
            '加载一个 Skill 的完整指南，包括真实参数默认值、范围、端口类型、使用步骤和注意事项。',
          schema: loadSkillSchema,
          func: ({ skillId }) => {
            const skill = skillSession.load(skillId);
            return skill
              ? {
                  success: true,
                  data: skill,
                  loadedSkillIds: skillSession.getLoadedSkillIds(),
                }
              : { success: false, error: `未找到 Skill: ${skillId}` };
          },
        }),
      },
    ],
  };
}
