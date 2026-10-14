'use client';

import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  ReactFlow,
  Controls,
  Background,
  BackgroundVariant,
  IsValidConnection,
  useReactFlow,
  useStoreApi,
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
import { useCanvasAutosave } from './useCanvasAutosave';
import { SubpatchOverlay } from './SubpatchOverlay';
import {
  useCanvasLodStore,
  useNodeDetailLevel,
} from '@/store/canvas-lod-store';

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

/**
 * 把视口缩放同步到 LOD store。直接订阅 React Flow 内部 store，
 * 缩放过程中不触发任何 React 渲染，只有跨档时节点才会更新。
 */
function CanvasLodController() {
  const store = useStoreApi();

  useEffect(() => {
    const { setZoom } = useCanvasLodStore.getState();
    setZoom(store.getState().transform[2]);
    return store.subscribe((state) => setZoom(state.transform[2]));
  }, [store]);

  return null;
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
  const hasHydratedProjects = usePersistStore(
    (state) => state.hasHydratedProjects
  );
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  const hasLoadedProject = useRef(false);
  const hasUpdatedUrl = useRef(false);

  const { onPaneContextMenu, onNodeContextMenu, onEdgeContextMenu } =
    useFlowContextMenu();

  const reactFlowInstance = useReactFlow();
  const detailLevel = useNodeDetailLevel();

  // 低档位下连线关闭动画；极简档位改用直线，减少路径计算与重绘。
  const displayEdges = useMemo(() => {
    if (detailLevel === 'full') return edges;
    return edges.map((edge) => ({
      ...edge,
      animated: false,
      ...(detailLevel === 'minimal' && (!edge.type || edge.type === 'default')
        ? { type: 'straight' }
        : {}),
    }));
  }, [detailLevel, edges]);

  useCanvasAutosave();

  // 在组件挂载时加载项目
  useEffect(() => {
    if (!hasHydratedProjects) return;
    // 如果已经手动加载了项目，不再执行自动加载
    if (hasLoadedProject.current) return;

    const loadInitialProject = async () => {
      const state = usePersistStore.getState();
      const cachedProject = state.currentProject;

      // 1. 如果 URL 指定了 ID
      if (projectId) {
        // loadProject 仅在存在本地草稿时优先使用它；干净缓存需要重新拉取
        // 云端详情，避免旧 IndexedDB 缓存永久覆盖远端版本。
        hasLoadedProject.current = true;
        await loadProject(projectId);
        return;
      }

      // 2. 如果没有 URL 参数，尝试恢复本地缓存
      if (cachedProject) {
        hasLoadedProject.current = true;
        await loadProject(cachedProject);
        return;
      }

      // 3. 否则保持空项目
      if (onAutoLoad) onAutoLoad();
      // trigger onAutoLoad either way when no project inside url, so we can hide loading state
    };

    loadInitialProject();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasHydratedProjects, loadProject, onAutoLoad, projectId]);

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
    if (currentProject.isLocalDraft) {
      router.replace(`/${locale}?${params.toString()}`, { scroll: false });
      return;
    }
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
      edges={displayEdges}
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
      // React Flow 默认 minZoom 为 0.5，放宽后才能缩小到极简档位查看大项目全局
      minZoom={0.1}
      data-detail-level={detailLevel}
    >
      <CanvasLodController />
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
