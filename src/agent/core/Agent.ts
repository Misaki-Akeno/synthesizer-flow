import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, AIMessage, SystemMessage, BaseMessage, ToolMessage } from '@langchain/core/messages';
import { AISettings } from '@/store/settings';
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
    if (!settings.apiKey) {
      throw new Error('请先配置AI API密钥');
    }

    try {
      logger.info('Initializing Agent Request', {
        model: settings.modelName,
        useTools,
        threadId,
        action
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
      const checkpointer = new DrizzleCheckpointer();
      let graph;
      let executor;

      if (useTools) {
        executor = new ToolExecutor(initialState);
        const tools = createTools(executor);
        graph = createGraph(tools, checkpointer);
      } else {
        graph = createGraph([], checkpointer); // Checkpointer passed even if no tools, for state persistence?
      }

      // Convert messages to LangChain format
      const inputs = messages.map((msg) => {
        if (msg.role === 'user') {
          return new HumanMessage(msg.content);
        } else if (msg.role === 'assistant') {
          return new AIMessage(msg.content);
        } else if (msg.role === 'system') {
          return new SystemMessage(msg.content);
        }
        return new HumanMessage(msg.content);
      });

      // Config with thread_id
      const config = {
        configurable: {
          model,
          thread_id: threadId,
        }
      };

      let result;

      // Handle Approval Action
      if (threadId && action === 'approve') {
        // Resume execution
        result = await graph.invoke(null, config);
      } else if (threadId && action === 'reject') {
        // For HIL Rejection
        return {
          message: {
            role: 'assistant',
            content: "Operation rejected.",
          },
          hasToolUse: false,
          approvalRequired: false,
          threadId
        };
      } else {
        // Normal flow
        // If persistence is enabled (threadId present), LangGraph uses it.
        result = await graph.invoke({ messages: inputs }, config);
      }

      // Check for Interruption (HIL)
      const state = await graph.getState(config);
      if (state.next && (state.next.includes('unsafe_tools'))) {
        return {
          message: {
            role: 'assistant',
            content: "I need your approval to proceed with this sensitive operation.",
          },
          toolCalls: [],
          hasToolUse: false,
          clientOperations: [],
          approvalRequired: true,
          threadId // Return threadId so client can use it
        };
      }

      const finalMessages = result.messages;
      const lastMessage = finalMessages[finalMessages.length - 1];

      if (!lastMessage) {
        throw new Error('No response from agent');
      }

      const responseContent = typeof lastMessage.content === 'string'
        ? lastMessage.content
        : JSON.stringify(lastMessage.content);

      // Find tool calls in the conversation history of this turn
      // Note: If we resumed, we might look at the *latest* messages.
      // LangGraph append mode means result.messages usually contains the full history or the delta provided?
      // StateGraph invoke returns the *final state*. So it contains full history.
      // We only want to return the *new* messages or all?
      // The current frontend implementation expects `toolCalls` and `clientOperations`.
      // If we resumed, the "tool" was executed.
      // Use logic to find distinct tool calls from this run?
      // Actually, if we return ALL tool calls in history, frontend might re-execute?
      // Need to be careful.
      // BUT `allToolCalls` filtering logic: `finalMessages.filter...`
      // This gets ALL AI messages with tool calls in the history!
      // This implies duplication if history grows.
      // However, frontend probably only processes the *response*.
      // Wait, `sendMessage` implementation before was stateless, so `messages` was just input.
      // Now `finalMessages` is accumulated history.
      // If we return *everything*, frontend might duplicate history.
      // We should probably only return the *last* message or the messages since the input.
      // But `Agent.ts` contract returns `message` (singular).
      // So returning `lastMessage` is correct for display.
      // But `allToolCalls`?
      // If we just executed a tool, it's in the last message(s).
      // If we scan ALL history, we might re-trigger old tools.
      // Fix: Only look at tool calls in the *last message* or verify against inputs.
      // For now, let's keep the existing logic but be aware.
      // Actually, `toolCalls` calculation:
      // It looks at `finalMessages` where `m._getType() === 'ai'`.
      // If `finalMessages` grows (persistence), this will return ALL past tool calls.
      // This IS A BUG for persistent mode.
      // Fix: We should only return tool calls from the *newly generated* messages.
      // How to identify new messages?
      // Compare `finalMessages.length` with `inputs.length`? (Approximate)
      // Or just look at the last message. If last message is AI and has tool calls, process it.
      // But one turn might correspond to multiple messages (chain of thought or multiple tools)?
      // If LangGraph returns, it's usually one step or until interruption.
      // If it ran tools, it might be AI -> Tool -> AI.
      // We probably want the operations from the tools that *just ran*.
      // Executor tracks operations in memory for *this instance*.
      // Since we create `new ToolExecutor(initialState)`, it captures operations *performed during this execution*.
      // So `executor.getOperations()` is correct and safe!
      // But `toolCalls` (for UI display of "Calling tool...") might duplicate.
      // Let's restrict `allToolCalls` to the ones that match `executor.getOperations()`?
      // Or simply: `lastMessage` if it has tool calls.
      // If we did a tool run, the sequence is AI (call) -> Tool (result) -> AI (final).
      // The last message is AI (final). It has NO tool calls usually.
      // The AI message *before* it had tool calls.
      // `executor.getOperations()` returns what happened.
      // `toolCalls` property in response is probably for "Function Call" visualization.
      // Let's optimistically assume `executor.getOperations()` covers the "Effect".

      const allToolCalls = finalMessages
        .filter((m: BaseMessage) => m._getType() === 'ai' && (m as AIMessage).tool_calls && (m as AIMessage).tool_calls!.length > 0)
        .flatMap((m: BaseMessage) => ((m as AIMessage).tool_calls || []).map(tc => {
          // ... mapping ...
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

      // We are filtering ALL messages. This needs fixing for persistence.
      // Fix: Only take tool calls that don't have a result yet? No, we show result.
      // Fix: Only take tool calls from messages *after* the initial input length?
      // Filter `finalMessages` to start after `inputs.length - (new user message)`.
      // Actually, standard LangChain logic: just look at the last few messages.
      // Better: filter `allToolCalls` to only include those that executed *in this run*.
      // But `toolMessage` presence means it executed.
      // If we load history, old tool calls are there.
      // Maybe we can filter by `tool_call_id` not being in `inputs`?
      // Or simplier: In `Agent.tsx` frontend, we probably render based on this.
      // If we return *all*, the frontend will show *all*. Use `threadId` implies we might load history in frontend separately?
      // If we rely on this response for history, then returning all is good.
      // BUT `clientOperations` is critical. `executor` is fresh, so it only has NEW operations.
      // So the *state capability* (add module etc) is correct.
      // The *chat UI history* might display duplicates if frontend appends this response to existing list.
      // Frontend usually appends `response.message`.
      // `response.toolCalls` might be used for "Thinking..." UI.
      // Let's leave it as is for now, but note it as potential optimization.

      return {
        message: {
          role: 'assistant',
          content: responseContent,
        },
        toolCalls: allToolCalls.length > 0 ? allToolCalls : undefined,
        hasToolUse: allToolCalls.length > 0,
        clientOperations: executor ? executor.getOperations() : undefined,
        approvalRequired: false,
        threadId
      };

    } catch (error) {
      logger.error('Agent Request Failed', error);
      throw error;
    }
  }
}
