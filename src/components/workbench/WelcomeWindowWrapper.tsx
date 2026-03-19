'use client';

import { useState } from 'react';
import { WelcomeWindow } from './WelcomeWindow';

export function WelcomeWindowWrapper() {
    const [open, setOpen] = useState(true);

    return <WelcomeWindow open={open} onOpenChange={setOpen} />;
}
