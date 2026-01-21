// src/lib/auth/auth.ts
import { getServerSession, DefaultSession } from 'next-auth';
import { authConfig } from './auth.config';
import { DrizzleAdapter } from './drizzle-adapter';
import { db } from '@/db/client';

/**
 * 完整的 NextAuth 选项，包含适配器
 */
export const authOptions = {
  ...authConfig,
  adapter: DrizzleAdapter(db),
};

/**
 * 获取服务端的 Session
 * 模拟 NextAuth v5 的 auth() helper
 */
export const auth = () => getServerSession(authOptions);

// 扩展会话类型，包含用户ID
declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
    } & DefaultSession['user'];
  }
}
