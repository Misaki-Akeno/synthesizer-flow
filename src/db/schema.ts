// src/db/schema.ts

import {
  pgTable,
  integer,
  varchar,
  text,
  timestamp,
  primaryKey,
  index,
  jsonb,
  vector,
} from 'drizzle-orm/pg-core';
import { InferSelectModel, InferInsertModel, sql } from 'drizzle-orm';

const RAG_VECTOR_DIM =
  Number(process.env.RAG_EMBEDDINGS_DIM) && Number.isFinite(Number(process.env.RAG_EMBEDDINGS_DIM))
    ? Number(process.env.RAG_EMBEDDINGS_DIM)
    : 1536;

// 定义 users 表，符合 NextAuth 需求
export const users = pgTable('users', {
  id: varchar('id', { length: 255 }).notNull().primaryKey(),
  name: text('name'),
  email: varchar('email', { length: 256 }).notNull().unique(),
  emailVerified: timestamp('email_verified', { mode: 'date' }),
  image: text('image'),
});

// 定义 accounts 表 (OAuth 认证需要)
export const accounts = pgTable(
  'accounts',
  {
    userId: varchar('user_id', { length: 255 })
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: varchar('type', { length: 255 }).notNull(),
    provider: varchar('provider', { length: 255 }).notNull(),
    providerAccountId: varchar('provider_account_id', {
      length: 255,
    }).notNull(),
    refresh_token: text('refresh_token'),
    access_token: text('access_token'),
    // 注意：expires_at 应为时间戳（秒）或毫秒数，使用整数类型而非 serial 自增
    expires_at: integer('expires_at'),
    token_type: varchar('token_type', { length: 255 }),
    scope: varchar('scope', { length: 255 }),
    id_token: text('id_token'),
    session_state: varchar('session_state', { length: 255 }),
  },
  (account) => ({
    compoundKey: primaryKey(account.provider, account.providerAccountId),
    // 常用查询索引
    userIdIdx: index('accounts_user_id_idx').on(account.userId),
  })
);

// 定义 sessions 表 (会话管理需要)
export const sessions = pgTable(
  'sessions',
  {
    sessionToken: varchar('session_token', { length: 255 })
      .notNull()
      .primaryKey(),
    userId: varchar('user_id', { length: 255 })
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    expires: timestamp('expires', { mode: 'date' }).notNull(),
  },
  (session) => ({
    userIdIdx: index('sessions_user_id_idx').on(session.userId),
  })
);

// 定义 verification_tokens 表 (邮箱验证需要)
export const verificationTokens = pgTable(
  'verification_tokens',
  {
    identifier: varchar('identifier', { length: 255 }).notNull(),
    token: varchar('token', { length: 255 }).notNull(),
    expires: timestamp('expires', { mode: 'date' }).notNull(),
  },
  (vt) => ({
    compoundKey: primaryKey(vt.identifier, vt.token),
    identifierIdx: index('verification_tokens_identifier_idx').on(
      vt.identifier
    ),
  })
);

// 导出 TypeScript 类型
export type User = InferSelectModel<typeof users>;
export type NewUser = InferInsertModel<typeof users>;
export type Account = InferSelectModel<typeof accounts>;
export type Session = InferSelectModel<typeof sessions>;
export type VerificationToken = InferSelectModel<typeof verificationTokens>;

// pgvector extension (Vercel Postgres already ships with it, but ensure enabled in migrations)
export const vectorExtension = sql`create extension if not exists vector`;

// RAG documents table with pgvector embedding column
export const ragDocuments = pgTable(
  'rag_documents',
  {
    id: varchar('id', { length: 255 }).notNull().primaryKey(),
    textSnippet: text('text_snippet').notNull(),
    embedding: vector('embedding', { dimensions: RAG_VECTOR_DIM }).notNull(),
    meta: jsonb('meta'),
    model: varchar('model', { length: 255 }).notNull(),
    createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { mode: 'date' }).defaultNow().notNull(),
  },
  (table) => ({
    // 'hnsw' 是算法，'vector_cosine_ops' 是用于余弦相似度的操作符
    embeddingIndex: index('rag_documents_embedding_idx').using(
      'hnsw',
      table.embedding.op('vector_cosine_ops')
    ),
  })
);

export type RagDocument = InferSelectModel<typeof ragDocuments>;
export type NewRagDocument = InferInsertModel<typeof ragDocuments>;
