import { describe, expect, it } from 'vitest';
import {
  DEFAULT_RAG_VECTOR_DIMENSION,
  resolveRagVectorDimension,
} from './vectorDimension';

describe('resolveRagVectorDimension', () => {
  it('defaults to the existing pgvector migration dimension', () => {
    expect(DEFAULT_RAG_VECTOR_DIMENSION).toBe(1024);
    expect(resolveRagVectorDimension(undefined)).toBe(1024);
  });

  it('accepts positive integer dimensions from strings and numbers', () => {
    expect(resolveRagVectorDimension('1024')).toBe(1024);
    expect(resolveRagVectorDimension(768)).toBe(768);
  });

  it('falls back for empty, fractional, non-finite, or non-positive values', () => {
    expect(resolveRagVectorDimension(undefined)).toBe(
      DEFAULT_RAG_VECTOR_DIMENSION
    );
    expect(resolveRagVectorDimension('')).toBe(DEFAULT_RAG_VECTOR_DIMENSION);
    expect(resolveRagVectorDimension('1.5')).toBe(DEFAULT_RAG_VECTOR_DIMENSION);
    expect(resolveRagVectorDimension(-1)).toBe(DEFAULT_RAG_VECTOR_DIMENSION);
    expect(resolveRagVectorDimension(Number.POSITIVE_INFINITY)).toBe(
      DEFAULT_RAG_VECTOR_DIMENSION
    );
  });
});
