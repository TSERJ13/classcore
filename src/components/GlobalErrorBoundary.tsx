'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
    children: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

export class GlobalErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('Uncaught error:', error, errorInfo);
    }

    public render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen bg-white p-10 font-sans">
                    <div className="max-w-2xl mx-auto">
                        <h1 className="text-3xl font-black text-rose-600 mb-4">Application Crash</h1>
                        <div className="bg-rose-50 border border-rose-100 p-6 rounded-3xl mb-8">
                            <p className="font-bold text-rose-900 mb-2">Error Details:</p>
                            <pre className="text-xs font-mono text-rose-700 whitespace-pre-wrap">
                                {this.state.error?.stack || this.state.error?.message || String(this.state.error)}
                            </pre>
                        </div>
                        <button
                            onClick={() => window.location.reload()}
                            className="px-8 py-3 bg-indigo-600 text-white font-bold rounded-2xl hover:bg-indigo-700 transition-all"
                        >
                            Try Again
                        </button>
                        <p className="mt-6 text-sm text-slate-400">
                            If this persists, please contact support with the error details above.
                        </p>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}
