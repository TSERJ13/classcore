import { useEffect, useState, useRef } from 'react';
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
    const lastVerifyRef = useRef<number>(0);
    const refreshTimeoutRef = useRef<NodeJS.Timeout | null>(null);
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
            // 1. Get current Auth User (Direct from Supabase)
            const { data: { user: u }, error: authError } = await supabase.auth.getUser();
            const staffSess = getStaffSession();

            if (authError || (!u && !staffSess)) {
                setIsVerified(false);
                setLoading(false);
                return;
            }

            const currentUserEmail = u?.email || staffSess?.staff?.email;
            const currentSlug = u?.user_metadata?.studio_slug || staffSess?.slug;
            const isOwner = u?.user_metadata?.role === 'owner';
            const isSuperAdminRoute = typeof window !== 'undefined' && window.location.pathname.startsWith('/superadmin');

            // 2. Direct Database Verification (No caching, no hacks)
            if (currentUserEmail && currentSlug && !isSuperAdminRoute && !isOwner) {
                try {
                    const { verifyUserInStudio } = await import('@/lib/sync-store');
                    const hasAccess = await verifyUserInStudio(currentSlug, currentUserEmail);
                    
                    if (!hasAccess) {
                        console.warn('🚨 [useUser] Access denied by database.');
                        setIsVerified(false);
                        await logout();
                        return;
                    }
                    setIsVerified(true);
                } catch (err) {
                    console.error('⚠️ [useUser] DB Verification failed:', err);
                    setIsVerified(false);
                    return;
                }
            } else {
                const emailConfirmed = !!u?.email_confirmed_at || !!staffSess;
                setIsVerified(!!currentUserEmail && !!currentSlug && emailConfirmed);
            }

            // 3. Set Identity & Profile
            if (u) {
                setUser(u);
                const meta = u.user_metadata || {};
                setProfile({
                    ...meta,
                    studio_name: meta.studio_name,
                    studio_slug: meta.studio_slug,
                    role: meta.role || 'admin',
                    photo_url: meta.photo_url || meta.avatar_url,
                });
            } else if (staffSess) {
                const { staff, slug } = staffSess;
                const settings = loadSettings(slug);
                const latestStaff = settings.staff?.find((s: any) => s.id === staff.id) || staff;
                setUser({ id: latestStaff.id, email: latestStaff.email } as any);
                setProfile({
                    ...latestStaff,
                    studio_name: settings.studioName,
                });
            }

            setLoading(false);
        };

        refreshSession();

        const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
            refreshSession();
        });

        return () => subscription.unsubscribe();
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
