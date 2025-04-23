// src/db/client.ts

import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';

// 初始化 PostgreSQL 连接池
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// 导出 Drizzle ORM 实例，后续可直接通过 db 调用
export const db = drizzle(pool);