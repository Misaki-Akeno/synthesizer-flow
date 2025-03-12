import * as React from 'react';
import * as ContextMenu from '@radix-ui/react-context-menu';
import { cn } from '@/lib/utils';
import {
  MenuSection,
  MenuItem,
  SubMenu,
} from '@/components/workbench/menus/MenuComponents';
import { useModulesStore } from '@/core/store/useModulesStore';
import { ModuleBase, ModuleMetadata, ModuleUI, Preset } from '@/types/module';

export const MENU_ITEM_TYPES = {
  SECTION: 'section',
  ITEM: 'item',
  SUBMENU: 'submenu',
} as const;

type MenuType = (typeof MENU_ITEM_TYPES)[keyof typeof MENU_ITEM_TYPES];

interface MenuItemBase {
  type: MenuType;
  id: string;
}

interface MenuSectionItem extends MenuItemBase {
  type: 'section';
  title: string;
}

interface MenuSimpleItem extends MenuItemBase {
  type: 'item';
  label: string;
  onClick: () => void;
}

interface MenuSubItem extends MenuItemBase {
  type: 'submenu';
  label: string;
  onClick?: () => void;
  items: Array<MenuSimpleItem | MenuSubItem>;
}

type MenuConfigItem = MenuSectionItem | MenuSimpleItem | MenuSubItem;

export type AddNodeCallback = (node: {
  type: string;
  moduleId: string;
  data: {
    label: string;
    moduleType: string;
    color: string;
    preset: string | null;
  };
}) => void;

const generateMenuFromModules = (
  onAddNode: AddNodeCallback
): MenuConfigItem[] => {
  const allModules = useModulesStore.getState().getAllModules();
  if (!allModules || allModules.length === 0) {
    return [
      {
        type: MENU_ITEM_TYPES.SECTION,
        id: 'no-modules-section',
        title: '加载中...',
      },
    ];
  }

  // 根据模块 metadata.category 分组
  const categories = Array.from(
    new Set(
      allModules
        .map((m) => (m.metadata?.category as string) || '')
        .filter(Boolean)
    )
  );
  const menuStructure: MenuConfigItem[] = [
    {
      type: MENU_ITEM_TYPES.SECTION,
      id: 'add-module-section',
      title: '添加模块',
    },
  ];

  // 遍历每个类别，构建子菜单
  categories.forEach((category) => {
    const modulesInCategory = allModules.filter(
      (m) => (m.metadata?.category as string) === category
    );
    const moduleItems: MenuConfigItem[] = modulesInCategory.map((module) => {
      // 检查模块元数据中的预设
      // 修复类型错误：正确处理预设
      const moduleMetadata = module.metadata as ModuleMetadata;
      let presets: Preset[] | undefined;

      // 检查 metadata 中是否有 presets 属性
      if (
        moduleMetadata &&
        'presets' in moduleMetadata &&
        Array.isArray(moduleMetadata.presets)
      ) {
        presets = moduleMetadata.presets as Preset[];
      } else {
        presets = undefined;
      }

      const hasPresets = presets && presets.length > 0;
      const hasMultiplePresets = hasPresets && presets && presets.length > 1;

      // 处理 UI 配置
      const moduleWithUI = module as ModuleBase & { ui?: ModuleUI };

      if (hasMultiplePresets && presets) {
        // 如果有多个预设，创建嵌套 SubMenu
        return {
          type: MENU_ITEM_TYPES.SUBMENU,
          id: `module-${module.metadata.id}`,
          label: module.metadata.name,
          onClick: () =>
            onAddNode({
              type: 'module',
              moduleId: module.metadata.id,
              data: {
                label: module.metadata.name,
                moduleType: module.metadata.id,
                color: moduleWithUI.ui?.color || '#cccccc',
                preset: presets[0].id,
              },
            }),
          items: presets.map((preset) => ({
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
                  color: moduleWithUI.ui?.color || '#cccccc',
                  preset: preset.id,
                },
              }),
          })) as MenuSimpleItem[],
        } as MenuSubItem;
      } else {
        // 如果只有一个或没有预设
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
                color: moduleWithUI.ui?.color || '#cccccc',
                preset: hasPresets && presets ? presets[0].id : null,
              },
            }),
        } as MenuSimpleItem;
      }
    });

    menuStructure.push({
      type: MENU_ITEM_TYPES.SUBMENU,
      id: `category-${category.toLowerCase()}`,
      label: category,
      items: moduleItems,
    } as MenuSubItem);
  });

  return menuStructure;
};

interface FlowContextMenuProps {
  top: number;
  left: number;
  onAddNode: AddNodeCallback;
  onClose: () => void;
}

const FlowContextMenu: React.FC<FlowContextMenuProps> = ({
  top,
  left,
  onAddNode,
  onClose,
}) => {
  const [menuStructure, setMenuStructure] = React.useState<MenuConfigItem[]>(
    []
  );
  const [isLoaded, setIsLoaded] = React.useState(false);

  React.useEffect(() => {
    let isMounted = true;

    const initModules = async () => {
      try {
        // 如果需要初始化模块服务，可添加相关逻辑
        const menuConfig = generateMenuFromModules(onAddNode);
        if (isMounted) {
          setMenuStructure(menuConfig);
          setIsLoaded(true);
        }
      } catch (error) {
        console.error('模块加载失败:', error);
        if (isMounted) {
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

    initModules();

    return () => {
      isMounted = false;
    };
  }, [onAddNode]);

  const renderMenuItem = React.useCallback(
    (item: MenuConfigItem): React.ReactNode => {
      const { type, id } = item;
      if (!item) return null;

      switch (type) {
        case MENU_ITEM_TYPES.SECTION:
          return <MenuSection key={id} {...item} />;
        case MENU_ITEM_TYPES.ITEM:
          return (
            <MenuItem
              key={id}
              {...(item as MenuSimpleItem)}
              onClose={onClose}
            />
          );
        case MENU_ITEM_TYPES.SUBMENU:
          const subItem = item as MenuSubItem;
          const safeItems = Array.isArray(subItem.items) ? subItem.items : [];
          return (
            <SubMenu<MenuConfigItem>
              key={id}
              id={id}
              label={subItem.label}
              items={safeItems}
              renderMenuItem={renderMenuItem}
              onClick={subItem.onClick}
              onClose={onClose}
            />
          );
        default:
          return null;
      }
    },
    [onClose]
  );

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
        <div
          style={{
            width: '1px',
            height: '1px',
            position: 'absolute',
            top: 0,
            left: 0,
            pointerEvents: 'none',
          }}
        >
          <ContextMenu.Trigger />
        </div>
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
