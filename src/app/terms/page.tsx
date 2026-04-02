"use client";

import { useLanguage } from "@/contexts/LanguageContext";
import { Logo } from "@/components/ui/Logo";
import Link from "next/link";
import { ArrowLeft, FileText } from "lucide-react";

export default function TermsPage() {
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
                            <FileText className="w-6 h-6" />
                        </div>
                        <h1 className="text-3xl font-black uppercase tracking-tight">{l('წესები და პირობები', 'Условия и положения', 'Terms & Conditions')}</h1>
                    </div>
                    
                    <div className="space-y-10 text-slate-600 font-medium leading-relaxed">
                        <section>
                            <h2 className="text-lg font-black text-slate-900 uppercase tracking-widest mb-4">{l('1. ზოგადი პირობები', '1. Общие условия', '1. General Terms')}</h2>
                            <p>{l('კეთილი იყოს თქვენი მობრძანება ClassCore-ზე. ჩვენი პლატფორმის გამოყენებით თქვენ ეთანხმებით წინამდებარე წესებსა და პირობებს. გთხოვთ ყურადღებით გაეცნოთ მათ.', 'Добро пожаловать в ClassCore. Используя нашу платформу, вы соглашаетесь с этими правилами и условиями. Пожалуйста, внимательно ознакомьтесь с ними.', 'Welcome to ClassCore. By using our platform, you agree to these terms and conditions. Please read them carefully.')}</p>
                        </section>

                        <section>
                            <h2 className="text-lg font-black text-slate-900 uppercase tracking-widest mb-4">{l('2. მომსახურების აღწერა', '2. Описание услуг', '2. Service Description')}</h2>
                            <p>{l('ClassCore არის სტუდიების, სპორტული სკოლებისა და საგანმანათლებლო ცენტრების მართვის სისტემა (CRM). ჩვენ გთავაზობთ ხელსაწყოებს დასწრების აღრიცხვის, გადახდების მართვის, ჯგუფების დაგეგმვისა და ანალიტიკისთვის.', 'ClassCore — это система управления (CRM) для студий, спортивных школ и образовательных центров. Мы предоставляем инструменты для учета посещаемости, управления платежами, планирования групп и аналитики.', 'ClassCore is a management system (CRM) for studios, sports schools, and educational centers. We provide tools for attendance tracking, payment management, group planning, and analytics.')}</p>
                        </section>

                        <section>
                            <h2 className="text-lg font-black text-slate-900 uppercase tracking-widest mb-4">{l('3. პასუხისმგებლობა', '3. Ответственность', '3. Liability')}</h2>
                            <p>{l('ClassCore არ არის პასუხისმგებელი იმ ზიანზე, რომელიც გამოწვეულია პლატფორმის არასწორი გამოყენებით ან მესამე მხარის მიერ მოწოდებული სერვისების შეფერხებით.', 'ClassCore не несет ответственности за ущерб, вызванный неправильным использованием платформы или задержками в услугах, предоставляемых третьими сторонами.', 'ClassCore is not responsible for damages caused by the incorrect use of the platform or delays in services provided by third parties.')}</p>
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
