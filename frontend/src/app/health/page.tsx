'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { 
  ArrowLeft, RefreshCw, AlertTriangle, FileCode, Users, Activity, 
  GitBranch, TrendingUp, Shield, Zap, Code2, Github, 
  GitMerge, CheckCircle2, XCircle
} from 'lucide-react';
import { dexApi, HealthSummary, CycleDetected, GodObject, OrphanNode } from '@/lib/api';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Treemap,
  Cell
} from 'recharts';

// -----------------------------------------------------------------------------
// GLOBAL STYLES & ANIMATIONS (Clean GitHub/Dex Theme)
// -----------------------------------------------------------------------------
const GlobalStyles = () => (
  <style jsx global>{`
    @keyframes fade-in-up { 
      0% { opacity: 0; transform: translate3d(0, 20px, 0); } 
      100% { opacity: 1; transform: translate3d(0, 0, 0); } 
    }
    @keyframes fade-in-scale { 
      0% { opacity: 0; transform: scale3d(0.95, 0.95, 1); } 
      100% { opacity: 1; transform: scale3d(1, 1, 1); } 
    }
    @keyframes pulse-glow { 
      0%, 100% { opacity: 0.3; } 
      50% { opacity: 0.6; } 
    }
    @keyframes float { 
      0%, 100% { transform: translate3d(0, 0, 0); } 
      50% { transform: translate3d(0, -10px, 0); } 
    }
    @keyframes gradient-shift { 
      0% { background-position: 0% 50%; } 
      50% { background-position: 100% 50%; } 
      100% { background-position: 0% 50%; } 
    }
    @keyframes commit-pulse { 
      0%, 100% { opacity: 0.4; transform: scale(1); } 
      50% { opacity: 1; transform: scale(1.05); } 
    }
    @keyframes branch-flow {
      0% { stroke-dashoffset: 0; opacity: 0.3; }
      50% { opacity: 0.8; }
      100% { stroke-dashoffset: -20; opacity: 0.3; }
    }
    @keyframes code-scan {
      0% { transform: translateY(-100%); opacity: 0; }
      10% { opacity: 1; }
      90% { opacity: 1; }
      100% { transform: translateY(100%); opacity: 0; }
    }
    @keyframes rotate-slow {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
    @keyframes shimmer {
      0% { background-position: -1000px 0; }
      100% { background-position: 1000px 0; }
    }
    @keyframes glow-pulse {
      0%, 100% { opacity: 0.3; filter: blur(20px); }
      50% { opacity: 0.6; filter: blur(30px); }
    }
    
    .animate-fade-in { 
      animation: fade-in-up 0.6s cubic-bezier(0.4, 0, 0.2, 1) forwards; 
      opacity: 0;
      will-change: opacity, transform;
    }
    .animate-fade-in-scale { 
      animation: fade-in-scale 0.5s cubic-bezier(0.4, 0, 0.2, 1) forwards; 
      opacity: 0;
      will-change: opacity, transform;
    }
    .animate-float { 
      animation: float 6s ease-in-out infinite;
      will-change: transform;
      transform: translate3d(0, 0, 0);
    }
    .animate-pulse-glow { 
      animation: pulse-glow 3s ease-in-out infinite;
      will-change: opacity;
    }
    .animate-commit-pulse {
      animation: commit-pulse 2s ease-in-out infinite;
    }
    .delay-100 { animation-delay: 0.1s; }
    .delay-200 { animation-delay: 0.2s; }
    .delay-300 { animation-delay: 0.3s; }
    .delay-400 { animation-delay: 0.4s; }
    .delay-500 { animation-delay: 0.5s; }
    
    /* Custom Scrollbar */
    ::-webkit-scrollbar { width: 6px; }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.1); border-radius: 3px; }
    ::-webkit-scrollbar-thumb:hover { background: rgba(255, 255, 255, 0.15); }
    
    /* Glass Effects - Cleaner */
    .glass-panel {
      background: rgba(10, 10, 10, 0.6);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      border: 1px solid rgba(255, 255, 255, 0.06);
      will-change: transform;
      transform: translate3d(0, 0, 0);
    }
    
    .cyber-grid {
      background-size: 40px 40px;
      background-image: linear-gradient(to right, rgba(99, 102, 241, 0.02) 1px, transparent 1px),
                        linear-gradient(to bottom, rgba(99, 102, 241, 0.02) 1px, transparent 1px);
      mask-image: radial-gradient(ellipse at center, black 40%, transparent 80%);
      will-change: auto;
    }
    
    /* Gradient text */
    .gradient-text {
      background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #ec4899 100%);
      background-size: 200% 200%;
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      animation: gradient-shift 5s ease infinite;
      will-change: background-position;
    }
    
    /* Hover effects - Subtle */
    .hover-lift {
      transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.2s cubic-bezier(0.4, 0, 0.2, 1), border-color 0.2s ease;
      will-change: transform;
      transform: translate3d(0, 0, 0);
    }
    .hover-lift:hover {
      transform: translate3d(0, -2px, 0);
      box-shadow: 0 12px 24px rgba(0, 0, 0, 0.3);
      border-color: rgba(255, 255, 255, 0.12);
    }
    
    /* GitHub branch effect */
    .branch-line {
      stroke-dasharray: 5, 5;
      animation: branch-flow 3s linear infinite;
    }
    
    /* Code scan effect */
    .code-scan::after {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 2px;
      background: linear-gradient(90deg, transparent, rgba(99, 102, 241, 0.5), transparent);
      animation: code-scan 3s ease-in-out infinite;
    }
  `}</style>
);

// Health Score Gauge Component (Clean GitHub Style)
function HealthScoreGauge({ score }: { score: number }) {
  const getColor = (s: number) => {
    if (s >= 80) return '#10b981'; // emerald
    if (s >= 60) return '#f59e0b'; // amber
    return '#ef4444'; // red
  };

  const getLabel = (s: number) => {
    if (s >= 80) return 'Excellent';
    if (s >= 60) return 'Good';
    if (s >= 40) return 'Fair';
    return 'Critical';
  };

  const getIcon = (s: number) => {
    if (s >= 80) return <CheckCircle2 className="w-5 h-5" />;
    if (s >= 60) return <AlertTriangle className="w-5 h-5" />;
    return <XCircle className="w-5 h-5" />;
  };

  const angle = (score / 100) * 180;
  const radius = 70;
  const circumference = Math.PI * radius;
  const strokeDasharray = circumference;
  const strokeDashoffset = circumference - (angle / 180) * circumference;
  const color = getColor(score);

  return (
    <div className="flex flex-col items-center justify-center relative">
      <div className="relative w-40 h-28">
        <svg width="160" height="80" viewBox="0 0 160 80" className="transform -rotate-90">
          <path
            d="M 10 80 A 70 70 0 0 1 150 80"
            fill="none"
            stroke="rgba(255, 255, 255, 0.05)"
            strokeWidth="12"
            strokeLinecap="round"
          />
          <path
            d="M 10 80 A 70 70 0 0 1 150 80"
            fill="none"
            stroke={color}
            strokeWidth="12"
            strokeLinecap="round"
            strokeDasharray={strokeDasharray}
            strokeDashoffset={strokeDashoffset}
            className="transition-all duration-1000"
            style={{ filter: `drop-shadow(0 0 6px ${color}40)` }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center pt-6">
          <div className="flex items-center gap-2 mb-1">
            {getIcon(score)}
            <div className="text-3xl font-bold" style={{ color }}>
              {score}
            </div>
          </div>
          <div className="text-xs text-slate-400">{getLabel(score)}</div>
        </div>
      </div>
    </div>
  );
}

// Cycle Visualizer Component (Clean GitHub-style)
function CycleVisualizer({ cycles }: { cycles: CycleDetected[] }) {
  if (cycles.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-slate-400 py-12">
        <div className="text-center">
          <div className="relative inline-block mb-4">
            <GitBranch className="w-12 h-12 mx-auto opacity-30 animate-float" />
            <div className="absolute inset-0 flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6 text-emerald-400/60 animate-commit-pulse" />
            </div>
          </div>
          <p className="text-sm font-medium">No circular dependencies detected</p>
          <p className="text-xs text-slate-500 mt-1">Your codebase is clean!</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2 max-h-96 overflow-y-auto">
      {cycles.slice(0, 10).map((cycle, idx) => (
        <div
          key={idx}
          className="glass-panel rounded-lg p-3 hover-lift border-l-2 border-red-500/40 animate-fade-in group relative overflow-hidden"
          style={{ animationDelay: `${idx * 0.05}s` }}
        >
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-2">
              <GitBranch className="w-3.5 h-3.5 text-red-400/80" />
              <span className="text-xs text-slate-400 font-medium">Cycle #{idx + 1}</span>
              <span className="text-xs text-slate-600">•</span>
              <span className="text-xs text-slate-500">Depth: {cycle.depth}</span>
            </div>
            <div className="flex flex-wrap gap-1.5 text-sm">
              {cycle.cycle_path.map((node, i) => (
                <span key={i} className="flex items-center">
                  <code className="text-indigo-300/90 font-mono text-xs bg-slate-900/40 px-2 py-0.5 rounded border border-white/5 group-hover:border-indigo-500/30 transition-colors">
                    {node.split('/').pop() || node}
                  </code>
                  {i < cycle.cycle_path.length - 1 && (
                    <GitMerge className="w-3 h-3 mx-1 text-indigo-500/60" />
                  )}
                </span>
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function HealthDashboardPage() {
  const { data: session } = useSession();
  const [summary, setSummary] = useState<HealthSummary | null>(null);
  const [cycles, setCycles] = useState<CycleDetected[]>([]);
  const [godObjects, setGodObjects] = useState<GodObject[]>([]);
  const [orphans, setOrphans] = useState<OrphanNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchHealthData = async () => {
    try {
      setRefreshing(true);
      const [summaryData, cyclesData, godObjectsData, orphansData] = await Promise.all([
        dexApi.getHealthSummary(),
        dexApi.getCircularDependencies(),
        dexApi.getGodObjects(),
        dexApi.getOrphanNodes(),
      ]);
      setSummary(summaryData);
      setCycles(cyclesData);
      setGodObjects(godObjectsData);
      setOrphans(orphansData);
    } catch (e: any) {
      console.error("Failed to load health data", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchHealthData();
  }, []);

  // Prepare treemap data
  const treemapData = godObjects.slice(0, 20).map((obj) => ({
    name: obj.name.split('/').pop() || obj.name,
    value: obj.complexity_score,
    busRisk: obj.bus_risk_score || 0,
  }));

  const getTreemapColor = (busRisk: number) => {
    if (busRisk > 0.7) return '#ef4444';
    if (busRisk > 0.4) return '#f59e0b';
    return '#10b981';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050505] text-slate-200 overflow-x-hidden relative">
        <GlobalStyles />
        <div className="fixed inset-0 z-0 pointer-events-none">
          <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-indigo-900/8 blur-[120px] rounded-full mix-blend-screen opacity-40"></div>
          <div className="absolute top-[40%] right-[-10%] w-[40%] h-[40%] bg-emerald-900/5 blur-[100px] rounded-full mix-blend-screen opacity-30"></div>
          <div className="absolute inset-0 cyber-grid"></div>
        </div>
        <div className="flex items-center justify-center h-screen relative z-10">
          <div className="text-center">
            <div className="relative inline-block mb-6">
              <Github className="w-14 h-14 mx-auto text-indigo-400/80 animate-float" />
              <div className="absolute -top-1 -right-1">
                <div className="w-3 h-3 bg-emerald-400 rounded-full animate-commit-pulse"></div>
              </div>
            </div>
            <p className="text-slate-400 text-sm font-medium animate-pulse-glow">Analyzing codebase health...</p>
            <div className="mt-4 flex items-center justify-center gap-1">
              <div className="w-1.5 h-1.5 bg-indigo-400/60 rounded-full animate-pulse" style={{ animationDelay: '0s' }}></div>
              <div className="w-1.5 h-1.5 bg-indigo-400/60 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
              <div className="w-1.5 h-1.5 bg-indigo-400/60 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] text-slate-200 overflow-x-hidden relative selection:bg-indigo-500/30 selection:text-white font-sans">
      <GlobalStyles />
      
      {/* Dynamic Background - Subtle */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-indigo-900/8 blur-[120px] rounded-full mix-blend-screen opacity-40"></div>
        <div className="absolute top-[40%] right-[-10%] w-[40%] h-[40%] bg-emerald-900/5 blur-[100px] rounded-full mix-blend-screen opacity-30"></div>
        <div className="absolute bottom-[-20%] left-[20%] w-[60%] h-[40%] bg-violet-900/8 blur-[120px] rounded-full mix-blend-screen opacity-25"></div>
        <div className="absolute inset-0 cyber-grid"></div>
      </div>

      {/* Header - Cleaner */}
      <header className="fixed top-0 left-0 right-0 z-50 border-b border-white/5 bg-[#050505]/70 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link
                href="/app"
                className="p-1.5 hover:bg-white/5 rounded-lg transition-colors"
                aria-label="Back to dashboard"
              >
                <ArrowLeft className="w-4 h-4 text-slate-400" />
              </Link>
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 bg-indigo-500/10 rounded-lg border border-indigo-500/20">
                  <Activity className="w-5 h-5 text-indigo-400" />
                </div>
                <div>
                  <h1 className="text-lg font-semibold gradient-text">Health Dashboard</h1>
                  <p className="text-xs text-slate-500">Code quality & technical debt analysis</p>
                </div>
              </div>
            </div>
            <button
              onClick={fetchHealthData}
              disabled={refreshing}
              className="flex items-center gap-2 px-3 py-1.5 glass-panel rounded-lg transition-all hover-lift disabled:opacity-50 text-sm"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-rotate-slow' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-12 relative z-10">
        {summary && (
          <>
            {/* Top Row: Health Score + Stats - Cleaner */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              {/* Health Score */}
              <div className="glass-panel rounded-lg p-5 hover-lift animate-fade-in-scale code-scan relative">
                <div className="flex items-center gap-2 mb-3">
                  <Shield className="w-4 h-4 text-indigo-400" />
                  <div className="text-xs text-slate-500 font-medium">Health Score</div>
                </div>
                <HealthScoreGauge score={summary.score} />
              </div>

              {/* Stats Cards - Minimal */}
              <div className="glass-panel rounded-lg p-5 hover-lift animate-fade-in-scale delay-100">
                <div className="flex items-center gap-2 mb-3">
                  <FileCode className="w-4 h-4 text-indigo-400/80" />
                  <div className="text-xs text-slate-500 font-medium">Total Files</div>
                </div>
                <div className="text-2xl font-bold mb-1">{summary.total_files}</div>
                <div className="text-xs text-slate-600">Codebase size</div>
              </div>

              <div className="glass-panel rounded-lg p-5 hover-lift animate-fade-in-scale delay-200 border-l border-red-500/30">
                <div className="flex items-center gap-2 mb-3">
                  <AlertTriangle className="w-4 h-4 text-red-400/80" />
                  <div className="text-xs text-slate-500 font-medium">Critical Issues</div>
                </div>
                <div className="text-2xl font-bold text-red-400 mb-1">{summary.critical_issues}</div>
                <div className="text-xs text-slate-600">Requires attention</div>
              </div>

              <div className="glass-panel rounded-lg p-5 hover-lift animate-fade-in-scale delay-300 border-l border-amber-500/30">
                <div className="flex items-center gap-2 mb-3">
                  <Users className="w-4 h-4 text-amber-400/80" />
                  <div className="text-xs text-slate-500 font-medium">Bus Factor Risk</div>
                </div>
                <div className="text-2xl font-bold text-amber-400 mb-1">
                  {summary.bus_factor_risk.toFixed(2)}
                </div>
                <div className="text-xs text-slate-600">
                  {summary.bus_factor_risk < 0.3 ? 'Low' : summary.bus_factor_risk < 0.6 ? 'Medium' : 'High'} Risk
                </div>
              </div>
            </div>

            {/* Middle Row: Risk Treemap + God Objects - Cleaner */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
              {/* Risk Treemap */}
              <div className="glass-panel rounded-lg p-5 hover-lift animate-fade-in-scale delay-400">
                <div className="flex items-center gap-2 mb-3">
                  <TrendingUp className="w-4 h-4 text-emerald-400/80" />
                  <h2 className="text-base font-semibold">Risk Map</h2>
                </div>
                <p className="text-xs text-slate-500 mb-4">
                  Size = Complexity | Color = Bus Factor
                </p>
                {treemapData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={280}>
                    <Treemap
                      data={treemapData}
                      dataKey="value"
                      stroke="rgba(255, 255, 255, 0.05)"
                    >
                      {treemapData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={getTreemapColor(entry.busRisk)} />
                      ))}
                    </Treemap>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-[280px] text-slate-400">
                    <div className="text-center">
                      <Code2 className="w-10 h-10 mx-auto mb-2 opacity-40" />
                      <p className="text-sm">No data available</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Top God Objects */}
              <div className="glass-panel rounded-lg p-5 hover-lift animate-fade-in-scale delay-500">
                <div className="flex items-center gap-2 mb-3">
                  <Zap className="w-4 h-4 text-violet-400/80" />
                  <h2 className="text-base font-semibold">God Objects</h2>
                </div>
                <p className="text-xs text-slate-500 mb-4">
                  High coupling files (Fan-In + Fan-Out)
                </p>
                {godObjects.length > 0 ? (
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={godObjects.slice(0, 10)}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.03)" />
                      <XAxis 
                        dataKey="name" 
                        angle={-45}
                        textAnchor="end"
                        height={100}
                        tick={{ fill: '#64748b', fontSize: 9 }}
                      />
                      <YAxis tick={{ fill: '#64748b', fontSize: 10 }} />
                      <Tooltip
                        contentStyle={{ 
                          backgroundColor: 'rgba(5, 5, 5, 0.98)', 
                          border: '1px solid rgba(255, 255, 255, 0.08)',
                          borderRadius: '6px',
                          padding: '8px 12px'
                        }}
                        labelStyle={{ color: '#cbd5e1', fontSize: '11px' }}
                        itemStyle={{ color: '#e2e8f0', fontSize: '11px' }}
                      />
                      <Bar dataKey="complexity_score" fill="#6366f1" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-[280px] text-slate-400">
                    <div className="text-center">
                      <Zap className="w-10 h-10 mx-auto mb-2 opacity-40" />
                      <p className="text-sm">No god objects detected</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Bottom Row: Circular Dependencies - Cleaner */}
            <div className="glass-panel rounded-lg p-5 hover-lift animate-fade-in-scale delay-300 mb-6">
              <div className="flex items-center gap-2 mb-3">
                <GitBranch className="w-4 h-4 text-red-400/80" />
                <h2 className="text-base font-semibold">Circular Dependencies</h2>
                <span className="text-xs text-slate-500 ml-auto font-medium">
                  {cycles.length} {cycles.length === 1 ? 'cycle' : 'cycles'}
                </span>
              </div>
              <p className="text-xs text-slate-500 mb-4">
                Dependency cycles detected in your codebase
              </p>
              <CycleVisualizer cycles={cycles} />
            </div>

            {/* Summary Stats - Minimal */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="glass-panel rounded-lg p-4 hover-lift border-l border-red-500/30">
                <div className="flex items-center gap-2 mb-2">
                  <GitBranch className="w-3.5 h-3.5 text-red-400/80" />
                  <div className="text-xs text-slate-500 font-medium">Cycles</div>
                </div>
                <div className="text-xl font-bold text-red-400">{summary.cycles_count}</div>
              </div>
              <div className="glass-panel rounded-lg p-4 hover-lift border-l border-violet-500/30">
                <div className="flex items-center gap-2 mb-2">
                  <Zap className="w-3.5 h-3.5 text-violet-400/80" />
                  <div className="text-xs text-slate-500 font-medium">God Objects</div>
                </div>
                <div className="text-xl font-bold text-violet-400">{summary.god_objects_count}</div>
              </div>
              <div className="glass-panel rounded-lg p-4 hover-lift border-l border-slate-500/30">
                <div className="flex items-center gap-2 mb-2">
                  <Code2 className="w-3.5 h-3.5 text-slate-400/80" />
                  <div className="text-xs text-slate-500 font-medium">Orphan Nodes</div>
                </div>
                <div className="text-xl font-bold text-slate-400">{summary.orphans_count}</div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
