"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import Link from "next/link";
import { Terminal, ArrowRight, Zap, GitBranch, ShieldCheck, Sparkles, Quote, Network, Play } from "lucide-react";

// -----------------------------------------------------------------------------
// EFFECT COMPONENTS (ZONED)
// -----------------------------------------------------------------------------

// ZONE 1: HERO - Glowing Grid
const GlowingContributionGrid = () => {
  const grid = useMemo(() => {
    const rows = 7;
    const cols = 36;
    const items = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const rand = Math.random();
        let level = 0;
        if (rand > 0.85) level = 1;
        if (rand > 0.93) level = 2;
        if (rand > 0.98) level = 3;
        items.push({ id: `${r}-${c}`, level });
      }
    }
    return { rows, cols, items };
  }, []);

  return (
    <div 
      className="absolute top-40 left-1/2 -translate-x-1/2 z-0 pointer-events-none"
      style={{
        maskImage: "radial-gradient(ellipse at center, black 10%, transparent 65%)",
        WebkitMaskImage: "radial-gradient(ellipse at center, black 10%, transparent 65%)",
      }}
    >
      <div 
        className="grid gap-1.5 p-4"
        style={{ 
          gridTemplateColumns: `repeat(${grid.cols}, 12px)`,
          transform: "perspective(1000px) rotateX(25deg)", 
          opacity: 0.6 
        }}
      >
        {grid.items.map((item) => {
          let bgClass = "bg-slate-800/30";
          let glowClass = "";
          if (item.level === 1) bgClass = "bg-indigo-500/40";
          if (item.level === 2) bgClass = "bg-violet-500/50";
          if (item.level === 3) {
            bgClass = "bg-emerald-400/90 animate-pulse"; 
            glowClass = "shadow-[0_0_10px_rgba(52,211,153,0.6)] z-10 relative";
          }
          return <div key={item.id} className={`h-3 w-3 rounded-[2px] transition-colors duration-700 ${bgClass} ${glowClass}`} />;
        })}
      </div>
    </div>
  );
};

// ZONE 1: HERO - Data Stream (Subtle Background)
const DataStreamBackground = () => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      let width = (canvas.width = window.innerWidth);
      let height = (canvas.height = window.innerHeight);
      const handleResize = () => { width = canvas.width = window.innerWidth; height = canvas.height = window.innerHeight; };
      window.addEventListener("resize", handleResize);
  
      class Packet {
        x: number; y: number; speed: number; size: number; color: string; traceLength: number;
        constructor() {
          this.x = Math.random() * width;
          const gridSize = 40; 
          this.y = Math.floor((Math.random() * height) / gridSize) * gridSize + gridSize / 2;
          this.speed = Math.random() * 3 + 1;
          this.size = Math.random() * 1.5 + 0.5;
          this.traceLength = Math.random() * 50 + 20;
          const colors = ["rgba(99, 102, 241, 0.4)", "rgba(139, 92, 246, 0.4)", "rgba(16, 185, 129, 0.5)"];
          this.color = colors[Math.floor(Math.random() * colors.length)];
        }
        update() {
          this.x += this.speed;
          if (this.x > width + this.traceLength) {
              this.x = -this.traceLength;
               const gridSize = 40; 
               this.y = Math.floor((Math.random() * height) / gridSize) * gridSize + gridSize / 2;
          }
        }
        draw(context: CanvasRenderingContext2D) {
          const gradient = context.createLinearGradient(this.x - this.traceLength, this.y, this.x, this.y);
          gradient.addColorStop(0, "transparent");
          gradient.addColorStop(1, this.color);
          context.beginPath();
          context.strokeStyle = gradient;
          context.lineWidth = this.size;
          context.moveTo(this.x - this.traceLength, this.y);
          context.lineTo(this.x, this.y);
          context.stroke();
        }
      }
      const packetCount = Math.floor(height / 40);
      const packets: Packet[] = Array.from({ length: packetCount }, () => new Packet());
      const animate = () => {
        ctx.clearRect(0, 0, width, height);
        packets.forEach(p => { p.update(); p.draw(ctx); });
        requestAnimationFrame(animate);
      };
      animate();
      return () => window.removeEventListener("resize", handleResize);
    }, []);
    return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none z-0 opacity-30 mix-blend-screen" />;
};

// ZONE 2: MIDDLE - Interactive Graph (Ropes)
const InteractiveGraphOverlay = () => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const mouseRef = useRef({ x: -999, y: -999 });
  
    useEffect(() => {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
  
      const updateSize = () => {
        canvas.width = container.clientWidth;
        canvas.height = container.clientHeight;
      };
      updateSize();
      window.addEventListener("resize", updateSize);

      const handleMouseMove = (e: MouseEvent) => {
        const rect = canvas.getBoundingClientRect();
        mouseRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      };
      container.addEventListener("mousemove", handleMouseMove);
      container.addEventListener("mouseleave", () => { mouseRef.current = { x: -999, y: -999 }; });
  
      // --- FIXED CLASS DEFINITION HERE ---
      class Node {
        x: number; y: number; vx: number; vy: number; baseX: number; baseY: number;
        constructor() {
          // ADDED '!' TO ASSERT CANVAS EXISTS
          this.baseX = Math.random() * canvas!.width;
          this.baseY = Math.random() * canvas!.height;
          this.x = this.baseX; this.y = this.baseY;
          this.vx = (Math.random() - 0.5) * 0.3;
          this.vy = (Math.random() - 0.5) * 0.3;
        }
        update() {
          this.baseX += this.vx; this.baseY += this.vy;
          // ADDED '!' TO ASSERT CANVAS EXISTS
          if (this.baseX < 0 || this.baseX > canvas!.width) this.vx *= -1;
          if (this.baseY < 0 || this.baseY > canvas!.height) this.vy *= -1;
  
          const dx = mouseRef.current.x - this.baseX;
          const dy = mouseRef.current.y - this.baseY;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 200) {
             this.x = this.baseX + (dx * 0.2);
             this.y = this.baseY + (dy * 0.2);
          } else {
             this.x = this.baseX; this.y = this.baseY;
          }
        }
        draw() {
          ctx!.beginPath(); ctx!.arc(this.x, this.y, 1.5, 0, Math.PI * 2); ctx!.fillStyle = "rgba(167, 139, 250, 0.3)"; ctx!.fill();
        }
      }
      // ------------------------------------

      const nodes = Array.from({ length: 40 }, () => new Node());
  
      const animate = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        nodes.forEach(node => {
          node.update();
          // Mouse Connections
          const dx = mouseRef.current.x - node.x;
          const dy = mouseRef.current.y - node.y;
          const dist = Math.sqrt(dx*dx + dy*dy);
          if (dist < 200) {
              ctx.beginPath(); ctx.moveTo(node.x, node.y); ctx.lineTo(mouseRef.current.x, mouseRef.current.y);
              ctx.strokeStyle = `rgba(99, 102, 241, ${0.4 - dist/200})`; ctx.lineWidth = 1; ctx.stroke();
          }
          // Node-Node Connections
          nodes.forEach(other => {
              const d = Math.sqrt((node.x-other.x)**2 + (node.y-other.y)**2);
              if (d < 80) {
                  ctx.beginPath(); ctx.moveTo(node.x, node.y); ctx.lineTo(other.x, other.y);
                  ctx.strokeStyle = `rgba(255, 255, 255, 0.05)`; ctx.stroke();
              }
          })
          node.draw();
        });
        requestAnimationFrame(animate);
      };
      animate();
      return () => { window.removeEventListener("resize", updateSize); container.removeEventListener("mousemove", handleMouseMove); };
    }, []);
    return <div ref={containerRef} className="absolute inset-0 z-0"><canvas ref={canvasRef} className="absolute inset-0" /></div>;
};

// ZONE 3: BOTTOM - Shooting Stars
const ShootingStars = () => {
    return (
        <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
            <div className="absolute top-[20%] left-[-100px] w-[200px] h-[1px] bg-gradient-to-r from-transparent via-indigo-500 to-transparent animate-[shoot_3s_infinite_linear]" />
            <div className="absolute top-[50%] left-[-150px] w-[300px] h-[1px] bg-gradient-to-r from-transparent via-emerald-500 to-transparent animate-[shoot_5s_infinite_linear_1s]" />
            <div className="absolute top-[80%] left-[-200px] w-[250px] h-[1px] bg-gradient-to-r from-transparent via-violet-500 to-transparent animate-[shoot_4s_infinite_linear_2s]" />
            <style jsx>{`@keyframes shoot { 0% { transform: translateX(0); opacity: 0; } 10% { opacity: 1; } 90% { opacity: 1; } 100% { transform: translateX(120vw); opacity: 0; } }`}</style>
        </div>
    );
}

// -----------------------------------------------------------------------------
// UI COMPONENTS
// -----------------------------------------------------------------------------

const MagneticBadge = ({ children }: { children: React.ReactNode }) => {
    const ref = useRef<HTMLDivElement>(null);
    const [pos, setPos] = useState({ x: 0, y: 0 });
    const handleMove = (e: React.MouseEvent) => {
      if (!ref.current) return;
      const { left, top, width, height } = ref.current.getBoundingClientRect();
      setPos({ x: (e.clientX - (left + width/2)) * 0.2, y: (e.clientY - (top + height/2)) * 0.2 });
    };
    return (
      <div 
        ref={ref} onMouseMove={handleMove} onMouseLeave={() => setPos({x:0, y:0})}
        style={{ transform: `translate(${pos.x}px, ${pos.y}px)` }}
        className="inline-block transition-transform duration-200 ease-out cursor-default"
      >
        {children}
      </div>
    );
};

const SpotlightCard = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => {
    const divRef = useRef<HTMLDivElement>(null);
    const [isFocused, setIsFocused] = useState(false);
    const [position, setPosition] = useState({ x: 0, y: 0 });
  
    const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
      if (!divRef.current) return;
      const rect = divRef.current.getBoundingClientRect();
      setPosition({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    };
  
    return (
      <div
        ref={divRef}
        onMouseMove={handleMouseMove}
        onMouseEnter={() => setIsFocused(true)}
        onMouseLeave={() => setIsFocused(false)}
        className={`relative overflow-hidden rounded-2xl border border-white/10 bg-[#0a0a0a] ${className}`}
      >
        <div
          className="pointer-events-none absolute -inset-px opacity-0 transition duration-300"
          style={{ opacity: isFocused ? 1 : 0, background: `radial-gradient(600px circle at ${position.x}px ${position.y}px, rgba(99,102,241,0.15), transparent 40%)` }}
        />
        <div 
            className="pointer-events-none absolute -inset-px opacity-0 transition duration-300"
            style={{
                opacity: isFocused ? 1 : 0,
                background: `radial-gradient(600px circle at ${position.x}px ${position.y}px, rgba(99,102,241,0.4), transparent 40%)`,
                maskImage: "linear-gradient(black, black) content-box, linear-gradient(black, black)",
                WebkitMaskComposite: "xor",
                maskComposite: "exclude",
            }}
        />
        {children}
      </div>
    );
};

// -----------------------------------------------------------------------------
// DATA
// -----------------------------------------------------------------------------
const FEATURES = [
  { icon: Sparkles, title: "Instant mental model", desc: "Turn any repo into a navigable structure map—folders, files, and symbols—so you can orient in minutes, not days.", accent: "from-indigo-500/15 to-indigo-500/0 border-indigo-500/20" },
  { icon: Zap, title: "Ask questions. Get grounded answers.", desc: "Query the codebase with context from the graph and retrieval—great for onboarding, refactors, and impact analysis.", accent: "from-emerald-500/15 to-emerald-500/0 border-emerald-500/20" },
  { icon: GitBranch, title: "See change over time", desc: "Explore evolution and hotspots to understand how the system grew—and where it’s most fragile.", accent: "from-violet-500/15 to-violet-500/0 border-violet-500/20" },
  { icon: ShieldCheck, title: "Built for serious work", desc: "A focused dark UI, fast interactions, and a palette tuned for clarity across dense graphs.", accent: "from-slate-500/10 to-slate-500/0 border-white/10" },
];

const CAROUSEL_ITEMS = [
  { tag: "Onboarding", title: "“I can drop into a new repo and feel oriented in 10 minutes.”", body: "DEX gives senior-level intuition about structure to every engineer on the team." },
  { tag: "Refactors", title: "“I don’t ship blind refactors anymore.”", body: "Graph + evolution views help you see blast radius and hotspots before you touch a line." },
  { tag: "Everyday flow", title: "“It feels like having a map and a guide inside my editor.”", body: "Ask questions, follow the structure, and keep context persistent as you work." },
  { tag: "Debugging", title: "“When a bug pops up, I can see all the code that really matters.”", body: "Trace execution paths through the graph instead of grepping blindly." },
];

export default function HomePage() {
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const id = setInterval(() => { setActiveIndex((prev) => (prev + 1) % CAROUSEL_ITEMS.length); }, 4500);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="min-h-screen bg-[#050505] text-slate-200 overflow-x-hidden relative selection:bg-indigo-500/30 selection:text-white font-sans">
      
      {/* GLOBAL STYLES */}
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes fade-in-up { 0% { opacity: 0; transform: translateY(20px); } 100% { opacity: 1; transform: translateY(0); } }
        .animate-fade-in { animation: fade-in-up 0.8s ease-out forwards; opacity: 0; }
        .delay-100 { animation-delay: 0.1s; } .delay-200 { animation-delay: 0.2s; } .delay-300 { animation-delay: 0.3s; }
      `}} />

      {/* --- HEADER --- */}
      <header className="fixed top-0 left-0 right-0 z-50 border-b border-white/5 bg-[#050505]/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 h-16">
          <Link href="/" className="group inline-flex items-center gap-3">
            <span className="p-1.5 bg-indigo-500/10 rounded-lg border border-indigo-500/20 shadow-[0_0_15px_rgba(99,102,241,0.3)] group-hover:shadow-[0_0_25px_rgba(99,102,241,0.5)] transition-all">
              <Terminal className="text-indigo-400 group-hover:text-indigo-300" size={16} />
            </span>
            <span className="text-xs font-bold tracking-[0.32em] text-white">DEX</span>
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/login" className="text-xs font-semibold text-slate-400 hover:text-white transition-colors">Log in</Link>
            <Link href="/signup" className="hidden sm:inline-flex items-center justify-center rounded-full bg-white text-black px-4 py-2 text-xs font-bold hover:bg-slate-200 transition-colors">Sign up</Link>
          </div>
        </div>
      </header>


      <main className="relative pt-24">
        
        {/* ===========================================================================
            ZONE 1: HERO
            Contains: Data Stream, GitHub Grid (Vertical Lines Removed)
        ============================================================================ */}
        <section className="relative mx-auto max-w-6xl px-6 pt-20 pb-10 text-center z-10">
          
          {/* Zone 1 Effects */}
          <DataStreamBackground />
          <GlowingContributionGrid />

          {/* Badge */}
          <MagneticBadge>
            <div className="animate-fade-in inline-flex items-center gap-2 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest text-indigo-200 backdrop-blur-md shadow-[0_0_15px_rgba(99,102,241,0.15)] group hover:bg-indigo-500/20 transition-colors">
                <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500 shadow-[0_0_10px_#10b981]"></span>
                </span>
                Map your code. Ask better questions.
            </div>
          </MagneticBadge>

          {/* Headline */}
          <h1 className="animate-fade-in delay-100 mt-8 text-5xl sm:text-6xl lg:text-7xl font-semibold tracking-tight text-white max-w-4xl mx-auto leading-[1.1] relative drop-shadow-2xl">
            Understand any repository{" "}
            <span className="relative whitespace-nowrap text-transparent bg-clip-text bg-gradient-to-r from-indigo-300 via-indigo-100 to-emerald-200">
              at a glance
              <svg className="absolute -bottom-2 left-0 w-full h-4 text-indigo-500/40 -z-10 blur-[1px]" viewBox="0 0 100 10" preserveAspectRatio="none">
                 <path d="M0 7 Q 50 2 100 7" stroke="currentColor" strokeWidth="3" fill="none" strokeLinecap="round" />
              </svg>
            </span>
            .
          </h1>

          <p className="animate-fade-in delay-200 mt-8 max-w-2xl mx-auto text-sm sm:text-base leading-relaxed text-slate-300/90 font-light relative z-10">
            DEX turns your codebase into a structured map and pairs it with a focused assistant—so onboarding, debugging, and refactoring feel less like archaeology.
          </p>

          {/* Buttons */}
          <div className="animate-fade-in delay-300 mt-12 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/app" className="group relative inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-8 py-4 text-xs font-bold uppercase tracking-widest text-white hover:bg-indigo-500 transition-all shadow-[0_0_25px_rgba(99,102,241,0.3)] hover:shadow-[0_0_40px_rgba(99,102,241,0.5)] hover:-translate-y-0.5 w-full sm:w-auto overflow-hidden border border-indigo-400/50">
              <span className="relative z-10 flex items-center gap-2">Launch DEX <ArrowRight size={16} /></span>
            </Link>
            <Link href="#how" className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-8 py-4 text-xs font-bold uppercase tracking-widest text-slate-200 hover:bg-white/10 transition-colors hover:border-white/20 w-full sm:w-auto backdrop-blur-sm group">
              <Terminal size={14} className="text-slate-400 group-hover:text-white transition-colors" />
              How it works
            </Link>
          </div>
        </section>


        {/* ===========================================================================
            ZONE 2: MENTAL MODEL (Stacked)
            Contains: Interactive Graph (Ropes)
        ============================================================================ */}
        <section className="relative mt-24 pb-24">
            
            {/* Zone 2 Effects (Localized) */}
            <InteractiveGraphOverlay />

            <div className="relative mx-auto max-w-4xl px-6 flex flex-col gap-12 animate-fade-in delay-300 z-10">
                {/* 1. Preview Info Card */}
                <SpotlightCard className="p-1 shadow-2xl">
                    <div className="rounded-xl bg-[#0a0a0a]/90 p-8 h-full relative z-10 backdrop-blur-sm">
                        <div className="flex flex-col gap-8 items-center text-center">
                            <div className="space-y-3">
                                <div className="text-[10px] font-bold uppercase tracking-widest text-indigo-400/80 flex items-center justify-center gap-2">
                                    <Sparkles size={12} /> What you get
                                </div>
                                <div className="text-xl font-medium text-white">A map-first workspace for code intelligence</div>
                                <div className="text-sm text-slate-400 max-w-md mx-auto">Graph navigation + retrieval-backed answers—wrapped in a clean, dark UI.</div>
                            </div>
                            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 w-full">
                                {[["Indigo", "Navigation & focus", "bg-indigo-500"], ["Emerald", "Signals & status", "bg-emerald-500 animate-pulse"], ["Violet", "Structure & types", "bg-violet-500"], ["Slate", "Low-noise detail", "bg-slate-500"]].map(([label, desc, colorClass]) => (
                                    <div key={label} className="rounded-lg border border-white/5 bg-black/40 p-4 text-left hover:bg-white/5 transition-colors group/item relative overflow-hidden">
                                        <div className={`absolute top-0 left-0 w-full h-0.5 ${colorClass} opacity-30 group-hover/item:opacity-60 transition-opacity`} />
                                        <div className="flex items-center gap-2 mb-2">
                                            <div className={`h-1.5 w-1.5 rounded-full ${colorClass} shadow-[0_0_6px_currentColor]`} />
                                            <div className="text-[9px] font-bold uppercase tracking-widest text-slate-400 group-hover/item:text-slate-300">{label}</div>
                                        </div>
                                        <div className="text-xs text-slate-400 leading-snug group-hover/item:text-slate-200">{desc}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </SpotlightCard>

                {/* 2. Carousel */}
                <div className="w-full rounded-2xl border border-white/10 bg-black/60 p-8 relative overflow-hidden text-center backdrop-blur-md shadow-[0_0_30px_rgba(0,0,0,0.5)]">
                    <div className="relative flex flex-col gap-6 items-center z-10">
                        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-indigo-300">
                            <Quote size={14} className="text-indigo-400" /> Signals from real workflows
                        </div>
                        <div className="relative h-28 w-full max-w-xl flex items-center justify-center">
                            {CAROUSEL_ITEMS.map((item, idx) => (
                                <div key={item.tag} className={`absolute inset-0 flex flex-col items-center justify-center transition-all duration-700 ease-in-out ${idx === activeIndex ? "opacity-100 translate-y-0 scale-100 z-10" : "opacity-0 translate-y-4 scale-95 -z-10"}`}>
                                    <div className="inline-flex items-center gap-2 rounded-full border border-indigo-500/20 bg-indigo-500/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-indigo-200 mb-4 shadow-[0_0_10px_rgba(99,102,241,0.2)]">{item.tag}</div>
                                    <div className="text-lg md:text-xl font-medium text-white mb-2 leading-relaxed drop-shadow-md">{item.title}</div>
                                    <div className="text-sm text-slate-400">{item.body}</div>
                                </div>
                            ))}
                        </div>
                        <div className="flex gap-2 justify-center mt-4">
                            {CAROUSEL_ITEMS.map((_, idx) => (
                                <button key={idx} onClick={() => setActiveIndex(idx)} className={`h-1 rounded-full transition-all duration-500 ${idx === activeIndex ? "w-8 bg-indigo-400 shadow-[0_0_10px_rgba(99,102,241,0.5)]" : "w-1.5 bg-slate-800 hover:bg-slate-700"}`} />
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </section>


        {/* FEATURES GRID */}
        <section className="mx-auto max-w-6xl px-6 py-20 relative z-10">
          <div className="grid gap-6 md:grid-cols-2">
            {FEATURES.map((f) => (
              <div key={f.title} className={`group relative rounded-2xl border bg-gradient-to-br ${f.accent} p-px overflow-hidden transition-all duration-500 hover:shadow-[0_0_30px_rgba(99,102,241,0.15)]`}>
                 <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                 <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500/20 via-violet-500/20 to-emerald-500/20 blur-xl opacity-0 group-hover:opacity-70 transition-opacity duration-700 group-hover:duration-200" />
                 <div className="relative h-full rounded-2xl bg-[#080808]/90 backdrop-blur-xl p-6 sm:p-8">
                    <div className="flex items-start gap-5">
                      <div className="rounded-xl border border-white/10 bg-white/5 p-3 shrink-0 text-slate-200 group-hover:text-indigo-300 group-hover:scale-110 group-hover:border-indigo-500/30 transition-all duration-300 shadow-[0_0_0_rgba(0,0,0,0)] group-hover:shadow-[0_0_15px_rgba(99,102,241,0.3)]">
                        <f.icon size={20} />
                      </div>
                      <div>
                        <div className="text-base font-semibold text-white group-hover:text-indigo-200 transition-colors">{f.title}</div>
                        <div className="mt-2 text-sm leading-relaxed text-slate-400 group-hover:text-slate-300 transition-colors">{f.desc}</div>
                      </div>
                    </div>
                 </div>
              </div>
            ))}
          </div>
        </section>


        {/* ===========================================================================
            ZONE 3: HOW IT WORKS
            Contains: Shooting Stars (Speed)
        ============================================================================ */}
        <section id="how" className="mx-auto max-w-6xl px-6 py-10 relative">
          
          <div className="relative rounded-3xl border border-white/10 bg-[#0a0a0a]/80 backdrop-blur-md p-8 sm:p-12 overflow-hidden shadow-2xl">
            
             {/* Zone 3 Effects */}
             <ShootingStars />
             <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:32px_32px] [mask-image:radial-gradient(ellipse_60%_60%_at_50%_50%,#000_70%,transparent_100%)] z-0" />
             <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-1/2 bg-indigo-600/10 blur-[100px] pointer-events-none mix-blend-screen z-0" />

            <div className="relative z-10">
                <div className="text-[10px] font-bold uppercase tracking-widest text-indigo-400/80 flex items-center gap-2">
                  <Terminal size={12} /> How it works
                </div>
                <div className="mt-2 text-2xl font-semibold text-white">From repo URL to answers</div>

                <div className="mt-8 grid gap-6 md:grid-cols-3 relative">
                  <div className="absolute top-1/2 left-0 w-full h-px bg-gradient-to-r from-transparent via-indigo-500/20 to-transparent hidden md:block -translate-y-1/2 z-0" />
                  
                  {[
                    { step: "01", title: "Ingest", desc: "Paste a repository URL and build the structure graph.", icon: GitBranch },
                    { step: "02", title: "Navigate", desc: "Click through folders/files/symbols and keep context pinned.", icon: Network },
                    { step: "03", title: "Ask", desc: "Ask questions and get retrieval-backed explanations grounded in code.", icon: Zap },
                  ].map((s) => (
                    <div key={s.step} className="relative z-10 rounded-xl border border-white/10 bg-black/60 p-6 backdrop-blur-sm hover:border-indigo-500/30 transition-all duration-300 hover:-translate-y-1 shadow-[0_4px_20px_rgba(0,0,0,0.2)] group">
                      <div className="flex items-center justify-between mb-4">
                        <div className="text-[10px] font-bold uppercase tracking-widest text-indigo-300 bg-indigo-500/10 px-2 py-1 rounded-md shadow-[0_0_10px_rgba(99,102,241,0.2)]">Step {s.step}</div>
                        <s.icon size={16} className="text-slate-500 group-hover:text-emerald-400 transition-colors" />
                      </div>
                      <div className="text-base font-semibold text-white mb-2 group-hover:text-indigo-200 transition-colors">{s.title}</div>
                      <div className="text-sm text-slate-400 leading-relaxed group-hover:text-slate-300">{s.desc}</div>
                    </div>
                  ))}
                </div>

                <div className="mt-12 flex flex-col sm:flex-row gap-4 justify-center border-t border-white/5 pt-8">
                  <Link href="/app" className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600/90 border border-indigo-500/50 px-6 py-3.5 text-xs font-bold uppercase tracking-widest text-white hover:bg-indigo-500 transition-all shadow-[0_0_20px_rgba(99,102,241,0.3)] hover:shadow-[0_0_30px_rgba(99,102,241,0.5)]">
                    Start mapping <ArrowRight size={16} />
                  </Link>
                  <Link href="/evolution" className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-6 py-3.5 text-xs font-bold uppercase tracking-widest text-slate-200 hover:bg-white/10 transition-colors group">
                    <Play size={14} className="text-slate-400 group-hover:text-white transition-colors" />
                    Watch demo
                  </Link>
                </div>
            </div>
          </div>
        </section>

      </main>

      {/* --- FOOTER --- */}
      <footer className="mx-auto max-w-6xl px-6 pt-10 pb-10 relative z-10 border-t border-white/5 mt-10">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-2">
              <span className="p-1 rounded bg-indigo-500/10 border border-indigo-500/20"><Terminal size={12} className="text-indigo-400" /></span>
              <span className="font-semibold text-slate-400 tracking-wider text-xs">DEX</span>
              <span className="text-slate-700 text-xs">/</span>
              <span className="text-slate-600 text-xs">Code intelligence, map-first.</span>
            </div>
            <div className="flex items-center gap-8 text-xs font-medium text-slate-500">
              <Link href="/app" className="hover:text-indigo-400 transition-colors">Open app</Link>
              <Link href="/evolution" className="hover:text-indigo-400 transition-colors">Evolution</Link>
              <Link href="#" className="hover:text-indigo-400 transition-colors">Privacy</Link>
              <Link href="https://github.com" className="hover:text-indigo-400 transition-colors flex items-center gap-1">
                GitHub <ArrowRight size={10} className="-rotate-45" />
              </Link>
            </div>
            <div className="text-[10px] text-slate-700">© 2024 Dex Inc.</div>
          </div>
      </footer>

    </div>
  );
}