'use client';

import React, { useEffect } from 'react';
import {
  ReactFlow,
  Controls,
  Background,
  BackgroundVariant,
  IsValidConnection,
  ReactFlowProvider,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import DevTools from './devTools/DevTools';
import DefaultNode from './DefaultNode';
import { useFlowStore } from '../../store/store';
import { ContextMenu } from '../contextMenu/ContextMenu';
import { ContextMenuProvider } from '../contextMenu/ContextMenuProvider';
import { ModuleSelectorProvider } from '../contextMenu/ModuleSelectorContext';
import { useFlowContextMenu } from '../contextMenu/hooks/useFlowContextMenu';
import { usePersistStore } from '@/store/persist-store';

const nodeTypes = {
  default: DefaultNode,
};

interface CanvasProps {
  initialProjectId?: string;
}

// 内部Canvas组件，包含实际的ReactFlow
const CanvasInner = ({ initialProjectId }: CanvasProps) => {
  const { nodes, edges, onNodesChange, onEdgesChange, onConnect } =
    useFlowStore();
  
  const { getAllProjects, loadProject, builtInProjects } = usePersistStore();

  const { onPaneContextMenu, onNodeContextMenu, onEdgeContextMenu } =
    useFlowContextMenu();
    
  // 在组件挂载时加载预设或项目
  useEffect(() => {
    // 尝试加载指定的项目ID
    if (initialProjectId) {
      const projects = getAllProjects();
      const projectToLoad = projects.find(p => p.id === initialProjectId);
      
      if (projectToLoad) {
        loadProject(projectToLoad);
        return;
      }
    }
    
    // 如果没有指定项目ID，或者找不到指定的项目，加载第一个内置预设
    if (builtInProjects.length > 0) {
      loadProject(builtInProjects[0]);
    }
  }, [initialProjectId, getAllProjects, loadProject, builtInProjects]);

  // 验证连接是否有效的函数
  const isValidConnection: IsValidConnection = (params) => {
    const { source, target, sourceHandle, targetHandle } = params;

    const sourceNode = nodes.find((node) => node.id === source);
    const targetNode = nodes.find((node) => node.id === target);

    if (!sourceNode || !targetNode) return false;

    const sourceModule = sourceNode.data?.module;
    const targetModule = targetNode.data?.module;

    if (!sourceModule || !targetModule) return false;

    // 处理 sourceHandle 和 targetHandle 可能为 undefined 的情况
    if (sourceHandle != null && targetHandle != null) {
      const sourcePortType = sourceModule.getOutputPortType(sourceHandle);
      const targetPortType = targetModule.getInputPortType(targetHandle);
      return sourcePortType === targetPortType;
    }

    return false;
  };

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onConnect={onConnect}
      nodeTypes={nodeTypes}
      onPaneContextMenu={onPaneContextMenu}
      onNodeContextMenu={onNodeContextMenu}
      onEdgeContextMenu={onEdgeContextMenu}
      isValidConnection={isValidConnection}
    >
      <DevTools />
      <Controls />
      <Background variant={BackgroundVariant.Dots} gap={12} size={1} />
      <ContextMenu />
    </ReactFlow>
  );
};

// 外层Canvas组件，提供所有必要的上下文
export default function Canvas({ initialProjectId }: CanvasProps = {}) {
  return (
    <div
      style={{ width: '100vw', height: '100vh' }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <ReactFlowProvider>
        <ContextMenuProvider>
          <ModuleSelectorProvider>
            <CanvasInner initialProjectId={initialProjectId} />
          </ModuleSelectorProvider>
        </ContextMenuProvider>
      </ReactFlowProvider>
    </div>
  );
}
