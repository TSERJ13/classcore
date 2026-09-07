/**
 * salary-status-store.ts
 * Persists payment status and actual paid amounts for teacher salaries per month.
 * Supports partial payouts and syncs to both studio settings and Supabase expenses table.
 */
import { getScopedKey, getActiveSlug, markLocalUpdate, getEffectiveOrgId } from './utils';
import { pushStudioStateToCloud } from './sync-store';
import { syncRecordToCloud } from './master-sync';

export type SalaryStatus = 'paid' | 'partial' | 'pending';

export interface TeacherSalaryStatus {
    teacherId: string;
    month: string; // YYYY-MM
    status: SalaryStatus;
    paidAmount: number;
    paidAt?: string;
    notes?: string;
}

const BASE_SALARY_STATUS_KEY = 'cc_salary_statuses';
function getSalaryStatusKey() { return getScopedKey(BASE_SALARY_STATUS_KEY); }

export function getSalaryStatuses(): TeacherSalaryStatus[] {
    if (typeof window === 'undefined') return [];
    try {
        const saved = localStorage.getItem(getSalaryStatusKey());
        let list: TeacherSalaryStatus[] = [];
        if (saved) {
            const parsed = JSON.parse(saved);
            if (Array.isArray(parsed)) {
                list = parsed.map(item => ({
                    teacherId: item.teacherId,
                    month: item.month,
                    status: item.status || ((item.paidAmount && item.paidAmount > 0) ? 'paid' : 'pending'),
                    paidAmount: typeof item.paidAmount === 'number' ? item.paidAmount : (item.status === 'paid' ? 0 : 0),
                    paidAt: item.paidAt,
                    notes: item.notes
                }));
            }
        }

        // Hydration from cloud expenses fallback (if any salary payout was synced to cloud expenses)
        try {
            const activeSlug = getActiveSlug() || 'default';
            const cloudRaw = localStorage.getItem(getScopedKey('cc_expenses', activeSlug));
            if (cloudRaw) {
                const cloudMap = JSON.parse(cloudRaw);
                if (cloudMap && typeof cloudMap === 'object') {
                    Object.values(cloudMap).forEach((row: any) => {
                        if (row && (row.id?.startsWith('salary_') || row.category === 'salary') && row.data) {
                            const d = row.data;
                            if (d.teacherId && d.month) {
                                const idx = list.findIndex(s => s.teacherId === d.teacherId && s.month === d.month);
                                if (idx === -1) {
                                    list.push({
                                        teacherId: d.teacherId,
                                        month: d.month,
                                        status: d.status || (Number(row.amount) > 0 ? 'paid' : 'pending'),
                                        paidAmount: typeof d.paidAmount === 'number' ? d.paidAmount : (Number(row.amount) || 0),
                                        paidAt: d.paidAt || row.created_at,
                                        notes: d.notes
                                    });
                                }
                            }
                        }
                    });
                }
            }
        } catch {}

        return list;
    } catch { return []; }
}

export async function saveSalaryStatuses(statuses: TeacherSalaryStatus[]) {
    if (typeof window === 'undefined') return;
    const key = getSalaryStatusKey();
    localStorage.setItem(key, JSON.stringify(statuses));
    markLocalUpdate();
    
    // Standardized Cloud Sync
    const activeSlug = getActiveSlug();
    if (activeSlug && activeSlug !== 'demo.classcore.ge') {
        // 1. Save to studio settings blob
        pushStudioStateToCloud(activeSlug, [], { [key]: statuses });

        // 2. Real Cloud Persistence: Upsert to Supabase `expenses` table as category 'salary'
        const finalOrgId = getEffectiveOrgId(activeSlug);
        if (finalOrgId) {
            statuses.forEach(s => {
                const date = `${s.month}-01`;
                syncRecordToCloud('expenses', {
                    id: `salary_${s.teacherId}_${s.month}`,
                    org_id: finalOrgId,
                    category: 'salary',
                    amount: s.paidAmount || 0,
                    description: `Salary Payout: ${s.teacherId} (${s.month})`,
                    date,
                    data: {
                        teacherId: s.teacherId,
                        month: s.month,
                        paidAmount: s.paidAmount || 0,
                        status: s.status,
                        notes: s.notes || '',
                        paidAt: s.paidAt || new Date().toISOString()
                    }
                }, finalOrgId).catch(() => {});
            });
        }
    }
    
    window.dispatchEvent(new CustomEvent('cc_salary_update'));
    window.dispatchEvent(new CustomEvent('cc_salary_statuses_updated'));
}

export function getTeacherSalaryPayment(teacherId: string, month: string, totalSalary: number = 0): {
    status: SalaryStatus;
    paidAmount: number;
    remaining: number;
    paidAt?: string;
    notes?: string;
} {
    const statuses = getSalaryStatuses();
    const found = statuses.find(s => s.teacherId === teacherId && s.month === month);
    if (!found) {
        return {
            status: 'pending',
            paidAmount: 0,
            remaining: Math.max(0, totalSalary)
        };
    }

    const paidAmount = typeof found.paidAmount === 'number'
        ? found.paidAmount
        : (found.status === 'paid' ? totalSalary : 0);

    let status: SalaryStatus = 'pending';
    if (paidAmount >= totalSalary && totalSalary > 0) {
        status = 'paid';
    } else if (paidAmount > 0) {
        status = 'partial';
    } else {
        status = found.status === 'paid' ? 'paid' : 'pending';
    }

    const remaining = Math.max(0, totalSalary - paidAmount);
    return {
        status,
        paidAmount,
        remaining,
        paidAt: found.paidAt,
        notes: found.notes
    };
}

export function getStatusForTeacher(teacherId: string, month: string, totalSalary: number = 0): SalaryStatus {
    return getTeacherSalaryPayment(teacherId, month, totalSalary).status;
}

export function updateTeacherSalaryPayment(
    teacherId: string,
    month: string,
    paidAmount: number,
    totalSalary: number,
    notes?: string
) {
    const statuses = getSalaryStatuses();
    const cleanAmount = Math.max(0, Number(paidAmount) || 0);

    let status: SalaryStatus = 'pending';
    if (cleanAmount >= totalSalary && totalSalary > 0) {
        status = 'paid';
    } else if (cleanAmount > 0) {
        status = 'partial';
    } else {
        status = 'pending';
    }

    const idx = statuses.findIndex(s => s.teacherId === teacherId && s.month === month);
    const updatedRecord: TeacherSalaryStatus = {
        teacherId,
        month,
        status,
        paidAmount: cleanAmount,
        notes: notes !== undefined ? notes : (idx > -1 ? statuses[idx].notes : ''),
        paidAt: new Date().toISOString()
    };

    if (idx > -1) {
        statuses[idx] = updatedRecord;
    } else {
        statuses.push(updatedRecord);
    }

    saveSalaryStatuses(statuses);
}

export function toggleSalaryStatus(teacherId: string, month: string, totalSalary: number = 0) {
    const payment = getTeacherSalaryPayment(teacherId, month, totalSalary);
    if (payment.status === 'paid') {
        updateTeacherSalaryPayment(teacherId, month, 0, totalSalary);
    } else {
        updateTeacherSalaryPayment(teacherId, month, totalSalary, totalSalary);
    }
}
