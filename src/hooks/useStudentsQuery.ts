'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    getStudentsPage, createStudentAction, updateStudentAction,
    deleteStudentAction, getGroupsForOrg, updateStudentGroupsAction,
    type CreateStudentInput,
} from '@/app/actions/students';

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

export function useGroupsQuery() {
    return useQuery({
        queryKey: ['students-v2', 'groups'],
        queryFn: () => getGroupsForOrg(),
        staleTime: 5 * 60_000, // group list barely changes; no need to refetch often
    });
}

function useInvalidateStudents() {
    const queryClient = useQueryClient();
    return () => queryClient.invalidateQueries({ queryKey: ['students-v2'] });
}

export function useCreateStudentMutation() {
    const invalidate = useInvalidateStudents();
    return useMutation({
        mutationFn: (input: CreateStudentInput) => createStudentAction(input),
        onSuccess: invalidate,
    });
}

export function useUpdateStudentMutation() {
    const invalidate = useInvalidateStudents();
    return useMutation({
        mutationFn: (input: CreateStudentInput & { id: string }) => updateStudentAction(input),
        onSuccess: invalidate,
    });
}

export function useDeleteStudentMutation() {
    const invalidate = useInvalidateStudents();
    return useMutation({
        mutationFn: (input: { id: string }) => deleteStudentAction(input),
        onSuccess: invalidate,
    });
}

export function useUpdateStudentGroupsMutation() {
    const invalidate = useInvalidateStudents();
    return useMutation({
        mutationFn: (input: { id: string; enrolled_group_ids: string[] }) => updateStudentGroupsAction(input),
        onSuccess: invalidate,
    });
}
