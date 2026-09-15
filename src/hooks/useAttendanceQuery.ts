'use client';

import { useQuery } from '@tanstack/react-query';
import { getAttendancePage, getAttendanceDailyCounts } from '@/app/actions/attendance';

export function useAttendancePageQuery(params: { page: number; pageSize: number; dateFrom: string; dateTo: string; studentId?: string }) {
    return useQuery({
        queryKey: ['attendance-v2', 'page', params],
        queryFn: () => getAttendancePage(params),
        placeholderData: (prev) => prev,
    });
}

export function useAttendanceDailyCountsQuery(params: { dateFrom: string; dateTo: string }) {
    return useQuery({
        queryKey: ['attendance-v2', 'daily-counts', params],
        queryFn: () => getAttendanceDailyCounts(params),
    });
}
