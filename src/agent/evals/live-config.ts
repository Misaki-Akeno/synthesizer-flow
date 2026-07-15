import type { AIModelSettings } from '@/lib/ai/defaults';
import {
  getAIProvider,
  isAIProviderId,
  type AIProviderId,
} from '@/lib/ai/providers';

export interface LiveBenchConfig {
  settings: AIModelSettings;
  repetitions: number;
  reportPath: string;
}

function readPositiveInteger(
  value: string | undefined,
  fallback: number
): number {
  if (!value) return fallback;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > 20) {
    throw new Error(
      'AGENT_EVAL_REPETITIONS must be an integer between 1 and 20'
    );
  }
  return parsed;
}

export function readLiveBenchConfig(
  source: Record<string, string | undefined> = process.env
): LiveBenchConfig {
  const rawProvider = source.AGENT_EVAL_PROVIDER ?? 'modelscope';
  if (!isAIProviderId(rawProvider)) {
    throw new Error(`Unsupported AGENT_EVAL_PROVIDER: ${rawProvider}`);
  }

  const providerId: AIProviderId = rawProvider;
  const provider = getAIProvider(providerId);
  const apiKey = source.AGENT_EVAL_API_KEY?.trim();
  if (!apiKey) {
    throw new Error(
      'AGENT_EVAL_API_KEY is required. Put it in .env.local or the shell environment.'
    );
  }

  const modelName = source.AGENT_EVAL_MODEL?.trim() || provider.defaultModel;
  const apiEndpoint = provider.allowsCustomEndpoint
    ? source.AGENT_EVAL_API_ENDPOINT?.trim()
    : provider.apiEndpoint;

  if (!modelName) {
    throw new Error('AGENT_EVAL_MODEL is required for this provider');
  }
  if (!apiEndpoint) {
    throw new Error('AGENT_EVAL_API_ENDPOINT is required for custom provider');
  }

  return {
    settings: {
      providerId,
      modelName,
      apiKey,
      apiEndpoint,
      hasServerApiKey: false,
    },
    repetitions: readPositiveInteger(source.AGENT_EVAL_REPETITIONS, 1),
    reportPath:
      source.AGENT_EVAL_REPORT_PATH?.trim() ||
      'artifacts/agent-evals/latest.json',
  };
}
