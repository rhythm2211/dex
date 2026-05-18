"use client";

import React from "react";
import { motion } from "framer-motion";
import {
  ArrowRight,
  FileCode2,
  GitBranch,
  Network,
  Search,
  ShieldCheck,
  X,
  Zap,
} from "lucide-react";

export type StoryVisualKind =
  | "entropy"
  | "rag-fail"
  | "ast-graph"
  | "citations"
  | "index-repo";

const frame =
  "relative overflow-hidden rounded-2xl border border-white/10 bg-[#0a0a0f]/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_24px_80px_rgba(0,0,0,0.55)] backdrop-blur-xl";

function VisualChrome({
  label,
  children,
  accent = "indigo",
}: {
  label: string;
  children: React.ReactNode;
  accent?: "slate" | "violet" | "indigo" | "emerald";
}) {
  const dot =
    accent === "violet"
      ? "bg-violet-400"
      : accent === "emerald"
        ? "bg-emerald-400"
        : accent === "slate"
          ? "bg-slate-400"
          : "bg-indigo-400";

  return (
    <motion.div
      data-flow-visual
      initial={{ opacity: 0, scale: 0.96 }}
      whileInView={{ opacity: 1, scale: 1 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
      className={`${frame} aspect-[4/3] w-full min-h-[280px] lg:min-h-[360px]`}
    >
      <motion.div
        className="absolute inset-0 opacity-40"
        animate={{ backgroundPosition: ["0% 0%", "100% 100%"] }}
        transition={{ duration: 18, repeat: Infinity, repeatType: "reverse", ease: "linear" }}
        style={{
          backgroundImage:
            "radial-gradient(circle at 20% 20%, rgba(255,255,255,0.06), transparent 45%), radial-gradient(circle at 80% 70%, rgba(99,102,241,0.12), transparent 50%)",
          backgroundSize: "200% 200%",
        }}
      />
      <div className="relative z-10 flex h-full flex-col">
        <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3">
          <span className={`h-2 w-2 rounded-full ${dot}`} />
          <span className="font-mono text-[10px] uppercase tracking-widest text-slate-500">{label}</span>
        </div>
        <div className="flex flex-1 items-center justify-center p-4 sm:p-6">{children}</div>
      </div>
    </motion.div>
  );
}

function EntropyVisual() {
  const files = [
    { name: "api/routes.ts", h: 48 },
    { name: "auth/middleware.ts", h: 64 },
    { name: "db/models/user.ts", h: 56 },
    { name: "services/billing.py", h: 72 },
    { name: "workers/queue.ts", h: 40 },
    { name: "legacy/v1_core.js", h: 88 },
  ];

  return (
    <VisualChrome label="repo.scan — depth 847" accent="slate">
      <motion.div className="grid w-full max-w-md grid-cols-2 gap-2 sm:gap-3">
        {files.map((f, i) => (
          <motion.div
            key={f.name}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08, duration: 0.5 }}
            className="rounded-lg border border-white/10 bg-white/[0.04] p-2"
            style={{ minHeight: f.h }}
          >
            <FileCode2 size={14} className="mb-1 text-slate-500" />
            <p className="truncate font-mono text-[9px] text-slate-400">{f.name}</p>
            <motion.div
              className="mt-2 h-1 rounded-full bg-gradient-to-r from-slate-600 to-slate-400"
              initial={{ width: "20%" }}
              animate={{ width: ["30%", "95%", "70%"] }}
              transition={{ duration: 3 + i * 0.4, repeat: Infinity, repeatType: "reverse" }}
            />
          </motion.div>
        ))}
      </motion.div>
    </VisualChrome>
  );
}

function RagFailVisual() {
  return (
    <VisualChrome label="vector.search — low confidence" accent="violet">
      <div className="w-full max-w-md space-y-3">
        <div className="flex items-center gap-2 rounded-lg border border-violet-500/20 bg-violet-500/10 px-3 py-2">
          <Search size={14} className="text-violet-300" />
          <span className="font-mono text-xs text-violet-100">"how does auth work?"</span>
        </div>
        {[
          { file: "README.md", score: "0.91", ok: false },
          { file: "notes/auth-todo.txt", score: "0.88", ok: false },
          { file: "src/auth/middleware.ts", score: "0.41", ok: true },
        ].map((row, i) => (
          <motion.div
            key={row.file}
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 + i * 0.12 }}
            className={`flex items-center justify-between rounded-lg border px-3 py-2 ${
              row.ok
                ? "border-emerald-500/30 bg-emerald-500/10"
                : "border-red-500/25 bg-red-500/5"
            }`}
          >
            <div className="flex items-center gap-2">
              {row.ok ? (
                <ShieldCheck size={14} className="text-emerald-400" />
              ) : (
                <X size={14} className="text-red-400" />
              )}
              <span className="font-mono text-[10px] text-slate-300">{row.file}</span>
            </div>
            <span className="font-mono text-[10px] text-slate-500">{row.score}</span>
          </motion.div>
        ))}
        <p className="text-center text-[10px] text-violet-300/80">
          Top hits ≠ reachable code
        </p>
      </div>
    </VisualChrome>
  );
}

function AstGraphVisual() {
  const nodes = [
    { id: "a", x: "12%", y: "18%", label: "index.ts", tone: "indigo" },
    { id: "b", x: "52%", y: "8%", label: "UserService", tone: "sky" },
    { id: "c", x: "78%", y: "38%", label: "AuthMw", tone: "emerald" },
    { id: "d", x: "28%", y: "62%", label: "db/user.ts", tone: "violet" },
    { id: "e", x: "68%", y: "72%", label: "api/routes", tone: "indigo" },
  ];

  return (
    <VisualChrome label="graph.traverse — grounded path" accent="indigo">
      <div className="relative h-full w-full max-w-md">
        <svg className="absolute inset-0 h-full w-full" aria-hidden>
          <motion.line
            x1="20%" y1="28%" x2="55%" y2="18%"
            stroke="rgba(129,140,248,0.45)" strokeWidth="1.5"
            initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
            transition={{ duration: 1.2, delay: 0.2 }}
          />
          <motion.line
            x1="58%" y1="22%" x2="76%" y2="42%"
            stroke="rgba(52,211,153,0.45)" strokeWidth="1.5"
            initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
            transition={{ duration: 1.2, delay: 0.45 }}
          />
          <motion.line
            x1="24%" y1="68%" x2="66%" y2="76%"
            stroke="rgba(167,139,250,0.4)" strokeWidth="1.5"
            initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
            transition={{ duration: 1.2, delay: 0.65 }}
          />
        </svg>
        {nodes.map((n, i) => (
          <motion.div
            key={n.id}
            className="absolute rounded-lg border border-white/15 bg-black/50 px-2 py-1 backdrop-blur-sm"
            style={{ left: n.x, top: n.y }}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.15 + i * 0.1 }}
          >
            <div className="flex items-center gap-1">
              <Network size={10} className="text-indigo-300" />
              <span className="font-mono text-[9px] text-white">{n.label}</span>
            </div>
          </motion.div>
        ))}
      </div>
    </VisualChrome>
  );
}

function CitationsVisual() {
  return (
    <VisualChrome label="answer.cite — verified" accent="emerald">
      <motion.div
        className="w-full max-w-sm space-y-3"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        <motion.div
          className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-3"
          animate={{ boxShadow: ["0 0 0 rgba(52,211,153,0)", "0 0 24px rgba(52,211,153,0.15)", "0 0 0 rgba(52,211,153,0)"] }}
          transition={{ duration: 3, repeat: Infinity }}
        >
          <p className="text-[11px] leading-relaxed text-slate-200">
            Auth middleware validates JWT on{" "}
            <span className="rounded bg-emerald-500/20 px-1 font-mono text-emerald-300">
              src/auth/middleware.ts:42-58
            </span>
          </p>
        </motion.div>
        <motion.div className="rounded-lg border border-white/10 bg-[#050505] p-3 font-mono text-[9px] leading-relaxed text-slate-400">
          <span className="text-slate-600">42</span> export async function validate(req) {"{"}
          <br />
          <span className="text-slate-600">43</span>{"  "}
          <span className="text-violet-300">const</span> token = req.headers.authorization;
          <br />
          <span className="text-slate-600">44</span>{"  "}
          <span className="text-amber-200">return</span> verifyJwt(token);
        </motion.div>
        <div className="flex items-center gap-2 text-[10px] text-emerald-400/90">
          <ShieldCheck size={12} />
          Open in editor · line-accurate
        </div>
      </motion.div>
    </VisualChrome>
  );
}

function IndexRepoVisual() {
  return (
    <VisualChrome label="ingest.github — live" accent="indigo">
      <motion.div className="flex w-full max-w-sm flex-col items-center gap-4 text-center">
        <motion.div
          className="flex h-16 w-16 items-center justify-center rounded-2xl border border-white/15 bg-white/[0.06]"
          animate={{ scale: [1, 1.04, 1] }}
          transition={{ duration: 2.5, repeat: Infinity }}
        >
          <GitBranch size={28} className="text-indigo-300" />
        </motion.div>
        <div className="w-full space-y-2">
          <motion.div
            className="h-2 overflow-hidden rounded-full bg-white/10"
            initial={{ opacity: 0.5 }}
            animate={{ opacity: 1 }}
          >
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-sky-400"
              initial={{ width: "8%" }}
              animate={{ width: ["12%", "78%", "100%"] }}
              transition={{ duration: 4, repeat: Infinity, repeatDelay: 1 }}
            />
          </motion.div>
          <p className="font-mono text-[10px] text-slate-500">Indexing 1,247 files · graph building</p>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5">
          <Zap size={12} className="text-amber-300" />
          <span className="text-[10px] font-medium text-slate-300">Ready to query in ~4 min</span>
          <ArrowRight size={12} className="text-slate-500" />
        </div>
      </motion.div>
    </VisualChrome>
  );
}

export function StoryVisual({ kind }: { kind: StoryVisualKind }) {
  switch (kind) {
    case "entropy":
      return <EntropyVisual />;
    case "rag-fail":
      return <RagFailVisual />;
    case "ast-graph":
      return <AstGraphVisual />;
    case "citations":
      return <CitationsVisual />;
    case "index-repo":
      return <IndexRepoVisual />;
    default:
      return null;
  }
}
