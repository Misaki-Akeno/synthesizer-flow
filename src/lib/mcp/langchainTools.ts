import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { MCPToolExecutor } from './executor';

// 定义 Schema
const getCanvasModulesSchema = z.object({});
const getModuleDetailsSchema = z.object({
  moduleId: z.string().describe('模块ID'),
});
const getCanvasConnectionsSchema = z.object({});
const ragSearchSchema = z.object({
  query: z.string().describe('检索问题或文本'),
  topK: z.number().optional().default(5).describe('返回条数，默认5，最大20'),
});

// 强制类型转换以避免 TypeScript 深度推断导致的 OOM
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const DynamicStructuredToolAny = DynamicStructuredTool as any;

export const getCanvasModulesTool = new DynamicStructuredToolAny({
  name: 'get_canvas_modules',
  description: '获取画布上的所有模块信息，包括模块类型、参数、位置和连接状态',
  schema: getCanvasModulesSchema,
  func: async () => {
    const result = await MCPToolExecutor.getCanvasModules();
    return JSON.stringify(result);
  },
});

export const getModuleDetailsTool = new DynamicStructuredToolAny({
  name: 'get_module_details',
  description: '获取指定模块的详细信息',
  schema: getModuleDetailsSchema,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  func: async ({ moduleId }: any) => {
    const result = await MCPToolExecutor.getModuleDetails(moduleId);
    return JSON.stringify(result);
  },
});

export const getCanvasConnectionsTool = new DynamicStructuredToolAny({
  name: 'get_canvas_connections',
  description: '获取画布上所有模块间的连接信息',
  schema: getCanvasConnectionsSchema,
  func: async () => {
    const result = await MCPToolExecutor.getCanvasConnections();
    return JSON.stringify(result);
  },
});

export const ragSearchTool = new DynamicStructuredToolAny({
  name: 'rag_search',
  description: '对本地知识库进行向量检索，返回最相关片段（RAG）',
  schema: ragSearchSchema,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  func: async ({ query, topK }: any) => {
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
