'use client';

import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

/**
 * Scoped to the new /students-v2 pilot page only (see
 * docs/architecture-migration.md) — deliberately NOT mounted in the root
 * dashboard layout. The old StudioContext-based pages don't use TanStack
 * Query, so there's nothing for a global provider to do for them yet; when
 * a second module migrates, hoist this into `(dashboard)/layout.tsx`
 * instead of adding a second provider.
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
