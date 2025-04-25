'use client';

import React, { createContext, useContext, useState, ReactNode } from 'react';
import { useReactFlow } from '@xyflow/react';
import { ModuleSelector } from '../modules/ModuleSelector';
import { useFlowStore } from '@/store/store';

interface ModuleSelectorContextType {
  showModuleSelector: (x: number, y: number) => void;
  hideModuleSelector: () => void;
}

const ModuleSelectorContext = createContext<ModuleSelectorContextType | null>(
  null
);

export const useModuleSelectorContext = () => {
  const context = useContext(ModuleSelectorContext);
  if (!context) {
    throw new Error(
      'useModuleSelectorContext must be used within a ModuleSelectorProvider'
    );
  }
  return context;
};

interface ModuleSelectorProviderProps {
  children: ReactNode;
}

export const ModuleSelectorProvider: React.FC<ModuleSelectorProviderProps> = ({
  children,
}) => {
  const [isSelectorOpen, setIsSelectorOpen] = useState(false);
  const [selectorPosition, setSelectorPosition] = useState({ x: 0, y: 0 });
  const reactFlowInstance = useReactFlow();
  const addNode = useFlowStore((state) => state.addNode);

  // 显示模块选择器
  const showModuleSelector = (x: number, y: number) => {
    setSelectorPosition({ x, y });
    setIsSelectorOpen(true);
  };

  // 隐藏模块选择器
  const hideModuleSelector = () => {
    setIsSelectorOpen(false);
  };

  // 处理模块选择
  const handleModuleSelect = (
    type: string,
    label: string,
    position: { x: number; y: number }
  ) => {
    // 将接收到的位置（可能是画布相对位置）转换为实际的画布位置
    const canvasPosition = reactFlowInstance.screenToFlowPosition(position);

    // 添加节点到画布
    addNode(type, label, canvasPosition);
  };

  // 获取画布的当前位置/变换信息
  const { x: paneX, y: paneY } = reactFlowInstance.getViewport();

  return (
    <ModuleSelectorContext.Provider
      value={{ showModuleSelector, hideModuleSelector }}
    >
      {children}

      <ModuleSelector
        isOpen={isSelectorOpen}
        onClose={hideModuleSelector}
        position={selectorPosition}
        onModuleSelect={handleModuleSelect}
        canvasPosition={{ x: paneX, y: paneY }}
      />
    </ModuleSelectorContext.Provider>
  );
};
