'use client';

import { useEffect, useState } from 'react';
import { Briefcase, X } from 'lucide-react';
import { useStudio } from '@/contexts/StudioContext';
import { useUser } from '@/hooks/useUser';
import { useT } from '@/contexts/LanguageContext';
import { saveSettings } from '@/lib/settings-store';
import { cn } from '@/lib/utils';

/**
 * Registration Flow PRD (v1.1) §9 — "Complete your profile" pop-up.
 * Shown 2-3 hours after the owner's first successful login (not
 * immediately, so they can try the product without extra asks first).
 * PRD §10 explicitly defers the exact fields to a later spec — this only
 * builds the timing/existence mechanism with a placeholder field set.
 */
const DELAY_MS = 2.5 * 60 * 60 * 1000;

export function ProfileCompletionPopup() {
    const { settings, isLoaded } = useStudio();
    const { profile } = useUser();
    const { lang } = useT();
    const l = (ka: string, ru: string, en: string) => lang === 'ka' ? ka : lang === 'ru' ? ru : en;

    const [visible, setVisible] = useState(false);
    const [snoozed, setSnoozed] = useState(false);
    const [isIe, setIsIe] = useState(false);
    const [taxId, setTaxId] = useState('');
    const [legalAddress, setLegalAddress] = useState('');

    useEffect(() => {
        if (!isLoaded || snoozed) return;
        if (profile?.role !== 'owner') return;
        if (!settings.firstLoginAt || settings.profileCompletedAt) return;

        const check = () => {
            const elapsed = Date.now() - new Date(settings.firstLoginAt!).getTime();
            setVisible(elapsed >= DELAY_MS);
        };
        check();
        const interval = setInterval(check, 5 * 60 * 1000);
        return () => clearInterval(interval);
    }, [isLoaded, snoozed, profile?.role, settings.firstLoginAt, settings.profileCompletedAt]);

    if (!visible) return null;

    const handleSave = () => {
        saveSettings({
            businessProfile: { isIndividualEntrepreneur: isIe, taxId: taxId.trim(), legalAddress: legalAddress.trim() },
            profileCompletedAt: new Date().toISOString(),
        });
        setVisible(false);
    };

    return (
        <div className="fixed inset-0 z-[9998] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-300">
            <div className="w-full max-w-md bg-card border border-border-subtle rounded-[2rem] p-7 shadow-2xl relative">
                <button onClick={() => setSnoozed(true)} className="absolute top-5 right-5 w-8 h-8 rounded-full hover:bg-surface flex items-center justify-center text-muted transition-colors">
                    <X className="w-4 h-4" />
                </button>
                <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-500 mb-5">
                    <Briefcase className="w-7 h-7" />
                </div>
                <h2 className="text-lg font-black text-primary tracking-tight mb-1.5">
                    {l('დაასრულეთ პროფილი', 'Завершите профиль', 'Complete your profile')}
                </h2>
                <p className="text-xs text-muted font-medium mb-6 leading-relaxed">
                    {l('რამდენიმე დამატებითი დეტალი გვჭირდება გადახდებთან და ბიზნესის სტატუსთან დაკავშირებით — ეს დაგვეხმარება მოგვიანებით მოგემსახუროთ.', 'Нам нужно несколько деталей о платежах и статусе бизнеса — это поможет нам обслужить вас в дальнейшем.', 'We need a few more details about payments and your business status — this helps us serve you going forward.')}
                </p>

                <div className="space-y-4">
                    <label className="flex items-center justify-between p-3 bg-surface border border-border-subtle rounded-xl cursor-pointer">
                        <span className="text-xs font-bold text-primary">{l('ინდივიდუალური მეწარმე ბრძანდებით?', 'Вы индивидуальный предприниматель?', 'Are you a sole proprietor / IE?')}</span>
                        <div className="relative">
                            <input type="checkbox" checked={isIe} onChange={e => setIsIe(e.target.checked)} className="sr-only" />
                            <div onClick={() => setIsIe(v => !v)} className={cn("w-10 h-6 rounded-full transition-colors relative", isIe ? "bg-indigo-500" : "bg-slate-200 dark:bg-slate-700")}>
                                <div className={cn("absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all", isIe ? "left-[18px]" : "left-0.5")} />
                            </div>
                        </div>
                    </label>

                    <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-muted uppercase tracking-widest ml-1">{l('საიდენტიფიკაციო/საგადასახადო კოდი (არასავალდებულო)', 'ИНН (необязательно)', 'Tax ID (optional)')}</label>
                        <input value={taxId} onChange={e => setTaxId(e.target.value)} className="w-full h-11 bg-surface border border-border-subtle rounded-xl px-4 text-sm font-bold text-primary outline-none focus:border-indigo-500/30" />
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-muted uppercase tracking-widest ml-1">{l('ბიზნესის მისამართი (არასავალდებულო)', 'Юридический адрес (необязательно)', 'Business address (optional)')}</label>
                        <input value={legalAddress} onChange={e => setLegalAddress(e.target.value)} className="w-full h-11 bg-surface border border-border-subtle rounded-xl px-4 text-sm font-bold text-primary outline-none focus:border-indigo-500/30" />
                    </div>
                </div>

                <div className="flex gap-3 mt-7">
                    <button onClick={() => setSnoozed(true)} className="flex-1 h-11 rounded-xl bg-surface text-muted font-black text-[11px] uppercase tracking-widest hover:bg-surface-hover transition-colors">
                        {l('მოგვიანებით', 'Позже', 'Later')}
                    </button>
                    <button onClick={handleSave} className="flex-1 h-11 rounded-xl bg-indigo-600 text-white font-black text-[11px] uppercase tracking-widest hover:bg-indigo-700 transition-colors">
                        {l('შენახვა', 'Сохранить', 'Save')}
                    </button>
                </div>
            </div>
        </div>
    );
}
