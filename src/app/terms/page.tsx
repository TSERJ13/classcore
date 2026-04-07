'use client';

import { useLanguage } from "@/contexts/LanguageContext";
import { Logo } from "@/components/ui/Logo";
import Link from "next/link";
import { ArrowLeft, FileText, CheckCircle2, Globe, Shield, Zap } from "lucide-react";

export default function TermsPage() {
    const { l } = useLanguage();

    const sections = [
        {
            title: l('1. ზოგადი დებულებები', '1. Общие положения', '1. General Provisions'),
            content: l(
                'წინამდებარე პირობები არეგულირებს ურთიერთობას ClassCore-სა და საგანმანათლებლო ორგანიზაციას შორის. ClassCore არის ონლაინ პლატფორმა, რომელიც უზრუნველყოფს ორგანიზაციების მიერ მოსწავლეთა და მშობლების მონაცემების აღრიცხვასა და ადმინისტრაციულ მენეჯმენტს. რეგისტრაციით თქვენ ეთანხმებით ამ პირობებს.',
                'Настоящие условия регулируют отношения между ClassCore и образовательной организацией. ClassCore — это онлайн-платформа, которая предоставляет организациям учет данных учеников и родителей, а также административное управление. Регистрируясь, вы соглашаетесь с этими условиями.',
                'These terms govern the relationship between ClassCore and the educational organization. ClassCore is an online platform that provides organizations with student and parent record-keeping and administrative management. By registering, you agree to these terms.'
            )
        },
        {
            title: l('2. მომსახურების აღწერა', '2. Описание услуг', '2. Service Description'),
            content: l(
                'ClassCore სთავაზობს ორგანიზაციებს ციფრულ ინსტრუმენტებს: მოსწავლეთა მართვა, კომუნიკაციის ავტომატიზაცია (SMS, Email), ფინანსური აღრიცხვა და მონაცემების ექსპორტი. სერვისის ფუნქციები განისაზღვრება პლატფორმის აქტუალური ვერსიით.',
                'ClassCore предлагает организациям цифровые инструменты: управление учениками, автоматизация коммуникаций (SMS, Email), финансовый учет и экспорт данных. Функции сервиса определяются актуальной версией платформы.',
                'ClassCore offers organizations digital tools: student management, communication automation (SMS, Email), financial accounting, and data export. Service functions are determined by the current version of the platform.'
            )
        },
        {
            title: l('3. რეგისტრაცია და პირობები', '3. Регистрация и условия', '3. Registration and Terms'),
            content: l(
                'ორგანიზაცია რეგისტრირდება ClassCore პლატფორმაზე ელექტრონული ფორმის შევსებით. რეგისტრაციისას ორგანიზაცია ვალდებულია წარმოადგინოს ზუსტი და სრული ინფორმაცია. ClassCore უფლებამოსილია უარი თქვას რეგისტრაციაზე, თუ მონაცემები არ არის სანდო.',
                'Организация регистрируется на платформе ClassCore путем заполнения электронной формы. При регистрации организация обязана предоставить точную и полную информацию. ClassCore имеет право отказать в регистрации, если данные не являются достоверными.',
                'The organization registers on the ClassCore platform by filling out an electronic form. During registration, the organization is obliged to provide accurate and complete information. ClassCore is authorized to refuse registration if the data is not reliable.'
            )
        },
        {
            title: l('4. მხარეთა ვალდებულებები', '4. Обязательства сторон', '4. Rights and Obligations'),
            content: l(
                'ორგანიზაცია ვალდებულია უზრუნველყოს მოსწავლეების/მშობლების ინფორმირება და თანხმობის მიღება მონაცემთა დამუშავებაზე. ClassCore ვალდებულია უზრუნველყოს პლატფორმის უწყვეტი ფუნქციონირება და მონაცემთა უსაფრთხოება.',
                'Организация обязана обеспечить информирование учеников/родителей и получение их согласия на обработку данных. ClassCore обязуется обеспечить бесперебойную работу платформы и безопасность данных.',
                'The organization is obliged to ensure that students/parents are informed and their consent for data processing is obtained. ClassCore is obliged to ensure the continuous functioning of the platform and data security.'
            )
        },
        {
            title: l('5. პასუხისმგებლობის შეზღუდვა', '5. Ограничение ответственности', '5. Limitation of Liability'),
            content: l(
                'ClassCore პასუხისმგებელია მხოლოდ იმ ზარალზე, რომელიც პირდაპირ გამომდინარეობს მისი ბრალდებული ქმედებებიდან. ჩვენ არ ვართ პასუხისმგებელი მონაცემებზე, რომელთა შინაარსსაც აკონტროლებს ორგანიზაცია.',
                'ClassCore несет ответственность только за тот ущерб, который непосредственно связан с его виновными действиями. Мы не несем ответственности за данные, содержание которых контролируется организацией.',
                'ClassCore is only liable for damages that directly result from its culpable actions. We are not responsible for data whose content is controlled by the organization.'
            )
        },
        {
            title: l('6. ხელშეკრულების შეწყვეტა', '6. Прекращение договора', '6. Termination of Contract'),
            content: l(
                'ხელშეკრულება შეიძლება შეწყდეს ნებისმიერი მხარის მიერ წერილობითი შეტყობინებით. პირობების დარღვევის შემთხვევაში ClassCore უფლებამოსილია დაუყოვნებლივ შეწყვიტოს მომსახურება.',
                'Договор может быть расторгнут любой стороной путем письменного уведомления. В случае нарушения условий ClassCore имеет право немедленно прекратить оказание услуг.',
                'The agreement may be terminated by either party by written notice. In case of violation of terms, ClassCore is entitled to immediately terminate the service.'
            )
        }
    ];

    return (
        <div className="min-h-screen bg-slate-50 font-sans selection:bg-indigo-100 selection:text-indigo-900">
            {/* Header / Nav */}
            <nav className="fixed top-0 inset-x-0 h-20 bg-white/80 backdrop-blur-xl border-b border-slate-100 z-50 px-6">
                <div className="max-w-7xl mx-auto h-full flex items-center justify-between">
                    <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
                        <Logo size={40} transparent />
                        <span className="text-xl font-black tracking-tighter">ClassCore</span>
                    </Link>
                    <Link href="/" className="flex items-center gap-2 text-[10px] font-black uppercase text-indigo-600 tracking-widest hover:translate-x-[-4px] transition-transform">
                        <ArrowLeft className="w-4 h-4" />
                        {l('უკან', 'Назад', 'Back')}
                    </Link>
                </div>
            </nav>

            <main className="pt-32 pb-24 px-6 md:px-12 lg:px-20">
                <div className="max-w-7xl mx-auto space-y-16">
                    {/* Hero Section */}
                    <div className="text-center space-y-6">
                        <div className="w-20 h-20 bg-white rounded-[2rem] shadow-xl shadow-indigo-500/5 border border-indigo-50 flex items-center justify-center mx-auto text-indigo-600">
                            <FileText className="w-10 h-10" />
                        </div>
                        <h1 className="text-4xl md:text-5xl font-black text-slate-900 uppercase tracking-tight">
                            {l('სარგებლობის წესები', 'Условия использования', 'Terms of Service')}
                        </h1>
                        <p className="text-sm text-slate-400 font-bold uppercase tracking-[0.3em]">
                            {l('თქვენი და ჩვენი ურთიერთობის წესები', 'Условия взаимодействия с ClassCore', 'Terms of Engagement with ClassCore')}
                        </p>
                    </div>

                    {/* Content Cards */}
                    <div className="grid gap-6">
                        {sections.map((section, idx) => (
                            <div key={idx} className="bg-white p-10 md:p-12 rounded-[3rem] border border-slate-100 shadow-2xl shadow-indigo-500/5 space-y-6 transition-all hover:scale-[1.01]">
                                <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight flex items-center gap-4">
                                    <span className="w-8 h-8 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 text-xs shadow-sm">
                                        <CheckCircle2 className="w-4 h-4" />
                                    </span>
                                    {section.title}
                                </h3>
                                <div className="text-slate-500 font-medium leading-relaxed text-lg">
                                    {section.content}
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Footer / CTA */}
                    <div className="bg-indigo-600 rounded-[3rem] p-12 text-center space-y-6 shadow-2xl shadow-indigo-600/20">
                        <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mx-auto text-white">
                            <Globe className="w-8 h-8" />
                        </div>
                        <h3 className="text-2xl font-black text-white uppercase tracking-tight">
                            {l('მზად ხართ დასაწყებად?', 'Готовы начать?', 'Ready to Start?')}
                        </h3>
                        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                            <Link href="/registration" className="px-10 py-5 bg-white text-indigo-600 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl hover:scale-105 active:scale-95 transition-all">
                                {l('რეგისტრაცია', 'Регистрация', 'Fast Registration')}
                            </Link>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
