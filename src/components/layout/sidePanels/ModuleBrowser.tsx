'use client';

import { useState } from 'react';
import { useReactFlow, ReactFlowProvider } from '@xyflow/react';
import { useFlowStore } from '@/store/store';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Search,
  Waves,
  Sliders,
  Music,
  Speaker,
  PanelRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { moduleMetadataMap } from '@/core/Modules';

// 模块类型定义
export interface ModuleTypeInfo {
  type: string;
  label: string;
  description: string;
  category: string;
  icon?: React.ReactNode;
}

interface ModuleBrowserProps {
  onClose: () => void;
}

// 获取图标组件
const getIconComponent = (iconType: string | undefined): React.ReactNode => {
  switch (iconType) {
    case 'Waves':
      return <Waves className="h-4 w-4 mr-2" />;
    case 'Sliders':
      return <Sliders className="h-4 w-4 mr-2" />;
    case 'Music':
      return <Music className="h-4 w-4 mr-2" />;
    case 'Speaker':
      return <Speaker className="h-4 w-4 mr-2" />;
    default:
      return <Sliders className="h-4 w-4 mr-2" />;
  }
};

// 可用模块类型 - 从模块的metadata中获取
const availableModules: ModuleTypeInfo[] = Object.entries(
  moduleMetadataMap
).map(([, metadata]) => {
  return {
    type: metadata.type,
    label: metadata.label,
    description: metadata.description,
    category: metadata.category,
    icon: getIconComponent(metadata.iconType),
  };
});

// 按类别对模块进行分组
const groupedModules = availableModules.reduce<
  Record<string, ModuleTypeInfo[]>
>((acc, module) => {
  if (!acc[module.category]) {
    acc[module.category] = [];
  }
  acc[module.category].push(module);
  return acc;
}, {});

// 包装组件，提供 ReactFlow 上下文
export function ModuleBrowser({ onClose }: ModuleBrowserProps) {
  return (
    <ReactFlowProvider>
      <ModuleBrowserContent onClose={onClose} />
    </ReactFlowProvider>
  );
}

// 内部组件，使用 ReactFlow 上下文
function ModuleBrowserContent({ onClose }: ModuleBrowserProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const reactFlowInstance = useReactFlow();
  const addNode = useFlowStore((state) => state.addNode);

  // 筛选模块
  const filterModules = (modules: ModuleTypeInfo[]) => {
    if (!searchQuery.trim()) return modules;

    const query = searchQuery.toLowerCase();
    return modules.filter(
      (module) =>
        module.label.toLowerCase().includes(query) ||
        module.description.toLowerCase().includes(query) ||
        module.category.toLowerCase().includes(query)
    );
  };

  // 处理模块添加
  const handleModuleAdd = (moduleType: string, moduleLabel: string) => {
    // 获取画布中心位置
    const { x, y, zoom } = reactFlowInstance.getViewport();
    const centerX = window.innerWidth / 2 / zoom - x / zoom;
    const centerY = window.innerHeight / 2 / zoom - y / zoom;

    // 添加到画布中心位置附近（有一定随机偏移）
    const offsetX = (Math.random() - 0.5) * 200;
    const offsetY = (Math.random() - 0.5) * 200;

    // 添加节点
    addNode(moduleType, moduleLabel, {
      x: centerX + offsetX,
      y: centerY + offsetY,
    });
  };

  // 支持拖放
  const handleDragStart = (
    e: React.DragEvent,
    moduleType: string,
    moduleLabel: string
  ) => {
    e.dataTransfer.setData(
      'application/reactflow',
      JSON.stringify({
        type: moduleType,
        label: moduleLabel,
      })
    );
    e.dataTransfer.effectAllowed = 'move';
  };

  return (
    <div className="w-full h-full flex flex-col">
      {/* 标题栏 */}
      <div className="flex items-center justify-between p-2 border-b">
        <h2 className="text-sm font-medium pl-1">模块浏览器</h2>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="h-7 w-7"
        >
          <PanelRight size={15} />
        </Button>
      </div>

      {/* 搜索栏 */}
      <div className="p-2 border-b">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="搜索模块..."
            className="pl-8 h-8 text-sm"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* 模块列表 */}
      <ScrollArea className="flex-1">
        <div className="p-2">
          <Accordion
            type="multiple"
            defaultValue={Object.keys(groupedModules)}
            className="w-full"
          >
            {Object.entries(groupedModules).map(([category, modules]) => {
              const filteredModules = filterModules(modules);
              if (filteredModules.length === 0) return null;

              return (
                <AccordionItem key={category} value={category}>
                  <AccordionTrigger className="py-2 text-xs">
                    {category}
                  </AccordionTrigger>
                  <AccordionContent className="pt-1 pb-3">
                    {filteredModules.map((module) => (
                      <div
                        key={module.type}
                        className={cn(
                          'flex items-center text-xs py-1.5 px-2 rounded-md hover:bg-accent cursor-pointer'
                        )}
                        onClick={() =>
                          handleModuleAdd(module.type, module.label)
                        }
                        draggable
                        onDragStart={(e) =>
                          handleDragStart(e, module.type, module.label)
                        }
                      >
                        {module.icon}
                        <div>
                          <div className="font-medium">{module.label}</div>
                          <div className="text-muted-foreground text-[10px]">
                            {module.description}
                          </div>
                        </div>
                      </div>
                    ))}
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>

          {/* 如果没有匹配的模块 */}
          {searchQuery &&
            !Object.values(groupedModules).some(
              (modules) => filterModules(modules).length > 0
            ) && (
              <div className="py-4 text-center text-muted-foreground text-sm">
                没有找到匹配的模块
              </div>
            )}
        </div>
      </ScrollArea>
    </div>
  );
}
