/**
 * MCP系统导出 - 统一导出MCP相关功能
 */

export { LocalAIClient } from './client';
export { MCPToolExecutor } from './executor';
export { mcpTools } from './tools';
export { getSystemPrompt } from './systemPrompt';

export type { ChatMessage, ChatResponse, ToolCall } from './client';
export type { Tool } from './tools';
