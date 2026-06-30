// src/lib/env.ts
import { z } from 'zod';

/**
 * 使用zod定义并验证环境变量
 */
const envSchema = z.object({
  // 数据库配置
  DATABASE_URL: z.string().min(1, { message: 'DATABASE_URL必须设置' }),

  // GitHub OAuth配置
  GITHUB_ID: z.string().min(1, { message: 'GITHUB_ID必须设置' }),
  GITHUB_SECRET: z.string().min(1, { message: 'GITHUB_SECRET必须设置' }),

  // NextAuth配置
  NEXTAUTH_URL: z.string().url().optional(),
  NEXTAUTH_SECRET: z.string().min(1, { message: 'NEXTAUTH_SECRET必须设置' }),

  // RAG Embeddings 配置（可选）
  RAG_EMBEDDINGS_MODEL: z.string().optional(),
  RAG_EMBEDDINGS_API_KEY: z.string().optional(),
  RAG_EMBEDDINGS_BASE_URL: z.string().url().optional(),
  RAG_EMBEDDINGS_DIM: z.coerce.number().int().positive().optional(),
});

type EnvSource = Partial<
  Pick<
    NodeJS.ProcessEnv,
    | 'DATABASE_URL'
    | 'GITHUB_ID'
    | 'GITHUB_SECRET'
    | 'NEXTAUTH_URL'
    | 'NEXTAUTH_SECRET'
    | 'RAG_EMBEDDINGS_MODEL'
    | 'RAG_EMBEDDINGS_API_KEY'
    | 'RAG_EMBEDDINGS_BASE_URL'
    | 'RAG_EMBEDDINGS_DIM'
    | 'NODE_ENV'
  >
>;

function collectEnv(source: EnvSource) {
  return {
    DATABASE_URL: source.DATABASE_URL || '',
    GITHUB_ID: source.GITHUB_ID || '',
    GITHUB_SECRET: source.GITHUB_SECRET || '',
    // 在开发环境没有设置时，推断为 http://localhost:3000
    NEXTAUTH_URL:
      source.NEXTAUTH_URL ||
      (source.NODE_ENV !== 'production' ? 'http://localhost:3000' : undefined),
    NEXTAUTH_SECRET: source.NEXTAUTH_SECRET || '',

    RAG_EMBEDDINGS_MODEL: source.RAG_EMBEDDINGS_MODEL,
    RAG_EMBEDDINGS_API_KEY: source.RAG_EMBEDDINGS_API_KEY,
    RAG_EMBEDDINGS_BASE_URL: source.RAG_EMBEDDINGS_BASE_URL,
    RAG_EMBEDDINGS_DIM: source.RAG_EMBEDDINGS_DIM,
  };
}

function formatEnvIssue(issue: z.ZodIssue): string {
  const path = issue.path.join('.') || 'ENV';
  return `${path}: ${issue.message}`;
}

/**
 * 安全地解析环境变量并提供类型支持
 */
export function parseEnv(source: EnvSource = process.env) {
  const env = collectEnv(source);

  try {
    return envSchema.parse(env);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error(
        `环境变量配置错误，请检查.env文件: ${error.issues
          .map(formatEnvIssue)
          .join('; ')}`
      );
    }

    throw error;
  }
}

export const env = parseEnv();
