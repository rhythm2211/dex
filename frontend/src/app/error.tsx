"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Terminal, RefreshCw, Home, AlertCircle } from "lucide-react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Application error:", error);
  }, [error]);

  return (
    <div className="min-h-screen bg-[#050505] text-slate-200 flex items-center justify-center relative overflow-hidden">
      {/* Background Effects */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-red-500/10 rounded-full blur-[120px] mix-blend-screen" />
        <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-orange-500/5 rounded-full blur-[120px] mix-blend-screen" />
      </div>
      <div className="fixed inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:32px_32px] [mask-image:radial-gradient(ellipse_60%_60%_at_50%_50%,#000_70%,transparent_100%)] pointer-events-none z-0" />

      <div className="relative z-10 text-center px-6 max-w-2xl mx-auto">
        <div className="mb-8">
          <div className="inline-flex items-center justify-center w-24 h-24 rounded-2xl bg-red-500/10 border border-red-500/20 mb-6">
            <AlertCircle size={48} className="text-red-400" />
          </div>
          <h1 className="text-4xl font-bold text-white mb-4">Something went wrong!</h1>
          <p className="text-slate-400 mb-2">
            We encountered an unexpected error. Please try again.
          </p>
          {error.message && (
            <p className="text-sm text-slate-500 mt-4 font-mono bg-white/5 border border-white/10 rounded-lg p-3 text-left">
              {error.message}
            </p>
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
          <button
            onClick={reset}
            className="flex items-center gap-2 px-6 py-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition-all shadow-lg hover:shadow-indigo-500/50"
          >
            <RefreshCw size={18} />
            Try Again
          </button>
          <Link
            href="/"
            className="flex items-center gap-2 px-6 py-3 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 font-semibold transition-all"
          >
            <Home size={18} />
            Go Home
          </Link>
        </div>

        <div className="mt-12 pt-8 border-t border-white/10">
          <Link href="/" className="inline-flex items-center gap-3 group hover:opacity-80 transition-opacity">
            <div className="p-1.5 bg-indigo-500/10 rounded-lg border border-indigo-500/20 shadow-[0_0_15px_rgba(99,102,241,0.2)] group-hover:border-indigo-500/40 transition-colors">
              <Terminal className="text-indigo-500" size={16} />
            </div>
            <span className="text-sm font-bold text-white tracking-widest">DEX</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
