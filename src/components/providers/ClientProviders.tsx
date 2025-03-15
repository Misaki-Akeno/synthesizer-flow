'use client';

import React from 'react';
import ContextMenuProvider from './ContextMenuProvider';

interface ClientProvidersProps {
  children: React.ReactNode;
}

/**
 * 客户端提供器统一组件
 * 
 * 集中管理所有需要客户端渲染的全局提供器
 * 这样可以使整个应用架构更清晰，方便扩展添加新的提供器
 */
const ClientProviders: React.FC<ClientProvidersProps> = ({ children }) => {
  return (
    <ContextMenuProvider>
      {/* 未来可以在这里添加其他的提供器，例如主题、认证等 */}
      {children}
    </ContextMenuProvider>
  );
};

export default ClientProviders;
