// src/app/api/auth/[...nextauth]/route.ts
import NextAuth from 'next-auth';
import { authConfig } from '@/lib/auth/auth.config';
import { DrizzleAdapter } from '@/lib/auth/drizzle-adapter';
import { db } from '@/db/client';

// 确保在 Node.js Runtime 下运行，避免 Edge 环境下超时/代理问题
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

/**
 * 专用于 API 路由的 NextAuth 处理程序
 * 确保与 App Router 兼容
 */
const handler = NextAuth({
  ...authConfig,
  adapter: DrizzleAdapter(db),
});

export { handler as GET, handler as POST };
