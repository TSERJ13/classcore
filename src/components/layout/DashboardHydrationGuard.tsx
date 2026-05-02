'use client';
import React, { useEffect, useState } from 'react';
import { useStudio } from '@/contexts/StudioContext';
import { ShieldCheck, Database, CloudSync, Sparkles } from 'lucide-react';

export const DashboardHydrationGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { isLoaded, loadingStep } = useStudio();
    const [showContent, setShowContent] = useState(false);
    const [progress, setProgress] = useState(0);

    useEffect(() => {
        if (isLoaded) {
            setProgress(100);
            const timer = setTimeout(() => setShowContent(true), 800);
            return () => clearTimeout(timer);
        } else {
            const stepMap: Record<string, number> = {
                'სერვერთან დაკავშირება...': 20,
                'მონაცემების სინქრონიზაცია...': 50,
                'ინტერფეისის მომზადება...': 85
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
        <div className="fixed inset-0 z-[9999] bg-[#0f172a] flex flex-col items-center justify-center p-6 overflow-hidden">
            {/* Background Effects */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-500/20 blur-[120px] rounded-full animate-pulse" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-fuchsia-500/20 blur-[120px] rounded-full animate-pulse" style={{ animationDelay: '1s' }} />
            </div>

            <div className="relative z-10 w-full max-w-md flex flex-col items-center transition-all duration-700 ease-out transform scale-100 opacity-100">
                {/* Logo / Icon Area */}
                <div className="relative mb-12">
                    <div className="w-24 h-24 rounded-3xl bg-gradient-to-tr from-indigo-600 to-fuchsia-600 p-[2px] animate-[spin_20s_linear_infinite]">
                        <div className="w-full h-full rounded-[22px] bg-[#0f172a] flex items-center justify-center animate-[spin_20s_linear_infinite_reverse]">
                            <Sparkles className="w-10 h-10 text-white animate-pulse" />
                        </div>
                    </div>
                    
                    {/* Orbiting Elements */}
                    <div className="absolute inset-0 -m-8 border border-white/5 rounded-full animate-[spin_10s_linear_infinite]" />
                    <div className="absolute inset-0 -m-12 border border-white/5 rounded-full animate-[spin_15s_linear_infinite_reverse]" />
                </div>

                {/* Progress Text */}
                <div className="text-center mb-8 space-y-2">
                    <h2 className="text-2xl font-black text-white tracking-tight flex items-center justify-center gap-2">
                        {isLoaded ? 'მზად არის!' : 'ClassCore სინქრონიზაცია'}
                        <div className="animate-pulse">
                            <CloudSync className="w-5 h-5 text-indigo-400" />
                        </div>
                    </h2>
                    <p className="text-zinc-400 text-sm font-medium h-5">
                        {loadingStep || 'ვიწყებთ ჩატვირთვას...'}
                    </p>
                </div>

                {/* Progress Bar Container */}
                <div className="w-full bg-white/5 rounded-2xl p-1 border border-white/10 backdrop-blur-xl mb-6">
                    <div className="relative h-3 w-full overflow-hidden rounded-xl bg-black/20">
                        <div 
                            className="absolute inset-y-0 left-0 bg-gradient-to-r from-indigo-500 via-purple-500 to-fuchsia-500 transition-all duration-500 ease-out"
                            style={{ width: `${progress}%` }}
                        >
                            <div className="absolute inset-0 bg-[linear-gradient(45deg,rgba(255,255,255,0.2)_25%,transparent_25%,transparent_50%,rgba(255,255,255,0.2)_50%,rgba(255,255,255,0.2)_75%,transparent_75%,transparent)] bg-[length:20px_20px] animate-[shimmer_1s_linear_infinite]" />
                        </div>
                    </div>
                </div>

                {/* Status Items */}
                <div className="grid grid-cols-2 gap-4 w-full">
                    <div className="flex items-center gap-3 bg-white/5 rounded-xl p-3 border border-white/5">
                        <ShieldCheck className={cn("w-4 h-4 transition-colors", progress > 40 ? "text-emerald-400" : "text-zinc-500")} />
                        <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">უსაფრთხოება</span>
                    </div>
                    <div className="flex items-center gap-3 bg-white/5 rounded-xl p-3 border border-white/5">
                        <Database className={cn("w-4 h-4 transition-colors", progress > 80 ? "text-indigo-400" : "text-zinc-500")} />
                        <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">მონაცემები</span>
                    </div>
                </div>
            </div>

            {/* Version / Branding */}
            <div className="absolute bottom-8 left-0 right-0 text-center">
                <p className="text-[10px] font-black text-zinc-600 uppercase tracking-[0.2em]">
                    Powered by CloudTruth Engine v4.0
                </p>
            </div>

            <style jsx global>{`
                @keyframes shimmer {
                    from { background-position: 0 0; }
                    to { background-position: 20px 0; }
                }
            `}</style>
        </div>
    );
};

function cn(...classes: any[]) {
    return classes.filter(Boolean).join(' ');
}
