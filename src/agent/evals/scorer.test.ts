import { describe, expect, it } from 'vitest';
import { scoreGoldenCase } from './scorer';
import type { AgentEvalActual, GoldenCase } from './types';

const goldenCase: GoldenCase = {
  id: 'add-number',
  description: 'add number input',
  tags: [],
  messages: [{ role: 'user', content: 'add it' }],
  initialState: { nodes: [], edges: [] },
  threshold: 1,
  minSamplePassRate: 1,
  expected: {
    tools: {
      mode: 'ordered',
      names: ['skill_load', 'module_add'],
      arguments: [
        {
          name: 'module_add',
          includes: { type: 'numberinput' },
        },
      ],
    },
    operations: {
      mode: 'contains',
      items: [{ type: 'ADD_MODULE', data: { type: 'numberinput' } }],
    },
    approvalRequired: false,
  },
};

const actual: AgentEvalActual = {
  response: '已添加数字输入。',
  toolCalls: [
    { name: 'skill_list', arguments: { query: '数字' } },
    {
      name: 'skill_load',
      arguments: { skillId: 'module:numberinput' },
    },
    {
      name: 'module_add',
      arguments: { type: 'numberinput', label: '控制值' },
    },
  ],
  operations: [
    {
      type: 'ADD_MODULE',
      data: {
        id: 'node-1',
        type: 'numberinput',
        label: '控制值',
        position: { x: 0, y: 0 },
      },
    },
  ],
  approvalRequired: false,
};

describe('Golden Set scorer', () => {
  it('supports ordered tool subsequences and partial argument matching', () => {
    const result = scoreGoldenCase(goldenCase, actual);

    expect(result.score).toBe(1);
    expect(result.criteria.every((criterion) => criterion.passed)).toBe(true);
  });

  it('reports the failed criterion without hiding partial credit', () => {
    const result = scoreGoldenCase(goldenCase, {
      ...actual,
      operations: [],
    });

    expect(result.score).toBe(0.75);
    expect(
      result.criteria.find((item) => item.id === 'operations')
    ).toMatchObject({ passed: false });
  });

  it('requires exact tool order when configured', () => {
    const result = scoreGoldenCase(
      {
        ...goldenCase,
        expected: {
          tools: {
            mode: 'exact',
            names: ['skill_load', 'module_add'],
          },
        },
      },
      actual
    );

    expect(result.score).toBe(0);
  });
});
