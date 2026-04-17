'use client';

import React from 'react';
import { Play } from 'lucide-react';
import { type Lang, type Translations } from '@/lib/i18n';

interface SystemVideoOverviewProps {
    t: Translations;
    lang: Lang;
}

export function SystemVideoOverview({ t, lang }: SystemVideoOverviewProps) {
    return (
        <div className="w-full h-full flex flex-col items-center justify-center bg-slate-900 relative group cursor-pointer overflow-hidden">
            {/* Background Graphic */}
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/20 to-purple-500/20 mix-blend-overlay" />
            
            {/* Visual Aura */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-indigo-500/30 blur-[100px] rounded-full group-hover:scale-150 transition-transform duration-1000" />

            {/* Play Button */}
            <div className="relative z-10 w-20 h-20 bg-white/10 backdrop-blur-xl border border-white/20 rounded-full flex items-center justify-center shadow-2xl group-hover:scale-110 transition-all duration-500 ring-4 ring-white/5">
                <Play className="w-8 h-8 text-white fill-white ml-1" />
            </div>

            {/* Hint Text */}
            <div className="mt-8 relative z-10 text-center px-6">
                <p className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em] mb-2">{t.heroNewEra}</p>
                <h3 className="text-xl font-black text-white uppercase tracking-tight leading-none">{t.allYourStudioNeeds}</h3>
            </div>

            {/* Bottom Info Bar */}
            <div className="absolute bottom-0 inset-x-0 bg-white/5 backdrop-blur-md border-t border-white/10 px-8 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-[9px] font-black text-white/50 uppercase tracking-widest leading-none">System Operational</span>
                </div>
                <span className="text-[9px] font-black text-white/30 uppercase tracking-widest leading-none">ClassCore Overview</span>
            </div>
        </div>
    );
}
