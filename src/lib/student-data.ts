/**
 * student-data.ts
 * Centralized mock data for students to be used across the app (Attendance, Shop, Subscriptions).
 */

import type { Student } from '@/types';

export const ALL_STUDENTS: (Student & { classes: string[] })[] = [
    { id: '1', org_id: 'org1', full_name: 'ნინო ბერიძე', phone: '555112233', classes: ['cls1'], created_at: new Date().toISOString(), photo_url: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?q=80&w=200&auto=format&fit=crop', preferred_language: 'ka', social_links: { facebook: 'https://fb.com', instagram: 'https://inst.com' } },
    { id: '2', org_id: 'org1', full_name: 'გიორგი მახარაძე', phone: '555111111', classes: ['cls1', 'cls2'], created_at: new Date().toISOString(), photo_url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?q=80&w=200&auto=format&fit=crop', preferred_language: 'ka' },
    { id: '3', org_id: 'org1', full_name: 'ელენე აფშილავა', phone: '555222222', classes: ['cls2'], created_at: new Date().toISOString(), photo_url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=200&auto=format&fit=crop', preferred_language: 'en' },
    { id: 'AE00001', org_id: 'org1', full_name: 'ელენე აფშილავა (Test)', phone: '555333333', classes: ['cls1'], created_at: new Date().toISOString(), preferred_language: 'ka' },
    { id: 'KA00012', org_id: 'org1', full_name: 'კანდელაკი ანა', phone: '555123456', classes: ['cls1'], created_at: new Date().toISOString(), preferred_language: 'ka' },
    { id: '4', org_id: 'org1', full_name: 'მარიამ დათიაშვილი', phone: '555444444', classes: ['cls3'], created_at: new Date().toISOString(), preferred_language: 'ka' },
];

export function getStudents() {
    return ALL_STUDENTS;
}

export function getStudentById(id: string) {
    return ALL_STUDENTS.find(s => s.id === id) || null;
}

export function getStudentsByClass(classId: string) {
    return ALL_STUDENTS.filter(s => s.classes.includes(classId));
}
