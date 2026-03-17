'use client';

import { useT } from '@/contexts/LanguageContext';
import { ChevronLeft } from 'lucide-react';
import Link from 'next/link';

export default function PrivacyPage() {
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
                    {l('კონფიდენციალურობის პოლიტიკა', 'Privacy Policy')}
                </h1>

                <div className="space-y-8 text-slate-600 leading-relaxed font-medium">
                    <section>
                        <h2 className="text-xl font-black text-slate-900 mb-4">1. {l('ზოგადი ინფორმაცია', 'General Information')}</h2>
                        <p>1.1. {l('წინამდებარე კონფიდენციალურობის პოლიტიკა („პოლიტიკა“) განმარტავს, თუ როგორ აგროვებს, ამუშავებს და იცავს ClassCore მომხმარებლების პერსონალურ მონაცემებს.', 'This Privacy Policy ("Policy") explains how ClassCore collects, processes, and protects user personal data.')}</p>
                        <p>1.2. {l('პოლიტიკა ვრცელდება ყველა იმ პირზე, ვინც სარგებლობს ClassCore პლატფორმით, მათ შორის:', 'The policy applies to all persons using the ClassCore platform, including:')}</p>
                        <ul className="list-disc pl-6 mt-2 space-y-2">
                            <li>{l('ორგანიზაციებზე (საგანმანათლებლო/შემოქმედებითი ცენტრები, სკოლები, სტუდიები), რომლებიც რეგისტრირდებიან პლატფორმაზე;', 'Organizations (educational/creative centers, schools, studios) registering on the platform;')}</li>
                            <li>{l('მშობლებზე და მოსწავლეებზე, რომლებიც რეგისტრირდებიან კონკრეტულ ორგანიზაციაში.', 'Parents and students registering in a specific organization.')}</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-xl font-black text-slate-900 mb-4">2. {l('ვინ არის მონაცემთა დამუშავებაზე პასუხისმგებელი პირი', 'Who is Responsible for Data Processing')}</h2>
                        <p>2.1. {l('ორგანიზაცია, რომელიც რეგისტრირდება ClassCore-ზე და იყენებს მის სერვისებს, არის პერსონალურ მონაცემთა დამუშავებაზე პასუხისმგებელი პირი (Controller). იგი განსაზღვრავს მონაცემთა დამუშავების მიზნებსა და პირობებს.', 'The organization registering on ClassCore and using its services is the Data Controller. It defines the purposes and conditions of data processing.')}</p>
                        <p>2.2. {l('ClassCore მოქმედებს როგორც დამმუშავებელი (Processor) და უზრუნველყოფს მხოლოდ ტექნიკურ ინფრასტრუქტურას მონაცემების შესანახად და სამართავად ორგანიზაციის დავალებით.', 'ClassCore acts as a Processor and provides only the technical infrastructure for data storage and management at the organization\'s request.')}</p>
                        <p>2.3. {l('შესაბამისად: მშობლისა და მოსწავლის წინაშე პასუხისმგებელია უშუალოდ ორგანიზაცია; ClassCore პასუხისმგებელია მონაცემთა ტექნიკურ უსაფრთხოებაზე.', 'Accordingly: the organization is directly responsible to the parent and student; ClassCore is responsible for technical data security.')}</p>
                    </section>

                    <section>
                        <h2 className="text-xl font-black text-slate-900 mb-4">3. {l('რა მონაცემებს ვაგროვებთ', 'What Data We Collect')}</h2>
                        <p>{l('ClassCore-ის გამოყენებისას შესაძლოა დამუშავდეს შემდეგი მონაცემები:', 'When using ClassCore, the following data may be processed:')}</p>
                        <ul className="list-disc pl-6 mt-2 space-y-2">
                            <li>{l('ორგანიზაციის წარმომადგენლის სახელი, გვარი, ტელეფონი, ელფოსტა, საიდენტიფიკაციო კოდი;', 'Representative name, surname, phone, email, ID code;')}</li>
                            <li>{l('მშობლის სახელი, გვარი, პირადი ნომერი, ტელეფონი, ელფოსტა (არასავალდებულო), დაბადების თარიღი;', 'Parent name, surname, personal ID, phone, email (optional), birth date;')}</li>
                            <li>{l('მოსწავლის სახელი, გვარი, დაბადების თარიღი და სწავლის შესახებ ინფორმაცია (ჯგუფი, კლასები და სხვ.).', 'Student name, surname, birth date, and study info (groups, classes, etc.).')}</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-xl font-black text-slate-900 mb-4">4. {l('მონაცემთა დამუშავების მიზნები', 'Purposes of Data Processing')}</h2>
                        <p>{l('პერსონალური მონაცემები მუშავდება შემდეგი მიზნებისთვის:', 'Personal data is processed for the following purposes:')}</p>
                        <ul className="list-disc pl-6 mt-2 space-y-2">
                            <li>{l('მომსახურების ხელშეკრულების შესრულება;', 'Execution of the service agreement;')}</li>
                            <li>{l('მოსწავლის რეგისტრაცია და სწავლის პროცესის ორგანიზება;', 'Student registration and study process organization;')}</li>
                            <li>{l('მშობელთან კომუნიკაცია და შეტყობინებების მიწოდება;', 'Communication with parents and notifications;')}</li>
                            <li>{l('საფასურის აღრიცხვა და ფინანსური დოკუმენტაციის წარმოება;', 'Accounting and financial documentation;')}</li>
                            <li>{l('მოქმედი კანონმდებლობით გათვალისწინებული ვალდებულებების შესრულება.', 'Compliance with legal obligations.')}</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-xl font-black text-slate-900 mb-4">5. {l('მონაცემთა შენახვა', 'Data Storage')}</h2>
                        <p>5.1. {l('მონაცემები ინახება ClassCore-ის უსაფრთხო სერვერებზე.', 'Data is stored on ClassCore\'s secure servers.')}</p>
                        <p>5.2. {l('მონაცემები ინახება მომსახურების ხელშეკრულების მოქმედების პერიოდში და მის შეწყვეტიდან 1 წლის განმავლობაში, თუ კანონმდებლობით სხვა ვადა არ არის დადგენილი.', 'Data is stored during the service agreement and for 1 year after its termination, unless otherwise specified by law.')}</p>
                    </section>

                    <section>
                        <h2 className="text-xl font-black text-slate-900 mb-4">6. {l('მონაცემთა გაზიარება', 'Data Sharing')}</h2>
                        <p>6.1. {l('მონაცემებზე წვდომა აქვს მხოლოდ შესაბამის ორგანიზაციას (controller).', 'Access to data is restricted to the respective organization (controller).')}</p>
                        <p>6.2. {l('ClassCore არ გადასცემს მონაცემებს მესამე პირებს ორგანიზაციის დავალების გარეშე, გარდა კანონით დადგენილი შემთხვევებისა.', 'ClassCore does not transfer data to third parties without the organization\'s instruction, except as required by law.')}</p>
                    </section>

                    <section>
                        <h2 className="text-xl font-black text-slate-900 mb-4">7. {l('მონაცემთა სუბიექტის უფლებები', 'Rights of the Data Subject')}</h2>
                        <ul className="list-disc pl-6 mt-2 space-y-2">
                            <li>{l('მიიღონ ინფორმაცია, მუშავდება თუ არა მათი მონაცემები;', 'Receive info on whether their data is being processed;')}</li>
                            <li>{l('გაეცნონ და მიიღონ მონაცემების ასლი;', 'Review and receive a copy of the data;')}</li>
                            <li>{l('მოითხოვონ მონაცემების გასწორება, განახლება ან შევსება;', 'Request correction, update or completion;')}</li>
                            <li>{l('მოითხოვონ მონაცემების წაშლა ან დაბლოკვა კანონით გათვალისწინებულ საფუძვლებზე.', 'Request deletion or blocking based on legal grounds.')}</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-xl font-black text-slate-900 mb-4">8. {l('მონაცემთა უსაფრთხოება', 'Data Security')}</h2>
                        <p>{l('ClassCore იყენებს დაშიფრულ კავშირს (SSL), ავტორიზაციის მკაცრ კონტროლს და მონაცემთა ბაზის სარეზერვო ასლებს მონაცემთა დასაცავად.', 'ClassCore uses SSL encryption, strict auth control, and database backups to protect data.')}</p>
                    </section>

                    <section>
                        <h2 className="text-xl font-black text-slate-900 mb-4">9. {l('ცვლილებები პოლიტიკაში', 'Policy Changes')}</h2>
                        <p>{l('ClassCore იტოვებს უფლებას, დროდადრო განაახლოს წინამდებარე პოლიტიკა. ცვლილებები გამოქვეყნდება პლატფორმაზე და ძალაში შევა მათი გამოქვეყნებისთანავე.', 'ClassCore reserves the right to update this policy. Changes are effective immediately upon posting.')}</p>
                    </section>
                </div>
            </div>
        </div>
    );
}
