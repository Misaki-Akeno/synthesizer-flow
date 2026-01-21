import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { ToolExecutor } from './executor';

// 定义 Schema
const getCanvasModulesSchema = z.object({});
const getModuleDetailsSchema = z.object({
  moduleId: z.string().describe('模块ID'),
});

const ragSearchSchema = z.object({
  query: z.string().describe('检索问题或文本'),
  topK: z.number().optional().default(5).describe('返回条数，默认5，最大20'),
});

const addModuleSchema = z.object({
  type: z.string().describe('模块类型 (例如: oscillator, filter, gain, etc.)'),
  label: z.string().describe('模块标签/名称'),
  position: z.object({
    x: z.number(),
    y: z.number(),
  }).optional().describe('模块位置 (可选)'),
});

const deleteModuleSchema = z.object({
  moduleId: z.string().describe('要删除的模块ID'),
});

const updateModuleParameterSchema = z.object({
  moduleId: z.string().describe('模块ID'),
  paramKey: z.string().describe('参数名称'),
  value: z.union([z.string(), z.number(), z.boolean()]).describe('参数值'),
});

const connectModulesSchema = z.object({
  sourceId: z.string().describe('源模块ID'),
  targetId: z.string().describe('目标模块ID'),
  sourceHandle: z.string().optional().describe('源模块句柄 (可选)'),
  targetHandle: z.string().optional().describe('目标模块句柄 (可选)'),
});

const disconnectModulesSchema = z.object({
  sourceId: z.string().describe('源模块ID'),
  targetId: z.string().describe('目标模块ID'),
  sourceHandle: z.string().optional().describe('源模块句柄 (可选)'),
  targetHandle: z.string().optional().describe('目标模块句柄 (可选)'),
});

// 强制类型转换以避免 TypeScript 深度推断导致的 OOM
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const DynamicStructuredToolAny = DynamicStructuredTool as any;

export function createTools(executor: ToolExecutor) {
  const getCanvasTool = new DynamicStructuredToolAny({
    name: 'get_canvas',
    description: '获取画布上的所有模块和连接信息的快照',
    schema: getCanvasModulesSchema, // Schema is typically empty for "get all"
    func: async () => {
      const result = executor.getCanvas();
      return JSON.stringify(result);
    },
  });

  const getModuleDetailsTool = new DynamicStructuredToolAny({
    name: 'get_module_details',
    description: '获取指定模块的详细信息',
    schema: getModuleDetailsSchema,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    func: async ({ moduleId }: any) => {
      const result = executor.getModuleDetails(moduleId);
      return JSON.stringify(result);
    },
  });

  const ragSearchTool = new DynamicStructuredToolAny({
    name: 'rag_search',
    description: '对本地知识库进行向量检索，返回最相关片段（RAG）',
    schema: ragSearchSchema,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    func: async ({ query, topK }: any) => {
      const result = await executor.ragSearch(query, topK);
      return JSON.stringify(result);
    },
  });

  const addModuleTool = new DynamicStructuredToolAny({
    name: 'add_module',
    description: '在画布上添加一个新的音频模块，返回新模块的详细信息',
    schema: addModuleSchema,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    func: async ({ type, label, position }: any) => {
      const result = executor.addModule(type, label, position);
      return JSON.stringify(result);
    },
  });

  const deleteModuleTool = new DynamicStructuredToolAny({
    name: 'delete_module',
    description: '从画布上删除指定的模块',
    schema: deleteModuleSchema,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    func: async ({ moduleId }: any) => {
      const result = executor.deleteModule(moduleId);
      return JSON.stringify(result);
    },
  });

  const updateModuleParameterTool = new DynamicStructuredToolAny({
    name: 'update_module_parameter',
    description: '更新指定模块的参数值，返回更新后的模块详细信息',
    schema: updateModuleParameterSchema,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    func: async ({ moduleId, paramKey, value }: any) => {
      const result = executor.updateModuleParameter(moduleId, paramKey, value);
      return JSON.stringify(result);
    },
  });

  const connectModulesTool = new DynamicStructuredToolAny({
    name: 'connect_modules',
    description: '连接两个模块，返回涉及模块的详细信息',
    schema: connectModulesSchema,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    func: async ({ sourceId, targetId, sourceHandle, targetHandle }: any) => {
      const result = executor.connectModules(sourceId, targetId, sourceHandle, targetHandle);
      return JSON.stringify(result);
    },
  });

  const disconnectModulesTool = new DynamicStructuredToolAny({
    name: 'disconnect_modules',
    description: '断开两个模块之间的连接，返回涉及模块的详细信息',
    schema: disconnectModulesSchema,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    func: async ({ sourceId, targetId, sourceHandle, targetHandle }: any) => {
      const result = executor.disconnectModules(sourceId, targetId, sourceHandle, targetHandle);
      return JSON.stringify(result);
    },
  });

  return [
    getCanvasTool,
    getModuleDetailsTool,
    addModuleTool,
    deleteModuleTool,
    updateModuleParameterTool,
    connectModulesTool,
    disconnectModulesTool,
    ragSearchTool,
  ];
}
