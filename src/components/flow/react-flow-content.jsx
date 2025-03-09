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
import { nodeTypes } from './nodes/basic/basic-nodes';
import { createNode } from '../../services/node-factory';

const ReactFlowContent = () => {
  const initialNodes = [
    { id: '1', position: { x: 0, y: 0 }, data: { label: '1' } },
    { id: '2', position: { x: 0, y: 100 }, data: { label: '2' } },
  ];
  const initialEdges = [{ id: 'e1-2', source: '1', target: '2' }];

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
      // 阻止原生的上下文菜单
      event.preventDefault();

      // 直接将屏幕坐标转换为流图坐标
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
    // 点击背景时关闭菜单
    setMenu(null);
  }, []);

  const closeMenu = useCallback(() => {
    setMenu(null);
  }, []);

  const onAddNode = useCallback(
    (type) => {
      if (!menu) return;

      // 使用节点工厂创建新节点
      const newNode = createNode(type, nodes.length + 1, menu.position);

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
