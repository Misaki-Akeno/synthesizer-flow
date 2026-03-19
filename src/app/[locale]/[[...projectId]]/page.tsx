import { ReactFlowProvider } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { ContextMenuProvider } from '@/components/providers/ContextMenuProvider';
import { Header } from '@/components/layout/Header';
import { Sidebar } from '@/components/layout/Sidebar';
import { WorkbenchLayout } from '@/components/layout/WorkbenchLayout';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { PlaygroundContent } from '@/components/workbench/PlaygroundContent';


export async function generateMetadata({
    params,
}: {
    params: Promise<{ locale: string; projectId?: string[] }>;
}) {
    const { locale } = await params;
    const t = await getTranslations({ locale, namespace: 'Playground' });

    return {
        title: t('title'),
        description: t('description'),
    };
}

export default async function PlaygroundPage({
    params,
}: {
    params: Promise<{ locale: string; projectId?: string[] }>;
}) {
    const { locale, projectId: projectIdArray } = await params;
    setRequestLocale(locale);

    const projectId = projectIdArray?.[0];

    return (
        <div className="h-screen flex flex-col">
            <Header />
            <div className="flex-1 flex overflow-hidden">
                <ReactFlowProvider>
                    <Sidebar />
                    <WorkbenchLayout>
                        <main className="h-full w-full relative">
                            <ContextMenuProvider>
                                <PlaygroundContent projectId={projectId} />
                            </ContextMenuProvider>
                        </main>
                    </WorkbenchLayout>
                </ReactFlowProvider>
            </div>
        </div>
    );
}
