import { SystemMessage } from '@langchain/core/messages';
import { StateGraph, START, END } from '@langchain/langgraph';
import { ToolNode } from '@langchain/langgraph/prebuilt';
import { ChatOpenAI } from '@langchain/openai';
import { RunnableConfig } from '@langchain/core/runnables';
import { AgentState } from './state';
import { getSystemPrompt } from '../prompts/system';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createGraph(tools: any[]) {
  // Define the tool node
  const toolNode = new ToolNode(tools);

  // Define the model node logic
  const callModel = async (state: typeof AgentState.State, config?: RunnableConfig) => {
    const { messages } = state;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const model = (config?.configurable as any)?.model as ChatOpenAI;

    if (!model) {
      throw new Error('Model not configured');
    }

    // Bind tools to the model
    const modelWithTools = model.bindTools(tools);

    // Get system prompt
    // Check if there is already a system message at the beginning
    const systemPrompt = getSystemPrompt(true);
    const systemMessage = new SystemMessage(systemPrompt);

    let messagesWithSystem = messages;
    if (messages.length === 0 || messages[0]._getType() !== 'system') {
      messagesWithSystem = [systemMessage, ...messages];
    } else {
      messagesWithSystem = [systemMessage, ...messages.filter(m => m._getType() !== 'system')];
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
      return 'tools';
    }
    return END;
  };

  // Compose the graph
  const workflow = new StateGraph(AgentState)
    .addNode('agent', callModel)
    .addNode('tools', toolNode)
    .addEdge(START, 'agent')
    .addConditionalEdges('agent', shouldContinue)
    .addEdge('tools', 'agent');

  return workflow.compile();
}
