import { Metadata } from 'next';

import { Separator } from '@/components/ui/separator';
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
        <div className="px-6 lg:px-12 flex flex-col items-start justify-between space-y-2 py-4 sm:flex-row sm:items-center sm:space-y-0 md:h-16">
          <h2 className="text-lg font-semibold">Playground</h2>
          <div className="ml-auto flex w-full space-x-2 sm:justify-end"></div>
        </div>
        <Separator />
        <div className="flex-1 overflow-hidden">
          <ReactFlowProvider>
            <Canvas />
          </ReactFlowProvider>
        </div>
      </div>
    </div>
  );
}
