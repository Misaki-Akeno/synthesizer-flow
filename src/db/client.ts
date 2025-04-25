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
  // 增加连接超时设置
  connectionTimeoutMillis: 30000, // 增加到30秒
  // 添加连接池设置
  max: 20, // 最大连接数
  idleTimeoutMillis: 30000, // 空闲连接超时
  // 添加重试策略
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

// 添加连接错误处理
pool.on('error', (err) => {
  console.error('PostgreSQL 连接池错误:', err);
});

// 检查连接是否有效
async function testConnection() {
  try {
    const client = await pool.connect();
    client.release();
    return true;
  } catch (error) {
    console.error('数据库连接失败:', error);
    return false;
  }
}

// 尝试测试连接，添加重试逻辑
let connectionAttempts = 0;
const maxRetries = 3;

async function establishConnection() {
  while (connectionAttempts < maxRetries) {
    try {
      const connected = await testConnection();
      if (connected) return;
    } catch (err) {
      console.error(`连接尝试 ${connectionAttempts + 1}/${maxRetries} 失败:`, err);
    }
    
    connectionAttempts++;
    if (connectionAttempts < maxRetries) {
      console.info(`将在5秒后重试连接...`);
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
  
  if (connectionAttempts >= maxRetries) {
    console.error(`在 ${maxRetries} 次尝试后无法连接到数据库`);
  }
}

// 尝试建立连接
establishConnection().catch((err) => console.error('连接过程出现异常:', err));

// 导出 Drizzle ORM 实例，后续可直接通过 db 调用
export const db = drizzle(pool);
