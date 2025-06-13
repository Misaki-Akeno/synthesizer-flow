/**
 * 本地AI客户端 - 直接在前端调用AI服务
 */

import { MCPToolExecutor } from './executor';
import { mcpTools } from './tools';
import { AISettings } from '@/store/settings';
import { createModuleLogger } from '@/lib/logger';
import type { ChatCompletionCreateParams } from 'openai/resources/chat/completions';

const logger = createModuleLogger('LocalAIClient');

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  toolCalls?: ToolCall[];
}

export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface ChatResponse {
  message: ChatMessage;
  toolCalls?: ToolCall[];
  hasToolUse: boolean;
}

/**
 * 本地AI客户端类
 */
export class LocalAIClient {
  private static instance: LocalAIClient;

  static getInstance(): LocalAIClient {
    if (!this.instance) {
      this.instance = new LocalAIClient();
    }
    return this.instance;
  }

  /**
   * 发送聊天消息
   */
  async sendMessage(
    messages: ChatMessage[],
    settings: AISettings,
    useTools: boolean = true
  ): Promise<ChatResponse> {
    if (!settings.apiKey) {
      throw new Error('请先配置AI API密钥');
    }

    try {
      // 动态导入OpenAI，避免服务端渲染问题
      const { default: OpenAI } = await import('openai');
      
      const openai = new OpenAI({
        apiKey: settings.apiKey,
        baseURL: settings.apiEndpoint,
        dangerouslyAllowBrowser: true, // 允许在浏览器中使用
      });

      // 准备请求参数
      const completionParams: ChatCompletionCreateParams = {
        model: settings.modelName,
        messages: messages.map(msg => ({
          role: msg.role,
          content: msg.content,
        })),
        temperature: 0.7,
      };

      // 如果启用工具，添加MCP工具配置
      if (useTools) {
        completionParams.tools = mcpTools.map(tool => ({
          type: 'function',
          function: {
            name: tool.name,
            description: tool.description,
            parameters: tool.inputSchema,
          },
        }));
        completionParams.tool_choice = 'auto';
      }

      logger.info('发送AI请求', { useTools, toolsCount: mcpTools.length });

      // 调用AI服务
      const completion = await openai.chat.completions.create(completionParams);
      const responseMessage = completion.choices[0].message;

      // 处理工具调用
      if (responseMessage.tool_calls && responseMessage.tool_calls.length > 0) {
        logger.info('检测到工具调用', responseMessage.tool_calls);

        const toolResults = [];
        
        // 执行所有工具调用
        for (const toolCall of responseMessage.tool_calls) {
          const args = JSON.parse(toolCall.function.arguments);
          const result = await MCPToolExecutor.executeToolCall(
            toolCall.function.name,
            args
          );
          
          toolResults.push({
            role: 'tool' as const,
            content: JSON.stringify(result),
            tool_call_id: toolCall.id,
          });
        }        // 构建消息数组，处理OpenAI的复杂类型系统
        const finalMessages: unknown[] = [
          ...messages.map(msg => ({
            role: msg.role,
            content: msg.content,
          })),
          {
            role: 'assistant',
            content: responseMessage.content || '',
            tool_calls: responseMessage.tool_calls,
          },
          ...toolResults,
        ];        const finalCompletion = await openai.chat.completions.create({
          model: settings.modelName,
          messages: finalMessages as Parameters<typeof openai.chat.completions.create>[0]['messages'],
          temperature: 0.7,
        });

        const finalResponse = finalCompletion.choices[0].message;

        return {
          message: {
            role: 'assistant',
            content: finalResponse.content || '',
          },
          toolCalls: responseMessage.tool_calls.map(tc => ({
            id: tc.id,
            type: 'function',
            function: {
              name: tc.function.name,
              arguments: tc.function.arguments,
            },
          })),
          hasToolUse: true,
        };
      }

      // 没有工具调用的普通响应
      return {
        message: {
          role: 'assistant',
          content: responseMessage.content || '',
        },
        hasToolUse: false,
      };

    } catch (error) {
      logger.error('AI请求失败', error);
      throw error;
    }
  }
}
