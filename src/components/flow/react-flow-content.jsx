'use client';

import React, { useCallback, useState, useRef } from 'react';
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  useReactFlow,
} from '@xyflow/react';
import ContextMenu from './flow-context-menu';
import { createNode } from '../../services/node-factory';
import { Category } from '../../constants/moduleTypes';

import DefaultNode from '@/components/nodes/DefaultNode';

// 定义节点类型映射
const nodeTypes = {
  module: DefaultNode,
};

const ReactFlowContent = () => {
  const initialNodes = [];
  const initialEdges = [];

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [menu, setMenu] = useState(null);
  const reactFlowWrapper = useRef(null);
  const reactFlowInstance = useReactFlow();

  const onConnect = useCallback(
    (params) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  const onContextMenu = useCallback(
    (event) => {
      event.preventDefault();
      const position = reactFlowInstance.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      setMenu({
        top: event.clientY,
        left: event.clientX,
        position,
      });
    },
    [reactFlowInstance]
  );

  const onPaneClick = useCallback(() => {
    setMenu(null);
  }, []);

  const closeMenu = useCallback(() => {
    setMenu(null);
  }, []);

  const onAddNode = useCallback(
    (nodeConfig) => {
      if (!menu) return;

      const { type, moduleId, data } = nodeConfig;
      const newNode = createNode(
        type,
        nodes.length + 1,
        menu.position,
        moduleId,
        data // 传递额外数据到节点
      );
      setNodes((nds) => nds.concat(newNode));

      setMenu(null);
    },
    [nodes, menu, setNodes]
  );

  return (
    <div style={{ width: '100%', height: '100%' }} ref={reactFlowWrapper}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onContextMenu={onContextMenu}
        onPaneClick={onPaneClick}
        nodeTypes={nodeTypes}
        snapToGrid
        snapGrid={[12, 12]}
        fitView
      >
        <Controls />
        <MiniMap />
        <Background variant="dots" gap={12} size={1} />
      </ReactFlow>

      {menu && (
        <ContextMenu
          top={menu.top}
          left={menu.left}
          onAddNode={onAddNode}
          onClose={closeMenu}
        />
      )}
    </div>
  );
};

export default ReactFlowContent;
