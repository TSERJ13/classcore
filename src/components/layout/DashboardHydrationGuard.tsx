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
        <div className="fixed inset-0 bg-white dark:bg-zinc-950 z-[9999] flex flex-col items-center justify-center animate-in fade-in duration-700">
            <div className="relative flex flex-col items-center gap-12 -mt-32">
                {/* 💫 RICH AMBIENT GLOW */}
                <div className="absolute inset-0 bg-indigo-500/10 blur-[140px] rounded-full scale-[2.5] animate-pulse" />
                <div className="absolute inset-0 bg-violet-500/5 blur-[100px] rounded-full scale-[2] animate-pulse delay-700" />
                
                {/* ⚪ THE PREMIUM LOGO */}
                <div className="relative group">
                    <div className="absolute inset-0 bg-indigo-500/20 blur-2xl rounded-full scale-110 group-hover:scale-125 transition-transform duration-1000" />
                    <AppLogo 
                        size={120} 
                        radar 
                        loading 
                        src={settings?.logoDataUrl}
                        className="relative z-10 drop-shadow-[0_20px_50px_rgba(79,70,229,0.3)] transition-transform duration-700 hover:scale-105" 
                    />
                </div>
                
                <div className="flex flex-col items-center gap-8 animate-in fade-in slide-in-from-bottom-8 duration-1000 w-64">
                    {/* Modern Progress Track */}
                    <div className="w-full h-[6px] bg-slate-100 dark:bg-white/5 rounded-full overflow-hidden p-[1px] shadow-[inset_0_1px_2px_rgba(0,0,0,0.05)]">
                        <div 
                            className="h-full bg-gradient-to-r from-indigo-600 via-violet-600 to-indigo-600 bg-[length:200%_100%] animate-shimmer rounded-full transition-all duration-500 ease-out shadow-[0_0_20px_rgba(79,70,229,0.5)]" 
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
                        
                        <div className="h-4 flex items-center justify-center">
                            <p className="text-[10px] font-bold text-slate-400/60 dark:text-zinc-500/50 uppercase tracking-[0.2em] text-center animate-pulse">
                                {(() => {
                                    if (!loadingStep) return lang === 'ka' ? 'სისტემის მომზადება...' : lang === 'ru' ? 'Подготовка...' : 'Preparing...';
                                    
                                    const translations: Record<string, Record<string, string>> = {
                                        'სერვერთან დაკავშირება...': { ka: 'სერვერთან დაკავშირება...', ru: 'Подключение к серверу...', en: 'Connecting to server...' },
                                        'მონაცემების სინქრონიზაცია...': { ka: 'მონაცემების სინქრონიზაცია...', ru: 'Сინхронизация данных...', en: 'Synchronizing data...' },
                                        'ინტერფეისის მომზადება...': { ka: 'ინტერფეისის მომზადება...', ru: 'Подготовка интерфейса...', en: 'Preparing interface...' }
                                    };

                                    return translations[loadingStep]?.[lang || 'ka'] || loadingStep;
                                })()}
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Premium Branding Footer */}
            <div className="absolute bottom-16 opacity-40 flex flex-col items-center gap-2">
                <div className="h-[1px] w-8 bg-gradient-to-r from-transparent via-slate-300 to-transparent" />
                <p className="text-[10px] font-black text-slate-400 dark:text-zinc-600 tracking-[0.8em] uppercase ml-[0.8em]">
                    ClassCore Studio OS
                </p>
            </div>

            <style jsx global>{`
                @keyframes shimmer {
                    0% { background-position: 100% 0; }
                    100% { background-position: -100% 0; }
                }
                .animate-shimmer {
                    animation: shimmer 3s linear infinite;
                }
            `}</style>
        </div>
    );
};
