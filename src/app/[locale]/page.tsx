import { ReactFlowProvider } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import Canvas from '@/components/workbench/EditorCanvas';
import { ContextMenuProvider } from '@/components/providers/ContextMenuProvider';
import { Header } from '@/components/layout/Header';
import { Sidebar } from '@/components/layout/Sidebar';
import { WorkbenchLayout } from '@/components/layout/WorkbenchLayout';
import { getTranslations, setRequestLocale } from 'next-intl/server';

type SearchParams = { [key: string]: string | string[] | undefined };

export async function generateMetadata({
    params,
}: {
    params: Promise<{ locale: string }>;
}) {
    const { locale } = await params;
    const t = await getTranslations({ locale, namespace: 'Playground' });

    return {
        title: t('title'),
        description: t('description'),
    };
}

export default async function PlaygroundPage({
    searchParams,
    params,
}: {
    searchParams: Promise<SearchParams>;
    params: Promise<{ locale: string }>;
}) {
    const { locale } = await params;
    setRequestLocale(locale);

    const resolvedSearchParams = await searchParams;

    const projectId =
        typeof resolvedSearchParams.project === 'string'
            ? resolvedSearchParams.project
            : undefined;

    return (
        <div className="h-screen flex flex-col">
            <Header />
            <div className="flex-1 flex overflow-hidden">
                <ReactFlowProvider>
                    <Sidebar />
                    <WorkbenchLayout>
                        <main className="h-full w-full relative">
                            <ContextMenuProvider>
                                <Canvas projectId={projectId} />
                            </ContextMenuProvider>
                        </main>
                    </WorkbenchLayout>
                </ReactFlowProvider>
            </div>
        </div>
    );
}
