import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, AIMessage, SystemMessage, BaseMessage } from '@langchain/core/messages';
import { AISettings } from '@/store/settings';
import { createModuleLogger } from '@/lib/logger';
import { ChatMessage, ChatResponse, GraphStateSnapshot } from './types';
import { createGraph } from '../graph/workflow';
import { ToolExecutor } from '../tools/executor';
import { createTools } from '../tools/definitions';

const logger = createModuleLogger('Agent');

export class Agent {
  private static instance: Agent;

  static getInstance(): Agent {
    if (!this.instance) {
      this.instance = new Agent();
    }
    return this.instance;
  }

  async sendMessage(
    messages: ChatMessage[],
    settings: AISettings,
    initialState: GraphStateSnapshot,
    useTools: boolean = true,
  ): Promise<ChatResponse> {
    if (!settings.apiKey) {
      throw new Error('请先配置AI API密钥');
    }

    try {
      logger.info('Initializing Agent Request', { 
        model: settings.modelName, 
        useTools 
      });

      // Initialize Model
      const model = new ChatOpenAI({
        apiKey: settings.apiKey,
        configuration: {
          baseURL: settings.apiEndpoint,
        },
        modelName: settings.modelName,
        temperature: 0,
        streaming: false,
      });

      // Initialize Tool Executor and Graph
      // Even if useTools is false, we might want to initialize executor to ensure consistent behavior,
      // but if useTools is false, we pass empty tools?
      // Logic for useTools: if false, we don't bind tools.
      
      let graph;
      let executor;

      if (useTools) {
        executor = new ToolExecutor(initialState);
        const tools = createTools(executor);
        graph = createGraph(tools);
      } else {
        graph = createGraph([]);
      }

      // Convert messages to LangChain format
      const inputs = messages.map((msg) => {
        if (msg.role === 'user') {
          return new HumanMessage(msg.content);
        } else if (msg.role === 'assistant') {
          return new AIMessage(msg.content);
        } else if (msg.role === 'system') {
          // Note: The graph handles the main system prompt, but we preserve user-provided system messages if any
          return new SystemMessage(msg.content);
        }
        return new HumanMessage(msg.content);
      });

      // Invoke the Graph
      // We pass the model in the configurable config so the node can use it
      const config = {
        configurable: {
          model,
        }
      };

      const result = await graph.invoke({ messages: inputs }, config);
      const finalMessages = result.messages;
      const lastMessage = finalMessages[finalMessages.length - 1];
      
      if (!lastMessage) {
        throw new Error('No response from agent');
      }
      
      const responseContent = typeof lastMessage.content === 'string' 
        ? lastMessage.content 
        : JSON.stringify(lastMessage.content);

      // Find tool calls in the conversation history of this turn
      const allToolCalls = finalMessages
        .filter((m: BaseMessage) => m._getType() === 'ai' && (m as AIMessage).tool_calls && (m as AIMessage).tool_calls!.length > 0)
        .flatMap((m: BaseMessage) => ((m as AIMessage).tool_calls || []).map(tc => ({
          id: tc.id || 'unknown',
          type: 'function' as const,
          function: {
            name: tc.name,
            arguments: JSON.stringify(tc.args),
          },
        })));

      return {
        message: {
          role: 'assistant',
          content: responseContent,
        },
        toolCalls: allToolCalls.length > 0 ? allToolCalls : undefined,
        hasToolUse: allToolCalls.length > 0,
        clientOperations: executor ? executor.getOperations() : undefined
      };

    } catch (error) {
      logger.error('Agent Request Failed', error);
      throw error;
    }
  }
}
