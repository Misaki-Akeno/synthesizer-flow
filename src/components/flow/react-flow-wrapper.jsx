'use client';

import React from 'react';
import { ReactFlowProvider } from '@xyflow/react';
import ReactFlowContent from './react-flow-content';

import '@xyflow/react/dist/style.css';

// 主应用组件，用 ReactFlowProvider 包装内容
export default function App() {
  return (
    <ReactFlowProvider>
      <ReactFlowContent />
    </ReactFlowProvider>
  );
}
