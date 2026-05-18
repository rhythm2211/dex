"use client";

import React from "react";
import { motion } from "framer-motion";
import { Cpu, Lock, Sparkles, Terminal, ShieldCheck } from "lucide-react";

const F = {
  serif: "var(--dex-serif)",
  mono: "var(--dex-mono)",
};

const Glass: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  className = "",
  children,
  ...rest
}) => (
  <div
    {...rest}
    className={`backdrop-blur-md ${className}`}
    style={{
      background: "rgba(10, 10, 14, 0.55)",
      border: "1px solid rgba(255,255,255,0.08)",
      boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06), 0 4px 24px rgba(0,0,0,0.4)",
      ...(rest.style || {}),
    }}
  >
    {children}
  </div>
);

const MethodologyChat: React.FC = () => (
  <Glass className="rounded-2xl flex flex-col relative overflow-hidden shadow-2xl min-h-[280px]">
    <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
      <div className="flex items-center gap-2">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
        </span>
        <span className="text-xs font-bold text-slate-300 tracking-wide">DEX Assistant</span>
      </div>
      <Terminal size={12} className="text-slate-500" aria-hidden />
    </div>
    <div className="flex-1 p-4 space-y-4 font-mono text-xs">
      <div className="flex justify-end">
        <div className="bg-white/[0.08] border border-white/15 text-slate-200 px-3 py-2 rounded-l-lg rounded-tr-lg max-w-[85%]">
          How does retry logic in{" "}
          <span className="text-slate-100 bg-white/10 px-1 rounded">api.ts</span> handle 429
          responses?
        </div>
      </div>
      <div className="flex justify-start relative">
        <div className="absolute -left-2 top-0 bottom-0 w-1 bg-gradient-to-b from-white/35 to-transparent opacity-60" />
        <div className="pl-3 text-slate-300 max-w-[90%] space-y-2">
          <p>
            Based on{" "}
            <span className="text-emerald-400 underline decoration-dotted underline-offset-2">
              src/utils/api.ts:45-62
            </span>
            :
          </p>
          <p>
            The <span className="text-slate-100">fetchWithRetry</span> function applies exponential
            backoff when the upstream returns rate-limit errors.
          </p>
          <div className="bg-[#020202] border border-white/5 p-2 rounded text-slate-400 overflow-x-hidden">
            <span className="text-purple-400">if</span> (status === 429) {"{"}
            <br />
            &nbsp;&nbsp;<span className="text-blue-400">const</span> delay = base * Math.pow(2,
            attempt);
            <br />
            &nbsp;&nbsp;<span className="text-yellow-400">await</span> wait(delay);
            <br />
            {"}"}
          </div>
          <p className="text-slate-500">Default cap: five retry attempts.</p>
        </div>
      </div>
    </div>
  </Glass>
);

const METHODOLOGY_POINTS = [
  {
    title: "Cross-file context",
    desc: "Traverse imports, definitions, and type relationships across the repository.",
    icon: ShieldCheck,
  },
  {
    title: "Citation-backed answers",
    desc: "Responses reference verified file:line ranges in your codebase.",
    icon: ShieldCheck,
  },
  {
    title: "Deploy on your terms",
    desc: "Self-host with Docker Compose; your source never leaves your environment.",
    icon: Lock,
  },
] as const;

const HomeMethodology: React.FC = () => (
  <section id="how-it-works" className="relative scroll-mt-24 overflow-hidden py-24">
    <div
      className="pointer-events-none absolute inset-0"
      aria-hidden
      style={{
        background:
          "radial-gradient(ellipse 50% 60% at 75% 50%, rgba(255,255,255,0.04), transparent 70%)",
      }}
    />
    <div className="relative mx-auto grid max-w-6xl items-center gap-16 px-6 md:grid-cols-2">
      <div>
        <p
          className="text-[11px] font-bold uppercase tracking-[0.25em] text-slate-500"
          style={{ fontFamily: F.mono }}
        >
          Methodology
        </p>
        <h2
          className="mt-4 text-white"
          style={{
            fontFamily: F.serif,
            fontSize: "clamp(36px, 4.5vw, 56px)",
            lineHeight: 1.05,
            letterSpacing: "-0.02em",
            fontWeight: 400,
          }}
        >
          Beyond vector search.
          <br />
          <em
            style={{ fontStyle: "italic" }}
            className="bg-gradient-to-r from-slate-200 via-white to-slate-300 bg-clip-text text-transparent"
          >
            Graph-grounded intelligence.
          </em>
        </h2>
        <p className="mt-6 leading-relaxed text-slate-400">
          Most tools retrieve text fragments. DEX builds an{" "}
          <span className="font-medium text-white">abstract syntax tree</span> and a{" "}
          <span className="font-medium text-white">dependency graph</span> for the full project.
        </p>
        <p className="mt-4 text-sm leading-relaxed text-slate-500">
          When you ask how authentication works, DEX traverses imports and call sites — from
          middleware through data access — and returns an answer you can verify in source.
        </p>
        <div className="mt-8 space-y-3">
          {METHODOLOGY_POINTS.map((item, i) => {
            const Icon = item.icon;
            return (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, x: -16 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.5, delay: i * 0.08 }}
                className="flex gap-4 rounded-xl border border-white/10 bg-white/[0.02] p-4 transition-colors hover:bg-white/[0.05]"
              >
                <div className="mt-0.5 shrink-0">
                  <Icon size={18} className="text-emerald-400/90" aria-hidden />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-white">{item.title}</h4>
                  <p className="mt-1 text-xs leading-relaxed text-slate-500">{item.desc}</p>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      <div className="relative min-h-[340px]">
        <div
          className="pointer-events-none absolute inset-0 rounded-full bg-white/[0.06] blur-[72px]"
          aria-hidden
        />
        <div className="relative z-10 grid gap-6">
          <div className="translate-x-2 sm:translate-x-4">
            <MethodologyChat />
          </div>
          <Glass className="absolute -left-4 bottom-8 rounded-lg p-4 shadow-xl sm:-left-8">
            <div className="flex items-center gap-3">
              <div className="rounded bg-white/10 p-2 text-slate-300">
                <Cpu size={18} aria-hidden />
              </div>
              <div>
                <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                  Context window
                </div>
                <div className="font-mono text-sm text-white">4,203 tokens</div>
              </div>
            </div>
          </Glass>
          <Glass className="absolute -right-2 top-16 rounded-lg p-3 shadow-xl sm:-right-4">
            <div className="flex items-center gap-2">
              <Sparkles size={14} className="text-slate-300" aria-hidden />
              <span className="text-xs font-medium text-slate-200">Analysis active</span>
            </div>
          </Glass>
        </div>
      </div>
    </div>
  </section>
);

export default HomeMethodology;
