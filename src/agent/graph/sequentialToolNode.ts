import { AIMessage, ToolMessage } from '@langchain/core/messages';
import { RunnableConfig } from '@langchain/core/runnables';
import { AgentState } from './state';
import { StructuredTool } from '@langchain/core/tools';
import { normalizeLegacyToolCall } from '../tools/legacy';

export class SequentialToolNode {
  tools: StructuredTool[];

  constructor(tools: StructuredTool[]) {
    this.tools = tools;
  }

  async invoke(state: typeof AgentState.State, config?: RunnableConfig) {
    const { messages } = state;
    const lastMessage = messages[messages.length - 1] as AIMessage;

    if (!lastMessage.tool_calls || lastMessage.tool_calls.length === 0) {
      return { messages: [] };
    }

    const toolMessages: ToolMessage[] = [];

    // 串行执行，确保前一个工具产生的画布状态可供下一个工具读取。
    for (const toolCall of lastMessage.tool_calls) {
      const normalizedCall = normalizeLegacyToolCall(
        toolCall.name,
        toolCall.args
      );
      const tool = this.tools.find((t) => t.name === normalizedCall.name);

      if (!tool) {
        console.error(`Tool ${toolCall.name} not found`);
        toolMessages.push(
          new ToolMessage({
            tool_call_id: toolCall.id!,
            content: `Error: Tool ${toolCall.name} not found`,
          })
        );
        continue;
      }

      try {
        // Execute the tool
        // We pass the config down, though most simple tools might not use it
        const output = await tool.invoke(normalizedCall.args, config);

        toolMessages.push(
          new ToolMessage({
            tool_call_id: toolCall.id!,
            content:
              typeof output === 'string' ? output : JSON.stringify(output),
            name: toolCall.name,
          })
        );
      } catch (error) {
        console.error(`Error executing tool ${toolCall.name}:`, error);
        toolMessages.push(
          new ToolMessage({
            tool_call_id: toolCall.id!,
            content: `Error execution tool ${toolCall.name}: ${error instanceof Error ? error.message : String(error)}`,
            name: toolCall.name,
          })
        );
      }
    }

    return { messages: toolMessages };
  }
}
