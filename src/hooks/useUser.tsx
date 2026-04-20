'use client';
import { useEffect, useState, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { User } from '@supabase/supabase-js';
import { getStaffSession, setStaffSession, loadSettings } from '@/lib/settings-store';

const SUPER_ADMIN_EMAILS = [
    'adminclasscore@gmail.com', 'support@classcore.ge', 'admin@classcore.ge', 
    'sergi.tsivtsivadze@gmail.com'
];

import React, { createContext, useContext, ReactNode } from 'react';

interface UserContextValue {
    user: User | null;
    profile: any | null;
    loading: boolean;
    isVerified: boolean | null;
    logout: () => Promise<void>;
}

const UserContext = createContext<UserContextValue>({
    user: null,
    profile: null,
    loading: true,
    isVerified: null,
    logout: async () => {},
});

export function UserProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [isVerified, setIsVerified] = useState<boolean | null>(null);
    
    const [profile, setProfile] = useState<{
        studio_name?: string; studio_slug?: string; org_id?: string; first_name?: string; last_name?: string; phone?: string; role?: string; photo_url?: string; is_activated?: boolean; allowedBranchIds?: string[];
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
    } | null>(null);

    useEffect(() => {
        const supabase = createClient();

        const refreshSession = async () => {
            const { data: { user: u }, error: authError } = await supabase.auth.getUser();
            const staffSess = getStaffSession();
            const urlSlug = typeof window !== 'undefined' ? window.location.pathname.split('/')[1] : null;

            // 🚨 RESILIENCE FIX: Ignore authError if we have a valid staff session.
            if (!u && !staffSess) {
                if (authError) console.log('🔍 [UserProvider] No active session found. Supabase Auth Error:', authError.message);
                setIsVerified(false);
                setLoading(false);
                return;
            }

            const currentUserIdentity = u?.email || staffSess?.staff?.email || staffSess?.staff?.phone || (staffSess as any)?.staff?.phone_number;
            let currentSlug = u?.user_metadata?.studio_slug || staffSess?.slug || (urlSlug && urlSlug !== 'dashboard' && urlSlug !== 'login' ? urlSlug : null);
            const isOwner = u?.user_metadata?.role === 'owner';
            const isSuperAdminRoute = typeof window !== 'undefined' && window.location.pathname.startsWith('/superadmin');

            console.log(`🚩 [UserProvider] Context: Identity=${currentUserIdentity}, Slug=${currentSlug}, isOwner=${isOwner}, isSuperAdminRoute=${isSuperAdminRoute}`);

            if (currentUserIdentity && !currentSlug && !isSuperAdminRoute) {
                try {
                    const { findAllStudiosByStaffEmail } = await import('@/lib/sync-store');
                    const matches = await findAllStudiosByStaffEmail(currentUserIdentity);
                    if (matches && matches.length > 0) {
                        currentSlug = matches[0].slug;
                        console.log(`📡 [UserProvider] Recovered studio slug via global search: ${currentSlug}`);
                    }
                } catch (err) {
                    console.error('⚠️ [UserProvider] Slug recovery failed:', err);
                }
            }

            if (currentUserIdentity && currentSlug && !isSuperAdminRoute && !isOwner) {
                try {
                    console.log(`🔍 [UserProvider] Verifying ${currentUserIdentity} access to ${currentSlug}...`);
                    const { verifyUserInStudio } = await import('@/lib/sync-store');
                    const hasAccess = await verifyUserInStudio(currentSlug, currentUserIdentity);
                    
                    if (!hasAccess) {
                        console.warn(`🚨 [UserProvider] VERIFICATION DENIED for ${currentUserIdentity} in ${currentSlug}. User found in session but missing in DB staff_emails.`);
                        setIsVerified(false);
                        return;
                    }
                    console.log(`✅ [UserProvider] Verification SUCCESS for ${currentUserIdentity} in ${currentSlug}`);
                    setIsVerified(true);
                } catch (err) {
                    console.error('⚠️ [UserProvider] DB Verification crashed:', err);
                    setIsVerified(false);
                    return;
                }
            } else {
                const identityConfirmed = !!u?.email_confirmed_at || !!staffSess;
                const status = !!currentUserIdentity && !!currentSlug && identityConfirmed;
                console.log(`🏳️ [UserProvider] Identity shortcut verification: ${status} (Identity: ${!!currentUserIdentity}, Slug: ${!!currentSlug}, Confirmed: ${identityConfirmed})`);
                setIsVerified(status);
            }

            if (u) {
                setUser(u);
                const meta = u.user_metadata || {};
                setProfile({
                    ...meta,
                    studio_name: meta.studio_name,
                    studio_slug: currentSlug,
                    role: meta.role || 'admin',
                    photo_url: meta.photo_url || meta.avatar_url,
                    is_activated: meta.is_activated !== false,
                });
            } else if (staffSess) {
                const { staff, slug } = staffSess;
                const settings = loadSettings(slug);
                const latestStaff = settings.staff?.find((s: any) => s.id === staff.id) || staff;
                setUser({ id: latestStaff.id, email: latestStaff.email } as any);
                setProfile({
                    ...latestStaff,
                    studio_name: settings.studioName,
                    studio_slug: slug,
                    is_activated: true,
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
        
        document.cookie = "cc_user_role=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax";
        document.cookie = "cc_studio_name=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax";
        document.cookie = "cc_auth_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax";
        document.cookie = "cc_active_slug=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax";
        
        window.location.href = '/login';
    };

    return (
        <UserContext.Provider value={{ user, profile, loading, isVerified, logout }}>
            {children}
        </UserContext.Provider>
    );
}

export function useUser() {
    return useContext(UserContext);
}
