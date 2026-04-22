'use client';

import { useState, useEffect, useRef } from 'react';
import { MessageCircle, X, Send, User, Shield, CheckCheck, Loader2 } from 'lucide-react';
import { useT } from '@/contexts/LanguageContext';
import { useUser } from '@/hooks/useUser';
import { cn } from '@/lib/utils';

export function SupportChat() {
    const { t, lang } = useT();
    const { profile, user } = useUser();
    const [isOpen, setIsOpen] = useState(false);
    const [message, setMessage] = useState('');
    const [messages, setMessages] = useState<Array<{ id: string; text: string; sender: 'user' | 'admin'; time: string }>>([]);
    const [isTyping, setIsTyping] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);

    const l = (ka: string, ru: string, en: string) => lang === 'ka' ? ka : lang === 'ru' ? ru : en;

    useEffect(() => {
        const handleOpen = () => setIsOpen(true);
        window.addEventListener('open-support-chat', handleOpen);
        return () => window.removeEventListener('open-support-chat', handleOpen);
    }, []);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages, isTyping]);

    const handleSend = () => {
        if (!message.trim()) return;

        const newMsg = {
            id: Date.now().toString(),
            text: message,
            sender: 'user' as const,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };

        setMessages(prev => [...prev, newMsg]);
        setMessage('');

        // Simulate Admin Reply
        setIsTyping(true);
        setTimeout(() => {
            setIsTyping(false);
            setMessages(prev => [...prev, {
                id: (Date.now() + 1).toString(),
                text: l('გამარჯობა! თქვენი შეტყობინება მიღებულია. ადმინისტრატორი მალე გიპასუხებთ მეილზე ან პირდაპირ აქ.',
                    'Здравствуйте! Ваше сообщение получено. Администратор скоро ответит вам по почте или прямо здесь.',
                    'Hello! Your message has been received. An administrator will reply to you soon via email or directly here.'),
                sender: 'admin',
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            }]);
        }, 3000);
    };

    if (!isOpen) {
        return (
            <button
                onClick={() => setIsOpen(true)}
                className="fixed bottom-6 right-6 w-14 h-14 bg-indigo-600 text-white rounded-full flex items-center justify-center hover:scale-110 active:scale-95 transition-all z-50 group border border-white/20"
            >
                <MessageCircle className="w-6 h-6 group-hover:rotate-12 transition-transform" />
                <div className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-500 border-2 border-white rounded-full" />
            </button>
        );
    }

    return (
        <div className="fixed bottom-6 right-6 w-[380px] h-[550px] bg-card border border-border-subtle rounded-[2rem] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.3)] flex flex-col overflow-hidden z-50 animate-in fade-in slide-in-from-bottom-10 duration-300">
            {/* Header */}
            <div className="px-6 py-5 bg-indigo-600 text-white flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                        <Shield className="w-5 h-5" />
                    </div>
                    <div>
                        <h3 className="text-sm font-black tracking-widest">{l('მხარდაჭერა', 'Поддержка', 'Support')}</h3>
                        <div className="flex items-center gap-1.5">
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                            <span className="text-[10px] font-bold text-indigo-100 opacity-60">{l('ონლაინ', 'В сети', 'Online')}</span>
                        </div>
                    </div>
                </div>
                <button onClick={() => setIsOpen(false)} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
                    <X className="w-5 h-5" />
                </button>
            </div>

            {/* Messages */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-4 no-scrollbar bg-surface/10">
                {messages.length === 0 && (
                    <div className="text-center py-10 space-y-4">
                        <div className="w-16 h-16 bg-muted/5 rounded-[2rem] border border-border-subtle flex items-center justify-center mx-auto">
                            <MessageCircle className="w-8 h-8 text-muted/20" />
                        </div>
                        <p className="text-xs font-bold text-muted opacity-40 px-10">
                            {l('მოგვწერეთ ნებისმიერი კითხვა სისტემის შესახებ.', 'Напишите нам любой вопрос о системе.', 'Message us with any questions about the system.')}
                        </p>
                    </div>
                )}

                {messages.map((msg) => (
                    <div key={msg.id} className={cn("flex flex-col gap-1.5 max-w-[85%]", msg.sender === 'user' ? "ml-auto items-end" : "items-start")}>
                        <div className={cn(
                            "px-4 py-3 rounded-2xl text-[13px] font-medium leading-relaxed shadow-sm",
                            msg.sender === 'user' ? "bg-indigo-600 text-white rounded-tr-none" : "bg-card border border-border-subtle text-primary rounded-tl-none"
                        )}>
                            {msg.text}
                        </div>
                        <span className="text-[9px] font-bold text-muted/40 tracking-widest px-1">{msg.time}</span>
                    </div>
                ))}

                {isTyping && (
                    <div className="flex items-center gap-2 text-muted/40 font-bold text-[10px] tracking-widest px-1">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        {l('ადმინისტრატორი წერს...', 'Админ пишет...', 'Admin is typing...')}
                    </div>
                )}
            </div>

            {/* Input */}
            <div className="p-4 bg-card border-t border-border-subtle">
                <div className="relative flex items-center">
                    <input
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                        placeholder={l('დაწერეთ შეტყობინება...', 'Введите сообщение...', 'Type a message...')}
                        className="w-full bg-surface border border-border-subtle focus:border-indigo-500/40 rounded-2xl px-5 py-3.5 pr-14 text-sm font-medium outline-none transition-all placeholder:text-muted/40"
                    />
                    <button
                        onClick={handleSend}
                        disabled={!message.trim()}
                        className="absolute right-2 p-2.5 bg-indigo-600 text-white rounded-xl disabled:opacity-20 disabled:grayscale transition-all hover:scale-105 active:scale-95"
                    >
                        <Send className="w-4 h-4" />
                    </button>
                </div>
                <p className="text-center text-[9px] font-bold text-muted/30 tracking-[0.2em] mt-3">
                    ClassCore Integrated Support
                </p>
            </div>
        </div>
    );
}
