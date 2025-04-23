// src/app/api/auth/[...nextauth]/route.ts
import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth/auth.config";
import { DrizzleAdapter } from "@/lib/auth/drizzle-adapter";
import { db } from "@/db/client";

/**
 * 专用于 API 路由的 NextAuth 处理程序
 * 确保与 App Router 兼容
 */
const handler = NextAuth({
  ...authConfig,
  adapter: DrizzleAdapter(db),
});

export { handler as GET, handler as POST };