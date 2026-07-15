import { SystemMessage } from '@langchain/core/messages';
import { StateGraph, START, END } from '@langchain/langgraph';
import { SequentialToolNode } from './sequentialToolNode';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { RunnableConfig } from '@langchain/core/runnables';
import { AgentState } from './state';
import { getSystemPrompt } from '../prompts/system';
import { BaseCheckpointSaver } from '@langchain/langgraph-checkpoint';
import {
  UNSAFE_TOOL_NAMES,
  type AgentTool,
  type UnsafeToolName,
} from '../tools/definitions';

function isUnsafeToolName(name: string): name is UnsafeToolName {
  return (UNSAFE_TOOL_NAMES as readonly string[]).includes(name);
}

type ToolBindableChatModel = BaseChatModel & {
  bindTools: NonNullable<BaseChatModel['bindTools']>;
};

function isConfiguredModel(value: unknown): value is ToolBindableChatModel {
  return (
    typeof value === 'object' &&
    value !== null &&
    'bindTools' in value &&
    typeof value.bindTools === 'function'
  );
}

function getConfiguredModel(
  config?: RunnableConfig
): ToolBindableChatModel | undefined {
  const configurable = config?.configurable;
  if (
    typeof configurable !== 'object' ||
    configurable === null ||
    !('model' in configurable)
  ) {
    return undefined;
  }

  return isConfiguredModel(configurable.model) ? configurable.model : undefined;
}

export function createGraph(
  tools: AgentTool[],
  checkpointer?: BaseCheckpointSaver
) {
  const safeTools = tools.filter((t) => !isUnsafeToolName(t.name));
  const unsafeTools = tools.filter((t) => isUnsafeToolName(t.name));

  const safeToolNodeInstance = new SequentialToolNode(safeTools);
  const unsafeToolNodeInstance = new SequentialToolNode(unsafeTools);

  const safeToolNode = (
    state: typeof AgentState.State,
    config?: RunnableConfig
  ) => safeToolNodeInstance.invoke(state, config);
  const unsafeToolNode = (
    state: typeof AgentState.State,
    config?: RunnableConfig
  ) => unsafeToolNodeInstance.invoke(state, config);

  // Define the model node logic
  const callModel = async (
    state: typeof AgentState.State,
    config?: RunnableConfig
  ) => {
    const { messages } = state;
    const model = getConfiguredModel(config);

    if (!model) {
      throw new Error('Model not configured');
    }

    // Bind tools to the model
    const modelWithTools = model.bindTools(tools);

    // Get system prompt
    const systemPrompt = getSystemPrompt();
    const systemMessage = new SystemMessage(systemPrompt);

    let messagesWithSystem = messages;
    if (messages.length === 0 || messages[0]._getType() !== 'system') {
      messagesWithSystem = [systemMessage, ...messages];
    } else {
      messagesWithSystem = [
        systemMessage,
        ...messages.filter((m) => m._getType() !== 'system'),
      ];
    }

    const response = await modelWithTools.invoke(messagesWithSystem);
    return { messages: [response] };
  };

  // Define the conditional edge
  const shouldContinue = (state: typeof AgentState.State) => {
    const { messages } = state;
    const lastMessage = messages[messages.length - 1];

    if (
      lastMessage &&
      'tool_calls' in lastMessage &&
      Array.isArray(lastMessage.tool_calls) &&
      lastMessage.tool_calls.length > 0
    ) {
      // Check if any tool call is unsafe
      const hasUnsafe = lastMessage.tool_calls.some((tc) =>
        UNSAFE_TOOL_NAMES.includes(tc.name)
      );
      if (hasUnsafe) {
        return 'unsafe_tools';
      }
      return 'safe_tools';
    }
    return END;
  };

  // Compose the graph
  const workflow = new StateGraph(AgentState)
    .addNode('agent', callModel)
    .addNode('safe_tools', safeToolNode)
    .addNode('unsafe_tools', unsafeToolNode)
    .addEdge(START, 'agent')
    .addConditionalEdges('agent', shouldContinue)
    .addEdge('safe_tools', 'agent')
    .addEdge('unsafe_tools', 'agent');

  return workflow.compile({
    checkpointer: checkpointer,
    interruptBefore: unsafeTools.length > 0 ? ['unsafe_tools'] : undefined,
  });
}
