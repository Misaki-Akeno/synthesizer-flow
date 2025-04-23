// src/db/schema.ts

import { pgTable, serial, varchar, text, timestamp } from 'drizzle-orm/pg-core';
import { InferSelectModel, InferInsertModel } from 'drizzle-orm';

// 定义 users 表，符合 NextAuth 最简需求
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  name: text('name'),
  email: varchar('email', { length: 256 }).notNull().unique(),
  emailVerified: timestamp('email_verified', { mode: 'date' }),
  image: text('image'),
});

// 导出 TypeScript 类型
export type User = InferSelectModel<typeof users>;
export type NewUser = InferInsertModel<typeof users>;