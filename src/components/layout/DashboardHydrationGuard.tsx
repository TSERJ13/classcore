'use client';
import React, { useEffect, useState } from 'react';
import { useStudio } from '@/contexts/StudioContext';
import { Loader2 } from 'lucide-react';

export const DashboardHydrationGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { isLoaded, loadingStep, settings } = useStudio();
    const [showContent, setShowContent] = useState(false);
    const [progress, setProgress] = useState(0);

    useEffect(() => {
        if (isLoaded) {
            setProgress(100);
            const timer = setTimeout(() => setShowContent(true), 500);
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
                }, 10);
                return () => clearInterval(interval);
            }
        }
    }, [isLoaded, loadingStep, progress]);

    if (showContent) return <>{children}</>;

    return (
        <div className="fixed inset-0 z-[9999] bg-[#0f172a] flex flex-col items-center justify-center p-6">
            <div className="w-full max-w-sm flex flex-col items-center text-center">
                
                {/* 🖼️ STUDIO LOGO / IDENTITY */}
                <div className="mb-8">
                    {settings?.logoDataUrl ? (
                        <div className="w-20 h-20 rounded-2xl bg-white/5 border border-white/10 p-2 flex items-center justify-center overflow-hidden shadow-2xl">
                             <img src={settings.logoDataUrl} alt="Logo" className="w-full h-full object-contain" />
                        </div>
                    ) : (
                        <div className="w-20 h-20 rounded-2xl bg-gradient-to-tr from-indigo-600 to-indigo-400 flex items-center justify-center shadow-xl">
                            <span className="text-2xl font-black text-white">C</span>
                        </div>
                    )}
                </div>

                <div className="space-y-4 w-full">
                    <h2 className="text-xl font-bold text-white tracking-tight">
                        მონაცემების შემოწმება და ჩატვირთვა
                    </h2>
                    
                    {/* 📊 PROGRESS BAR (Classic Style) */}
                    <div className="relative w-full h-1.5 bg-white/5 rounded-full overflow-hidden border border-white/5">
                        <div 
                            className="absolute inset-y-0 left-0 bg-indigo-500 transition-all duration-300 ease-out shadow-[0_0_15px_rgba(99,102,241,0.5)]"
                            style={{ width: `${progress}%` }}
                        />
                    </div>

                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-zinc-500">
                            <Loader2 className="w-3 h-3 animate-spin" />
                            <span className="text-[10px] font-black uppercase tracking-widest leading-none">
                                {loadingStep || 'მიმდინარეობს...'}
                            </span>
                        </div>
                        <span className="text-[10px] font-black text-indigo-400 tabular-nums">
                            {progress}%
                        </span>
                    </div>
                </div>

                {/* Footer Branding */}
                <div className="mt-20 opacity-20 flex items-center gap-2">
                    <div className="h-px w-8 bg-white" />
                    <span className="text-[8px] font-black text-white uppercase tracking-[0.3em]">
                        ClassCore Studio Engine
                    </span>
                    <div className="h-px w-8 bg-white" />
                </div>
            </div>
        </div>
    );
};
