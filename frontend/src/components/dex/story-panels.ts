import type { StoryVisualKind } from "./StoryVisuals";

export type StoryAccent = "slate" | "violet" | "indigo" | "emerald";

export interface StoryBullet {
  title: string;
  body: string;
  code?: string;
}

export type StoryHeadlineKey =
  | "growing"
  | "rag"
  | "ast"
  | "citations"
  | "index";

export interface StoryPanel {
  id: string;
  step: string;
  eyebrow: string;
  mono: string;
  headlineKey: StoryHeadlineKey;
  lead: string;
  bullets?: StoryBullet[];
  visual: StoryVisualKind;
  bg: string;
  accent: StoryAccent;
  borderClass: string;
  labelClass: string;
  monoClass: string;
}

/** Shared narrative beats for /story and the home page scroll section */
export const STORY_PANELS: StoryPanel[] = [
  {
    id: "problem",
    step: "01",
    eyebrow: "The problem",
    mono: "// dex.codebase.entropy",
    headlineKey: "growing",
    lead: "Onboarding takes weeks. Debugging eats sprints. PR reviews stall on context that nobody on the team has time to rebuild. Every senior leaves and takes a mental map with them.",
    visual: "entropy",
    bg: "#050505",
    accent: "slate",
    borderClass: "border-white/10",
    labelClass: "text-slate-500",
    monoClass: "text-indigo-400/70",
  },
  {
    id: "rag-fails",
    step: "02",
    eyebrow: "The wrong fix",
    mono: "// vector.search.limitations",
    headlineKey: "rag",
    lead: "Snippet retrieval pattern-matches text. It misses imports, types, call sites, and how one file actually depends on another. You get plausible-sounding answers that point at the wrong file.",
    bullets: [
      {
        title: "Snippet bias",
        body: "Returns whatever looks relevant, not whatever is reachable from the call site.",
      },
      {
        title: "No structure",
        body: "Embeddings don't know that UserService depends on AuthMiddleware.",
        code: "UserService → AuthMiddleware",
      },
      {
        title: "Unverified output",
        body: "Models can infer missing context. Citations may not reflect actual call paths or dependencies.",
      },
    ],
    visual: "rag-fail",
    bg: "#0a0612",
    accent: "violet",
    borderClass: "border-violet-400/15",
    labelClass: "text-violet-300/70",
    monoClass: "text-violet-400/60",
  },
  {
    id: "approach",
    step: "03",
    eyebrow: "The DEX approach",
    mono: "// ast.parse() → graph.traverse()",
    headlineKey: "ast",
    lead: "DEX parses every file into a real Abstract Syntax Tree, links them into a dependency graph, then traverses the graph to answer questions — not the other way around.",
    bullets: [
      {
        title: "AST parsing",
        body: "Tree-sitter parses 80+ languages. Every function, import, and type relationship indexed.",
      },
      {
        title: "Dependency graph",
        body: "Callers, callees, imports, and types — traversable in constant time, not vector guesses.",
      },
      {
        title: "Grounded output",
        body: "Every answer cites file:line. The LLM only sees nodes the graph proves are reachable.",
      },
    ],
    visual: "ast-graph",
    bg: "#06091a",
    accent: "indigo",
    borderClass: "border-indigo-400/15",
    labelClass: "text-indigo-300/80",
    monoClass: "text-indigo-400/70",
  },
  {
    id: "outcomes",
    step: "04",
    eyebrow: "What you get",
    mono: "// grounded_answer.cite()",
    headlineKey: "citations",
    lead: "Every answer points to src/auth/middleware.ts:42-58 — the actual code, not a paraphrase. Click. Verify. Ship.",
    bullets: [
      { title: "Onboard faster", body: "New engineers orient with cited walkthroughs tied to real dependencies." },
      { title: "Debug with context", body: "Trace regressions across call sites with graph-backed navigation." },
      { title: "Review safely", body: "Blast-radius scoring before merge — files, tests, reviewers." },
      { title: "Refactor with proof", body: "See the full dependency cone of any function before you touch it." },
    ],
    visual: "citations",
    bg: "#070d10",
    accent: "emerald",
    borderClass: "border-emerald-400/15",
    labelClass: "text-emerald-300/80",
    monoClass: "text-emerald-400/70",
  },
  {
    id: "cta",
    step: "05",
    eyebrow: "Your move",
    mono: "// public.beta — 14d free",
    headlineKey: "index",
    lead: "Connect a repository and DEX builds the graph in minutes. Every answer is grounded in structure and file:line citations.",
    visual: "index-repo",
    bg: "#030308",
    accent: "indigo",
    borderClass: "border-white/10",
    labelClass: "text-slate-500",
    monoClass: "text-indigo-400/70",
  },
];
