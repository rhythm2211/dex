"use client";

import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { Terminal, LogOut, FileText, AlertTriangle, GitBranch, Code, Scale, ShieldCheck, ArrowRight } from "lucide-react";

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
    .animate-fade-in { animation: fade-in-up 0.6s ease-out forwards; opacity: 0; }
    .delay-150 { animation-delay: 0.15s; }
    .delay-300 { animation-delay: 0.3s; }
    .delay-450 { animation-delay: 0.45s; }
    .animate-float { animation: float 6s ease-in-out infinite; }
    .animate-pulse-glow { animation: pulse-glow 3s ease-in-out infinite; }
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
// COMPONENT: TERMS VISUALIZATION
// -----------------------------------------------------------------------------
const TermsVisual = () => {
  return (
    <div className="relative w-full rounded-xl border border-white/10 bg-[#0A0A0A] p-6 overflow-hidden">
      <div className="flex items-center gap-2 mb-4">
        <Scale size={18} className="text-indigo-400" />
        <h3 className="text-sm font-semibold text-white">Service Agreement</h3>
      </div>
      <div className="relative h-48">
        <svg className="w-full h-full" viewBox="0 0 300 200" style={{ overflow: 'visible' }}>
          {/* Agreement layers */}
          <rect x="50" y="30" width="200" height="140" rx="8" fill="rgba(99, 102, 241, 0.1)" stroke="rgba(99, 102, 241, 0.3)" strokeWidth="2" />
          <rect x="70" y="50" width="160" height="100" rx="6" fill="rgba(139, 92, 246, 0.15)" stroke="rgba(139, 92, 246, 0.4)" strokeWidth="1.5" />
          <rect x="90" y="70" width="120" height="60" rx="4" fill="rgba(236, 72, 153, 0.2)" stroke="rgba(236, 72, 153, 0.5)" strokeWidth="1" />
          
          {/* Document icon in center */}
          <g transform="translate(150, 100)">
            <circle cx="0" cy="0" r="20" fill="rgba(99, 102, 241, 0.3)" className="animate-pulse-glow" />
            <FileText size={24} className="text-indigo-400" style={{ transform: 'translate(-12px, -12px)' }} />
          </g>
          
          {/* Agreement nodes */}
          <circle cx="80" cy="40" r="4" fill="#6366f1" className="animate-pulse" />
          <circle cx="220" cy="40" r="4" fill="#8b5cf6" className="animate-pulse" style={{ animationDelay: '0.5s' }} />
          <circle cx="80" cy="160" r="4" fill="#ec4899" className="animate-pulse" style={{ animationDelay: '1s' }} />
          <circle cx="220" cy="160" r="4" fill="#6366f1" className="animate-pulse" style={{ animationDelay: '1.5s' }} />
        </svg>
      </div>
      <p className="text-xs text-slate-500 mt-4">
        Clear terms for codebase intelligence services
      </p>
    </div>
  );
};

// -----------------------------------------------------------------------------
// COMPONENT: SERVICE FEATURES VISUAL
// -----------------------------------------------------------------------------
const ServiceFeaturesVisual = () => {
  return (
    <div className="relative w-full rounded-xl border border-white/10 bg-[#0A0A0A] p-6">
      <div className="flex items-center gap-2 mb-4">
        <Code size={18} className="text-purple-400" />
        <h3 className="text-sm font-semibold text-white">Service Scope</h3>
      </div>
      <div className="space-y-3 font-mono text-xs">
        <div className="flex items-center gap-3 p-3 rounded-lg bg-white/5 border border-white/5">
          <div className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse"></div>
          <span className="text-slate-300">Repository Indexing & AST Parsing</span>
        </div>
        <div className="flex items-center gap-3 p-3 rounded-lg bg-white/5 border border-white/5 ml-4">
          <div className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" style={{ animationDelay: '0.3s' }}></div>
          <span className="text-slate-300">Dependency Graph Generation</span>
        </div>
        <div className="flex items-center gap-3 p-3 rounded-lg bg-white/5 border border-white/5 ml-8">
          <div className="w-2 h-2 rounded-full bg-pink-400 animate-pulse" style={{ animationDelay: '0.6s' }}></div>
          <span className="text-slate-300">AI-Powered Code Analysis</span>
        </div>
        <div className="flex items-center gap-3 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 ml-12">
          <CheckCircle size={14} className="text-emerald-400" />
          <span className="text-emerald-300">All services subject to these terms</span>
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

export default function TermsPage() {
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
            <span className="w-6 h-px bg-indigo-400" /> TERMS OF SERVICE
          </div>
          <h1 className="animate-fade-in delay-150 text-4xl sm:text-5xl font-semibold tracking-tight text-white max-w-3xl mx-auto leading-[1.15] mb-6">
            Clear Terms for{" "}
            <span className="gradient-text">Codebase Intelligence</span>
          </h1>
          <p className="animate-fade-in delay-150 text-slate-400 text-base sm:text-lg leading-relaxed max-w-2xl mx-auto mb-4">
            These terms govern your use of DEX. Please read them carefully before using our services.
          </p>
          <p className="animate-fade-in delay-300 text-slate-500 text-sm max-w-xl mx-auto">
            Last updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </section>

        {/* Visual Section */}
        <section className="mx-auto max-w-6xl px-6 py-8">
          <div className="grid md:grid-cols-2 gap-6 mb-12">
            <TermsVisual />
            <ServiceFeaturesVisual />
          </div>
        </section>

        {/* Content Sections */}
        <section className="mx-auto max-w-4xl px-6 pb-16">
          <div className="space-y-12">
            
            {/* Section 1 */}
            <div className="animate-fade-in delay-150 rounded-2xl border border-white/10 bg-[#0F0F10]/50 p-8 hover-lift">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-lg bg-indigo-500/20 flex items-center justify-center text-indigo-400">
                  <FileText size={20} />
                </div>
                <h2 className="text-2xl font-semibold text-white">1. Acceptance of Terms</h2>
              </div>
              <div className="space-y-4 text-slate-300 text-sm leading-relaxed">
                <p>
                  By accessing or using DEX ("Service"), you agree to be bound by these Terms of Service ("Terms"). If you disagree with any part of these terms, you may not access the Service.
                </p>
                <p>
                  These Terms apply to all users of the Service, including without limitation users who are browsers, vendors, customers, merchants, and/or contributors of content.
                </p>
              </div>
            </div>

            {/* Section 2 */}
            <div className="animate-fade-in delay-300 rounded-2xl border border-white/10 bg-[#0F0F10]/50 p-8 hover-lift">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center text-purple-400">
                  <GitBranch size={20} />
                </div>
                <h2 className="text-2xl font-semibold text-white">2. Description of Service</h2>
              </div>
              <div className="space-y-4 text-slate-300 text-sm leading-relaxed">
                <p>
                  DEX is a codebase intelligence platform that provides:
                </p>
                <div className="grid sm:grid-cols-2 gap-4 mt-4">
                  <div className="p-4 rounded-lg bg-white/5 border border-white/5">
                    <Code size={16} className="text-indigo-400 mb-2" />
                    <h4 className="text-white font-semibold mb-1">Code Analysis</h4>
                    <p className="text-xs text-slate-400">AST parsing and semantic understanding of your codebase</p>
                  </div>
                  <div className="p-4 rounded-lg bg-white/5 border border-white/5">
                    <GitBranch size={16} className="text-purple-400 mb-2" />
                    <h4 className="text-white font-semibold mb-1">Dependency Mapping</h4>
                    <p className="text-xs text-slate-400">Visual dependency graphs and relationship analysis</p>
                  </div>
                  <div className="p-4 rounded-lg bg-white/5 border border-white/5">
                    <ShieldCheck size={16} className="text-emerald-400 mb-2" />
                    <h4 className="text-white font-semibold mb-1">AI Assistant</h4>
                    <p className="text-xs text-slate-400">Context-aware code queries and insights</p>
                  </div>
                  <div className="p-4 rounded-lg bg-white/5 border border-white/5">
                    <FileText size={16} className="text-yellow-400 mb-2" />
                    <h4 className="text-white font-semibold mb-1">Activity Insights</h4>
                    <p className="text-xs text-slate-400">Repository activity patterns and team collaboration analysis</p>
                  </div>
                </div>
                <p className="mt-4 text-xs text-slate-500">
                  We reserve the right to modify, suspend, or discontinue any part of the Service at any time with or without notice.
                </p>
              </div>
            </div>

            {/* Section 3 */}
            <div className="animate-fade-in delay-450 rounded-2xl border border-white/10 bg-[#0F0F10]/50 p-8 hover-lift">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center text-emerald-400">
                  <ShieldCheck size={20} />
                </div>
                <h2 className="text-2xl font-semibold text-white">3. User Accounts & Responsibilities</h2>
              </div>
              <div className="space-y-4 text-slate-300 text-sm leading-relaxed">
                <div>
                  <h3 className="text-lg font-semibold text-white mb-2">Account Creation</h3>
                  <p className="mb-3">
                    To use certain features of the Service, you must create an account. You agree to:
                  </p>
                  <ul className="list-disc list-inside space-y-2 ml-4 text-slate-400">
                    <li>Provide accurate, current, and complete information during registration</li>
                    <li>Maintain and promptly update your account information</li>
                    <li>Maintain the security of your password and identification</li>
                    <li>Accept all responsibility for activities that occur under your account</li>
                    <li>Notify us immediately of any unauthorized use of your account</li>
                  </ul>
                </div>
                <div className="mt-6">
                  <h3 className="text-lg font-semibold text-white mb-2">Repository Access</h3>
                  <p className="mb-3">
                    When connecting a repository, you represent and warrant that:
                  </p>
                  <ul className="list-disc list-inside space-y-2 ml-4 text-slate-400">
                    <li>You have the legal right to grant us access to the repository</li>
                    <li>You own the code or have obtained all necessary licenses and permissions</li>
                    <li>The code does not violate any third-party rights or applicable laws</li>
                    <li>You will not use the Service to process code containing sensitive data (passwords, API keys, etc.) without proper safeguards</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Section 4 */}
            <div className="animate-fade-in delay-150 rounded-2xl border border-white/10 bg-[#0F0F10]/50 p-8 hover-lift">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-lg bg-yellow-500/20 flex items-center justify-center text-yellow-400">
                  <AlertTriangle size={20} />
                </div>
                <h2 className="text-2xl font-semibold text-white">4. Acceptable Use</h2>
              </div>
              <div className="space-y-4 text-slate-300 text-sm leading-relaxed">
                <p className="mb-4">
                  You agree not to use the Service to:
                </p>
                <div className="space-y-3">
                  <div className="flex items-start gap-3 p-4 rounded-lg bg-red-500/10 border border-red-500/20">
                    <AlertTriangle size={18} className="text-red-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <h4 className="text-white font-semibold mb-1">Prohibited Activities</h4>
                      <ul className="list-disc list-inside space-y-1 ml-4 text-xs text-slate-400">
                        <li>Violate any applicable laws, regulations, or third-party rights</li>
                        <li>Upload malicious code, viruses, or harmful software</li>
                        <li>Attempt to reverse engineer, decompile, or extract our proprietary algorithms</li>
                        <li>Use automated systems to access the Service in violation of rate limits</li>
                        <li>Share your account credentials or allow unauthorized access</li>
                        <li>Use the Service to process code containing illegal content</li>
                      </ul>
                    </div>
                  </div>
                </div>
                <p className="mt-4 text-xs text-slate-500">
                  Violation of these terms may result in immediate termination of your account and access to the Service.
                </p>
              </div>
            </div>

            {/* Section 5 */}
            <div className="animate-fade-in delay-300 rounded-2xl border border-white/10 bg-[#0F0F10]/50 p-8 hover-lift">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-lg bg-indigo-500/20 flex items-center justify-center text-indigo-400">
                  <Scale size={20} />
                </div>
                <h2 className="text-2xl font-semibold text-white">5. Intellectual Property</h2>
              </div>
              <div className="space-y-4 text-slate-300 text-sm leading-relaxed">
                <div>
                  <h3 className="text-lg font-semibold text-white mb-2">Your Code</h3>
                  <p className="mb-3">
                    You retain all ownership rights to your code and repository content. By using the Service, you grant us a limited, non-exclusive license to:
                  </p>
                  <ul className="list-disc list-inside space-y-2 ml-4 text-slate-400">
                    <li>Access and process your code solely to provide the Service</li>
                    <li>Create derivative works (AST, dependency graphs, embeddings) necessary for Service functionality</li>
                    <li>Store and transmit your code as necessary to operate the Service</li>
                  </ul>
                  <p className="mt-3 text-xs text-slate-500">
                    This license terminates when you disconnect your repository or delete your account.
                  </p>
                </div>
                <div className="mt-6">
                  <h3 className="text-lg font-semibold text-white mb-2">Our Service</h3>
                  <p className="mb-3">
                    The Service, including all software, algorithms, designs, and content, is owned by DEX and protected by intellectual property laws. You may not:
                  </p>
                  <ul className="list-disc list-inside space-y-2 ml-4 text-slate-400">
                    <li>Copy, modify, or create derivative works of the Service</li>
                    <li>Reverse engineer or attempt to extract source code</li>
                    <li>Remove or alter any proprietary notices or labels</li>
                    <li>Use our trademarks or branding without permission</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Section 6 */}
            <div className="animate-fade-in delay-450 rounded-2xl border border-white/10 bg-[#0F0F10]/50 p-8 hover-lift">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center text-purple-400">
                  <FileText size={20} />
                </div>
                <h2 className="text-2xl font-semibold text-white">6. Service Availability & Disclaimers</h2>
              </div>
              <div className="space-y-4 text-slate-300 text-sm leading-relaxed">
                <p className="mb-4">
                  We strive to provide reliable service, but cannot guarantee:
                </p>
                <div className="space-y-3">
                  <div className="p-4 rounded-lg bg-white/5 border border-white/5">
                    <h4 className="text-white font-semibold mb-2">Availability</h4>
                    <p className="text-xs text-slate-400">The Service is provided "as is" and "as available." We do not guarantee uninterrupted, error-free, or secure operation.</p>
                  </div>
                  <div className="p-4 rounded-lg bg-white/5 border border-white/5">
                    <h4 className="text-white font-semibold mb-2">Accuracy</h4>
                    <p className="text-xs text-slate-400">While we use advanced AI, analysis results may contain inaccuracies. Always verify critical information independently.</p>
                  </div>
                  <div className="p-4 rounded-lg bg-white/5 border border-white/5">
                    <h4 className="text-white font-semibold mb-2">Third-Party Services</h4>
                    <p className="text-xs text-slate-400">We rely on third-party services (GitHub, AI providers). Their availability and terms affect our Service.</p>
                  </div>
                </div>
                <div className="p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/20 mt-4">
                  <div className="flex items-start gap-3">
                    <AlertTriangle size={18} className="text-yellow-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <h4 className="text-white font-semibold mb-1">No Warranties</h4>
                      <p className="text-xs text-slate-400">THE SERVICE IS PROVIDED WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, OR NON-INFRINGEMENT.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Section 7 */}
            <div className="animate-fade-in delay-150 rounded-2xl border border-white/10 bg-[#0F0F10]/50 p-8 hover-lift">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-lg bg-red-500/20 flex items-center justify-center text-red-400">
                  <AlertTriangle size={20} />
                </div>
                <h2 className="text-2xl font-semibold text-white">7. Limitation of Liability</h2>
              </div>
              <div className="space-y-4 text-slate-300 text-sm leading-relaxed">
                <p className="mb-4">
                  TO THE MAXIMUM EXTENT PERMITTED BY LAW:
                </p>
                <ul className="list-disc list-inside space-y-2 ml-4 text-slate-400">
                  <li>DEX SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES</li>
                  <li>OUR TOTAL LIABILITY SHALL NOT EXCEED THE AMOUNT YOU PAID US IN THE 12 MONTHS PRECEDING THE CLAIM</li>
                  <li>WE ARE NOT RESPONSIBLE FOR LOSS OF DATA, PROFITS, OR BUSINESS OPPORTUNITIES</li>
                  <li>WE ARE NOT LIABLE FOR ACTIONS OF THIRD-PARTY SERVICES (GITHUB, AI PROVIDERS, ETC.)</li>
                </ul>
                <p className="mt-4 text-xs text-slate-500">
                  Some jurisdictions do not allow the exclusion of certain warranties or limitations of liability, so some of the above may not apply to you.
                </p>
              </div>
            </div>

            {/* Section 8 */}
            <div className="animate-fade-in delay-300 rounded-2xl border border-white/10 bg-[#0F0F10]/50 p-8 hover-lift">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center text-emerald-400">
                  <CheckCircle size={20} />
                </div>
                <h2 className="text-2xl font-semibold text-white">8. Payment & Billing</h2>
              </div>
              <div className="space-y-4 text-slate-300 text-sm leading-relaxed">
                <div>
                  <h3 className="text-lg font-semibold text-white mb-2">Free Tier</h3>
                  <p className="mb-3">
                    DEX offers a free tier with limited features. No payment information is required for free tier access.
                  </p>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white mb-2">Paid Plans</h3>
                  <p className="mb-3">
                    For paid subscriptions:
                  </p>
                  <ul className="list-disc list-inside space-y-2 ml-4 text-slate-400">
                    <li>You agree to pay all fees associated with your selected plan</li>
                    <li>Fees are billed in advance on a monthly or annual basis</li>
                    <li>All fees are non-refundable except as required by law</li>
                    <li>We reserve the right to change pricing with 30 days' notice</li>
                    <li>Failure to pay may result in service suspension or termination</li>
                  </ul>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white mb-2">Cancellation</h3>
                  <p className="mb-3">
                    You may cancel your subscription at any time. Cancellation takes effect at the end of your current billing period. No refunds for partial periods.
                  </p>
                </div>
              </div>
            </div>

            {/* Section 9 */}
            <div className="animate-fade-in delay-450 rounded-2xl border border-white/10 bg-[#0F0F10]/50 p-8 hover-lift">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-lg bg-indigo-500/20 flex items-center justify-center text-indigo-400">
                  <FileText size={20} />
                </div>
                <h2 className="text-2xl font-semibold text-white">9. Termination</h2>
              </div>
              <div className="space-y-4 text-slate-300 text-sm leading-relaxed">
                <p className="mb-4">
                  Either party may terminate this agreement:
                </p>
                <div className="space-y-3">
                  <div className="p-4 rounded-lg bg-white/5 border border-white/5">
                    <h4 className="text-white font-semibold mb-2">By You</h4>
                    <p className="text-xs text-slate-400">You may terminate by deleting your account or disconnecting all repositories. All associated data will be deleted.</p>
                  </div>
                  <div className="p-4 rounded-lg bg-white/5 border border-white/5">
                    <h4 className="text-white font-semibold mb-2">By Us</h4>
                    <p className="text-xs text-slate-400">We may suspend or terminate your account immediately if you violate these Terms, fail to pay fees, or for any reason with 30 days' notice.</p>
                  </div>
                </div>
                <p className="mt-4">
                  Upon termination, your right to use the Service immediately ceases. We will delete your data in accordance with our Privacy Policy, except where retention is required by law.
                </p>
              </div>
            </div>

            {/* Section 10 */}
            <div className="animate-fade-in delay-150 rounded-2xl border border-white/10 bg-[#0F0F10]/50 p-8 hover-lift">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center text-purple-400">
                  <Scale size={20} />
                </div>
                <h2 className="text-2xl font-semibold text-white">10. Changes to Terms</h2>
              </div>
              <div className="space-y-4 text-slate-300 text-sm leading-relaxed">
                <p>
                  We reserve the right to modify these Terms at any time. We will notify you of material changes by:
                </p>
                <ul className="list-disc list-inside space-y-2 ml-4 text-slate-400">
                  <li>Posting the updated Terms on this page with a new "Last updated" date</li>
                  <li>Sending an email notification to registered users</li>
                  <li>Displaying a prominent notice in the application</li>
                </ul>
                <p className="mt-4">
                  Your continued use of the Service after changes become effective constitutes acceptance of the updated Terms. If you do not agree, you must stop using the Service and delete your account.
                </p>
              </div>
            </div>

            {/* Section 11 */}
            <div className="animate-fade-in delay-300 rounded-2xl border border-white/10 bg-[#0F0F10]/50 p-8 hover-lift">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-lg bg-yellow-500/20 flex items-center justify-center text-yellow-400">
                  <FileText size={20} />
                </div>
                <h2 className="text-2xl font-semibold text-white">11. Governing Law & Disputes</h2>
              </div>
              <div className="space-y-4 text-slate-300 text-sm leading-relaxed">
                <div>
                  <h3 className="text-lg font-semibold text-white mb-2">Governing Law</h3>
                  <p className="mb-3">
                    These Terms shall be governed by and construed in accordance with the laws of [Your Jurisdiction], without regard to its conflict of law provisions.
                  </p>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white mb-2">Dispute Resolution</h3>
                  <p className="mb-3">
                    Any disputes arising from these Terms or the Service shall be resolved through:
                  </p>
                  <ul className="list-disc list-inside space-y-2 ml-4 text-slate-400">
                    <li>Good faith negotiation between the parties</li>
                    <li>If negotiation fails, binding arbitration in accordance with [Arbitration Rules]</li>
                    <li>Class action waivers apply to the maximum extent permitted by law</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Contact Section */}
            <div className="animate-fade-in delay-450 rounded-2xl border border-indigo-500/30 bg-indigo-500/5 p-8 text-center">
              <h2 className="text-2xl font-semibold text-white mb-4">Questions About Terms?</h2>
              <p className="text-slate-400 text-sm mb-6 max-w-xl mx-auto">
                If you have questions about these Terms or need clarification on any provision, please contact us.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link
                  href="mailto:rhythmsuthar123@gmail.com"
                  className="inline-flex items-center gap-2 rounded-xl bg-white text-black px-6 py-3 text-xs font-bold uppercase tracking-widest hover:bg-slate-200 transition-all shadow-[0_0_30px_rgba(255,255,255,0.15)] hover:shadow-[0_0_40px_rgba(255,255,255,0.25)] hover:scale-105"
                >
                  Contact Legal Team
                  <ArrowRight size={14} />
                </Link>
                <Link
                  href="/grievance"
                  className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-6 py-3 text-xs font-bold uppercase tracking-widest text-slate-300 hover:bg-white/10 hover:text-white hover:border-indigo-500/30 transition-all"
                >
                  Submit Grievance
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
            <Link href="/terms" className="text-indigo-400 hover:text-indigo-300 transition-colors">Terms</Link>
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
