'use client';

import React, { useRef } from 'react';
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  BackgroundVariant,
} from '@xyflow/react';
import DevTools from './devTools/DevTools';

const Canvas = () => {
  const reactFlowWrapper = useRef(null);
  return (
    <div style={{ width: '100%', height: '100%' }} ref={reactFlowWrapper}>
      <ReactFlow>
        <Controls />
        <MiniMap />
        <DevTools />
        <Background variant={BackgroundVariant.Dots} gap={12} size={1} />
      </ReactFlow>
    </div>
  );
};

export default Canvas;
