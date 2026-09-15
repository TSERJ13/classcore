import { QueryProvider } from '@/components/providers/QueryProvider';
import AttendanceV2Client from './AttendanceV2Client';

/**
 * Pilot page for Phase 1 of the architecture migration — see
 * docs/architecture-migration.md. Intentionally not linked from the
 * sidebar/nav; reachable only by direct URL for review.
 */
export default function AttendanceV2Page() {
    return (
        <QueryProvider>
            <AttendanceV2Client />
        </QueryProvider>
    );
}
