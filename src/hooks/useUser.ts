import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { User } from '@supabase/supabase-js';
import { getStaffSession, setStaffSession, loadSettings } from '@/lib/settings-store';

export function useUser() {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [profile, setProfile] = useState<{
        studio_name?: string; studio_slug?: string; org_id?: string; first_name?: string; last_name?: string; role?: string; photo_url?: string; allowedBranchIds?: string[];
        canViewAttendance?: boolean;
        canViewSubscriptions?: boolean;
        canViewStudents?: boolean;
        canViewCalendar?: boolean;
        canEditCalendar?: boolean;
        canViewGroups?: boolean;
        canViewTeachers?: boolean;
        canViewHalls?: boolean;
        canViewShop?: boolean;
        canViewAnalytics?: boolean;
        canViewSMS?: boolean;
        // Legacy support
        can_view_attendance?: boolean;
        can_view_subscriptions?: boolean;
        can_view_students?: boolean;
        can_view_calendar?: boolean;
        can_edit_calendar?: boolean;
        can_view_groups?: boolean;
        can_view_teachers?: boolean;
        can_view_halls?: boolean;
        can_view_shop?: boolean;
        can_view_analytics?: boolean;
        can_view_sms?: boolean;
    } | null>(null);

    useEffect(() => {
        const supabase = createClient();

        const refreshSession = async () => {
            // 1. Check Supabase (Admins)
            const { data: { session } } = await supabase.auth.getSession();
            const u = session?.user;

            if (u) {
                console.log('👤 [useUser] Supabase session found for:', u.email);
                setUser(u);
                const meta = u.user_metadata || {};
                console.log('👤 [useUser] Metadata org_id:', meta.org_id);
                setProfile({
                    studio_name: meta.studio_name,
                    studio_slug: meta.studio_slug,
                    org_id: meta.org_id,
                    first_name: meta.first_name,
                    last_name: meta.last_name,
                    photo_url: meta.photo_url || meta.avatar_url,
                    role: meta.role || 'admin',
                    allowedBranchIds: meta.allowedBranchIds || [],
                    // camelCase
                    canViewAttendance: meta.canViewAttendance ?? meta.can_view_attendance ?? true,
                    canViewSubscriptions: meta.canViewSubscriptions ?? meta.can_view_subscriptions ?? true,
                    canViewStudents: meta.canViewStudents ?? meta.can_view_students ?? true,
                    canViewCalendar: meta.canViewCalendar ?? meta.can_view_calendar ?? true,
                    canEditCalendar: meta.canEditCalendar ?? meta.can_edit_calendar ?? true,
                    canViewGroups: meta.canViewGroups ?? meta.can_view_groups ?? true,
                    canViewTeachers: meta.canViewTeachers ?? meta.can_view_teachers ?? true,
                    canViewHalls: meta.canViewHalls ?? meta.can_view_halls ?? true,
                    canViewShop: meta.canViewShop ?? meta.can_view_shop ?? true,
                    canViewAnalytics: meta.canViewAnalytics ?? meta.can_view_analytics ?? true,
                    canViewSMS: meta.canViewSMS ?? meta.can_view_sms ?? true,
                    // snake_case
                    can_view_attendance: meta.canViewAttendance ?? meta.can_view_attendance ?? true,
                    can_view_subscriptions: meta.canViewSubscriptions ?? meta.can_view_subscriptions ?? true,
                    can_view_students: meta.canViewStudents ?? meta.can_view_students ?? true,
                    can_view_calendar: meta.canViewCalendar ?? meta.can_view_calendar ?? true,
                    can_edit_calendar: meta.canEditCalendar ?? meta.can_edit_calendar ?? true,
                    can_view_groups: meta.canViewGroups ?? meta.can_view_groups ?? true,
                    can_view_teachers: meta.canViewTeachers ?? meta.can_view_teachers ?? true,
                    can_view_halls: meta.canViewHalls ?? meta.can_view_halls ?? true,
                    can_view_shop: meta.canViewShop ?? meta.can_view_shop ?? true,
                    can_view_analytics: meta.canViewAnalytics ?? meta.can_view_analytics ?? true,
                    can_view_sms: meta.canViewSMS ?? meta.can_view_sms ?? true,
                });
                setLoading(false);
                return;
            }

            // 2. Check Staff Session (Non-Admins)
            const staffSess = getStaffSession();
            if (staffSess) {
                const { staff: sessionStaff, slug } = staffSess;
                const settings = loadSettings(slug);

                // CRITICAL: Find the LATEST staff data from settings to get updated permissions/branches
                const staff = settings.staff?.find((s: any) => s.id === sessionStaff.id) || sessionStaff;

                setUser({ id: staff.id, email: staff.email } as any);
                setProfile({
                    studio_name: settings.studioName,
                    first_name: staff.first_name,
                    last_name: staff.last_name,
                    photo_url: staff.photo_url,
                    role: staff.role,
                    allowedBranchIds: staff.allowedBranchIds || [],
                    // camelCase
                    canViewAttendance: staff.permissions?.canViewAttendance ?? (staff as any).can_view_attendance ?? false,
                    canViewSubscriptions: staff.permissions?.canViewSubscriptions ?? (staff as any).can_view_subscriptions ?? false,
                    canViewStudents: staff.permissions?.canViewStudents ?? (staff as any).can_view_students ?? false,
                    canViewCalendar: staff.permissions?.canViewCalendar ?? (staff as any).can_view_calendar ?? false,
                    canEditCalendar: staff.permissions?.canEditCalendar ?? (staff as any).can_edit_calendar ?? false,
                    canViewGroups: staff.permissions?.canViewGroups ?? (staff as any).can_view_groups ?? false,
                    canViewTeachers: staff.permissions?.canViewTeachers ?? (staff as any).can_view_teachers ?? false,
                    canViewHalls: staff.permissions?.canViewHalls ?? (staff as any).can_view_halls ?? false,
                    canViewShop: staff.permissions?.canViewShop ?? (staff as any).can_view_shop ?? false,
                    canViewAnalytics: staff.permissions?.canViewAnalytics ?? (staff as any).can_view_analytics ?? false,
                    canViewSMS: staff.permissions?.canViewSMS ?? (staff as any).can_view_sms ?? false,
                    // snake_case
                    can_view_attendance: staff.permissions?.canViewAttendance ?? (staff as any).can_view_attendance ?? false,
                    can_view_subscriptions: staff.permissions?.canViewSubscriptions ?? (staff as any).can_view_subscriptions ?? false,
                    can_view_students: staff.permissions?.canViewStudents ?? (staff as any).can_view_students ?? false,
                    can_view_calendar: staff.permissions?.canViewCalendar ?? (staff as any).can_view_calendar ?? false,
                    can_edit_calendar: staff.permissions?.canEditCalendar ?? (staff as any).can_edit_calendar ?? false,
                    can_view_groups: staff.permissions?.canViewGroups ?? (staff as any).can_view_groups ?? false,
                    can_view_teachers: staff.permissions?.canViewTeachers ?? (staff as any).can_view_teachers ?? false,
                    can_view_halls: staff.permissions?.canViewHalls ?? (staff as any).can_view_halls ?? false,
                    can_view_shop: staff.permissions?.canViewShop ?? (staff as any).can_view_shop ?? false,
                    can_view_analytics: staff.permissions?.canViewAnalytics ?? (staff as any).can_view_analytics ?? false,
                    can_view_sms: staff.permissions?.canViewSMS ?? (staff as any).can_view_sms ?? false,
                });
            } else {
                setUser(null);
                setProfile(null);
            }
            setLoading(false);
        };

        // Initial session fetch
        refreshSession();

        // Listen for auth changes (Supabase)
        const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
            refreshSession();
        });

        // Listen for staff data updates (permissions, etc)
        const handleRefresh = () => {
            console.log('🔄 [useUser] Staff update event received, refreshing session...');
            refreshSession();
        };

        window.addEventListener('cc_staff_update', handleRefresh);

        return () => {
            subscription.unsubscribe();
            window.removeEventListener('cc_staff_update', handleRefresh);
        };
    }, []);

    // Sync profile to cookies for SSR navigation/header consistency
    useEffect(() => {
        if (profile) {
            if (profile.role) {
                document.cookie = `cc_user_role=${profile.role}; path=/; max-age=31536000; SameSite=Lax`;
            }
            if (profile.studio_name) {
                document.cookie = `cc_studio_name=${encodeURIComponent(profile.studio_name)}; path=/; max-age=31536000; SameSite=Lax`;
            }
        }
    }, [profile]);

    const logout = async () => {
        const supabase = createClient();
        await supabase.auth.signOut();
        setStaffSession(null);
        window.location.href = '/login';
    };

    return { user, profile, loading, logout };
}
