'use client';

import * as React from 'react';
import * as ContextMenu from '@radix-ui/react-context-menu';
import { ChevronRightIcon } from '@radix-ui/react-icons';
import { cn } from '@/lib/utils';

const FlowContextMenu = ({ top, left, onAddNode, onClose }) => {
  // 菜单选项配置
  const menuStructure = [
    {
      id: 'basic-section',
      type: 'section',
      label: '基础节点',
    },
    {
      id: 'input',
      type: 'item',
      label: '输入节点',
      onClick: () => onAddNode('input'),
    },
    {
      id: 'output',
      type: 'item',
      label: '输出节点',
      onClick: () => onAddNode('output'),
    },
    {
      id: 'processing-section',
      type: 'section',
      label: '处理节点',
    },
    {
      id: 'default',
      type: 'item',
      label: '默认节点',
      onClick: () => onAddNode('default'),
    },
    {
      id: 'advanced',
      type: 'submenu',
      label: '高级节点',
      submenu: [
        {
          id: 'custom',
          type: 'item',
          label: '自定义节点',
          onClick: () => onAddNode('custom'),
        },
        {
          id: 'conditional',
          type: 'item',
          label: '条件节点',
          onClick: () => onAddNode('conditional'),
        },
        {
          id: 'loop',
          type: 'item',
          label: '循环节点',
          onClick: () => onAddNode('loop'),
        },
      ],
    },
  ];

  // 渲染不同类型的菜单项
  const renderMenuItem = (item) => {
    switch (item.type) {
      case 'section':
        return (
          <ContextMenu.Label
            key={item.id}
            className="text-xs font-medium text-slate-500 dark:text-slate-400 pl-4 pt-3 pb-1"
          >
            {item.label}
          </ContextMenu.Label>
        );
      case 'item':
        return (
          <ContextMenu.Item
            key={item.id}
            className={cn(
              'relative flex cursor-pointer select-none items-center pl-6 pr-2 py-2 my-0.5 text-sm outline-none',
              'hover:bg-slate-100 dark:hover:bg-slate-700 rounded-sm'
            )}
            onSelect={(e) => {
              e.preventDefault();
              item.onClick();
              onClose();
            }}
          >
            {item.label}
          </ContextMenu.Item>
        );
      case 'submenu':
        return (
          <ContextMenu.Sub key={item.id}>
            <ContextMenu.SubTrigger
              className={cn(
                'relative flex cursor-pointer select-none items-center justify-between pl-6 pr-2 py-2 my-0.5 text-sm outline-none',
                'hover:bg-slate-100 dark:hover:bg-slate-700 rounded-sm'
              )}
            >
              {item.label}
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
                {item.submenu.map((subItem) => renderMenuItem(subItem))}
              </ContextMenu.SubContent>
            </ContextMenu.Portal>
          </ContextMenu.Sub>
        );
      default:
        return null;
    }
  };

  // 创建一个没有默认行为的定位容器
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
        {/* 我们使用一个1x1像素的不可见元素作为触发器 */}
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

        {/* 强制打开的菜单内容 */}
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

export default FlowContextMenu;
