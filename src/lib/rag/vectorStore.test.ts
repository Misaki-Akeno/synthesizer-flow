import { beforeEach, describe, expect, it, vi } from 'vitest';
import { embedTexts } from './openaiEmbedder';
import { db } from '@/db/client';
import { searchDocuments, upsertDocuments } from './vectorStore';

vi.mock('@/lib/env', () => ({
  env: {
    DATABASE_URL: 'postgresql://user:pass@localhost:5432/synth',
    RAG_EMBEDDINGS_API_KEY: 'test-key',
    RAG_EMBEDDINGS_BASE_URL: 'https://example.com/v1',
    RAG_EMBEDDINGS_DIM: 3,
    RAG_EMBEDDINGS_MODEL: 'test-embedding',
  },
}));

vi.mock('./openaiEmbedder', () => ({
  embedTexts: vi.fn(),
}));

vi.mock('@/db/client', () => {
  return {
    db: {
      insert: vi.fn(),
      select: vi.fn(),
    },
  };
});

const mockEmbedTexts = vi.mocked(embedTexts);
const mockDb = vi.mocked(db);

function createSelectChain<T>(rows: T[]) {
  const chain = {
    from: vi.fn(() => chain),
    where: vi.fn(() => chain),
    orderBy: vi.fn(() => chain),
    limit: vi.fn().mockResolvedValue(rows),
    then: (
      resolve: (value: T[]) => unknown,
      reject?: (reason: unknown) => unknown
    ) => Promise.resolve(rows).then(resolve, reject),
  };

  return chain;
}

function mockInsertChain(): void {
  const onConflictDoUpdate = vi.fn().mockResolvedValue(undefined);
  const values = vi.fn(() => ({ onConflictDoUpdate }));

  mockDb.insert.mockReturnValue({ values } as never);
}

function insertedValues(): Array<{
  id: string;
  textSnippet: string;
  namespace: string;
  sourceId?: string;
  contentHash: string;
  chunkIndex?: number;
}> {
  const insertResult = mockDb.insert.mock.results[0]?.value as {
    values: ReturnType<typeof vi.fn>;
  };
  const valuesMock = vi.mocked(insertResult.values);
  return valuesMock.mock.calls[0]?.[0] ?? [];
}

describe('upsertDocuments', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEmbedTexts.mockResolvedValue([[0.1, 0.2, 0.3]]);
    mockInsertChain();
    mockDb.select.mockReturnValue(createSelectChain([{ count: 1 }]) as never);
  });

  it('keeps caller-provided document ids', async () => {
    await upsertDocuments([{ id: 'manual-id', text: '  Oscillator docs  ' }]);

    expect(insertedValues()[0]).toMatchObject({
      id: 'manual-id',
      textSnippet: 'Oscillator docs',
    });
  });

  it('generates stable ids for documents without explicit ids', async () => {
    await upsertDocuments([
      { text: '  Oscillator docs  ', meta: { b: 2, a: 1 } },
    ]);
    const firstId = insertedValues()[0].id;

    vi.clearAllMocks();
    mockEmbedTexts.mockResolvedValue([[0.1, 0.2, 0.3]]);

    await upsertDocuments([{ text: 'Oscillator docs', meta: { a: 1, b: 2 } }]);

    expect(insertedValues()[0].id).toBe(firstId);
  });

  it('stores namespace and source metadata for future knowledge-base isolation', async () => {
    await upsertDocuments(
      [
        {
          text: 'Oscillator docs',
          meta: { sourceId: 'manual/oscillator.md', chunkIndex: 3 },
        },
      ],
      { namespace: ' user-1 ' }
    );

    expect(insertedValues()[0]).toMatchObject({
      namespace: 'user-1',
      sourceId: 'manual/oscillator.md',
      chunkIndex: 3,
      contentHash: expect.stringMatching(/^[a-f0-9]{64}$/),
    });
  });

  it('rejects document embeddings with unexpected dimensions', async () => {
    mockEmbedTexts.mockResolvedValue([[0.1, 0.2]]);

    await expect(
      upsertDocuments([{ text: 'Oscillator docs' }])
    ).rejects.toThrow(/document\[0\].*expected 3, got 2/);
    expect(mockDb.insert).not.toHaveBeenCalled();
  });

  it('rejects document embeddings with non-finite values', async () => {
    mockEmbedTexts.mockResolvedValue([[0.1, Number.NaN, 0.3]]);

    await expect(
      upsertDocuments([{ text: 'Oscillator docs' }])
    ).rejects.toThrow(/document\[0\].*embedding\[1\].*finite/);
    expect(mockDb.insert).not.toHaveBeenCalled();
  });
});

describe('searchDocuments', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDb.select.mockReturnValue(
      createSelectChain([{ id: 'doc-1' }]) as never
    );
  });

  it('rejects query embeddings with unexpected dimensions before SQL search', async () => {
    mockEmbedTexts.mockResolvedValue([[0.1, 0.2]]);

    await expect(searchDocuments('oscillator', 5)).rejects.toThrow(
      /query.*expected 3, got 2/
    );

    expect(mockDb.select).toHaveBeenCalledTimes(1);
  });

  it('rejects query embeddings with non-finite values before SQL search', async () => {
    mockEmbedTexts.mockResolvedValue([[0.1, Number.POSITIVE_INFINITY, 0.3]]);

    await expect(searchDocuments('oscillator', 5)).rejects.toThrow(
      /query.*embedding\[1\].*finite/
    );

    expect(mockDb.select).toHaveBeenCalledTimes(1);
  });
});
