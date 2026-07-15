// src/app/api/auth/[...nextauth]/route.ts
import NextAuth from 'next-auth';
import { authOptions } from '@/lib/auth/auth';

// 确保在 Node.js Runtime 下运行，避免 Edge 环境下超时/代理问题
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

/**
 * 专用于 API 路由的 NextAuth 处理程序
 * 确保与 App Router 兼容
 */
const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
