import { Metadata } from 'next';
import { ReactFlowProvider } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import Canvas from '@/components/workbench/Canvas';
import { ContextMenuProvider } from '@/components/contextMenu/ContextMenuProvider';

export const metadata: Metadata = {
  title: 'Synthsizer Playground',
  description: 'A playground for building synthesizers',
};

type SearchParams = { [key: string]: string | string[] | undefined };

export default async function PlaygroundPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const resolvedSearchParams = await searchParams;
  const presetId =
    typeof resolvedSearchParams.preset === 'string'
      ? resolvedSearchParams.preset
      : undefined;

  return (
    <div className="h-screen flex flex-col">
      <div className="hidden h-full flex-col md:flex flex-1">
        <div className="flex-1 overflow-hidden">
          <ReactFlowProvider>
            <ContextMenuProvider>
              <Canvas initialPresetId={presetId} />
            </ContextMenuProvider>
          </ReactFlowProvider>
        </div>
      </div>
    </div>
  );
}
