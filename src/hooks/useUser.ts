import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { User } from '@supabase/supabase-js';
import { getStaffSession, setStaffSession, loadSettings } from '@/lib/settings-store';

const SUPER_ADMIN_EMAILS = [
    'adminclasscore@gmail.com', 'support@classcore.ge', 'admin@classcore.ge', 
    'tserj13@classcore.ge', 'sergi.tsivtsivadze@gmail.com'
];

export function useUser() {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [isVerified, setIsVerified] = useState<boolean | null>(null);
    const [profile, setProfile] = useState<{
        studio_name?: string; studio_slug?: string; org_id?: string; first_name?: string; last_name?: string; phone?: string; role?: string; photo_url?: string; allowedBranchIds?: string[];
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
            const isSuperAdminRoute = typeof window !== 'undefined' && window.location.pathname.startsWith('/superadmin');
            
            // 1. Authoritative Auth Check (Hits server)
            const { data: { user: u }, error: authError } = await supabase.auth.getUser();
            
            if (authError || !u) {
                // If Supabase say NO, we still check Staff Session (Virtual users)
                const staffSess = getStaffSession();
                if (staffSess) {
                    // Continue to staff validation below
                } else {
                    setLoading(false);
                    return;
                }
            }

            const staffSess = getStaffSession();
            
            // Determine the final user email to validate
            const currentUserEmail = u?.email || staffSess?.staff?.email;
            const currentSlug = u?.user_metadata?.studio_slug || staffSess?.slug;

            // MANDATORY CLOUD VALIDATION (Ghost Login Protection)
            // If we have a session but it's not a superadmin route, verify existence in DB
            if (currentUserEmail && currentSlug && !isSuperAdminRoute) {
                try {
                    const { verifyUserInStudio } = await import('@/lib/sync-store');
                    
                    // Set a strict 4s timeout for verification
                    const verifyTask = verifyUserInStudio(currentSlug, currentUserEmail);
                    const timeoutTask = new Promise<boolean>((_, reject) => setTimeout(() => reject(new Error('TIMEOUT')), 4000));
                    
                    const stillHasAccess = await Promise.race([verifyTask, timeoutTask]).catch(() => false); // Strict: deny on timeout/error

                    if (!stillHasAccess) {
                        console.warn('🚨 [useUser] Session invalid: User no longer found in this studio. Logging out.');
                        setIsVerified(false);
                        await logout();
                        return;
                    }
                    setIsVerified(true);
                } catch (err) {
                    console.error('⚠️ [useUser] Cloud validation failed:', err);
                    setIsVerified(false); // Strict: block on error
                    await logout();
                }
            } else if (!currentUserEmail || !currentSlug) {
                setIsVerified(false);
            } else {
                // For superadmins or login pages, we allow
                setIsVerified(true);
            }

            const activeSlugLocal = localStorage.getItem('cc_active_studio_slug');
            const pathSegments = typeof window !== 'undefined' ? window.location.pathname.split('/').filter(Boolean) : [];
            const pathSlug = pathSegments[0];
            const reservedWords = ['dashboard', 'superadmin', 'login', 'registration', 'sa-login', 'api', 'auth'];
            
            const activeSlug = activeSlugLocal || (!reservedWords.includes(pathSlug) ? pathSlug : null);

            // SSS (Smart Session Selection): 
            // If on a regular route and we have both a SuperAdmin Supabase session AND a Staff session, 
            // we PRIORITIZE the Staff session to prevent account override.
            const isSuperAccount = u?.email && SUPER_ADMIN_EMAILS.some(e => e.toLowerCase() === u.email?.toLowerCase());
            
            // CRITICAL: Even if there is no staffSess, if we are on a regular route and the Supabase user 
            // is a SuperAdmin, we should verify if they are actually the owner of THIS specific studio.
            // If it's a general SuperAdmin account without a matching slug, we might want to keep looking 
            // at staffSess (which could be the valid owner identity).
            const shouldPrioritizeStaff = !isSuperAdminRoute && (
                (isSuperAccount && staffSess) || 
                (isSuperAccount && activeSlug && u.user_metadata?.studio_slug !== activeSlug && staffSess)
            );

            if (u && !shouldPrioritizeStaff) {
                // ... same profile logic ...
                console.log('👤 [useUser] Supabase session found for:', u.email);
                setUser(u);
                const meta = u.user_metadata || {};
                setProfile({
                    studio_name: meta.studio_name,
                    studio_slug: meta.studio_slug,
                    org_id: meta.org_id,
                    first_name: meta.first_name,
                    last_name: meta.last_name,
                    phone: meta.phone || meta.phone_number,
                    photo_url: meta.photo_url || meta.avatar_url,
                    role: meta.role || 'admin',
                    allowedBranchIds: meta.allowedBranchIds || [],
                    // ... permissions logic remains same ...
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
                    phone: staff.phone || staff.phone_number,
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
        
        // Clear all cc_ related cookies to ensure SSR components (like the landing page) stay in sync
        document.cookie = "cc_user_role=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax";
        document.cookie = "cc_studio_name=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax";
        document.cookie = "cc_auth_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax";
        document.cookie = "cc_active_slug=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax";
        
        window.location.href = '/login';
    };

    return { user, profile, loading, isVerified, logout };
}
