/**
 * 工具定义文件 - 定义LLM可以使用的工具
 */

/**
 * 工具参数属性定义
 */
export interface ToolParameterProperty {
  type: string; // 参数类型: string, number, boolean, object, array等
  description: string; // 参数描述
  enum?: string[]; // 可选的枚举值
}

/**
 * 工具参数定义
 */
export interface ToolParameters {
  type: string; // 通常是"object"
  properties: {
    [key: string]: ToolParameterProperty;
  };
  required?: string[]; // 必需的参数列表
}

/**
 * 工具定义接口 - 基于OpenAI工具格式
 */
export interface Tool {
  type: string; // 工具类型，通常是'function'
  function: {
    name: string; // 工具名称
    description: string; // 工具描述
    parameters: ToolParameters; // 工具参数定义
  };
}

/**
 * 工具调用请求接口
 */
export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string; // JSON字符串形式的参数
  };
}

/**
 * 工具调用结果接口
 */
export interface ToolResult {
  toolCallId: string;
  result: string; // JSON字符串形式的结果
}

/**
 * AI聊天消息格式，添加了工具调用支持
 */
export interface ChatMessage {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string | null;
  tool_call_id?: string;
  tool_calls?: ToolCall[];
}

/**
 * 工具列表 - 定义所有可用的工具
 */
export const tools: Tool[] = [
  {
    type: 'function',
    function: {
      name: 'get_all_modules',
      description: '获取当前画布上的所有模块信息',
      parameters: {
        type: 'object',
        properties: {
          // 该工具不需要参数
        },
      },
    },
  },
  // 以后可以在这里添加更多工具...
];
