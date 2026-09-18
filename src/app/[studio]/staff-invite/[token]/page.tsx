'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Loader2, Lock, User, Phone, CheckCircle2, XCircle, Eye, EyeOff } from 'lucide-react';
import { AppLogo } from '@/components/ui/Logo';
import { getStaffInviteByTokenAction, submitStaffInviteAction } from '@/app/actions/staff-invites';
import { validatePasswordPolicy } from '@/lib/password-policy';

/**
 * Public claim page for the teacher invite-by-email flow
 * (docs/authorization-module.md §8, path "(ა) მოწვევა"). No session at
 * all — the token in the URL is the only credential. Submitting here does
 * NOT create the staff account yet; it just fills the pending invite row,
 * which the studio's admin then reviews and confirms
 * (src/app/actions/staff-invites.ts's confirmStaffInviteAction).
 */
export default function StaffInviteClaimPage() {
    const params = useParams() as { studio: string; token: string };
    const token = params?.token || '';

    const [loading, setLoading] = useState(true);
    const [invite, setInvite] = useState<{ email: string; studioName: string } | null>(null);
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [phone, setPhone] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        getStaffInviteByTokenAction({ token })
            .then(result => setInvite(result))
            .catch(() => setInvite(null))
            .finally(() => setLoading(false));
    }, [token]);

    const passwordPolicy = validatePasswordPolicy(password);
    const canSubmit = firstName.trim() && lastName.trim() && phone.trim() && passwordPolicy.valid && password === confirmPassword;

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!canSubmit) return;
        setSubmitting(true);
        setError(null);
        try {
            await submitStaffInviteAction({ token, first_name: firstName, last_name: lastName, phone, password });
            setSubmitted(true);
        } catch (err: any) {
            setError(err?.message || 'დაფიქსირდა შეცდომა');
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-[50%] h-full bg-indigo-50/50 blur-[120px] -z-10" />
            <div className="absolute bottom-0 left-0 w-[30%] h-1/2 bg-violet-50/50 blur-[100px] -z-10" />

            <div className="w-full max-w-[420px] space-y-10 animate-fade-up">
                <div className="flex flex-col items-center text-center space-y-4">
                    <AppLogo size={80} transparent />
                    {invite && <h1 className="text-xl font-black text-slate-900 tracking-tight">{invite.studioName}</h1>}
                </div>

                <div className="bg-white/50 backdrop-blur-xl border border-slate-100 p-8 sm:p-10 rounded-[2.5rem] shadow-2xl shadow-indigo-500/5">
                    {loading ? (
                        <div className="flex items-center justify-center py-10">
                            <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
                        </div>
                    ) : !invite ? (
                        <div className="text-center space-y-4 py-6">
                            <XCircle className="w-12 h-12 text-rose-500 mx-auto" />
                            <p className="text-sm font-bold text-slate-700">ეს მოწვევის ბმული არასწორი ან ვადაგასულია.</p>
                        </div>
                    ) : submitted ? (
                        <div className="text-center space-y-4 py-6">
                            <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
                            <h2 className="text-base font-black text-slate-900">გაგზავნილია!</h2>
                            <p className="text-sm text-slate-500 font-medium">თქვენი ინფორმაცია გადაეგზავნა სტუდიის ადმინისტრატორს დასადასტურებლად. ანგარიში აქტიური გახდება დადასტურების შემდეგ.</p>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-6">
                            <p className="text-sm text-slate-500 font-medium text-center">{invite.email}</p>

                            {error && (
                                <div className="p-4 bg-red-50 border border-red-100 rounded-xl text-[10px] font-black text-red-500 uppercase tracking-tight text-center">{error}</div>
                            )}

                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">სახელი</label>
                                    <div className="relative">
                                        <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                                        <input value={firstName} onChange={e => setFirstName(e.target.value)} required
                                            className="w-full bg-white border border-slate-100 focus:border-indigo-500/50 rounded-2xl pl-11 pr-4 py-3.5 text-sm font-bold text-slate-900 outline-none" />
                                    </div>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">გვარი</label>
                                    <input value={lastName} onChange={e => setLastName(e.target.value)} required
                                        className="w-full bg-white border border-slate-100 focus:border-indigo-500/50 rounded-2xl px-4 py-3.5 text-sm font-bold text-slate-900 outline-none" />
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">ტელეფონი</label>
                                <div className="relative">
                                    <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                                    <input value={phone} onChange={e => setPhone(e.target.value)} required
                                        className="w-full bg-white border border-slate-100 focus:border-indigo-500/50 rounded-2xl pl-11 pr-4 py-3.5 text-sm font-bold text-slate-900 outline-none" />
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">პაროლი</label>
                                <div className="relative">
                                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                                    <input type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} required
                                        className="w-full bg-white border border-slate-100 focus:border-indigo-500/50 rounded-2xl pl-11 pr-12 py-3.5 text-sm font-bold text-slate-900 outline-none" />
                                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300">
                                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                    </button>
                                </div>
                                {password && !passwordPolicy.valid && (
                                    <p className="text-[10px] text-red-500 font-bold pl-1">მინ. 8 სიმბოლო, 1 დიდი ასო, 1 ციფრი, 1 სპეც. სიმბოლო</p>
                                )}
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">გაიმეორეთ პაროლი</label>
                                <input type={showPassword ? 'text' : 'password'} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required
                                    className="w-full bg-white border border-slate-100 focus:border-indigo-500/50 rounded-2xl px-4 py-3.5 text-sm font-bold text-slate-900 outline-none" />
                                {password && confirmPassword && password !== confirmPassword && (
                                    <p className="text-[10px] text-red-500 font-bold pl-1">პაროლები არ ემთხვევა</p>
                                )}
                            </div>

                            <button type="submit" disabled={!canSubmit || submitting}
                                className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black text-sm tracking-widest uppercase flex items-center justify-center gap-3 hover:bg-slate-800 active:scale-[0.98] transition-all disabled:opacity-50">
                                {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'გაგზავნა'}
                            </button>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
}
