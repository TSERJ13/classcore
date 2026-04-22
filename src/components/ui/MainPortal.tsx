'use client';

import { useEffect, useState, ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface MainPortalProps {
    children: ReactNode;
}

const MainPortal = ({ children }: MainPortalProps) => {
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
        return () => setMounted(false);
    }, []);

    if (!mounted) return null;

    return createPortal(children, document.body);
};

export default MainPortal;
