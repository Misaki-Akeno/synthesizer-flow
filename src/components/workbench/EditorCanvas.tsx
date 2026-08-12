'use client';

import React, { useCallback, useEffect, useRef } from 'react';
import {
  ReactFlow,
  Controls,
  Background,
  BackgroundVariant,
  IsValidConnection,
  useReactFlow,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import DefaultNode from './DefaultNode';
import { useFlowStore } from '../../store/canvas-store';
import { ContextMenu } from './contextMenu/ContextMenu';
import { useFlowContextMenu } from './contextMenu/hooks/useFlowContextMenu';
import { usePersistStore } from '@/store/projects-store';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { isValidModuleConnection } from './connectionValidation';
import { useShallow } from 'zustand/react/shallow';
import { SubpatchOverlay } from './SubpatchOverlay';

const nodeTypes = {
  default: DefaultNode,
};

interface CanvasProps {
  projectId?: string; // 简化为仅使用projectId
  onAutoLoad?: () => void;
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  const tagName = target.tagName.toLowerCase();
  return (
    target.isContentEditable ||
    tagName === 'input' ||
    tagName === 'textarea' ||
    tagName === 'select'
  );
}

// 内部Canvas组件，包含实际的ReactFlow
const CanvasInner = ({ projectId, onAutoLoad }: CanvasProps) => {
  const { nodes, edges, onNodesChange, onEdgesChange, onConnect, addNode } =
    useFlowStore(
      useShallow((state) => ({
        nodes: state.nodes,
        edges: state.edges,
        onNodesChange: state.onNodesChange,
        onEdgesChange: state.onEdgesChange,
        onConnect: state.onConnect,
        addNode: state.addNode,
      }))
    );

  const loadProject = usePersistStore((state) => state.loadProject);
  const currentProject = usePersistStore((state) => state.currentProject);
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  const hasLoadedProject = useRef(false);
  const hasUpdatedUrl = useRef(false);

  const { onPaneContextMenu, onNodeContextMenu, onEdgeContextMenu } =
    useFlowContextMenu();

  const reactFlowInstance = useReactFlow();

  // 在组件挂载时加载项目
  useEffect(() => {
    // 如果已经手动加载了项目，不再执行自动加载
    if (hasLoadedProject.current) return;

    const loadInitialProject = async () => {
      const state = usePersistStore.getState();
      const cachedProject = state.currentProject;

      // 1. 如果 URL 指定了 ID
      if (projectId) {
        // 关键检查：如果 URL 的 ID 和本地缓存的项目 ID 一致，
        // 我们应该优先加载本地缓存！因为本地缓存可能包含未保存的修改。
        // 如果直接从服务器加载(loadProject(projectId))，会覆盖本地修改。
        if (cachedProject && cachedProject.id === projectId) {
          hasLoadedProject.current = true;
          await loadProject(cachedProject);
          return;
        }

        // 如果 ID 不匹配，说明要切换项目，从服务器/列表加载
        hasLoadedProject.current = true;
        await loadProject(projectId);
        return;
      }

      // 2. 如果没有 URL 参数，尝试恢复本地缓存
      if (cachedProject) {
        hasLoadedProject.current = true;
        if (onAutoLoad) onAutoLoad();
        await loadProject(cachedProject);
        return;
      }

      // 3. 否则保持空项目
      if (onAutoLoad) onAutoLoad();
      // trigger onAutoLoad either way when no project inside url, so we can hide loading state
    };

    loadInitialProject();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  useEffect(() => {
    if (!currentProject) return;

    if (hasUpdatedUrl.current) {
      setTimeout(() => {
        hasUpdatedUrl.current = false;
      }, 500);
      return;
    }
    hasUpdatedUrl.current = true;

    const locale = pathname.split('/')[1] || 'zh-CN';
    const params = new URLSearchParams(searchParams);
    params.delete('project');
    const newPathname = `/${locale}/${currentProject.id}`;

    router.replace(`${newPathname}?${params.toString()}`, { scroll: false });
  }, [currentProject, router, pathname, searchParams]);

  useEffect(() => {
    const handleCanvasShortcut = (event: KeyboardEvent) => {
      if (event.repeat || isEditableTarget(event.target)) {
        return;
      }

      const isModifierPressed = event.metaKey || event.ctrlKey;
      if (!isModifierPressed) {
        return;
      }

      const key = event.key.toLowerCase();
      const shouldUndo = key === 'z' && !event.shiftKey;
      const shouldRedo =
        (key === 'z' && event.shiftKey) || (key === 'y' && !event.shiftKey);

      const store = useFlowStore.getState();

      if (shouldRedo) {
        event.preventDefault();
        store.redo();
      } else if (shouldUndo) {
        event.preventDefault();
        store.undo();
      } else if (key === 'g' && !event.shiftKey) {
        const created = store.createSubpatchFromSelection();
        if (created) event.preventDefault();
      } else if (key === 'd' && !event.shiftKey) {
        const duplicated = store.duplicateSelection();
        if (duplicated.length > 0) event.preventDefault();
      } else if (key === 'c' && !event.shiftKey) {
        if (store.copySelection()) event.preventDefault();
      } else if (key === 'v' && !event.shiftKey) {
        const pasted = store.pasteSelection();
        if (pasted.length > 0) event.preventDefault();
      } else {
        return;
      }
    };

    window.addEventListener('keydown', handleCanvasShortcut);
    return () => {
      window.removeEventListener('keydown', handleCanvasShortcut);
    };
  }, []);

  // 验证连接是否有效的函数
  const isValidConnection: IsValidConnection = useCallback(
    (params) => isValidModuleConnection(nodes, params),
    [nodes]
  );

  // 处理拖放事件
  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();

    const reactFlowBounds = event.currentTarget.getBoundingClientRect();
    const data = event.dataTransfer.getData('application/reactflow');

    if (!data) return;

    const { type, label } = JSON.parse(data);

    // 使用 transform 手动计算画布坐标
    const transform = reactFlowInstance.getViewport();
    const position = {
      x: (event.clientX - reactFlowBounds.left - transform.x) / transform.zoom,
      y: (event.clientY - reactFlowBounds.top - transform.y) / transform.zoom,
    };

    addNode(type, label, position);
  };

  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
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
      onDrop={handleDrop}
      onDragOver={handleDragOver}
    >
      <Controls />
      <Background variant={BackgroundVariant.Dots} gap={12} size={1} />
      <SubpatchOverlay />
      <ContextMenu />
    </ReactFlow>
  );
};

// 外层Canvas组件，提供所有必要的上下文
export default function Canvas({ projectId, onAutoLoad }: CanvasProps = {}) {
  return (
    <div
      style={{ width: '100%', height: '100%' }}
      onContextMenu={(e) => e.preventDefault()}
      className="h-full w-full"
      data-testid="editor-canvas"
      aria-label="合成器画布"
      role="region"
    >
      <CanvasInner projectId={projectId} onAutoLoad={onAutoLoad} />
    </div>
  );
}
