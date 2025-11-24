import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { MCPToolExecutor } from './executor';

export const getCanvasModulesTool = new DynamicStructuredTool({
  name: 'get_canvas_modules',
  description: '获取画布上的所有模块信息，包括模块类型、参数、位置和连接状态',
  schema: z.object({}),
  func: async () => {
    const result = await MCPToolExecutor.getCanvasModules();
    return JSON.stringify(result);
  },
});

export const getModuleDetailsTool = new DynamicStructuredTool({
  name: 'get_module_details',
  description: '获取指定模块的详细信息',
  schema: z.object({
    moduleId: z.string().describe('模块ID'),
  }),
  func: async ({ moduleId }) => {
    const result = await MCPToolExecutor.getModuleDetails(moduleId);
    return JSON.stringify(result);
  },
});

export const getCanvasConnectionsTool = new DynamicStructuredTool({
  name: 'get_canvas_connections',
  description: '获取画布上所有模块间的连接信息',
  schema: z.object({}),
  func: async () => {
    const result = await MCPToolExecutor.getCanvasConnections();
    return JSON.stringify(result);
  },
});

export const ragSearchTool = new DynamicStructuredTool({
  name: 'rag_search',
  description: '对本地知识库进行向量检索，返回最相关片段（RAG）',
  schema: z.object({
    query: z.string().describe('检索问题或文本'),
    topK: z.number().optional().default(5).describe('返回条数，默认5，最大20'),
  }),
  func: async ({ query, topK }) => {
    const result = await MCPToolExecutor.ragSearch(query, topK);
    return JSON.stringify(result);
  },
});

export const tools = [
  getCanvasModulesTool,
  getModuleDetailsTool,
  getCanvasConnectionsTool,
  ragSearchTool,
];
