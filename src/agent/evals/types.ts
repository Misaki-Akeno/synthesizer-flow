import type {
  ChatMessage,
  ClientOperation,
  GraphStateSnapshot,
} from '../core/types';

export type GoldenMatchMode = 'exact' | 'contains' | 'ordered';

export interface GoldenToolArgumentExpectation {
  name: string;
  includes: Record<string, unknown>;
}

export interface GoldenToolExpectation {
  mode: GoldenMatchMode;
  names: string[];
  arguments?: GoldenToolArgumentExpectation[];
}

export interface GoldenOperationExpectation {
  type: ClientOperation['type'];
  data?: Record<string, unknown>;
}

export interface GoldenResponseExpectation {
  containsAll?: string[];
  excludes?: string[];
  minLength?: number;
}

export interface GoldenExpectation {
  tools?: GoldenToolExpectation;
  operations?: {
    mode: Exclude<GoldenMatchMode, 'ordered'>;
    items: GoldenOperationExpectation[];
  };
  approvalRequired?: boolean;
  response?: GoldenResponseExpectation;
}

export interface GoldenCase {
  id: string;
  description: string;
  tags: string[];
  messages: ChatMessage[];
  initialState: GraphStateSnapshot;
  expected: GoldenExpectation;
  threshold: number;
  minSamplePassRate: number;
}

export interface GoldenSet {
  version: 1;
  name: string;
  description?: string;
  qualityGate: {
    minCasePassRate: number;
    minAverageScore: number;
  };
  cases: GoldenCase[];
}

export interface AgentEvalToolCall {
  name: string;
  arguments: Record<string, unknown>;
}

export interface AgentEvalActual {
  response: string;
  toolCalls: AgentEvalToolCall[];
  operations: ClientOperation[];
  approvalRequired: boolean;
}

export interface AgentEvalRunContext {
  sampleIndex: number;
}

export interface AgentEvalTarget {
  name: string;
  run(
    goldenCase: GoldenCase,
    context: AgentEvalRunContext
  ): Promise<AgentEvalActual>;
}

export interface AgentEvalCriterionResult {
  id: string;
  passed: boolean;
  expected: unknown;
  actual: unknown;
}

export interface AgentEvalSampleResult {
  sampleIndex: number;
  passed: boolean;
  score: number;
  latencyMs: number;
  criteria: AgentEvalCriterionResult[];
  actual?: AgentEvalActual;
  error?: string;
}

export interface AgentEvalCaseResult {
  id: string;
  description: string;
  tags: string[];
  passed: boolean;
  averageScore: number;
  samplePassRate: number;
  threshold: number;
  samples: AgentEvalSampleResult[];
}

export interface AgentBenchReport {
  goldenSet: string;
  target: string;
  startedAt: string;
  durationMs: number;
  repetitions: number;
  passed: boolean;
  summary: {
    totalCases: number;
    passedCases: number;
    failedCases: number;
    casePassRate: number;
    averageScore: number;
    averageLatencyMs: number;
    p95LatencyMs: number;
  };
  qualityGate: GoldenSet['qualityGate'];
  cases: AgentEvalCaseResult[];
}
