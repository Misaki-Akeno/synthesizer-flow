'use client';

import React, { useRef, useEffect, useCallback } from 'react';
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  BackgroundVariant,
  NodeTypes,
  OnConnect,
  Node,
  Edge,
  Connection,
  useNodesState,
  useEdgesState,
  NodeMouseHandler,
  useKeyPress,
  useReactFlow,
} from '@xyflow/react';
import DevTools from './devTools/DevTools';
import ModuleNode from './ModuleNode';
import { Services } from '@/core/services/ServiceAccessor';
import { eventBus } from '@/core/events/EventBus';

// 注册自定义节点类型
const nodeTypes: NodeTypes = {
  moduleNode: ModuleNode,
};

const Canvas = () => {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  // 修正泛型参数：从数组类型改为单个元素类型
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const { getEdges, getNodes } = useReactFlow();

  // 检测 Delete 和 Backspace 键是否被按下
  const deletePressed = useKeyPress('Delete');
  const backspacePressed = useKeyPress('Backspace');

  // 处理键盘删除事件
  useEffect(() => {
    const handleDeleteElements = () => {
      // 获取当前选中的节点和边
      const selectedNodes = getNodes().filter((node) => node.selected);
      const selectedEdges = getEdges().filter((edge) => edge.selected);

      // 处理选中节点的删除
      selectedNodes.forEach((node) => {
        eventBus.emit('UI.NODE.DELETED', {
          nodeId: node.id,
        });
      });

      // 处理选中边的删除
      selectedEdges.forEach((edge) => {
        eventBus.emit('UI.CONNECTION.DELETED', {
          connectionId: edge.id,
        });
      });
    };

    // 当 Delete 或 Backspace 键被按下时执行删除操作
    if (deletePressed || backspacePressed) {
      handleDeleteElements();
    }
  }, [deletePressed, backspacePressed, getNodes, getEdges]);

  // 订阅 flowService 以接收数据更新
  useEffect(() => {
    // 初始加载数据
    setNodes(
      Services.flowService.getNodes().map((node) => ({
        ...node,
        type: node.type || 'moduleNode',
      })) as Node[]
    );
    setEdges(Services.flowService.getEdges() as Edge[]);

    const unsubscribe = Services.flowService.subscribe(() => {
      const flowNodes = Services.flowService.getNodes();
      setNodes(
        flowNodes.map((node) => ({
          ...node,
          type: node.type || 'moduleNode',
          draggable: Services.moduleService.isModuleInitialized(node.id),
        })) as Node[]
      );
      setEdges(Services.flowService.getEdges() as Edge[]);
    });

    return () => {
      unsubscribe();
    };
  }, [setNodes, setEdges]);

  // 处理节点拖拽结束
  const onNodeDragStop = useCallback<NodeMouseHandler>((event, node) => {
    if (node.id && node.position) {
      eventBus.emit('UI.NODE.MOVED', {
        nodeId: node.id,
        position: node.position,
      });
    }
  }, []);

  // 处理边的删除
  const handleEdgesChange = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (changes: any[]) => {
      onEdgesChange(changes);

      // 处理边的删除
      changes.forEach((change) => {
        if (change.type === 'remove') {
          eventBus.emit('UI.CONNECTION.DELETED', {
            connectionId: change.id,
          });
        }
      });
    },
    [onEdgesChange]
  );

  // 处理连接创建
  const onConnect: OnConnect = useCallback((connection: Connection) => {
    if (connection.source && connection.target) {
      eventBus.emit('CONNECTION.REQUESTED', {
        source: connection.source,
        target: connection.target,
        sourceHandle: connection.sourceHandle ?? undefined,
        targetHandle: connection.targetHandle ?? undefined,
      });
    }
  }, []);

  // 处理右键菜单
  const onNodeContextMenu = useCallback(
    (event: React.MouseEvent, node: Node) => {
      // 阻止默认的右键菜单
      event.preventDefault();
      // 发送打开右键菜单事件
      eventBus.emit('UI.CONTEXT_MENU.OPEN', {
        sourceId: node.id,
        position: { x: event.clientX, y: event.clientY },
        nodeType: node.type,
        sourceType: 'node',
      });
    },
    []
  );

  // 处理边缘右键菜单
  const onEdgeContextMenu = useCallback(
    (event: React.MouseEvent, edge: Edge) => {
      event.preventDefault();
      eventBus.emit('UI.CONTEXT_MENU.OPEN', {
        sourceId: edge.id,
        position: { x: event.clientX, y: event.clientY },
        sourceType: 'edge',
      });
    },
    []
  );

  // 处理画布右键菜单
  const onPaneContextMenu = useCallback(
    (event: MouseEvent | React.MouseEvent<Element, MouseEvent>) => {
      event.preventDefault();
      eventBus.emit('UI.CONTEXT_MENU.OPEN', {
        sourceId: 'canvas',
        position: { x: event.clientX, y: event.clientY },
        sourceType: 'pane',
      });
    },
    []
  );

  return (
    <div style={{ width: '100%', height: '100%' }} ref={reactFlowWrapper}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={handleEdgesChange}
        onNodeDragStop={onNodeDragStop}
        onConnect={onConnect}
        onNodeContextMenu={onNodeContextMenu}
        onEdgeContextMenu={onEdgeContextMenu}
        onPaneContextMenu={onPaneContextMenu}
        nodeTypes={nodeTypes}
        fitView
        deleteKeyCode={['Backspace', 'Delete']} // 同时支持 Backspace 和 Delete 键
      >
        <Controls />
        <MiniMap />
        <DevTools />
        <Background variant={BackgroundVariant.Dots} gap={12} size={1} />
      </ReactFlow>
    </div>
  );
};

export default Canvas;
