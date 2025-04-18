'use client';

import React, { useEffect, useRef } from 'react';
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
import { useRouter, useSearchParams, usePathname } from 'next/navigation';

const nodeTypes = {
  default: DefaultNode,
};

interface CanvasProps {
  projectId?: string;  // 简化为仅使用projectId
}

// 内部Canvas组件，包含实际的ReactFlow
const CanvasInner = ({ projectId }: CanvasProps) => {
  const { nodes, edges, onNodesChange, onEdgesChange, onConnect } =
    useFlowStore();
  
  const { getProjectById, loadProject, builtInProjects, currentProject } = usePersistStore();
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  
  const hasLoadedProject = useRef(false);
  const hasUpdatedUrl = useRef(false);

  const { onPaneContextMenu, onNodeContextMenu, onEdgeContextMenu } =
    useFlowContextMenu();
    
  // 在组件挂载时加载项目
  useEffect(() => {
    // 如果已经手动加载了项目，不再执行自动加载
    if (hasLoadedProject.current) return;
    
    const loadInitialProject = async () => {
      if (projectId) {
        const projectToLoad = getProjectById(projectId);
        if (projectToLoad) {
          hasLoadedProject.current = true;
          await loadProject(projectToLoad);
          return;
        }
      }
      

      if (!hasLoadedProject.current && builtInProjects.length > 0) {
        hasLoadedProject.current = true;
        await loadProject(builtInProjects[0]);
      }
    };
    
    loadInitialProject();
  }, [projectId, getProjectById, loadProject, builtInProjects]);

  useEffect(() => {
    if (!currentProject) return;
    
    if (hasUpdatedUrl.current) {
      setTimeout(() => {
        hasUpdatedUrl.current = false;
      }, 500);
      return;
    }
    hasUpdatedUrl.current = true;
    

    const params = new URLSearchParams(searchParams);
    params.set('project', currentProject.id);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }, [currentProject, router, pathname, searchParams]);

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
export default function Canvas({ projectId }: CanvasProps = {}) {
  return (
    <div
      style={{ width: '100vw', height: '100vh' }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <ReactFlowProvider>
        <ContextMenuProvider>
          <ModuleSelectorProvider>
            <CanvasInner projectId={projectId} />
          </ModuleSelectorProvider>
        </ContextMenuProvider>
      </ReactFlowProvider>
    </div>
  );
}
