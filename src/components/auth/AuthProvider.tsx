'use client';

import { SessionProvider } from 'next-auth/react';
import { ReactNode } from 'react';

interface AuthProviderProps {
  children: ReactNode;
}

/**
 * 提供全局认证状态的组件
 * 
 * 包装整个应用，确保会话状态在客户端组件中可用
 */
export function AuthProvider({ children }: AuthProviderProps) {
  return (
    <SessionProvider refetchInterval={0} refetchOnWindowFocus={false}>
      {children}
    </SessionProvider>
  );
}