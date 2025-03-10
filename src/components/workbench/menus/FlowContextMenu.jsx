'use client';

import * as React from 'react';
import * as ContextMenu from '@radix-ui/react-context-menu';
import { cn } from '@/lib/utils/cn';
import { MENU_ITEM_TYPES } from '@/lib/constants/menuItemTypes';
import {
  MenuSection,
  MenuItem,
  SubMenu,
} from '@/components/workbench/menus/MenuComponents';
import moduleService from '@/core/services/moduleService';

/**
 * 从模块服务生成菜单配置
 * @param {Function} onAddNode - 添加节点回调
 * @returns {Array} 菜单配置结构
 */
const generateMenuFromModules = (onAddNode) => {
  // 防御性检查：确保 getAllModules() 返回有效对象
  const allModules = Object.values(moduleService.getAllModules() || {});

  // 如果没有模块，返回基本菜单结构
  if (!allModules || allModules.length === 0) {
    return [
      {
        type: MENU_ITEM_TYPES.SECTION,
        id: 'no-modules-section',
        title: '加载中...',
      },
    ];
  }

  // 获取所有模块类别
  const categories = [
    ...new Set(allModules.map((m) => m.metadata?.category).filter(Boolean)),
  ];

  // 创建顶层菜单结构
  const menuStructure = [
    {
      // 顶层菜单标题
      type: MENU_ITEM_TYPES.SECTION,
      id: 'add-module-section',
      title: '添加模块',
    },
  ];

  // 为每个类别创建一个 SubMenu
  categories.forEach((category) => {
    // 获取该类别下的所有模块
    const modulesInCategory = allModules.filter(
      (m) => m.metadata?.category === category
    );

    // 创建模块子菜单项
    const moduleItems = modulesInCategory.map((module) => {
      // 检查模块是否有预设
      const hasPresets =
        module.presets &&
        Array.isArray(module.presets) &&
        module.presets.length > 0;
      // 检查是否有多个预设
      const hasMultiplePresets = hasPresets && module.presets.length > 1;

      if (hasMultiplePresets) {
        // 如果有多个预设，创建嵌套SubMenu
        return {
          type: MENU_ITEM_TYPES.SUBMENU,
          id: `module-${module.metadata.id}`,
          label: module.metadata.name,
          // 点击主菜单项时使用默认预设
          onClick: () =>
            onAddNode({
              type: 'module',
              moduleId: module.metadata.id,
              data: {
                label: module.metadata.name,
                moduleType: module.metadata.id,
                color: module.ui?.color || '#cccccc',
                preset: module.presets[0].id, // 使用第一个预设作为默认
              },
            }),
          // 子菜单项为各个预设
          items: module.presets.map((preset) => ({
            type: MENU_ITEM_TYPES.ITEM,
            id: `preset-${module.metadata.id}-${preset.id}`,
            label: preset.name || preset.id,
            onClick: () =>
              onAddNode({
                type: 'module',
                moduleId: module.metadata.id,
                data: {
                  label: `${module.metadata.name} (${preset.name || preset.id})`,
                  moduleType: module.metadata.id,
                  color: module.ui?.color || '#cccccc',
                  preset: preset.id,
                },
              }),
          })),
        };
      } else {
        // 如果只有一个或没有预设，创建简单MenuItem
        return {
          type: MENU_ITEM_TYPES.ITEM,
          id: `module-${module.metadata.id}`,
          label: module.metadata.name,
          onClick: () =>
            onAddNode({
              type: 'module',
              moduleId: module.metadata.id,
              data: {
                label: module.metadata.name,
                moduleType: module.metadata.id,
                color: module.ui?.color || '#cccccc',
                // 如果有一个预设，使用它的ID
                preset: hasPresets ? module.presets[0].id : null,
              },
            }),
        };
      }
    });

    // 将类别添加为SubMenu
    menuStructure.push({
      type: MENU_ITEM_TYPES.SUBMENU,
      id: `category-${category.toLowerCase()}`,
      label: category,
      items: moduleItems,
    });
  });

  return menuStructure;
};

/**
 * 流程图右键菜单组件
 * @param {Object} props
 * @param {number} props.top - 菜单Y坐标
 * @param {number} props.left - 菜单X坐标
 * @param {Function} props.onAddNode - 添加节点回调
 * @param {Function} props.onClose - 关闭菜单回调
 */
const FlowContextMenu = ({ top, left, onAddNode, onClose }) => {
  const [menuStructure, setMenuStructure] = React.useState([]);
  const [isLoaded, setIsLoaded] = React.useState(false);

  // 初始化模块服务并生成菜单
  React.useEffect(() => {
    let isMounted = true;

    const initModuleService = async () => {
      try {
        // 确保模块服务已初始化
        await moduleService.initialize();

        if (isMounted) {
          const menuConfig = generateMenuFromModules(onAddNode);
          setMenuStructure(menuConfig);
          setIsLoaded(true);
        }
      } catch (error) {
        console.error('初始化模块服务失败:', error);

        if (isMounted) {
          // 设置错误状态菜单
          setMenuStructure([
            {
              type: MENU_ITEM_TYPES.SECTION,
              id: 'error-section',
              title: '加载模块失败',
            },
          ]);
          setIsLoaded(true);
        }
      }
    };

    initModuleService();

    return () => {
      isMounted = false;
    };
  }, [onAddNode]);

  // 渲染菜单项
  const renderMenuItem = React.useCallback(
    (item) => {
      const { type, id } = item;

      if (!item) return null;

      switch (type) {
        case MENU_ITEM_TYPES.SECTION:
          return <MenuSection key={id} {...item} />;

        case MENU_ITEM_TYPES.ITEM:
          return <MenuItem key={id} {...item} onClose={onClose} />;

        case MENU_ITEM_TYPES.SUBMENU:
          // 增强防御性检查
          const safeItems = Array.isArray(item.items) ? item.items : [];
          return (
            <SubMenu
              key={id}
              {...item}
              items={safeItems}
              renderMenuItem={renderMenuItem}
              onClose={onClose} // 添加这一行
            />
          );

        default:
          return null;
      }
    },
    [onClose]
  );

  // 如果模块尚未加载，显示加载中状态
  if (!isLoaded) {
    return (
      <div
        className="absolute z-50 bg-white dark:bg-slate-800 rounded-md border border-slate-200 dark:border-slate-700 shadow-md p-3"
        style={{ top, left }}
      >
        加载模块中...
      </div>
    );
  }

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
            {menuStructure.map((item) => {
              return renderMenuItem(item);
            })}
          </ContextMenu.Content>
        </ContextMenu.Portal>
      </ContextMenu.Root>
    </div>
  );
};

export default React.memo(FlowContextMenu);
