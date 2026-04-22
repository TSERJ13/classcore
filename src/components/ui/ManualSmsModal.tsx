'use client';

import { useState } from 'react';
import { X, Send, MessageSquare, AlertCircle } from 'lucide-react';
import { useT } from '@/contexts/LanguageContext';

import { cn } from '@/lib/utils';

interface ManualSmsModalProps {
    open: boolean;
    onClose: () => void;
    studentName: string;
    studentPhone: string;
}

export function ManualSmsModal({ open, onClose, studentName, studentPhone }: ManualSmsModalProps) {
    const { t, lang } = useT();
    const [message, setMessage] = useState('');
    const [isSending, setIsSending] = useState(false);
    const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');

    if (!open) return null;

    const handleSend = async () => {
        if (!message.trim()) return;
        setIsSending(true);
        setStatus('idle');

        try {
            // Clean phone format
            let phone = studentPhone.replace(/[^0-9]/g, '');
            if (phone.length === 9) phone = '995' + phone;

            const res = await fetch('/api/sms/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    to: phone,
                    text: message.trim(),
                    studentName: studentName
                })
            });

            const data = await res.json();
            if (data.success || (Array.isArray(data) && data[0]?.success)) {
                setStatus('success');
                setTimeout(() => {
                    onClose();
                    setMessage('');
                    setStatus('idle');
                }, 2500);
            } else {
                throw new Error(data.error || 'Failed to send SMS');
            }
        } catch (error) {
            console.error(error);
            setStatus('error');
            setTimeout(() => {
                onClose();
                setMessage('');
                setStatus('idle');
            }, 2500);
        } finally {
            setIsSending(false);
        }
    };

    // deleted local helper l

    return (
        <>
            <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose} />
            <div className={cn(
                "fixed z-[120] flex flex-col bg-card transition-all duration-300 overflow-hidden",
                "inset-0 sm:inset-y-0 sm:right-0 sm:left-auto sm:w-[500px] sm:max-h-none h-[100dvh] sm:h-auto",
                "animate-in fade-in duration-300 sm:slide-in-from-right",
                "rounded-none sm:rounded-none overflow-x-hidden"
            )}>

                {/* Header */}
                <div className="p-6 border-b border-border-subtle bg-card/80 backdrop-blur-md sticky top-0 z-10 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-sky-500/10 flex items-center justify-center text-sky-500">
                            <MessageSquare className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="text-lg font-black text-primary tracking-tight">{t.sendSms}</h2>
                            <p className="text-[10px] font-bold text-muted truncate max-w-[200px]">{t.recipient}: <span className="text-primary">{studentName} ({studentPhone})</span></p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-xl hover:bg-surface text-muted transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-6 space-y-4 overscroll-contain no-scrollbar pb-32">
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-muted tracking-widest px-1">{t.messageText}</label>
                        <textarea
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            placeholder={t.messagePlaceholder}
                            className="w-full h-32 bg-surface/50 border border-border-subtle rounded-2xl p-4 text-sm font-bold text-primary placeholder:text-muted/30 outline-none focus:border-sky-500/50 focus:bg-surface transition-all resize-none"
                        />
                        <div className="flex justify-between items-center px-1">
                            <p className="text-[10px] font-bold text-muted">
                                {message.length} {t.characters}
                            </p>
                            {message.length > 160 && (
                                <p className="text-[10px] font-bold text-amber-500 flex items-center gap-1">
                                    <AlertCircle className="w-3 h-3" />
                                    {t.smsMultiPart}
                                </p>
                            )}
                        </div>
                    </div>

                    {status === 'success' && (
                        <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-600 text-xs font-bold text-center animate-in fade-in">
                            {t.smsSuccess}
                        </div>
                    )}

                    {status === 'error' && (
                        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-600 text-xs font-bold flex items-center justify-center gap-2 animate-in fade-in">
                            <AlertCircle className="w-4 h-4" />
                            {t.smsError}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-border-subtle bg-card/80 backdrop-blur-md sticky bottom-0 z-10 flex gap-3 pb-safe-offset-2">
                    <button
                        onClick={onClose}
                        className="flex-1 py-3.5 bg-surface border border-border-subtle hover:border-border text-muted hover:text-primary text-xs font-bold rounded-2xl transition-all"
                    >
                        {t.cancel}
                    </button>
                    <button
                        onClick={handleSend}
                        disabled={!message.trim() || isSending}
                        className="flex-1 py-3.5 bg-sky-500 hover:bg-sky-600 disabled:opacity-50 disabled:hover:bg-sky-500 text-white text-xs font-black rounded-2xl flex items-center justify-center gap-2 transition-all active:scale-95"
                    >
                        {isSending ? (
                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                            <><Send className="w-4 h-4" /> {t.send}</>
                        )}
                    </button>
                </div>
            </div>
        </>
    );
}
