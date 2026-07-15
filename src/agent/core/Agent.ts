import {
  HumanMessage,
  AIMessage,
  SystemMessage,
  BaseMessage,
  ToolMessage,
} from '@langchain/core/messages';
import type { AISettings } from '@/store/settings-store';
import { createModuleLogger } from '@/lib/logger';
import {
  ChatMessage,
  ChatResponse,
  GraphStateSnapshot,
  ToolCall,
} from './types';
import { createGraph } from '../graph/workflow';
import { ToolExecutor } from '../tools/executor';
import { createAgentToolRegistry } from '../tools/definitions';
import { createAIChatModel } from '@/lib/ai/modelFactory';
import type { BaseCheckpointSaver } from '@langchain/langgraph-checkpoint';

const logger = createModuleLogger('Agent');

export interface AgentDependencies {
  createModel: typeof createAIChatModel;
  createCheckpointer: () => BaseCheckpointSaver | Promise<BaseCheckpointSaver>;
  createExecutor: (initialState: GraphStateSnapshot) => ToolExecutor;
}

const DEFAULT_AGENT_DEPENDENCIES: AgentDependencies = {
  createModel: createAIChatModel,
  createCheckpointer: async () => {
    const { DrizzleCheckpointer } = await import('../drizzleCheckpointer');
    return new DrizzleCheckpointer();
  },
  createExecutor: (initialState) => new ToolExecutor(initialState),
};

function collectToolCalls(
  allMessages: BaseMessage[],
  scopedMessages: BaseMessage[]
): ToolCall[] {
  return scopedMessages
    .filter(
      (message) =>
        message._getType() === 'ai' &&
        (message as AIMessage).tool_calls &&
        (message as AIMessage).tool_calls!.length > 0
    )
    .flatMap((message) =>
      ((message as AIMessage).tool_calls || []).map((toolCall) => {
        const toolMessage = allMessages.find(
          (candidate) =>
            candidate._getType() === 'tool' &&
            (candidate as ToolMessage).tool_call_id === toolCall.id
        ) as ToolMessage | undefined;

        return {
          id: toolCall.id || 'unknown',
          type: 'function' as const,
          function: {
            name: toolCall.name,
            arguments: JSON.stringify(toolCall.args),
          },
          result: toolMessage
            ? typeof toolMessage.content === 'string'
              ? toolMessage.content
              : JSON.stringify(toolMessage.content)
            : undefined,
        };
      })
    );
}

export class Agent {
  private static instance: Agent;

  private constructor(private readonly dependencies: AgentDependencies) {}

  static getInstance(): Agent {
    if (!this.instance) {
      this.instance = new Agent(DEFAULT_AGENT_DEPENDENCIES);
    }
    return this.instance;
  }

  /** 创建隔离运行时，供评测或集成测试注入内存依赖。 */
  static create(overrides: Partial<AgentDependencies> = {}): Agent {
    return new Agent({ ...DEFAULT_AGENT_DEPENDENCIES, ...overrides });
  }

  async sendMessage(
    messages: ChatMessage[],
    settings: AISettings,
    initialState: GraphStateSnapshot,
    threadId?: string,
    action?: 'approve' | 'reject',
    checkpointThreadId?: string
  ): Promise<ChatResponse> {
    const generator = this.streamMessage(
      messages,
      settings,
      initialState,
      threadId,
      action,
      checkpointThreadId
    );
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
    threadId?: string,
    action?: 'approve' | 'reject',
    checkpointThreadId?: string
  ): AsyncGenerator<
    | { type: 'chunk'; content: string }
    | { type: 'done'; response: ChatResponse }
  > {
    if (!settings.apiKey) {
      throw new Error('请先配置AI API密钥');
    }

    try {
      logger.info('Initializing Agent Stream Request', {
        provider: settings.providerId,
        model: settings.modelName,
        threadId,
        action,
      });

      // 通过统一工厂创建模型，Agent 不感知具体提供商 SDK。
      const model = await this.dependencies.createModel(settings, {
        temperature: 0,
        streaming: true,
      });

      // Initialize Tool Executor and Graph
      const checkpointer = await this.dependencies.createCheckpointer();
      const executor = this.dependencies.createExecutor(initialState);
      const toolRegistry = createAgentToolRegistry(executor);
      const graph = createGraph(toolRegistry, checkpointer);

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
          thread_id: checkpointThreadId ?? threadId,
        },
      };

      // Handle Approval Action
      let stream;
      if (threadId && action === 'approve') {
        stream = graph.streamEvents(null, { ...config, version: 'v2' });
      } else if (threadId && action === 'reject') {
        const rejectedCheckpointThreadId = config.configurable.thread_id;
        if (rejectedCheckpointThreadId) {
          await checkpointer.deleteThread(rejectedCheckpointThreadId);
        }
        yield {
          type: 'done',
          response: {
            message: { role: 'assistant', content: '' },
            hasToolUse: false,
            approvalRequired: false,
            threadId,
          },
        };
        return;
      } else {
        stream = graph.streamEvents(
          { messages: inputs },
          { ...config, version: 'v2' }
        );
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
        next: state.next,
      });

      // Get messages added in this turn
      const initialMessageCount = inputs.length;
      const finalMessages = state.values.messages;
      const newMessages = finalMessages.slice(initialMessageCount);
      const allToolCalls = collectToolCalls(finalMessages, newMessages);

      if (state.next && state.next.includes('unsafe_tools')) {
        yield {
          type: 'done',
          response: {
            message: {
              role: 'assistant',
              content: '',
            },
            toolCalls: allToolCalls.length > 0 ? allToolCalls : undefined,
            hasToolUse: allToolCalls.length > 0,
            clientOperations: [],
            approvalRequired: true,
            threadId,
          },
        };
        return;
      }

      // Final result extraction
      const lastMessage = finalMessages[finalMessages.length - 1];

      if (!lastMessage) {
        throw new Error('No response from agent');
      }

      const responseContent =
        typeof lastMessage.content === 'string'
          ? lastMessage.content
          : JSON.stringify(lastMessage.content);

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
          threadId,
        },
      };
    } catch (error) {
      logger.error('Agent Stream Request Failed', error);
      throw error;
    }
  }
}
