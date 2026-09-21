'use client';

import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

/**
 * Mounted once in `(dashboard)/layout.tsx`, wrapping `{children}` — that
 * layout persists across every navigation within the dashboard (Next.js
 * App Router keeps a shared layout mounted; only `children` swaps), so the
 * QueryClient instance below, and its cache, survives page-to-page
 * navigation instead of being recreated from scratch each time.
 *
 * This used to be mounted inside `/students/page.tsx` itself instead —
 * scoped to that one page's own lifecycle. That meant leaving `/students`
 * for any other page unmounted this provider and destroyed the entire
 * cache with it; coming back created a brand new, empty QueryClient, so
 * every Server Action/RPC call re-ran from a cold cache regardless of how
 * recently the data had already been fetched — every navigation looked
 * identical to a first-ever page load. Hoisted here (once enough modules —
 * students, groups, halls, staff, calendar — were on Server Actions to
 * justify a shared provider) so a return within `staleTime` (30s below)
 * shows the cached result instantly, and a return after that still shows
 * the last-known data immediately while quietly revalidating from the
 * database in the background, rather than blocking on a fresh fetch.
 */
export function QueryProvider({ children }: { children: React.ReactNode }) {
    const [client] = useState(() => new QueryClient({
        defaultOptions: {
            queries: {
                staleTime: 30_000,
                retry: 1,
            },
        },
    }));

    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
