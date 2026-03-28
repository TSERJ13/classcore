/**
 * salary-status-store.ts
 * Persists payment status (paid/pending) for teacher salaries per month.
 */
import { getScopedKey } from './utils';

export type SalaryStatus = 'paid' | 'pending';

export interface TeacherSalaryStatus {
    teacherId: string;
    month: string; // YYYY-MM
    status: SalaryStatus;
}

const BASE_SALARY_STATUS_KEY = 'cc_salary_statuses';
function getSalaryStatusKey() { return getScopedKey(BASE_SALARY_STATUS_KEY); }

export function getSalaryStatuses(): TeacherSalaryStatus[] {
    if (typeof window === 'undefined') return [];
    try {
        const saved = localStorage.getItem(getSalaryStatusKey());
        return saved ? JSON.parse(saved) : [];
    } catch { return []; }
}

export function saveSalaryStatuses(statuses: TeacherSalaryStatus[]) {
    if (typeof window === 'undefined') return;
    localStorage.setItem(getSalaryStatusKey(), JSON.stringify(statuses));
    window.dispatchEvent(new CustomEvent('cc_salary_statuses_updated'));
}

export function getStatusForTeacher(teacherId: string, month: string): SalaryStatus {
    const statuses = getSalaryStatuses();
    const found = statuses.find(s => s.teacherId === teacherId && s.month === month);
    return found ? found.status : 'pending';
}

export function toggleSalaryStatus(teacherId: string, month: string) {
    const statuses = getSalaryStatuses();
    const idx = statuses.findIndex(s => s.teacherId === teacherId && s.month === month);

    if (idx > -1) {
        statuses[idx].status = statuses[idx].status === 'paid' ? 'pending' : 'paid';
    } else {
        statuses.push({
            teacherId,
            month,
            status: 'paid'
        });
    }
    saveSalaryStatuses(statuses);
}
