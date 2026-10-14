'use client';

import { SessionProvider, useSession } from 'next-auth/react';
import { ReactNode, useEffect } from 'react';
import { useProjectStore } from '@/store/projects-store';

interface AuthProviderProps {
  children: ReactNode;
}

function ProjectOwnerBoundary({ children }: AuthProviderProps) {
  const { data: session, status } = useSession();
  const hydrated = useProjectStore((state) => state.hasHydratedProjects);
  const ownerId = useProjectStore((state) => state.projectOwnerId);
  const userId = session?.user?.id ?? null;
  useEffect(() => {
    // next-auth v4 在 session 请求失败（离线、服务端暂时出错）时也会报告为
    // 未登录，不能据此清空草稿。只由已登录账号认领或切换缓存；
    // 退出登录由 NavUser 显式清空。
    if (status === 'loading' || !hydrated || !userId) return;
    void useProjectStore.getState().setProjectOwner(userId);
  }, [status, hydrated, userId]);
  // 先完成账号隔离，再让画布恢复缓存或启用自动保存。
  if (status === 'loading' || !hydrated || (userId && ownerId !== userId)) {
    return null;
  }
  return children;
}

/**
 * 提供全局认证状态的组件
 *
 * 包装整个应用，确保会话状态在客户端组件中可用
 */
export function AuthProvider({ children }: AuthProviderProps) {
  return (
    <SessionProvider refetchInterval={60} refetchOnWindowFocus={true}>
      <ProjectOwnerBoundary>{children}</ProjectOwnerBoundary>
    </SessionProvider>
  );
}
