"use client";

import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { 
  Terminal, LogOut, ShieldCheck, Lock, Database, GitBranch, Code, 
  ArrowRight, Github, GitCommit, GitMerge, GitPullRequest, TreePine, 
  MessageSquare, GitCompare, Upload, Download, AlertTriangle,
  Eye, Key, Server, Network, Layers
} from "lucide-react";

// -----------------------------------------------------------------------------
// GLOBAL STYLES (aligned with main page)
// -----------------------------------------------------------------------------
const GlobalStyles = () => (
  <style jsx global>{`
    @keyframes fade-in-up {
      0% { opacity: 0; transform: translateY(16px); }
      100% { opacity: 1; transform: translateY(0); }
    }
    @keyframes fade-in-scale {
      0% { opacity: 0; transform: scale(0.95); }
      100% { opacity: 1; transform: scale(1); }
    }
    @keyframes float {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(-10px); }
    }
    @keyframes pulse-glow {
      0%, 100% { opacity: 0.3; }
      50% { opacity: 0.6; }
    }
    @keyframes commit-pulse {
      0%, 100% { opacity: 0.4; transform: scale(1); }
      50% { opacity: 1; transform: scale(1.1); }
    }
    @keyframes tree-grow {
      0% { transform: scaleY(0); opacity: 0; }
      100% { transform: scaleY(1); opacity: 1; }
    }
    @keyframes push-pull {
      0%, 100% { transform: translateX(0); }
      50% { transform: translateX(8px); }
    }
    .animate-fade-in { animation: fade-in-up 0.6s ease-out forwards; opacity: 0; }
    .delay-150 { animation-delay: 0.15s; }
    .delay-300 { animation-delay: 0.3s; }
    .delay-450 { animation-delay: 0.45s; }
    .animate-float { animation: float 6s ease-in-out infinite; }
    .animate-pulse-glow { animation: pulse-glow 3s ease-in-out infinite; }
    .animate-commit-pulse { animation: commit-pulse 2s ease-in-out infinite; }
    .animate-push-pull { animation: push-pull 2s ease-in-out infinite; }
    .cyber-grid {
      background-size: 50px 50px;
      background-image: linear-gradient(to right, rgba(99, 102, 241, 0.03) 1px, transparent 1px),
                        linear-gradient(to bottom, rgba(99, 102, 241, 0.03) 1px, transparent 1px);
      mask-image: radial-gradient(ellipse at center, black 30%, transparent 70%);
    }
    .hover-lift {
      transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    }
    .hover-lift:hover {
      transform: translateY(-4px);
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4);
    }
    .gradient-text {
      background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #ec4899 100%);
      background-size: 200% 200%;
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }
  `}</style>
);

// -----------------------------------------------------------------------------
// COMPONENT: GITHUB SECURITY VISUALIZATION
// -----------------------------------------------------------------------------
const GitHubSecurityVisual = () => {
  return (
    <div className="relative w-full rounded-xl border border-white/10 bg-[#0A0A0A] p-6 overflow-hidden">
      <div className="flex items-center gap-2 mb-4">
        <Github size={18} className="text-indigo-400" />
        <h3 className="text-sm font-semibold text-white">GitHub Integration Security</h3>
      </div>
      <div className="relative h-48">
        <svg className="w-full h-full" viewBox="0 0 300 200" style={{ overflow: 'visible' }}>
          {/* Repository layers */}
          <rect x="50" y="30" width="200" height="140" rx="8" fill="rgba(99, 102, 241, 0.1)" stroke="rgba(99, 102, 241, 0.3)" strokeWidth="2" />
          <rect x="70" y="50" width="160" height="100" rx="6" fill="rgba(139, 92, 246, 0.15)" stroke="rgba(139, 92, 246, 0.4)" strokeWidth="1.5" />
          
          {/* GitHub icon in center */}
          <g transform="translate(150, 100)">
            <circle cx="0" cy="0" r="20" fill="rgba(99, 102, 241, 0.3)" className="animate-pulse-glow" />
            <Github size={24} className="text-indigo-400" style={{ transform: 'translate(-12px, -12px)' }} />
          </g>
          
          {/* Security nodes */}
          <circle cx="80" cy="40" r="4" fill="#6366f1" className="animate-commit-pulse" />
          <circle cx="220" cy="40" r="4" fill="#8b5cf6" className="animate-commit-pulse" style={{ animationDelay: '0.5s' }} />
          <circle cx="80" cy="160" r="4" fill="#ec4899" className="animate-commit-pulse" style={{ animationDelay: '1s' }} />
          <circle cx="220" cy="160" r="4" fill="#6366f1" className="animate-commit-pulse" style={{ animationDelay: '1.5s' }} />
          
          {/* Branch lines */}
          <line x1="150" y1="80" x2="100" y2="50" stroke="rgba(99, 102, 241, 0.4)" strokeWidth="2" strokeDasharray="4,4" />
          <line x1="150" y1="80" x2="200" y2="50" stroke="rgba(139, 92, 246, 0.4)" strokeWidth="2" strokeDasharray="4,4" />
        </svg>
      </div>
      <p className="text-xs text-slate-500 mt-4">
        Secure OAuth connection with read-only repository access
      </p>
    </div>
  );
};

// -----------------------------------------------------------------------------
// COMPONENT: DEPENDENCY TREE SECURITY VISUAL
// -----------------------------------------------------------------------------
const DependencyTreeSecurityVisual = () => {
  return (
    <div className="relative w-full h-full rounded-xl border border-white/10 bg-[#0A0A0A] p-6 overflow-hidden">
      <div className="flex items-center gap-2 mb-4">
        <TreePine size={18} className="text-emerald-400" />
        <h3 className="text-sm font-semibold text-white">Secure Dependency Mapping</h3>
      </div>
      <div className="relative h-48">
        <svg className="w-full h-full" viewBox="0 0 300 200" style={{ overflow: 'visible' }}>
          {/* Root node */}
          <circle cx="150" cy="20" r="12" fill="#6366f1" className="opacity-0 animate-[fade-in-scale_0.5s_ease-out_0.1s_forwards]" />
          <text x="150" y="45" textAnchor="middle" fill="#e2e8f0" fontSize="10" className="font-mono">app.tsx</text>
          
          {/* Level 1 nodes */}
          <line x1="150" y1="32" x2="80" y2="80" stroke="rgba(99, 102, 241, 0.4)" strokeWidth="2" className="opacity-0 animate-[tree-grow_0.6s_ease-out_0.2s_forwards]" />
          <line x1="150" y1="32" x2="150" y2="80" stroke="rgba(99, 102, 241, 0.4)" strokeWidth="2" className="opacity-0 animate-[tree-grow_0.6s_ease-out_0.3s_forwards]" />
          <line x1="150" y1="32" x2="220" y2="80" stroke="rgba(99, 102, 241, 0.4)" strokeWidth="2" className="opacity-0 animate-[tree-grow_0.6s_ease-out_0.4s_forwards]" />
          
          <circle cx="80" cy="80" r="10" fill="#8b5cf6" className="opacity-0 animate-[fade-in-scale_0.5s_ease-out_0.5s_forwards]" />
          <text x="80" y="100" textAnchor="middle" fill="#cbd5e1" fontSize="9" className="font-mono">api.ts</text>
          
          <circle cx="150" cy="80" r="10" fill="#8b5cf6" className="opacity-0 animate-[fade-in-scale_0.5s_ease-out_0.6s_forwards]" />
          <text x="150" y="100" textAnchor="middle" fill="#cbd5e1" fontSize="9" className="font-mono">utils.ts</text>
          
          <circle cx="220" cy="80" r="10" fill="#8b5cf6" className="opacity-0 animate-[fade-in-scale_0.5s_ease-out_0.7s_forwards]" />
          <text x="220" y="100" textAnchor="middle" fill="#cbd5e1" fontSize="9" className="font-mono">types.ts</text>
          
          {/* Security lock icons */}
          <g transform="translate(75, 75)">
            <Lock size={8} className="text-emerald-400" style={{ transform: 'translate(-4px, -4px)' }} />
          </g>
          <g transform="translate(145, 75)">
            <Lock size={8} className="text-emerald-400" style={{ transform: 'translate(-4px, -4px)' }} />
          </g>
        </svg>
      </div>
      <p className="text-xs text-slate-500 mt-4">
        Encrypted dependency graph processing with no code storage
      </p>
    </div>
  );
};

// -----------------------------------------------------------------------------
// COMPONENT: PUSH/PULL/COMMIT VISUALIZATION
// -----------------------------------------------------------------------------
const PushPullCommitVisual = () => {
  return (
    <div className="relative w-full rounded-xl border border-white/10 bg-[#0A0A0A] p-6">
      <div className="flex items-center gap-2 mb-4">
        <GitBranch size={18} className="text-purple-400" />
        <h3 className="text-sm font-semibold text-white">Secure Code Flow</h3>
      </div>
      <div className="space-y-3 font-mono text-xs">
        <div className="flex items-center gap-3 p-3 rounded-lg bg-white/5 border border-white/5">
          <Upload size={14} className="text-indigo-400 animate-push-pull" />
          <span className="text-slate-300">Push → Encrypted Webhook</span>
        </div>
        <div className="flex items-center gap-3 p-3 rounded-lg bg-white/5 border border-white/5 ml-4">
          <GitCommit size={14} className="text-purple-400 animate-commit-pulse" style={{ animationDelay: '0.3s' }} />
          <span className="text-slate-300">Commit → AST Parsing</span>
        </div>
        <div className="flex items-center gap-3 p-3 rounded-lg bg-white/5 border border-white/5 ml-8">
          <GitMerge size={14} className="text-pink-400" style={{ animationDelay: '0.6s' }} />
          <span className="text-slate-300">Merge → Dependency Update</span>
        </div>
        <div className="flex items-center gap-3 p-3 rounded-lg bg-white/5 border border-white/5 ml-12">
          <Download size={14} className="text-emerald-400 animate-push-pull" style={{ animationDelay: '1s' }} />
          <span className="text-slate-300">Pull → Ephemeral Processing</span>
        </div>
        <div className="flex items-center gap-3 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 ml-16">
          <CheckCircle size={14} className="text-emerald-400" />
          <span className="text-emerald-300">No persistent code storage</span>
        </div>
      </div>
    </div>
  );
};

// -----------------------------------------------------------------------------
// COMPONENT: CHATBOT SECURITY VISUAL
// -----------------------------------------------------------------------------
const ChatbotSecurityVisual = () => {
  return (
    <div className="w-full rounded-xl border border-white/10 bg-[#0A0A0A] p-6">
      <div className="flex items-center gap-2 mb-4">
        <MessageSquare size={18} className="text-indigo-400" />
        <h3 className="text-sm font-semibold text-white">AI Assistant Security</h3>
        <div className="ml-auto flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
          <span className="text-xs text-slate-500">Secure</span>
        </div>
      </div>
      <div className="space-y-3 font-mono text-xs">
        <div className="flex justify-end">
          <div className="bg-indigo-600/20 border border-indigo-500/30 text-indigo-100 px-3 py-2 rounded-l-lg rounded-tr-lg max-w-[85%]">
            How does authentication work?
          </div>
        </div>
        <div className="flex justify-start relative">
          <div className="absolute -left-2 top-0 bottom-0 w-1 bg-gradient-to-b from-indigo-500 to-transparent opacity-50"></div>
          <div className="pl-3 text-slate-300 max-w-[90%] space-y-2">
            <p>Based on <span className="text-emerald-400 underline decoration-dotted underline-offset-2">src/auth/middleware.ts</span></p>
            <div className="bg-[#020202] border border-white/10 p-2 rounded text-slate-400">
              <span className="text-purple-400">JWT</span> tokens verified...
            </div>
            <div className="flex items-center gap-2 mt-2 pt-2 border-t border-white/5">
              <ShieldCheck size={10} className="text-emerald-400" />
              <span className="text-[10px] text-emerald-400">Context encrypted in transit</span>
            </div>
          </div>
        </div>
      </div>
      <div className="mt-4 pt-4 border-t border-white/5">
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <Lock size={12} />
          <span>End-to-end encryption</span>
          <span className="mx-2">•</span>
          <Eye size={12} />
          <span>No code logging</span>
        </div>
      </div>
    </div>
  );
};

const CheckCircle = ({ size, className }: { size: number; className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
    <path d="M8 12l2 2 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

export default function SecurityPage() {
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
            <Link href="/security" className="hover:text-white transition-colors text-white">Security</Link>
            <Link href="/about" className="hover:text-white transition-colors">About</Link>
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
        {/* Hero Section */}
        <section className="mx-auto max-w-4xl px-6 pt-28 pb-16 text-center">
          <div className="animate-fade-in text-indigo-400 font-mono text-xs mb-6 flex items-center justify-center gap-2">
            <span className="w-6 h-px bg-indigo-400" /> SECURITY & COMPLIANCE
          </div>
          <h1 className="animate-fade-in delay-150 text-4xl sm:text-5xl font-semibold tracking-tight text-white max-w-3xl mx-auto leading-[1.15] mb-6">
            Your Codebase is{" "}
            <span className="gradient-text">Protected</span>
          </h1>
          <p className="animate-fade-in delay-150 text-slate-400 text-base sm:text-lg leading-relaxed max-w-2xl mx-auto mb-4">
            Enterprise-grade security for your intellectual property. We never store your code, and all processing happens in encrypted, ephemeral environments.
          </p>
          <p className="animate-fade-in delay-300 text-slate-500 text-sm max-w-xl mx-auto">
            Last updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </section>

        {/* Visual Section */}
        <section className="mx-auto max-w-6xl px-6 py-8">
          <div className="grid md:grid-cols-2 gap-6 mb-12">
            <GitHubSecurityVisual />
            <DependencyTreeSecurityVisual />
          </div>
          <div className="grid md:grid-cols-2 gap-6 mb-12">
            <PushPullCommitVisual />
            <ChatbotSecurityVisual />
          </div>
        </section>

        {/* Content Sections */}
        <section className="mx-auto max-w-4xl px-6 pb-16">
          <div className="space-y-12">
            
            {/* Section 1 */}
            <div className="animate-fade-in delay-150 rounded-2xl border border-white/10 bg-[#0F0F10]/50 p-8 hover-lift">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-lg bg-indigo-500/20 flex items-center justify-center text-indigo-400">
                  <Github size={20} />
                </div>
                <h2 className="text-2xl font-semibold text-white">1. GitHub Integration Security</h2>
              </div>
              <div className="space-y-4 text-slate-300 text-sm leading-relaxed">
                <p>
                  DEX connects to your GitHub repositories using OAuth 2.0 with minimal, read-only permissions. We never request write access or the ability to modify your code.
                </p>
                <div className="grid sm:grid-cols-2 gap-4 mt-4">
                  <div className="p-4 rounded-lg bg-white/5 border border-white/5">
                    <Key size={16} className="text-indigo-400 mb-2" />
                    <h4 className="text-white font-semibold mb-1">OAuth 2.0</h4>
                    <p className="text-xs text-slate-400">Industry-standard authentication protocol</p>
                  </div>
                  <div className="p-4 rounded-lg bg-white/5 border border-white/5">
                    <Eye size={16} className="text-purple-400 mb-2" />
                    <h4 className="text-white font-semibold mb-1">Read-Only Access</h4>
                    <p className="text-xs text-slate-400">We can only read, never modify your code</p>
                  </div>
                  <div className="p-4 rounded-lg bg-white/5 border border-white/5">
                    <GitBranch size={16} className="text-emerald-400 mb-2" />
                    <h4 className="text-white font-semibold mb-1">Branch Tracking</h4>
                    <p className="text-xs text-slate-400">Secure monitoring of commits and merges</p>
                  </div>
                  <div className="p-4 rounded-lg bg-white/5 border border-white/5">
                    <GitPullRequest size={16} className="text-yellow-400 mb-2" />
                    <h4 className="text-white font-semibold mb-1">Webhook Security</h4>
                    <p className="text-xs text-slate-400">Encrypted webhook payloads for real-time updates</p>
                  </div>
                </div>
                <p className="mt-4 text-xs text-slate-500">
                  You can revoke access at any time from your GitHub settings, and all associated data will be immediately deleted.
                </p>
              </div>
            </div>

            {/* Section 2 */}
            <div className="animate-fade-in delay-300 rounded-2xl border border-white/10 bg-[#0F0F10]/50 p-8 hover-lift">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center text-emerald-400">
                  <Lock size={20} />
                </div>
                <h2 className="text-2xl font-semibold text-white">2. Code Processing & Storage</h2>
              </div>
              <div className="space-y-4 text-slate-300 text-sm leading-relaxed">
                <p className="mb-4">
                  Your code is processed in ephemeral, encrypted environments. We never store your source code permanently.
                </p>
                <div className="space-y-3">
                  <div className="flex items-start gap-3 p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                    <CheckCircle size={18} className="text-emerald-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <h4 className="text-white font-semibold mb-1">Ephemeral Processing</h4>
                      <p className="text-xs text-slate-400">Code is processed in temporary containers that are destroyed immediately after analysis completes.</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-4 rounded-lg bg-indigo-500/10 border border-indigo-500/20">
                    <Database size={18} className="text-indigo-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <h4 className="text-white font-semibold mb-1">No Code Storage</h4>
                      <p className="text-xs text-slate-400">We only store metadata (file paths, dependency relationships, AST structures) - never your actual source code.</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-4 rounded-lg bg-purple-500/10 border border-purple-500/20">
                    <Server size={18} className="text-purple-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <h4 className="text-white font-semibold mb-1">Encrypted Transit</h4>
                      <p className="text-xs text-slate-400">All data transmission uses TLS 1.3 encryption. Code is encrypted in transit and at rest during processing.</p>
                    </div>
                  </div>
                </div>
                <p className="mt-4 text-xs text-slate-500">
                  When you disconnect a repository, all associated metadata is permanently deleted within 24 hours.
                </p>
              </div>
            </div>

            {/* Section 3 */}
            <div className="animate-fade-in delay-450 rounded-2xl border border-white/10 bg-[#0F0F10]/50 p-8 hover-lift">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center text-purple-400">
                  <TreePine size={20} />
                </div>
                <h2 className="text-2xl font-semibold text-white">3. Dependency Graph Security</h2>
              </div>
              <div className="space-y-4 text-slate-300 text-sm leading-relaxed">
                <div>
                  <h3 className="text-lg font-semibold text-white mb-2">AST & Dependency Analysis</h3>
                  <p className="mb-3">
                    DEX builds Abstract Syntax Trees (AST) and dependency graphs from your codebase. This analysis happens securely:
                  </p>
                  <ul className="list-disc list-inside space-y-2 ml-4 text-slate-400">
                    <li>AST parsing occurs in isolated, sandboxed environments</li>
                    <li>Dependency relationships are extracted without storing code content</li>
                    <li>Graph structures are stored encrypted and can be deleted on demand</li>
                    <li>No external network access during code analysis</li>
                  </ul>
                </div>
                <div className="mt-6">
                  <h3 className="text-lg font-semibold text-white mb-2">Vector Embeddings</h3>
                  <p className="mb-3">
                    Code embeddings are generated for semantic search:
                  </p>
                  <ul className="list-disc list-inside space-y-2 ml-4 text-slate-400">
                    <li>Embeddings are derived from AST structures, not raw code</li>
                    <li>Stored separately from any code identifiers</li>
                    <li>Cannot be reverse-engineered to reconstruct source code</li>
                    <li>Automatically purged when repository is disconnected</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Section 4 */}
            <div className="animate-fade-in delay-150 rounded-2xl border border-white/10 bg-[#0F0F10]/50 p-8 hover-lift">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-lg bg-yellow-500/20 flex items-center justify-center text-yellow-400">
                  <MessageSquare size={20} />
                </div>
                <h2 className="text-2xl font-semibold text-white">4. AI Assistant Security</h2>
              </div>
              <div className="space-y-4 text-slate-300 text-sm leading-relaxed">
                <p className="mb-4">
                  The AI chatbot provides context-aware answers without exposing your code:
                </p>
                <div className="space-y-3">
                  <div className="p-4 rounded-lg bg-white/5 border border-white/5">
                    <h4 className="text-white font-semibold mb-2">Context Isolation</h4>
                    <p className="text-xs text-slate-400">Each query is processed in isolation. No conversation history is stored, and context is cleared after each response.</p>
                  </div>
                  <div className="p-4 rounded-lg bg-white/5 border border-white/5">
                    <h4 className="text-white font-semibold mb-2">No Code Logging</h4>
                    <p className="text-xs text-slate-400">We never log your code, queries, or AI responses. All interactions are ephemeral and non-persistent.</p>
                  </div>
                  <div className="p-4 rounded-lg bg-white/5 border border-white/5">
                    <h4 className="text-white font-semibold mb-2">Secure AI Providers</h4>
                    <p className="text-xs text-slate-400">We use enterprise-grade AI providers with data processing agreements that prohibit training on your code.</p>
                  </div>
                </div>
                <div className="p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/20 mt-4">
                  <div className="flex items-start gap-3">
                    <AlertTriangle size={18} className="text-yellow-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <h4 className="text-white font-semibold mb-1">Important</h4>
                      <p className="text-xs text-slate-400">While we take every precaution, you should never share sensitive credentials, API keys, or proprietary algorithms through the chatbot interface.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Section 5 */}
            <div className="animate-fade-in delay-300 rounded-2xl border border-white/10 bg-[#0F0F10]/50 p-8 hover-lift">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-lg bg-indigo-500/20 flex items-center justify-center text-indigo-400">
                  <ShieldCheck size={20} />
                </div>
                <h2 className="text-2xl font-semibold text-white">5. Compliance & Certifications</h2>
              </div>
              <div className="space-y-4 text-slate-300 text-sm leading-relaxed">
                <div>
                  <h3 className="text-lg font-semibold text-white mb-2">SOC 2 Type II</h3>
                  <p className="mb-3">
                    DEX is SOC 2 Type II compliant, ensuring that our security controls are independently audited and verified.
                  </p>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white mb-2">GDPR & CCPA</h3>
                  <p className="mb-3">
                    We comply with GDPR and CCPA regulations. You have the right to:
                  </p>
                  <ul className="list-disc list-inside space-y-2 ml-4 text-slate-400">
                    <li>Access all data we store about your account</li>
                    <li>Request deletion of your data at any time</li>
                    <li>Export your dependency graphs and metadata</li>
                    <li>Opt out of data processing</li>
                  </ul>
                </div>
                <div className="mt-6">
                  <h3 className="text-lg font-semibold text-white mb-2">VPC Peering Available</h3>
                  <p className="mb-3">
                    For enterprise customers, we offer VPC peering to ensure your code never traverses public networks.
                  </p>
                </div>
              </div>
            </div>

            {/* Section 6 */}
            <div className="animate-fade-in delay-450 rounded-2xl border border-white/10 bg-[#0F0F10]/50 p-8 hover-lift">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-lg bg-red-500/20 flex items-center justify-center text-red-400">
                  <Network size={20} />
                </div>
                <h2 className="text-2xl font-semibold text-white">6. Infrastructure Security</h2>
              </div>
              <div className="space-y-4 text-slate-300 text-sm leading-relaxed">
                <p className="mb-4">
                  Our infrastructure is built on industry-leading cloud providers with enterprise-grade security:
                </p>
                <div className="grid sm:grid-cols-2 gap-4 mt-4">
                  <div className="p-4 rounded-lg bg-white/5 border border-white/5">
                    <Layers size={16} className="text-indigo-400 mb-2" />
                    <h4 className="text-white font-semibold mb-1">Container Isolation</h4>
                    <p className="text-xs text-slate-400">Each codebase is processed in isolated containers with no shared resources</p>
                  </div>
                  <div className="p-4 rounded-lg bg-white/5 border border-white/5">
                    <Server size={16} className="text-purple-400 mb-2" />
                    <h4 className="text-white font-semibold mb-1">Network Segmentation</h4>
                    <p className="text-xs text-slate-400">Processing environments are isolated from public networks</p>
                  </div>
                  <div className="p-4 rounded-lg bg-white/5 border border-white/5">
                    <Key size={16} className="text-emerald-400 mb-2" />
                    <h4 className="text-white font-semibold mb-1">Key Management</h4>
                    <p className="text-xs text-slate-400">All encryption keys are managed through AWS KMS or equivalent</p>
                  </div>
                  <div className="p-4 rounded-lg bg-white/5 border border-white/5">
                    <ShieldCheck size={16} className="text-yellow-400 mb-2" />
                    <h4 className="text-white font-semibold mb-1">Regular Audits</h4>
                    <p className="text-xs text-slate-400">Third-party security audits conducted quarterly</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Section 7 */}
            <div className="animate-fade-in delay-150 rounded-2xl border border-white/10 bg-[#0F0F10]/50 p-8 hover-lift">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center text-emerald-400">
                  <CheckCircle size={20} />
                </div>
                <h2 className="text-2xl font-semibold text-white">7. Data Retention & Deletion</h2>
              </div>
              <div className="space-y-4 text-slate-300 text-sm leading-relaxed">
                <p className="mb-4">
                  We believe in data minimization. Here's what we store and for how long:
                </p>
                <div className="space-y-3">
                  <div className="p-4 rounded-lg bg-white/5 border border-white/5">
                    <h4 className="text-white font-semibold mb-2">Metadata Only</h4>
                    <p className="text-xs text-slate-400">We store file paths, dependency relationships, and AST structures - never your source code.</p>
                  </div>
                  <div className="p-4 rounded-lg bg-white/5 border border-white/5">
                    <h4 className="text-white font-semibold mb-2">Immediate Deletion</h4>
                    <p className="text-xs text-slate-400">When you disconnect a repository, all associated data is deleted within 24 hours.</p>
                  </div>
                  <div className="p-4 rounded-lg bg-white/5 border border-white/5">
                    <h4 className="text-white font-semibold mb-2">Account Deletion</h4>
                    <p className="text-xs text-slate-400">Deleting your account permanently removes all data within 30 days, with no recovery option.</p>
                  </div>
                </div>
                <p className="mt-4 text-xs text-slate-500">
                  You can request a data export or immediate deletion at any time by contacting support.
                </p>
              </div>
            </div>

            {/* Section 8 */}
            <div className="animate-fade-in delay-300 rounded-2xl border border-white/10 bg-[#0F0F10]/50 p-8 hover-lift">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-lg bg-yellow-500/20 flex items-center justify-center text-yellow-400">
                  <AlertTriangle size={20} />
                </div>
                <h2 className="text-2xl font-semibold text-white">8. Security Best Practices</h2>
              </div>
              <div className="space-y-4 text-slate-300 text-sm leading-relaxed">
                <p className="mb-4">
                  While we handle security on our end, here's what you can do to protect your codebase:
                </p>
                <ul className="list-disc list-inside space-y-2 ml-4 text-slate-400">
                  <li>Never commit API keys, passwords, or secrets to your repository</li>
                  <li>Use environment variables for sensitive configuration</li>
                  <li>Review and limit OAuth permissions granted to DEX</li>
                  <li>Regularly audit which repositories are connected</li>
                  <li>Use branch protection rules to prevent unauthorized code changes</li>
                  <li>Enable two-factor authentication on your GitHub account</li>
                </ul>
                <div className="p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/20 mt-4">
                  <div className="flex items-start gap-3">
                    <AlertTriangle size={18} className="text-yellow-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <h4 className="text-white font-semibold mb-1">Responsible Disclosure</h4>
                      <p className="text-xs text-slate-400">If you discover a security vulnerability, please report it to security@dex.ai. We offer a bug bounty program for responsible disclosures.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Contact Section */}
            <div className="animate-fade-in delay-450 rounded-2xl border border-indigo-500/30 bg-indigo-500/5 p-8 text-center">
              <h2 className="text-2xl font-semibold text-white mb-4">Questions About Security?</h2>
              <p className="text-slate-400 text-sm mb-6 max-w-xl mx-auto">
                Our security team is available to answer questions, provide security documentation, or discuss enterprise security requirements.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link
                  href="mailto:security@dex.ai"
                  className="inline-flex items-center gap-2 rounded-xl bg-white text-black px-6 py-3 text-xs font-bold uppercase tracking-widest hover:bg-slate-200 transition-all shadow-[0_0_30px_rgba(255,255,255,0.15)] hover:shadow-[0_0_40px_rgba(255,255,255,0.25)] hover:scale-105"
                >
                  Contact Security Team
                  <ArrowRight size={14} />
                </Link>
                <Link
                  href="/grievance"
                  className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-6 py-3 text-xs font-bold uppercase tracking-widest text-slate-300 hover:bg-white/10 hover:text-white hover:border-indigo-500/30 transition-all"
                >
                  Report Vulnerability
                </Link>
              </div>
            </div>

          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/5 bg-[#020202] py-8">
        <div className="mx-auto max-w-6xl px-6 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="w-5 h-5 bg-slate-800 rounded flex items-center justify-center"><Terminal size={10} /></span>
            <span className="font-bold text-white text-sm">DEX</span>
          </div>
          <div className="flex gap-6 text-xs text-slate-500">
            <Link href="/" className="hover:text-indigo-400 transition-colors">Home</Link>
            <Link href="/privacy" className="hover:text-indigo-400 transition-colors">Privacy</Link>
            <Link href="/terms" className="hover:text-indigo-400 transition-colors">Terms</Link>
            <Link href="/security" className="text-indigo-400 hover:text-indigo-300 transition-colors">Security</Link>
            <Link href="/grievance" className="hover:text-indigo-400 transition-colors">Contact</Link>
          </div>
        </div>
        <div className="mx-auto max-w-6xl px-6 pt-4 border-t border-white/5 mt-4">
          <div className="text-center text-[10px] text-slate-600">
            © 2026 Dex Inc. All rights reserved. | Developed by Rhythm Suthar 2026
          </div>
        </div>
      </footer>
    </div>
  );
}
