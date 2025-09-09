// src/db/client.ts

import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { env } from '@/lib/env';

// 初始化 PostgreSQL 连接池（在无 DATABASE_URL 时保持懒加载失败，避免开发模式报噪音）
const pool = new Pool({
  connectionString: env.DATABASE_URL,
  connectionTimeoutMillis: 15_000,
  idleTimeoutMillis: 30_000,
  max: 10,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

export const db = drizzle(pool);
