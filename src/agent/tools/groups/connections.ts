import { z } from 'zod';
import type { ToolExecutor } from '../executor';
import { createStructuredTool } from '../create-tool';
import type { AgentToolGroup } from '../types';

const connectionSchema = z.object({
  sourceId: z.string().trim().min(1).describe('源模块真实 ID'),
  targetId: z.string().trim().min(1).describe('目标模块真实 ID'),
  sourcePort: z.string().trim().min(1).optional().describe('源输出端口 key'),
  targetPort: z.string().trim().min(1).optional().describe('目标输入端口 key'),
});

export function createConnectionToolGroup(
  executor: ToolExecutor
): AgentToolGroup {
  return {
    id: 'connections',
    label: '信号连接',
    description: '创建和断开类型安全的模块端口连接',
    entries: [
      {
        tool: createStructuredTool({
          name: 'connection_connect',
          description:
            '连接两个模块端口。省略端口时仅会在可唯一推断时自动选择；复杂模块应显式传入 Skill 中记录的端口 key。',
          schema: connectionSchema,
          func: ({ sourceId, targetId, sourcePort, targetPort }) =>
            executor.connectModules(sourceId, targetId, sourcePort, targetPort),
        }),
      },
      {
        requiresApproval: true,
        tool: createStructuredTool({
          name: 'connection_disconnect',
          description:
            '断开指定模块之间的连接。这是破坏性操作；传入端口可只断开目标连接。',
          schema: connectionSchema,
          func: ({ sourceId, targetId, sourcePort, targetPort }) =>
            executor.disconnectModules(
              sourceId,
              targetId,
              sourcePort,
              targetPort
            ),
        }),
      },
    ],
  };
}
