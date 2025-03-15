'use client';

import React, { useEffect } from 'react';
import ContextMenu from '../menu/ContextMenu';
import { Services } from '@/core/services/ServiceAccessor';

interface ContextMenuProviderProps {
  children: React.ReactNode;
}

const ContextMenuProvider: React.FC<ContextMenuProviderProps> = ({ children }) => {
  // 确保服务在客户端环境中初始化
  useEffect(() => {
    Services.contextMenuService.ensureInitialized();
  }, []);

  return (
    <>
      {children}
      <ContextMenu />
    </>
  );
};

export default ContextMenuProvider;
