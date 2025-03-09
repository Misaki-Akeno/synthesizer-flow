import * as ContextMenu from '@radix-ui/react-context-menu';
import { cn } from '@/lib/utils';
import { ChevronRightIcon } from '@radix-ui/react-icons';

export const MenuSection = ({ id, title, label }) => (
  <ContextMenu.Label
    key={id}
    className="text-xs font-medium text-slate-500 dark:text-slate-400 pl-4 pt-3 pb-1"
  >
    {title || label}
  </ContextMenu.Label>
);

export const MenuItem = ({ id, label, onClick, onClose }) => (
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

export const SubMenu = ({
  id,
  label,
  items,
  renderMenuItem,
  onClick,
  onClose,
}) => (
  <ContextMenu.Sub key={id}>
    <ContextMenu.SubTrigger
      className={cn(
        'relative flex cursor-pointer select-none items-center justify-between pl-6 pr-2 py-2 my-0.5 text-sm outline-none',
        'hover:bg-slate-100 dark:hover:bg-slate-700 rounded-sm'
      )}
      onClick={(e) => {
        // 阻止事件冒泡，避免干扰菜单展开
        e.stopPropagation();

        // 如果有onClick处理函数，执行它
        if (onClick) {
          onClick();
          // 执行结束后关闭整个菜单
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
        {items.map((subItem) => renderMenuItem(subItem))}
      </ContextMenu.SubContent>
    </ContextMenu.Portal>
  </ContextMenu.Sub>
);
