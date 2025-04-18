'use client';

import { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';

// 模块类型定义
export interface ModuleTypeInfo {
  type: string;
  label: string;
  description: string;
  category: string;
  icon?: React.ReactNode;
}

// 模块选择器属性
interface ModuleSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  position: { x: number; y: number };
  onModuleSelect: (type: string, label: string, position: { x: number; y: number }) => void;
  canvasPosition: { x: number, y: number }; // 画布当前位置
}

// 可用模块类型
const availableModules: ModuleTypeInfo[] = [
  {
    type: 'simpleoscillator',
    label: '简单振荡器',
    description: '生成基本波形的振荡器',
    category: '信号源',
  },
  {
    type: 'advancedoscillator',
    label: '高级振荡器',
    description: '支持复音和更多波形的振荡器',
    category: '信号源',
  },
  {
    type: 'lfo',
    label: '低频振荡器(LFO)',
    description: '产生低频调制信号',
    category: '调制',
  },
  {
    type: 'midiinput',
    label: 'MIDI输入器',
    description: '接收MIDI控制器的输入信号',
    category: '输入',
  },
  {
    type: 'reverb',
    label: '混响效果',
    description: '添加空间混响效果',
    category: '效果',
  },
  {
    type: 'speaker',
    label: '扬声器',
    description: '音频输出到系统扬声器',
    category: '输出',
  },
];

// 按类别对模块进行分组
const groupedModules = availableModules.reduce<Record<string, ModuleTypeInfo[]>>(
  (acc, module) => {
    if (!acc[module.category]) {
      acc[module.category] = [];
    }
    acc[module.category].push(module);
    return acc;
  },
  {}
);

export const ModuleSelector: React.FC<ModuleSelectorProps> = ({
  isOpen,
  onClose,
  position,
  onModuleSelect,
  canvasPosition
}) => {
  const [mounted, setMounted] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerPosition, setContainerPosition] = useState(position);
  const [searchQuery, setSearchQuery] = useState('');
  const [isDraggingPanel, setIsDraggingPanel] = useState(false);
  const [_dragStartPosition, setDragStartPosition] = useState({ x: 0, y: 0 });
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  
  
  // 模块拖拽状态
  const [draggedModule, setDraggedModule] = useState<{
    moduleType: string;
    moduleLabel: string;
    position: { x: number; y: number };
  } | null>(null);
  const [isDraggingModule, setIsDraggingModule] = useState(false);
  const [isOutsideContainer, setIsOutsideContainer] = useState(false);
  
  // 处理SSR兼容性
  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);
  
  // 设置初始位置
  useEffect(() => {
    if (isOpen) {
      setContainerPosition(position);
    }
  }, [isOpen, position]);
  
  // 监听点击事件关闭选择器
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose]);
  
  // 1. 处理面板拖拽
  const handlePanelDragStart = (e: React.MouseEvent) => {
    // 只有点击标题栏才能拖动面板
    if (!(e.target as HTMLElement).closest('.module-selector-handle')) {
      return;
    }
    
    e.preventDefault();
    setIsDraggingPanel(true);
    setDragStartPosition({
      x: e.clientX,
      y: e.clientY
    });
    setDragOffset({
      x: e.clientX - containerPosition.x,
      y: e.clientY - containerPosition.y
    });
  };
  
  // 面板拖拽处理
  useEffect(() => {
    if (!isDraggingPanel) return;
    
    const handleMouseMove = (e: MouseEvent) => {
      const newX = e.clientX - dragOffset.x;
      const newY = e.clientY - dragOffset.y;
      
      // 设置新位置，保持在视口内
      setContainerPosition({
        x: Math.max(0, Math.min(window.innerWidth - 280, newX)),
        y: Math.max(0, Math.min(window.innerHeight - 100, newY))
      });
    };
    
    const handleMouseUp = () => {
      setIsDraggingPanel(false);
    };
    
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDraggingPanel, dragOffset]);

  // 2. 处理模块拖拽
  const handleModuleDragStart = (e: React.MouseEvent, moduleType: string, moduleLabel: string) => {
    // 如果面板正在拖拽中，不启动模块拖拽
    if (isDraggingPanel) return;
    
    // 如果点击的是拖动把手，不启动模块拖拽
    if (e.target && (e.target as HTMLElement).closest('.module-selector-handle')) {
      return;
    }
    
    e.preventDefault();
    e.stopPropagation();
    
    setIsDraggingModule(true);
    setIsOutsideContainer(false);
    setDraggedModule({
      moduleType,
      moduleLabel,
      position: { x: e.clientX, y: e.clientY }
    });
    
    document.body.style.cursor = 'grabbing';
  };
  
  // 模块拖拽处理
  useEffect(() => {
    if (!isDraggingModule || !draggedModule) return;
    
    const handleMouseMove = (e: MouseEvent) => {
      if (draggedModule) {
        setDraggedModule({
          ...draggedModule,
          position: { x: e.clientX, y: e.clientY }
        });
        
        // 检查是否拖出了容器
        if (containerRef.current) {
          const containerRect = containerRef.current.getBoundingClientRect();
          const isOutside = 
            e.clientX < containerRect.left || 
            e.clientX > containerRect.right || 
            e.clientY < containerRect.top || 
            e.clientY > containerRect.bottom;
          
          setIsOutsideContainer(isOutside);
        }
      }
    };
    
    const handleMouseUp = (e: MouseEvent) => {
      // 只有在拖出容器之外时才创建新模块
      if (isDraggingModule && draggedModule && isOutsideContainer) {
        // 创建新模块
        const canvasX = e.clientX - canvasPosition.x;
        const canvasY = e.clientY - canvasPosition.y;
        
        onModuleSelect(
          draggedModule.moduleType,
          draggedModule.moduleLabel,
          { x: canvasX, y: canvasY }
        );
      }
      
      setIsDraggingModule(false);
      setDraggedModule(null);
      setIsOutsideContainer(false);
      document.body.style.cursor = 'default';
    };
    
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDraggingModule, draggedModule, onModuleSelect, canvasPosition, isOutsideContainer]);

  // 处理双击选择模块
  const handleDoubleClick = (moduleType: string, moduleLabel: string) => {
    // 在当前位置附近添加模块（为了直观体验，添加一些偏移）
    const offsetX = Math.random() * 100 - 50; // -50 到 50 的随机偏移
    const offsetY = Math.random() * 100 - 50;
    
    // 从当前选择器窗口位置计算画布坐标
    const canvasX = containerPosition.x - canvasPosition.x + offsetX;
    const canvasY = containerPosition.y - canvasPosition.y + offsetY;
    
    onModuleSelect(moduleType, moduleLabel, { x: canvasX, y: canvasY });
    onClose();
  };

  // 筛选模块
  const filterModules = (modules: ModuleTypeInfo[]) => {
    if (!searchQuery.trim()) return modules;
    
    const query = searchQuery.toLowerCase();
    return modules.filter(
      module => 
        module.label.toLowerCase().includes(query) || 
        module.description.toLowerCase().includes(query) ||
        module.category.toLowerCase().includes(query)
    );
  };

  if (!isOpen || !mounted) return null;

  return createPortal(
    <>
      {/* 模块选择器面板 */}
      <div
        ref={containerRef}
        className="fixed z-50 w-72 bg-white dark:bg-gray-800 shadow-lg rounded-md overflow-hidden border border-gray-200"
        style={{ 
          left: containerPosition.x, 
          top: containerPosition.y,
          maxHeight: '80vh',
          userSelect: 'none' // 防止文本选择干扰拖拽
        }}
        onMouseDown={handlePanelDragStart}
      >
        {/* 标题栏 - 作为拖动把手 */}
        <div className="px-3 py-2 border-b flex justify-between items-center bg-gray-50 dark:bg-gray-700 cursor-move module-selector-handle">
          <h3 className="font-medium select-none">添加模块</h3>
          <button 
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* 搜索框 */}
        <div className="px-3 py-2 border-b">
          <input
            type="text"
            placeholder="搜索模块..."
            className="w-full px-2 py-1 text-sm border rounded"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* 模块列表 */}
        <div className="overflow-y-auto max-h-[60vh] p-1">
          {Object.entries(groupedModules).map(([category, modules]) => {
            const filteredModules = filterModules(modules);
            if (filteredModules.length === 0) return null;
            
            return (
              <div key={category} className="mb-3">
                <div className="px-3 py-1 text-xs font-medium text-gray-500 bg-gray-50 dark:bg-gray-700 dark:text-gray-300 rounded">
                  {category}
                </div>
                <div className="mt-1">
                  {filteredModules.map((module) => (
                    <div
                      key={module.type}
                      className={cn(
                        "px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded cursor-grab",
                        isDraggingModule && draggedModule?.moduleType === module.type && "opacity-50"
                      )}
                      onMouseDown={(e) => handleModuleDragStart(e, module.type, module.label)}
                      onDoubleClick={() => handleDoubleClick(module.type, module.label)}
                    >
                      <div className="font-medium text-sm">{module.label}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">{module.description}</div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
          
          {/* 如果没有匹配的模块 */}
          {searchQuery && !Object.values(groupedModules).some(modules => filterModules(modules).length > 0) && (
            <div className="px-3 py-4 text-center text-gray-500 dark:text-gray-400">
              没有找到匹配的模块
            </div>
          )}
        </div>
        
        {/* 拖动提示 */}
        <div className="px-3 py-2 text-xs text-center text-gray-500 border-t">
          提示: 拖动添加到画布或双击直接添加
        </div>
      </div>

      {/* 拖动中的模块视觉反馈 */}
      {isDraggingModule && draggedModule && (
        <div
          className={cn(
            "fixed pointer-events-none z-[100] border shadow-lg rounded-md px-3 py-2 max-w-[200px]",
            isOutsideContainer ? "bg-white/90 dark:bg-gray-800/90 border-blue-400" : "bg-gray-100/90 dark:bg-gray-700/90 border-gray-300"
          )}
          style={{
            left: draggedModule.position.x,
            top: draggedModule.position.y,
            transform: 'translate(-50%, -50%)',
            opacity: 0.9,
          }}
        >
          <div className="font-medium text-sm">{draggedModule.moduleLabel}</div>
        </div>
      )}
    </>,
    document.body
  );
};