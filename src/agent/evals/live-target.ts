import { MemorySaver } from '@langchain/langgraph-checkpoint';
import type { AIModelSettings } from '@/lib/ai/defaults';
import { createAIChatModel } from '@/lib/ai/modelFactory';
import { Agent } from '../core/Agent';
import { ToolExecutor } from '../tools/executor';
import type { AgentEvalActual, AgentEvalTarget } from './types';

function readToolArguments(value: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(value);
    return typeof parsed === 'object' &&
      parsed !== null &&
      !Array.isArray(parsed)
      ? parsed
      : {};
  } catch {
    return {};
  }
}

/**
 * 使用真实 Graph、Prompt 和 Tools 运行评测，同时用内存 checkpoint 和
 * 无数据库知识检索隔离 bench，防止评测污染开发数据。
 */
export function createLiveAgentEvalTarget(
  settings: AIModelSettings
): AgentEvalTarget {
  const checkpointer = new MemorySaver();
  const agent = Agent.create({
    createModel: (modelSettings, options) =>
      createAIChatModel(modelSettings, { ...options, streaming: false }),
    createCheckpointer: () => checkpointer,
    createExecutor: (initialState) =>
      new ToolExecutor(initialState, {
        searchDocuments: async () => ({
          matches: [],
          disabled: true,
          reason: 'Golden bench disables database-backed knowledge search',
        }),
      }),
  });

  return {
    name: `${settings.providerId}/${settings.modelName}`,
    async run(goldenCase, context): Promise<AgentEvalActual> {
      const safeCaseId = goldenCase.id.replace(/[^A-Za-z0-9_-]/g, '-');
      const response = await agent.sendMessage(
        goldenCase.messages,
        settings,
        goldenCase.initialState,
        `eval-${safeCaseId}-${context.sampleIndex}`
      );

      return {
        response: response.message.content,
        toolCalls: (response.toolCalls ?? []).map((toolCall) => ({
          name: toolCall.function.name,
          arguments: readToolArguments(toolCall.function.arguments),
        })),
        operations: response.clientOperations ?? [],
        approvalRequired: response.approvalRequired === true,
      };
    },
  };
}
