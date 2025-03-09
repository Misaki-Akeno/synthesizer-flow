'use client';

import * as React from 'react';
import * as ContextMenu from '@radix-ui/react-context-menu';
import { cn } from '@/lib/utils';
import { MENU_ITEM_TYPES } from '@/constants/menuItemTypes';
import { MenuSection, MenuItem, SubMenu } from '@/components/ui/menu';
import { getMenuConfig } from '@/config/menuConfig';



/**
 * 流程图右键菜单组件
 * @param {Object} props
 * @param {number} props.top - 菜单Y坐标
 * @param {number} props.left - 菜单X坐标
 * @param {Function} props.onAddNode - 添加节点回调
 * @param {Function} props.onClose - 关闭菜单回调
 */
const FlowContextMenu = ({ top, left, onAddNode, onClose }) => {
  // 获取菜单配置
  const menuStructure = React.useMemo(
    () => getMenuConfig(onAddNode),
    [onAddNode]
  );

  // 渲染菜单项
  const renderMenuItem = React.useCallback(
    (item) => {
      const { type, id } = item;

      switch (type) {
        case MENU_ITEM_TYPES.SECTION:
          return <MenuSection key={id} {...item} />;

        case MENU_ITEM_TYPES.ITEM:
          return <MenuItem key={id} {...item} onClose={onClose} />;

        case MENU_ITEM_TYPES.SUBMENU:
          return <SubMenu key={id} {...item} renderMenuItem={renderMenuItem} />;

        default:
          return null;
      }
    },
    [onClose]
  );

  return (
    <div
      className="absolute z-50"
      style={{ top, left }}
      onClick={(e) => e.stopPropagation()}
    >
      <ContextMenu.Root
        modal={false}
        onOpenChange={(open) => !open && onClose()}
      >
        {/* 触发器元素 - 不可见的1x1像素点 */}
        <div
          style={{
            width: '1px',
            height: '1px',
            position: 'absolute',
            top: '0',
            left: '0',
            pointerEvents: 'none',
          }}
        >
          <ContextMenu.Trigger />
        </div>

        {/* 菜单内容 - 强制显示 */}
        <ContextMenu.Portal forceMount>
          <ContextMenu.Content
            className={cn(
              'bg-white dark:bg-slate-800 min-w-[12rem] overflow-hidden rounded-md border border-slate-200 dark:border-slate-700 shadow-md p-1'
            )}
            forceMount
            onEscapeKeyDown={onClose}
            onInteractOutside={onClose}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              transform: `translate(${left}px, ${top}px)`,
              zIndex: 9999,
            }}
          >
            {menuStructure.map((item) => renderMenuItem(item))}
          </ContextMenu.Content>
        </ContextMenu.Portal>
      </ContextMenu.Root>
    </div>
  );
};

export default React.memo(FlowContextMenu);
