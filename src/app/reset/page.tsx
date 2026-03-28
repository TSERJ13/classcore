'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function ResetPage() {
    const [status, setStatus] = useState('Initializing reset...');

    useEffect(() => {
        const performReset = async () => {
            try {
                setStatus('Clearing LocalStorage...');
                // 1. Clear all CC related localStorage
                Object.keys(localStorage).forEach(key => {
                    if (key.startsWith('cc_') || key === 'sb-') {
                        localStorage.removeItem(key);
                    }
                });

                setStatus('Clearing Cookies...');
                // 2. Clear all CC related cookies
                document.cookie.split(";").forEach((c) => {
                    const name = c.split("=")[0].trim();
                    if (name.startsWith('cc_')) {
                        document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
                    }
                });

                setStatus('Signing out from Supabase...');
                // 3. Supabase Sign Out
                const supabase = createClient();
                await supabase.auth.signOut();

                setStatus('Reset Complete! Redirecting...');
                setTimeout(() => {
                    window.location.href = '/registration';
                }, 2000);

            } catch (err) {
                console.error('Reset failed:', err);
                setStatus('Reset failed. Please clear your browser cache manually.');
            }
        };

        performReset();
    }, []);

    return (
        <div style={{ 
            height: '100vh', 
            display: 'flex', 
            flexDirection: 'column',
            alignItems: 'center', 
            justifyContent: 'center', 
            fontFamily: 'sans-serif',
            background: '#0f172a',
            color: 'white'
        }}>
            <div style={{ 
                padding: '2rem', 
                background: '#1e293b', 
                borderRadius: '1rem', 
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
                textAlign: 'center'
            }}>
                <h1 style={{ marginBottom: '1rem' }}>🧹 System Reset</h1>
                <p style={{ opacity: 0.8 }}>{status}</p>
                <div style={{ 
                    marginTop: '2rem', 
                    height: '4px', 
                    width: '200px', 
                    background: '#334155', 
                    borderRadius: '2px',
                    overflow: 'hidden'
                }}>
                    <div style={{ 
                        height: '100%', 
                        width: '50%', 
                        background: '#6366f1', 
                        animation: 'loading 2s infinite ease-in-out' 
                    }} />
                </div>
            </div>
            <style dangerouslySetInnerHTML={{ __html: `
                @keyframes loading {
                    0% { transform: translateX(-100%); }
                    100% { transform: translateX(200%); }
                }
            `}} />
        </div>
    );
}
