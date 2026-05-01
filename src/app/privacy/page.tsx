'use client';

import { useLanguage } from "@/contexts/LanguageContext";
import { AppLogo } from "@/components/ui/Logo";
import Link from "next/link";
import { ArrowLeft, Shield, Lock, Eye, FileText, CheckCircle2 } from "lucide-react";

export default function PrivacyPage() {
    const { l } = useLanguage();

    const sections = [
        {
            title: l('1. ზოგადი ინფორმაცია', '1. Общая информация', '1. General Information'),
            content: l(
                'წინამდებარე კონფიდენციალურობის პოლიტიკა განმარტავს, თუ როგორ აგროვებს, ამუშავებს და იცავს ClassCore მომხმარებლების პერსონალურ მონაცემებს. პოლიტიკა ვრცელდება ყველა იმ პირზე, ვინც სარგებლობს ClassCore პლატფორმით, მათ შორის ორგანიზაციებზე, მშობლებსა და მოსწავლეებზე.',
                'Настоящая политика конфиденциальности объясняет, как ClassCore собирает, обрабатывает и защищает персональные данные пользователей. Политика распространяется на всех лиц, использующих платформу ClassCore, включая организации, родителей и учеников.',
                'This Privacy Policy explains how ClassCore collects, processes, and protects users\' personal data. The policy applies to all persons using the ClassCore platform, including organizations, parents, and students.'
            )
        },
        {
            title: l('2. პასუხისმგებელი პირები', '2. Ответственные лица', '2. Responsible Parties'),
            content: l(
                'ორგანიზაცია, რომელიც რეგისტრირდება ClassCore-ზე, არის პერსონალურ მონაცემთა დამუშავებაზე პასუხისმგებელი პირი (Controller). ClassCore მოქმედებს როგორც დამმუშავებელი (Processor) და უზრუნველყოფს მხოლოდ ტექნიკურ ინფრასტრუქტურას. ClassCore პასუხისმგებელია მონაცემთა ტექნიკურ უსაფრთხოებაზე.',
                'Организация, которая регистрируется в ClassCore, является лицом, ответственным за обработку персональных данных (Контроллер). ClassCore действует как обработчик (Процессор) и предоставляет только техническую инфраструктуру. ClassCore несет ответственность за техническую безопасность данных.',
                'The organization that registers with ClassCore is the person responsible for the processing of personal data (Controller). ClassCore acts as a processor and provides only the technical infrastructure. ClassCore is responsible for the technical security of the data.'
            )
        },
        {
            title: l('3. მონაცემთა შეგროვება', '3. Сбор данных', '3. Data Collection'),
            content: l(
                'ClassCore-ის გამოყენებისას შესაძლოა დამუშავდეს შემდეგი მონაცემები: ორგანიზაციის წარმომადგენლის სახელი, გვარი, ტელეფონი, ელფოსტა; მშობლისა და მოსწავლის პერსონალური ინფორმაცია, მათ შორის დაბადების თარიღი და სწავლის ისტორია.',
                'При использовании ClassCore могут обрабатываться следующие данные: имя, фамилия, телефон, электронная почта представителя организации; персональная информация родителя и ученика, включая дату рождения и историю обучения.',
                'When using ClassCore, the following data may be processed: first name, last name, phone, email of the organization representative; personal information of the parent and student, including date of birth and study history.'
            )
        },
        {
            title: l('4. დამუშავების მიზნები', '4. Цели обработки', '4. Purposes of Processing'),
            content: l(
                'პერსონალური მონაცემები მუშავდება შემდეგი მიზნებისთვის: მომსახურების ხელშეკრულების შესრულება, სწავლის პროცესის ორგანიზება, მშობელთან კომუნიკაცია, საფასურის აღრიცხვა და ფინანსური დოკუმენტაციის წარმოება.',
                'Персональные данные обрабатываются в следующих целях: выполнение договора об оказании услуг, организация процесса обучения, общение с родителями, учет оплаты и ведение финансовой документации.',
                'Personal data are processed for the following purposes: execution of the service contract, organization of the learning process, communication with parents, accounting of fees and production of financial documentation.'
            )
        },
        {
            title: l('5. მონაცემთა შენახვა და დაცვა', '5. Хранение и защита данных', '5. Data Retention and Protection'),
            content: l(
                'მონაცემები ინახება ClassCore-ის სერტიფიცირებულ სერვერებზე. მონაცემები ინახება მომსახურების ხელშეკრულების მოქმედების პერიოდში და მის შეწყვეტიდან 1 წლის განმავლობაში. ჩვენ ვიყენებთ SSL დაშიფვრას და წვდომის მკაცრ კონტროლს.',
                'Данные хранятся на сертифицированных серверах ClassCore. Данные хранятся в течение срока действия договора на оказание услуг и в течение 1 года после его прекращения. Мы используем SSL-шифрование и строгий контроль доступа.',
                'Data is stored on certified ClassCore servers. Data is stored during the term of the service contract and for 1 year after its termination. We use SSL encryption and strict access control.'
            )
        },
        {
            title: l('6. მომხმარებლის უფლებები', '6. Права пользователя', '6. User Rights'),
            content: l(
                'თქვენ გაქვთ უფლება მიიღოთ ინფორმაცია თქვენი მონაცემების შესახებ, მოითხოვოთ მათი გასწორება, განახლება ან წაშლა. ასევე შეგიძლიათ გააუქმოთ თანხმობა მონაცემთა დამუშავებაზე ნებისმიერ დროს.',
                'Вы имеете право получать информацию о своих данных, требовать их исправления, обновления или удаления. Вы также можете отозвать свое согласие на обработку данных в любое время.',
                'You have the right to receive information about your data, request its correction, update or deletion. You can also withdraw your consent to data processing at any time.'
            )
        }
    ];

    return (
        <div className="min-h-screen bg-slate-50 font-sans selection:bg-indigo-100 selection:text-indigo-900">
            {/* Header / Nav */}
            <nav className="fixed top-0 inset-x-0 h-20 bg-white/80 backdrop-blur-xl border-b border-slate-100 z-50 px-6">
                <div className="max-w-7xl mx-auto h-full flex items-center justify-between">
                    <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
                        <AppLogo size={40} transparent />
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
                            <Shield className="w-10 h-10" />
                        </div>
                        <h1 className="text-4xl md:text-5xl font-black text-slate-900 uppercase tracking-tight">
                            {l('კონფიდენციალურობა', 'Приватность', 'Privacy Policy')}
                        </h1>
                        <p className="text-sm text-slate-400 font-bold uppercase tracking-[0.3em]">
                            {l('თქვენი მონაცემები ჩვენი პრიორიტეტია', 'Ваши данные — наш приоритет', 'Your Data Is Our Priority')}
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

                    {/* Footer / Contact Info */}
                    <div className="bg-indigo-600 rounded-[3rem] p-12 text-center space-y-6 shadow-2xl shadow-indigo-600/20">
                        <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mx-auto text-white">
                            <Lock className="w-8 h-8" />
                        </div>
                        <h3 className="text-2xl font-black text-white uppercase tracking-tight">
                            {l('გაქვთ კითხვები?', 'Остались вопросы?', 'Have Questions?')}
                        </h3>
                        <p className="text-indigo-100 font-medium">
                            {l('დაგვიკავშირდით: support@classcore.ge ან +995 555 13 00 13', 'Свяжитесь с нами: support@classcore.ge или +995 555 13 00 13', 'Contact us at: support@classcore.ge or +995 555 13 00 13')}
                        </p>
                    </div>
                </div>
            </main>
        </div>
    );
}
