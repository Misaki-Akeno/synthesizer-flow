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
  boolean,
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
  settings: jsonb('settings'), // 用户设置
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

// 定义 projects 表
export const projects = pgTable('projects', {
  id: varchar('id', { length: 255 }).notNull().primaryKey(),
  name: text('name').notNull(),
  data: jsonb('data').notNull(), // 存储 canvas JSON 数据
  isPreset: boolean('is_preset').default(false).notNull(), // 是否为内置预设
  createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'date' }).defaultNow().notNull(),
});

// 定义 users_to_projects 表 (多对多关联)
export const usersToProjects = pgTable(
  'users_to_projects',
  {
    userId: varchar('user_id', { length: 255 })
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    projectId: varchar('project_id', { length: 255 })
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    // 可以添加角色字段，例如 'owner', 'editor', 'viewer'
    role: varchar('role', { length: 50 }).default('owner').notNull(),
  },
  (t) => ({
    pk: primaryKey(t.userId, t.projectId),
    userIdIdx: index('users_to_projects_user_id_idx').on(t.userId),
    projectIdIdx: index('users_to_projects_project_id_idx').on(t.projectId),
  })
);

// 导出新增的 TypeScript 类型
export type Project = InferSelectModel<typeof projects>;
export type NewProject = InferInsertModel<typeof projects>;
export type UserToProject = InferSelectModel<typeof usersToProjects>;
export type NewUserToProject = InferInsertModel<typeof usersToProjects>;
