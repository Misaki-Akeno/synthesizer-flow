// src/db/client.ts

import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { env } from '@/lib/env';

import * as schema from './schema';

// 初始化 PostgreSQL 连接池（在无 DATABASE_URL 时保持懒加载失败，避免开发模式报噪音）
// 保存数据库连接的全局对象，防止开发环境下热重载导致连接数耗尽
const globalForDb = globalThis as unknown as {
  conn: Pool | undefined;
};

// 判断是否需要 SSL (Neon 等云数据库通常需要)
// 如果是本地数据库(localhost)，通常不需要 SSL，否则默认开启 permissive SSL
const sslConfig = env.DATABASE_URL.includes('localhost') || env.DATABASE_URL.includes('127.0.0.1')
  ? false
  : { rejectUnauthorized: false };

const pool = globalForDb.conn ?? new Pool({
  connectionString: env.DATABASE_URL,
  connectionTimeoutMillis: 10_000, // 降低超时时间以便快速失败
  idleTimeoutMillis: 30_000,
  max: 10,
  ssl: sslConfig,
});

if (process.env.NODE_ENV !== 'production') globalForDb.conn = pool;

export const db = drizzle(pool, { schema });
