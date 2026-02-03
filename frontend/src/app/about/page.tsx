"use client";

import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { Terminal, LogOut, Rocket, ArrowRight, Layers, Cpu, GitBranch, Users, Activity } from "lucide-react";

// -----------------------------------------------------------------------------
// GLOBAL STYLES (aligned with main page)
// -----------------------------------------------------------------------------
const GlobalStyles = () => (
  <style jsx global>{`
    @keyframes fade-in-up {
      0% { opacity: 0; transform: translateY(16px); }
      100% { opacity: 1; transform: translateY(0); }
    }
    .animate-fade-in { animation: fade-in-up 0.6s ease-out forwards; opacity: 0; }
    .delay-150 { animation-delay: 0.15s; }
    .delay-300 { animation-delay: 0.3s; }
    .cyber-grid {
      background-size: 50px 50px;
      background-image: linear-gradient(to right, rgba(99, 102, 241, 0.03) 1px, transparent 1px),
                        linear-gradient(to bottom, rgba(99, 102, 241, 0.03) 1px, transparent 1px);
      mask-image: radial-gradient(ellipse at center, black 30%, transparent 70%);
    }
  `}</style>
);

export default function AboutPage() {
  const { data: session } = useSession();

  return (
    <div className="min-h-screen bg-[#050505] text-slate-200 overflow-x-hidden relative selection:bg-indigo-500/30 selection:text-white font-sans">
      <GlobalStyles />

      {/* Background (matches main) */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-indigo-900/10 blur-[150px] rounded-full mix-blend-screen opacity-50" />
        <div className="absolute top-[40%] right-[-10%] w-[40%] h-[40%] bg-emerald-900/5 blur-[120px] rounded-full mix-blend-screen opacity-40" />
        <div className="absolute bottom-[-20%] left-[20%] w-[60%] h-[40%] bg-violet-900/10 blur-[150px] rounded-full mix-blend-screen opacity-30" />
        <div className="absolute inset-0 cyber-grid" />
      </div>

      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 border-b border-white/5 bg-[#050505]/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 h-16">
          <Link href="/" className="group inline-flex items-center gap-3">
            <span className="relative flex items-center justify-center h-8 w-8 rounded bg-[#0A0A0A] border border-white/10 group-hover:border-indigo-500/50 transition-colors shadow-[0_0_15px_rgba(0,0,0,0.5)]">
              <Terminal className="text-white relative z-10 group-hover:text-indigo-400 transition-colors" size={16} />
            </span>
            <span className="text-sm font-bold tracking-[0.2em] text-white">DEX</span>
          </Link>
          <div className="hidden md:flex items-center gap-8 text-xs font-medium text-slate-400">
            <Link href="/#how-it-works" className="hover:text-white transition-colors">Methodology</Link>
            <Link href="/#features" className="hover:text-white transition-colors">Features</Link>
            <Link href="/security" className="hover:text-white transition-colors">Security</Link>
            <Link href="/about" className="text-indigo-400 hover:text-indigo-300 transition-colors">About</Link>
          </div>
          <div className="flex items-center gap-4">
            {session?.user ? (
              <div className="flex items-center gap-3 bg-white/5 px-3 py-1.5 rounded-full border border-white/5">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-xs text-slate-300 max-w-[100px] truncate">{session.user.email}</span>
                <button onClick={() => signOut()} className="text-slate-500 hover:text-white ml-1"><LogOut size={12} /></button>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <Link href="/login" className="text-xs font-semibold text-slate-400 hover:text-white transition-colors">Log in</Link>
                <Link href="/signup" className="hidden sm:inline-flex items-center justify-center rounded-lg bg-indigo-600 text-white px-4 py-2 text-xs font-bold hover:bg-indigo-500 transition-all shadow-[0_0_20px_rgba(99,102,241,0.3)] hover:shadow-[0_0_30px_rgba(99,102,241,0.5)]">
                  Public Beta Access
                </Link>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="relative pt-24 pb-20 z-10">
        {/* Hero + Launch CTA */}
        <section className="mx-auto max-w-3xl px-6 pt-28 pb-16 text-center">
          <div className="animate-fade-in text-indigo-400 font-mono text-xs mb-6 flex items-center justify-center gap-2">
            <span className="w-6 h-px bg-indigo-400" /> ABOUT DEX
          </div>
          <h1 className="animate-fade-in delay-150 text-4xl sm:text-5xl font-semibold tracking-tight text-white max-w-2xl mx-auto leading-[1.15] mb-6">
            The intelligence layer for{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-b from-indigo-300 to-slate-400">
              modern codebases
            </span>
          </h1>
          <p className="animate-fade-in delay-150 text-slate-400 text-base sm:text-lg leading-relaxed max-w-xl mx-auto mb-4">
            DEX transforms your repository into a semantic graph—AST, dependencies, and cross-file context—so you can debug, refactor, and onboard at 10x speed with AI that actually understands your code.
          </p>
          <p className="animate-fade-in delay-150 text-slate-500 text-sm max-w-lg mx-auto mb-12">
            Built for engineers who refuse to choose between speed and correctness.
          </p>

          {/* Sign Up/Login CTA */}
          <div className="animate-fade-in delay-300 flex gap-4 justify-center">
            <Link
              href="/signup"
              className="group relative inline-flex items-center justify-center gap-3 rounded-xl bg-white text-black px-10 py-4 text-sm font-bold uppercase tracking-widest transition-all hover:bg-slate-200 hover:shadow-[0_0_50px_rgba(255,255,255,0.25)] shadow-[0_0_30px_rgba(255,255,255,0.12)] overflow-hidden"
            >
              <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
              <Rocket size={18} className="text-black/80 group-hover:scale-110 transition-transform" />
              <span className="relative">Sign Up</span>
              <ArrowRight size={16} className="relative opacity-70 group-hover:translate-x-1 transition-transform" />
            </Link>
            <Link
              href="/login"
              className="group relative inline-flex items-center justify-center gap-3 rounded-xl border border-white/20 bg-white/5 text-white px-10 py-4 text-sm font-bold uppercase tracking-widest transition-all hover:bg-white/10 hover:border-white/30 overflow-hidden"
            >
              <span className="relative">Login</span>
            </Link>
          </div>
        </section>

        {/* Pillars - subtle cards */}
        <section className="mx-auto max-w-4xl px-6 py-8">
          <div className="grid sm:grid-cols-3 gap-4">
            {[
              { icon: GitBranch, label: "Graph-first", desc: "AST & dependency mapping" },
              { icon: Cpu, label: "Context-aware", desc: "Answers grounded in your repo" },
              { icon: Layers, label: "Secure by design", desc: "Local or ephemeral indexing" },
            ].map(({ icon: Icon, label, desc }, i) => (
              <div
                key={i}
                className="p-5 rounded-xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/10 transition-all text-center"
              >
                <div className="w-10 h-10 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-400 mx-auto mb-3">
                  <Icon size={18} />
                </div>
                <div className="text-sm font-semibold text-white">{label}</div>
                <div className="text-xs text-slate-500 mt-1">{desc}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Insights Section */}
        <section className="mx-auto max-w-4xl px-6 py-8">
          <div className="text-center mb-8">
            <div className="text-indigo-400 font-mono text-xs mb-4 flex items-center justify-center gap-2">
              <span className="w-6 h-px bg-indigo-400" /> INSIGHTS
            </div>
            <h2 className="text-2xl font-semibold text-white mb-2">Explore Your Codebase</h2>
            <p className="text-slate-400 text-sm">Visualize team collaboration and repository activity patterns</p>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <Link
              href="/insights/team"
              className="group p-6 rounded-xl border border-white/10 bg-white/[0.02] hover:bg-white/[0.04] hover:border-indigo-500/30 transition-all relative overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
              <div className="relative z-10">
                <div className="w-12 h-12 rounded-lg bg-indigo-500/20 flex items-center justify-center text-indigo-400 mb-4 group-hover:bg-indigo-500/30 transition-colors">
                  <Users size={24} />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2 group-hover:text-indigo-300 transition-colors">Team Network</h3>
                <p className="text-xs text-slate-500 mb-4">Visualize collaboration patterns and developer relationships in your codebase</p>
                <div className="flex items-center gap-2 text-xs text-indigo-400 font-medium">
                  View Network <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            </Link>
            <Link
              href="/insights/activity"
              className="group p-6 rounded-xl border border-white/10 bg-white/[0.02] hover:bg-white/[0.04] hover:border-indigo-500/30 transition-all relative overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
              <div className="relative z-10">
                <div className="w-12 h-12 rounded-lg bg-indigo-500/20 flex items-center justify-center text-indigo-400 mb-4 group-hover:bg-indigo-500/30 transition-colors">
                  <Activity size={24} />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2 group-hover:text-indigo-300 transition-colors">Repository Activity</h3>
                <p className="text-xs text-slate-500 mb-4">Identify high-churn areas and hotspots in your codebase</p>
                <div className="flex items-center gap-2 text-xs text-indigo-400 font-medium">
                  View Activity <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            </Link>
          </div>
        </section>

        {/* Secondary Launch CTA at bottom */}
        <section className="mx-auto max-w-2xl px-6 pt-8 pb-6 text-center">
          <div className="rounded-2xl border border-white/10 bg-[#0F0F10]/80 p-8">
            <p className="text-slate-400 text-sm mb-6">Ready to explore your codebase with full context?</p>
            <Link
              href="/signup"
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 px-6 py-3 text-xs font-bold uppercase tracking-widest text-slate-200 hover:bg-white/10 hover:text-white hover:border-indigo-500/30 transition-all"
            >
              Get Started <ArrowRight size={14} />
            </Link>
          </div>
        </section>
      </main>

      {/* Footer (minimal, matches main) */}
      <footer className="border-t border-white/5 bg-[#020202] py-8">
        <div className="mx-auto max-w-6xl px-6 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="w-5 h-5 bg-slate-800 rounded flex items-center justify-center"><Terminal size={10} /></span>
            <span className="font-bold text-white text-sm">DEX</span>
          </div>
          <div className="flex gap-6 text-xs text-slate-500">
            <Link href="/" className="hover:text-indigo-400 transition-colors">Home</Link>
            <Link href="/#features" className="hover:text-indigo-400 transition-colors">Features</Link>
            <Link href="/signup" className="hover:text-indigo-400 transition-colors">Sign up</Link>
            <Link href="/grievance" className="hover:text-indigo-400 transition-colors">Contact</Link>
          </div>
        </div>
        <div className="mx-auto max-w-6xl px-6 pt-4 border-t border-white/5 mt-4">
          <div className="text-center text-[10px] text-slate-600">
            © 2024 Dex Inc. All rights reserved. | Developed by Rhythm Suthar 2026
          </div>
        </div>
      </footer>
    </div>
  );
}
