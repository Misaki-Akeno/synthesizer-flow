/**
 * MCP工具定义 - 定义AI可以使用的工具
 */

// 为了避免在构建时依赖未安装的 @modelcontextprotocol/sdk 包，
// 这里定义一个与我们所需字段兼容的轻量级 Tool 类型。
export type Tool = {
  name: string;
  description: string;
  inputSchema: {
    type: string;
    properties: Record<string, unknown>;
    required?: string[];
  };
};

export const mcpTools: Tool[] = [
  {
    name: 'get_canvas_modules',
    description: '获取画布上的所有模块信息，包括模块类型、参数、位置和连接状态',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'get_module_details',
    description: '获取指定模块的详细信息',
    inputSchema: {
      type: 'object',
      properties: {
        moduleId: {
          type: 'string',
          description: '模块ID',
        },
      },
      required: ['moduleId'],
    },
  },
  {
    name: 'get_canvas_connections',
    description: '获取画布上所有模块间的连接信息',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'rag_search',
    description: '对本地知识库进行向量检索，返回最相关片段（RAG）',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: '检索问题或文本' },
        topK: { type: 'number', description: '返回条数，默认5，最大20' },
      },
      required: ['query'],
    },
  },
];
