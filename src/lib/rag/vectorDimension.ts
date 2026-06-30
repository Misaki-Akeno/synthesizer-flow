// 与现有 Drizzle 迁移中的 rag_documents.embedding vector(1024) 保持一致。
export const DEFAULT_RAG_VECTOR_DIMENSION = 1024;

export function resolveRagVectorDimension(value: unknown): number {
  if (typeof value === 'number') {
    return Number.isInteger(value) && value > 0
      ? value
      : DEFAULT_RAG_VECTOR_DIMENSION;
  }

  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0
      ? parsed
      : DEFAULT_RAG_VECTOR_DIMENSION;
  }

  return DEFAULT_RAG_VECTOR_DIMENSION;
}
