// src/lib/auth/auth.config.ts
import type { AuthOptions } from "next-auth";
import GitHubProvider from "next-auth/providers/github";
import { env } from "@/lib/env";

/**
 * NextAuth配置，在客户端和服务端共享
 */
export const authConfig: AuthOptions = {
  // 配置认证提供者
  providers: [
    GitHubProvider({
      clientId: env.GITHUB_ID,
      clientSecret: env.GITHUB_SECRET,
    }),
  ],
  
  // 自定义登录页面路径
  pages: {
    signIn: "/auth/login",
  },
  
  // 回调函数
  callbacks: {
    // 确保用户ID添加到会话中
    session({ session, user, token }) {
      if (session.user && user) {
        session.user.id = user.id;
      } else if (session.user && token) {
        session.user.id = token.sub as string;
      }
      return session;
    },
    // 添加额外的JWT令牌处理
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
  },
  
  // 调试模式
  debug: process.env.NODE_ENV === "development",
};