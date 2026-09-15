import { QueryProvider } from '@/components/providers/QueryProvider';
import StudentsV2Client from './StudentsV2Client';

/**
 * Pilot page for the server-driven architecture migration — see
 * docs/architecture-migration.md. Intentionally not linked from the
 * sidebar/nav; reachable only by direct URL for review.
 */
export default function StudentsV2Page() {
    return (
        <QueryProvider>
            <StudentsV2Client />
        </QueryProvider>
    );
}
