import {
  DEFAULT_AI_PROVIDER_ID,
  getAIProvider,
  type AIProviderId,
} from './providers';

export interface AIModelSettings {
  providerId: AIProviderId;
  modelName: string;
  apiKey: string;
  apiEndpoint: string;
  hasServerApiKey?: boolean;
}

export const DEFAULT_AI_SETTINGS: AIModelSettings = {
  providerId: DEFAULT_AI_PROVIDER_ID,
  modelName: getAIProvider(DEFAULT_AI_PROVIDER_ID).defaultModel,
  apiKey: '',
  apiEndpoint: getAIProvider(DEFAULT_AI_PROVIDER_ID).apiEndpoint,
  hasServerApiKey: false,
} as const;
