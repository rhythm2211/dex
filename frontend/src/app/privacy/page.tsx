"use client";

import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { Terminal, LogOut, ShieldCheck, Lock, Database, Eye, FileText, GitBranch, Code, ArrowRight } from "lucide-react";

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
// COMPONENT: SECURITY VISUALIZATION
// -----------------------------------------------------------------------------
const SecurityVisual = () => {
  return (
    <div className="relative w-full h-full rounded-xl border border-white/10 bg-[#0A0A0A] p-6 overflow-hidden">
      <div className="flex items-center gap-2 mb-4">
        <ShieldCheck size={18} className="text-emerald-400" />
        <h3 className="text-sm font-semibold text-white">Data Protection</h3>
      </div>
      <div className="relative h-48">
        <svg className="w-full h-full" viewBox="0 0 300 200" style={{ overflow: 'visible' }}>
          {/* Encryption layers */}
          <rect x="50" y="30" width="200" height="140" rx="8" fill="rgba(16, 185, 129, 0.1)" stroke="rgba(16, 185, 129, 0.3)" strokeWidth="2" className="animate-pulse-glow" />
          <rect x="70" y="50" width="160" height="100" rx="6" fill="rgba(16, 185, 129, 0.15)" stroke="rgba(16, 185, 129, 0.4)" strokeWidth="1.5" />
          <rect x="90" y="70" width="120" height="60" rx="4" fill="rgba(16, 185, 129, 0.2)" stroke="rgba(16, 185, 129, 0.5)" strokeWidth="1" />
          
          {/* Lock icon in center */}
          <g transform="translate(150, 100)">
            <circle cx="0" cy="0" r="20" fill="rgba(16, 185, 129, 0.3)" className="animate-pulse-glow" />
            <Lock size={24} className="text-emerald-400" style={{ transform: 'translate(-12px, -12px)' }} />
          </g>
          
          {/* Security nodes */}
          <circle cx="80" cy="40" r="4" fill="#10b981" className="animate-pulse" />
          <circle cx="220" cy="40" r="4" fill="#10b981" className="animate-pulse" style={{ animationDelay: '0.5s' }} />
          <circle cx="80" cy="160" r="4" fill="#10b981" className="animate-pulse" style={{ animationDelay: '1s' }} />
          <circle cx="220" cy="160" r="4" fill="#10b981" className="animate-pulse" style={{ animationDelay: '1.5s' }} />
        </svg>
      </div>
      <p className="text-xs text-slate-500 mt-4">
        End-to-end encryption ensures your codebase data remains secure
      </p>
    </div>
  );
};

// -----------------------------------------------------------------------------
// COMPONENT: DATA FLOW VISUALIZATION
// -----------------------------------------------------------------------------
const DataFlowVisual = () => {
  return (
    <div className="relative w-full rounded-xl border border-white/10 bg-[#0A0A0A] p-6">
      <div className="flex items-center gap-2 mb-4">
        <Database size={18} className="text-indigo-400" />
        <h3 className="text-sm font-semibold text-white">Data Processing</h3>
      </div>
      <div className="space-y-3 font-mono text-xs">
        <div className="flex items-center gap-3 p-3 rounded-lg bg-white/5 border border-white/5">
          <div className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse"></div>
          <span className="text-slate-300">Repository → AST Parsing</span>
        </div>
        <div className="flex items-center gap-3 p-3 rounded-lg bg-white/5 border border-white/5 ml-4">
          <div className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" style={{ animationDelay: '0.3s' }}></div>
          <span className="text-slate-300">Dependency Graph → Vector Embedding</span>
        </div>
        <div className="flex items-center gap-3 p-3 rounded-lg bg-white/5 border border-white/5 ml-8">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" style={{ animationDelay: '0.6s' }}></div>
          <span className="text-slate-300">Encrypted Storage → Ephemeral Processing</span>
        </div>
        <div className="flex items-center gap-3 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 ml-12">
          <CheckCircle size={14} className="text-emerald-400" />
          <span className="text-emerald-300">No data retention after processing</span>
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

export default function PrivacyPage() {
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
            <span className="w-6 h-px bg-indigo-400" /> PRIVACY POLICY
          </div>
          <h1 className="animate-fade-in delay-150 text-4xl sm:text-5xl font-semibold tracking-tight text-white max-w-3xl mx-auto leading-[1.15] mb-6">
            Your Codebase.{" "}
            <span className="gradient-text">Your Privacy.</span>
          </h1>
          <p className="animate-fade-in delay-150 text-slate-400 text-base sm:text-lg leading-relaxed max-w-2xl mx-auto mb-4">
            We believe your intellectual property should remain yours. This policy explains how we protect your code and data.
          </p>
          <p className="animate-fade-in delay-300 text-slate-500 text-sm max-w-xl mx-auto">
            Last updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </section>

        {/* Visual Section */}
        <section className="mx-auto max-w-6xl px-6 py-8">
          <div className="grid md:grid-cols-2 gap-6 mb-12">
            <SecurityVisual />
            <DataFlowVisual />
          </div>
        </section>

        {/* Content Sections */}
        <section className="mx-auto max-w-4xl px-6 pb-16">
          <div className="space-y-12">
            
            {/* Section 1 */}
            <div className="animate-fade-in delay-150 rounded-2xl border border-white/10 bg-[#0F0F10]/50 p-8 hover-lift">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-lg bg-indigo-500/20 flex items-center justify-center text-indigo-400">
                  <Code size={20} />
                </div>
                <h2 className="text-2xl font-semibold text-white">1. Information We Collect</h2>
              </div>
              <div className="space-y-4 text-slate-300 text-sm leading-relaxed">
                <div>
                  <h3 className="text-lg font-semibold text-white mb-2">Repository Data</h3>
                  <p className="mb-3">
                    When you connect a GitHub or GitLab repository, we collect:
                  </p>
                  <ul className="list-disc list-inside space-y-2 ml-4 text-slate-400">
                    <li>Source code files and their contents</li>
                    <li>Repository metadata (commits, branches, pull requests)</li>
                    <li>File structure and dependency relationships</li>
                    <li>Code history and version information</li>
                  </ul>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white mb-2">Account Information</h3>
                  <p className="mb-3">
                    We collect basic account information to provide our services:
                  </p>
                  <ul className="list-disc list-inside space-y-2 ml-4 text-slate-400">
                    <li>Email address and authentication credentials (via OAuth)</li>
                    <li>Repository access tokens (stored encrypted, used only for indexing)</li>
                    <li>Usage analytics (anonymized, aggregated)</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Section 2 */}
            <div className="animate-fade-in delay-300 rounded-2xl border border-white/10 bg-[#0F0F10]/50 p-8 hover-lift">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center text-emerald-400">
                  <Lock size={20} />
                </div>
                <h2 className="text-2xl font-semibold text-white">2. How We Use Your Information</h2>
              </div>
              <div className="space-y-4 text-slate-300 text-sm leading-relaxed">
                <p className="mb-4">
                  We use your information solely to provide and improve our codebase intelligence services:
                </p>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="p-4 rounded-lg bg-white/5 border border-white/5">
                    <GitBranch size={16} className="text-indigo-400 mb-2" />
                    <h4 className="text-white font-semibold mb-1">Dependency Analysis</h4>
                    <p className="text-xs text-slate-400">Build AST and dependency graphs from your code</p>
                  </div>
                  <div className="p-4 rounded-lg bg-white/5 border border-white/5">
                    <Code size={16} className="text-purple-400 mb-2" />
                    <h4 className="text-white font-semibold mb-1">Semantic Search</h4>
                    <p className="text-xs text-slate-400">Enable context-aware code queries</p>
                  </div>
                  <div className="p-4 rounded-lg bg-white/5 border border-white/5">
                    <Eye size={16} className="text-emerald-400 mb-2" />
                    <h4 className="text-white font-semibold mb-1">Insights Generation</h4>
                    <p className="text-xs text-slate-400">Analyze activity patterns and team collaboration</p>
                  </div>
                  <div className="p-4 rounded-lg bg-white/5 border border-white/5">
                    <Database size={16} className="text-yellow-400 mb-2" />
                    <h4 className="text-white font-semibold mb-1">Service Improvement</h4>
                    <p className="text-xs text-slate-400">Anonymized analytics to enhance features</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Section 3 */}
            <div className="animate-fade-in delay-450 rounded-2xl border border-white/10 bg-[#0F0F10]/50 p-8 hover-lift">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center text-purple-400">
                  <ShieldCheck size={20} />
                </div>
                <h2 className="text-2xl font-semibold text-white">3. Data Security & Encryption</h2>
              </div>
              <div className="space-y-4 text-slate-300 text-sm leading-relaxed">
                <p className="mb-4">
                  We implement industry-leading security measures to protect your codebase:
                </p>
                <div className="space-y-3">
                  <div className="flex items-start gap-3 p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                    <Lock size={18} className="text-emerald-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <h4 className="text-white font-semibold mb-1">End-to-End Encryption</h4>
                      <p className="text-xs text-slate-400">All code data is encrypted in transit (TLS 1.3) and at rest (AES-256)</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-4 rounded-lg bg-indigo-500/10 border border-indigo-500/20">
                    <Database size={18} className="text-indigo-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <h4 className="text-white font-semibold mb-1">Ephemeral Processing</h4>
                      <p className="text-xs text-slate-400">Code is processed in isolated, temporary environments that are destroyed after indexing</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-4 rounded-lg bg-purple-500/10 border border-purple-500/20">
                    <ShieldCheck size={18} className="text-purple-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <h4 className="text-white font-semibold mb-1">No Data Retention</h4>
                      <p className="text-xs text-slate-400">By default, we do not retain your source code after processing. You can opt-in to persistent storage if needed</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                    <FileText size={18} className="text-yellow-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <h4 className="text-white font-semibold mb-1">SOC 2 Compliance</h4>
                      <p className="text-xs text-slate-400">We maintain SOC 2 Type II certification and undergo regular security audits</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Section 4 */}
            <div className="animate-fade-in delay-150 rounded-2xl border border-white/10 bg-[#0F0F10]/50 p-8 hover-lift">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-lg bg-yellow-500/20 flex items-center justify-center text-yellow-400">
                  <Eye size={20} />
                </div>
                <h2 className="text-2xl font-semibold text-white">4. Data Sharing & Third Parties</h2>
              </div>
              <div className="space-y-4 text-slate-300 text-sm leading-relaxed">
                <p className="mb-4">
                  We do not sell, rent, or share your codebase data with third parties. Limited exceptions:
                </p>
                <ul className="list-disc list-inside space-y-2 ml-4 text-slate-400">
                  <li><strong className="text-white">AI Service Providers:</strong> We use third-party AI models (OpenAI, Anthropic) for code analysis. Your code is sent encrypted and is subject to their privacy policies. We do not allow these providers to train models on your code.</li>
                  <li><strong className="text-white">Infrastructure Providers:</strong> We use cloud providers (AWS, GCP) for hosting. All data is encrypted and stored in secure, compliant data centers.</li>
                  <li><strong className="text-white">Legal Requirements:</strong> We may disclose information if required by law or to protect our rights and safety.</li>
                </ul>
              </div>
            </div>

            {/* Section 5 */}
            <div className="animate-fade-in delay-300 rounded-2xl border border-white/10 bg-[#0F0F10]/50 p-8 hover-lift">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-lg bg-indigo-500/20 flex items-center justify-center text-indigo-400">
                  <Database size={20} />
                </div>
                <h2 className="text-2xl font-semibold text-white">5. Your Rights & Control</h2>
              </div>
              <div className="space-y-4 text-slate-300 text-sm leading-relaxed">
                <p className="mb-4">
                  You have full control over your data:
                </p>
                <div className="space-y-3">
                  <div className="p-4 rounded-lg bg-white/5 border border-white/5">
                    <h4 className="text-white font-semibold mb-2">Access & Export</h4>
                    <p className="text-xs text-slate-400">Request a copy of all data we have about you and your repositories</p>
                  </div>
                  <div className="p-4 rounded-lg bg-white/5 border border-white/5">
                    <h4 className="text-white font-semibold mb-2">Deletion</h4>
                    <p className="text-xs text-slate-400">Delete your account and all associated data at any time. Processing is immediate and irreversible</p>
                  </div>
                  <div className="p-4 rounded-lg bg-white/5 border border-white/5">
                    <h4 className="text-white font-semibold mb-2">Repository Disconnection</h4>
                    <p className="text-xs text-slate-400">Disconnect any repository at any time. All indexed data for that repository will be deleted</p>
                  </div>
                  <div className="p-4 rounded-lg bg-white/5 border border-white/5">
                    <h4 className="text-white font-semibold mb-2">Opt-Out</h4>
                    <p className="text-xs text-slate-400">Opt out of analytics and non-essential data collection in your account settings</p>
                  </div>
                </div>
                <p className="mt-4 text-xs text-slate-500">
                  To exercise these rights, contact us at <a href="mailto:privacy@dex.ai" className="text-indigo-400 hover:text-indigo-300">privacy@dex.ai</a>
                </p>
              </div>
            </div>

            {/* Section 6 */}
            <div className="animate-fade-in delay-450 rounded-2xl border border-white/10 bg-[#0F0F10]/50 p-8 hover-lift">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center text-emerald-400">
                  <FileText size={20} />
                </div>
                <h2 className="text-2xl font-semibold text-white">6. Cookies & Tracking</h2>
              </div>
              <div className="space-y-4 text-slate-300 text-sm leading-relaxed">
                <p className="mb-4">
                  We use minimal cookies and tracking technologies:
                </p>
                <ul className="list-disc list-inside space-y-2 ml-4 text-slate-400">
                  <li><strong className="text-white">Essential Cookies:</strong> Required for authentication and session management</li>
                  <li><strong className="text-white">Analytics:</strong> Anonymized usage analytics to improve our service (you can opt out)</li>
                  <li><strong className="text-white">No Advertising:</strong> We do not use advertising cookies or track you across other websites</li>
                </ul>
              </div>
            </div>

            {/* Section 7 */}
            <div className="animate-fade-in delay-150 rounded-2xl border border-white/10 bg-[#0F0F10]/50 p-8 hover-lift">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center text-purple-400">
                  <GitBranch size={20} />
                </div>
                <h2 className="text-2xl font-semibold text-white">7. International Data Transfers</h2>
              </div>
              <div className="space-y-4 text-slate-300 text-sm leading-relaxed">
                <p className="mb-4">
                  Your data may be processed in data centers located outside your country. We ensure:
                </p>
                <ul className="list-disc list-inside space-y-2 ml-4 text-slate-400">
                  <li>All transfers comply with applicable data protection laws (GDPR, CCPA, etc.)</li>
                  <li>Standard Contractual Clauses (SCCs) are in place for international transfers</li>
                  <li>Data is encrypted and subject to the same security standards regardless of location</li>
                </ul>
              </div>
            </div>

            {/* Section 8 */}
            <div className="animate-fade-in delay-300 rounded-2xl border border-white/10 bg-[#0F0F10]/50 p-8 hover-lift">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-lg bg-yellow-500/20 flex items-center justify-center text-yellow-400">
                  <FileText size={20} />
                </div>
                <h2 className="text-2xl font-semibold text-white">8. Changes to This Policy</h2>
              </div>
              <div className="space-y-4 text-slate-300 text-sm leading-relaxed">
                <p>
                  We may update this Privacy Policy from time to time. We will notify you of any material changes by:
                </p>
                <ul className="list-disc list-inside space-y-2 ml-4 text-slate-400">
                  <li>Posting the updated policy on this page with a new "Last updated" date</li>
                  <li>Sending an email notification to registered users</li>
                  <li>Displaying a prominent notice in the application</li>
                </ul>
                <p className="mt-4">
                  Your continued use of DEX after changes become effective constitutes acceptance of the updated policy.
                </p>
              </div>
            </div>

            {/* Contact Section */}
            <div className="animate-fade-in delay-450 rounded-2xl border border-indigo-500/30 bg-indigo-500/5 p-8 text-center">
              <h2 className="text-2xl font-semibold text-white mb-4">Questions About Privacy?</h2>
              <p className="text-slate-400 text-sm mb-6 max-w-xl mx-auto">
                If you have questions, concerns, or requests regarding your privacy or this policy, we're here to help.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link
                  href="mailto:rhythmsuthar123@gmail.com"
                  className="inline-flex items-center gap-2 rounded-xl bg-white text-black px-6 py-3 text-xs font-bold uppercase tracking-widest hover:bg-slate-200 transition-all shadow-[0_0_30px_rgba(255,255,255,0.15)] hover:shadow-[0_0_40px_rgba(255,255,255,0.25)] hover:scale-105"
                >
                  Contact Privacy Team
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
            <Link href="/privacy" className="text-indigo-400 hover:text-indigo-300 transition-colors">Privacy</Link>
            <Link href="/terms" className="hover:text-indigo-400 transition-colors">Terms</Link>
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
