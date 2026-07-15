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
  check,
} from 'drizzle-orm/pg-core';
import { InferSelectModel, InferInsertModel, sql } from 'drizzle-orm';
import { resolveRagVectorDimension } from '../lib/rag/vectorDimension';

const RAG_VECTOR_DIM = resolveRagVectorDimension(
  process.env.RAG_EMBEDDINGS_DIM
);

// 定义 users 表，符合 NextAuth 需求
export const users = pgTable('users', {
  id: varchar('id', { length: 255 }).notNull().primaryKey(),
  name: text('name'),
  email: varchar('email', { length: 256 }).notNull().unique(),
  emailVerified: timestamp('email_verified', { mode: 'date' }),
  image: text('image'),
  settings: jsonb('settings'), // 用户设置及其内部版本由 JSON 自身管理
  role: varchar('role', { length: 50 }).default('user').notNull(),
  createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'date' }).defaultNow().notNull(),
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
    expiresIdx: index('sessions_expires_idx').on(session.expires),
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
    expiresIdx: index('verification_tokens_expires_idx').on(vt.expires),
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
    namespace: varchar('namespace', { length: 128 })
      .default('global')
      .notNull(),
    sourceId: varchar('source_id', { length: 255 }),
    contentHash: varchar('content_hash', { length: 64 }),
    chunkIndex: integer('chunk_index'),
    createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { mode: 'date' }).defaultNow().notNull(),
  },
  (table) => ({
    // 'hnsw' 是算法，'vector_cosine_ops' 是用于余弦相似度的操作符
    embeddingIndex: index('rag_documents_embedding_idx').using(
      'hnsw',
      table.embedding.op('vector_cosine_ops')
    ),
    // Full-text search index (GIN)
    ftsIndex: index('rag_documents_fts_idx').using(
      'gin',
      sql`to_tsvector('english', ${table.textSnippet})`
    ),
    sourceIdx: index('rag_documents_namespace_source_idx').on(
      table.namespace,
      table.sourceId
    ),
    contentHashIdx: index('rag_documents_content_hash_idx').on(
      table.contentHash
    ),
    chunkIndexCheck: check(
      'rag_documents_chunk_index_check',
      sql`${table.chunkIndex} IS NULL OR ${table.chunkIndex} >= 0`
    ),
  })
);

export type RagDocument = InferSelectModel<typeof ragDocuments>;
export type NewRagDocument = InferInsertModel<typeof ragDocuments>;

// 定义 projects 表
export const projects = pgTable(
  'projects',
  {
    id: varchar('id', { length: 255 }).notNull().primaryKey(),
    name: text('name').notNull(),
    description: text('description'),
    data: jsonb('data').notNull(), // 存储 canvas JSON 数据
    metadata: jsonb('metadata').default({}).notNull(), // 标签、封面等开放扩展信息
    schemaVersion: integer('schema_version').default(1).notNull(),
    revision: integer('revision').default(1).notNull(),
    isPreset: boolean('is_preset').default(false).notNull(),
    archivedAt: timestamp('archived_at', { mode: 'date' }),
    createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { mode: 'date' }).defaultNow().notNull(),
  },
  (table) => ({
    updatedAtIdx: index('projects_updated_at_idx').on(table.updatedAt),
    presetUpdatedAtIdx: index('projects_preset_updated_at_idx').on(
      table.isPreset,
      table.updatedAt
    ),
    archivedAtIdx: index('projects_archived_at_idx').on(table.archivedAt),
    schemaVersionCheck: check(
      'projects_schema_version_check',
      sql`${table.schemaVersion} > 0`
    ),
    revisionCheck: check('projects_revision_check', sql`${table.revision} > 0`),
  })
);

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
    role: varchar('role', { length: 50 }).default('owner').notNull(),
    metadata: jsonb('metadata').default({}).notNull(),
    createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { mode: 'date' }).defaultNow().notNull(),
  },
  (t) => ({
    pk: primaryKey(t.userId, t.projectId),
    projectIdIdx: index('users_to_projects_project_id_idx').on(t.projectId),
    roleCheck: check(
      'users_to_projects_role_check',
      sql`role IN ('owner', 'editor', 'viewer')`
    ),
  })
);

// 导出新增的 TypeScript 类型
export type Project = InferSelectModel<typeof projects>;
export type NewProject = InferInsertModel<typeof projects>;
export type UserToProject = InferSelectModel<typeof usersToProjects>;
export type NewUserToProject = InferInsertModel<typeof usersToProjects>;

// Define checkpoints table
export const checkpoints = pgTable(
  'checkpoints',
  {
    id: varchar('id', { length: 255 }).notNull().primaryKey(),
    userId: varchar('user_id', { length: 255 })
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    messages: jsonb('messages').notNull(), // Chat history
    graphState: jsonb('graph_state').notNull(), // Nodes and edges snapshot
    metadata: jsonb('metadata').default({}).notNull(),
    schemaVersion: integer('schema_version').default(1).notNull(),
    createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { mode: 'date' }).defaultNow().notNull(),
  },
  (table) => ({
    userCreatedAtIdx: index('checkpoints_user_created_at_idx').on(
      table.userId,
      table.createdAt
    ),
    schemaVersionCheck: check(
      'checkpoints_schema_version_check',
      sql`${table.schemaVersion} > 0`
    ),
  })
);

export type Checkpoint = InferSelectModel<typeof checkpoints>;
export type NewCheckpoint = InferInsertModel<typeof checkpoints>;

// LangGraph Checkpoints Table
export const langgraphCheckpoints = pgTable(
  'langgraph_checkpoints',
  {
    thread_id: text('thread_id').notNull(),
    checkpoint_id: text('checkpoint_id').notNull(),
    parent_checkpoint_id: text('parent_checkpoint_id'),
    checkpoint: jsonb('checkpoint').notNull(),
    metadata: jsonb('metadata').notNull(),
    createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { mode: 'date' }).defaultNow().notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.thread_id, table.checkpoint_id] }),
    threadCreatedAtIdx: index('langgraph_checkpoints_thread_created_at_idx').on(
      table.thread_id,
      table.createdAt
    ),
  })
);

// LangGraph Writes Table
export const langgraphWrites = pgTable(
  'langgraph_writes',
  {
    thread_id: text('thread_id').notNull(),
    checkpoint_id: text('checkpoint_id').notNull(),
    task_id: text('task_id').notNull(),
    idx: integer('idx').notNull(),
    channel: text('channel').notNull(),
    value: jsonb('value'),
  },
  (table) => ({
    pk: primaryKey({
      columns: [table.thread_id, table.checkpoint_id, table.task_id, table.idx],
    }),
  })
);
