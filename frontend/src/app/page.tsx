"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { 
  Terminal, ArrowRight, Zap, GitBranch, ShieldCheck, Sparkles, 
  Quote, Network, Play, LogOut, Code, FileText, 
  Cpu, Search, CheckCircle, Command, Lock, Layers, 
  ChevronRight, Database, Github, Activity, Users, TrendingUp, Flame,
  GitCommit, MessageSquare, TreePine, GitMerge, Rocket, User
} from "lucide-react";
import { dexApi, ActiveZonesResponse, TeamTopologyResponse, ZoneData } from "@/lib/api";

// -----------------------------------------------------------------------------
// GLOBAL STYLES & ANIMATIONS (OPTIMIZED FOR PERFORMANCE)
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
    @keyframes scroll-left { 
      0% { transform: translate3d(0, 0, 0); } 
      100% { transform: translate3d(-50%, 0, 0); } 
    }
    @keyframes scan-line { 
      0% { transform: translate3d(0, 0%, 0); opacity: 0; } 
      10% { opacity: 1; } 
      90% { opacity: 1; } 
      100% { transform: translate3d(0, 100%, 0); opacity: 0; } 
    }
    @keyframes typing { from { width: 0 } to { width: 100% } }
    @keyframes blink { 50% { border-color: transparent } }
    @keyframes float { 
      0%, 100% { transform: translate3d(0, 0, 0); } 
      50% { transform: translate3d(0, -10px, 0); } 
    }
    @keyframes pulse-glow { 
      0%, 100% { opacity: 0.3; } 
      50% { opacity: 0.6; } 
    }
    @keyframes shimmer { 
      0% { transform: translate3d(-1000px, 0, 0); } 
      100% { transform: translate3d(1000px, 0, 0); } 
    }
    @keyframes gradient-shift { 
      0% { background-position: 0% 50%; } 
      50% { background-position: 100% 50%; } 
      100% { background-position: 0% 50%; } 
    }
    @keyframes particle-float { 
      0% { transform: translate3d(0, 0, 0) rotate(0deg); opacity: 0; } 
      10% { opacity: 1; } 
      90% { opacity: 1; } 
      100% { transform: translate3d(50px, -100vh, 0) rotate(360deg); opacity: 0; } 
    }
    @keyframes commit-pulse { 
      0%, 100% { opacity: 0.4; transform: scale(1); } 
      50% { opacity: 1; transform: scale(1.1); } 
    }
    @keyframes tree-grow {
      0% { transform: scaleY(0); opacity: 0; }
      100% { transform: scaleY(1); opacity: 1; }
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
    .animate-scroll-left { 
      animation: scroll-left 40s linear infinite;
      will-change: transform;
      transform: translate3d(0, 0, 0);
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
    .delay-100 { animation-delay: 0.1s; }
    .delay-200 { animation-delay: 0.2s; }
    .delay-300 { animation-delay: 0.3s; }
    .delay-400 { animation-delay: 0.4s; }
    .delay-500 { animation-delay: 0.5s; }
    
    /* Custom Scrollbar */
    ::-webkit-scrollbar { width: 8px; }
    ::-webkit-scrollbar-track { background: #050505; }
    ::-webkit-scrollbar-thumb { background: #333; border-radius: 4px; }
    ::-webkit-scrollbar-thumb:hover { background: #444; }

    /* Glass Effects - Optimized */
    .glass-panel {
      background: rgba(10, 10, 10, 0.7);
      backdrop-filter: blur(6px);
      -webkit-backdrop-filter: blur(6px);
      border: 1px solid rgba(255, 255, 255, 0.08);
      will-change: transform;
      transform: translate3d(0, 0, 0);
    }
    
    .cyber-grid {
      background-size: 50px 50px;
      background-image: linear-gradient(to right, rgba(99, 102, 241, 0.03) 1px, transparent 1px),
                        linear-gradient(to bottom, rgba(99, 102, 241, 0.03) 1px, transparent 1px);
      mask-image: radial-gradient(ellipse at center, black 30%, transparent 70%);
      will-change: auto;
    }
    
    /* Hover effects - GPU accelerated */
    .hover-lift {
      transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.2s cubic-bezier(0.4, 0, 0.2, 1);
      will-change: transform;
      transform: translate3d(0, 0, 0);
    }
    .hover-lift:hover {
      transform: translate3d(0, -4px, 0);
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4);
    }
    
    /* Gradient text - Optimized */
    .gradient-text {
      background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #ec4899 100%);
      background-size: 200% 200%;
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      animation: gradient-shift 5s ease infinite;
      will-change: background-position;
    }
    
    /* Performance optimizations */
    * {
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
    }
    
    /* Reduce motion for accessibility */
    @media (prefers-reduced-motion: reduce) {
      *,
      *::before,
      *::after {
        animation-duration: 0.01ms !important;
        animation-iteration-count: 1 !important;
        transition-duration: 0.01ms !important;
      }
    }
  `}</style>
);

// -----------------------------------------------------------------------------
// COMPONENT: COMMAND PALETTE SIMULATOR (HERO)
// -----------------------------------------------------------------------------
const CommandPaletteSimulation = () => {
  const [step, setStep] = useState(0);
  const queries = [
    "Explain the checkout authentication flow...",
    "Where is the memory leak in the socket connection?",
    "Generate a refactoring plan for api/utils.ts",
    "Map all dependencies for the UserSchema"
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setStep((prev) => (prev + 1) % queries.length);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="absolute top-[-60px] md:top-[-80px] left-1/2 -translate-x-1/2 w-[95%] max-w-xl z-20 pointer-events-none hidden md:block animate-float">
      <div className="relative rounded-xl bg-[#0F0F10] border border-white/10 shadow-[0_20px_60px_rgba(0,0,0,0.9)] overflow-hidden backdrop-blur-sm ring-1 ring-white/5" style={{ willChange: 'transform', transform: 'translate3d(0, 0, 0)' }}>
        <div className="flex items-center gap-3 px-4 py-3 border-b border-white/5 bg-white/[0.02]">
          <Search size={16} className="text-indigo-400" />
          <div className="h-5 flex items-center overflow-hidden w-full">
            <span key={step} className="text-sm text-slate-200 whitespace-nowrap animate-[typing_2s_steps(40)_forwards]">
              {queries[step]}
            </span>
            <span className="w-1.5 h-4 bg-indigo-500 ml-1 animate-[blink_1s_infinite]"></span>
          </div>
          <div className="ml-auto flex gap-1.5 opacity-50">
             <span className="text-[10px] bg-white/10 px-1.5 py-0.5 rounded text-slate-400 border border-white/5">⌘</span>
             <span className="text-[10px] bg-white/10 px-1.5 py-0.5 rounded text-slate-400 border border-white/5">K</span>
          </div>
        </div>
        {/* Results Simulation */}
        <div className="px-2 py-2 flex flex-col gap-1 bg-[#050505]/50">
          <div className="px-3 py-2.5 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Sparkles size={14} className="text-indigo-400" />
              <span className="text-xs font-medium text-indigo-100">Analyzing codebase context...</span>
            </div>
            <div className="flex gap-1">
              <span className="w-1 h-1 bg-indigo-400 rounded-full animate-bounce delay-0"></span>
              <span className="w-1 h-1 bg-indigo-400 rounded-full animate-bounce delay-100"></span>
              <span className="w-1 h-1 bg-indigo-400 rounded-full animate-bounce delay-200"></span>
            </div>
          </div>
          <div className="px-3 py-2 rounded-lg hover:bg-white/5 flex items-center gap-3 opacity-50">
             <FileText size={14} className="text-slate-500" />
             <span className="text-xs text-slate-400">src/auth/middleware.ts</span>
          </div>
        </div>
      </div>
    </div>
  );
};

// -----------------------------------------------------------------------------
// COMPONENT: LIVE CHAT DEMO
// -----------------------------------------------------------------------------
const ChatDemo = () => {
    return (
        <div className="w-full h-full rounded-xl border border-white/10 bg-[#080808] flex flex-col relative overflow-hidden shadow-2xl">
            {/* Header */}
            <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
                <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_#10b981]"></div>
                    <span className="text-xs font-bold text-slate-300 tracking-wide">DEX ASSISTANT</span>
                </div>
                <Terminal size={12} className="text-slate-600" />
            </div>
            
            {/* Messages */}
            <div className="flex-1 p-4 space-y-4 font-mono text-xs">
                {/* User Message */}
                <div className="flex justify-end">
                    <div className="bg-indigo-600/20 border border-indigo-500/30 text-indigo-100 px-3 py-2 rounded-l-lg rounded-tr-lg max-w-[85%]">
                        How does the retry logic in <span className="text-indigo-300 bg-indigo-500/20 px-1 rounded">api.ts</span> handle 429 errors?
                    </div>
                </div>

                {/* AI Response */}
                <div className="flex justify-start relative">
                    <div className="absolute -left-2 top-0 bottom-0 w-1 bg-gradient-to-b from-indigo-500 to-transparent opacity-50"></div>
                    <div className="pl-3 text-slate-300 max-w-[90%] space-y-2">
                        <p>Based on <span className="text-emerald-400 underline decoration-dotted underline-offset-2">src/utils/api.ts</span> lines 45-62:</p>
                        <p>The <span className="text-slate-100">fetchWithRetry</span> function uses exponential backoff.</p>
                        <div className="bg-[#020202] border border-white/10 p-2 rounded text-slate-400 overflow-x-hidden">
                            <span className="text-purple-400">if</span> (status === 429) {'{'}<br/>
                            &nbsp;&nbsp;<span className="text-blue-400">const</span> delay = base * Math.pow(2, attempt);<br/>
                            &nbsp;&nbsp;<span className="text-yellow-400">await</span> wait(delay);<br/>
                            {'}'}
                        </div>
                        <p>Note: It caps at 5 retries by default.</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

// -----------------------------------------------------------------------------
// COMPONENT: TECH STACK TICKER (Optimized)
// -----------------------------------------------------------------------------
const TechTicker = () => {
    const stack = ["Next.js", "TypeScript", "Python", "Rust", "Docker", "Kubernetes", "AWS", "TensorFlow", "PostgreSQL", "GraphQL", "GoLang", "Terraform"];
    return (
        <div className="w-full border-y border-white/5 bg-[#050505]/50 backdrop-blur-sm overflow-hidden py-3" style={{ contain: 'layout style paint' }}>
             <div className="flex animate-scroll-left whitespace-nowrap gap-12 items-center" style={{ willChange: 'transform' }}>
                {[...stack, ...stack, ...stack].map((tech, i) => (
                    <span key={i} className="text-xs font-bold uppercase tracking-widest text-slate-600 hover:text-indigo-400 transition-colors cursor-default" style={{ willChange: 'color' }}>
                        {tech}
                    </span>
                ))}
             </div>
        </div>
    );
};

// -----------------------------------------------------------------------------
// COMPONENT: GITHUB-STYLE COMMIT ACTIVITY GRID
// -----------------------------------------------------------------------------
const GitHubActivityGrid = () => {
  const [mounted, setMounted] = useState(false);
  const weeks = 52;
  const daysPerWeek = 7;
  
  // Generate random commit data (0-4 commits per day)
  const [commitData, setCommitData] = useState<number[][]>([]);

  useEffect(() => {
    setMounted(true);
    // Generate random commit data
    const data: number[][] = [];
    for (let week = 0; week < weeks; week++) {
      const weekData: number[] = [];
      for (let day = 0; day < daysPerWeek; day++) {
        weekData.push(Math.floor(Math.random() * 5)); // 0-4 commits
      }
      data.push(weekData);
    }
    setCommitData(data);
  }, []);

  const getIntensity = (count: number) => {
    if (count === 0) return 'bg-[#161b22] border border-[#30363d]';
    if (count === 1) return 'bg-[#0e4429] border border-[#1a7f37] animate-[commit-pulse_2s_ease-in-out_infinite]';
    if (count === 2) return 'bg-[#006d32] border border-[#238636] animate-[commit-pulse_1.5s_ease-in-out_infinite]';
    if (count === 3) return 'bg-[#26a641] border border-[#2ea043] animate-[commit-pulse_1s_ease-in-out_infinite]';
    return 'bg-[#39d353] border border-[#3fb950] animate-[commit-pulse_0.8s_ease-in-out_infinite]';
  };

  if (!mounted) return null;

  return (
    <div className="w-full rounded-xl border border-white/10 bg-[#0A0A0A] p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Github size={18} className="text-slate-400" />
          <h3 className="text-sm font-semibold text-white">Repository Activity</h3>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span>Less</span>
          <div className="flex gap-1">
            <div className="w-3 h-3 rounded bg-[#161b22] border border-[#30363d]"></div>
            <div className="w-3 h-3 rounded bg-[#0e4429] border border-[#1a7f37]"></div>
            <div className="w-3 h-3 rounded bg-[#006d32] border border-[#238636]"></div>
            <div className="w-3 h-3 rounded bg-[#26a641] border border-[#2ea043]"></div>
            <div className="w-3 h-3 rounded bg-[#39d353] border border-[#3fb950]"></div>
          </div>
          <span>More</span>
        </div>
      </div>
      <div className="flex gap-1 overflow-x-auto pb-2">
        {commitData.map((week, weekIdx) => (
          <div key={weekIdx} className="flex flex-col gap-1">
            {week.map((count, dayIdx) => (
              <div
                key={dayIdx}
                className={`w-3 h-3 rounded ${getIntensity(count)} transition-all duration-300 hover:scale-125 hover:z-10 cursor-pointer`}
                title={`${count} commit${count !== 1 ? 's' : ''}`}
              />
            ))}
          </div>
        ))}
      </div>
      <div className="mt-4 flex items-center gap-4 text-xs text-slate-500">
        <div className="flex items-center gap-2">
          <GitCommit size={12} />
          <span>Real-time indexing</span>
        </div>
        <div className="flex items-center gap-2">
          <GitBranch size={12} />
          <span>Branch tracking</span>
        </div>
        <div className="flex items-center gap-2">
          <GitMerge size={12} />
          <span>Merge analysis</span>
        </div>
      </div>
    </div>
  );
};

// -----------------------------------------------------------------------------
// COMPONENT: DEPENDENCY TREE VISUALIZATION
// -----------------------------------------------------------------------------
const DependencyTreeVisual = () => {
  return (
    <div className="relative w-full h-full rounded-xl border border-white/10 bg-[#0A0A0A] p-6 overflow-hidden">
      <div className="flex items-center gap-2 mb-4">
        <TreePine size={18} className="text-emerald-400" />
        <h3 className="text-sm font-semibold text-white">Dependency Tree</h3>
      </div>
      <div className="relative h-48">
        <svg className="w-full h-full" viewBox="0 0 300 200" style={{ overflow: 'visible' }}>
          {/* Root node */}
          <circle cx="150" cy="20" r="12" fill="#6366f1" className="opacity-0 animate-[fade-in-scale_0.5s_ease-out_0.1s_forwards]" />
          <text x="150" y="45" textAnchor="middle" fill="#e2e8f0" fontSize="10" className="font-mono">app.tsx</text>
          
          {/* Level 1 nodes */}
          <line x1="150" y1="32" x2="80" y2="80" stroke="rgba(99, 102, 241, 0.4)" strokeWidth="2" className="opacity-0 animate-[tree-grow_0.6s_ease-out_0.2s_forwards]" style={{ transformOrigin: '150px 20px' }} />
          <line x1="150" y1="32" x2="150" y2="80" stroke="rgba(99, 102, 241, 0.4)" strokeWidth="2" className="opacity-0 animate-[tree-grow_0.6s_ease-out_0.3s_forwards]" style={{ transformOrigin: '150px 20px' }} />
          <line x1="150" y1="32" x2="220" y2="80" stroke="rgba(99, 102, 241, 0.4)" strokeWidth="2" className="opacity-0 animate-[tree-grow_0.6s_ease-out_0.4s_forwards]" style={{ transformOrigin: '150px 20px' }} />
          
          <circle cx="80" cy="80" r="10" fill="#8b5cf6" className="opacity-0 animate-[fade-in-scale_0.5s_ease-out_0.5s_forwards]" />
          <text x="80" y="100" textAnchor="middle" fill="#cbd5e1" fontSize="9" className="font-mono">api.ts</text>
          
          <circle cx="150" cy="80" r="10" fill="#8b5cf6" className="opacity-0 animate-[fade-in-scale_0.5s_ease-out_0.6s_forwards]" />
          <text x="150" y="100" textAnchor="middle" fill="#cbd5e1" fontSize="9" className="font-mono">utils.ts</text>
          
          <circle cx="220" cy="80" r="10" fill="#8b5cf6" className="opacity-0 animate-[fade-in-scale_0.5s_ease-out_0.7s_forwards]" />
          <text x="220" y="100" textAnchor="middle" fill="#cbd5e1" fontSize="9" className="font-mono">types.ts</text>
          
          {/* Level 2 nodes */}
          <line x1="80" y1="90" x2="50" y2="140" stroke="rgba(139, 92, 246, 0.3)" strokeWidth="1.5" className="opacity-0 animate-[tree-grow_0.5s_ease-out_0.8s_forwards]" style={{ transformOrigin: '80px 80px' }} />
          <line x1="80" y1="90" x2="110" y2="140" stroke="rgba(139, 92, 246, 0.3)" strokeWidth="1.5" className="opacity-0 animate-[tree-grow_0.5s_ease-out_0.9s_forwards]" style={{ transformOrigin: '80px 80px' }} />
          
          <circle cx="50" cy="140" r="8" fill="#ec4899" className="opacity-0 animate-[fade-in-scale_0.4s_ease-out_1s_forwards]" />
          <text x="50" y="160" textAnchor="middle" fill="#94a3b8" fontSize="8" className="font-mono">auth</text>
          
          <circle cx="110" cy="140" r="8" fill="#ec4899" className="opacity-0 animate-[fade-in-scale_0.4s_ease-out_1.1s_forwards]" />
          <text x="110" y="160" textAnchor="middle" fill="#94a3b8" fontSize="8" className="font-mono">db</text>
          
          <line x1="150" y1="90" x2="130" y2="140" stroke="rgba(139, 92, 246, 0.3)" strokeWidth="1.5" className="opacity-0 animate-[tree-grow_0.5s_ease-out_1s_forwards]" style={{ transformOrigin: '150px 80px' }} />
          <line x1="150" y1="90" x2="170" y2="140" stroke="rgba(139, 92, 246, 0.3)" strokeWidth="1.5" className="opacity-0 animate-[tree-grow_0.5s_ease-out_1.1s_forwards]" style={{ transformOrigin: '150px 80px' }} />
          
          <circle cx="130" cy="140" r="8" fill="#ec4899" className="opacity-0 animate-[fade-in-scale_0.4s_ease-out_1.2s_forwards]" />
          <text x="130" y="160" textAnchor="middle" fill="#94a3b8" fontSize="8" className="font-mono">helpers</text>
          
          <circle cx="170" cy="140" r="8" fill="#ec4899" className="opacity-0 animate-[fade-in-scale_0.4s_ease-out_1.3s_forwards]" />
          <text x="170" y="160" textAnchor="middle" fill="#94a3b8" fontSize="8" className="font-mono">validators</text>
        </svg>
      </div>
      <p className="text-xs text-slate-500 mt-4">
        Visualize how your code modules connect and depend on each other
      </p>
    </div>
  );
};

// -----------------------------------------------------------------------------
// COMPONENT: CHATBOT FEATURE HIGHLIGHT
// -----------------------------------------------------------------------------
const ChatbotFeature = () => {
  const [messages, setMessages] = useState([
    { role: 'user', text: 'How does authentication work?' },
    { role: 'ai', text: 'Based on src/auth/middleware.ts, the system uses JWT tokens...' }
  ]);

  return (
    <div className="w-full rounded-xl border border-white/10 bg-[#0A0A0A] p-6">
      <div className="flex items-center gap-2 mb-4">
        <MessageSquare size={18} className="text-indigo-400" />
        <h3 className="text-sm font-semibold text-white">AI Code Assistant</h3>
        <div className="ml-auto flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
          <span className="text-xs text-slate-500">Active</span>
        </div>
      </div>
      <div className="space-y-3 font-mono text-xs">
        {messages.map((msg, idx) => (
          <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] px-3 py-2 rounded-lg ${
              msg.role === 'user' 
                ? 'bg-indigo-600/20 border border-indigo-500/30 text-indigo-100' 
                : 'bg-white/5 border border-white/10 text-slate-300'
            }`}>
              {msg.role === 'ai' && (
                <div className="flex items-center gap-2 mb-1">
                  <Sparkles size={10} className="text-indigo-400" />
                  <span className="text-[10px] text-indigo-400">DEX AI</span>
                </div>
              )}
              <p>{msg.text}</p>
              {msg.role === 'ai' && (
                <div className="mt-2 pt-2 border-t border-white/5">
                  <p className="text-[10px] text-emerald-400">✓ Grounded in codebase</p>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-4 pt-4 border-t border-white/5">
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <Code size={12} />
          <span>Context-aware responses</span>
          <span className="mx-2">•</span>
          <FileText size={12} />
          <span>Code citations</span>
        </div>
      </div>
    </div>
  );
};

// -----------------------------------------------------------------------------
// COMPONENT: CLIENT-SIDE PARTICLES (Prevents hydration mismatch, Optimized)
// -----------------------------------------------------------------------------
const ParticleBackground = ({ count = 12, opacity = 0.3, minDuration = 10, maxDuration = 30 }: { count?: number; opacity?: number; minDuration?: number; maxDuration?: number }) => {
  const [particles, setParticles] = useState<Array<{ left: number; top: number; duration: number; delay: number }>>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Only generate particles on client side after mount
    setMounted(true);
    setParticles(
      Array.from({ length: count }, () => ({
        left: Math.random() * 100,
        top: Math.random() * 100,
        duration: minDuration + Math.random() * (maxDuration - minDuration),
        delay: Math.random() * 5,
      }))
    );
  }, [count, minDuration, maxDuration]);

  if (!mounted) {
    return null; // Don't render on server
  }

  return (
    <>
      {particles.map((particle, i) => (
        <div
          key={i}
          className="absolute w-1 h-1 bg-indigo-500/30 rounded-full"
          style={{
            left: `${particle.left}%`,
            top: `${particle.top}%`,
            animation: `particle-float ${particle.duration}s linear infinite`,
            animationDelay: `${particle.delay}s`,
            opacity: opacity,
            willChange: 'transform, opacity',
            transform: 'translate3d(0, 0, 0)',
            contain: 'layout style paint',
          }}
        />
      ))}
    </>
  );
};

// -----------------------------------------------------------------------------
// COMPONENT: INSIGHTS PREVIEW - ACTIVITY
// -----------------------------------------------------------------------------
const ActivityInsightsPreview = () => {
  const [zones, setZones] = useState<ZoneData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchPreview() {
      try {
        const data = await dexApi.getActiveZones(30);
        setZones(data.zones.slice(0, 6)); // Show top 6
      } catch (e) {
        console.error("Failed to load activity preview", e);
      } finally {
        setLoading(false);
      }
    }
    fetchPreview();
  }, []);

  const getZoneColor = (intensity: 'High' | 'Low', value: number) => {
    if (intensity === 'High') {
      return `rgba(239, 68, 68, ${Math.min(0.4 + (value / 50), 0.9)})`;
    }
    return `rgba(99, 102, 241, ${Math.min(0.2 + (value / 20), 0.6)})`;
  };

  return (
    <div>
      <Link href="/insights/activity" className="group block">
        <div className="relative rounded-2xl border border-white/10 bg-[#0A0A0A] overflow-hidden hover:border-indigo-500/30 transition-all duration-300 hover-lift">
          <div className="absolute inset-0 bg-gradient-to-br from-red-500/5 to-indigo-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
          <div className="p-6 relative z-10">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-red-500/20 flex items-center justify-center text-red-400 group-hover:scale-110 transition-transform">
                  <Activity size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Activity Heatmap</h3>
                  <p className="text-xs text-slate-500">Repository hotspots & coldspots</p>
                </div>
              </div>
              <ArrowRight size={18} className="text-slate-600 group-hover:text-indigo-400 group-hover:translate-x-1 transition-all" />
            </div>
            
            {loading ? (
              <div className="grid grid-cols-3 gap-2 animate-pulse">
                {[1,2,3,4,5,6].map(i => (
                  <div key={i} className="h-16 bg-white/5 rounded-lg"></div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {zones.map((zone, idx) => (
                  <div
                    key={idx}
                    className="relative h-16 rounded-lg border border-white/5 overflow-hidden group/item"
                    style={{ backgroundColor: getZoneColor(zone.intensity, zone.value) + '20' }}
                  >
                    <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent"></div>
                    <div className="relative p-2 h-full flex flex-col justify-between">
                      <div className="flex items-center justify-between">
                        {zone.intensity === 'High' && (
                          <Flame size={12} className="text-red-400 animate-pulse" />
                        )}
                        <span className="text-xs font-bold text-white">{zone.value}</span>
                      </div>
                      <p className="text-[10px] text-slate-300 truncate">{zone.name.split('/').pop()}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </Link>
    </div>
  );
};

// -----------------------------------------------------------------------------
// COMPONENT: INSIGHTS PREVIEW - TEAM
// -----------------------------------------------------------------------------
const TeamInsightsPreview = () => {
  const [teamData, setTeamData] = useState<TeamTopologyResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchPreview() {
      try {
        const data = await dexApi.getTeamTopology();
        setTeamData(data);
      } catch (e) {
        console.error("Failed to load team preview", e);
      } finally {
        setLoading(false);
      }
    }
    fetchPreview();
  }, []);

  return (
    <div>
      <Link href="/insights/team" className="group block">
        <div className="relative rounded-2xl border border-white/10 bg-[#0A0A0A] overflow-hidden hover:border-indigo-500/30 transition-all duration-300 hover-lift">
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
          <div className="p-6 relative z-10">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-indigo-500/20 flex items-center justify-center text-indigo-400 group-hover:scale-110 transition-transform">
                  <Users size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Team Network</h3>
                  <p className="text-xs text-slate-500">Collaboration patterns</p>
                </div>
              </div>
              <ArrowRight size={18} className="text-slate-600 group-hover:text-indigo-400 group-hover:translate-x-1 transition-all" />
            </div>
            
            {loading ? (
              <div className="h-48 bg-white/5 rounded-lg animate-pulse flex items-center justify-center">
                <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
              </div>
            ) : (
              <div className="relative h-48 rounded-lg bg-gradient-to-br from-indigo-900/20 to-purple-900/20 border border-white/5 overflow-hidden">
                {/* Simplified network visualization */}
                <svg className="w-full h-full" viewBox="0 0 400 200">
                  {/* Links */}
                  {teamData?.links.slice(0, 8).map((link, i) => {
                    const source = teamData.nodes.find(n => n.id === link.source);
                    const target = teamData.nodes.find(n => n.id === link.target);
                    if (!source || !target) return null;
                    return (
                      <line
                        key={i}
                        x1={100 + (i % 4) * 80}
                        y1={50 + Math.floor(i / 4) * 100}
                        x2={120 + (i % 4) * 80}
                        y2={70 + Math.floor(i / 4) * 100}
                        stroke="rgba(99, 102, 241, 0.4)"
                        strokeWidth="2"
                      />
                    );
                  })}
                  {/* Nodes */}
                  {teamData?.nodes.slice(0, 6).map((node, i) => (
                    <g key={i}>
                      <circle
                        cx={80 + (i % 3) * 120}
                        cy={60 + Math.floor(i / 3) * 100}
                        r="12"
                        fill="#6366f1"
                        className="group-hover:scale-125 transition-transform"
                      />
                      <text
                        x={80 + (i % 3) * 120}
                        y={60 + Math.floor(i / 3) * 100 + 25}
                        textAnchor="middle"
                        fill="#e2e8f0"
                        fontSize="10"
                        className="font-medium"
                      >
                        {node.id.split(' ')[0]}
                      </text>
                    </g>
                  ))}
                </svg>
                <div className="absolute bottom-2 right-2 text-xs text-slate-500">
                  {teamData?.nodes.length || 0} developers
                </div>
              </div>
            )}
          </div>
        </div>
      </Link>
    </div>
  );
};

// -----------------------------------------------------------------------------
// MAIN PAGE
// -----------------------------------------------------------------------------
export default function HomePage() {
  const { data: session } = useSession();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div className="min-h-screen bg-[#050505] text-slate-200 overflow-x-hidden relative selection:bg-indigo-500/30 selection:text-white font-sans">
      <GlobalStyles />
      
      {/* Dynamic Background - Optimized blur */}
      <div className="fixed inset-0 z-0 pointer-events-none" style={{ contain: 'layout style paint', willChange: 'auto' }}>
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-indigo-900/10 blur-[100px] rounded-full mix-blend-screen opacity-50" style={{ willChange: 'auto' }}></div>
        <div className="absolute top-[40%] right-[-10%] w-[40%] h-[40%] bg-emerald-900/5 blur-[80px] rounded-full mix-blend-screen opacity-40" style={{ willChange: 'auto' }}></div>
        <div className="absolute bottom-[-20%] left-[20%] w-[60%] h-[40%] bg-violet-900/10 blur-[100px] rounded-full mix-blend-screen opacity-30" style={{ willChange: 'auto' }}></div>
        <div className="absolute inset-0 cyber-grid" style={{ willChange: 'auto' }}></div>
      </div>

      {/* --- HEADER --- */}
      <header className="fixed top-0 left-0 right-0 z-50 border-b border-white/5 bg-[#050505]/80 backdrop-blur-sm" style={{ willChange: 'auto', transform: 'translate3d(0, 0, 0)' }}>
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 h-16">
          <Link href="/" className="group inline-flex items-center gap-3">
            <span className="relative flex items-center justify-center h-8 w-8 rounded bg-[#0A0A0A] border border-white/10 group-hover:border-indigo-500/50 transition-colors shadow-[0_0_15px_rgba(0,0,0,0.5)]">
               <Terminal className="text-white relative z-10 group-hover:text-indigo-400 transition-colors" size={16} />
            </span>
            <span className="text-sm font-bold tracking-[0.2em] text-white">DEX</span>
          </Link>
          <div className="hidden md:flex items-center gap-8 text-xs font-medium text-slate-400">
             <Link href="#how-it-works" className="hover:text-white transition-colors">Methodology</Link>
             <Link href="#features" className="hover:text-white transition-colors">Features</Link>
             <Link href="#insights" className="hover:text-white transition-colors">Insights</Link>
             <Link href="/security" className="hover:text-white transition-colors">Security</Link>
             <Link href="/about" className="hover:text-white transition-colors">About</Link>
             <Link href="/grievance" className="hover:text-white transition-colors">Contact</Link>
          </div>
          <div className="flex items-center gap-4">
            {session?.user ? (
              <div className="flex items-center gap-3">
                 <Link 
                   href="/profile" 
                   className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 hover:bg-indigo-500/20 transition-all"
                   title="View Profile"
                 >
                   <User size={14} className="text-indigo-400" />
                   <span className="text-xs text-indigo-300 font-medium">Profile</span>
                 </Link>
                 <div className="flex items-center gap-3 bg-white/5 px-3 py-1.5 rounded-full border border-white/5">
                   <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                   <span className="text-xs text-slate-300 max-w-[100px] truncate">{session.user.email}</span>
                   <button onClick={() => signOut()} className="text-slate-500 hover:text-white ml-1"><LogOut size={12} /></button>
                 </div>
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

      <main className="relative pt-24 pb-20">
        
        {/* ===========================================================================
            ZONE 1: HERO
        ============================================================================ */}
        <section className="relative mx-auto max-w-5xl px-6 pt-24 pb-20 text-center z-10">
          
          <CommandPaletteSimulation />

          {/* Launch Badge */}
          <div className="animate-fade-in inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/5 px-3 py-1 mb-8 backdrop-blur-sm">
             <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
             </span>
             <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-300">
                Public Beta Live
             </span>
          </div>

          <h1 className="animate-fade-in delay-100 text-5xl sm:text-7xl font-semibold tracking-tight text-white max-w-4xl mx-auto leading-[1.1] relative drop-shadow-2xl mb-8">
            Instant intelligence for <br className="hidden md:block"/>
            <span className="text-transparent bg-clip-text bg-gradient-to-b from-indigo-300 via-white to-slate-400 bg-[length:200%_200%] animate-gradient-shift">
               complex codebases
            </span>
            <span className="text-indigo-500 animate-pulse">.</span>
          </h1>

          <p className="animate-fade-in delay-200 max-w-2xl mx-auto text-base sm:text-lg leading-relaxed text-slate-400 font-light mb-6">
            DEX indexes your repository into a semantic graph, allowing you to debug, refactor, and onboard 10x faster using context-aware AI.
          </p>
          
          <p className="animate-fade-in delay-200 max-w-2xl mx-auto text-sm leading-relaxed text-slate-500 mb-6">
            Connect your GitHub repository, watch DEX build a comprehensive dependency tree, and interact with an AI assistant that understands your entire codebase structure—not just isolated snippets.
          </p>

          {!session?.user && (
            <>
              <p className="animate-fade-in delay-200 max-w-2xl mx-auto text-xs leading-relaxed text-slate-600 mb-10">
                <span className="text-indigo-400 font-semibold">Sign up</span> for the best experience with full access to all features.
              </p>

              <div className="animate-fade-in delay-300 flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link href="/app" className="group relative w-full sm:w-auto overflow-hidden rounded-xl bg-indigo-600 text-white px-8 py-3.5 transition-all hover:bg-indigo-500 hover:shadow-[0_0_40px_rgba(99,102,241,0.4)] hover:scale-105">
                  <span className="relative z-10 flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-widest">
                    <Rocket size={14} className="group-hover:scale-110 transition-transform" />
                    Launch App
                    <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                  </span>
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
                </Link>
                <Link href="/signup" className="group relative w-full sm:w-auto overflow-hidden rounded-xl bg-white text-black px-8 py-3.5 transition-all hover:bg-slate-200 hover:shadow-[0_0_40px_rgba(255,255,255,0.2)] hover:scale-105">
                  <span className="relative z-10 flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-widest">
                    Start for free <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                  </span>
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
                </Link>
                <Link href="#demo" className="group w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-8 py-3.5 text-xs font-bold uppercase tracking-widest text-slate-300 hover:bg-white/10 hover:text-white hover:border-indigo-500/30 transition-all backdrop-blur-sm hover:scale-105">
                  <Github size={14} className="group-hover:rotate-12 transition-transform" /> Connect GitHub
                </Link>
              </div>
            </>
          )}
          {session?.user && (
            <div className="animate-fade-in delay-300 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/app" className="group relative w-full sm:w-auto overflow-hidden rounded-xl bg-indigo-600 text-white px-8 py-3.5 transition-all hover:bg-indigo-500 hover:shadow-[0_0_40px_rgba(99,102,241,0.4)] hover:scale-105">
                <span className="relative z-10 flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-widest">
                  <Rocket size={14} className="group-hover:scale-110 transition-transform" />
                  Go to Dashboard
                  <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                </span>
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
              </Link>
            </div>
          )}
        </section>

        <TechTicker />

        {/* ===========================================================================
            ZONE 1.5: GITHUB, TREE & CHATBOT SHOWCASE
        ============================================================================ */}
        <section className="mx-auto max-w-6xl px-6 py-20 relative">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 rounded-full border border-indigo-500/20 bg-indigo-500/5 px-3 py-1 mb-6 backdrop-blur-sm">
              <Github size={14} className="text-indigo-400" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-300">
                Live Integration
              </span>
            </div>
            <h2 className="text-3xl md:text-4xl font-semibold text-white mb-4">
              See Your Codebase <span className="gradient-text">Come Alive</span>
            </h2>
            <p className="text-slate-400 max-w-2xl mx-auto text-base">
              DEX continuously monitors your GitHub activity, maps dependencies in real-time, and provides intelligent code insights through natural language conversations.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {/* GitHub Activity Grid */}
            <div className="md:col-span-2">
              <GitHubActivityGrid />
            </div>

            {/* Chatbot Feature */}
            <div>
              <ChatbotFeature />
            </div>
          </div>

          {/* Dependency Tree - Full Width Below */}
          <div className="mt-6">
            <DependencyTreeVisual />
          </div>

          {/* Feature Highlights */}
          <div className="grid md:grid-cols-3 gap-6 mt-8">
            <div className="p-6 rounded-xl border border-white/10 bg-[#0A0A0A] hover:border-indigo-500/30 transition-all hover-lift">
              <div className="w-10 h-10 rounded-lg bg-indigo-500/20 flex items-center justify-center text-indigo-400 mb-4">
                <Github size={20} />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">GitHub Integration</h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                One-click connection to your repositories. DEX automatically syncs commits, branches, and pull requests, building a living map of your code evolution.
              </p>
            </div>

            <div className="p-6 rounded-xl border border-white/10 bg-[#0A0A0A] hover:border-emerald-500/30 transition-all hover-lift">
              <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center text-emerald-400 mb-4">
                <TreePine size={20} />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">Dependency Trees</h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                Visualize complex relationships between modules, functions, and data structures. Understand impact before refactoring and trace dependencies across your entire codebase.
              </p>
            </div>

            <div className="p-6 rounded-xl border border-white/10 bg-[#0A0A0A] hover:border-purple-500/30 transition-all hover-lift">
              <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center text-purple-400 mb-4">
                <MessageSquare size={20} />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">AI Chatbot</h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                Ask questions in plain English. Get answers grounded in your actual code with file references, line numbers, and dependency context. No hallucinations, just facts.
              </p>
            </div>
          </div>
        </section>

        {/* ===========================================================================
            ZONE 2: THE PROBLEM / SOLUTION (Split View)
        ============================================================================ */}
        <section id="how-it-works" className="py-24 relative overflow-hidden">
            <div className="mx-auto max-w-6xl px-6">
                <div className="grid md:grid-cols-2 gap-16 items-center">
                    
                    {/* Left: Copy */}
                    <div className="space-y-8">
                        <div>
                            <div className="text-indigo-400 font-mono text-xs mb-4 flex items-center gap-2">
                                <span className="w-4 h-px bg-indigo-400"></span> METHODOLOGY
                            </div>
                            <h2 className="text-3xl md:text-4xl font-semibold text-white mb-4">Not just RAG.<br/>Deep Graph Understanding.</h2>
                            <p className="text-slate-400 leading-relaxed mb-4">
                                Traditional AI tools only read snippets of text. DEX builds an 
                                <span className="text-white font-medium"> Abstract Syntax Tree (AST)</span> and a 
                                <span className="text-white font-medium"> Dependency Graph</span> of your entire project.
                            </p>
                            <p className="text-slate-500 text-sm leading-relaxed">
                                When you ask "How does authentication work?", DEX doesn't just search for keywords. It traverses the dependency graph, follows imports, understands type relationships, and provides a complete picture of how authentication flows through your codebase—from middleware to database queries.
                            </p>
                        </div>

                        <div className="space-y-4">
                             {[
                                { title: "Full Context Window", desc: "References imports, definitions, and types across files.", icon: CheckCircle, colorClass: "text-emerald-500", borderClass: "hover:border-emerald-500/30" },
                                { title: "Zero Hallucinations", desc: "Answers are grounded in your actual code, with citations.", icon: CheckCircle, colorClass: "text-indigo-500", borderClass: "hover:border-indigo-500/30" },
                                { title: "Secure by Design", desc: "Code is indexed locally or in an ephemeral enclave.", icon: ShieldCheck, colorClass: "text-emerald-500", borderClass: "hover:border-emerald-500/30" }
                             ].map((item, i) => {
                                const Icon = item.icon;
                                return (
                                 <div key={i} className={`flex gap-4 p-4 rounded-xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.05] ${item.borderClass} transition-all duration-300 hover-lift`}>
                                     <div className="mt-1">
                                         <Icon size={18} className={`${item.colorClass} group-hover:scale-110 transition-transform`} />
                                     </div>
                                     <div>
                                         <h4 className="text-sm font-semibold text-white group-hover:text-slate-100 transition-colors">{item.title}</h4>
                                         <p className="text-xs text-slate-500 mt-1">{item.desc}</p>
                                     </div>
                                 </div>
                             )})}
                        </div>
                    </div>

                    {/* Right: The Demo UI */}
                    <div className="relative">
                        {/* Background glow - Optimized */}
                        <div className="absolute inset-0 bg-indigo-500/20 blur-[60px] rounded-full z-0 animate-pulse-glow" style={{ willChange: 'opacity', transform: 'translate3d(0, 0, 0)' }}></div>
                        <div className="relative z-10 grid gap-6">
                             {/* The Chat UI */}
                             <div className="translate-x-4 hover-lift">
                                <ChatDemo />
                             </div>
                             {/* Floating Elements */}
                             <div className="absolute -left-8 bottom-10 glass-panel p-4 rounded-lg shadow-xl animate-float hover:scale-105 transition-transform cursor-default" style={{ animationDelay: '1s' }}>
                                 <div className="flex items-center gap-3">
                                     <div className="bg-indigo-500/20 p-2 rounded text-indigo-400"><Cpu size={18} /></div>
                                     <div>
                                         <div className="text-[10px] uppercase text-slate-500 font-bold">Token Usage</div>
                                         <div className="text-sm font-mono text-white">4,203 ctx</div>
                                     </div>
                                 </div>
                             </div>
                             {/* Additional floating element */}
                             <div className="absolute -right-8 top-20 glass-panel p-3 rounded-lg shadow-xl animate-float hover:scale-105 transition-transform cursor-default" style={{ animationDelay: '2s' }}>
                                 <div className="flex items-center gap-2">
                                     <Sparkles size={14} className="text-indigo-400" />
                                     <span className="text-xs text-slate-300 font-medium">AI Active</span>
                                 </div>
                             </div>
                        </div>
                    </div>

                </div>
            </div>
        </section>

        {/* ===========================================================================
            ZONE 3: FEATURES BENTO GRID
        ============================================================================ */}
        <section id="features" className="mx-auto max-w-6xl px-6 py-12" style={{ contain: 'layout style paint' }}>
            <div className="text-center mb-16">
                 <h2 className="text-3xl font-semibold text-white mb-4">Engineered for Engineers</h2>
                 <p className="text-slate-400 mb-2">Everything you need to navigate complexity.</p>
                 <p className="text-slate-500 text-sm max-w-2xl mx-auto">
                   From onboarding new team members to debugging production issues, DEX provides the context and insights you need to move fast without breaking things.
                 </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 auto-rows-[250px]" style={{ willChange: 'auto' }}>
                
                {/* Large Item 1: Visualization */}
                <div className="md:col-span-2 rounded-2xl border border-white/10 bg-[#0A0A0A] overflow-hidden relative group hover-lift" style={{ willChange: 'transform' }}>
                    <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                    <div className="p-8 relative z-10 h-full flex flex-col justify-between">
                         <div>
                            <div className="w-10 h-10 rounded-lg bg-indigo-500/20 flex items-center justify-center text-indigo-400 mb-4 group-hover:scale-110 transition-transform duration-200"><Network /></div>
                            <h3 className="text-xl font-bold text-white group-hover:text-indigo-300 transition-colors">Visual Dependency Mapping</h3>
                            <p className="text-slate-400 text-sm mt-2 max-w-sm">Instantly generate a visual map of how your modules, functions, and database schemas interact.</p>
                         </div>
                         {/* Abstract Vis - Static for performance */}
                         <div className="absolute right-0 bottom-0 w-1/2 h-full opacity-30 pointer-events-none border-l border-white/5 group-hover:opacity-50 transition-opacity">
                             {/* Static network visualization - no animations */}
                             <svg className="w-full h-full" viewBox="0 0 200 200" style={{ willChange: 'auto' }}>
                                 <path d="M20 180 Q 100 50 180 20" stroke="rgba(255,255,255,0.2)" fill="none" strokeWidth="2" className="group-hover:stroke-indigo-400 transition-colors" />
                                 <path d="M40 180 Q 100 100 160 20" stroke="rgba(99,102,241,0.4)" fill="none" strokeWidth="2" className="group-hover:stroke-indigo-300 transition-colors" />
                                 <circle cx="100" cy="100" r="4" fill="#6366f1" />
                             </svg>
                         </div>
                    </div>
                </div>

                {/* Tall Item: Security */}
                <div className="md:row-span-2 rounded-2xl border border-white/10 bg-[#0A0A0A] overflow-hidden relative group hover-lift" style={{ willChange: 'transform' }}>
                     <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 to-transparent"></div>
                     <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                     <div className="p-8 h-full flex flex-col relative z-10">
                        <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center text-emerald-400 mb-6 group-hover:scale-110 transition-transform duration-200"><Lock /></div>
                        <h3 className="text-xl font-bold text-white mb-2 group-hover:text-emerald-300 transition-colors">SOC2 Compliant</h3>
                        <p className="text-slate-400 text-sm mb-8">We take code security seriously. Your intellectual property never leaves the encrypted enclave.</p>
                        
                        <div className="mt-auto space-y-3">
                            <div className="flex items-center gap-3 text-xs text-slate-300 p-3 rounded bg-white/5 border border-white/5 group-hover:bg-emerald-500/10 group-hover:border-emerald-500/30 transition-all cursor-default">
                                <ShieldCheck size={14} className="text-emerald-500 group-hover:scale-110 transition-transform" /> End-to-End Encryption
                            </div>
                            <div className="flex items-center gap-3 text-xs text-slate-300 p-3 rounded bg-white/5 border border-white/5 group-hover:bg-emerald-500/10 group-hover:border-emerald-500/30 transition-all cursor-default">
                                <Database size={14} className="text-emerald-500 group-hover:scale-110 transition-transform" /> No Data Retention
                            </div>
                            <div className="flex items-center gap-3 text-xs text-slate-300 p-3 rounded bg-white/5 border border-white/5 group-hover:bg-emerald-500/10 group-hover:border-emerald-500/30 transition-all cursor-default">
                                <Layers size={14} className="text-emerald-500 group-hover:scale-110 transition-transform" /> VPC Peering Available
                            </div>
                        </div>
                     </div>
                </div>

                {/* Standard Item: GitHub */}
                <div className="rounded-2xl border border-white/10 bg-[#0A0A0A] overflow-hidden relative group p-8 hover-lift" style={{ willChange: 'transform' }}>
                     <div className="absolute inset-0 bg-gradient-to-br from-slate-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                     <Github className="text-slate-200 mb-4 group-hover:text-white group-hover:scale-110 transition-all duration-300 relative z-10" size={32} />
                     <h3 className="text-lg font-bold text-white group-hover:text-slate-100 transition-colors relative z-10">One-Click Sync</h3>
                     <p className="text-slate-400 text-xs mt-2 relative z-10">Connect your GitHub or GitLab repository and start indexing in seconds.</p>
                </div>

                {/* Standard Item: Speed */}
                <div className="rounded-2xl border border-white/10 bg-[#0A0A0A] overflow-hidden relative group p-8 hover-lift" style={{ willChange: 'transform' }}>
                     <div className="absolute inset-0 bg-gradient-to-br from-yellow-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                     <Zap className="text-yellow-400 mb-4 group-hover:text-yellow-300 group-hover:scale-110 transition-all duration-200 relative z-10" size={32} />
                     <h3 className="text-lg font-bold text-white group-hover:text-yellow-100 transition-colors relative z-10">Real-time Indexing</h3>
                     <p className="text-slate-400 text-xs mt-2 relative z-10">DEX listens to webhooks. As soon as you push code, the graph updates.</p>
                </div>
                
                {/* Wide Item Bottom */}
                <div className="md:col-span-2 rounded-2xl border border-white/10 bg-[#0A0A0A] overflow-hidden relative flex items-center hover-lift group" style={{ willChange: 'transform' }}>
                    <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/5 to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                    <div className="p-8 w-2/3 z-10">
                        <h3 className="text-xl font-bold text-white group-hover:text-indigo-300 transition-colors">Built for Teams</h3>
                        <p className="text-slate-400 text-sm mt-2">Share context links, annotated graphs, and onboarding guides automatically generated from the codebase.</p>
                    </div>
                    <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-gradient-to-l from-indigo-900/20 to-transparent"></div>
                </div>
            </div>
        </section>

        {/* ===========================================================================
            ZONE 3.5: INSIGHTS PREVIEW
        ============================================================================ */}
        <section id="insights" className="mx-auto max-w-6xl px-6 py-24 relative">
          {/* Animated background particles - Reduced count for performance */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none" style={{ contain: 'layout style paint' }}>
            <ParticleBackground count={12} opacity={0.25} minDuration={15} maxDuration={25} />
          </div>

          <div className="relative z-10">
            <div className="text-center mb-12">
              <div className="inline-flex items-center gap-2 rounded-full border border-indigo-500/20 bg-indigo-500/5 px-3 py-1 mb-6 backdrop-blur-sm">
                <TrendingUp size={14} className="text-indigo-400" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-300">
                  New Insights
                </span>
              </div>
              <h2 className="text-4xl md:text-5xl font-semibold text-white mb-4">
                Understand Your <span className="gradient-text">Codebase</span> at a Glance
              </h2>
              <p className="text-slate-400 max-w-2xl mx-auto mb-2">
                Real-time insights into repository activity and team collaboration patterns.
              </p>
              <p className="text-slate-500 text-sm max-w-2xl mx-auto">
                Track which parts of your codebase are most active, identify bottlenecks in your dependency graph, and understand how your team collaborates across modules.
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <ActivityInsightsPreview />
              <TeamInsightsPreview />
            </div>

            <div className="mt-8 text-center">
              <Link 
                href="/insights/activity" 
                className="inline-flex items-center gap-2 text-sm text-indigo-400 hover:text-indigo-300 transition-colors group"
              >
                Explore all insights
                <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>
          </div>
        </section>

        {/* ===========================================================================
            ZONE 4: FINAL CTA
        ============================================================================ */}
        <section className="mx-auto max-w-4xl px-6 pb-24 pt-10">
          <div className="relative rounded-3xl overflow-hidden border border-white/10 bg-[#0F0F10] p-12 text-center group hover-lift">
            
            {/* Hover Glow */}
            <div className="absolute inset-0 bg-gradient-to-b from-indigo-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700"></div>
            <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/5 via-purple-500/5 to-pink-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-700"></div>
            
            {/* Animated background particles - Reduced count for performance */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none" style={{ contain: 'layout style paint' }}>
              <ParticleBackground count={10} opacity={0.15} minDuration={18} maxDuration={22} />
            </div>
            
            <div className="relative z-10">
               <h2 className="text-4xl font-semibold text-white mb-6 group-hover:text-transparent group-hover:bg-clip-text group-hover:bg-gradient-to-r group-hover:from-indigo-400 group-hover:to-purple-400 transition-all">
                 Ready to decode your repo?
               </h2>
               <p className="text-slate-400 mb-3 max-w-lg mx-auto">Join the public beta today and get 14 days of unlimited indexing for free.</p>
               <p className="text-slate-500 text-sm mb-8 max-w-lg mx-auto">
                 Connect your GitHub repository, watch DEX build your dependency graph in real-time, and start asking questions about your codebase. No credit card required.
               </p>
               
               <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                   {!session?.user ? (
                     <>
                       <Link href="/signup" className="group/btn inline-flex items-center justify-center gap-2 rounded-xl bg-white text-black px-8 py-4 text-xs font-bold uppercase tracking-widest hover:bg-slate-200 transition-all shadow-[0_0_30px_rgba(255,255,255,0.15)] hover:shadow-[0_0_40px_rgba(255,255,255,0.25)] hover:scale-105 w-full sm:w-auto">
                         Get Started <ArrowRight size={14} className="group-hover/btn:translate-x-1 transition-transform" />
                       </Link>
                       <Link href="mailto:sales@dex.ai" className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 px-8 py-4 text-xs font-bold uppercase tracking-widest text-slate-300 hover:bg-white/5 hover:border-indigo-500/30 transition-all hover:scale-105 w-full sm:w-auto">
                         Contact Sales
                       </Link>
                     </>
                   ) : (
                     <Link href="/app" className="group/btn inline-flex items-center justify-center gap-2 rounded-xl bg-white text-black px-8 py-4 text-xs font-bold uppercase tracking-widest hover:bg-slate-200 transition-all shadow-[0_0_30px_rgba(255,255,255,0.15)] hover:shadow-[0_0_40px_rgba(255,255,255,0.25)] hover:scale-105 w-full sm:w-auto">
                       Go to Dashboard <ArrowRight size={14} className="group-hover/btn:translate-x-1 transition-transform" />
                     </Link>
                   )}
               </div>
            </div>
          </div>
        </section>

      </main>

      {/* --- FOOTER --- */}
      <footer className="border-t border-white/5 bg-[#020202] py-12">
        <div className="mx-auto max-w-6xl px-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-12">
                <div className="col-span-2 md:col-span-1">
                    <div className="flex items-center gap-2 mb-4">
                        <span className="w-6 h-6 bg-slate-800 rounded flex items-center justify-center"><Terminal size={12} /></span>
                        <span className="font-bold text-white">DEX</span>
                    </div>
                    <p className="text-xs text-slate-500 leading-relaxed">
                        The intelligence layer for modern software engineering teams.
                    </p>
                </div>
                <div>
                    <h4 className="text-xs font-bold text-white uppercase tracking-widest mb-4">Product</h4>
                    <ul className="space-y-2 text-xs text-slate-500">
                        <li><Link href="/about" className="hover:text-indigo-400">About</Link></li>
                        <li><Link href="#" className="hover:text-indigo-400">Features</Link></li>
                        <li><Link href="#" className="hover:text-indigo-400">Integrations</Link></li>
                        <li><Link href="#" className="hover:text-indigo-400">Changelog</Link></li>
                        <li><Link href="#" className="hover:text-indigo-400">Pricing</Link></li>
                    </ul>
                </div>
                <div>
                    <h4 className="text-xs font-bold text-white uppercase tracking-widest mb-4">Resources</h4>
                    <ul className="space-y-2 text-xs text-slate-500">
                        <li><Link href="#" className="hover:text-indigo-400">Documentation</Link></li>
                        <li><Link href="#" className="hover:text-indigo-400">API Reference</Link></li>
                        <li><Link href="#" className="hover:text-indigo-400">Community</Link></li>
                    </ul>
                </div>
                <div>
                    <h4 className="text-xs font-bold text-white uppercase tracking-widest mb-4">Legal</h4>
                    <ul className="space-y-2 text-xs text-slate-500">
                        <li><Link href="/privacy" className="hover:text-indigo-400">Privacy Policy</Link></li>
                        <li><Link href="/terms" className="hover:text-indigo-400">Terms of Service</Link></li>
                        <li><Link href="/security" className="hover:text-indigo-400">Security</Link></li>
                        <li><Link href="/grievance" className="hover:text-indigo-400">Contact / Grievance</Link></li>
                    </ul>
                </div>
            </div>
            <div className="border-t border-white/5 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
                <div className="text-[10px] text-slate-600">© 2026 Dex Inc. All rights reserved. | Developed by Rhythm Suthar 2026</div>
                <div className="flex gap-4">
                    <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                    <span className="text-[10px] text-emerald-500 font-medium">All Systems Operational</span>
                </div>
            </div>
        </div>
      </footer>

    </div>
  );
}