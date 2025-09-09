/**
 * Server-side embedder using OpenAI-compatible Embeddings API
 */
import { env } from '@/lib/env';

export async function embedTexts(texts: string[], options?: {
  model?: string;
  apiKey?: string;
  baseURL?: string;
}): Promise<number[][]> {
  if (!Array.isArray(texts) || texts.length === 0) return [];

  const { default: OpenAI } = await import('openai');
  const client = new OpenAI({
    apiKey: options?.apiKey || env.RAG_EMBEDDINGS_API_KEY,
    baseURL: options?.baseURL || env.RAG_EMBEDDINGS_BASE_URL,
  });

  const model = options?.model || env.RAG_EMBEDDINGS_MODEL || 'text-embedding-3-small';

  const res = await client.embeddings.create({
    model,
    input: texts,
  });

  return res.data.map((d) => d.embedding as unknown as number[]);
}
