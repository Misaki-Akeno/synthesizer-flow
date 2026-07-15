import { describe, expect, it } from 'vitest';
import { readLiveBenchConfig } from './live-config';

describe('live Agent bench config', () => {
  it('uses the provider registry for endpoint and default model', () => {
    const config = readLiveBenchConfig({
      AGENT_EVAL_PROVIDER: 'modelscope',
      AGENT_EVAL_API_KEY: 'token',
      AGENT_EVAL_REPETITIONS: '3',
    });

    expect(config.settings).toMatchObject({
      providerId: 'modelscope',
      modelName: 'Qwen/Qwen3.5-35B-A3B',
      apiEndpoint: 'https://api-inference.modelscope.cn/v1',
    });
    expect(config.repetitions).toBe(3);
  });

  it('requires an explicit endpoint for custom providers', () => {
    expect(() =>
      readLiveBenchConfig({
        AGENT_EVAL_PROVIDER: 'custom',
        AGENT_EVAL_MODEL: 'test-model',
        AGENT_EVAL_API_KEY: 'token',
      })
    ).toThrow(/AGENT_EVAL_API_ENDPOINT/);
  });

  it('does not accept a missing API key or excessive repetitions', () => {
    expect(() => readLiveBenchConfig({})).toThrow(/AGENT_EVAL_API_KEY/);
    expect(() =>
      readLiveBenchConfig({
        AGENT_EVAL_API_KEY: 'token',
        AGENT_EVAL_REPETITIONS: '100',
      })
    ).toThrow(/between 1 and 20/);
  });
});
