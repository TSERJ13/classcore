'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getStudentsPage, createStudentAction, type CreateStudentInput } from '@/app/actions/students';

export function studentsQueryKey(params: { page: number; pageSize: number; search: string }) {
    return ['students-v2', params] as const;
}

/**
 * queryFn calls the Server Action directly — Next.js turns that into a POST
 * under the hood. No hand-written fetch/route needed for the read path.
 */
export function useStudentsQuery(params: { page: number; pageSize: number; search: string }) {
    return useQuery({
        queryKey: studentsQueryKey(params),
        queryFn: () => getStudentsPage(params),
        placeholderData: (prev) => prev, // keep old page visible while the next one loads
    });
}

export function useCreateStudentMutation() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (input: CreateStudentInput) => createStudentAction(input),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['students-v2'] });
        },
    });
}
