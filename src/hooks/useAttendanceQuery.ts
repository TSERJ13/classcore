'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    getAttendancePage, getAttendanceDailyCounts, getActiveSubscriptionsForStudent,
    markAttendanceAction,
} from '@/app/actions/attendance';

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

export function useStudentSubscriptionsQuery(studentId: string) {
    return useQuery({
        queryKey: ['attendance-v2', 'subscriptions', studentId],
        queryFn: () => getActiveSubscriptionsForStudent(studentId),
        enabled: studentId.trim().length > 0,
    });
}

export function useMarkAttendanceMutation() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: markAttendanceAction,
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ['attendance-v2'] });
            const studentId = (variables as { studentId?: string })?.studentId;
            if (studentId) queryClient.invalidateQueries({ queryKey: ['attendance-v2', 'subscriptions', studentId] });
        },
    });
}
