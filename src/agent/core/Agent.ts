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
  AgentExecutionContext,
  GraphStateSnapshot,
  ToolCall,
} from './types';
import { createGraph } from '../graph/workflow';
import { ToolExecutor } from '../tools/executor';
import { createAgentToolRegistry } from '../tools/definitions';
import { AgentSkillSession } from '../skills';
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

function toLangChainMessage(message: ChatMessage): BaseMessage {
  const fields = message.id ? { id: message.id } : {};
  if (message.role === 'user')
    return new HumanMessage({ content: message.content, ...fields });
  if (message.role === 'assistant')
    return new AIMessage({ content: message.content, ...fields });
  if (message.role === 'system')
    return new SystemMessage({ content: message.content, ...fields });
  return new HumanMessage({ content: message.content, ...fields });
}

/**
 * 旧版客户端没有消息 ID。为其保留一次兼容去重：按角色和内容逐一消耗已
 * checkpoint 的消息。新版使用稳定 ID，因此重试不会再次 append。
 */
function getUnpersistedInputs(
  inputs: BaseMessage[],
  persisted: BaseMessage[]
): BaseMessage[] {
  const knownIds = new Set(
    persisted
      .map((message) => message.id)
      .filter((id): id is string => Boolean(id))
  );
  const legacyCounts = new Map<string, number>();
  persisted.forEach((message) => {
    if (message.id) return;
    const key = `${message._getType()}\u0000${JSON.stringify(message.content)}`;
    legacyCounts.set(key, (legacyCounts.get(key) ?? 0) + 1);
  });

  return inputs.filter((message) => {
    if (message.id) return !knownIds.has(message.id);
    const key = `${message._getType()}\u0000${JSON.stringify(message.content)}`;
    const remaining = legacyCounts.get(key) ?? 0;
    if (remaining === 0) return true;
    legacyCounts.set(key, remaining - 1);
    return false;
  });
}

function getCurrentTurnMessages(messages: BaseMessage[]): BaseMessage[] {
  let latestHumanIndex = -1;
  messages.forEach((message, index) => {
    if (message._getType() === 'human') latestHumanIndex = index;
  });
  return latestHumanIndex >= 0
    ? messages.slice(latestHumanIndex + 1)
    : messages;
}

/** 旧 checkpoint 尚未保存 execution 时，仍可从已记录的 tool call 恢复 Skill。 */
function restoreLegacySkillSession(
  skillSession: AgentSkillSession,
  messages: BaseMessage[]
): void {
  const skillIds = messages.flatMap((message) => {
    if (message._getType() !== 'ai') return [];
    return ((message as AIMessage).tool_calls ?? []).flatMap((call) =>
      call.name === 'skill_load' && typeof call.args?.skillId === 'string'
        ? [call.args.skillId]
        : []
    );
  });
  skillSession.restore(skillIds);
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

      // 先读取 checkpoint。审批恢复必须从服务端影子画布继续，而不能依赖
      // 早已失效的浏览器快照；普通新回合则以本轮浏览器快照为准。
      const checkpointer = await this.dependencies.createCheckpointer();
      const config = {
        configurable: {
          model,
          thread_id: checkpointThreadId ?? threadId,
        },
      };
      let executor = this.dependencies.createExecutor(initialState);
      let skillSession = new AgentSkillSession();
      let pendingOperations: AgentExecutionContext['pendingOperations'] = [];
      let toolRegistry = createAgentToolRegistry(executor, skillSession);
      let graph = createGraph(toolRegistry, checkpointer, () => ({
        shadowState: executor.getShadowState(),
        pendingOperations: [...pendingOperations, ...executor.getOperations()],
        loadedSkillIds: skillSession.getLoadedSkillIds(),
      }));

      const checkpointState = await graph.getState(config);
      const restoredExecution = checkpointState.values.execution as
        | AgentExecutionContext
        | undefined;

      if (action === 'approve' && restoredExecution) {
        executor = this.dependencies.createExecutor(
          restoredExecution.shadowState
        );
        skillSession = new AgentSkillSession();
        skillSession.restore(restoredExecution.loadedSkillIds);
        pendingOperations = restoredExecution.pendingOperations;
        toolRegistry = createAgentToolRegistry(executor, skillSession);
        graph = createGraph(toolRegistry, checkpointer, () => ({
          shadowState: executor.getShadowState(),
          pendingOperations: [
            ...pendingOperations,
            ...executor.getOperations(),
          ],
          loadedSkillIds: skillSession.getLoadedSkillIds(),
        }));
      } else if (action === 'approve') {
        // 没有 execution 字段的历史 checkpoint 仍能执行其原有工具调用。
        // 其中已加载的 Skill 从消息轨迹恢复，避免因升级导致 module_add 失败。
        restoreLegacySkillSession(
          skillSession,
          checkpointState.values.messages ?? []
        );
        toolRegistry = createAgentToolRegistry(executor, skillSession);
        graph = createGraph(toolRegistry, checkpointer, () => ({
          shadowState: executor.getShadowState(),
          pendingOperations: executor.getOperations(),
          loadedSkillIds: skillSession.getLoadedSkillIds(),
        }));
      }

      // 仅向 concat reducer 交付 checkpoint 里尚不存在的消息。界面正常情况
      // 只提交本轮用户消息；此处仍支持旧 checkpoint/恢复记录的完整历史。
      const inputs = getUnpersistedInputs(
        messages.map(toLangChainMessage),
        checkpointState.values.messages ?? []
      );

      // 同一稳定 ID 的网络重试不应触发一次新的模型推理或再次写入消息。
      if (
        !action &&
        inputs.length === 0 &&
        checkpointState.values.messages?.length
      ) {
        const existingMessages = checkpointState.values.messages;
        const lastMessage = existingMessages[existingMessages.length - 1];
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
              id: lastMessage.id,
            },
            hasToolUse: false,
            clientOperations: [],
            approvalRequired: false,
            threadId,
          },
        };
        return;
      }

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

      const finalMessages = state.values.messages;
      const currentTurnMessages = getCurrentTurnMessages(finalMessages);
      const allToolCalls = collectToolCalls(finalMessages, currentTurnMessages);
      const execution = state.values.execution as
        | AgentExecutionContext
        | undefined;

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
            // 安全工具已在服务端影子状态中完成，但要和危险操作一起等批准后
            // 才应用到真实画布，避免用户拒绝时出现半完成修改。
            clientOperations:
              execution?.pendingOperations ?? executor.getOperations(),
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
            id: lastMessage.id,
          },
          toolCalls: allToolCalls.length > 0 ? allToolCalls : undefined,
          hasToolUse: allToolCalls.length > 0,
          clientOperations:
            execution?.pendingOperations ?? executor.getOperations(),
          approvalRequired: false,
          threadId,
        },
      };
      // 已完成的操作已经随 response 交给客户端，不应出现在下一回合或已结束
      // 的 checkpoint 中。中断审批分支提前 return，保留 pendingOperations。
      await graph.updateState(config, {
        execution: {
          shadowState: executor.getShadowState(),
          pendingOperations: [],
          loadedSkillIds: skillSession.getLoadedSkillIds(),
        },
      });
    } catch (error) {
      logger.error('Agent Stream Request Failed', error);
      throw error;
    }
  }
}
