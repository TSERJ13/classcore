'use client';

import { useEffect } from 'react';
import { checkCacheVersion } from '@/lib/cache-buster';

export function CacheBuster() {
    useEffect(() => {
        checkCacheVersion();
    }, []);

    return null;
}
