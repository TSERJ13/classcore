'use client';

import { useT } from '@/contexts/LanguageContext';
import { ChevronLeft } from 'lucide-react';
import Link from 'next/link';

export default function TermsPage() {
    const { lang } = useT();

    const l = (ge: string, en: string) => lang === 'ka' ? ge : en;

    return (
        <div className="min-h-screen bg-slate-50 py-20 px-6">
            <div className="max-w-3xl mx-auto bg-white rounded-[2.5rem] p-8 md:p-16 shadow-xl shadow-slate-200/50">
                <Link href="/" className="inline-flex items-center gap-2 text-indigo-600 font-bold mb-8 hover:gap-3 transition-all">
                    <ChevronLeft className="w-5 h-5" />
                    {l('უკან დაბრუნება', 'Back to Home')}
                </Link>

                <h1 className="text-4xl font-black text-slate-900 mb-10 tracking-tight">
                    {l('წესები და პირობები', 'Terms and Conditions')}
                </h1>

                <div className="space-y-8 text-slate-600 leading-relaxed font-medium">
                    <section>
                        <h2 className="text-xl font-black text-slate-900 mb-4">1. {l('ზოგადი დებულებები', 'General Provisions')}</h2>
                        <p>1.1. {l('წინამდებარე პირობები არეგულირებს ურთიერთობას ClassCore-სა და საგანმანათლებლო/შემოქმედებით ორგანიზაციას (შემდგომში – „ორგანიზაცია“) შორის.', 'These terms govern the relationship between ClassCore and the educational/creative organization (the "Organization").')}</p>
                        <p>1.2. {l('ClassCore არის ონლაინ პლატფორმა, რომელიც უზრუნველყოფს ორგანიზაციების მიერ მოსწავლეთა და მშობლების მონაცემების აღრიცხვას, კომუნიკაციასა და ადმინისტრაციულ პროცესების გამარტივებას.', 'ClassCore is an online platform providing registration, communication, and administrative tools for organizations.')}</p>
                        <p>1.3. {l('პლატფორმაზე რეგისტრაციისა და სერვისით სარგებლობისას ორგანიზაცია ადასტურებს, რომ გაეცნო და ეთანხმება წინამდებარე პირობებს.', 'By registering and using the platform, the organization confirms it agrees to these terms.')}</p>
                    </section>

                    <section>
                        <h2 className="text-xl font-black text-slate-900 mb-4">2. {l('მომსახურების აღწერა', 'Description of Services')}</h2>
                        <ul className="list-disc pl-6 space-y-2">
                            <li>{l('მოსწავლეთა და მშობლების რეგისტრაციის მართვა;', 'Management of student and parent registration;')}</li>
                            <li>{l('კომუნიკაციის ავტომატიზაცია (შეტყობინებები, ელ. ფოსტა);', 'Communication automation (SMS, email);')}</li>
                            <li>{l('ფინანსური აღრიცხვისა და ანგარიშგების ფუნქციები;', 'Financial accounting and reporting;')}</li>
                            <li>{l('მონაცემების ექსპორტი.', 'Data export functionalities.')}</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-xl font-black text-slate-900 mb-4">3. {l('რეგისტრაცია', 'Registration')}</h2>
                        <p>3.1. {l('ორგანიზაცია რეგისტრირდება ClassCore პლატფორმაზე ელექტრონული ფორმის შევსებით.', 'The organization registers on ClassCore by filling out the online form.')}</p>
                        <p>3.2. {l('რეგისტრაციისას ორგანიზაცია ვალდებულია წარმოადგინოს ზუსტი და სრული ინფორმაცია.', 'The organization must provide accurate and complete info during registration.')}</p>
                    </section>

                    <section>
                        <h2 className="text-xl font-black text-slate-900 mb-4">4. {l('პერსონალურ მონაცემებზე პასუხისმგებლობა', 'Responsibility for Personal Data')}</h2>
                        <p>4.1. {l('ორგანიზაცია არის პერსონალურ მონაცემთა დამუშავებაზე პასუხისმგებელი პირი („controller“).', 'The organization is the Data Controller.')}</p>
                        <p>4.2. {l('ClassCore მოქმედებს როგორც დამმუშავებელი („processor“) და ასრულებს მხოლოდ მომსახურებას ორგანიზაციის დავალებით.', 'ClassCore acts as a Processor.')}</p>
                        <p>4.3. {l('ორგანიზაცია ვალდებულია უზრუნველყოს მონაცემთა სუბიექტების (მშობლების/მოსწავლეების) ინფორმირება და თანხმობის მიღება მონაცემთა დამუშავებაზე.', 'The organization is responsible for informing and getting consent from data subjects.')}</p>
                    </section>

                    <section>
                        <h2 className="text-xl font-black text-slate-900 mb-4">5. {l('საფასური და გადახდა', 'Fees and Payment')}</h2>
                        <p>5.1. {l('პლატფორმის გამოყენების საფასური განისაზღვრება სატარიფო გეგმის შესაბამისად.', 'Platform fees are determined by the chosen subscription plan.')}</p>
                        <p>5.2. {l('გადახდა ხდება უნაღდო ანგარიშსწორებით.', 'Payment is made through digital channels.')}</p>
                    </section>

                    <section>
                        <h2 className="text-xl font-black text-slate-900 mb-4">6. {l('პასუხისმგებლობის შეზღუდვა', 'Limitation of Liability')}</h2>
                        <p>6.1. {l('ClassCore პასუხისმგებელია მხოლოდ იმ ზარალზე, რომელიც პირდაპირ გამომდინარეობს მისი ბრალდებული ქმედებებიდან.', 'ClassCore is only liable for losses directly resulting from its specific intentional misconduct.')}</p>
                        <p>6.2. {l('ClassCore არ არის პასუხისმგებელი იმ მონაცემებზე, რომელთა შინაარსსაც აკონტროლებს ორგანიზაცია.', 'ClassCore is not responsible for data content controlled by the organization.')}</p>
                    </section>

                    <section>
                        <h2 className="text-xl font-black text-slate-900 mb-4">7. {l('ხელშეკრულების შეწყვეტა', 'Termination')}</h2>
                        <p>7.1. {l('მომხმარებელს უფლება აქვს ნებისმიერ დროს შეწყვიტოს სერვისით სარგებლობა.', 'The user has the right to stop using the service at any time.')}</p>
                    </section>
                </div>
            </div>
        </div>
    );
}
