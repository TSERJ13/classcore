'use client';
import React, { useEffect, useState, useRef } from 'react';
import { useStudio } from '@/contexts/StudioContext';
import { AppLogo } from '@/components/ui/Logo';
import { useT } from '@/contexts/LanguageContext';

const SESSION_FLAG = 'cc_splash_shown';

let _moduleFlag = false;

function markSplashShown() {
    _moduleFlag = true;
    if (typeof window !== 'undefined') {
        try { sessionStorage.setItem(SESSION_FLAG, 'true'); } catch {}
    }
}

export const DashboardHydrationGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { isLoaded, loadingStep, settings } = useStudio();
    const { lang } = useT();
    
    const [showContent, setShowContent] = useState(false);
    const [progress, setProgress] = useState(0);
    const [studioLogo, setStudioLogo] = useState<string | null>(null);
    const progressRef = useRef(0);
    const intervalRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        if (isLoaded && !showContent) {
            setShowContent(true);
        }
    }, [isLoaded, showContent]);

    useEffect(() => {
        if (typeof window !== 'undefined') {
            const slug = localStorage.getItem('cc_active_studio_slug');
            if (slug) {
                const s = localStorage.getItem(`cc_studio_settings_${slug}`);
                if (s) {
                    try {
                        const parsed = JSON.parse(s);
                        if (parsed.logoDataUrl) setStudioLogo(parsed.logoDataUrl);
                    } catch (e) {}
                }
            }
        }
    }, []);

    useEffect(() => {
        if (showContent) return;
        
        if (isLoaded) {
            if (intervalRef.current) clearInterval(intervalRef.current);
            intervalRef.current = setInterval(() => {
                progressRef.current = Math.min(100, progressRef.current + 10);
                setProgress(progressRef.current);
                if (progressRef.current >= 100) {
                    if (intervalRef.current) clearInterval(intervalRef.current);
                    setTimeout(() => {
                        markSplashShown();
                        setShowContent(true);
                    }, 100);
                }
            }, 8);
            return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
        }

        const stepTargets: Record<string, number> = {
            'სერვერთან დაკავშირება...': 35,
            'მონაცემების სინქრონიზაცია...': 70,
            'ინტერფეისის მომზადება...': 92
        };
        const target = stepTargets[loadingStep] || 20;

        if (intervalRef.current) clearInterval(intervalRef.current);
        intervalRef.current = setInterval(() => {
            if (progressRef.current < target) {
                progressRef.current = Math.min(target, progressRef.current + 2);
                setProgress(progressRef.current);
            }
        }, 20);
        return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
    }, [isLoaded, loadingStep, showContent]);

    if (showContent) return <>{children}</>;

    const logoSrc = settings?.logoDataUrl || studioLogo;

    return (
        <div className="fixed inset-0 bg-white dark:bg-zinc-950 z-[9999] flex items-center justify-center">
            <div className="relative flex flex-col items-center gap-10">
                <AppLogo 
                    size={120} 
                    radar 
                    loading 
                    src={logoSrc}
                    className="relative z-10 drop-shadow-2xl" 
                />
                
                <div className="flex flex-col items-center gap-6 w-64">
                    <div className="w-full h-[6px] bg-slate-100 dark:bg-white/5 rounded-full overflow-hidden p-[1px] shadow-[inset_0_1px_2px_rgba(0,0,0,0.05)]">
                        <div 
                            className="h-full bg-gradient-to-r from-indigo-600 via-violet-600 to-indigo-600 bg-[length:200%_100%] animate-shimmer rounded-full transition-all duration-200 ease-linear" 
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                    
                    <div className="flex flex-col items-center gap-3">
                        <div className="flex items-baseline gap-2">
                            <span className="text-[11px] font-black text-slate-400 dark:text-zinc-500 tracking-[0.3em] uppercase">
                                {lang === 'ka' ? 'ჩატვირთვა' : lang === 'ru' ? 'ЗАГРУЗКА' : 'LOADING'}
                            </span>
                            <span className="text-sm font-black text-indigo-600 dark:text-indigo-400 tabular-nums">
                                {progress}%
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            <style dangerouslySetInnerHTML={{ __html: `
                @keyframes shimmer {
                    0% { background-position: 100% 0; }
                    100% { background-position: -100% 0; }
                }
                .animate-shimmer {
                    animation: shimmer 3s linear infinite;
                }
            `}} />
        </div>
    );
};
