// src/lib/auth/auth.ts
import NextAuth from "next-auth";
import { DefaultSession } from "next-auth";
import { authConfig } from "./auth.config";
import { DrizzleAdapter } from "./drizzle-adapter";
import { db } from "@/db/client";

/**
 * 增强的NextAuth配置，包含适配器
 */
export const { auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: DrizzleAdapter(db),
});

// 扩展会话类型，包含用户ID
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
    } & DefaultSession["user"];
  }
}