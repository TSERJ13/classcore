'use client';
import React, { useEffect, useState } from 'react';
import { useStudio } from '@/contexts/StudioContext';
import { AppLogo } from '@/components/ui/Logo';
import { useT } from '@/contexts/LanguageContext';

export const DashboardHydrationGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { isLoaded, loadingStep, settings } = useStudio();
    const { lang } = useT();
    const [showContent, setShowContent] = useState(false);
    const [progress, setProgress] = useState(0);

    useEffect(() => {
        if (isLoaded) {
            setProgress(100);
            const timer = setTimeout(() => setShowContent(true), 1500);
            return () => clearTimeout(timer);
        } else {
            const stepMap: Record<string, number> = {
                'სერვერთან დაკავშირება...': 15,
                'მონაცემების სინქრონიზაცია...': 45,
                'ინტერფეისის მომზადება...': 80
            };
            
            const target = stepMap[loadingStep] || progress;
            if (target > progress) {
                const interval = setInterval(() => {
                    setProgress(prev => {
                        if (prev < target) return prev + 1;
                        clearInterval(interval);
                        return prev;
                    });
                }, 15);
                return () => clearInterval(interval);
            }
        }
    }, [isLoaded, loadingStep, progress]);

    if (showContent) return <>{children}</>;

    return (
        <div className="fixed inset-0 bg-white z-[9999] flex flex-col items-center justify-center animate-in fade-in duration-500">
            <div className="relative flex flex-col items-center gap-10 -mt-24">
                {/* 💫 SOFT BACKGROUND GLOW */}
                <div className="absolute inset-0 bg-indigo-500/5 blur-[120px] rounded-full scale-[2] animate-pulse" />
                
                {/* ⚪ THE LOGO / SPINNER */}
                <div className="relative">
                    <AppLogo 
                        size={110} 
                        radar 
                        loading 
                        src={settings?.logoDataUrl}
                        className="relative z-10 drop-shadow-2xl" 
                    />
                </div>

                <div className="flex flex-col items-center gap-6 animate-in fade-in slide-in-from-bottom-4 duration-1000 w-56">
                    <div className="w-full h-1 bg-slate-100 rounded-full overflow-hidden shadow-inner">
                        <div 
                            className="h-full bg-indigo-600 transition-all duration-300 ease-out shadow-[0_0_15px_rgba(79,70,229,0.4)]" 
                            style={{ width: `${progress}%` }}
                        />
                    </div>

                    <div className="flex flex-col items-center gap-1">
                        <span className="text-[10px] font-black text-slate-400 tracking-[0.2em] uppercase">
                            {lang === 'ka' ? 'ჩატვირთვა' : lang === 'ru' ? 'ЗАГРУЗКА' : 'LOADING'} {progress}%
                        </span>
                        <p className="text-[9px] font-bold text-slate-300 uppercase tracking-widest text-center">
                            {loadingStep || (lang === 'ka' ? 'სისტემის მომზადება...' : lang === 'ru' ? 'Подготовка...' : 'Preparing...')}
                        </p>
                    </div>
                </div>
            </div>

            {/* Subtle Footer */}
            <div className="absolute bottom-12 opacity-30">
                <p className="text-[9px] font-black text-slate-400 tracking-[0.6em] uppercase">
                    ClassCore Studio OS
                </p>
            </div>

            <style jsx global>{`
                @keyframes loading-bar {
                    0% { width: 0%; }
                    50% { width: 70%; }
                    100% { width: 100%; }
                }
            `}</style>
        </div>
    );
};
