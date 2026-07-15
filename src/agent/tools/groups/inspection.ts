import { z } from 'zod';
import type { ToolExecutor } from '../executor';
import { createStructuredTool } from '../create-tool';
import type { AgentToolGroup } from '../types';

const inspectCanvasSchema = z.object({
  moduleId: z
    .string()
    .trim()
    .min(1)
    .optional()
    .describe('可选模块 ID；不传时返回完整画布摘要'),
});

export function createInspectionToolGroup(
  executor: ToolExecutor
): AgentToolGroup {
  return {
    id: 'inspection',
    label: '画布检查',
    description: '读取画布摘要、模块参数、端口和连接状态',
    entries: [
      {
        tool: createStructuredTool({
          name: 'canvas_inspect',
          description:
            '检查当前画布。省略 moduleId 时返回所有模块和连接摘要；传入 moduleId 时返回该模块的参数、端口和相邻连接。',
          schema: inspectCanvasSchema,
          func: ({ moduleId }) =>
            moduleId
              ? executor.getModuleDetails(moduleId)
              : executor.getCanvas(),
        }),
      },
    ],
  };
}
