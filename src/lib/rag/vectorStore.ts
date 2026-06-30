import { createHash } from 'node:crypto';
import { embedTexts } from './openaiEmbedder';
import { env } from '@/lib/env';
import { db } from '@/db/client';
import { ragDocuments } from '@/db/schema';
import { count, sql } from 'drizzle-orm';
import { normalizeTopK } from './searchParams';
import { resolveRagVectorDimension } from './vectorDimension';

type Meta = Record<string, unknown> | undefined;

export interface VectorDoc {
  id: string;
  embedding: number[];
  textSnippet: string;
  meta?: Meta;
  model: string;
}

const EMBEDDING_DIM = resolveRagVectorDimension(env.RAG_EMBEDDINGS_DIM);

function normalizeForStableStringify(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(normalizeForStableStringify);
  }

  if (value && typeof value === 'object') {
    return Object.keys(value)
      .sort()
      .reduce<Record<string, unknown>>((acc, key) => {
        acc[key] = normalizeForStableStringify(
          (value as Record<string, unknown>)[key]
        );
        return acc;
      }, {});
  }

  return value;
}

function createGeneratedDocumentId(text: string, meta: Meta): string {
  const hash = createHash('sha256')
    .update(text)
    .update('\0')
    .update(JSON.stringify(normalizeForStableStringify(meta ?? {})))
    .digest('hex')
    .slice(0, 24);

  return `doc_${hash}`;
}

function assertEmbeddingDimension(
  embedding: number[] | undefined,
  context: string
): asserts embedding is number[] {
  if (!embedding?.length) {
    throw new Error(`${context}: empty embedding`);
  }

  if (embedding.length !== EMBEDDING_DIM) {
    throw new Error(
      `${context}: embedding dimension mismatch (expected ${EMBEDDING_DIM}, got ${embedding.length})`
    );
  }

  const invalidIndex = embedding.findIndex(
    (value) => typeof value !== 'number' || !Number.isFinite(value)
  );
  if (invalidIndex >= 0) {
    throw new Error(`${context}: embedding[${invalidIndex}] must be finite`);
  }
}

export async function upsertDocuments(
  docs: Array<{ id?: string; text: string; meta?: Meta }>,
  options?: { embeddingModel?: string }
) {
  if (!docs?.length) return { inserted: 0 };
  const model =
    options?.embeddingModel ??
    env.RAG_EMBEDDINGS_MODEL ??
    'text-embedding-3-small';

  // Simplest chunking: one chunk per input (trim + clamp length)
  const chunks = docs.map((d) => {
    const text = d.text.trim().slice(0, 3000);

    return {
      id: d.id || createGeneratedDocumentId(text, d.meta),
      text,
      meta: d.meta,
    };
  });

  let embeddings: number[][];
  try {
    embeddings = await embedTexts(
      chunks.map((c) => c.text),
      {
        model,
        apiKey: env.RAG_EMBEDDINGS_API_KEY,
        baseURL: env.RAG_EMBEDDINGS_BASE_URL,
      }
    );
  } catch (e) {
    console.error('[RAG] embedTexts failed:', e);
    throw new Error(
      'failed to compute embeddings: ' +
        (e instanceof Error ? e.message : String(e))
    );
  }

  embeddings.forEach((embedding, index) => {
    assertEmbeddingDimension(embedding, `document[${index}]`);
  });

  const newDocs: VectorDoc[] = chunks.map((c, i) => ({
    id: c.id,
    embedding: embeddings[i],
    textSnippet: c.text,
    meta: c.meta,
    model,
  }));

  try {
    const now = new Date();
    await db
      .insert(ragDocuments)
      .values(
        newDocs.map((doc) => ({
          id: doc.id,
          textSnippet: doc.textSnippet,
          embedding: doc.embedding,
          meta: doc.meta,
          model: doc.model,
          updatedAt: now,
        }))
      )
      .onConflictDoUpdate({
        target: ragDocuments.id,
        set: {
          textSnippet: sql`excluded.text_snippet`,
          embedding: sql`excluded.embedding`,
          meta: sql`excluded.meta`,
          model: sql`excluded.model`,
          updatedAt: sql`excluded.updated_at`,
        },
      });

    const totalResult = await db.select({ count: count() }).from(ragDocuments);
    const total = Number(totalResult[0]?.count || 0);
    return { inserted: newDocs.length, total };
  } catch (e) {
    console.error('[RAG] database upsert failed:', e);
    throw new Error(
      'failed to save embeddings: ' +
        (e instanceof Error ? e.message : String(e))
    );
  }
}

export async function searchDocuments(query: string, topK = 5) {
  return searchHybridDocuments(query, topK);
}

/**
 * Hybrid search using Reciprocal Rank Fusion (RRF)
 * Combines HNSW Vector Search and PostgreSQL Full-Text Search (BM25-like)
 */
export async function searchHybridDocuments(query: string, topK = 5) {
  const limit = normalizeTopK(topK);
  // Skip if nothing in store
  const anyDoc = await db
    .select({ id: ragDocuments.id })
    .from(ragDocuments)
    .limit(1);
  if (!anyDoc.length)
    return {
      matches: [] as Array<{
        id: string;
        score: number;
        textSnippet: string;
        meta?: Meta;
      }>,
    };

  // 1. Prepare Vector Query
  const [qv] = await embedTexts([query], {
    model: env.RAG_EMBEDDINGS_MODEL || 'text-embedding-3-small',
    apiKey: env.RAG_EMBEDDINGS_API_KEY,
    baseURL: env.RAG_EMBEDDINGS_BASE_URL,
  });

  assertEmbeddingDimension(qv, 'query');

  const vectorType = sql.raw(`vector(${EMBEDDING_DIM})`);
  const queryVector = sql.raw(`'[${qv.join(',')}]'`);

  // 2. Parallel Search: Vector + FTS
  // We fetch more than topK for each to allow for better fusion
  const fetchCount = limit * 2;

  const [vectorResults, ftsResults] = await Promise.all([
    // Vector Search (HNSW)
    db
      .select({
        id: ragDocuments.id,
        textSnippet: ragDocuments.textSnippet,
        meta: ragDocuments.meta,
        score: sql<number>`1 - (${ragDocuments.embedding} <=> ${queryVector}::${vectorType})`,
      })
      .from(ragDocuments)
      .orderBy(sql`${ragDocuments.embedding} <=> ${queryVector}::${vectorType}`)
      .limit(fetchCount),

    // Full-Text Search (BM25 style)
    db
      .select({
        id: ragDocuments.id,
        textSnippet: ragDocuments.textSnippet,
        meta: ragDocuments.meta,
        // Using websearch_to_tsquery for better user query handling
        rank: sql<number>`ts_rank_cd(to_tsvector('english', ${ragDocuments.textSnippet}), websearch_to_tsquery('english', ${query}))`,
      })
      .from(ragDocuments)
      .where(
        sql`to_tsvector('english', ${ragDocuments.textSnippet}) @@ websearch_to_tsquery('english', ${query})`
      )
      .orderBy(
        sql`ts_rank_cd(to_tsvector('english', ${ragDocuments.textSnippet}), websearch_to_tsquery('english', ${query})) DESC`
      )
      .limit(fetchCount),
  ]);

  // 3. Reciprocal Rank Fusion (RRF)
  // Constant k (usually 60) avoids division by zero and dampens the impact of high ranks
  const K = 60;

  interface BaseSearchResult {
    id: string;
    textSnippet: string;
    meta: Meta;
  }
  interface VectorResult extends BaseSearchResult {
    score: number;
  }
  interface FtsResult extends BaseSearchResult {
    rank: number;
  }

  const scoreMap = new Map<
    string,
    {
      doc: BaseSearchResult;
      rrfScore: number;
      vectorScore?: number;
      ftsScore?: number;
    }
  >();

  // Helper to add results to map
  const processResults = (
    results: (VectorResult | FtsResult)[],
    weight: number,
    isVector: boolean
  ) => {
    results.forEach((r, index) => {
      const rank = index + 1;
      const current = scoreMap.get(r.id) || {
        doc: { id: r.id, textSnippet: r.textSnippet, meta: r.meta },
        rrfScore: 0,
      };

      current.rrfScore += weight * (1 / (K + rank));
      if (isVector && 'score' in r) {
        current.vectorScore = r.score;
      } else if (!isVector && 'rank' in r) {
        current.ftsScore = r.rank;
      }

      scoreMap.set(r.id, current);
    });
  };

  processResults(vectorResults as VectorResult[], 1.0, true);
  processResults(ftsResults as FtsResult[], 1.0, false);

  // 4. Sort and Format final results
  const sortedMatches = Array.from(scoreMap.values())
    .sort((a, b) => b.rrfScore - a.rrfScore)
    .slice(0, limit)
    .map((item) => ({
      id: item.doc.id,
      score: item.rrfScore, // Return RRF score as the main score
      textSnippet: item.doc.textSnippet,
      meta: {
        ...(item.doc.meta as Meta),
        _vectorScore: item.vectorScore,
        _ftsScore: item.ftsScore,
      },
    }));

  return {
    matches: sortedMatches,
  };
}
