import { Metadata } from 'next';

import { ReactFlowProvider } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import Canvas from '@/components/workbench/Canvas';

export const metadata: Metadata = {
  title: 'Synthsizer Playground',
  description: 'A playground for building synthesizers',
};

export default function PlaygroundPage() {
  return (
    <div className="h-screen flex flex-col">
      <div className="hidden h-full flex-col md:flex flex-1">
        <div className="flex-1 overflow-hidden">
          <ReactFlowProvider>
            <Canvas />
          </ReactFlowProvider>
        </div>
      </div>
    </div>
  );
}
