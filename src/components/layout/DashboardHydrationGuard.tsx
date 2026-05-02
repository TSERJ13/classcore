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
        <div className="fixed inset-0 bg-white z-[9999] flex flex-col items-center justify-center animate-in fade-in duration-500">
            <div className="relative flex flex-col items-center gap-12 -mt-20">
                <div className="absolute inset-0 bg-indigo-500/5 blur-[100px] rounded-full scale-150 animate-pulse" />
                
                <div className="relative">
                    <AppLogo 
                        size={120} 
                        radar 
                        loading 
                        src={settings?.logoDataUrl}
                        className="relative z-10" 
                    />
                </div>

                <div className="flex flex-col items-center gap-6 animate-in fade-in slide-in-from-bottom-4 duration-1000 w-64">
                    <div className="flex flex-col items-center gap-2">
                        <p className="text-[11px] font-black text-indigo-600 uppercase tracking-[0.4em] animate-pulse whitespace-nowrap">
                            {loadingStep || 'მიმდინარეობს ჩატვირთვა...'}
                        </p>
                        <span className="text-[10px] font-black text-indigo-400 tabular-nums bg-indigo-50 px-2 py-0.5 rounded-full">
                            {progress}%
                        </span>
                    </div>

                    <div className="w-full h-1 bg-slate-100 rounded-full overflow-hidden">
                        <div 
                            className="h-full bg-indigo-600 transition-all duration-300 ease-out shadow-[0_0_15px_rgba(79,70,229,0.3)]" 
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                </div>
            </div>

            {/* Subtle Footer */}
            <div className="absolute bottom-12 opacity-40">
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
