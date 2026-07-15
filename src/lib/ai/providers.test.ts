import { describe, expect, it } from 'vitest';
import {
  AI_PROVIDER_IDS,
  AI_PROVIDERS,
  getAIProvider,
  inferAIProviderId,
} from './providers';

describe('AI provider registry', () => {
  it('defines a complete provider entry for every supported id', () => {
    expect(Object.keys(AI_PROVIDERS)).toEqual(AI_PROVIDER_IDS);

    for (const providerId of AI_PROVIDER_IDS) {
      const provider = getAIProvider(providerId);
      expect(provider.id).toBe(providerId);
      expect(provider.name).toBeTruthy();
      if (!provider.allowsCustomEndpoint) {
        expect(provider.apiEndpoint).toMatch(/^https:\/\//);
        expect(provider.defaultModel).toBeTruthy();
      }
    }
  });

  it('infers known providers from legacy endpoints', () => {
    expect(
      inferAIProviderId('https://dashscope.aliyuncs.com/compatible-mode/v1/')
    ).toBe('modelscope');
    expect(inferAIProviderId('https://api-inference.modelscope.cn/v1')).toBe(
      'modelscope'
    );
    expect(inferAIProviderId('https://api.openai.com/v1')).toBe('openai');
  });

  it('keeps unknown legacy endpoints as custom providers', () => {
    expect(inferAIProviderId('https://models.example.com/v1')).toBe('custom');
  });
});
