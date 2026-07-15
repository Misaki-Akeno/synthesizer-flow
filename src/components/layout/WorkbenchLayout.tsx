'use client';

import { ReactNode, useCallback, useRef, useState } from 'react';
import { AuxiliarySidebar } from '@/components/layout/AuxiliarySidebar';
import { useSearchParams } from 'next/navigation';
import { BottomDrawer } from '@/components/layout/BottomDrawer';
import { WorkbenchResizeHandle } from '@/components/layout/WorkbenchPanel';

interface WorkbenchLayoutProps {
    children: ReactNode;
}

const BOTTOM_PANEL_STORAGE_KEY = 'synthflow.workbench.bottomPanel.height';
const AUX_PANEL_STORAGE_KEY = 'synthflow.workbench.auxPanel.width';
const DEFAULT_BOTTOM_PANEL_HEIGHT = 320;
const DEFAULT_AUX_PANEL_WIDTH = 460;
const MIN_BOTTOM_PANEL_HEIGHT = 220;
const MIN_AUX_PANEL_WIDTH = 320;
const MIN_EDITOR_HEIGHT = 160;
const MIN_EDITOR_WIDTH = 520;
const MAX_AUX_PANEL_WIDTH = 920;

function getStoredBottomPanelHeight(): number {
    if (typeof window === 'undefined') return DEFAULT_BOTTOM_PANEL_HEIGHT;
    const stored = window.localStorage.getItem(BOTTOM_PANEL_STORAGE_KEY);
    const parsed = stored ? Number(stored) : Number.NaN;
    return Number.isFinite(parsed) ? parsed : DEFAULT_BOTTOM_PANEL_HEIGHT;
}

function getStoredAuxPanelWidth(): number {
    if (typeof window === 'undefined') return DEFAULT_AUX_PANEL_WIDTH;
    const stored = window.localStorage.getItem(AUX_PANEL_STORAGE_KEY);
    const parsed = stored ? Number(stored) : Number.NaN;
    return Number.isFinite(parsed) ? parsed : DEFAULT_AUX_PANEL_WIDTH;
}

export function WorkbenchLayout({ children }: WorkbenchLayoutProps) {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const searchParams = useSearchParams();
    const auxPanel = searchParams.get('auxPanel');
    const bottomPanel = searchParams.get('bottomPanel');
    const isAuxPanelOpen = !!auxPanel;
    const isBottomPanelOpen = !!bottomPanel;
    const [bottomHeight, setBottomHeight] = useState(getStoredBottomPanelHeight);
    const [auxWidth, setAuxWidth] = useState(getStoredAuxPanelWidth);
    const [isBottomMaximized, setIsBottomMaximized] = useState(false);

    const getMaxBottomHeight = useCallback(() => {
        const containerHeight = containerRef.current?.clientHeight ?? window.innerHeight;
        return Math.max(MIN_BOTTOM_PANEL_HEIGHT, containerHeight - MIN_EDITOR_HEIGHT);
    }, []);

    const commitBottomHeight = useCallback((nextHeight: number) => {
        const clamped = Math.min(Math.max(nextHeight, MIN_BOTTOM_PANEL_HEIGHT), getMaxBottomHeight());
        setBottomHeight(clamped);
        window.localStorage.setItem(BOTTOM_PANEL_STORAGE_KEY, String(Math.round(clamped)));
    }, [getMaxBottomHeight]);

    const getMaxAuxWidth = useCallback(() => {
        const containerWidth = containerRef.current?.clientWidth ?? window.innerWidth;
        return Math.max(MIN_AUX_PANEL_WIDTH, Math.min(MAX_AUX_PANEL_WIDTH, containerWidth - MIN_EDITOR_WIDTH));
    }, []);

    const commitAuxWidth = useCallback((nextWidth: number) => {
        const clamped = Math.min(Math.max(nextWidth, MIN_AUX_PANEL_WIDTH), getMaxAuxWidth());
        setAuxWidth(clamped);
        window.localStorage.setItem(AUX_PANEL_STORAGE_KEY, String(Math.round(clamped)));
    }, [getMaxAuxWidth]);

    const beginBottomResize = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
        event.preventDefault();
        setIsBottomMaximized(false);
        const startY = event.clientY;
        const startHeight = bottomHeight;

        const handlePointerMove = (moveEvent: PointerEvent) => {
            const nextHeight = startHeight + startY - moveEvent.clientY;
            commitBottomHeight(nextHeight);
        };

        const handlePointerUp = () => {
            window.removeEventListener('pointermove', handlePointerMove);
            window.removeEventListener('pointerup', handlePointerUp);
        };

        window.addEventListener('pointermove', handlePointerMove);
        window.addEventListener('pointerup', handlePointerUp, { once: true });
    }, [bottomHeight, commitBottomHeight]);

    const beginAuxResize = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
        event.preventDefault();
        const startX = event.clientX;
        const startWidth = auxWidth;

        const handlePointerMove = (moveEvent: PointerEvent) => {
            const nextWidth = startWidth + startX - moveEvent.clientX;
            commitAuxWidth(nextWidth);
        };

        const handlePointerUp = () => {
            window.removeEventListener('pointermove', handlePointerMove);
            window.removeEventListener('pointerup', handlePointerUp);
        };

        window.addEventListener('pointermove', handlePointerMove);
        window.addEventListener('pointerup', handlePointerUp, { once: true });
    }, [auxWidth, commitAuxWidth]);

    const panelHeight = isBottomMaximized
        ? `calc(100% - ${MIN_EDITOR_HEIGHT}px)`
        : bottomHeight;

    return (
        <div ref={containerRef} className="flex min-h-0 min-w-0 flex-1 flex-col bg-background text-foreground">
            <div className="flex min-h-0 min-w-0 flex-1" data-workbench-part="editor">
                <div className="relative min-h-0 min-w-0 flex-1">{children}</div>
                {isAuxPanelOpen && (
                    <>
                        <WorkbenchResizeHandle
                            orientation="vertical"
                            label="Resize side panel"
                            onPointerDown={beginAuxResize}
                        />
                        <div
                            className="min-h-0 shrink-0"
                            style={{
                                width: auxWidth,
                                maxWidth: `calc(100% - ${MIN_EDITOR_WIDTH}px)`,
                            }}
                        >
                            <AuxiliarySidebar className="h-full w-full" />
                        </div>
                    </>
                )}
            </div>
            {isBottomPanelOpen && (
                <div className="contents" data-workbench-part="bottom-panel">
                    <WorkbenchResizeHandle
                        orientation="horizontal"
                        label="Resize bottom panel"
                        onPointerDown={beginBottomResize}
                    />
                    <div className="min-h-0 shrink-0" style={{ height: panelHeight }}>
                        <BottomDrawer
                            className="h-full w-full"
                            isMaximized={isBottomMaximized}
                            onToggleMaximize={() => setIsBottomMaximized((value) => !value)}
                            onClosePanel={() => setIsBottomMaximized(false)}
                        />
                    </div>
                </div>
            )}
        </div>
    );
}
