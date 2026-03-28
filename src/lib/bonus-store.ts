/**
 * bonus-store.ts
 * Stores monthly bonuses for teachers.
 */
import { getScopedKey } from './utils';

export interface MonthlyBonus {
    id: string;
    teacher_id: string;
    month: string; // YYYY-MM
    amount: number;
}

const BASE_BONUSES_KEY = 'cc_monthly_bonuses';
function getBonusesKey() { return getScopedKey(BASE_BONUSES_KEY); }

export function getMonthlyBonuses(): MonthlyBonus[] {
    if (typeof window === 'undefined') return [];
    try {
        const saved = localStorage.getItem(getBonusesKey());
        return saved ? JSON.parse(saved) : [];
    } catch { return []; }
}

export function saveMonthlyBonuses(bonuses: MonthlyBonus[]) {
    if (typeof window === 'undefined') return;
    localStorage.setItem(getBonusesKey(), JSON.stringify(bonuses));
}

export function setTeacherBonus(teacherId: string, month: string, amount: number) {
    const bonuses = getMonthlyBonuses();
    const idx = bonuses.findIndex(b => b.teacher_id === teacherId && b.month === month);

    if (amount === 0) {
        if (idx > -1) {
            bonuses.splice(idx, 1);
        }
    } else {
        if (idx > -1) {
            bonuses[idx].amount = amount;
        } else {
            bonuses.push({
                id: Math.random().toString(36).substr(2, 9),
                teacher_id: teacherId,
                month,
                amount
            });
        }
    }
    saveMonthlyBonuses(bonuses);
    window.dispatchEvent(new CustomEvent('cc_bonuses_updated'));
}

export function getTeacherBonusForMonth(teacherId: string, month: string): number {
    const bonus = getMonthlyBonuses().find(b => b.teacher_id === teacherId && b.month === month);
    return bonus ? bonus.amount : 0;
}
