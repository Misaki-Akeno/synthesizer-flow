import { Session } from 'next-auth';

/**
 * 角色枚举定义
 */
export enum Role {
  ADMIN = 'admin',
  USER = 'user',
}

/**
 * 权限定义，可以更精细化，目前主要区分 admin 和 user
 */
export const PERMISSIONS = {
  SAVE_PRESET: [Role.ADMIN],
  RAG_INGEST: [Role.ADMIN],
  RAG_SEARCH: [Role.ADMIN, Role.USER], // 默认普通用户也能搜索，但 ingest 只能 admin
  ACCESS_DEV_TOOLS: [Role.ADMIN],
};

/**
 * 校验权限的核心函数
 * @param session 当前会话
 * @param requiredRoles 需要的角色列表（或权限名，目前先根据角色）
 */
export function hasPermission(session: Session | null, requiredRoles: Role[]): boolean {
  if (!session?.user?.role) return false;
  return requiredRoles.includes(session.user.role as Role);
}

/**
 * 专门用于判定是否是 Admin 的辅助函数
 */
export function isAdmin(session: Session | null): boolean {
  return session?.user?.role === Role.ADMIN;
}
