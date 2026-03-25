import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, AIMessage, SystemMessage, BaseMessage, ToolMessage } from '@langchain/core/messages';
import { AISettings } from '@/store/settings-store';
import { createModuleLogger } from '@/lib/logger';
import { ChatMessage, ChatResponse, GraphStateSnapshot } from './types';
import { createGraph } from '../graph/workflow';
import { ToolExecutor } from '../tools/executor';
import { createTools } from '../tools/definitions';
import { DrizzleCheckpointer } from '../drizzleCheckpointer';

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
    threadId?: string,
    action?: 'approve' | 'reject'
  ): Promise<ChatResponse> {
    const generator = this.streamMessage(messages, settings, initialState, useTools, threadId, action);
    let finalResponse: ChatResponse | undefined;

    for await (const part of generator) {
      if (part.type === 'done') {
        finalResponse = part.response;
      }
    }

    if (!finalResponse) {
      throw new Error('Agent failed to provide a response');
    }

    return finalResponse;
  }

  async *streamMessage(
    messages: ChatMessage[],
    settings: AISettings,
    initialState: GraphStateSnapshot,
    useTools: boolean = true,
    threadId?: string,
    action?: 'approve' | 'reject'
  ): AsyncGenerator<{ type: 'chunk'; content: string } | { type: 'done'; response: ChatResponse }> {
    if (!settings.apiKey) {
      throw new Error('请先配置AI API密钥');
    }

    try {
      logger.info('Initializing Agent Stream Request', {
        model: settings.modelName,
        useTools,
        threadId,
        action
      });

      // Initialize Model with streaming enabled
      const model = new ChatOpenAI({
        apiKey: settings.apiKey,
        configuration: {
          baseURL: settings.apiEndpoint,
        },
        modelName: settings.modelName,
        temperature: 0,
        streaming: true,
      });

      // Initialize Tool Executor and Graph
      const checkpointer = new DrizzleCheckpointer();
      let graph: ReturnType<typeof createGraph>;
      let executor: ToolExecutor | undefined;

      if (useTools) {
        executor = new ToolExecutor(initialState);
        const tools = createTools(executor);
        graph = createGraph(tools, checkpointer);
      } else {
        graph = createGraph([], checkpointer);
      }

      // Convert messages to LangChain format
      const inputs = messages.map((msg) => {
        if (msg.role === 'user') return new HumanMessage(msg.content);
        if (msg.role === 'assistant') return new AIMessage(msg.content);
        if (msg.role === 'system') return new SystemMessage(msg.content);
        return new HumanMessage(msg.content);
      });

      // Config with thread_id
      const config = {
        configurable: {
          model,
          thread_id: threadId,
        }
      };

      // Handle Approval Action
      let stream;
      if (threadId && action === 'approve') {
        stream = graph.streamEvents(null, { ...config, version: 'v2' });
      } else if (threadId && action === 'reject') {
        yield {
          type: 'done',
          response: {
            message: { role: 'assistant', content: "Operation rejected." },
            hasToolUse: false,
            approvalRequired: false,
            threadId
          }
        };
        return;
      } else {
        stream = graph.streamEvents({ messages: inputs }, { ...config, version: 'v2' });
      }

      // Iterate through the stream events
      logger.info('Starting Stream Iteration', { threadId });
      for await (const event of stream) {
        // Stream text chunks from the chat model
        if (event.event === 'on_chat_model_stream') {
          const chunk = event.data.chunk;
          if (chunk.content && typeof chunk.content === 'string') {
            yield { type: 'chunk', content: chunk.content };
          }
        }
      }
      logger.info('Stream Iteration Completed', { threadId });

      // Check for Interruption (HIL)
      const state = await graph.getState(config);
      logger.info('Retrieved Graph State', { 
        threadId, 
        hasNext: !!state.next,
        next: state.next
      });
      
      // Get messages added in this turn
      const initialMessageCount = inputs.length;
      const finalMessages = state.values.messages;
      const newMessages = finalMessages.slice(initialMessageCount);

      if (state.next && (state.next.includes('unsafe_tools'))) {
        yield {
          type: 'done',
          response: {
            message: {
              role: 'assistant',
              content: "I need your approval to proceed with this sensitive operation.",
            },
            toolCalls: [],
            hasToolUse: false,
            clientOperations: [],
            approvalRequired: true,
            threadId
          }
        };
        return;
      }

      // Final result extraction
      const lastMessage = finalMessages[finalMessages.length - 1];

      if (!lastMessage) {
        throw new Error('No response from agent');
      }

      const responseContent = typeof lastMessage.content === 'string'
        ? lastMessage.content
        : JSON.stringify(lastMessage.content);

      const allToolCalls = newMessages
        .filter((m: BaseMessage) => m._getType() === 'ai' && (m as AIMessage).tool_calls && (m as AIMessage).tool_calls!.length > 0)
        .flatMap((m: BaseMessage) => ((m as AIMessage).tool_calls || []).map(tc => {
          const toolMessage = finalMessages.find((msg: BaseMessage) =>
            msg._getType() === 'tool' && (msg as ToolMessage).tool_call_id === tc.id
          ) as ToolMessage | undefined;

          return {
            id: tc.id || 'unknown',
            type: 'function' as const,
            function: { name: tc.name, arguments: JSON.stringify(tc.args) },
            result: toolMessage ? (typeof toolMessage.content === 'string' ? toolMessage.content : JSON.stringify(toolMessage.content)) : undefined
          };
        }));

      yield {
        type: 'done',
        response: {
          message: {
            role: 'assistant',
            content: responseContent,
          },
          toolCalls: allToolCalls.length > 0 ? allToolCalls : undefined,
          hasToolUse: allToolCalls.length > 0,
          clientOperations: executor ? executor.getOperations() : undefined,
          approvalRequired: false,
          threadId
        }
      };

    } catch (error) {
      logger.error('Agent Stream Request Failed', error);
      throw error;
    }
  }
}
