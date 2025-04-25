// src/lib/env.ts
import { z } from 'zod';
import { createModuleLogger } from './logger';

// 创建环境变量专用日志记录器
const logger = createModuleLogger('Environment');

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
});

/**
 * 安全地解析环境变量并提供类型支持
 */
function parseEnv() {
  // 在服务端，环境变量可以直接访问
  const env = {
    DATABASE_URL: process.env.DATABASE_URL || '',
    GITHUB_ID: process.env.GITHUB_ID || '',
    GITHUB_SECRET: process.env.GITHUB_SECRET || '',
    NEXTAUTH_URL: process.env.NEXTAUTH_URL,
    NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET || '',
  };

  try {
    return envSchema.parse(env);
  } catch (error) {
    // 捕获所有验证失败的环境变量
    logger.error('❌ 环境变量验证失败:', error);
    throw new Error('环境变量配置错误，请检查.env文件');
  }
}

export const env = parseEnv();
