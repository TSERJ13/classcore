'use client';

import { useInfiniteQuery, useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    searchStudents, saveStudentAction, deleteStudentAction,
    checkDuplicateStudentAction, getGroupsForOrg,
} from '@/app/actions/students';

const PAGE_SIZE = 100;

export type StudentsFilterParams = {
    search: string;
    status: 'all' | 'active' | 'inactive';
    gender: 'all' | 'male' | 'female';
    groupId?: string;
    visibleGroupIds?: string[];
    sortBy: 'none' | 'first_name' | 'last_name' | 'gender';
    branchId?: string;
};

/**
 * Card grid UX wants "load more", not page-number controls — infinite
 * query appends pages instead of replacing them. Any filter change is part
 * of the query key, so it naturally resets to page 1.
 */
export function useStudentsListQuery(params: StudentsFilterParams) {
    return useInfiniteQuery({
        queryKey: ['students', 'search', params],
        queryFn: ({ pageParam }) => searchStudents({ ...params, page: pageParam, pageSize: PAGE_SIZE }),
        initialPageParam: 1,
        getNextPageParam: (lastPage) => (lastPage.page * lastPage.pageSize < lastPage.total ? lastPage.page + 1 : undefined),
    });
}

export function useGroupsQuery() {
    return useQuery({
        queryKey: ['students', 'groups'],
        queryFn: () => getGroupsForOrg(),
        staleTime: 5 * 60_000,
    });
}

function useInvalidateStudents() {
    const queryClient = useQueryClient();
    return () => queryClient.invalidateQueries({ queryKey: ['students', 'search'] });
}

export function useSaveStudentMutation() {
    const invalidate = useInvalidateStudents();
    return useMutation({
        mutationFn: saveStudentAction,
        onSuccess: invalidate,
    });
}

export function useDeleteStudentMutation() {
    const invalidate = useInvalidateStudents();
    return useMutation({
        mutationFn: deleteStudentAction,
        onSuccess: invalidate,
    });
}

export function useCheckDuplicateStudent() {
    return useMutation({ mutationFn: checkDuplicateStudentAction });
}
