'use client'

import React from 'react';
import {
  ReactFlow,
  Controls,
  Background,
  BackgroundVariant,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import DevTools from './devTools/DevTools';
import DefaultNode from './DefaultNode';
import PresetLoader from './PresetLoader';
import { useFlowStore } from '../../store/store';
import { ContextMenu } from '../contextMenu/ContextMenu';
import { useFlowContextMenu } from '../contextMenu/hooks/useFlowContextMenu';

const nodeTypes = {
  default: DefaultNode,
};

export default function App() {
  const { 
    nodes, 
    edges, 
    onNodesChange, 
    onEdgesChange, 
    onConnect 
  } = useFlowStore();
  
  const { onPaneContextMenu, onNodeContextMenu, onEdgeContextMenu } = useFlowContextMenu();

  return (
    <div style={{ width: '100vw', height: '100vh' }} onContextMenu={(e) => e.preventDefault()}>
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
      >
        <PresetLoader />
        <DevTools />
        <Controls />
        <Background variant={BackgroundVariant.Dots} gap={12} size={1} />
        <ContextMenu />
      </ReactFlow>
    </div>
  );
}
