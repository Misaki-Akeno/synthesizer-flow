import { z } from 'zod';
import type { ToolExecutor } from '../executor';
import { createStructuredTool } from '../create-tool';
import type { AgentToolGroup } from '../types';

const knowledgeSearchSchema = z.object({
  query: z.string().trim().min(2).max(500).describe('需要检索的问题'),
  limit: z.number().int().min(1).max(20).optional().default(5),
});

export function createKnowledgeToolGroup(
  executor: ToolExecutor
): AgentToolGroup {
  return {
    id: 'knowledge',
    label: '知识检索',
    description: '检索项目知识库中的音频与合成知识',
    entries: [
      {
        tool: createStructuredTool({
          name: 'knowledge_search',
          description:
            '仅在回答需要外部音频知识、合成原理或项目文档事实时检索知识库；画布和模块 schema 应使用检查工具或 Skills。',
          schema: knowledgeSearchSchema,
          func: ({ query, limit }) => executor.ragSearch(query, limit),
        }),
      },
    ],
  };
}
