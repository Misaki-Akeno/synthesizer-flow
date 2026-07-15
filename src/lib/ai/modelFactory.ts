import 'server-only';

import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import type { AIModelSettings } from './defaults';
import { getAIProvider } from './providers';

export interface CreateAIModelOptions {
  streaming?: boolean;
  temperature?: number;
}

/**
 * 根据提供商配置创建统一的 LangChain ChatModel。
 * Agent 只依赖 BaseChatModel，不感知供应商 SDK 的差异。
 */
export async function createAIChatModel(
  settings: AIModelSettings,
  options: CreateAIModelOptions = {}
): Promise<BaseChatModel> {
  const provider = getAIProvider(settings.providerId);
  const streaming = options.streaming ?? true;
  const temperature = options.temperature ?? 0;

  switch (provider.kind) {
    case 'anthropic': {
      const { ChatAnthropic } = await import('@langchain/anthropic');
      return new ChatAnthropic({
        apiKey: settings.apiKey,
        model: settings.modelName,
        streaming,
        temperature,
      });
    }
    case 'google': {
      const { ChatGoogleGenerativeAI } =
        await import('@langchain/google-genai');
      return new ChatGoogleGenerativeAI({
        apiKey: settings.apiKey,
        model: settings.modelName,
        streaming,
        temperature,
      });
    }
    case 'openrouter': {
      const { ChatOpenRouter } = await import('@langchain/openrouter');
      return new ChatOpenRouter({
        apiKey: settings.apiKey,
        model: settings.modelName,
        temperature,
        streamUsage: streaming,
        siteName: 'Synthesizer Flow',
      });
    }
    case 'openai':
    case 'openai-compatible': {
      const { ChatOpenAI } = await import('@langchain/openai');
      return new ChatOpenAI({
        apiKey: settings.apiKey,
        configuration: {
          baseURL: settings.apiEndpoint,
        },
        model: settings.modelName,
        streaming,
        temperature,
      });
    }
  }
}
