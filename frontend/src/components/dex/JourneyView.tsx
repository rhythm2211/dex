"use client";

import React, { useRef } from "react";
import Link from "next/link";
import {
  motion,
  useScroll,
  useTransform,
  useReducedMotion,
} from "framer-motion";
import {
  ArrowRight,
  FileCode2,
  GitBranch,
  Network,
  Sparkles,
  ShieldCheck,
  Terminal,
  Github,
  Zap,
  Cpu,
  Search,
  Layers,
} from "lucide-react";
import {
  GoogleGeminiEffect,
  type GeminiStage,
} from "@/components/ui/google-gemini-effect";

/**
 * JourneyView — client-side render for /journey.
 *
 * A blend of the landing page's core elements and the /story scroll-narrative,
 * anchored by the Gemini pipeline visualization.
 *
 * Structure:
 *   1. HERO         — Gemini effect, 5 paths = 5 DEX pipeline stages
 *   2. PIPELINE     — stage cards explaining each path
 *   3. STORY        — three sticky narrative panels (problem → fix → outcome)
 *   4. METRICS      — small core-element strip lifted from the home aesthetic
 *   5. CTA          — final indigo conversion block
 */

// -----------------------------------------------------------------------------
// HERO — Gemini Pipeline Effect
// -----------------------------------------------------------------------------

const PIPELINE_STAGES: GeminiStage[] = [
  { label: "01 · Source files", color: "#FFB7C5" },
  { label: "02 · AST parse", color: "#FFDDB7" },
  { label: "03 · Dependency graph", color: "#B1C5FF" },
  { label: "04 · Embeddings", color: "#4FABFF" },
  { label: "05 · Grounded answer", color: "#076EFF" },
];

function GeminiPipelineHero() {
  const ref = useRef<HTMLDivElement>(null);
  const prefersReduced = useReducedMotion();

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"],
  });

  // Five paths complete at slightly different points so the flow feels
  // sequential — like the pipeline really runs stage-by-stage.
  const p1 = useTransform(scrollYProgress, [0, 0.8], [0.2, 1.2]);
  const p2 = useTransform(scrollYProgress, [0, 0.8], [0.15, 1.2]);
  const p3 = useTransform(scrollYProgress, [0, 0.8], [0.1, 1.2]);
  const p4 = useTransform(scrollYProgress, [0, 0.8], [0.05, 1.2]);
  const p5 = useTransform(scrollYProgress, [0, 0.8], [0, 1.2]);

  // For reduced-motion users, freeze the paths in their "complete" state.
  const staticOne = useTransform(scrollYProgress, [0, 1], [1, 1]);
  const lengths = prefersReduced
    ? [staticOne, staticOne, staticOne, staticOne, staticOne]
    : [p1, p2, p3, p4, p5];

  return (
    <section
      ref={ref}
      className="relative h-[400vh] w-full overflow-clip bg-black pt-40"
      aria-label="DEX pipeline visualization"
    >
      {/* Ambient indigo wash so the page reads as DEX, not a neutral demo. */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[120vh] bg-[radial-gradient(circle_at_50%_0%,rgba(99,102,241,0.18),transparent_60%)]" />

      <GoogleGeminiEffect
        pathLengths={lengths}
        title="From repo to grounded answer."
        description="DEX ingests every file, builds a real AST and dependency graph, then traverses it to answer questions with file:line citations. Scroll to watch each stage of the pipeline light up."
        badge={
          <Link
            href="/signup"
            className="group inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-[11px] md:text-xs font-bold uppercase tracking-[0.2em] text-black shadow-[0_0_50px_rgba(255,255,255,0.25)] transition-all hover:scale-105 hover:shadow-[0_0_60px_rgba(99,102,241,0.45)]"
          >
            <Terminal size={14} className="text-indigo-600" />
            <span>DEX // pipeline.run()</span>
            <ArrowRight
              size={12}
              className="transition-transform group-hover:translate-x-0.5"
            />
          </Link>
        }
        stageLabels={PIPELINE_STAGES}
      />
    </section>
  );
}

// -----------------------------------------------------------------------------
// PIPELINE — five cards mapped to the five paths
// -----------------------------------------------------------------------------

const PIPELINE_CARDS = [
  {
    color: "#FFB7C5",
    icon: FileCode2,
    label: "01 · Source",
    title: "Ingest every file",
    body: "Connect a repo and we mirror its full tree — 80+ languages, monorepos, lockfiles, and git history included. Nothing is summarized at this stage; the source is the source of truth.",
  },
  {
    color: "#FFDDB7",
    icon: Cpu,
    label: "02 · AST",
    title: "Parse to a real syntax tree",
    body: "Tree-sitter walks each file into a structured AST. Functions, classes, imports, types, and call sites become first-class nodes — no regex, no string matching.",
  },
  {
    color: "#B1C5FF",
    icon: Network,
    label: "03 · Graph",
    title: "Link callers, callees, and types",
    body: "AST nodes are stitched into a Neo4j dependency graph. Edges encode imports, function calls, type references, and ownership — traversable in constant time.",
  },
  {
    color: "#4FABFF",
    icon: Search,
    label: "04 · Embeddings",
    title: "Index for semantic recall",
    body: "Symbols and docs are embedded so DEX can shortlist relevant nodes for any question. Embeddings rank — they never invent. The graph is always the final authority.",
  },
  {
    color: "#076EFF",
    icon: ShieldCheck,
    label: "05 · Answer",
    title: "Cite every line",
    body: "DEX hands the LLM only the subgraph it proved is reachable, with file:line citations baked in. Click any citation to open the exact code. No hallucinations.",
  },
];

function PipelineCards() {
  return (
    <section className="relative border-t border-white/5 bg-black px-6 py-28">
      <div className="mx-auto max-w-7xl">
        <div className="mb-14 max-w-3xl">
          <p className="mb-4 text-[11px] font-bold uppercase tracking-[0.25em] text-indigo-300/80">
            // pipeline.stages[]
          </p>
          <h2 className="text-4xl md:text-5xl font-semibold tracking-tight text-white">
            Five stages.{" "}
            <span className="bg-gradient-to-r from-indigo-300 via-sky-200 to-indigo-400 bg-clip-text text-transparent">
              One continuous flow.
            </span>
          </h2>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-slate-400">
            Each colored path in the visualization above maps to a real step in
            the DEX pipeline. They run in parallel for fresh repos and
            incrementally for every push thereafter.
          </p>
        </div>

        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {PIPELINE_CARDS.map((card, i) => {
            const Icon = card.icon;
            return (
              <motion.div
                key={card.label}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-80px" }}
                transition={{ duration: 0.5, delay: i * 0.08 }}
                className="group relative overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6 backdrop-blur-sm transition-all hover:border-white/[0.16] hover:bg-white/[0.04]"
              >
                <span
                  className="pointer-events-none absolute -left-px top-0 h-full w-[3px]"
                  style={{
                    background: card.color,
                    boxShadow: `0 0 24px ${card.color}99`,
                  }}
                />
                <div
                  className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg"
                  style={{
                    background: `${card.color}1a`,
                    border: `1px solid ${card.color}33`,
                    color: card.color,
                  }}
                >
                  <Icon size={18} />
                </div>
                <p
                  className="mb-3 text-[10px] font-mono font-bold uppercase tracking-[0.22em]"
                  style={{ color: card.color }}
                >
                  {card.label}
                </p>
                <h3 className="mb-3 text-lg font-semibold text-white">
                  {card.title}
                </h3>
                <p className="text-sm leading-relaxed text-slate-400">
                  {card.body}
                </p>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// -----------------------------------------------------------------------------
// STORY — three sticky narrative panels (compact /story aesthetic)
// -----------------------------------------------------------------------------

const STORY_PANELS = [
  {
    bg: "bg-[#050505]",
    chipBorder: "border-slate-500/30",
    chipText: "text-slate-400",
    chip: "01 · The problem",
    mono: "// codebase.entropy",
    monoColor: "text-indigo-400/70",
    headlinePre: "Codebases",
    headlineMid: "keep",
    headlineEnd: "growing.",
    midColor:
      "bg-gradient-to-b from-white via-slate-300 to-slate-500 bg-clip-text text-transparent",
    endColor: "text-indigo-400",
    body: "Onboarding takes weeks. Debugging eats sprints. PR reviews stall on context nobody has time to rebuild. Every senior leaves and takes a mental map with them.",
  },
  {
    bg: "bg-[#06091a]",
    chipBorder: "border-indigo-400/30",
    chipText: "text-indigo-300",
    chip: "02 · The DEX fix",
    mono: "// ast.parse() ⇒ graph.traverse()",
    monoColor: "text-indigo-400/70",
    headlinePre: "AST.",
    headlineMid: "Graph.",
    headlineEnd: "Truth.",
    midColor: "text-white",
    endColor: "text-indigo-400",
    body: "DEX parses every file into a real Abstract Syntax Tree, links it into a dependency graph, and traverses the graph to answer — not the other way around. Embeddings rank; the graph rules.",
  },
  {
    bg: "bg-[#07120d]",
    chipBorder: "border-emerald-400/30",
    chipText: "text-emerald-300",
    chip: "03 · The outcome",
    mono: "// grounded_answer.cite()",
    monoColor: "text-emerald-400/70",
    headlinePre: "Real",
    headlineMid: "file",
    headlineEnd: "references.",
    midColor:
      "bg-gradient-to-r from-emerald-300 via-teal-200 to-cyan-300 bg-clip-text text-transparent",
    endColor: "text-white",
    body: "Every answer points to src/auth/middleware.ts:42-58 — the actual code, not a paraphrase. Click. Verify. Ship.",
  },
];

function StoryPanels() {
  return (
    <section className="relative bg-black" aria-label="Why DEX exists">
      {STORY_PANELS.map((panel, idx) => (
        <div
          key={panel.chip}
          className={`sticky top-0 flex min-h-screen w-full flex-col justify-between gap-6 overflow-hidden px-[6vw] pb-[4vw] pt-[clamp(2.5rem,8vw,5vw)] ${panel.bg} text-white`}
          style={{ zIndex: idx + 1 }}
        >
          <div className="flex items-center justify-between">
            <span
              className={`inline-flex items-center rounded-full border ${panel.chipBorder} bg-white/[0.02] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.22em] ${panel.chipText}`}
            >
              {panel.chip}
            </span>
            <span
              className={`text-[11px] font-mono uppercase tracking-[0.22em] ${panel.monoColor}`}
            >
              {panel.mono}
            </span>
          </div>

          <hr className="my-[2vw] border-none border-t border-white/10" />

          <h2 className="text-[clamp(3rem,11vw,12rem)] font-bold uppercase leading-[0.85] tracking-tight">
            {panel.headlinePre}
            <br />
            <span className={panel.midColor}>{panel.headlineMid}</span>
            <br />
            <span className={panel.endColor}>{panel.headlineEnd}</span>
          </h2>

          <hr className="my-[2vw] border-none border-t border-white/10" />

          <p className="mt-auto max-w-[55ch] text-[clamp(1rem,2vw,1.6rem)] font-light leading-relaxed text-slate-400">
            {panel.body}
          </p>
        </div>
      ))}
    </section>
  );
}

// -----------------------------------------------------------------------------
// METRICS — small core-element strip from the home aesthetic
// -----------------------------------------------------------------------------

const METRICS = [
  { value: "80+", label: "Languages parsed", icon: Layers },
  { value: "~12s", label: "Median answer time", icon: Zap },
  { value: "100%", label: "Cited responses", icon: ShieldCheck },
  { value: "0", label: "Hallucinated paths", icon: Sparkles },
];

function MetricStrip() {
  return (
    <section className="relative border-t border-white/5 bg-black px-6 py-20">
      <div className="mx-auto max-w-7xl">
        <div className="mb-10 flex flex-col items-start justify-between gap-4 md:flex-row md:items-end">
          <div>
            <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.25em] text-indigo-300/80">
              // dex.metrics
            </p>
            <h2 className="text-3xl md:text-4xl font-semibold text-white">
              What grounded retrieval gets you.
            </h2>
          </div>
          <Link
            href="/health"
            className="group inline-flex items-center gap-2 text-sm font-medium text-indigo-400 transition-colors hover:text-indigo-300"
          >
            See the health report
            <ArrowRight
              size={14}
              className="transition-transform group-hover:translate-x-1"
            />
          </Link>
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {METRICS.map((m) => {
            const Icon = m.icon;
            return (
              <div
                key={m.label}
                className="group relative overflow-hidden rounded-xl border border-white/[0.06] bg-[#0a0a0a]/80 p-5 backdrop-blur-xl transition-all hover:border-indigo-400/20"
              >
                <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-300">
                  <Icon size={16} />
                </div>
                <div className="text-3xl font-bold tracking-tight text-white">
                  {m.value}
                </div>
                <div className="mt-1 text-xs uppercase tracking-widest text-slate-500">
                  {m.label}
                </div>
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-indigo-500/40 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// -----------------------------------------------------------------------------
// CTA — same conversion pattern as the home, scoped to /journey
// -----------------------------------------------------------------------------

function FinalCTA() {
  return (
    <section className="relative overflow-hidden border-t border-white/5 bg-black px-6 py-28">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-1/2 h-[420px] w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-indigo-500/[0.07] blur-[120px]" />
        <div className="absolute left-[20%] top-[30%] h-[260px] w-[260px] rounded-full bg-purple-500/[0.05] blur-[100px]" />
        <div className="absolute right-[20%] top-[60%] h-[260px] w-[260px] rounded-full bg-sky-500/[0.05] blur-[100px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-100px" }}
        transition={{ duration: 0.6 }}
        className="relative mx-auto max-w-3xl rounded-2xl border border-white/[0.08] bg-[#0a0a0a]/80 p-10 text-center backdrop-blur-xl"
      >
        <div className="mx-auto mb-5 inline-flex items-center gap-2 rounded-full border border-indigo-400/20 bg-indigo-500/[0.08] px-3 py-1">
          <Sparkles size={12} className="text-indigo-300" />
          <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-indigo-200">
            Public beta · 14 days free
          </span>
        </div>
        <h2 className="text-4xl md:text-5xl font-semibold tracking-tight text-white">
          Index your repo.{" "}
          <span className="bg-gradient-to-r from-indigo-300 via-white to-indigo-300 bg-clip-text text-transparent">
            See it map itself.
          </span>
        </h2>
        <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-slate-400">
          Connect GitHub, watch your dependency graph build live, and ask
          anything. No credit card, no agents to install.
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/signup"
            className="group inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-7 py-3.5 text-sm font-bold uppercase tracking-[0.16em] text-white shadow-[0_0_40px_rgba(99,102,241,0.35)] transition-all hover:bg-indigo-500 hover:shadow-[0_0_60px_rgba(99,102,241,0.55)]"
          >
            <Zap size={14} />
            Start indexing
            <ArrowRight
              size={14}
              className="transition-transform group-hover:translate-x-1"
            />
          </Link>
          <Link
            href="/story"
            className="group inline-flex items-center gap-2 rounded-xl border border-white/[0.1] bg-white/[0.04] px-7 py-3.5 text-sm font-bold uppercase tracking-[0.16em] text-slate-200 transition-all hover:bg-white/[0.07] hover:text-white"
          >
            <GitBranch size={14} />
            Read the full story
          </Link>
          <Link
            href="https://github.com/"
            target="_blank"
            rel="noreferrer noopener"
            className="group inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.16em] text-slate-500 transition-colors hover:text-indigo-300"
          >
            <Github
              size={14}
              className="transition-transform group-hover:rotate-12"
            />
            Star on GitHub
          </Link>
        </div>
      </motion.div>
    </section>
  );
}

// -----------------------------------------------------------------------------
// PAGE
// -----------------------------------------------------------------------------

export default function JourneyView() {
  return (
    <main className="bg-black text-white selection:bg-indigo-500/40">
      <GeminiPipelineHero />
      <PipelineCards />
      <StoryPanels />
      <MetricStrip />
      <FinalCTA />
    </main>
  );
}
