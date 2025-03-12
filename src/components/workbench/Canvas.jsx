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
import DefaultModule from '@/modules/DefaultModule';

import DevTools from './devTools/DevTools';

// 定义节点类型映射
const nodeTypes = {
  module: DefaultModule,
};
//文件逻辑完全没做
const Canvas = () => {
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
