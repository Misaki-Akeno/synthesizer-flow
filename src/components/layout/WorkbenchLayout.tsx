'use client';

import { ReactNode } from 'react';
import {
    ResizablePanelGroup,
    ResizablePanel,
    ResizableHandle,
} from '@/components/ui/shadcn/resizable';
import { AuxiliarySidebar } from '@/components/layout/AuxiliarySidebar';
import { useSearchParams } from 'next/navigation';

interface WorkbenchLayoutProps {
    children: ReactNode;
}

export function WorkbenchLayout({ children }: WorkbenchLayoutProps) {
    const searchParams = useSearchParams();
    const auxPanel = searchParams.get('auxPanel');
    const isAuxPanelOpen = !!auxPanel;

    return (
        <ResizablePanelGroup direction="horizontal" className="flex-1 w-full h-full">
            <ResizablePanel>
                <div className="h-full w-full relative">{children}</div>
            </ResizablePanel>
            {isAuxPanelOpen && (
                <>
                    <ResizableHandle withHandle />
                    <ResizablePanel defaultSize={400} minSize={350} maxSize={1000}>
                        <AuxiliarySidebar className="h-full w-full" />
                    </ResizablePanel>
                </>
            )}
        </ResizablePanelGroup>
    );
}
