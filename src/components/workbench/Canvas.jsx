'use client';

import React, { useCallback, useState, useRef, useEffect } from 'react';
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  useReactFlow,
} from '@xyflow/react';
import ContextMenu from './menus/FlowContextMenu';

import useRootStore from '@/core/store/rootStore';
import DefaultModule from '@/components/modules/DefaultModule';

import DevTools from './devTools/DevTools';

// 定义节点类型映射
const nodeTypes = {
  module: DefaultModule,
};

const Canvas = () => {
  const [menu, setMenu] = useState(null);
  const reactFlowWrapper = useRef(null);
  const reactFlowInstance = useReactFlow();

  // 从根 Store 获取状态和 actions
  const {
    // 全局状态和 actions
    initialize,
    initialized,

    // 流程图相关
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    addNode,
    addEdge,
    removeEdge,

    // 音频相关
    startAudio,
    audioStarted,

    // 调制相关
    applyModulationToNodes,
  } = useRootStore();

  // 初始化系统
  useEffect(() => {
    initialize();

    // 清理函数
    return () => {
      useRootStore.getState().shutdown();
    };
  }, [initialize]);

  // 调制更新效果
  useEffect(() => {
    if (!initialized) return;

    // 创建调制更新定时器
    const intervalId = setInterval(() => {
      // 强制重新计算调制值
      useRootStore.getState().updateModulationValues();

      // 应用调制到节点
      const currentNodes = useRootStore.getState().nodes;
      const updatedNodes = applyModulationToNodes(currentNodes);

      // 如果有更新，更新store中的节点
      if (updatedNodes !== currentNodes) {
        useRootStore.setState({ nodes: updatedNodes });
      }
    }, 50); // 每50ms更新一次

    // 清理函数
    return () => {
      clearInterval(intervalId);
    };
  }, [initialized]);

  // 连接处理
  const onConnect = useCallback(
    (params) => {
      addEdge(params);
    },
    [addEdge]
  );

  // 上下文菜单
  const onContextMenu = useCallback(
    (event) => {
      event.preventDefault();

      if (!audioStarted) {
        // 首次用户交互时启动音频上下文
        startAudio();
      }

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
    [reactFlowInstance, startAudio, audioStarted]
  );

  const onPaneClick = useCallback(() => {
    setMenu(null);
  }, []);

  const closeMenu = useCallback(() => {
    setMenu(null);
  }, []);

  // 处理添加节点
  // eg:
  //   onAddNode({
  //   type: 'module',
  //   moduleId: module.metadata.id,
  //   data: {
  //     label: module.metadata.name,
  //     moduleType: module.metadata.id,
  //     color: module.ui?.color || '#cccccc',
  //     preset: hasPresets ? module.presets[0].id : null,
  //   },
  // }),
  const onAddNode = useCallback(
    (nodeConfig) => {
      if (!menu) return;

      const { type, moduleId, data } = nodeConfig;
      addNode(type, menu.position, moduleId, data);

      setMenu(null);
    },
    [menu, addNode]
  );

  // 边删除处理
  const onEdgesDelete = useCallback(
    (edgesToDelete) => {
      edgesToDelete.forEach((edge) => removeEdge(edge.id));
    },
    [removeEdge]
  );

  return (
    <div style={{ width: '100%', height: '100%' }} ref={reactFlowWrapper}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onEdgesDelete={onEdgesDelete}
        onContextMenu={onContextMenu}
        onPaneClick={onPaneClick}
        nodeTypes={nodeTypes}
        snapToGrid
        snapGrid={[12, 12]}
        fitView
      >
        <Controls />
        <MiniMap />
        <DevTools />
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

export default Canvas;
