'use client';
import React, { useEffect, useState } from 'react';
import { useStudio } from '@/contexts/StudioContext';
import { AppLogo } from '@/components/ui/Logo';

export const DashboardHydrationGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { isLoaded, loadingStep, settings } = useStudio();
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
        <div className="fixed inset-0 bg-[#0a0a0c] z-[9999] flex flex-col items-center justify-center animate-in fade-in duration-700">
            {/* 💫 DEEP UNIVERSE BACKGROUND */}
            <div className="absolute inset-0 overflow-hidden">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-indigo-600/10 blur-[160px] rounded-full animate-pulse" />
                <div className="absolute top-1/4 left-1/4 w-[400px] h-[400px] bg-violet-600/5 blur-[120px] rounded-full animate-pulse [animation-delay:1s]" />
            </div>

            <div className="relative flex flex-col items-center gap-12 z-10">
                {/* ⚪ THE STUDIO LOGO / CORE */}
                <div className="relative group">
                    <div className="absolute -inset-8 bg-indigo-500/20 blur-3xl rounded-full scale-75 group-hover:scale-110 transition-transform duration-1000 animate-pulse" />
                    
                    <div className="relative w-32 h-32 md:w-40 md:h-40 rounded-[2.5rem] overflow-hidden bg-white/5 border border-white/10 shadow-2xl backdrop-blur-md flex items-center justify-center group-hover:border-indigo-500/50 transition-all duration-500">
                        {settings?.logoDataUrl ? (
                            <img 
                                src={settings.logoDataUrl} 
                                alt="" 
                                className="w-[85%] h-[85%] object-contain animate-in zoom-in-75 duration-1000" 
                            />
                        ) : (
                            <AppLogo size={80} loading className="opacity-80" />
                        )}
                    </div>

                    {/* ✨ ORBITAL RING */}
                    <div className="absolute -inset-4 border border-indigo-500/20 rounded-[3rem] animate-[spin_10s_linear_infinite] opacity-30" />
                    <div className="absolute -inset-2 border border-violet-500/10 rounded-[2.8rem] animate-[spin_15s_linear_infinite_reverse] opacity-20" />
                </div>

                <div className="flex flex-col items-center gap-8 w-64 md:w-72">
                    {/* 📊 PROGRESS ENGINE */}
                    <div className="w-full h-[3px] bg-white/5 rounded-full overflow-hidden">
                        <div 
                            className="h-full bg-gradient-to-r from-indigo-500 via-violet-500 to-indigo-500 bg-[length:200%_100%] animate-[shimmer_2s_infinite_linear] transition-all duration-300 ease-out shadow-[0_0_20px_rgba(99,102,241,0.5)]" 
                            style={{ width: `${progress}%` }}
                        />
                    </div>

                    <div className="flex flex-col items-center gap-2">
                        <div className="flex items-center gap-3">
                            <span className="text-[11px] font-black text-white tracking-[0.3em] uppercase opacity-90">
                                {loadingStep === 'სერვერთან დაკავშირება...' ? (
                                    <>
                                        <span className="animate-in fade-in slide-in-from-left-2">{lang === 'ka' ? 'ჩატვირთვა' : lang === 'ru' ? 'ЗАГРУЗКА' : 'LOADING'}</span>
                                        <span className="ml-1 inline-flex gap-0.5">
                                            <span className="animate-pulse">.</span>
                                            <span className="animate-pulse [animation-delay:0.2s]">.</span>
                                            <span className="animate-pulse [animation-delay:0.4s]">.</span>
                                        </span>
                                    </>
                                ) : (
                                    lang === 'ka' ? 'მონაცემები' : lang === 'ru' ? 'ДАННЫЕ' : 'DATA'
                                )}
                            </span>
                            <span className="h-px w-8 bg-white/20" />
                            <span className="text-[14px] font-black text-indigo-400 tabular-nums">
                                {progress}%
                            </span>
                        </div>
                        
                        <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest text-center max-w-[200px]">
                            {loadingStep || (lang === 'ka' ? 'სისტემის მომზადება...' : lang === 'ru' ? 'Подготовка системы...' : 'Preparing system...')}
                        </p>
                    </div>
                </div>
            </div>

            {/* Subtle Footer */}
            <div className="absolute bottom-12 flex flex-col items-center gap-3 opacity-20 hover:opacity-40 transition-opacity duration-500">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-px bg-white/30" />
                    <p className="text-[10px] font-black text-white tracking-[0.6em] uppercase">
                        ClassCore Studio OS
                    </p>
                    <div className="w-8 h-px bg-white/30" />
                </div>
                <p className="text-[8px] font-bold text-white/40 tracking-widest">VER 4.9 SCORCHED EARTH</p>
            </div>

            <style jsx global>{`
                @keyframes shimmer {
                    0% { background-position: 100% 0; }
                    100% { background-position: -100% 0; }
                }
                body { background: #0a0a0c !important; }
            `}</style>
        </div>
    );
};
