'use client';
import { useEffect, useState, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { User } from '@supabase/supabase-js';
import { getStaffSession, setStaffSession, loadSettings, getActiveSlug } from '@/lib/settings-store';
import { isSuperAdminEmail } from '@/lib/superadmin-emails';

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

    const initialized = useRef(false);
    useEffect(() => {
        const supabase = createClient();

        const refreshSession = async () => {
            if (initialized.current) return;
            initialized.current = true;
            try {
                // 🛡️ FAIL-SAFE: If auth takes too long (common in Incognito), force resolve
                const failSafe = setTimeout(() => {
                    if (loading) {
                        console.warn('⚠️ [UserProvider] Auth check timed out. Forcing resolve.');
                        setIsVerified(false);
                        setLoading(false);
                    }
                }, 5000);

                const { data: { user: u }, error: authError } = await supabase.auth.getUser();
                clearTimeout(failSafe);
                
                const staffSess = getStaffSession();
                const urlSlug = typeof window !== 'undefined' ? window.location.pathname.split('/')[1] : null;
                const excluded = ['api', 'dashboard', 'auth', 'admin', 'login', 'superadmin', 'settings', 'billing', 'analytics', 'history', 'attendance', 'students', 'teachers', 'halls', 'groups', 'calendar', 'shop', 'sms-manager', 'subscriptions', 'trash', 'sa-login', 'sa-admin', 'registration', 'forgot-password', 'reset-password', 'checkin', 'nfc-checkin', 'privacy', 'terms', 'terms-and-conditions', '_next', 'favicon.ico', 'manifest.webmanifest'];
                
                // 🚨 RESILIENCE: Use the statically imported getActiveSlug from settings-store
                const fallbackSlug = getActiveSlug();

                if (!u && !staffSess) {
                    if (authError) console.log('🔍 [UserProvider] No active session found. Supabase Auth Error:', authError.message);
                    setIsVerified(false);
                    setLoading(false);
                    return;
                }

                const currentUserEmail = u?.email;
                const isSuperAdmin = isSuperAdminEmail(currentUserEmail);
                
                const currentUserIdentity = u?.email || staffSess?.staff?.email || staffSess?.staff?.phone || (staffSess as any)?.staff?.phone_number;
                let currentSlug = u?.user_metadata?.studio_slug || staffSess?.slug || (urlSlug && !excluded.includes(urlSlug) ? urlSlug : null) || fallbackSlug;
                const isOwner = u?.user_metadata?.role === 'owner' || isSuperAdmin;
                const isSuperAdminRoute = typeof window !== 'undefined' && window.location.pathname.startsWith('/superadmin');

                console.log(`🚩 [UserProvider] Context: Identity=${currentUserIdentity}, Slug=${currentSlug}, isOwner=${isOwner}, isSuperAdmin=${isSuperAdmin}, isSuperAdminRoute=${isSuperAdminRoute}`);

                if (currentUserIdentity && !currentSlug && !isSuperAdminRoute) {
                    try {
                        const { findAllStudiosByStaffEmail } = await import('@/lib/sync-store');
                        const matches = await findAllStudiosByStaffEmail(currentUserIdentity);
                        if (matches && matches.length > 0) {
                            currentSlug = matches[0].slug;
                            console.log(`📡 [UserProvider] Recovered studio slug: ${currentSlug}`);
                        }
                    } catch (err) {
                        console.error('⚠️ [UserProvider] Slug recovery failed:', err);
                    }
                }

                // Redirection removed to prevent shadowing by [studio]/[studentId] routes


                // SCOPED RESOLUTION: Basic path-based verification is enough for UI routing
                const identityConfirmed = !!u?.email_confirmed_at || !!staffSess;
                setIsVerified(!!currentUserIdentity && identityConfirmed);

                if (u) {

                    setUser(u);
                    const meta = u.user_metadata || {};
                    setProfile({
                        ...meta,
                        studio_name: meta.studio_name,
                        studio_slug: currentSlug,
                        role: isSuperAdmin ? 'owner' : (meta.role || 'admin'),
                        photo_url: meta.photo_url || meta.avatar_url,
                        is_activated: meta.is_activated !== false,
                        ...(isSuperAdmin ? {
                            canViewAttendance: true, canViewSubscriptions: true, canViewStudents: true,
                            canViewCalendar: true, canEditCalendar: true, canViewGroups: true,
                            canViewTeachers: true, canViewHalls: true, canViewShop: true,
                            canViewAnalytics: true, canViewSMS: true
                        } : {})
                    });
                } else if (staffSess) {
                    const { staff, slug, studioName } = staffSess as any;
                    const settings = loadSettings(slug);
                    const latestStaff = settings.staff?.find((s: any) => s.id === staff.id) || staff;
                    setUser({ id: latestStaff.id, email: latestStaff.email } as any);
                    const resolvedStudioName = (settings.studioName && !/^[0-9a-f-]{20,}$/i.test(settings.studioName)) 
                        ? settings.studioName 
                        : (studioName || (latestStaff as any).studioName || (latestStaff as any).studio_name || (staff as any).studioName || 'ST Dance Studio');

                    setProfile({
                        ...(latestStaff.permissions || {}),
                        ...latestStaff,
                        canViewAttendance: latestStaff.canViewAttendance ?? latestStaff.permissions?.canViewAttendance ?? true,
                        studio_name: resolvedStudioName,
                        studio_slug: slug,
                        is_activated: true,
                    });

                    const resolvedLang = latestStaff.preferred_language || (latestStaff as any).data?.preferred_language;
                    if (resolvedLang && ['ka', 'en', 'ru'].includes(resolvedLang)) {
                        if (typeof window !== 'undefined' && localStorage.getItem('cc_lang') !== resolvedLang) {
                            localStorage.setItem('cc_lang', resolvedLang);
                            document.cookie = `cc_lang=${resolvedLang}; path=/; max-age=31536000; SameSite=Lax`;
                            window.dispatchEvent(new Event('cc_lang_change'));
                        }
                    }
                }

                setLoading(false);
            } catch (err) {
                console.error('❌ [UserProvider] Critical failure:', err);
                setIsVerified(false);
                setLoading(false);
                initialized.current = false; // Allow retry on failure
            }
        };

        // Don't call refreshSession() manually here. 
        // supabase.auth.onAuthStateChange with internal getUser call will handle the initial state.
        const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
            refreshSession();
        });

        const handleSettingsUpdate = () => {
            console.log('📡 [UserProvider] Settings updated via sync. Refreshing profile permissions...');
            initialized.current = false; // Allow refresh
            refreshSession();
        };
        window.addEventListener('cc_settings_update', handleSettingsUpdate);

        return () => {
            subscription.unsubscribe();
            window.removeEventListener('cc_settings_update', handleSettingsUpdate);
        };
    }, []);

    useEffect(() => {
        if (profile) {
            if (profile.role) {
                document.cookie = `cc_user_role=${profile.role}; path=/; max-age=31536000; SameSite=Lax`;
            }
            if (profile.studio_name) {
                document.cookie = `cc_studio_name=${encodeURIComponent(profile.studio_name)}; path=/; max-age=31536000; SameSite=Lax`;
            }
            if (profile.studio_slug) {
                document.cookie = `cc_active_slug=${profile.studio_slug}; path=/; max-age=31536000; SameSite=Lax`;
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
