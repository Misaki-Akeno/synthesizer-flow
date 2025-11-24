import { ChatOpenAI } from '@langchain/openai';
import {
  HumanMessage,
  AIMessage,
  SystemMessage,
  BaseMessage,
  ToolMessage,
} from '@langchain/core/messages';
import { tools } from './langchainTools';
import { AISettings } from '@/store/settings';
import { createModuleLogger } from '@/lib/logger';
import { ChatMessage, ChatResponse, ToolCall } from './client';

const logger = createModuleLogger('LangChainClient');

export class LangChainClient {
  private static instance: LangChainClient;

  static getInstance(): LangChainClient {
    if (!this.instance) {
      this.instance = new LangChainClient();
    }
    return this.instance;
  }

  async sendMessage(
    messages: ChatMessage[],
    settings: AISettings,
    useTools: boolean = true
  ): Promise<ChatResponse> {
    if (!settings.apiKey) {
      throw new Error('请先配置AI API密钥');
    }

    try {
      logger.info('初始化 LangChain OpenAI 客户端', { 
        model: settings.modelName, 
        endpoint: settings.apiEndpoint,
        hasKey: !!settings.apiKey 
      });

      const llm = new ChatOpenAI({
        apiKey: settings.apiKey,
        configuration: {
          baseURL: settings.apiEndpoint,
        },
        modelName: settings.modelName,
        temperature: 0.7,
        streaming: false,
      });

      // 绑定工具
      const currentTools = useTools ? tools : [];
      const llmWithTools = currentTools.length > 0 ? llm.bindTools(currentTools) : llm;

      // 转换消息格式
      const langChainMessages: BaseMessage[] = messages.map((msg) => {
        if (msg.role === 'user') {
          return new HumanMessage(msg.content);
        } else if (msg.role === 'assistant') {
          return new AIMessage(msg.content);
        } else if (msg.role === 'system') {
          return new SystemMessage(msg.content);
        }
        return new HumanMessage(msg.content);
      });

      logger.info('开始执行 LangChain Loop', { useTools });

      let finalResponse: AIMessage | null = null;
      const allToolCalls: ToolCall[] = [];
      let iterations = 0;
      const MAX_ITERATIONS = 10; // 防止无限循环

      while (iterations < MAX_ITERATIONS) {
        // 调用 LLM
        const response = await llmWithTools.invoke(langChainMessages);
        finalResponse = response;

        // 检查是否有工具调用
        if (response.tool_calls && response.tool_calls.length > 0) {
          logger.info(`迭代 ${iterations + 1}: 检测到 ${response.tool_calls.length} 个工具调用`);
          
          // 将 AI 的回复（包含工具调用请求）加入历史
          langChainMessages.push(response);

          // 执行所有工具
          for (const call of response.tool_calls) {
            // 记录工具调用信息以便返回
            allToolCalls.push({
              id: call.id || 'unknown',
              type: 'function',
              function: {
                name: call.name,
                arguments: JSON.stringify(call.args),
              },
            });

            // 查找并执行工具
            const tool = currentTools.find((t) => t.name === call.name);
            let toolOutput = 'Tool not found';
            
            if (tool) {
              try {
                logger.info(`执行工具: ${tool.name}`, call.args);
                const result = await tool.invoke(call.args);
                toolOutput = typeof result === 'string' ? result : JSON.stringify(result);
              } catch (err) {
                const errMsg = err instanceof Error ? err.message : 'Unknown error';
                logger.error(`工具 ${tool.name} 执行失败`, err);
                toolOutput = `Error executing tool: ${errMsg}`;
              }
            }

            // 将工具执行结果加入历史
            langChainMessages.push(
              new ToolMessage({
                tool_call_id: call.id!,
                content: toolOutput,
                name: call.name,
              })
            );
          }
          
          // 继续下一轮循环，将工具结果传回给 LLM
          iterations++;
        } else {
          // 没有工具调用，说明是最终回复
          logger.info('收到最终回复，结束循环');
          break;
        }
      }

      if (!finalResponse) {
        throw new Error('未收到 AI 响应');
      }

      return {
        message: {
          role: 'assistant',
          content: typeof finalResponse.content === 'string' ? finalResponse.content : JSON.stringify(finalResponse.content),
        },
        toolCalls: allToolCalls.length > 0 ? allToolCalls : undefined,
        hasToolUse: allToolCalls.length > 0,
      };
    } catch (error) {
      logger.error('LangChain 请求失败', error);
      throw error;
    }
  }
}
