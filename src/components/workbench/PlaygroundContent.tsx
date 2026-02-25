'use client';

import Canvas from './EditorCanvas';
import { WelcomeWindowWrapper } from './WelcomeWindowWrapper';
import { useState } from 'react';

interface PlaygroundContentProps {
    projectId?: string;
}

export function PlaygroundContent({ projectId }: PlaygroundContentProps) {
    // If there's a projectId in the URL, we shouldn't show the welcome window
    // If there's no projectId, default to showing it, but wait for onAutoLoad first.
    // We start hidden until we know there's no project to auto-load.
    const [showWelcome, setShowWelcome] = useState<boolean>(false);

    // Called when internal Canvas mounts and decides whether it loaded a cached project or not
    const handleAutoLoad = () => {
        // Canvas loaded or failed to load a project.
        // If we're here and still no projectId from the URL routing level, we should open the window
        if (!projectId) {
            setShowWelcome(true);
        }
    };

    return (
        <>
            <Canvas projectId={projectId} onAutoLoad={handleAutoLoad} />
            {!projectId && showWelcome && <WelcomeWindowWrapper />}
        </>
    );
}
