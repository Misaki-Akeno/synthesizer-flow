'use client';

import React, { useCallback, useState, useRef, useEffect } from 'react';
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

import useModulationStore from '@/store/modulationStore';

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

  // 从 Zustand Store 获取调制相关函数
  const {
    initialize,
    cleanup,
    addConnection,
    removeConnection,
    updateConnectionRange,
    applyModulationToNodes,
  } = useModulationStore();

  // 初始化调制系统
  useEffect(() => {
    initialize();
    return () => cleanup();
  }, [initialize, cleanup]);

  // 创建一个效果来定期应用调制
  useEffect(() => {
    const modulationUpdateInterval = setInterval(() => {
      const updatedNodes = applyModulationToNodes(nodes);
      setNodes(updatedNodes);
    }, 100); // 每100ms更新一次

    return () => {
      clearInterval(modulationUpdateInterval);
    };
  }, [nodes, setNodes, applyModulationToNodes]);

  // 修改的连接处理函数，使用 Zustand Store
  const onConnect = useCallback(
    (params) => {
      const { source, sourceHandle, target, targetHandle } = params;

      if (targetHandle && targetHandle.startsWith('mod_')) {
        const [_, paramModuleId, paramKey] = targetHandle.split('_');

        // 创建调制连接ID
        const connectionId = `${source}:${sourceHandle}->${target}:${targetHandle}`;

        // 将调制连接添加到 Store
        addConnection(connectionId, {
          source,
          sourceHandle,
          target,
          targetHandle,
          paramKey,
          depth: 1.0,
          bipolar: true,
        });

        // 找到目标节点
        const targetNode = nodes.find((node) => node.id === target);
        if (!targetNode || !targetNode.data.parameters[paramKey]) return;

        // 获取参数的当前值和范围
        const param = targetNode.data.parameters[paramKey];
        const currentValue = param.value;
        const min = param.min;
        const max = param.max;

        // 计算默认调制范围（当前值的±20%，但不超出参数范围）
        let minMod = Math.max(min, currentValue - (max - min) * 0.2);
        let maxMod = Math.min(max, currentValue + (max - min) * 0.2);

        // 更新节点状态，标记参数为被调制
        setNodes((nds) =>
          nds.map((node) => {
            if (node.id === target) {
              return {
                ...node,
                data: {
                  ...node.data,
                  parameters: {
                    ...node.data.parameters,
                    [paramKey]: {
                      ...node.data.parameters[paramKey],
                      isModulated: true, // 确保设置为 true
                      modRange: [minMod, maxMod],
                    },
                  },
                },
              };
            }
            return node;
          })
        );
      }

      // 添加连接线
      setEdges((eds) => addEdge(params, eds));
    },
    [nodes, setNodes, setEdges, addConnection]
  );

  // 修改的边缘删除处理，使用 Zustand Store
  const onEdgeDelete = useCallback(
    (edge) => {
      const { source, sourceHandle, target, targetHandle } = edge;

      if (targetHandle && targetHandle.startsWith('mod_')) {
        const [_, paramModuleId, paramKey] = targetHandle.split('_');
        const connectionId = `${source}:${sourceHandle}->${target}:${targetHandle}`;

        // 从 Store 中移除连接
        removeConnection(connectionId);

        // 更新目标节点的参数，清除调制状态
        setNodes((nds) =>
          nds.map((node) => {
            if (node.id === target) {
              return {
                ...node,
                data: {
                  ...node.data,
                  parameters: {
                    ...node.data.parameters,
                    [paramKey]: {
                      ...node.data.parameters[paramKey],
                      isModulated: false,
                      modRange: null,
                      displayValue: node.data.parameters[paramKey].value,
                    },
                  },
                },
              };
            }
            return node;
          })
        );
      }

      setEdges((eds) => eds.filter((e) => e.id !== edge.id));
    },
    [setNodes, setEdges, removeConnection]
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

  // 处理节点更新的回调函数
  const handleNodeUpdate = useCallback(
    (nodeId, updateData) => {
      setNodes((nodes) =>
        nodes.map((node) => {
          if (node.id === nodeId) {
            if (updateData.type === 'PARAMETER_CHANGE') {
              // 处理参数值变更
              return {
                ...node,
                data: {
                  ...node.data,
                  parameters: {
                    ...node.data.parameters,
                    [updateData.parameterKey]: {
                      ...node.data.parameters[updateData.parameterKey],
                      value: updateData.parameterValue,
                    },
                  },
                },
              };
            } else if (updateData.type === 'MOD_RANGE_CHANGE') {
              // 处理调制范围变更
              return {
                ...node,
                data: {
                  ...node.data,
                  parameters: {
                    ...node.data.parameters,
                    [updateData.parameterKey]: {
                      ...node.data.parameters[updateData.parameterKey],
                      modRange: updateData.modRange,
                    },
                  },
                },
              };
            }
          }
          return node;
        })
      );

      // 如果是调制范围更新，同时更新调制 Store
      if (updateData.type === 'MOD_RANGE_CHANGE') {
        const targetParam = `${nodeId}:${updateData.parameterKey}`;
        updateConnectionRange(targetParam, updateData.modRange);
      }
    },
    [setNodes, updateConnectionRange]
  );

  // 修改添加节点的处理函数，传入节点更新回调
  const onAddNode = useCallback(
    (nodeConfig) => {
      if (!menu) return;

      const { type, moduleId, data } = nodeConfig;
      const newNode = createNode(
        type,
        nodes.length + 1,
        menu.position,
        moduleId,
        data,
        handleNodeUpdate // 传入节点更新回调
      );
      setNodes((nds) => nds.concat(newNode));

      setMenu(null);
    },
    [nodes, menu, setNodes, handleNodeUpdate]
  );

  return (
    <div style={{ width: '100%', height: '100%' }} ref={reactFlowWrapper}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onEdgesDelete={(edges) => edges.forEach(onEdgeDelete)}
        onContextMenu={onContextMenu}
        onPaneClick={onPaneClick}
        nodeTypes={nodeTypes}
        snapToGrid
        snapGrid={[12, 12]}
        attributionPosition={null}
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
