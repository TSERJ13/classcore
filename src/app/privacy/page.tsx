"use client";

import { useLanguage } from "@/contexts/LanguageContext";
import { Logo } from "@/components/ui/Logo";
import Link from "next/link";
import { ArrowLeft, ShieldCheck } from "lucide-react";

export default function PrivacyPage() {
    const { l } = useLanguage();

    return (
        <div className="min-h-screen bg-slate-50 font-sans text-slate-900 py-20 px-6">
            <div className="max-w-3xl mx-auto space-y-12 bg-white p-12 md:p-20 rounded-[3rem] shadow-xl border border-slate-100">
                <div className="flex items-center justify-between border-b border-slate-100 pb-10">
                    <Link href="/" className="group flex items-center gap-2 text-indigo-600 font-black uppercase text-[10px] tracking-widest hover:-translate-x-1 transition-all">
                        <ArrowLeft className="w-4 h-4" /> {l('უკან', 'Назад', 'Back')}
                    </Link>
                    <Logo size={40} transparent />
                </div>

                <div className="space-y-10">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 shadow-sm">
                            <ShieldCheck className="w-6 h-6" />
                        </div>
                        <h1 className="text-3xl font-black uppercase tracking-tight">{l('კონფიდენციალურობა', 'Конфиденциальность', 'Privacy Policy')}</h1>
                    </div>
                    
                    <div className="space-y-10 text-slate-600 font-medium leading-relaxed">
                        <section>
                            <h2 className="text-lg font-black text-slate-900 uppercase tracking-widest mb-4">{l('1. მონაცემთა დაცვა', '1. Защита данных', '1. Data Protection')}</h2>
                            <p>{l('ჩვენ ვიყენებთ თანამედროვე ტექნოლოგიებს თქვენი და თქვენი მომხმარებლების მონაცემების დასაცავად. თქვენს მიერ ატვირთული ინფორმაცია არის კონფიდენციალური და ხელმისაწვდომია მხოლოდ თქვენთვის.', 'Мы используем современные технологии для защиты ваших данных и данных ваших клиентов. Информация, загруженная вами, является конфиденциальной и доступна только вам.', 'We use modern technologies to protect your data and your customers\' data. The information uploaded by you is confidential and accessible only to you.')}</p>
                        </section>

                        <section>
                            <h2 className="text-lg font-black text-slate-900 uppercase tracking-widest mb-4">{l('2. ინფორმაციის გამოყენება', '2. Использование информации', '2. Use of Information')}</h2>
                            <p>{l('ClassCore აგროვებს მხოლოდ იმ ინფორმაციას, რომელიც აუცილებელია სერვისის სრულყოფილი ფუნქციონირებისთვის.', 'ClassCore собирает только ту информацию, которая необходима для полноценного функционирования сервиса.', 'ClassCore collects only the information necessary for the full functioning of the service.')}</p>
                        </section>

                        <section className="pt-8 border-t border-slate-100 italic text-slate-400 text-sm">
                            {l('ბოლოს განახლდა: 23 თებერვალი, 2026', 'Последнее обновление: 23 февраля 2026г.', 'Last Updated: February 23, 2026')}
                        </section>
                    </div>
                </div>
            </div>
        </div>
    );
}
