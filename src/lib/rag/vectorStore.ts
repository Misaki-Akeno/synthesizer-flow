import fs from 'node:fs/promises';
import path from 'node:path';
import { embedTexts } from './openaiEmbedder';
import { env } from '@/lib/env';

type Meta = Record<string, unknown> | undefined;

export interface VectorDoc {
  id: string;
  embedding: number[];
  textSnippet: string;
  meta?: Meta;
}

interface IndexFile {
  model: string;
  docs: VectorDoc[];
}

const RAG_DIR = path.join(process.cwd(), '.rag');
const INDEX_PATH = path.join(RAG_DIR, 'index.json');

async function ensureIndex(): Promise<IndexFile> {
  await fs.mkdir(RAG_DIR, { recursive: true });
  try {
    const raw = await fs.readFile(INDEX_PATH, 'utf-8');
    return JSON.parse(raw) as IndexFile;
  } catch {
    const empty: IndexFile = { model: process.env.RAG_EMBEDDINGS_MODEL || 'text-embedding-3-small', docs: [] };
    await fs.writeFile(INDEX_PATH, JSON.stringify(empty, null, 2), 'utf-8');
    return empty;
  }
}

async function saveIndex(index: IndexFile) {
  await fs.writeFile(INDEX_PATH, JSON.stringify(index, null, 2), 'utf-8');
}

function cosineSim(a: number[], b: number[]): number {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length && i < b.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb) || 1e-8;
  return dot / denom;
}

export async function upsertDocuments(docs: Array<{ id?: string; text: string; meta?: Meta }>, options?: { embeddingModel?: string }) {
  if (!docs?.length) return { inserted: 0 };
  const index = await ensureIndex();

  // Simplest chunking: one chunk per input (trim + clamp length)
  const chunks = docs.map((d, i) => ({
    id: d.id || `doc_${Date.now()}_${i}`,
    text: d.text.trim().slice(0, 3000),
    meta: d.meta,
  }));

  let embeddings: number[][];
  try {
    embeddings = await embedTexts(chunks.map(c => c.text), {
      model: options?.embeddingModel || env.RAG_EMBEDDINGS_MODEL || index.model,
      apiKey: env.RAG_EMBEDDINGS_API_KEY,
      baseURL: env.RAG_EMBEDDINGS_BASE_URL,
    });
  } catch (e) {
    console.error('[RAG] embedTexts failed:', e);
    throw new Error('failed to compute embeddings: ' + (e instanceof Error ? e.message : String(e)));
  }

  const newDocs: VectorDoc[] = chunks.map((c, i) => ({
    id: c.id,
    embedding: embeddings[i],
    textSnippet: c.text,
    meta: c.meta,
  }));

  // Upsert by id
  const map = new Map(index.docs.map(d => [d.id, d] as const));
  for (const d of newDocs) map.set(d.id, d);
  index.docs = Array.from(map.values());

  try {
    await saveIndex(index);
  } catch (e) {
    console.error('[RAG] saveIndex failed:', e);
    throw new Error('failed to save index: ' + (e instanceof Error ? e.message : String(e)));
  }
  return { inserted: newDocs.length, total: index.docs.length };
}

export async function searchDocuments(query: string, topK = 5) {
  const index = await ensureIndex();
  if (!index.docs.length) return { matches: [] as Array<{ id: string; score: number; textSnippet: string; meta?: Meta }> };

  const [qv] = await embedTexts([query], {
  model: env.RAG_EMBEDDINGS_MODEL || index.model,
  apiKey: env.RAG_EMBEDDINGS_API_KEY,
  baseURL: env.RAG_EMBEDDINGS_BASE_URL,
  });

  const scored = index.docs.map(d => ({ id: d.id, score: cosineSim(qv, d.embedding), textSnippet: d.textSnippet, meta: d.meta }));
  scored.sort((a, b) => b.score - a.score);
  return { matches: scored.slice(0, Math.max(1, Math.min(topK, 20))) };
}
