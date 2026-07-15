/**
 * Agent 支持的模型提供商标识。
 */
export const AI_PROVIDER_IDS = [
  'modelscope',
  'deepseek',
  'openai',
  'anthropic',
  'google',
  'openrouter',
  'custom',
] as const;

export type AIProviderId = (typeof AI_PROVIDER_IDS)[number];

export type AIProviderKind =
  | 'openai-compatible'
  | 'openai'
  | 'anthropic'
  | 'google'
  | 'openrouter';

export interface AIProviderModel {
  id: string;
  label: string;
  profile: 'balanced' | 'fast' | 'capable';
}

export interface AIProviderDefinition {
  id: AIProviderId;
  name: string;
  kind: AIProviderKind;
  defaultModel: string;
  apiEndpoint: string;
  allowsCustomEndpoint: boolean;
  models: readonly AIProviderModel[];
  consoleUrl: string;
}

export const DEFAULT_AI_PROVIDER_ID: AIProviderId = 'modelscope';

export const AI_PROVIDERS: Record<AIProviderId, AIProviderDefinition> = {
  modelscope: {
    id: 'modelscope',
    name: 'ModelScope',
    kind: 'openai-compatible',
    defaultModel: 'Qwen/Qwen3.5-35B-A3B',
    apiEndpoint: 'https://api-inference.modelscope.cn/v1',
    allowsCustomEndpoint: false,
    models: [
      {
        id: 'Qwen/Qwen3.5-35B-A3B',
        label: 'Qwen 3.5 35B A3B',
        profile: 'fast',
      },
      {
        id: 'Qwen/Qwen3.5-122B-A10B',
        label: 'Qwen 3.5 122B A10B',
        profile: 'balanced',
      },
      {
        id: 'Qwen/Qwen3.5-397B-A17B',
        label: 'Qwen 3.5 397B A17B',
        profile: 'capable',
      },
    ],
    consoleUrl: 'https://modelscope.cn/my/myaccesstoken',
  },
  deepseek: {
    id: 'deepseek',
    name: 'DeepSeek',
    kind: 'openai-compatible',
    defaultModel: 'deepseek-v4-pro',
    apiEndpoint: 'https://api.deepseek.com',
    allowsCustomEndpoint: false,
    models: [
      {
        id: 'deepseek-v4-pro',
        label: 'DeepSeek V4 Pro',
        profile: 'capable',
      },
      {
        id: 'deepseek-v4-flash',
        label: 'DeepSeek V4 Flash',
        profile: 'fast',
      },
    ],
    consoleUrl: 'https://platform.deepseek.com/api_keys',
  },
  openai: {
    id: 'openai',
    name: 'OpenAI',
    kind: 'openai',
    defaultModel: 'gpt-5.6-terra',
    apiEndpoint: 'https://api.openai.com/v1',
    allowsCustomEndpoint: false,
    models: [
      { id: 'gpt-5.6-sol', label: 'GPT-5.6 Sol', profile: 'capable' },
      { id: 'gpt-5.6-terra', label: 'GPT-5.6 Terra', profile: 'balanced' },
      { id: 'gpt-5.6-luna', label: 'GPT-5.6 Luna', profile: 'fast' },
    ],
    consoleUrl: 'https://platform.openai.com/api-keys',
  },
  anthropic: {
    id: 'anthropic',
    name: 'Anthropic',
    kind: 'anthropic',
    defaultModel: 'claude-sonnet-5',
    apiEndpoint: 'https://api.anthropic.com',
    allowsCustomEndpoint: false,
    models: [
      {
        id: 'claude-sonnet-5',
        label: 'Claude Sonnet 5',
        profile: 'balanced',
      },
      {
        id: 'claude-opus-4-8',
        label: 'Claude Opus 4.8',
        profile: 'capable',
      },
      { id: 'claude-fable-5', label: 'Claude Fable 5', profile: 'capable' },
      { id: 'claude-haiku-4-5', label: 'Claude Haiku 4.5', profile: 'fast' },
    ],
    consoleUrl: 'https://console.anthropic.com/settings/keys',
  },
  google: {
    id: 'google',
    name: 'Google Gemini',
    kind: 'google',
    defaultModel: 'gemini-3.5-flash',
    apiEndpoint: 'https://generativelanguage.googleapis.com',
    allowsCustomEndpoint: false,
    models: [
      {
        id: 'gemini-3.5-flash',
        label: 'Gemini 3.5 Flash',
        profile: 'balanced',
      },
      {
        id: 'gemini-3.1-pro-preview',
        label: 'Gemini 3.1 Pro Preview',
        profile: 'capable',
      },
      {
        id: 'gemini-3.1-flash-lite',
        label: 'Gemini 3.1 Flash-Lite',
        profile: 'fast',
      },
    ],
    consoleUrl: 'https://aistudio.google.com/app/apikey',
  },
  openrouter: {
    id: 'openrouter',
    name: 'OpenRouter',
    kind: 'openrouter',
    defaultModel: '~openai/gpt-latest',
    apiEndpoint: 'https://openrouter.ai/api/v1',
    allowsCustomEndpoint: false,
    models: [
      {
        id: '~openai/gpt-latest',
        label: 'OpenAI GPT Latest',
        profile: 'balanced',
      },
      {
        id: 'anthropic/claude-sonnet-5',
        label: 'Claude Sonnet 5',
        profile: 'capable',
      },
      {
        id: 'google/gemini-3.5-flash',
        label: 'Gemini 3.5 Flash',
        profile: 'fast',
      },
    ],
    consoleUrl: 'https://openrouter.ai/settings/keys',
  },
  custom: {
    id: 'custom',
    name: 'OpenAI Compatible',
    kind: 'openai-compatible',
    defaultModel: '',
    apiEndpoint: '',
    allowsCustomEndpoint: true,
    models: [],
    consoleUrl: '',
  },
};

export function isAIProviderId(value: unknown): value is AIProviderId {
  return (
    typeof value === 'string' &&
    (AI_PROVIDER_IDS as readonly string[]).includes(value)
  );
}

export function getAIProvider(providerId: AIProviderId): AIProviderDefinition {
  return AI_PROVIDERS[providerId];
}

/**
 * 将旧版仅含 endpoint 的设置映射到新的提供商标识。
 */
export function inferAIProviderId(apiEndpoint?: string): AIProviderId {
  const normalized = apiEndpoint?.trim().replace(/\/$/, '').toLowerCase();
  if (!normalized) {
    return DEFAULT_AI_PROVIDER_ID;
  }

  // 旧版 Qwen 设置使用百炼兼容端点，迁移后归入 ModelScope 配置。
  if (normalized === 'https://dashscope.aliyuncs.com/compatible-mode/v1') {
    return 'modelscope';
  }

  for (const provider of Object.values(AI_PROVIDERS)) {
    if (
      provider.id !== 'custom' &&
      provider.apiEndpoint.replace(/\/$/, '').toLowerCase() === normalized
    ) {
      return provider.id;
    }
  }

  return 'custom';
}
