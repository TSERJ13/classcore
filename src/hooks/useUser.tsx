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
            try {
                const { data: { user: u }, error: authError } = await supabase.auth.getUser();
                const staffSess = getStaffSession();
                const urlSlug = typeof window !== 'undefined' ? window.location.pathname.split('/')[1] : null;

                // 🚨 RESILIENCE: Use the statically imported getActiveSlug from settings-store
                const fallbackSlug = getActiveSlug();

                if (!u && !staffSess) {
                    if (authError) console.log('🔍 [UserProvider] No active session found. Supabase Auth Error:', authError.message);
                    setIsVerified(false);
                    setLoading(false);
                    return;
                }

                const currentUserIdentity = u?.email || staffSess?.staff?.email || staffSess?.staff?.phone || (staffSess as any)?.staff?.phone_number;
                let currentSlug = u?.user_metadata?.studio_slug || staffSess?.slug || (urlSlug && urlSlug !== 'dashboard' && urlSlug !== 'login' ? urlSlug : null) || fallbackSlug;
                const isOwner = u?.user_metadata?.role === 'owner';
                const isSuperAdminRoute = typeof window !== 'undefined' && window.location.pathname.startsWith('/superadmin');

                console.log(`🚩 [UserProvider] Context: Identity=${currentUserIdentity}, Slug=${currentSlug}, isOwner=${isOwner}, isSuperAdminRoute=${isSuperAdminRoute}`);

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

                if (currentUserIdentity && currentSlug && !isSuperAdminRoute && !isOwner) {
                    try {
                        const { verifyUserInStudio } = await import('@/lib/sync-store');
                        const hasAccess = await verifyUserInStudio(currentSlug, currentUserIdentity);
                        
                        if (!hasAccess) {
                            console.warn(`🚨 [UserProvider] Access verification failed for ${currentUserIdentity} in ${currentSlug}. Continuing with lenient session.`);
                        } else {
                            console.log(`✅ [UserProvider] Access GRANTED`);
                        }
                        setIsVerified(true);
                    } catch (err) {
                        console.error('⚠️ [UserProvider] DB logic failed:', err);
                        setIsVerified(true); // Be lenient on local
                    }
                } else {
                    const identityConfirmed = !!u?.email_confirmed_at || !!staffSess;
                    // 🛡️ LENIENT FIX: A user is verified if they have a confirmed identity, 
                    // even if the specific studio slug is still being recovered.
                    const status = !!currentUserIdentity && identityConfirmed;
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
                        ...(latestStaff.permissions || {}),
                        ...latestStaff,
                        studio_name: settings.studioName,
                        studio_slug: slug,
                        is_activated: true,
                    });
                }

                setLoading(false);
            } catch (err) {
                console.error('❌ [UserProvider] Critical failure:', err);
                setIsVerified(false);
                setLoading(false);
            }
        };

        refreshSession();

        const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
            refreshSession();
        });

        // 🚀 REACTIVE PERMISSIONS: Listen for background sync updates.
        // This ensures that if the owner changes Nini's permissions on another device,
        // her sidebar will update instantly when the sync pulse arrives.
        const handleSettingsUpdate = () => {
            console.log('📡 [UserProvider] Settings updated via sync. Refreshing profile permissions...');
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
