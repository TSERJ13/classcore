'use client';

import { createContext, useContext, useState, ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ConfirmOptions {
    title?: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    danger?: boolean;
    isAlert?: boolean;
}

interface ConfirmContextType {
    confirm: (options: ConfirmOptions | string) => Promise<boolean>;
    alert: (options: ConfirmOptions | string) => Promise<void>;
}

const ConfirmContext = createContext<ConfirmContextType | undefined>(undefined);

import { useT } from '@/contexts/LanguageContext';

export function ConfirmProvider({ children }: { children: ReactNode }) {
    const { t } = useT();
    const [opts, setOpts] = useState<ConfirmOptions | null>(null);
    const [resolveFn, setResolveFn] = useState<(value: boolean) => void>();

    const confirm = (options: ConfirmOptions | string) => {
        return new Promise<boolean>((resolve) => {
            const defaultOptions = {
                title: t.attention || 'ყურადღება',
                confirmText: t.yes || 'დიახ',
                cancelText: t.cancel || 'გაუქმება',
                danger: true,
                isAlert: false
            };

            if (typeof options === 'string') {
                setOpts({ ...defaultOptions, message: options });
            } else {
                setOpts({ ...defaultOptions, ...options });
            }

            setResolveFn(() => resolve as (value: boolean) => void);
        });
    };

    const alert = (options: ConfirmOptions | string) => {
        return new Promise<void>((resolve) => {
            const defaultOptions = {
                title: t.attention || 'ყურადღება',
                confirmText: t.ok || 'OK',
                danger: false,
                isAlert: true
            };

            if (typeof options === 'string') {
                setOpts({ ...defaultOptions, message: options });
            } else {
                setOpts({ ...defaultOptions, ...options });
            }

            setResolveFn(() => resolve as unknown as (value: boolean) => void);
        });
    };

    const handleClose = (result: boolean) => {
        setOpts(null);
        if (resolveFn) resolveFn(result);
    };

    return (
        <ConfirmContext.Provider value={{ confirm, alert }}>
            {children}
            {opts && (
                <div className="fixed inset-0 flex items-center justify-center p-4" style={{ zIndex: 9999 }}>
                    <div className="absolute inset-0 bg-black/20 animate-in fade-in" onClick={() => handleClose(false)} />
                    <div className="relative w-full max-w-sm bg-card border border-border-subtle rounded-[2.5rem] shadow-2xl p-8 text-center animate-in zoom-in-95 duration-200">
                        <div className={cn("w-16 h-16 rounded-2xl mx-auto mb-6 flex items-center justify-center shadow-inner", opts.danger ? "bg-red-500/10 text-red-500" : "bg-indigo-500/10 text-indigo-500")}>
                            <AlertTriangle className="w-8 h-8" />
                        </div>
                        <h3 className="text-xl font-black text-primary mb-3">{opts.title}</h3>
                        <p className="text-sm font-medium text-muted mb-8 text-balance">{opts.message}</p>
                        <div className="flex flex-col sm:flex-row gap-3">
                            {!opts.isAlert && (
                                <button onClick={() => handleClose(false)} className="flex-1 py-3 px-2 rounded-2xl bg-surface hover:bg-surface/80 text-muted hover:text-primary font-black text-xs tracking-widest transition-all">
                                    {opts.cancelText}
                                </button>
                            )}
                            <button 
                                onClick={() => handleClose(true)} 
                                className={cn(
                                    "flex-1 py-3 px-2 rounded-2xl text-white font-black text-xs tracking-widest shadow-lg active:scale-95 transition-all",
                                    opts.danger ? "bg-red-500 hover:bg-red-600 shadow-red-500/20" : "bg-indigo-500 hover:bg-indigo-600 shadow-indigo-500/20"
                                )}
                            >
                                {opts.confirmText}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </ConfirmContext.Provider>
    );
}

export function useConfirm() {
    const context = useContext(ConfirmContext);
    if (!context) throw new Error('useConfirm must be used within ConfirmProvider');
    
    // Create a hybrid callable object so we don't break existing codebase
    const confirmFn = ((...args: Parameters<typeof context.confirm>) => context.confirm(...args)) as typeof context.confirm & { confirm: typeof context.confirm, alert: typeof context.alert };
    
    confirmFn.confirm = context.confirm;
    confirmFn.alert = context.alert;
    
    return confirmFn;
}
