'use client';

import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  BackgroundVariant,
  applyEdgeChanges,
  applyNodeChanges,
  NodeTypes,
  OnConnect,
  OnNodesChange,
  OnEdgesChange,
  Edge,
  Node,
  Connection,
} from '@xyflow/react';
import DevTools from './devTools/DevTools';
import ModuleNode from './ModuleNode';
import { flowService } from '@/core/services/FlowService';
import { eventBus } from '@/core/events/EventBus';

// 注册自定义节点类型
const nodeTypes: NodeTypes = {
  moduleNode: ModuleNode,
};

const Canvas = () => {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);

  // 订阅 flowService 以接收数据更新
  useEffect(() => {
    const unsubscribe = flowService.subscribe(() => {
      setNodes(flowService.getNodes());
      setEdges(flowService.getEdges());
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // 处理节点变化
  const onNodesChange: OnNodesChange = useCallback((changes) => {
    setNodes((nds) => applyNodeChanges(changes, nds));

    // 如果是位置变化，通知 flowService
    changes.forEach((change) => {
      if (change.type === 'position' && change.position) {
        eventBus.emit('UI.NODE.MOVED', {
          nodeId: change.id,
          position: change.position,
        });
      }
    });
  }, []);

  // 处理边变化
  const onEdgesChange: OnEdgesChange = useCallback((changes) => {
    setEdges((eds) => applyEdgeChanges(changes, eds));

    // 处理边的删除
    changes.forEach((change) => {
      if (change.type === 'remove') {
        eventBus.emit('UI.CONNECTION.DELETED', {
          connectionId: change.id,
        });
      }
    });
  }, []);

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
        onEdgesChange={onEdgesChange}
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
