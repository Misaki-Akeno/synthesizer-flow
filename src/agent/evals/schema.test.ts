import { describe, expect, it } from 'vitest';
import goldenSetData from './golden-set.json';
import { parseGoldenSet } from './schema';

describe('Golden Set schema', () => {
  it('parses the repository Golden Set and applies defaults', () => {
    const goldenSet = parseGoldenSet(goldenSetData);

    expect(goldenSet.version).toBe(1);
    expect(goldenSet.cases).toHaveLength(5);
    expect(goldenSet.cases[0]).toMatchObject({
      id: 'inspect-empty-canvas',
      threshold: 1,
      minSamplePassRate: 1,
    });
  });

  it('rejects duplicate case ids', () => {
    const input = structuredClone(goldenSetData);
    input.cases[1].id = input.cases[0].id;

    expect(() => parseGoldenSet(input)).toThrow(/duplicate case id/);
  });

  it('rejects cases without measurable expectations', () => {
    const input = structuredClone(goldenSetData) as unknown as {
      cases: Array<{ expected: unknown }>;
    };
    input.cases[0].expected = {};

    expect(() => parseGoldenSet(input)).toThrow(
      /expected must define at least one criterion/
    );
  });

  it('rejects snapshots whose edges reference missing nodes', () => {
    const input = structuredClone(goldenSetData);
    (
      input.cases[0].initialState.edges as Array<{
        source: string;
        target: string;
      }>
    ).push({
      source: 'missing-source',
      target: 'missing-target',
    });

    expect(() => parseGoldenSet(input)).toThrow(/missing source node/);
  });
});
