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

  return (
    <div style={{ width: '100%', height: '100%' }} ref={reactFlowWrapper}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={handleEdgesChange}
        onNodeDragStop={onNodeDragStop}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        fitView
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
