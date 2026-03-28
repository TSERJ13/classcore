/**
 * student-data.ts
 * Centralized mock data for students to be used across the app (Attendance, Shop, Subscriptions).
 */

import type { Student } from '@/types';

export const ALL_STUDENTS: (Student & { classes: string[] })[] = [];

export function getStudents() {
    return ALL_STUDENTS;
}

export function getStudentById(id: string) {
    return ALL_STUDENTS.find(s => s.id === id) || null;
}

export function getStudentsByClass(classId: string) {
    return ALL_STUDENTS.filter(s => s.classes.includes(classId));
}
