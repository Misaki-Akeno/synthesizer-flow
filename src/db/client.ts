// src/db/client.ts

import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';

// 检查环境变量
if (!process.env.DATABASE_URL) {
  console.error('警告: 未设置 DATABASE_URL 环境变量');
}

// 初始化 PostgreSQL 连接池
const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  // 添加连接超时设置
  connectionTimeoutMillis: 8000,
});

// 添加连接错误处理
pool.on('error', (err) => {
  console.error('PostgreSQL 连接池错误:', err);
});

// 检查连接是否有效
async function testConnection() {
  try {
    const client = await pool.connect();
    console.log('数据库连接成功');
    client.release();
    return true;
  } catch (error) {
    console.error('数据库连接失败:', error);
    return false;
  }
}

// 尝试测试连接
testConnection().catch(console.error);

// 导出 Drizzle ORM 实例，后续可直接通过 db 调用
export const db = drizzle(pool);