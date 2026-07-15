import { describe, expect, it } from 'vitest';
import { runGoldenBench } from './runner';
import type { AgentEvalTarget, GoldenSet } from './types';

const goldenSet: GoldenSet = {
  version: 1,
  name: 'runner-test',
  qualityGate: { minCasePassRate: 1, minAverageScore: 1 },
  cases: [
    {
      id: 'inspect',
      description: 'inspect canvas',
      tags: ['smoke'],
      messages: [{ role: 'user', content: 'inspect' }],
      initialState: { nodes: [], edges: [] },
      expected: {
        tools: { mode: 'contains', names: ['canvas_inspect'] },
      },
      threshold: 1,
      minSamplePassRate: 1,
    },
  ],
};

describe('Golden bench runner', () => {
  it('runs repeated samples and aggregates stability and latency', async () => {
    const target: AgentEvalTarget = {
      name: 'fake-agent',
      run: async () => ({
        response: 'empty',
        toolCalls: [{ name: 'canvas_inspect', arguments: {} }],
        operations: [],
        approvalRequired: false,
      }),
    };

    const report = await runGoldenBench(goldenSet, target, { repetitions: 3 });

    expect(report.passed).toBe(true);
    expect(report.repetitions).toBe(3);
    expect(report.summary).toMatchObject({
      totalCases: 1,
      passedCases: 1,
      casePassRate: 1,
      averageScore: 1,
    });
    expect(report.cases[0].samples).toHaveLength(3);
  });

  it('captures target errors as failed samples', async () => {
    const target: AgentEvalTarget = {
      name: 'broken-agent',
      run: async () => {
        throw new Error('provider unavailable');
      },
    };

    const report = await runGoldenBench(goldenSet, target);

    expect(report.passed).toBe(false);
    expect(report.cases[0].samples[0]).toMatchObject({
      passed: false,
      score: 0,
      error: 'provider unavailable',
    });
  });
});
