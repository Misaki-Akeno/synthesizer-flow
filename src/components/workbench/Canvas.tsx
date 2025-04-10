'use client'

import React from 'react';
import {
  ReactFlow,
  Controls,
  Background,
  BackgroundVariant,
  IsValidConnection,
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

  // 验证连接是否有效的函数
  const isValidConnection: IsValidConnection = (params) => {
    const { source, target, sourceHandle, targetHandle } = params;
    
    const sourceNode = nodes.find(node => node.id === source);
    const targetNode = nodes.find(node => node.id === target);
    
    if (!sourceNode || !targetNode) return false;
    
    const sourceModule = sourceNode.data?.module;
    const targetModule = targetNode.data?.module;
    
    if (!sourceModule || !targetModule) return false;
    
    // 处理 sourceHandle 和 targetHandle 可能为 undefined 的情况
    if (sourceHandle != null && targetHandle != null) {
      const sourcePortType = sourceModule.getOutputPortType(sourceHandle);
      const targetPortType = targetModule.getInputPortType(targetHandle);
      return sourcePortType === targetPortType;
    }
    
    return false;
  };

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
        isValidConnection={isValidConnection}
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
