'use client';

import React, { useEffect, useRef } from 'react';
import { MenuItem, MenuContext } from '@/core/services/ContextMenuService';
import { Services } from '@/core/services/ServiceAccessor';
import { useObservable } from '@/hooks/useObservable';

// 菜单项组件
const MenuItemComponent = ({ item }: { item: MenuItem }) => {
  return (
    <div
      className={`
        px-4 py-2 flex items-center gap-2 text-sm
        ${item.divider ? 'border-t border-gray-200 mt-1 pt-1' : ''}
        ${item.disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:bg-gray-100'}
      `}
      onClick={item.disabled ? undefined : item.action}
    >
      {item.icon && <span>{item.icon}</span>}
      <span>{item.label}</span>
    </div>
  );
};

const ContextMenu: React.FC = () => {
  // 获取上下文菜单服务的菜单上下文
  const menuContext = useObservable<MenuContext>(
    Services.contextMenuService.getMenuContext(),
    {
      position: { x: 0, y: 0 },
      sourceId: '',
      sourceType: 'pane',
      isOpen: false,
      items: [],
    }
  );

  const menuRef = useRef<HTMLDivElement>(null);

  // 处理窗口大小变化，确保菜单不会超出视口
  useEffect(() => {
    if (menuContext.isOpen && menuRef.current) {
      const menu = menuRef.current;
      const rect = menu.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      // 检查菜单是否超出视口右侧
      if (menuContext.position.x + rect.width > viewportWidth) {
        menu.style.left = `${viewportWidth - rect.width - 5}px`;
      } else {
        menu.style.left = `${menuContext.position.x}px`;
      }

      // 检查菜单是否超出视口底部
      if (menuContext.position.y + rect.height > viewportHeight) {
        menu.style.top = `${viewportHeight - rect.height - 5}px`;
      } else {
        menu.style.top = `${menuContext.position.y}px`;
      }
    }
  }, [menuContext.isOpen, menuContext.position]);

  if (!menuContext.isOpen) {
    return null;
  }

  // 阻止冒泡，防止点击菜单时关闭它
  const handleContextMenuClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  return (
    <div
      ref={menuRef}
      className="fixed z-50 bg-white rounded-md shadow-lg border border-gray-200 py-1 min-w-[180px] max-w-[300px]"
      style={{
        left: `${menuContext.position.x}px`,
        top: `${menuContext.position.y}px`,
      }}
      onClick={handleContextMenuClick}
    >
      {menuContext.items.map((item) => (
        <MenuItemComponent key={item.id} item={item} />
      ))}
    </div>
  );
};

export default ContextMenu;
