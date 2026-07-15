import { scoreGoldenCase } from './scorer';
import type {
  AgentBenchReport,
  AgentEvalCaseResult,
  AgentEvalSampleResult,
  AgentEvalTarget,
  GoldenSet,
} from './types';

export interface RunGoldenBenchOptions {
  repetitions?: number;
}

function average(values: number[]): number {
  return values.length === 0
    ? 0
    : values.reduce((sum, value) => sum + value, 0) / values.length;
}

function percentile(values: number[], quantile: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil(quantile * sorted.length) - 1)
  );
  return sorted[index];
}

export async function runGoldenBench(
  goldenSet: GoldenSet,
  target: AgentEvalTarget,
  options: RunGoldenBenchOptions = {}
): Promise<AgentBenchReport> {
  const repetitions = Math.max(1, Math.floor(options.repetitions ?? 1));
  const startedAt = new Date();
  const caseResults: AgentEvalCaseResult[] = [];

  for (const goldenCase of goldenSet.cases) {
    const samples: AgentEvalSampleResult[] = [];

    for (let sampleIndex = 0; sampleIndex < repetitions; sampleIndex += 1) {
      const started = performance.now();
      try {
        const actual = await target.run(goldenCase, { sampleIndex });
        const scored = scoreGoldenCase(goldenCase, actual);
        const latencyMs = performance.now() - started;
        samples.push({
          sampleIndex,
          passed: scored.score >= goldenCase.threshold,
          score: scored.score,
          latencyMs,
          criteria: scored.criteria,
          actual,
        });
      } catch (error) {
        samples.push({
          sampleIndex,
          passed: false,
          score: 0,
          latencyMs: performance.now() - started,
          criteria: [],
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    const samplePassRate =
      samples.filter((sample) => sample.passed).length / samples.length;
    caseResults.push({
      id: goldenCase.id,
      description: goldenCase.description,
      tags: goldenCase.tags,
      passed: samplePassRate >= goldenCase.minSamplePassRate,
      averageScore: average(samples.map((sample) => sample.score)),
      samplePassRate,
      threshold: goldenCase.threshold,
      samples,
    });
  }

  const allSamples = caseResults.flatMap((result) => result.samples);
  const casePassRate =
    caseResults.filter((result) => result.passed).length / caseResults.length;
  const averageScore = average(
    caseResults.map((result) => result.averageScore)
  );
  const qualityGate = goldenSet.qualityGate;

  return {
    goldenSet: goldenSet.name,
    target: target.name,
    startedAt: startedAt.toISOString(),
    durationMs: Date.now() - startedAt.getTime(),
    repetitions,
    passed:
      casePassRate >= qualityGate.minCasePassRate &&
      averageScore >= qualityGate.minAverageScore,
    summary: {
      totalCases: caseResults.length,
      passedCases: caseResults.filter((result) => result.passed).length,
      failedCases: caseResults.filter((result) => !result.passed).length,
      casePassRate,
      averageScore,
      averageLatencyMs: average(allSamples.map((sample) => sample.latencyMs)),
      p95LatencyMs: percentile(
        allSamples.map((sample) => sample.latencyMs),
        0.95
      ),
    },
    qualityGate,
    cases: caseResults,
  };
}
