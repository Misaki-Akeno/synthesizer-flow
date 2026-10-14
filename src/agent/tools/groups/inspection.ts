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

const diagnosticFixSchema = z.object({
  fixId: z
    .string()
    .trim()
    .min(1)
    .describe('canvas_diagnose 返回的完整 fix.id；禁止自行拼接'),
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
      {
        tool: createStructuredTool({
          name: 'canvas_diagnose',
          description:
            '静默检查音频图的可听路径、端口有效性、反馈环和主输出安全性。只读取声明图，不修改画布；返回确定性的 findings 与 fix.id。',
          schema: z.object({}),
          func: () => executor.diagnoseCanvas(),
        }),
      },
      {
        requiresApproval: true,
        tool: createStructuredTool({
          name: 'canvas_apply_diagnostic_fix',
          description:
            '应用 canvas_diagnose 生成的一项确定性修复。可能添加模块、改接输出或断开无效连接，必须先获得用户批准。',
          schema: diagnosticFixSchema,
          func: ({ fixId }) => executor.applyDiagnosticFix(fixId),
        }),
      },
    ],
  };
}
