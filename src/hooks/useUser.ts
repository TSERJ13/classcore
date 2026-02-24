import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { User } from '@supabase/supabase-js';

export function useUser() {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [profile, setProfile] = useState<{ studio_name?: string; first_name?: string; last_name?: string; role?: string } | null>(null);

    useEffect(() => {
        const supabase = createClient();

        // Get initial session
        supabase.auth.getSession().then(({ data: { session } }) => {
            setUser(session?.user ?? null);
            if (session?.user) {
                setProfile({
                    studio_name: session.user.user_metadata.studio_name,
                    first_name: session.user.user_metadata.first_name,
                    last_name: session.user.user_metadata.last_name,
                    role: session.user.user_metadata.role || 'admin', // Defaulting to admin for now as requested
                });
            }
            setLoading(false);
        });

        // Listen for changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setUser(session?.user ?? null);
            if (session?.user) {
                setProfile({
                    studio_name: session.user.user_metadata.studio_name,
                    first_name: session.user.user_metadata.first_name,
                    last_name: session.user.user_metadata.last_name,
                    role: session.user.user_metadata.role || 'admin',
                });
            } else {
                setProfile(null);
            }
            setLoading(false);
        });

        return () => subscription.unsubscribe();
    }, []);

    const logout = async () => {
        const supabase = createClient();
        await supabase.auth.signOut();
        window.location.href = '/login';
    };

    return { user, profile, loading, logout };
}
