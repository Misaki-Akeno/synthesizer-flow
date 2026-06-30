export interface AIModelSettings {
  modelName: string;
  apiKey: string;
  apiEndpoint: string;
  hasServerApiKey?: boolean;
}

export const DEFAULT_AI_SETTINGS: AIModelSettings = {
  modelName: 'qwen-turbo-2025-04-28',
  apiKey: '',
  apiEndpoint: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
  hasServerApiKey: false,
} as const;
