import * as ContextMenu from '@radix-ui/react-context-menu';
import { cn } from '@/lib/utils/cn';
import { ChevronRightIcon } from '@radix-ui/react-icons';
import React, { JSX } from 'react';

// 导入或创建合适的菜单项类型
interface MenuItemBase {
  id: string;
  type: string;
}

interface MenuSectionProps {
  id: string;
  title?: string;
  label?: string;
}

export const MenuSection: React.FC<MenuSectionProps> = ({
  id,
  title,
  label,
}) => (
  <ContextMenu.Label
    key={id}
    className="text-xs font-medium text-slate-500 dark:text-slate-400 pl-4 pt-3 pb-1"
  >
    {title || label}
  </ContextMenu.Label>
);

interface MenuItemProps {
  id: string;
  label: string;
  onClick: () => void;
  onClose: () => void;
}

export const MenuItem: React.FC<MenuItemProps> = ({
  id,
  label,
  onClick,
  onClose,
}) => (
  <ContextMenu.Item
    key={id}
    className={cn(
      'relative flex cursor-pointer select-none items-center pl-6 pr-2 py-2 my-0.5 text-sm outline-none',
      'hover:bg-slate-100 dark:hover:bg-slate-700 rounded-sm'
    )}
    onSelect={(e) => {
      e.preventDefault();
      onClick();
      onClose();
    }}
  >
    {label}
  </ContextMenu.Item>
);

// 修改 SubMenuProps 接口，接受泛型类型的菜单项
interface SubMenuProps<T extends MenuItemBase = MenuItemBase> {
  id: string;
  label: string;
  items: T[];
  renderMenuItem: (item: T) => React.ReactNode;
  onClick?: () => void;
  onClose?: () => void;
}

// 修改 SubMenu 组件为泛型组件
export function SubMenu<T extends MenuItemBase>({
  id,
  label,
  items,
  renderMenuItem,
  onClick,
  onClose,
}: SubMenuProps<T>): JSX.Element {
  return (
    <ContextMenu.Sub key={id}>
      <ContextMenu.SubTrigger
        className={cn(
          'relative flex cursor-pointer select-none items-center justify-between pl-6 pr-2 py-2 my-0.5 text-sm outline-none',
          'hover:bg-slate-100 dark:hover:bg-slate-700 rounded-sm'
        )}
        onClick={(e) => {
          // 阻止事件冒泡，避免干扰菜单展开
          e.stopPropagation();
          if (onClick) {
            onClick();
            if (onClose) onClose();
          }
        }}
      >
        {label}
        <ChevronRightIcon className="h-4 w-4 ml-2" />
      </ContextMenu.SubTrigger>
      <ContextMenu.Portal>
        <ContextMenu.SubContent
          className={cn(
            'bg-white dark:bg-slate-800 min-w-[12rem]',
            'overflow-hidden rounded-md border border-slate-200 dark:border-slate-700 shadow-md p-1'
          )}
          sideOffset={2}
          alignOffset={-5}
        >
          {items.map((subItem, index) => (
            <React.Fragment key={index}>
              {renderMenuItem(subItem)}
            </React.Fragment>
          ))}
        </ContextMenu.SubContent>
      </ContextMenu.Portal>
    </ContextMenu.Sub>
  );
}
