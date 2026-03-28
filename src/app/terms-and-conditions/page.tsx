'use client';

import Link from 'next/link';
import { Zap, ChevronLeft } from 'lucide-react';

export default function TermsPage() {
    return (
        <div className="min-h-screen bg-white text-slate-900 font-sans selection:bg-indigo-100 selection:text-indigo-900">
            {/* Header */}
            <header className="fixed top-0 inset-x-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-100">
                <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
                    <Link href="/" className="flex items-center gap-2 group">
                        <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-600/20 group-hover:scale-110 transition-transform">
                            <Zap className="w-6 h-6 text-white" strokeWidth={2.5} />
                        </div>
                        <span className="text-xl font-black tracking-tight text-slate-900">ClassCore</span>
                    </Link>
                    <Link href="/" className="flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-indigo-600 transition-colors">
                        <ChevronLeft className="w-4 h-4" />
                        მთავარზე დაბრუნება
                    </Link>
                </div>
            </header>

            <main className="pt-32 pb-20 px-6">
                <div className="max-w-3xl mx-auto space-y-12">
                    <section>
                        <h1 className="text-4xl md:text-5xl font-black tracking-tight text-slate-900 mb-6">წესები და პირობები</h1>
                        <p className="text-lg text-slate-500 font-medium leading-relaxed">
                            ბოლოს განახლდა: 23 თებერვალი, 2026
                        </p>
                    </section>

                    <section className="prose prose-slate prose-lg max-w-none">
                        <div className="space-y-8">
                            <div>
                                <h3 className="text-xl font-bold text-slate-900 mb-4">1. ზოგადი პირობები</h3>
                                <p className="text-slate-600 leading-relaxed">
                                    კეთილი იყოს თქვენი მობრძანება ClassCore-ზე. ჩვენი პლატფორმის გამოყენებით თქვენ ეთანხმებით წინამდებარე წესებსა და პირობებს. გთხოვთ ყურადღებით გაეცნოთ მათ.
                                </p>
                            </div>

                            <div>
                                <h3 className="text-xl font-bold text-slate-900 mb-4">2. მომსახურების აღწერა</h3>
                                <p className="text-slate-600 leading-relaxed">
                                    ClassCore არის სტუდიების, სპორტული სკოლებისა და საგანმანათლებლო ცენტრების მართვის სისტემა (CRM). ჩვენ გთავაზობთ ხელსაწყოებს დასწრების აღრიცხვის, გადახდების მართვის, ჯგუფების დაგეგმვისა და ანალიტიკისთვის.
                                </p>
                            </div>

                            <div>
                                <h3 className="text-xl font-bold text-slate-900 mb-4">3. მონაცემთა უსაფრთხოება</h3>
                                <p className="text-slate-600 leading-relaxed">
                                    ჩვენ ვიყენებთ თანამედროვე ტექნოლოგიებს თქვენი და თქვენი მომხმარებლების მონაცემების დასაცავად. თქვენს მიერ ატვირთული ინფორმაცია არის კონფიდენციალური და ხელმისაწვდომია მხოლოდ თქვენთვის.
                                </p>
                            </div>

                            <div>
                                <h3 className="text-xl font-bold text-slate-900 mb-4">4. პასუხისმგებლობის შეზღუდვა</h3>
                                <p className="text-slate-600 leading-relaxed">
                                    ClassCore არ არის პასუხისმგებელი იმ ზიანზე, რომელიც გამოწვეულია პლატფორმის არასწორი გამოყენებით ან მესამე მხარის მიერ მოწოდებული სერვისების შეფერხებით.
                                </p>
                            </div>

                            <div>
                                <h3 className="text-xl font-bold text-slate-900 mb-4">5. ცვლილებები პირობებში</h3>
                                <p className="text-slate-600 leading-relaxed">
                                    ჩვენ ვიტოვებთ უფლებას ნებისმიერ დროს შევცვალოთ ეს წესები. ცვლილებების შესახებ ინფორმაცია გამოქვეყნდება ამავე გვერდზე.
                                </p>
                            </div>
                        </div>
                    </section>

                    <div className="pt-12 border-t border-slate-100">
                        <Link href="/" className="inline-flex items-center justify-center px-8 py-4 bg-indigo-600 text-white font-bold rounded-2xl shadow-xl shadow-indigo-600/20 hover:bg-indigo-700 hover:-translate-y-1 active:translate-y-0 transition-all">
                            მთავარზე დაბრუნება
                        </Link>
                    </div>
                </div>
            </main>

            <footer className="py-12 border-t border-slate-100 bg-slate-50/50">
                <div className="max-w-7xl mx-auto px-6 text-center">
                    <p className="text-slate-400 text-sm font-medium tracking-widest">© 2026 ClassCore. All rights reserved.</p>
                </div>
            </footer>
        </div>
    );
}
