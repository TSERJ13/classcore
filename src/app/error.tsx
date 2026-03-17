'use client';

import { useEffect } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import Link from 'next/link';

export default function Error({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error('Root error:', error);
    }, [error]);

    return (
        <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 text-center">
            <div className="w-20 h-20 bg-red-500/10 rounded-[2rem] flex items-center justify-center text-red-500 mb-8 animate-bounce-subtle">
                <AlertTriangle className="w-10 h-10" />
            </div>

            <h1 className="text-3xl font-black text-slate-900 tracking-tight mb-4">
                Oops! Something went wrong.
            </h1>

            <p className="text-slate-500 font-medium max-w-md mx-auto mb-10 leading-relaxed">
                We've encountered an unexpected error. Don't worry, your data is safe.
                Try refreshing the page or going back home.
            </p>

            <div className="flex flex-col sm:flex-row items-center gap-4 w-full max-w-xs">
                <button
                    onClick={() => reset()}
                    className="w-full flex items-center justify-center gap-2 py-4 bg-indigo-600 text-white rounded-2xl font-black text-sm shadow-xl shadow-indigo-600/20 hover:bg-indigo-700 active:scale-95 transition-all"
                >
                    <RefreshCw className="w-4 h-4" /> Try Again
                </button>

                <Link
                    href="/"
                    className="w-full flex items-center justify-center gap-2 py-4 bg-slate-100 text-slate-700 rounded-2xl font-black text-sm hover:bg-slate-200 active:scale-95 transition-all"
                >
                    <Home className="w-4 h-4" /> Go Home
                </Link>
            </div>

            {error.digest && (
                <p className="mt-10 text-[10px] font-mono text-slate-300 uppercase tracking-widest">
                    Error ID: {error.digest}
                </p>
            )}
        </div>
    );
}
