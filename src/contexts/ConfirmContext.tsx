'use client';

import { createContext, useContext, useState, ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';

interface ConfirmOptions {
    title?: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    danger?: boolean;
}

interface ConfirmContextType {
    confirm: (options: ConfirmOptions | string) => Promise<boolean>;
}

const ConfirmContext = createContext<ConfirmContextType | undefined>(undefined);

export function ConfirmProvider({ children }: { children: ReactNode }) {
    const [opts, setOpts] = useState<ConfirmOptions | null>(null);
    const [resolveFn, setResolveFn] = useState<(value: boolean) => void>();

    const confirm = (options: ConfirmOptions | string) => {
        return new Promise<boolean>((resolve) => {
            const defaultOptions = {
                title: 'ყურადღება',
                confirmText: 'დიახ',
                cancelText: 'გაუქმება',
                danger: true
            };

            if (typeof options === 'string') {
                setOpts({ ...defaultOptions, message: options });
            } else {
                setOpts({ ...defaultOptions, ...options });
            }

            setResolveFn(() => resolve);
        });
    };

    const handleClose = (result: boolean) => {
        setOpts(null);
        if (resolveFn) resolveFn(result);
    };

    return (
        <ConfirmContext.Provider value={{ confirm }}>
            {children}
            {opts && (
                <div className="fixed inset-0 flex items-center justify-center p-4" style={{ zIndex: 9999 }}>
                    <div className="absolute inset-0 bg-transparent animate-in fade-in" onClick={() => handleClose(false)} />
                    <div className="relative w-full max-w-sm bg-card border border-border-subtle rounded-[2.5rem] shadow-2xl p-8 text-center animate-in zoom-in-95 duration-200">
                        <div className="w-16 h-16 rounded-2xl mx-auto mb-6 flex items-center justify-center bg-red-500/10 text-red-500 shadow-inner">
                            <AlertTriangle className="w-8 h-8" />
                        </div>
                        <h3 className="text-xl font-black text-primary mb-3">{opts.title}</h3>
                        <p className="text-sm font-medium text-muted mb-8 text-balance">{opts.message}</p>
                        <div className="flex flex-col sm:flex-row gap-3">
                            <button onClick={() => handleClose(false)} className="flex-1 py-3 px-2 rounded-2xl bg-surface hover:bg-surface/80 text-muted hover:text-primary font-black text-xs uppercase tracking-widest transition-all">
                                {opts.cancelText}
                            </button>
                            <button onClick={() => handleClose(true)} className="flex-1 py-3 px-2 rounded-2xl bg-red-500 hover:bg-red-600 text-white font-black text-xs uppercase tracking-widest shadow-lg shadow-red-500/20 active:scale-95 transition-all">
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
    return context.confirm;
}
