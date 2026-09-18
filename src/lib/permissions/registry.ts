/**
 * Permission Registry — docs/permissions-module-prd.md §9's standard:
 * every module's actions catalogued as `module.action` Permission IDs, so
 * a future Module PRD can just "register" into this file instead of the
 * whole system being redesigned per module.
 *
 * HONEST STARTING POINT, not aspirational: today's actual enforcement
 * granularity is coarse — one `canView{Module}` boolean per module (see
 * `StaffPermissions`, src/types/index.ts), plus a handful of legacy flags
 * (`canAddStudents`, `canDeleteRecords`, `manageBilling`, `viewFinancials`,
 * `manageInventory`, `canEditCalendar`) that already distinguish a
 * specific action from plain viewing. This registry catalogues exactly
 * that reality: a `.view` entry per module (backed by its existing
 * `canView*` flag), plus entries for the actions that already have their
 * own flag. It does NOT invent new booleans for `students.delete`,
 * `subscriptions.create`, etc. where no such distinction exists in the
 * code today — building that out is real follow-up work (wiring each
 * Server Action to check its own registry entry instead of the page-level
 * `canView*` gate), catalogued here as `backedBy: null` so it's visible
 * what's still coarse-grained rather than silently pretending it's finer
 * than it is.
 *
 * Only modules migrated to Server Actions this session are catalogued —
 * every future Module PRD adds its own entries here per §9, going
 * forward, not retrofitted for the rest of the app in this pass.
 */

import type { StaffPermissions } from '@/types';

export type PermissionZone = 'dashboard' | 'student';

export interface PermissionRegistryEntry {
    id: string;
    module: string;
    label: string;
    zone: PermissionZone;
    /** The existing StaffPermissions key this ID is currently backed by, or null if no distinct flag exists yet (falls back to the module's own `.view` entry when checked). */
    backedBy: keyof StaffPermissions | null;
}

export const PERMISSION_REGISTRY: PermissionRegistryEntry[] = [
    // Students
    { id: 'students.view', module: 'students', label: 'View students', zone: 'dashboard', backedBy: 'canViewStudents' },
    { id: 'students.create', module: 'students', label: 'Add a student', zone: 'dashboard', backedBy: 'canAddStudents' },
    { id: 'students.update', module: 'students', label: 'Edit a student', zone: 'dashboard', backedBy: null },
    { id: 'students.delete', module: 'students', label: 'Delete a student', zone: 'dashboard', backedBy: 'canDeleteRecords' },

    // Attendance / check-in
    { id: 'attendance.view', module: 'attendance', label: 'View attendance', zone: 'dashboard', backedBy: 'canViewAttendance' },
    { id: 'attendance.mark', module: 'attendance', label: 'Mark present/absent', zone: 'dashboard', backedBy: null },

    // Subscriptions
    { id: 'subscriptions.view', module: 'subscriptions', label: 'View subscriptions', zone: 'dashboard', backedBy: 'canViewSubscriptions' },
    { id: 'subscriptions.create', module: 'subscriptions', label: 'Issue a subscription', zone: 'dashboard', backedBy: null },
    { id: 'subscriptions.update', module: 'subscriptions', label: 'Edit/pause a subscription', zone: 'dashboard', backedBy: null },
    { id: 'subscriptions.delete', module: 'subscriptions', label: 'Delete a subscription', zone: 'dashboard', backedBy: 'canDeleteRecords' },

    // Tariff plans
    { id: 'plans.view', module: 'plans', label: 'View tariff plans', zone: 'dashboard', backedBy: 'canViewSubscriptions' },
    { id: 'plans.manage', module: 'plans', label: 'Create/edit/delete tariff plans', zone: 'dashboard', backedBy: null },

    // Dashboard stats
    { id: 'dashboard.view', module: 'dashboard', label: 'View the dashboard', zone: 'dashboard', backedBy: null },

    // Groups
    { id: 'groups.view', module: 'groups', label: 'View groups', zone: 'dashboard', backedBy: 'canViewGroups' },
    { id: 'groups.manage', module: 'groups', label: 'Create/edit/delete groups', zone: 'dashboard', backedBy: null },

    // Staff / Teachers
    { id: 'staff.view', module: 'staff', label: 'View staff/teachers', zone: 'dashboard', backedBy: 'canViewTeachers' },
    { id: 'staff.manage', module: 'staff', label: 'Add/edit/remove staff', zone: 'dashboard', backedBy: null },

    // Branches
    { id: 'branches.view', module: 'branches', label: 'View branches', zone: 'dashboard', backedBy: null },
    { id: 'branches.manage', module: 'branches', label: 'Add/edit/remove branches', zone: 'dashboard', backedBy: null },

    // Halls
    { id: 'halls.view', module: 'halls', label: 'View halls', zone: 'dashboard', backedBy: 'canViewHalls' },
    { id: 'halls.manage', module: 'halls', label: 'Add/edit/delete halls', zone: 'dashboard', backedBy: null },

    // Shop
    { id: 'shop.view', module: 'shop', label: 'View shop', zone: 'dashboard', backedBy: 'canViewShop' },
    { id: 'shop.sell', module: 'shop', label: 'Record a sale', zone: 'dashboard', backedBy: null },
    { id: 'shop.manage_inventory', module: 'shop', label: 'Manage products/inventory', zone: 'dashboard', backedBy: 'manageInventory' },

    // Expenses / Analytics
    { id: 'analytics.view', module: 'analytics', label: 'View analytics', zone: 'dashboard', backedBy: 'canViewAnalytics' },
    { id: 'expenses.manage', module: 'analytics', label: 'Enter monthly expenses', zone: 'dashboard', backedBy: 'viewFinancials' },

    // Billing
    { id: 'billing.view', module: 'billing', label: 'View billing', zone: 'dashboard', backedBy: 'canViewBilling' },
    { id: 'billing.manage', module: 'billing', label: 'Manage billing', zone: 'dashboard', backedBy: 'manageBilling' },

    // SMS
    { id: 'sms.view', module: 'sms', label: 'View SMS templates/manager', zone: 'dashboard', backedBy: 'canViewSMS' },

    // Calendar
    { id: 'calendar.view', module: 'calendar', label: 'View calendar', zone: 'dashboard', backedBy: 'canViewCalendar' },
    { id: 'calendar.edit', module: 'calendar', label: 'Edit calendar events', zone: 'dashboard', backedBy: 'canEditCalendar' },
];

export function getRegistryEntry(id: string): PermissionRegistryEntry | undefined {
    return PERMISSION_REGISTRY.find(e => e.id === id);
}

export function getModuleEntries(module: string): PermissionRegistryEntry[] {
    return PERMISSION_REGISTRY.filter(e => e.module === module);
}
