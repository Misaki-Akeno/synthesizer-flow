import { Metadata } from 'next';
import { ReactFlowProvider } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import Canvas from '@/components/workbench/Canvas';
import { ContextMenuProvider } from '@/components/contextMenu/ContextMenuProvider';
import { Header } from '@/components/layout/Header';
import { Sidebar } from '@/components/layout/Sidebar';

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

  const projectId =
    typeof resolvedSearchParams.project === 'string'
      ? resolvedSearchParams.project
      : undefined;

  return (
    <div className="h-screen flex flex-col">
      <Header />
      <div className="flex-1 flex overflow-hidden">
        <Sidebar />
        <main className="flex-1 relative">
          <ReactFlowProvider>
            <ContextMenuProvider>
              <Canvas projectId={projectId} />
            </ContextMenuProvider>
          </ReactFlowProvider>
        </main>
      </div>
    </div>
  );
}
