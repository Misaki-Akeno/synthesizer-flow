/* eslint-disable @typescript-eslint/no-explicit-any */
// src/lib/auth/drizzle-adapter.ts
import { and, eq } from 'drizzle-orm';
import type { PgDatabase } from 'drizzle-orm/pg-core';
import {
  Adapter,
  AdapterAccount,
  AdapterSession,
  AdapterUser,
  VerificationToken as AdapterVerificationToken,
} from 'next-auth/adapters';
import { accounts, sessions, users, verificationTokens } from '@/db/schema';
import { nanoid } from 'nanoid';

export function DrizzleAdapter(db: PgDatabase<any, any, any>): Adapter {
  return {
    // 创建用户
    async createUser(data: Omit<AdapterUser, 'id'>): Promise<AdapterUser> {
      const id = nanoid();
      await db.insert(users).values({
        id,
        email: data.email,
        emailVerified: data.emailVerified,
        name: data.name,
        image: data.image,
      });

      const result = await db.select().from(users).where(eq(users.id, id));

      const user = result[0];
      if (!user) throw new Error('Failed to create user');

      return {
        id: user.id,
        email: user.email,
        emailVerified: user.emailVerified,
        name: user.name || null,
        image: user.image || null,
      };
    },

    // 获取用户
    async getUser(id: string): Promise<AdapterUser | null> {
      const result = await db.select().from(users).where(eq(users.id, id));

      const user = result[0];
      if (!user) return null;

      return {
        id: user.id,
        email: user.email,
        emailVerified: user.emailVerified,
        name: user.name || null,
        image: user.image || null,
      };
    },

    // 通过邮箱获取用户
    async getUserByEmail(email: string): Promise<AdapterUser | null> {
      const result = await db
        .select()
        .from(users)
        .where(eq(users.email, email));

      const user = result[0];
      if (!user) return null;

      return {
        id: user.id,
        email: user.email,
        emailVerified: user.emailVerified,
        name: user.name || null,
        image: user.image || null,
      };
    },

    // 通过账号获取用户
    async getUserByAccount({
      provider,
      providerAccountId,
    }: {
      provider: string;
      providerAccountId: string;
    }): Promise<AdapterUser | null> {
      const result = await db
        .select({
          user: users,
        })
        .from(accounts)
        .innerJoin(users, eq(users.id, accounts.userId))
        .where(
          and(
            eq(accounts.provider, provider),
            eq(accounts.providerAccountId, providerAccountId)
          )
        );

      const { user } = result[0] || { user: null };
      if (!user) return null;

      return {
        id: user.id,
        email: user.email,
        emailVerified: user.emailVerified,
        name: user.name || null,
        image: user.image || null,
      };
    },

    // 更新用户
    async updateUser(
      data: Partial<AdapterUser> & { id: string }
    ): Promise<AdapterUser> {
      if (!data.id) throw new Error('User ID is required');

      const { id, ...userData } = data;

      await db.update(users).set(userData).where(eq(users.id, id));

      const result = await db.select().from(users).where(eq(users.id, id));

      const user = result[0];
      if (!user) throw new Error('Failed to update user');

      return {
        id: user.id,
        email: user.email,
        emailVerified: user.emailVerified,
        name: user.name || null,
        image: user.image || null,
      };
    },

    // 删除用户
    async deleteUser(userId: string): Promise<void> {
      await db.delete(users).where(eq(users.id, userId));
    },

    // 关联账号
    async linkAccount(data: AdapterAccount): Promise<AdapterAccount> {
      await db.insert(accounts).values({
        userId: data.userId,
        type: data.type,
        provider: data.provider,
        providerAccountId: data.providerAccountId,
        refresh_token: data.refresh_token,
        access_token: data.access_token,
        expires_at: data.expires_at as any,
        token_type: data.token_type,
        scope: data.scope,
        id_token: data.id_token,
        session_state: data.session_state,
      });

      return data;
    },

    // 取消关联账号
    async unlinkAccount({
      provider,
      providerAccountId,
    }: {
      provider: string;
      providerAccountId: string;
    }): Promise<void> {
      await db
        .delete(accounts)
        .where(
          and(
            eq(accounts.provider, provider),
            eq(accounts.providerAccountId, providerAccountId)
          )
        );
    },

    // 创建会话
    async createSession(data: {
      sessionToken: string;
      userId: string;
      expires: Date;
    }): Promise<AdapterSession> {
      await db.insert(sessions).values(data);

      const result = await db
        .select()
        .from(sessions)
        .where(eq(sessions.sessionToken, data.sessionToken));

      const session = result[0];
      if (!session) throw new Error('Failed to create session');

      return {
        sessionToken: session.sessionToken,
        userId: session.userId,
        expires: session.expires,
      };
    },

    // 获取会话和用户
    async getSessionAndUser(sessionToken: string): Promise<{
      session: AdapterSession;
      user: AdapterUser;
    } | null> {
      const result = await db
        .select({
          session: sessions,
          user: users,
        })
        .from(sessions)
        .innerJoin(users, eq(users.id, sessions.userId))
        .where(eq(sessions.sessionToken, sessionToken));

      const data = result[0];
      if (!data) return null;

      const { session, user } = data;

      return {
        session: {
          sessionToken: session.sessionToken,
          userId: session.userId,
          expires: session.expires,
        },
        user: {
          id: user.id,
          email: user.email,
          emailVerified: user.emailVerified,
          name: user.name || null,
          image: user.image || null,
        },
      };
    },

    // 更新会话
    async updateSession(
      data: Partial<AdapterSession> & { sessionToken: string }
    ): Promise<AdapterSession | null> {
      const { sessionToken, ...sessionData } = data;

      await db
        .update(sessions)
        .set(sessionData)
        .where(eq(sessions.sessionToken, sessionToken));

      const result = await db
        .select()
        .from(sessions)
        .where(eq(sessions.sessionToken, sessionToken));

      const session = result[0];
      if (!session) return null;

      return {
        sessionToken: session.sessionToken,
        userId: session.userId,
        expires: session.expires,
      };
    },

    // 删除会话
    async deleteSession(sessionToken: string): Promise<void> {
      await db.delete(sessions).where(eq(sessions.sessionToken, sessionToken));
    },

    // 创建验证令牌
    async createVerificationToken(data: {
      identifier: string;
      token: string;
      expires: Date;
    }): Promise<AdapterVerificationToken> {
      await db.insert(verificationTokens).values(data);

      const result = await db
        .select()
        .from(verificationTokens)
        .where(
          and(
            eq(verificationTokens.identifier, data.identifier),
            eq(verificationTokens.token, data.token)
          )
        );

      const verificationToken = result[0];
      if (!verificationToken)
        throw new Error('Failed to create verification token');

      return {
        identifier: verificationToken.identifier,
        token: verificationToken.token,
        expires: verificationToken.expires,
      };
    },

    // 使用验证令牌
    async useVerificationToken({
      identifier,
      token,
    }: {
      identifier: string;
      token: string;
    }): Promise<AdapterVerificationToken | null> {
      const result = await db
        .select()
        .from(verificationTokens)
        .where(
          and(
            eq(verificationTokens.identifier, identifier),
            eq(verificationTokens.token, token)
          )
        );

      const verificationToken = result[0];
      if (!verificationToken) return null;

      await db
        .delete(verificationTokens)
        .where(
          and(
            eq(verificationTokens.identifier, identifier),
            eq(verificationTokens.token, token)
          )
        );

      return {
        identifier: verificationToken.identifier,
        token: verificationToken.token,
        expires: verificationToken.expires,
      };
    },
  };
}
