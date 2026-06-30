import { describe, expect, it } from 'vitest';
import { normalizeTopK } from './searchParams';

describe('RAG search param helpers', () => {
  it('normalizes topK to a bounded integer', () => {
    expect(normalizeTopK(undefined)).toBe(5);
    expect(normalizeTopK(Number.NaN)).toBe(5);
    expect(normalizeTopK(0)).toBe(1);
    expect(normalizeTopK(-10)).toBe(1);
    expect(normalizeTopK(3.9)).toBe(3);
    expect(normalizeTopK(100)).toBe(20);
    expect(normalizeTopK(Number.POSITIVE_INFINITY)).toBe(5);
  });
});
