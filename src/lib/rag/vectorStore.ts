import { embedTexts } from './openaiEmbedder';
import { env } from '@/lib/env';
import { db } from '@/db/client';
import { ragDocuments } from '@/db/schema';
import { count, sql } from 'drizzle-orm';

type Meta = Record<string, unknown> | undefined;

export interface VectorDoc {
  id: string;
  embedding: number[];
  textSnippet: string;
  meta?: Meta;
  model: string;
}

const EMBEDDING_DIM =
  (Number(env.RAG_EMBEDDINGS_DIM) && Number.isFinite(Number(env.RAG_EMBEDDINGS_DIM))
    ? Number(env.RAG_EMBEDDINGS_DIM)
    : 1536);

export async function upsertDocuments(docs: Array<{ id?: string; text: string; meta?: Meta }>, options?: { embeddingModel?: string }) {
  if (!docs?.length) return { inserted: 0 };
  const model = options?.embeddingModel ?? env.RAG_EMBEDDINGS_MODEL ?? 'text-embedding-3-small';

  // Simplest chunking: one chunk per input (trim + clamp length)
  const chunks = docs.map((d, i) => ({
    id: d.id || `doc_${Date.now()}_${i}`,
    text: d.text.trim().slice(0, 3000),
    meta: d.meta,
  }));

  let embeddings: number[][];
  try {
    embeddings = await embedTexts(chunks.map(c => c.text), {
      model,
      apiKey: env.RAG_EMBEDDINGS_API_KEY,
      baseURL: env.RAG_EMBEDDINGS_BASE_URL,
    });
  } catch (e) {
    console.error('[RAG] embedTexts failed:', e);
    throw new Error('failed to compute embeddings: ' + (e instanceof Error ? e.message : String(e)));
  }

  const invalidDim = embeddings.findIndex((emb) => emb.length !== EMBEDDING_DIM);
  if (invalidDim >= 0) {
    throw new Error(`embedding dimension mismatch (expected ${EMBEDDING_DIM}, got ${embeddings[invalidDim].length})`);
  }

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
    throw new Error('failed to save embeddings: ' + (e instanceof Error ? e.message : String(e)));
  }
}

export async function searchDocuments(query: string, topK = 5) {
  const limit = Math.max(1, Math.min(topK, 20));
  // Skip embedding call if nothing in store
  const anyDoc = await db.select({ id: ragDocuments.id }).from(ragDocuments).limit(1);
  if (!anyDoc.length) return { matches: [] as Array<{ id: string; score: number; textSnippet: string; meta?: Meta }> };

  const [qv] = await embedTexts([query], {
    model: env.RAG_EMBEDDINGS_MODEL || 'text-embedding-3-small',
    apiKey: env.RAG_EMBEDDINGS_API_KEY,
    baseURL: env.RAG_EMBEDDINGS_BASE_URL,
  });

  if (!qv?.length) return { matches: [] as Array<{ id: string; score: number; textSnippet: string; meta?: Meta }> };
  if (qv.length !== EMBEDDING_DIM) {
    throw new Error(`embedding dimension mismatch (expected ${EMBEDDING_DIM}, got ${qv.length})`);
  }

  // Build vector literal for pgvector comparison
  const vectorType = sql.raw(`vector(${EMBEDDING_DIM})`);
  // pgvector literal must be quoted: '[1,2,3]'
  const queryVector = sql.raw(`'[${qv.join(',')}]'`);

  const results = await db
    .select({
      id: ragDocuments.id,
      textSnippet: ragDocuments.textSnippet,
      meta: ragDocuments.meta,
      // Using cosine distance (<=>). Higher score is better, so invert distance.
      score: sql<number>`1 - (${ragDocuments.embedding} <=> ${queryVector}::${vectorType})`,
    })
    .from(ragDocuments)
    .orderBy(sql`${ragDocuments.embedding} <=> ${queryVector}::${vectorType}`)
    .limit(limit);

  return {
    matches: results.map((r) => ({
      id: r.id,
      score: Number(r.score),
      textSnippet: r.textSnippet,
      meta: r.meta as Meta,
    })),
  };
}
