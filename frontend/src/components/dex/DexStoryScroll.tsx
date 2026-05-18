'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowRight, Github, GitBranch, Network, FileSearch, ShieldCheck, Zap } from 'lucide-react';
import FlowArt, { FlowSection } from '@/components/ui/story-scroll';

/**
 * DexStoryScroll
 *
 * GSAP-pinned, scroll-stacked narrative tailored to DEX's launch story.
 * Five panels: problem -> why RAG fails -> DEX's AST+Graph approach -> outcomes -> CTA.
 * Color system stays within DEX's dark/indigo brand — never the demo's orange palette.
 *
 * Render at top-level pages only (the underlying FlowArt component renders <main>).
 */
const DexStoryScroll: React.FC = () => {
  return (
    <FlowArt aria-label="How DEX understands your codebase">
      {/* =====================================================================
          PANEL 01 — THE PROBLEM
          ===================================================================== */}
      <FlowSection
        aria-label="The problem"
        style={{ backgroundColor: '#050505', color: '#fff' }}
      >
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-slate-500">
            01 &mdash; The problem
          </p>
          <p className="text-[11px] font-mono uppercase tracking-widest text-indigo-400/70">
            // dex.codebase.entropy
          </p>
        </div>
        <hr className="my-[2vw] border-none border-t border-white/10" />
        <div>
          <h2 className="text-[clamp(3.5rem,12vw,14rem)] font-bold leading-[0.85] uppercase tracking-tight text-white">
            Codebases
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-b from-white via-slate-300 to-slate-500">
              keep
            </span>
            <br />
            <span className="text-indigo-400">growing.</span>
          </h2>
        </div>
        <hr className="my-[2vw] border-none border-t border-white/10" />
        <p className="mt-auto max-w-[55ch] text-[clamp(1rem,2.2vw,1.75rem)] font-light leading-relaxed text-slate-400">
          Onboarding takes weeks. Debugging eats sprints. PR reviews stall on context that nobody on
          the team has time to rebuild. Every senior leaves and takes a mental map with them.
        </p>
      </FlowSection>

      {/* =====================================================================
          PANEL 02 — WHY RAG ALONE FAILS
          ===================================================================== */}
      <FlowSection
        aria-label="Why RAG fails"
        style={{ backgroundColor: '#0a0612', color: '#fff' }}
      >
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-violet-300/70">
            02 &mdash; The wrong fix
          </p>
          <p className="text-[11px] font-mono uppercase tracking-widest text-violet-400/60">
            // vector.search.lies()
          </p>
        </div>
        <hr className="my-[2vw] border-none border-t border-violet-400/15" />
        <div>
          <h2 className="text-[clamp(3.5rem,12vw,14rem)] font-bold leading-[0.85] uppercase tracking-tight text-white">
            Vector
            <br />
            search
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-rose-400 via-fuchsia-300 to-violet-400">
              isn&apos;t enough.
            </span>
          </h2>
        </div>
        <hr className="my-[2vw] border-none border-t border-violet-400/15" />
        <p className="max-w-[55ch] text-[clamp(1rem,2.2vw,1.75rem)] font-light leading-relaxed text-slate-300">
          Snippet retrieval pattern-matches text. It misses imports, types, call sites, and how one
          file actually depends on another. You get plausible-sounding answers that point at the
          wrong file.
        </p>
        <hr className="my-[2vw] border-none border-t border-violet-400/15" />
        <div className="flex flex-wrap gap-[3vw]">
          <div className="min-w-[180px] flex-1">
            <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.18em] text-violet-300">
              Snippet bias
            </p>
            <p className="text-[clamp(0.85rem,1.3vw,1.05rem)] leading-relaxed text-slate-400">
              Returns whatever <em className="text-slate-200 not-italic">looks</em> relevant, not
              whatever <em className="text-slate-200 not-italic">is</em> reachable from the call
              site.
            </p>
          </div>
          <div className="min-w-[180px] flex-1">
            <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.18em] text-violet-300">
              No structure
            </p>
            <p className="text-[clamp(0.85rem,1.3vw,1.05rem)] leading-relaxed text-slate-400">
              Embeddings don&apos;t know that <code className="text-indigo-300">UserService</code>{' '}
              depends on <code className="text-indigo-300">AuthMiddleware</code>.
            </p>
          </div>
          <div className="min-w-[180px] flex-1">
            <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.18em] text-violet-300">
              Confident lies
            </p>
            <p className="text-[clamp(0.85rem,1.3vw,1.05rem)] leading-relaxed text-slate-400">
              LLMs paper over gaps with hallucinated function names. Citations look real until you
              try to open them.
            </p>
          </div>
        </div>
      </FlowSection>

      {/* =====================================================================
          PANEL 03 — DEX'S APPROACH: AST + GRAPH
          ===================================================================== */}
      <FlowSection
        aria-label="DEX's approach: AST + Graph"
        style={{ backgroundColor: '#06091a', color: '#fff' }}
      >
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-indigo-300/80">
            03 &mdash; The DEX approach
          </p>
          <p className="text-[11px] font-mono uppercase tracking-widest text-indigo-400/70">
            // ast.parse() &rArr; graph.traverse()
          </p>
        </div>
        <hr className="my-[2vw] border-none border-t border-indigo-400/15" />
        <div>
          <h2 className="text-[clamp(3.5rem,12vw,14rem)] font-bold leading-[0.85] uppercase tracking-tight text-white">
            <span className="text-transparent bg-clip-text bg-gradient-to-b from-indigo-300 via-white to-sky-300">
              AST.
            </span>
            <br />
            Graph.
            <br />
            <span className="text-indigo-400">Truth.</span>
          </h2>
        </div>
        <hr className="my-[2vw] border-none border-t border-indigo-400/15" />
        <p className="max-w-[55ch] text-[clamp(1rem,2.2vw,1.75rem)] font-light leading-relaxed text-slate-300">
          DEX parses every file into a real Abstract Syntax Tree, links them into a dependency
          graph, then{' '}
          <span className="text-indigo-300 font-medium">traverses the graph</span> to answer
          questions &mdash; not the other way around.
        </p>
        <hr className="my-[2vw] border-none border-t border-indigo-400/15" />
        <div className="flex flex-wrap gap-[3vw]">
          <div className="min-w-[180px] flex-1">
            <div className="mb-3 inline-flex items-center gap-2 rounded-md bg-indigo-500/10 px-2 py-1 ring-1 ring-inset ring-indigo-400/20">
              <FileSearch size={12} className="text-indigo-300" />
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-indigo-200">
                AST Parsing
              </p>
            </div>
            <p className="text-[clamp(0.85rem,1.3vw,1.05rem)] leading-relaxed text-slate-400">
              Tree-sitter parses 80+ languages into structured syntax trees. Every function, import,
              and type relationship indexed.
            </p>
          </div>
          <div className="min-w-[180px] flex-1">
            <div className="mb-3 inline-flex items-center gap-2 rounded-md bg-sky-500/10 px-2 py-1 ring-1 ring-inset ring-sky-400/20">
              <Network size={12} className="text-sky-300" />
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-sky-200">
                Dependency Graph
              </p>
            </div>
            <p className="text-[clamp(0.85rem,1.3vw,1.05rem)] leading-relaxed text-slate-400">
              Edges between callers, callees, imports, and types. Stored in Neo4j. Traversable in
              constant time, not vector-similarity guesses.
            </p>
          </div>
          <div className="min-w-[180px] flex-1">
            <div className="mb-3 inline-flex items-center gap-2 rounded-md bg-emerald-500/10 px-2 py-1 ring-1 ring-inset ring-emerald-400/20">
              <ShieldCheck size={12} className="text-emerald-300" />
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-200">
                Grounded Output
              </p>
            </div>
            <p className="text-[clamp(0.85rem,1.3vw,1.05rem)] leading-relaxed text-slate-400">
              Every answer cites <code className="text-emerald-300">file:line</code>. The LLM only
              sees nodes the graph proves are reachable. No hallucinations.
            </p>
          </div>
        </div>
      </FlowSection>

      {/* =====================================================================
          PANEL 04 — WHAT YOU GET
          ===================================================================== */}
      <FlowSection
        aria-label="What you get"
        style={{ backgroundColor: '#070d10', color: '#fff' }}
      >
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-emerald-300/80">
            04 &mdash; What you get
          </p>
          <p className="text-[11px] font-mono uppercase tracking-widest text-emerald-400/70">
            // grounded_answer.cite()
          </p>
        </div>
        <hr className="my-[2vw] border-none border-t border-emerald-400/15" />
        <div>
          <h2 className="text-[clamp(3.5rem,12vw,14rem)] font-bold leading-[0.85] uppercase tracking-tight text-white">
            Real
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-300 via-teal-200 to-cyan-300">
              file
            </span>
            <br />
            references.
          </h2>
        </div>
        <hr className="my-[2vw] border-none border-t border-emerald-400/15" />
        <p className="max-w-[55ch] text-[clamp(1rem,2.2vw,1.75rem)] font-light leading-relaxed text-slate-300">
          Every answer points to{' '}
          <code className="text-emerald-300 text-[0.85em]">src/auth/middleware.ts:42-58</code>{' '}
          &mdash; the actual code, not a paraphrase. Click. Verify. Ship.
        </p>
        <hr className="my-[2vw] border-none border-t border-emerald-400/15" />
        <div className="flex flex-wrap gap-[3vw]">
          <div className="min-w-[180px] flex-1">
            <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.2em] text-emerald-200">
              Onboard fast
            </p>
            <p className="text-[clamp(0.85rem,1.3vw,1.05rem)] leading-relaxed text-slate-400">
              New engineers map a repo in an afternoon. Ask &ldquo;how does auth work?&rdquo; &mdash;
              get a walkthrough with citations.
            </p>
          </div>
          <div className="min-w-[180px] flex-1">
            <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.2em] text-emerald-200">
              Debug deeper
            </p>
            <p className="text-[clamp(0.85rem,1.3vw,1.05rem)] leading-relaxed text-slate-400">
              Trace a regression through every call site. No more <code>grep</code> and pray.
            </p>
          </div>
          <div className="min-w-[180px] flex-1">
            <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.2em] text-emerald-200">
              Review safely
            </p>
            <p className="text-[clamp(0.85rem,1.3vw,1.05rem)] leading-relaxed text-slate-400">
              Blast-radius scoring shows which files, tests, and reviewers are affected by a PR
              before merge.
            </p>
          </div>
          <div className="min-w-[180px] flex-1">
            <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.2em] text-emerald-200">
              Refactor with proof
            </p>
            <p className="text-[clamp(0.85rem,1.3vw,1.05rem)] leading-relaxed text-slate-400">
              See the full dependency cone of any function before you touch it.
            </p>
          </div>
        </div>
      </FlowSection>

      {/* =====================================================================
          PANEL 05 — JOIN / CTA
          ===================================================================== */}
      <FlowSection
        aria-label="Index your repo"
        style={{ backgroundColor: '#000', color: '#fff' }}
      >
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-slate-500">
            05 &mdash; Your move
          </p>
          <p className="text-[11px] font-mono uppercase tracking-widest text-indigo-400/70">
            // public.beta &mdash; 14d free
          </p>
        </div>
        <hr className="my-[2vw] border-none border-t border-white/10" />
        <div>
          <h2 className="text-[clamp(3.5rem,12vw,14rem)] font-bold leading-[0.85] uppercase tracking-tight text-white">
            Index
            <br />
            your
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-300 via-white to-indigo-300 animate-pulse">
              repo.
            </span>
          </h2>
        </div>
        <hr className="my-[2vw] border-none border-t border-white/10" />
        <p className="max-w-[55ch] text-[clamp(1rem,2.2vw,1.75rem)] font-light leading-relaxed text-slate-400">
          Free public beta. 14 days unlimited indexing. No credit card. Connect GitHub, watch your
          dependency graph build live, and ask anything.
        </p>
        <div className="mt-[3vw] flex flex-wrap items-center gap-4">
          <Link
            href="/signup"
            className="group inline-flex items-center gap-2 rounded-xl bg-white px-7 py-3.5 text-xs font-bold uppercase tracking-[0.18em] text-black transition-all hover:bg-slate-200 hover:shadow-[0_0_40px_rgba(255,255,255,0.18)]"
          >
            <Zap size={14} />
            Start indexing
            <ArrowRight
              size={14}
              className="transition-transform group-hover:translate-x-1"
            />
          </Link>
          <Link
            href="https://github.com/"
            className="group inline-flex items-center gap-2 rounded-xl bg-white/[0.04] px-7 py-3.5 text-xs font-bold uppercase tracking-[0.18em] text-slate-300 ring-1 ring-inset ring-white/10 backdrop-blur-sm transition-all hover:bg-white/[0.07] hover:text-white"
          >
            <Github size={14} className="transition-transform group-hover:rotate-12" />
            Star on GitHub
          </Link>
          <Link
            href="/blast-radius"
            className="group inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 hover:text-indigo-300 transition-colors"
          >
            <GitBranch size={14} />
            See a demo first
            <ArrowRight
              size={12}
              className="transition-transform group-hover:translate-x-1"
            />
          </Link>
        </div>
      </FlowSection>
    </FlowArt>
  );
};

export default DexStoryScroll;
