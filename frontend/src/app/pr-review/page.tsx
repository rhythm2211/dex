'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useSearchParams } from 'next/navigation';
import {
  ArrowLeft, GitPullRequest, AlertTriangle, Shield, Users, Zap,
  CheckCircle2, XCircle, FileCode, ChevronRight, Copy,
  RefreshCw, Sparkles, TrendingUp, GitBranch, Lock, Clock,
  AlertCircle, BarChart3, Eye, Terminal
} from 'lucide-react';
import { dexApi, PRReviewResponse, PRFileRisk } from '@/lib/api';
import AppShell from '@/components/AppShell';

// ---------------------------------------------------------------------------
// STYLES
// ---------------------------------------------------------------------------
const GlobalStyles = () => (
  <style jsx global>{`
    @keyframes fade-in-up {
      from { opacity: 0; transform: translateY(16px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    @keyframes pulse-ring {
      0%   { box-shadow: 0 0 0 0 rgba(99,102,241,.4); }
      70%  { box-shadow: 0 0 0 12px rgba(99,102,241,0); }
      100% { box-shadow: 0 0 0 0 rgba(99,102,241,0); }
    }
    @keyframes shimmer {
      0%   { background-position: -800px 0; }
      100% { background-position: 800px 0; }
    }
    @keyframes scan {
      from { transform: translateY(-100%); }
      to   { transform: translateY(400%); }
    }
    @keyframes float-up {
      0%,100% { transform: translateY(0); }
      50%     { transform: translateY(-6px); }
    }
    @keyframes count-up {
      from { opacity: 0; transform: scale(0.5); }
      to   { opacity: 1; transform: scale(1); }
    }

    .pr-page { background: #050505; min-height: calc(100dvh - 4rem); }

    .glass {
      background: rgba(10,10,10,.7);
      backdrop-filter: blur(8px);
      border: 1px solid rgba(255,255,255,.07);
    }
    .glass-hover { transition: border-color .2s, background .2s; }
    .glass-hover:hover {
      border-color: rgba(99,102,241,.3);
      background: rgba(15,15,25,.85);
    }

    .risk-critical { color:#ef4444; background:rgba(239,68,68,.1); border-color:rgba(239,68,68,.3); }
    .risk-high     { color:#f59e0b; background:rgba(245,158,11,.1); border-color:rgba(245,158,11,.3); }
    .risk-medium   { color:#fbbf24; background:rgba(251,191,36,.1); border-color:rgba(251,191,36,.3); }
    .risk-low      { color:#22c55e; background:rgba(34,197,94,.1);  border-color:rgba(34,197,94,.3); }

    .shimmer-line {
      background: linear-gradient(90deg,#111 25%,#1e1e2e 50%,#111 75%);
      background-size: 800px 100%;
      animation: shimmer 1.4s infinite;
      border-radius: 6px;
    }

    .file-row { transition: background .15s, transform .15s; }
    .file-row:hover { background: rgba(99,102,241,.06); transform: translateX(2px); }

    .score-ring {
      position: relative; display: inline-flex;
      align-items: center; justify-content: center;
    }

    .animate-in {
      animation: fade-in-up .45s cubic-bezier(.4,0,.2,1) forwards;
      opacity: 0;
    }
    .delay-1 { animation-delay: .05s; }
    .delay-2 { animation-delay: .1s; }
    .delay-3 { animation-delay: .15s; }
    .delay-4 { animation-delay: .2s; }
    .delay-5 { animation-delay: .25s; }

    .cyber-grid {
      background-image:
        linear-gradient(rgba(99,102,241,.03) 1px, transparent 1px),
        linear-gradient(90deg, rgba(99,102,241,.03) 1px, transparent 1px);
      background-size: 40px 40px;
    }

    input:focus { outline: none; }
    textarea:focus { outline: none; }
  `}</style>
);

// ---------------------------------------------------------------------------
// RISK HELPERS
// ---------------------------------------------------------------------------
const riskMeta = (level: string) => {
  switch (level) {
    case 'CRITICAL': return { cls: 'risk-critical', icon: <XCircle size={14} />, hex: '#ef4444' };
    case 'HIGH':     return { cls: 'risk-high',     icon: <AlertTriangle size={14} />, hex: '#f59e0b' };
    case 'MEDIUM':   return { cls: 'risk-medium',   icon: <AlertCircle size={14} />, hex: '#fbbf24' };
    default:         return { cls: 'risk-low',      icon: <CheckCircle2 size={14} />, hex: '#22c55e' };
  }
};

const fileRiskColor = (score: number) =>
  score >= 70 ? '#ef4444' : score >= 40 ? '#f59e0b' : '#22c55e';

// ---------------------------------------------------------------------------
// SUB-COMPONENTS
// ---------------------------------------------------------------------------
const SkeletonLoader = () => (
  <div className="space-y-4 mt-8 animate-in">
    {[...Array(4)].map((_, i) => (
      <div key={i} className="glass rounded-xl p-5">
        <div className="shimmer-line h-4 w-2/3 mb-3" />
        <div className="shimmer-line h-3 w-1/2 mb-2" />
        <div className="shimmer-line h-3 w-1/3" />
      </div>
    ))}
  </div>
);

const RiskGauge = ({ score, level }: { score: number; level: string }) => {
  const meta = riskMeta(level);
  const circumference = 2 * Math.PI * 44;
  const offset = circumference - (score / 100) * circumference;

  return (
    <div className="flex flex-col items-center gap-2">
      <svg width="110" height="110" viewBox="0 0 110 110">
        <circle cx="55" cy="55" r="44" fill="none" stroke="#1e293b" strokeWidth="8" />
        <circle
          cx="55" cy="55" r="44" fill="none"
          stroke={meta.hex} strokeWidth="8"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform="rotate(-90 55 55)"
          style={{ transition: 'stroke-dashoffset 1s ease' }}
        />
        <text x="55" y="52" textAnchor="middle" fill="white" fontSize="20" fontWeight="800">{score}</text>
        <text x="55" y="66" textAnchor="middle" fill="#64748b" fontSize="9" letterSpacing="1">/100</text>
      </svg>
      <span className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold border ${meta.cls}`}>
        {meta.icon} {level} RISK
      </span>
    </div>
  );
};

const StatCard = ({
  label, value, sub, icon, color = '#6366f1', delay = ''
}: {
  label: string; value: string | number; sub?: string;
  icon: React.ReactNode; color?: string; delay?: string;
}) => (
  <div className={`glass glass-hover rounded-xl p-5 animate-in ${delay}`}>
    <div className="flex items-start justify-between mb-3">
      <div className="p-2 rounded-lg" style={{ background: `${color}22`, color }}>
        {icon}
      </div>
    </div>
    <div className="text-2xl font-black text-white mb-0.5">{value}</div>
    <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide">{label}</div>
    {sub && <div className="text-xs text-slate-600 mt-1">{sub}</div>}
  </div>
);

const FileRiskRow = ({ file, i }: { file: PRFileRisk; i: number }) => {
  const color = fileRiskColor(file.risk_score);
  return (
    <div
      className="file-row flex items-center gap-3 px-4 py-3 rounded-lg cursor-default"
      style={{ animationDelay: `${i * 30}ms` }}
    >
      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
      <div className="flex-1 min-w-0">
        <div className="text-xs font-mono text-slate-300 truncate">{file.file}</div>
        <div className="flex items-center gap-3 mt-0.5">
          <span className="text-[10px] text-slate-600">👤 {file.owner}</span>
          {file.is_new_circular_dep && (
            <span className="text-[10px] text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded">⟳ circular</span>
          )}
          {file.downstream_count > 0 && (
            <span className="text-[10px] text-slate-600">{file.downstream_count} downstream</span>
          )}
        </div>
      </div>
      <div
        className="text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0"
        style={{ color, background: `${color}22` }}
      >
        {file.risk_score}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// MAIN PAGE
// ---------------------------------------------------------------------------
function PRReviewPageInner() {
  const { data: session, status } = useSession();
  const searchParams = useSearchParams();
  const [prUrl, setPrUrl] = useState(searchParams.get('url') || '');
  const [manualFiles, setManualFiles] = useState('');
  const [useManual, setUseManual] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PRReviewResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-run if URL param provided
  useEffect(() => {
    const urlParam = searchParams.get('url');
    if (urlParam) {
      setPrUrl(urlParam);
      setTimeout(() => runAnalysis(urlParam), 500);
    }
  }, []);

  const runAnalysis = async (url?: string) => {
    const targetUrl = url || prUrl;
    const files = useManual ? manualFiles.split('\n').map(f => f.trim()).filter(Boolean) : undefined;

    if (!targetUrl && !files?.length) {
      setError('Enter a GitHub PR URL or paste file paths.');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const data = await dexApi.analyzePR(targetUrl || undefined, files);
      setResult(data);
    } catch (err: any) {
      setError(err.message || 'Analysis failed.');
    } finally {
      setLoading(false);
    }
  };

  const copyReport = () => {
    if (!result) return;
    const text = [
      `DEX PR Review Report`,
      `PR: ${result.pr_url || 'Manual analysis'}`,
      `Risk: ${result.overall_risk}/100 (${result.risk_level})`,
      ``,
      `AI Summary:`,
      result.ai_summary,
      ``,
      `Changed Files (${result.changed_files.length}):`,
      ...result.changed_files.map(f => `  - ${f}`),
      ``,
      `CI Checklist:`,
      ...result.ci_checklist.map(c => `  □ ${c}`),
    ].join('\n');
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const meta = result ? riskMeta(result.risk_level) : null;

  return (
    <AppShell>
    <div className="pr-page relative">
      <GlobalStyles />

      <div className="cyber-grid fixed inset-0 pointer-events-none opacity-40" />

      {/* Gradient orbs */}
      <div className="fixed top-20 left-1/4 w-96 h-96 rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(99,102,241,.06) 0%, transparent 70%)' }} />
      <div className="fixed bottom-40 right-1/4 w-80 h-80 rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(239,68,68,.04) 0%, transparent 70%)' }} />

      <main className="relative max-w-5xl mx-auto px-6 pt-8 pb-20">

        {/* Header */}
        <div className="mb-10 animate-in">
          <Link href="/app" className="inline-flex items-center gap-2 text-xs text-slate-500 hover:text-slate-300 transition-colors mb-6">
            <ArrowLeft size={12} /> Back to Dashboard
          </Link>
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20">
                  <GitPullRequest size={22} className="text-indigo-400" />
                </div>
                <div>
                  <h1 className="text-2xl font-black text-white tracking-tight">PR Review Copilot</h1>
                  <p className="text-xs text-slate-500 mt-0.5">Blast radius · ownership · AI summary before merge</p>
                </div>
              </div>
            </div>
            {result && (
              <button
                onClick={copyReport}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-xs text-slate-300 hover:bg-white/10 transition-all"
              >
                {copied ? <CheckCircle2 size={13} className="text-green-400" /> : <Copy size={13} />}
                {copied ? 'Copied!' : 'Copy Report'}
              </button>
            )}
          </div>
        </div>

        {/* Input Card */}
        <div className="glass rounded-2xl p-6 mb-8 animate-in delay-1">
          <div className="flex items-center gap-4 mb-5">
            <button
              onClick={() => setUseManual(false)}
              className={`text-xs px-4 py-2 rounded-lg font-medium transition-all ${
                !useManual ? 'bg-indigo-600 text-white' : 'bg-white/5 text-slate-400 hover:bg-white/10'
              }`}
            >
              <GitBranch size={12} className="inline mr-1.5" />GitHub PR
            </button>
            <button
              onClick={() => setUseManual(true)}
              className={`text-xs px-4 py-2 rounded-lg font-medium transition-all ${
                useManual ? 'bg-indigo-600 text-white' : 'bg-white/5 text-slate-400 hover:bg-white/10'
              }`}
            >
              <FileCode size={12} className="inline mr-1.5" />Manual Files
            </button>
          </div>

          {!useManual ? (
            <div className="flex gap-3">
              <div className="flex-1 relative">
                <GitPullRequest size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  ref={inputRef}
                  type="text"
                  value={prUrl}
                  onChange={e => setPrUrl(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && runAnalysis()}
                  placeholder="https://github.com/owner/repo/pull/123"
                  className="w-full pl-10 pr-4 py-3 bg-black/40 border border-white/10 rounded-xl text-sm text-slate-200 placeholder-slate-600 focus:border-indigo-500/50 transition-colors"
                />
              </div>
              <button
                onClick={() => runAnalysis()}
                disabled={loading}
                className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl transition-all flex items-center gap-2"
              >
                {loading ? <RefreshCw size={14} className="animate-spin" /> : <Sparkles size={14} />}
                {loading ? 'Analyzing…' : 'Analyze'}
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <textarea
                value={manualFiles}
                onChange={e => setManualFiles(e.target.value)}
                placeholder="Paste changed file paths, one per line:&#10;src/auth/login.ts&#10;src/api/users.py&#10;frontend/components/Nav.tsx"
                rows={5}
                className="w-full px-4 py-3 bg-black/40 border border-white/10 rounded-xl text-sm text-slate-200 placeholder-slate-600 focus:border-indigo-500/50 transition-colors font-mono resize-none"
              />
              <button
                onClick={() => runAnalysis()}
                disabled={loading}
                className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-all flex items-center gap-2"
              >
                {loading ? <RefreshCw size={14} className="animate-spin" /> : <Sparkles size={14} />}
                {loading ? 'Analyzing…' : 'Analyze Files'}
              </button>
            </div>
          )}

          {error && (
            <div className="mt-4 flex items-center gap-2 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3">
              <AlertTriangle size={14} /> {error}
            </div>
          )}
        </div>

        {/* Loading skeleton */}
        {loading && <SkeletonLoader />}

        {/* Results */}
        {result && !loading && (
          <div className="space-y-6">

            {/* Hero: Risk + Stats row */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {/* Risk gauge */}
              <div className="glass rounded-2xl p-6 flex flex-col items-center justify-center col-span-1 animate-in delay-1">
                <RiskGauge score={result.overall_risk} level={result.risk_level} />
              </div>

              {/* Stat cards */}
              <StatCard label="Changed Files" value={result.changed_files.length} icon={<FileCode size={16} />} delay="delay-2" />
              <StatCard label="Blast Files" value={result.blast_files.length} icon={<Zap size={16} />} color="#f59e0b" delay="delay-3" />
              <StatCard
                label="Circular Deps" value={result.new_circular_deps.length}
                icon={<RefreshCw size={16} />} color={result.new_circular_deps.length > 0 ? '#ef4444' : '#22c55e'}
                delay="delay-4"
              />
            </div>

            {/* AI Summary */}
            <div className="glass rounded-2xl p-6 animate-in delay-2">
              <div className="flex items-center gap-2 mb-4">
                <div className="p-1.5 rounded-lg bg-violet-500/10">
                  <Sparkles size={14} className="text-violet-400" />
                </div>
                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">AI Review Summary</span>
              </div>
              <p className="text-sm text-slate-300 leading-relaxed">{result.ai_summary}</p>
            </div>

            {/* CI Checklist */}
            <div className="glass rounded-2xl p-6 animate-in delay-3">
              <div className="flex items-center gap-2 mb-4">
                <div className="p-1.5 rounded-lg bg-green-500/10">
                  <CheckCircle2 size={14} className="text-green-400" />
                </div>
                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">CI Checklist</span>
              </div>
              <div className="space-y-2">
                {result.ci_checklist.map((item, i) => (
                  <div key={i} className="flex items-start gap-3 text-sm text-slate-300">
                    <div className="w-4 h-4 rounded border border-slate-600 flex-shrink-0 mt-0.5 flex items-center justify-center">
                      <div className="w-2 h-2 rounded-sm bg-indigo-500" />
                    </div>
                    {item}
                  </div>
                ))}
              </div>
            </div>

            {/* Two-column: file risks + reviewers */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

              {/* File Risks */}
              <div className="glass rounded-2xl p-6 animate-in delay-3">
                <div className="flex items-center gap-2 mb-4">
                  <div className="p-1.5 rounded-lg bg-orange-500/10">
                    <BarChart3 size={14} className="text-orange-400" />
                  </div>
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                    File Risk Scores ({result.file_risks.length})
                  </span>
                </div>
                <div className="space-y-1 max-h-72 overflow-y-auto pr-1">
                  {result.file_risks
                    .sort((a, b) => b.risk_score - a.risk_score)
                    .map((file, i) => <FileRiskRow key={file.file} file={file} i={i} />)}
                </div>
              </div>

              {/* Suggested Reviewers */}
              <div className="glass rounded-2xl p-6 animate-in delay-4">
                <div className="flex items-center gap-2 mb-4">
                  <div className="p-1.5 rounded-lg bg-blue-500/10">
                    <Users size={14} className="text-blue-400" />
                  </div>
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Suggested Reviewers</span>
                </div>
                {result.suggested_reviewers.length > 0 ? (
                  <div className="space-y-3">
                    {result.suggested_reviewers.map((r, i) => (
                      <div key={i} className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-white/3 border border-white/5">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-xs font-bold text-indigo-300">
                            {r.name[0]?.toUpperCase()}
                          </div>
                          <span className="text-sm text-slate-200">{r.name}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <div className="h-1 rounded-full bg-white/10" style={{ width: 60 }}>
                            <div
                              className="h-1 rounded-full bg-indigo-400"
                              style={{ width: `${r.confidence * 100}%` }}
                            />
                          </div>
                          <span className="text-[10px] text-slate-500">{Math.round(r.confidence * 100)}%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-600 italic">No reviewer data. Ensure ingestion has run.</p>
                )}

                {/* Bus factor regressions */}
                {result.bus_factor_regressions.length > 0 && (
                  <div className="mt-5">
                    <div className="text-xs font-bold text-red-400 mb-2 flex items-center gap-1.5">
                      <AlertTriangle size={12} /> Bus Factor Regressions
                    </div>
                    {result.bus_factor_regressions.map((r, i) => (
                      <div key={i} className="text-xs text-slate-400 font-mono py-1 border-b border-white/5 last:border-0">
                        {r.file.split('/').pop()} — {r.owner} ({Math.round(r.bus_risk * 100)}% bus risk)
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Circular deps */}
            {result.new_circular_deps.length > 0 && (
              <div className="glass rounded-2xl p-6 border border-red-500/20 animate-in delay-4">
                <div className="flex items-center gap-2 mb-4">
                  <div className="p-1.5 rounded-lg bg-red-500/10">
                    <RefreshCw size={14} className="text-red-400" />
                  </div>
                  <span className="text-xs font-bold text-red-400 uppercase tracking-widest">
                    Circular Dependencies Introduced ({result.new_circular_deps.length})
                  </span>
                </div>
                <div className="space-y-1">
                  {result.new_circular_deps.map((dep, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs font-mono text-red-300 bg-red-500/5 rounded px-3 py-1.5">
                      <XCircle size={10} /> {dep}
                    </div>
                  ))}
                </div>
                <p className="text-xs text-red-400/70 mt-3">
                  These files are part of import cycles introduced by this PR. Resolve before merging.
                </p>
              </div>
            )}

            {/* Blast files */}
            {result.blast_files.length > 0 && (
              <div className="glass rounded-2xl p-6 animate-in delay-5">
                <div className="flex items-center gap-2 mb-4">
                  <div className="p-1.5 rounded-lg bg-yellow-500/10">
                    <Zap size={14} className="text-yellow-400" />
                  </div>
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                    Transitively Affected Files ({result.blast_files.length})
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5 max-h-48 overflow-y-auto">
                  {result.blast_files.map((f, i) => (
                    <div key={i} className="text-[10px] font-mono text-slate-500 bg-white/3 rounded px-2 py-1 truncate">
                      {f}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Open in DEX CTA */}
            <div className="glass rounded-2xl p-6 flex items-center justify-between animate-in delay-5">
              <div>
                <div className="text-sm font-semibold text-white mb-1">See the full knowledge graph</div>
                <div className="text-xs text-slate-500">Visualize every dependency and ownership relationship interactively.</div>
              </div>
              <Link
                href="/app"
                className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl transition-all"
              >
                Open Graph <ChevronRight size={14} />
              </Link>
            </div>

          </div>
        )}

        {/* Empty state */}
        {!result && !loading && !error && (
          <div className="text-center py-20 animate-in delay-2">
            <div className="inline-flex p-6 rounded-2xl bg-indigo-500/5 border border-indigo-500/10 mb-6">
              <GitPullRequest size={40} className="text-indigo-400/50" />
            </div>
            <h2 className="text-lg font-bold text-slate-400 mb-2">No PR Analyzed Yet</h2>
            <p className="text-sm text-slate-600 max-w-md mx-auto">
              Paste a public GitHub PR URL above, or switch to manual mode and enter changed file paths.
              DEX will compute blast radius, ownership, circular deps, and generate an AI summary.
            </p>
            <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-2xl mx-auto text-left">
              {[
                { icon: <Zap size={14} />, title: 'Blast Radius', desc: 'Every file affected by this change' },
                { icon: <Users size={14} />, title: 'Ownership Analysis', desc: 'Bus factor risks & reviewer suggestions' },
                { icon: <Sparkles size={14} />, title: 'AI Summary', desc: 'Plain-English review from DEX AI' },
              ].map((item, i) => (
                <div key={i} className="glass rounded-xl p-4">
                  <div className="text-indigo-400 mb-2">{item.icon}</div>
                  <div className="text-sm font-semibold text-slate-300 mb-1">{item.title}</div>
                  <div className="text-xs text-slate-600">{item.desc}</div>
                </div>
              ))}
            </div>
          </div>
        )}

      </main>
    </div>
    </AppShell>
  );
}

export default function PRReviewPage() {
  return (
    <Suspense fallback={
      <AppShell>
        <div className="flex min-h-[50vh] items-center justify-center bg-[#050508]">
          <div className="w-8 h-8 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
        </div>
      </AppShell>
    }>
      <PRReviewPageInner />
    </Suspense>
  );
}
