import { describe, expect, it, vi } from 'vitest';

vi.hoisted(() => {
  process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/synth';
  process.env.GITHUB_ID = 'github-id';
  process.env.GITHUB_SECRET = 'github-secret';
  process.env.NEXTAUTH_SECRET = 'nextauth-secret';
});

import { parseEnv } from './env';

const requiredEnv = {
  DATABASE_URL: 'postgresql://user:pass@localhost:5432/synth',
  GITHUB_ID: 'github-id',
  GITHUB_SECRET: 'github-secret',
  NEXTAUTH_SECRET: 'nextauth-secret',
};

describe('parseEnv', () => {
  it('uses a local NextAuth URL default outside production', () => {
    const env = parseEnv({
      ...requiredEnv,
      NODE_ENV: 'development',
    });

    expect(env.NEXTAUTH_URL).toBe('http://localhost:3000');
  });

  it('keeps NextAuth URL optional in production', () => {
    const env = parseEnv({
      ...requiredEnv,
      NODE_ENV: 'production',
    });

    expect(env.NEXTAUTH_URL).toBeUndefined();
  });

  it('reports the exact required variables that are missing', () => {
    expect(() => parseEnv({ NODE_ENV: 'test' })).toThrow(
      /DATABASE_URL.*GITHUB_ID.*GITHUB_SECRET.*NEXTAUTH_SECRET/
    );
  });

  it('coerces optional RAG embedding dimensions', () => {
    const env = parseEnv({
      ...requiredEnv,
      NODE_ENV: 'test',
      RAG_EMBEDDINGS_DIM: '1024',
    });

    expect(env.RAG_EMBEDDINGS_DIM).toBe(1024);
  });

  it('rejects invalid optional URLs with field-level context', () => {
    expect(() =>
      parseEnv({
        ...requiredEnv,
        NODE_ENV: 'test',
        RAG_EMBEDDINGS_BASE_URL: 'not-a-url',
      })
    ).toThrow(/RAG_EMBEDDINGS_BASE_URL/);
  });
});
