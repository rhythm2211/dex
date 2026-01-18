"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { 
  Terminal, ArrowRight, Zap, GitBranch, ShieldCheck, Sparkles, 
  Quote, Network, Play, LogOut, Code, FileText, 
  Cpu, Search, CheckCircle, Command, Lock, Layers, 
  ChevronRight, Database, Github
} from "lucide-react";

// -----------------------------------------------------------------------------
// GLOBAL STYLES & ANIMATIONS
// -----------------------------------------------------------------------------
const GlobalStyles = () => (
  <style jsx global>{`
    @keyframes fade-in-up { 0% { opacity: 0; transform: translateY(20px); } 100% { opacity: 1; transform: translateY(0); } }
    @keyframes scroll-left { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
    @keyframes scan-line { 0% { top: 0%; opacity: 0; } 10% { opacity: 1; } 90% { opacity: 1; } 100% { top: 100%; opacity: 0; } }
    @keyframes typing { from { width: 0 } to { width: 100% } }
    @keyframes blink { 50% { border-color: transparent } }
    @keyframes float { 0% { transform: translateY(0px); } 50% { transform: translateY(-10px); } 100% { transform: translateY(0px); } }
    
    .animate-fade-in { animation: fade-in-up 0.8s ease-out forwards; opacity: 0; }
    .animate-scroll-left { animation: scroll-left 40s linear infinite; }
    .animate-float { animation: float 6s ease-in-out infinite; }
    .delay-100 { animation-delay: 0.1s; }
    .delay-200 { animation-delay: 0.2s; }
    .delay-300 { animation-delay: 0.3s; }
    
    /* Custom Scrollbar */
    ::-webkit-scrollbar { width: 8px; }
    ::-webkit-scrollbar-track { background: #050505; }
    ::-webkit-scrollbar-thumb { background: #333; border-radius: 4px; }
    ::-webkit-scrollbar-thumb:hover { background: #444; }

    /* Glass Effects */
    .glass-panel {
      background: rgba(10, 10, 10, 0.6);
      backdrop-filter: blur(12px);
      border: 1px solid rgba(255, 255, 255, 0.08);
    }
    
    .cyber-grid {
      background-size: 50px 50px;
      background-image: linear-gradient(to right, rgba(99, 102, 241, 0.03) 1px, transparent 1px),
                        linear-gradient(to bottom, rgba(99, 102, 241, 0.03) 1px, transparent 1px);
      mask-image: radial-gradient(ellipse at center, black 30%, transparent 70%);
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
      <div className="relative rounded-xl bg-[#0F0F10] border border-white/10 shadow-[0_20px_60px_rgba(0,0,0,0.9)] overflow-hidden backdrop-blur-xl ring-1 ring-white/5">
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
// COMPONENT: TECH STACK TICKER
// -----------------------------------------------------------------------------
const TechTicker = () => {
    const stack = ["Next.js", "TypeScript", "Python", "Rust", "Docker", "Kubernetes", "AWS", "TensorFlow", "PostgreSQL", "GraphQL", "GoLang", "Terraform"];
    return (
        <div className="w-full border-y border-white/5 bg-[#050505]/50 backdrop-blur-sm overflow-hidden py-3">
             <div className="flex animate-scroll-left whitespace-nowrap gap-12 items-center">
                {[...stack, ...stack, ...stack].map((tech, i) => (
                    <span key={i} className="text-xs font-bold uppercase tracking-widest text-slate-600 hover:text-indigo-400 transition-colors cursor-default">
                        {tech}
                    </span>
                ))}
             </div>
        </div>
    );
};

// -----------------------------------------------------------------------------
// MAIN PAGE
// -----------------------------------------------------------------------------
export default function HomePage() {
  const { data: session } = useSession();

  return (
    <div className="min-h-screen bg-[#050505] text-slate-200 overflow-x-hidden relative selection:bg-indigo-500/30 selection:text-white font-sans">
      <GlobalStyles />
      
      {/* Dynamic Background */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-indigo-900/10 blur-[150px] rounded-full mix-blend-screen opacity-50"></div>
        <div className="absolute top-[40%] right-[-10%] w-[40%] h-[40%] bg-emerald-900/5 blur-[120px] rounded-full mix-blend-screen opacity-40"></div>
        <div className="absolute bottom-[-20%] left-[20%] w-[60%] h-[40%] bg-violet-900/10 blur-[150px] rounded-full mix-blend-screen opacity-30"></div>
        <div className="absolute inset-0 cyber-grid"></div>
      </div>

      {/* --- HEADER --- */}
      <header className="fixed top-0 left-0 right-0 z-50 border-b border-white/5 bg-[#050505]/80 backdrop-blur-md">
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
             <Link href="#security" className="hover:text-white transition-colors">Security</Link>
             <Link href="/about" className="hover:text-white transition-colors">About</Link>
          </div>
          <div className="flex items-center gap-4">
            {session?.user ? (
              <div className="flex items-center gap-3 bg-white/5 px-3 py-1.5 rounded-full border border-white/5">
                 <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
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

      <main className="relative pt-24 pb-20">
        
        {/* ===========================================================================
            ZONE 1: HERO
        ============================================================================ */}
        <section className="relative mx-auto max-w-5xl px-6 pt-24 pb-20 text-center z-10">
          
          <CommandPaletteSimulation />

          {/* Launch Badge */}
          <div className="animate-fade-in inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/5 px-3 py-1 mb-8 backdrop-blur-md">
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
            <span className="text-transparent bg-clip-text bg-gradient-to-b from-indigo-300 via-white to-slate-400">
               complex codebases
            </span>
            <span className="text-indigo-500">.</span>
          </h1>

          <p className="animate-fade-in delay-200 max-w-2xl mx-auto text-base sm:text-lg leading-relaxed text-slate-400 font-light mb-10">
            DEX indexes your repository into a semantic graph, allowing you to debug, refactor, and onboard 10x faster using context-aware AI.
          </p>

          <div className="animate-fade-in delay-300 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/signup" className="group relative w-full sm:w-auto overflow-hidden rounded-xl bg-white text-black px-8 py-3.5 transition-all hover:bg-slate-200 hover:shadow-[0_0_40px_rgba(255,255,255,0.2)]">
              <span className="relative z-10 flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-widest">
                Start for free <ArrowRight size={14} />
              </span>
            </Link>
            <Link href="#demo" className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-8 py-3.5 text-xs font-bold uppercase tracking-widest text-slate-300 hover:bg-white/10 hover:text-white transition-colors backdrop-blur-sm">
              <Github size={14} /> Connect GitHub
            </Link>
          </div>
        </section>

        <TechTicker />

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
                            <p className="text-slate-400 leading-relaxed">
                                Traditional AI tools only read snippets of text. DEX builds an 
                                <span className="text-white font-medium"> Abstract Syntax Tree (AST)</span> and a 
                                <span className="text-white font-medium"> Dependency Graph</span> of your entire project.
                            </p>
                        </div>

                        <div className="space-y-4">
                             {[
                                { title: "Full Context Window", desc: "References imports, definitions, and types across files." },
                                { title: "Zero Hallucinations", desc: "Answers are grounded in your actual code, with citations." },
                                { title: "Secure by Design", desc: "Code is indexed locally or in an ephemeral enclave." }
                             ].map((item, i) => (
                                 <div key={i} className="flex gap-4 p-4 rounded-xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.05] transition-colors">
                                     <div className="mt-1">
                                         <CheckCircle size={18} className="text-emerald-500" />
                                     </div>
                                     <div>
                                         <h4 className="text-sm font-semibold text-white">{item.title}</h4>
                                         <p className="text-xs text-slate-500 mt-1">{item.desc}</p>
                                     </div>
                                 </div>
                             ))}
                        </div>
                    </div>

                    {/* Right: The Demo UI */}
                    <div className="relative">
                        {/* Background glow */}
                        <div className="absolute inset-0 bg-indigo-500/20 blur-[80px] rounded-full z-0"></div>
                        <div className="relative z-10 grid gap-6">
                             {/* The Chat UI */}
                             <div className="translate-x-4">
                                <ChatDemo />
                             </div>
                             {/* Floating Elements */}
                             <div className="absolute -left-8 bottom-10 glass-panel p-4 rounded-lg shadow-xl animate-float" style={{ animationDelay: '1s' }}>
                                 <div className="flex items-center gap-3">
                                     <div className="bg-indigo-500/20 p-2 rounded text-indigo-400"><Cpu size={18} /></div>
                                     <div>
                                         <div className="text-[10px] uppercase text-slate-500 font-bold">Token Usage</div>
                                         <div className="text-sm font-mono text-white">4,203 ctx</div>
                                     </div>
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
        <section id="features" className="mx-auto max-w-6xl px-6 py-12">
            <div className="text-center mb-16">
                 <h2 className="text-3xl font-semibold text-white mb-4">Engineered for Engineers</h2>
                 <p className="text-slate-400">Everything you need to navigate complexity.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 auto-rows-[250px]">
                
                {/* Large Item 1: Visualization */}
                <div className="md:col-span-2 rounded-2xl border border-white/10 bg-[#0A0A0A] overflow-hidden relative group">
                    <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700"></div>
                    <div className="p-8 relative z-10 h-full flex flex-col justify-between">
                         <div>
                            <div className="w-10 h-10 rounded-lg bg-indigo-500/20 flex items-center justify-center text-indigo-400 mb-4"><Network /></div>
                            <h3 className="text-xl font-bold text-white">Visual Dependency Mapping</h3>
                            <p className="text-slate-400 text-sm mt-2 max-w-sm">Instantly generate a visual map of how your modules, functions, and database schemas interact.</p>
                         </div>
                         {/* Abstract Vis */}
                         <div className="absolute right-0 bottom-0 w-1/2 h-full opacity-30 pointer-events-none border-l border-white/5 bg-[url('https://grainy-gradients.vercel.app/noise.svg')]">
                             {/* Just a placeholder for abstract lines */}
                             <svg className="w-full h-full" viewBox="0 0 200 200">
                                 <path d="M20 180 Q 100 50 180 20" stroke="rgba(255,255,255,0.2)" fill="none" strokeWidth="2" />
                                 <path d="M40 180 Q 100 100 160 20" stroke="rgba(99,102,241,0.4)" fill="none" strokeWidth="2" />
                                 <circle cx="100" cy="100" r="4" fill="#6366f1" />
                             </svg>
                         </div>
                    </div>
                </div>

                {/* Tall Item: Security */}
                <div className="md:row-span-2 rounded-2xl border border-white/10 bg-[#0A0A0A] overflow-hidden relative group">
                     <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 to-transparent"></div>
                     <div className="p-8 h-full flex flex-col">
                        <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center text-emerald-400 mb-6"><Lock /></div>
                        <h3 className="text-xl font-bold text-white mb-2">SOC2 Compliant</h3>
                        <p className="text-slate-400 text-sm mb-8">We take code security seriously. Your intellectual property never leaves the encrypted enclave.</p>
                        
                        <div className="mt-auto space-y-3">
                            <div className="flex items-center gap-3 text-xs text-slate-300 p-3 rounded bg-white/5 border border-white/5">
                                <ShieldCheck size={14} className="text-emerald-500" /> End-to-End Encryption
                            </div>
                            <div className="flex items-center gap-3 text-xs text-slate-300 p-3 rounded bg-white/5 border border-white/5">
                                <Database size={14} className="text-emerald-500" /> No Data Retention
                            </div>
                            <div className="flex items-center gap-3 text-xs text-slate-300 p-3 rounded bg-white/5 border border-white/5">
                                <Layers size={14} className="text-emerald-500" /> VPC Peering Available
                            </div>
                        </div>
                     </div>
                </div>

                {/* Standard Item: GitHub */}
                <div className="rounded-2xl border border-white/10 bg-[#0A0A0A] overflow-hidden relative group p-8">
                     <Github className="text-slate-200 mb-4" size={32} />
                     <h3 className="text-lg font-bold text-white">One-Click Sync</h3>
                     <p className="text-slate-400 text-xs mt-2">Connect your GitHub or GitLab repository and start indexing in seconds.</p>
                </div>

                {/* Standard Item: Speed */}
                <div className="rounded-2xl border border-white/10 bg-[#0A0A0A] overflow-hidden relative group p-8">
                     <Zap className="text-yellow-400 mb-4" size={32} />
                     <h3 className="text-lg font-bold text-white">Real-time Indexing</h3>
                     <p className="text-slate-400 text-xs mt-2">DEX listens to webhooks. As soon as you push code, the graph updates.</p>
                </div>
                
                {/* Wide Item Bottom */}
                <div className="md:col-span-2 rounded-2xl border border-white/10 bg-[#0A0A0A] overflow-hidden relative flex items-center">
                    <div className="p-8 w-2/3 z-10">
                        <h3 className="text-xl font-bold text-white">Built for Teams</h3>
                        <p className="text-slate-400 text-sm mt-2">Share context links, annotated graphs, and onboarding guides automatically generated from the codebase.</p>
                    </div>
                    <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-gradient-to-l from-indigo-900/20 to-transparent"></div>
                </div>
            </div>
        </section>


        {/* ===========================================================================
            ZONE 4: FINAL CTA
        ============================================================================ */}
        <section className="mx-auto max-w-4xl px-6 pb-24 pt-10">
          <div className="relative rounded-3xl overflow-hidden border border-white/10 bg-[#0F0F10] p-12 text-center group">
            
            {/* Hover Glow */}
            <div className="absolute inset-0 bg-gradient-to-b from-indigo-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700"></div>
            
            <div className="relative z-10">
               <h2 className="text-4xl font-semibold text-white mb-6">Ready to decode your repo?</h2>
               <p className="text-slate-400 mb-8 max-w-lg mx-auto">Join the public beta today and get 14 days of unlimited indexing for free.</p>
               
               <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                   <Link href="/signup" className="inline-flex items-center justify-center gap-2 rounded-xl bg-white text-black px-8 py-4 text-xs font-bold uppercase tracking-widest hover:bg-slate-200 transition-colors shadow-[0_0_30px_rgba(255,255,255,0.15)] w-full sm:w-auto">
                     Get Started <ArrowRight size={14} />
                   </Link>
                   <Link href="mailto:sales@dex.ai" className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 px-8 py-4 text-xs font-bold uppercase tracking-widest text-slate-300 hover:bg-white/5 transition-colors w-full sm:w-auto">
                     Contact Sales
                   </Link>
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
                        <li><Link href="#" className="hover:text-indigo-400">Privacy Policy</Link></li>
                        <li><Link href="#" className="hover:text-indigo-400">Terms of Service</Link></li>
                        <li><Link href="#" className="hover:text-indigo-400">Security</Link></li>
                    </ul>
                </div>
            </div>
            <div className="border-t border-white/5 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
                <div className="text-[10px] text-slate-600">© 2024 Dex Inc. All rights reserved.</div>
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