"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { motion, useInView } from "framer-motion";
import {
  ArrowRight,
  Github,
  Terminal,
  Sparkles,
  Network,
  Lock,
  Users,
  MessageSquare,
  Activity,
  Flame,
  Target,
  Play,
  Move,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  Info,
  Menu,
  X,
  User,
  Settings,
  HelpCircle,
  Command,
  LogOut,
} from "lucide-react";
import DemoHomeHeroCity from "./DemoHomeHeroCity";
import HomeFooter from "./HomeFooter";
import HomeStoryScroll from "./HomeStoryScroll";
import HomeMethodology from "./HomeMethodology";
import MobileWarning from "@/components/MobileWarning";
import { CommandPalette } from "@/components/NavCommandPalette";
import { ContainerScroll } from "@/components/ui/container-scroll-animation";
import { AnimatedButton } from "@/components/ui/animated-button";
import {
  dexApi,
  type ZoneData,
  type TeamTopologyResponse,
} from "@/lib/api";

/**
 * DemoHomeView
 *
 * Primary marketing / home experience: serif + glass + isometric hero, scroll narrative,
 * and full product storytelling. Used at `/` as the main landing page.
 */

// ─────────────────────────────────────────────────────────────────
// Local typography vars (the original `dex-landing.jsx` referenced
// these by name — we declare them on the root so all child styles
// can use `var(--dex-serif)`, etc.).
// ─────────────────────────────────────────────────────────────────

const PAGE_STYLE: React.CSSProperties = {
  // Custom properties — typed via React.CSSProperties allows index access
  ["--dex-serif" as string]: "'Cormorant Garamond', Georgia, 'Times New Roman', serif",
  ["--dex-sans" as string]: "var(--font-geist-sans), ui-sans-serif, system-ui, sans-serif",
  ["--dex-mono" as string]: "var(--font-geist-mono), ui-monospace, 'SF Mono', Menlo, monospace",
};

const F = {
  serif: "var(--dex-serif)",
  sans: "var(--dex-sans)",
  mono: "var(--dex-mono)",
};

// ─────────────────────────────────────────────────────────────────
// Small primitives
// ─────────────────────────────────────────────────────────────────

const Eyebrow: React.FC<{ children: React.ReactNode; tone?: "slate" | "cyan" | "magenta" | "emerald" }> = ({
  children,
  tone = "slate",
}) => {
  const map: Record<string, string> = {
    slate: "text-slate-400/90",
    cyan: "text-cyan-300/80",
    magenta: "text-fuchsia-300/80",
    emerald: "text-emerald-300/80",
  };
  return (
    <p
      className={`text-[11px] font-bold uppercase ${map[tone]}`}
      style={{ fontFamily: F.mono, letterSpacing: "0.25em" }}
    >
      {children}
    </p>
  );
};

const SectionHead: React.FC<{
  eyebrow: string;
  children: React.ReactNode;
  sub?: React.ReactNode;
  align?: "left" | "center";
  tone?: "slate" | "cyan" | "magenta" | "emerald";
}> = ({ eyebrow, children, sub, align = "left", tone = "slate" }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true, margin: "-80px" }}
    transition={{ duration: 0.6 }}
    className={align === "center" ? "text-center" : "text-left"}
    style={{ marginBottom: 56 }}
  >
    <div className="mb-4">
      <Eyebrow tone={tone}>{eyebrow}</Eyebrow>
    </div>
    <h2
      className="text-white"
      style={{
        fontFamily: F.serif,
        fontSize: "clamp(40px, 5.4vw, 76px)",
        lineHeight: 1.05,
        margin: 0,
        letterSpacing: "-0.02em",
        fontWeight: 400,
        maxWidth: 900,
        marginLeft: align === "center" ? "auto" : 0,
        marginRight: align === "center" ? "auto" : 0,
      }}
    >
      {children}
    </h2>
    {sub && (
      <p
        className="text-slate-400"
        style={{
          marginTop: 22,
          fontSize: 17,
          lineHeight: 1.55,
          maxWidth: 560,
          marginLeft: align === "center" ? "auto" : 0,
          marginRight: align === "center" ? "auto" : 0,
        }}
      >
        {sub}
      </p>
    )}
  </motion.div>
);

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

// ─────────────────────────────────────────────────────────────────
// Nav — glass bar: logo + DEX, in-page anchors, docs, auth
// ─────────────────────────────────────────────────────────────────

const LANDING_ANCHORS = [
  { label: "Product", href: "#demo-preview" },
  { label: "Methodology", href: "#how-it-works" },
  { label: "Story", href: "#story" },
  { label: "Features", href: "#features" },
  { label: "Insights", href: "#insights" },
] as const;

const navLinkQuiet =
  "shrink-0 inline-flex items-center gap-2 rounded-xl border-0 px-2.5 py-2 text-[13px] font-medium text-slate-400 outline-none transition-colors hover:bg-white/[0.07] hover:text-white focus-visible:ring-2 focus-visible:ring-white/25";

const DemoNav: React.FC = () => {
  const { data: session } = useSession();
  const pathname = usePathname();
  const [cmdOpen, setCmdOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setCmdOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const routeActive = (href: string) =>
    pathname === href || (!!pathname && href !== "/" && pathname.startsWith(href));

  return (
    <>
      {cmdOpen && <CommandPalette onClose={() => setCmdOpen(false)} />}

      <header className="pointer-events-none fixed left-0 right-0 top-0 z-50 px-3 pt-3 sm:px-5" aria-label="Primary">
        <div
          className="pointer-events-auto mx-auto flex max-w-[1680px] flex-wrap items-center gap-2 rounded-2xl border-0 px-3 py-2.5 shadow-[0_12px_40px_rgba(0,0,0,0.45),inset_0_1px_0_rgba(255,255,255,0.06)] sm:gap-3 sm:px-5 sm:py-3"
          style={{
            background: "linear-gradient(180deg, rgba(14,14,26,0.78) 0%, rgba(8,8,18,0.62) 100%)",
            backdropFilter: "blur(22px) saturate(175%)",
            WebkitBackdropFilter: "blur(22px) saturate(175%)",
          }}
        >
          <Link
            href="/"
            className="group pointer-events-auto flex shrink-0 items-center rounded-xl py-0.5 pr-2 transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/25"
          >
            <Image
              src="/dex-logo.png"
              alt="DEX"
              width={1024}
              height={440}
              className="h-9 w-auto"
              priority
            />
          </Link>

          <nav
            className="scrollbar-none hidden min-w-0 flex-1 items-center gap-0.5 overflow-x-auto md:flex lg:gap-1 lg:px-1 [&::-webkit-scrollbar]:hidden"
            style={{ scrollbarWidth: "none" }}
            aria-label="Main navigation"
          >
            {LANDING_ANCHORS.map((a) => (
              <a key={a.href} href={a.href} className={navLinkQuiet}>
                {a.label}
              </a>
            ))}
            <Link href="/help" className={`${navLinkQuiet} ${routeActive("/help") ? "bg-white/[0.08] text-white" : ""}`}>
              <HelpCircle size={14} className="opacity-55" aria-hidden />
              Docs
            </Link>
            {!session?.user && (
              <>
                <span className="mx-0.5 hidden h-4 w-px shrink-0 bg-white/15 lg:inline" aria-hidden />
                <Link href="/login" className={`${navLinkQuiet} hidden sm:inline-flex`}>
                  Sign in
                </Link>
                <Link href="/signup" className={`${navLinkQuiet} hidden text-white sm:inline-flex hover:bg-white/15`}>
                  Sign up
                </Link>
              </>
            )}
          </nav>

          <div className="ml-auto flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              onClick={() => setCmdOpen(true)}
              className="hidden items-center gap-2 rounded-xl border-0 bg-white/[0.06] px-3 py-2 text-[13px] text-slate-400 outline-none transition-colors hover:bg-white/[0.11] hover:text-white focus-visible:ring-2 focus-visible:ring-white/25 md:inline-flex"
              aria-label="Open command palette"
            >
              <Command size={14} aria-hidden />
              <span className="hidden lg:inline">Search</span>
              <kbd className="hidden rounded bg-black/35 px-1.5 py-0.5 text-[10px] text-slate-500 lg:inline">⌘K</kbd>
            </button>

            {session?.user ? (
              <>
                <Link
                  href="/profile"
                  className="pointer-events-auto hidden items-center gap-2 rounded-xl border-0 bg-white/[0.06] px-3 py-1.5 transition-colors hover:bg-white/[0.1] sm:flex"
                  title="Profile"
                >
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/15 text-[11px] font-bold text-white">
                    {(session.user?.name || session.user?.email || "U")[0]?.toUpperCase()}
                  </span>
                  <span className="hidden max-w-[120px] truncate text-sm font-medium text-slate-200 lg:inline">
                    {session.user?.name || session.user?.email}
                  </span>
                </Link>
                <button
                  type="button"
                  onClick={() => signOut({ callbackUrl: "/" })}
                  className="rounded-xl border-0 bg-white/[0.06] p-2.5 text-slate-400 outline-none transition-colors hover:bg-red-500/15 hover:text-red-300 focus-visible:ring-2 focus-visible:ring-red-400/35"
                  title="Sign out"
                  aria-label="Sign out"
                >
                  <LogOut size={16} />
                </button>
              </>
            ) : (
              <>
                <Link href="/login" className={`${navLinkQuiet} sm:hidden`}>
                  Sign in
                </Link>
                <Link href="/signup" className={`${navLinkQuiet} text-white sm:hidden hover:bg-white/15`}>
                  Sign up
                </Link>
              </>
            )}

            <button
              type="button"
              className="inline-flex rounded-xl border-0 bg-white/[0.06] p-2.5 text-slate-300 outline-none transition-colors hover:bg-white/[0.11] hover:text-white focus-visible:ring-2 focus-visible:ring-white/25 md:hidden"
              aria-expanded={mobileOpen}
              aria-label={mobileOpen ? "Close menu" : "Open menu"}
              onClick={() => setMobileOpen((v) => !v)}
            >
              {mobileOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>

          {mobileOpen && (
            <div className="mt-2 max-h-[min(72vh,calc(100dvh-5.5rem))] w-full basis-full overflow-y-auto rounded-xl bg-black/35 backdrop-blur-2xl md:hidden">
              <div className="divide-y divide-white/[0.06]">
                <div className="p-3">
                  <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-500">On this page</p>
                  <div className="flex flex-col gap-0.5">
                    {LANDING_ANCHORS.map((a) => (
                      <a
                        key={a.href}
                        href={a.href}
                        className="rounded-lg px-3 py-2.5 text-sm text-slate-300 hover:bg-white/[0.07] hover:text-white"
                        onClick={() => setMobileOpen(false)}
                      >
                        {a.label}
                      </a>
                    ))}
                  </div>
                </div>
                <div className="p-3">
                  <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-500">Docs &amp; search</p>
                  <div className="flex flex-col gap-0.5">
                    <Link href="/help" className="rounded-lg px-3 py-2.5 text-sm text-slate-300 hover:bg-white/[0.07]" onClick={() => setMobileOpen(false)}>
                      Help &amp; Docs
                    </Link>
                  </div>
                  <button
                    type="button"
                    className="mt-2 flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm text-slate-400 hover:bg-white/[0.07] hover:text-white"
                    onClick={() => {
                      setMobileOpen(false);
                      setCmdOpen(true);
                    }}
                  >
                    <span className="flex items-center gap-2">
                      <Command size={14} aria-hidden /> Search pages
                    </span>
                    <span className="text-[10px] text-slate-600">⌘K</span>
                  </button>
                </div>
                {session?.user ? (
                  <div className="p-3">
                    <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-500">Account</p>
                    <div className="flex flex-col gap-0.5">
                      <Link href="/profile" className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm text-slate-300 hover:bg-white/[0.07]" onClick={() => setMobileOpen(false)}>
                        <User size={15} className="text-slate-300" aria-hidden />
                        Profile
                      </Link>
                      <Link href="/settings" className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm text-slate-300 hover:bg-white/[0.07]" onClick={() => setMobileOpen(false)}>
                        <Settings size={15} className="opacity-65" aria-hidden />
                        Settings
                      </Link>
                    </div>
                    <button
                      type="button"
                      className="mt-2 w-full rounded-lg px-3 py-3 text-left text-sm text-red-400 hover:bg-red-500/10"
                      onClick={() => {
                        setMobileOpen(false);
                        signOut({ callbackUrl: "/" });
                      }}
                    >
                      Sign out
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-2 p-3">
                    <Link href="/login" className="flex-1 rounded-xl bg-white/[0.08] px-4 py-3 text-center text-sm font-medium text-white hover:bg-white/[0.13]" onClick={() => setMobileOpen(false)}>
                      Sign in
                    </Link>
                    <AnimatedButton
                      href="/signup"
                      variant="primary"
                      size="md"
                      glow={false}
                      className="flex-1 justify-center"
                    >
                      Sign up
                    </AnimatedButton>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </header>
    </>
  );
};

// ─────────────────────────────────────────────────────────────────
// HUD overlays for the hero (AI Analyzing / Impact / Health)
// ─────────────────────────────────────────────────────────────────

const HudPanel: React.FC<{ title?: string; children: React.ReactNode }> = ({
  title,
  children,
}) => (
  <Glass className="rounded-xl w-full" style={{ padding: "14px 16px" }}>
    {title && (
      <div
        className="text-slate-400/70"
        style={{
          fontFamily: F.mono,
          fontSize: 10,
          letterSpacing: "0.22em",
          textTransform: "uppercase",
          marginBottom: 12,
        }}
      >
        {title}
      </div>
    )}
    {children}
  </Glass>
);

const HudAIAnalyzing: React.FC = () => {
  const [pct, setPct] = useState(12);
  const [stage, setStage] = useState(0);
  const stages = [
    "Building dependency graph",
    "Detecting relationships",
    "Finding hidden coupling",
    "Calculating impact",
  ];
  useEffect(() => {
    let raf = 0;
    const base = performance.now();
    const tick = (now: number) => {
      const elapsed = (now - base) / 1000;
      const p = (elapsed * 8) % 100;
      setPct(Math.round(Math.max(8, p)));
      setStage(Math.min(3, Math.floor(p / 25)));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <HudPanel title="AI Analyzing…">
      <div className="flex flex-col gap-2 mb-3">
        {stages.map((s, i) => (
          <div
            key={i}
            className="flex items-center gap-2"
            style={{
              fontFamily: F.sans,
              fontSize: 12.5,
              color: i <= stage ? "rgba(255,255,255,0.92)" : "rgba(255,255,255,0.35)",
              transition: "color .4s",
            }}
          >
            <span
              style={{
                width: 5,
                height: 5,
                borderRadius: 99,
                background:
                  i < stage ? "#e2e8f0" : i === stage ? "#f8fafc" : "rgba(255,255,255,0.2)",
                boxShadow: i === stage ? "0 0 8px rgba(255,255,255,0.35)" : "none",
                transition: "all .4s",
              }}
            />
            <span>{s}</span>
          </div>
        ))}
      </div>
      <div
        style={{
          height: 4,
          background: "rgba(255,255,255,0.06)",
          borderRadius: 99,
          overflow: "hidden",
          position: "relative",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${pct}%`,
            background: "linear-gradient(90deg, rgba(255,255,255,0.35), rgba(255,255,255,0.85))",
            borderRadius: 99,
            boxShadow: "0 0 14px rgba(255,255,255,0.2)",
            transition: "width .4s linear",
          }}
        />
      </div>
      <div
        style={{
          fontFamily: F.mono,
          fontSize: 10,
          color: "rgba(255,255,255,0.5)",
          marginTop: 8,
          textAlign: "right",
        }}
      >
        {pct}%
      </div>
    </HudPanel>
  );
};

const HudImpact: React.FC = () => {
  const rows = [
    { label: "High Risk", n: 4, color: "#f87171" },
    { label: "Medium Risk", n: 12, color: "#fbbf24" },
    { label: "Low Risk", n: 28, color: "#86efac" },
  ];
  return (
    <HudPanel title="Impact Analysis">
      <div className="flex flex-col gap-2">
        {rows.map((r) => (
          <div
            key={r.label}
            className="flex items-center gap-2.5"
            style={{ fontSize: 12.5, color: "rgba(255,255,255,0.85)" }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: 99,
                background: r.color,
                boxShadow: `0 0 6px ${r.color}`,
              }}
            />
            <span className="flex-1">{r.label}</span>
            <span style={{ fontFamily: F.mono, color: "rgba(255,255,255,0.95)" }}>{r.n}</span>
          </div>
        ))}
      </div>
      <div
        style={{
          height: 1,
          background: "rgba(255,255,255,0.08)",
          margin: "12px -4px 10px",
        }}
      />
      <div
        className="flex justify-between"
        style={{ fontSize: 12, color: "rgba(255,255,255,0.55)" }}
      >
        <span>Total Modules</span>
        <span style={{ fontFamily: F.mono, color: "#fff" }}>182</span>
      </div>
    </HudPanel>
  );
};

const HudHealth: React.FC = () => {
  // Defer the animated polyline until after mount so SSR ↔ CSR Math.sin
  // floating-point drift can't trigger a hydration mismatch on `points`.
  const [mounted, setMounted] = useState(false);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    setMounted(true);
    const id = setInterval(() => setTick((x) => x + 1), 80);
    return () => clearInterval(id);
  }, []);
  const W = 130;
  const H = 32;
  let pointsStr = "";
  if (mounted) {
    const points: string[] = [];
    for (let i = 0; i < 28; i++) {
      const x = (i / 27) * W;
      const y =
        H / 2 +
        Math.sin((i + tick * 0.4) * 0.5) * 7 +
        Math.sin((i + tick * 0.4) * 0.13) * 4;
      points.push(`${x.toFixed(2)},${y.toFixed(2)}`);
    }
    pointsStr = points.join(" ");
  }
  return (
    <HudPanel title="System Health">
      <div className="flex items-end gap-2.5">
        <svg width={W} height={H} style={{ flex: "0 0 auto" }}>
          <polyline
            points={pointsStr}
            fill="none"
            stroke="#86efac"
            strokeWidth="1.4"
            strokeLinecap="round"
          />
        </svg>
        <div className="text-right">
          <div style={{ fontFamily: F.serif, fontSize: 28, color: "#fff", lineHeight: 1 }}>
            92%
          </div>
          <div
            style={{
              fontFamily: F.mono,
              fontSize: 10,
              color: "#86efac",
              marginTop: 4,
            }}
          >
            ● healthy
          </div>
        </div>
      </div>
    </HudPanel>
  );
};

// ─────────────────────────────────────────────────────────────────
// Hero — clean 2-col layout. Atmospheric city stays in the background,
// content sits in a real grid so nothing overlaps.
// ─────────────────────────────────────────────────────────────────

const Hero: React.FC = () => {
  const { data: session } = useSession();
  return (
    <section className="relative overflow-hidden min-h-[100svh] flex items-center">
      {/* Atmospheric gradient backdrop */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 70% 60% at 70% 60%, rgba(60,30,120,0.32), transparent 65%)," +
            "radial-gradient(ellipse 55% 45% at 30% 45%, rgba(8,40,80,0.28), transparent 70%)," +
            "linear-gradient(180deg, #06060b 0%, #08070f 100%)",
        }}
      />

      {/* City scene — dimmed so it reads as backdrop, not foreground.
          A horizontal mask fades the city out behind the left text column
          (and a vertical mask fades the top/bottom) so nothing competes
          with the headline / sub copy. */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          opacity: 0.5,
          maskImage:
            "linear-gradient(90deg, transparent 0%, rgba(0,0,0,0.25) 35%, #000 60%, #000 100%)",
          WebkitMaskImage:
            "linear-gradient(90deg, transparent 0%, rgba(0,0,0,0.25) 35%, #000 60%, #000 100%)",
        }}
        aria-hidden
      >
        <DemoHomeHeroCity viewW={1600} viewH={900} showLabels={false} />
      </div>

      {/* Solid scrim on the left side — guarantees the H1/P stay readable
          on every viewport even before the mask kicks in (older browsers
          without mask-image still get a clean text rail). */}
      <div
        className="absolute inset-y-0 left-0 w-full lg:w-3/5 pointer-events-none"
        style={{
          background:
            "linear-gradient(90deg, rgba(6,6,11,0.85) 0%, rgba(6,6,11,0.55) 55%, rgba(6,6,11,0) 100%)",
        }}
        aria-hidden
      />

      {/* Top & bottom fades so the section connects cleanly into the page */}
      <div
        className="absolute inset-x-0 top-0 h-32 pointer-events-none"
        style={{ background: "linear-gradient(180deg, rgba(6,6,11,0.9), transparent)" }}
      />
      <div
        className="absolute inset-x-0 bottom-0 h-32 pointer-events-none"
        style={{ background: "linear-gradient(180deg, transparent, #06060b 80%)" }}
      />

      {/* Content grid — real columns, no absolute-positioned overlap. */}
      <div className="relative z-20 w-full mx-auto max-w-7xl px-6 lg:px-10 pt-32 pb-20">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-10 lg:gap-14 items-center">
          {/* LEFT — copy */}
          <div className="max-w-2xl">
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.05 }}
              className="inline-flex items-center gap-2 rounded-full border border-emerald-500/25 bg-emerald-500/5 px-3 py-1 mb-7 backdrop-blur-sm"
            >
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              <span
                className="text-emerald-300"
                style={{
                  fontFamily: F.mono,
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: "0.18em",
                  textTransform: "uppercase",
                }}
              >
                Map-first code intelligence
              </span>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.15 }}
              style={{
                fontFamily: F.serif,
                fontSize: "clamp(48px, 6.4vw, 88px)",
                lineHeight: 1.02,
                letterSpacing: "-0.025em",
                fontWeight: 400,
                margin: 0,
                paddingBottom: "0.08em",
              }}
            >
              <span className="block text-white">Understand any repo.</span>
              <span
                className="block"
                style={{
                  background:
                    "linear-gradient(95deg, #e2e8f0 0%, #94a3b8 50%, #f8fafc 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                }}
              >
                In hours, not weeks.
              </span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.7, delay: 0.35 }}
              className="text-slate-400 mt-6 max-w-xl"
              style={{ fontSize: 17, lineHeight: 1.55 }}
            >
              AST + dependency graph on every repo. Ask anything — every answer ships with{" "}
              <em
                className="text-slate-200"
                style={{ fontFamily: F.serif, fontStyle: "italic" }}
              >
                file:line citations you can verify.
              </em>
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.5 }}
              className="mt-8 flex flex-wrap items-center gap-3"
            >
              {session?.user ? (
                <AnimatedButton href="/app" variant="primary" size="md" glow={false}>
                  <Terminal size={16} /> Go to dashboard
                  <ArrowRight size={14} />
                </AnimatedButton>
              ) : (
                <AnimatedButton href="/signup" variant="primary" size="md" glow={false}>
                  <Github size={16} /> Connect GitHub
                  <ArrowRight size={14} />
                </AnimatedButton>
              )}
              <AnimatedButton href="#story" variant="default" size="md" glow={false}>
                How it works
              </AnimatedButton>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.7, delay: 0.7 }}
              className="mt-6 flex items-center gap-2"
              style={{
                fontFamily: F.mono,
                fontSize: 11,
                color: "rgba(255,255,255,0.45)",
              }}
            >
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              free for public repos · self-host on docker
            </motion.div>
          </div>

          {/* RIGHT — single stacked HUD column (md+) */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.55 }}
            className="hidden lg:flex flex-col gap-4"
          >
            <HudAIAnalyzing />
            <HudImpact />
            <HudHealth />
          </motion.div>
        </div>
      </div>
    </section>
  );
};

// ─────────────────────────────────────────────────────────────────
// Tech stack marquee — ported from the main `/` home page.
// Uses framer-motion (already imported) for the infinite scroll so we
// don't have to inject CSS @keyframes into this component file.
// ─────────────────────────────────────────────────────────────────

const TECH_STACK = [
  "Next.js",
  "TypeScript",
  "Python",
  "Rust",
  "Docker",
  "Kubernetes",
  "AWS",
  "TensorFlow",
  "PostgreSQL",
  "GraphQL",
  "GoLang",
  "Terraform",
  "Neo4j",
  "pgvector",
  "Tree-sitter",
  "Groq",
];

const TechTicker: React.FC = () => {
  // Duplicate the list so the -50% translate loop is seamless.
  const doubled = [...TECH_STACK, ...TECH_STACK];
  return (
    <div
      className="w-full border-y border-white/5 bg-[#050505]/50 backdrop-blur-sm overflow-hidden"
      style={{ contain: "layout style paint", padding: "14px 0" }}
      aria-label="Tech stack"
    >
      <motion.div
        className="flex whitespace-nowrap items-center"
        style={{ gap: 48, willChange: "transform" }}
        animate={{ x: ["0%", "-50%"] }}
        transition={{
          duration: 40,
          ease: "linear",
          repeat: Infinity,
        }}
      >
        {doubled.map((tech, i) => (
          <span
            key={i}
            className="text-slate-600 hover:text-slate-300 transition-colors cursor-default"
            style={{
              fontFamily: F.mono,
              fontSize: 11,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.22em",
              flex: "0 0 auto",
            }}
          >
            {tech}
          </span>
        ))}
      </motion.div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────
// Claims strip (count-ups)
// ─────────────────────────────────────────────────────────────────

const CountUp: React.FC<{ to: number; suffix?: string; duration?: number }> = ({
  to,
  suffix = "",
  duration = 1400,
}) => {
  const [n, setN] = useState(0);
  const ref = useRef<HTMLSpanElement | null>(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });
  useEffect(() => {
    if (!inView) return;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setN(Math.round(to * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, to, duration]);
  return (
    <span ref={ref}>
      {n}
      {suffix}
    </span>
  );
};

const Claims: React.FC = () => {
  const stats = [
    {
      num: (
        <>
          <CountUp to={80} suffix="+" />
        </>
      ),
      label: "languages parsed",
      sub: "Tree-sitter across your stack",
    },
    {
      num: (
        <>
          <CountUp to={3} duration={1000} />
          <span style={{ opacity: 0.4 }}>s</span>
        </>
      ),
      label: "p95 hybrid query",
      sub: "Graph traversal + semantic search",
    },
    {
      num: (
        <>
          <CountUp to={100} suffix="%" />
        </>
      ),
      label: "self-hostable",
      sub: "Docker Compose · your keys",
    },
  ];
  return (
    <section id="pipeline" style={{ padding: "120px 0 80px" }}>
      <div className="mx-auto max-w-6xl px-6">
        <div
          className="grid grid-cols-1 md:grid-cols-3"
          style={{
            gap: 1,
            background: "rgba(255,255,255,0.06)",
            borderTop: "1px solid rgba(255,255,255,0.06)",
            borderBottom: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          {stats.map((s, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.55, delay: i * 0.08 }}
              style={{ padding: "36px 32px", background: "#0a0a0b" }}
            >
              <div
                style={{
                  fontFamily: F.serif,
                  fontSize: 72,
                  lineHeight: 1,
                  letterSpacing: "-0.02em",
                  color: "#fff",
                }}
              >
                {s.num}
              </div>
              <div style={{ marginTop: 14, fontSize: 14, color: "rgba(255,255,255,0.85)" }}>
                {s.label}
              </div>
              <div
                style={{
                  marginTop: 4,
                  fontFamily: F.mono,
                  fontSize: 11,
                  color: "rgba(255,255,255,0.4)",
                }}
              >
                {s.sub}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

// ─────────────────────────────────────────────────────────────────
// AppMockup — a faithful, miniaturised replica of `/app`:
//   • 400-ish-px left sidebar with Assistant/Details tabs, repo URL
//     input, DEX ASSISTANT chat header, a sample exchange, and the
//     "Ask about structure…" textarea.
//   • Main graph pane on the right where the existing screen recording
//     plays as the dependency-graph backdrop, framed with the same
//     "Vert / Horz / Center" floating control pill as the real app.
// Designed to sit inside `ContainerScroll` so the whole thing tilts
// on scroll like the rest of the showcase.
// ─────────────────────────────────────────────────────────────────

const AppMockup: React.FC = () => (
  <div className="flex h-full w-full bg-[#050505] text-slate-200 overflow-hidden">
    {/* ─── Left: sidebar (Assistant tab) ──────────────────────────── */}
    <aside className="hidden sm:flex w-[42%] min-w-[260px] max-w-[400px] flex-col border-r border-white/[0.06] bg-[#08080c]/95 backdrop-blur-xl">
      {/* Tab bar */}
      <div className="flex border-b border-white/5 bg-[#0a0a0a]/60 shrink-0">
        <div className="flex-1 py-2.5 border-b-2 border-white/40 bg-white/5 text-white">
          <div
            className="flex items-center justify-center gap-1.5"
            style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.22em", textTransform: "uppercase" }}
          >
            <MessageSquare size={11} /> Assistant
          </div>
        </div>
        <div className="flex-1 py-2.5 border-b-2 border-transparent text-slate-500">
          <div
            className="flex items-center justify-center gap-1.5"
            style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.22em", textTransform: "uppercase" }}
          >
            <Info size={11} /> Details
          </div>
        </div>
      </div>

      {/* Repo URL row */}
      <div className="p-3 border-b border-white/5 bg-[#0a0a0a]/60 shrink-0 space-y-2">
        <div className="flex justify-between items-baseline">
          <label
            className="text-slate-500"
            style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.22em", textTransform: "uppercase" }}
          >
            Repository URL
          </label>
          <span
            className="text-emerald-400"
            style={{ fontFamily: F.mono, fontSize: 9 }}
          >
            ● indexed
          </span>
        </div>
        <div className="flex gap-2">
          <div
            className="flex-1 bg-[#111] border border-white/10 rounded-lg px-2.5 py-1.5 text-slate-300 truncate"
            style={{ fontFamily: F.mono, fontSize: 11 }}
          >
            github.com/acme/core-api
          </div>
          <div className="bg-white/15 border border-white/15 px-2.5 rounded-lg flex items-center shrink-0 backdrop-blur-sm">
            <RefreshCw size={12} className="text-white" />
          </div>
        </div>
      </div>

      {/* Chat header */}
      <div className="px-3 py-2 border-b border-white/5 flex items-center justify-between bg-white/[0.02] shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_#10b981]" />
          <span
            className="text-slate-300"
            style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.06em" }}
          >
            DEX ASSISTANT
          </span>
          <span className="text-slate-600" style={{ fontSize: 9, marginLeft: 4 }}>
            (2 messages)
          </span>
        </div>
        <Terminal size={11} className="text-slate-600" />
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-hidden p-3 space-y-3 min-h-0">
        {/* User message */}
        <div className="flex justify-end">
          <div
            className="bg-white/[0.08] border border-white/15 text-slate-200 px-3 py-2 rounded-l-lg rounded-tr-lg shadow-lg"
            style={{ maxWidth: "85%" }}
          >
            <p style={{ fontSize: 11, fontWeight: 500, lineHeight: 1.45 }}>
              How does authentication flow through the codebase?
            </p>
            <p
              className="text-slate-500 mt-1"
              style={{ fontSize: 9, fontFamily: F.mono }}
            >
              10:42:18
            </p>
          </div>
        </div>

        {/* AI response */}
        <div className="flex justify-start relative">
          <div className="absolute -left-1 top-0 bottom-0 w-1 bg-gradient-to-b from-white/40 to-transparent opacity-50" />
          <div
            className="pl-3 text-slate-300 space-y-1.5"
            style={{ maxWidth: "92%", fontSize: 11, lineHeight: 1.5 }}
          >
            <p>
              JWT verification lives in{" "}
              <span className="text-emerald-400 underline decoration-dotted underline-offset-2">
                src/auth/middleware.ts:42-58
              </span>
              .
            </p>
            <p>
              Requests flow{" "}
              <code className="text-slate-100 bg-white/5 px-1 rounded" style={{ fontFamily: F.mono, fontSize: 10 }}>
                api.ts
              </code>{" "}
              →{" "}
              <code className="text-slate-100 bg-white/5 px-1 rounded" style={{ fontFamily: F.mono, fontSize: 10 }}>
                middleware
              </code>{" "}
              →{" "}
              <code className="text-slate-100 bg-white/5 px-1 rounded" style={{ fontFamily: F.mono, fontSize: 10 }}>
                authProvider
              </code>
              .
            </p>
            <div
              className="bg-[#020202] border border-white/5 rounded p-2 text-slate-400"
              style={{ fontFamily: F.mono, fontSize: 10, lineHeight: 1.55 }}
            >
              <span className="text-purple-400">async function</span>{" "}
              <span className="text-yellow-300">verifyToken</span>(req) {"{"}
              <br />
              &nbsp;&nbsp;<span className="text-blue-400">const</span> claims = <span className="text-yellow-300">jwt.verify</span>(...);
              <br />
              &nbsp;&nbsp;<span className="text-purple-400">return</span> claims;
              <br />
              {"}"}
            </div>
            <p className="text-emerald-400" style={{ fontSize: 9 }}>
              ✓ Grounded in 4 files
            </p>
          </div>
        </div>
      </div>

      {/* Input area */}
      <div className="p-3 border-t border-white/5 bg-[#0a0a0a]/80 shrink-0">
        <div className="relative">
          <div
            className="w-full bg-[#111] border border-white/10 rounded-xl p-3 pr-10 text-slate-500"
            style={{ fontSize: 11, fontFamily: F.mono, minHeight: 56 }}
          >
            Ask about structure, dependencies, or code…
          </div>
          <div className="absolute right-2 bottom-2 p-1.5 bg-white/15 backdrop-blur-md text-white rounded-lg border border-white/20">
            <Play size={11} fill="currentColor" />
          </div>
        </div>
      </div>
    </aside>

    {/* ─── Right: graph area (video as the live graph) ────────────── */}
    <main className="flex-1 min-w-0 relative bg-[#050505] overflow-hidden">
      {/* Top-left floating control pill — mirrors `/app` */}
      <div className="absolute top-3 left-3 z-10 flex gap-2 pointer-events-none">
        <div className="p-1 rounded-lg bg-black/70 backdrop-blur-md border border-white/10 shadow-xl flex gap-1">
          <div
            className="px-2.5 py-1.5 rounded-md bg-white/15 text-white flex items-center gap-1.5 border border-white/15 backdrop-blur-sm"
            style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase" }}
          >
            <ChevronDown size={10} /> Vert
          </div>
          <div
            className="px-2.5 py-1.5 rounded-md text-slate-400 flex items-center gap-1.5"
            style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase" }}
          >
            <ChevronRight size={10} /> Horz
          </div>
          <div className="w-px h-5 self-center bg-white/10 mx-0.5" />
          <div
            className="px-2.5 py-1.5 text-slate-400 flex items-center gap-1.5"
            style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase" }}
          >
            <Move size={10} /> Center
          </div>
        </div>
      </div>

      {/* Video — the recorded dependency graph plays inside the graph pane */}
      <video
        autoPlay
        loop
        muted
        playsInline
        className="absolute inset-0 w-full h-full object-cover"
        aria-label="DEX dependency graph"
      >
        <source src="/Screen Recording 2026-01-29 220635.mp4" type="video/mp4" />
      </video>

      {/* Subtle vignette so the video reads as part of the surrounding UI */}
      <div className="absolute inset-0 pointer-events-none bg-gradient-to-br from-black/40 via-transparent to-black/50" />
      <div className="absolute inset-x-0 top-0 h-12 pointer-events-none bg-gradient-to-b from-black/60 to-transparent" />

      {/* Bottom-right "live" label */}
      <div
        className="absolute bottom-3 right-3 px-2.5 py-1.5 rounded-md bg-black/70 backdrop-blur-md border border-white/10 flex items-center gap-1.5 text-slate-300"
        style={{ fontFamily: F.mono, fontSize: 9, letterSpacing: "0.08em" }}
      >
        <Network size={10} className="text-slate-300" />
        Dependency Graph · live
      </div>
    </main>
  </div>
);

// ─────────────────────────────────────────────────────────────────
// DemoShowcase — ContainerScroll tilt animation with the in-app
// mock inside. The mockup mirrors the real `/app` UI so visitors see
// exactly what they'd use after signing in.
// ─────────────────────────────────────────────────────────────────

const DemoShowcase: React.FC = () => (
  <section
    id="demo-preview"
    className="relative bg-[#06060b] overflow-hidden"
  >
    {/* Ambient glow behind the tilted card */}
    <div className="pointer-events-none absolute inset-0">
      <div className="absolute left-1/2 top-1/2 h-[520px] w-[520px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/[0.04] blur-[120px]" />
      <div className="absolute left-[18%] top-[28%] h-[300px] w-[300px] rounded-full bg-white/[0.03] blur-[100px]" />
      <div className="absolute right-[18%] bottom-[24%] h-[300px] w-[300px] rounded-full bg-white/[0.03] blur-[100px]" />
    </div>

    <div className="relative">
      <ContainerScroll
        titleComponent={
          <>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] px-3 py-1 backdrop-blur-sm">
              <Sparkles size={12} className="text-slate-300" />
              <span
                className="text-slate-300"
                style={{
                  fontFamily: F.mono,
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: "0.22em",
                  textTransform: "uppercase",
                }}
              >
                The product
              </span>
            </div>
            <h2
              className="text-white"
              style={{
                fontFamily: F.serif,
                fontSize: "clamp(36px, 4.8vw, 64px)",
                lineHeight: 1.05,
                letterSpacing: "-0.02em",
                fontWeight: 400,
                margin: 0,
              }}
            >
              Graph, chat,{" "}
              <em
                style={{ fontStyle: "italic" }}
                className="bg-gradient-to-r from-slate-200 via-white to-slate-300 bg-clip-text text-transparent"
              >
                citations.
              </em>
            </h2>
            <p
              className="mx-auto mt-5 max-w-xl text-slate-400"
              style={{ fontSize: 16, lineHeight: 1.55 }}
            >
              The same interface your team uses in production.
            </p>
          </>
        }
      >
        <AppMockup />
      </ContainerScroll>
    </div>
  </section>
);

// ─────────────────────────────────────────────────────────────────
// Features bento grid (6 cards from the home page)
// ─────────────────────────────────────────────────────────────────

const FEATURES = [
  {
    icon: Network,
    color: "text-slate-200",
    bg: "bg-white/10",
    title: "Graph & grounded Q&A",
    body: "Navigate dependencies visually. Ask in plain English — answers cite real file:line ranges.",
  },
  {
    icon: Target,
    color: "text-orange-300",
    bg: "bg-orange-500/15",
    title: "Blast radius & PR review",
    body: "See transitive impact, risk scores, and reviewer hints before anything hits main.",
  },
  {
    icon: Users,
    color: "text-emerald-400",
    bg: "bg-emerald-500/20",
    title: "Team & activity signals",
    body: "Hot zones, ownership, and collaboration patterns pulled from the repo itself.",
  },
  {
    icon: Lock,
    color: "text-slate-300",
    bg: "bg-white/[0.08]",
    title: "Your infra, your keys",
    body: "Self-host with Docker Compose. Code stays in your environment.",
  },
];

const FeaturesBento: React.FC = () => (
  <section id="features" className="mx-auto max-w-6xl px-6 py-24">
    <SectionHead
      eyebrow="Platform"
      align="center"
      sub="Four core capabilities for navigation, review, collaboration, and deployment."
    >
      Built for{" "}
      <em style={{ fontStyle: "italic" }} className="text-slate-200">
        shipping faster.
      </em>
    </SectionHead>

    <div className="mx-auto grid max-w-4xl grid-cols-1 gap-5 md:grid-cols-2">
      {FEATURES.map((f, i) => {
        const Icon = f.icon;
        return (
          <motion.div
            key={f.title}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.5, delay: i * 0.06 }}
          >
            <Glass className="rounded-2xl p-8 h-full hover:-translate-y-1 transition-transform">
              <div className={`w-10 h-10 rounded-lg ${f.bg} flex items-center justify-center ${f.color} mb-4`}>
                <Icon size={22} />
              </div>
              <h3 className="text-xl font-semibold text-white mb-3">{f.title}</h3>
              <p className="text-sm text-slate-400 leading-relaxed">{f.body}</p>
            </Glass>
          </motion.div>
        );
      })}
    </div>
  </section>
);

// ─────────────────────────────────────────────────────────────────
// Blast radius spotlight
// ─────────────────────────────────────────────────────────────────

const ImpactBlast: React.FC = () => (
  <section id="blast" className="relative mx-auto max-w-6xl px-6 py-28 overflow-hidden">
    <motion.div
      className="pointer-events-none absolute inset-0"
      aria-hidden
      style={{
        background:
          "radial-gradient(ellipse 55% 50% at 80% 50%, rgba(239,68,68,0.08), transparent 65%)",
      }}
    />
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.6 }}
      className="relative grid gap-12 lg:grid-cols-2 lg:gap-16 items-center"
    >
      <motion.div>
        <Eyebrow tone="emerald">// blast radius</Eyebrow>
        <h2
          className="mt-4 text-white"
          style={{
            fontFamily: F.serif,
            fontSize: "clamp(32px, 4vw, 52px)",
            lineHeight: 1.06,
            letterSpacing: "-0.02em",
            fontWeight: 400,
          }}
        >
          Know what breaks{" "}
          <em
            style={{ fontStyle: "italic" }}
            className="bg-gradient-to-r from-orange-200 via-red-200 to-amber-100 bg-clip-text text-transparent"
          >
            before you merge.
          </em>
        </h2>
        <p className="mt-5 max-w-md text-slate-400 leading-relaxed">
          Pick any file. See the full dependency cone, risk score, and which tests and reviewers
          should be in the loop.
        </p>
        <motion.div className="mt-8">
          <AnimatedButton href="/blast-radius" variant="primary" size="md" glow={false}>
            <Target size={16} /> Open blast radius <ArrowRight size={14} />
          </AnimatedButton>
        </motion.div>
      </motion.div>

      <Glass className="rounded-2xl p-6 sm:p-8">
        <motion.div className="flex items-center justify-between border-b border-white/10 pb-4 mb-6">
          <span className="font-mono text-[10px] uppercase tracking-widest text-slate-500">
            auth/middleware.ts
          </span>
          <span className="rounded-full border border-orange-500/30 bg-orange-500/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-orange-300">
            High risk
          </span>
        </motion.div>
        <motion.div className="grid grid-cols-3 gap-3 mb-6">
          {[
            { label: "Affected", value: "12", tone: "text-white" },
            { label: "Tests", value: "8", tone: "text-slate-200" },
            { label: "Score", value: "156", tone: "text-orange-300" },
          ].map((s) => (
            <motion.div
              key={s.label}
              className="rounded-lg border border-white/10 bg-white/[0.03] p-3 text-center"
            >
              <motion.div className={`text-xl font-bold ${s.tone}`}>{s.value}</motion.div>
              <motion.div className="mt-1 text-[10px] uppercase tracking-wider text-slate-500">
                {s.label}
              </motion.div>
            </motion.div>
          ))}
        </motion.div>
        <motion.div className="flex items-center gap-2 text-xs text-slate-500">
          <Network size={14} className="text-slate-400" />
          Transitive deps · ownership · CI hints
        </motion.div>
      </Glass>
    </motion.div>
  </section>
);

// ─────────────────────────────────────────────────────────────────
// Insights preview (Activity + Team)
// ─────────────────────────────────────────────────────────────────

const ActivityInsightsPreview: React.FC = () => {
  const [zones, setZones] = useState<ZoneData[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await dexApi.getActiveZones(30);
        if (!cancelled) setZones(data.zones.slice(0, 6));
      } catch {
        // demo page — silently swallow
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  const color = (intensity: "High" | "Low", value: number) =>
    intensity === "High"
      ? `rgba(239,68,68,${Math.min(0.4 + value / 50, 0.9)})`
      : `rgba(148,163,184,${Math.min(0.2 + value / 20, 0.6)})`;
  return (
    <Link href="/app" className="group block h-full" aria-label="Open DEX — activity insights">
      <Glass className="rounded-2xl overflow-hidden h-full hover:border-red-500/30 transition-all">
        <div className="p-6 flex flex-col h-full">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-red-500/20 flex items-center justify-center text-red-400">
                <Activity size={20} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Activity Heatmap</h3>
                <p className="text-xs text-slate-500">Repository hotspots & coldspots</p>
              </div>
            </div>
            <ArrowRight size={18} className="text-slate-500 group-hover:text-white group-hover:translate-x-1 transition-all" />
          </div>
          <div className="flex-grow">
            {loading ? (
              <div className="grid grid-cols-3 gap-2 animate-pulse">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="h-16 bg-white/5 rounded-lg" />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {(zones.length > 0 ? zones : Array.from({ length: 6 })).map((z: any, i) => (
                  <div
                    key={i}
                    className="relative h-16 rounded-lg border border-white/10 overflow-hidden"
                    style={{
                      backgroundColor: z
                        ? color(z.intensity, z.value) + "20"
                        : "rgba(148,163,184,0.15)",
                    }}
                  >
                    <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                    <div className="relative p-2 h-full flex flex-col justify-between">
                      <div className="flex items-center justify-between">
                        {z?.intensity === "High" && (
                          <Flame size={12} className="text-red-400 animate-pulse" />
                        )}
                        <span className="text-xs font-bold text-white">{z?.value ?? "—"}</span>
                      </div>
                      <p className="text-[10px] text-slate-300 truncate">
                        {z?.name?.split?.("/").pop() ?? "zone.ts"}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </Glass>
    </Link>
  );
};

const TeamInsightsPreview: React.FC = () => {
  const [team, setTeam] = useState<TeamTopologyResponse | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await dexApi.getTeamTopology();
        if (!cancelled) setTeam(data);
      } catch {
        // silently swallow
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  return (
    <Link href="/app" className="group block h-full" aria-label="Open DEX — team insights">
      <Glass className="rounded-2xl overflow-hidden h-full hover:border-white/20 transition-all">
        <div className="p-6 flex flex-col h-full">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center text-slate-300">
                <Users size={20} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Team Network</h3>
                <p className="text-xs text-slate-500">Collaboration patterns</p>
              </div>
            </div>
            <ArrowRight size={18} className="text-slate-500 group-hover:text-white group-hover:translate-x-1 transition-all" />
          </div>
          <div className="flex-grow flex items-center">
            {loading ? (
              <div className="w-full h-48 bg-white/5 rounded-lg animate-pulse flex items-center justify-center">
                <div className="w-8 h-8 border-2 border-white/30 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <div className="relative w-full h-48 rounded-lg bg-gradient-to-br from-white/[0.06] to-white/[0.02] border border-white/10 overflow-hidden">
                <svg className="w-full h-full" viewBox="0 0 400 200">
                  {team?.links.slice(0, 8).map((_, i) => (
                    <line
                      key={i}
                      x1={100 + (i % 4) * 80}
                      y1={50 + Math.floor(i / 4) * 100}
                      x2={120 + (i % 4) * 80}
                      y2={70 + Math.floor(i / 4) * 100}
                      stroke="rgba(255,255,255,0.2)"
                      strokeWidth={2}
                    />
                  ))}
                  {(team?.nodes ?? Array.from({ length: 6 }).map((_, i) => ({ id: `dev${i}` }))).slice(0, 6).map((node: any, i: number) => (
                    <g key={i}>
                      <circle
                        cx={80 + (i % 3) * 120}
                        cy={60 + Math.floor(i / 3) * 100}
                        r={12}
                        fill="rgba(255,255,255,0.45)"
                      />
                      <text
                        x={80 + (i % 3) * 120}
                        y={60 + Math.floor(i / 3) * 100 + 25}
                        textAnchor="middle"
                        fill="#e2e8f0"
                        fontSize={10}
                      >
                        {node.id?.split?.(" ")[0] ?? `dev${i}`}
                      </text>
                    </g>
                  ))}
                </svg>
                <div className="absolute bottom-2 right-2 text-xs text-slate-500">
                  {team?.nodes.length ?? 0} developers
                </div>
              </div>
            )}
          </div>
        </div>
      </Glass>
    </Link>
  );
};

const InsightsPreview: React.FC = () => (
  <section id="insights" className="mx-auto max-w-6xl px-6 py-24">
    <SectionHead
      eyebrow="Team signals"
      align="center"
      sub="Where the heat is — and who owns it."
    >
      Your codebase,{" "}
      <em style={{ fontStyle: "italic" }} className="text-slate-300">
        at team scale.
      </em>
    </SectionHead>

    <div className="grid md:grid-cols-2 gap-6 items-stretch">
      <ActivityInsightsPreview />
      <TeamInsightsPreview />
    </div>

    <div className="mt-12 flex justify-center">
      <AnimatedButton href="/app" variant="default" size="md" glow={false}>
        Open full insights <ArrowRight size={14} />
      </AnimatedButton>
    </div>
  </section>
);

// ─────────────────────────────────────────────────────────────────
// Final CTA + footer
// ─────────────────────────────────────────────────────────────────

const FinalCTA: React.FC = () => {
  const { data: session } = useSession();
  return (
    <section className="relative overflow-hidden" style={{ padding: "160px 0 120px" }}>
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 60% 80% at 50% 100%, rgba(255,255,255,0.07), transparent 70%)",
        }}
      />
      <div className="mx-auto max-w-6xl px-6 relative text-center">
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.7 }}
          className="text-white"
          style={{
            fontFamily: F.serif,
            fontSize: "clamp(56px, 8vw, 112px)",
            lineHeight: 1,
            letterSpacing: "-0.02em",
            margin: 0,
            fontWeight: 400,
          }}
        >
          Start with
          <br />
          <em style={{ fontStyle: "italic" }} className="text-slate-300">
            your repo.
          </em>
        </motion.h2>
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.7, delay: 0.1 }}
          className="text-slate-400 mt-7 mb-9 max-w-xl mx-auto"
          style={{ fontSize: 17 }}
        >
          Free for public repos · 14-day unlimited trial · Self-host with Docker · No credit card.
        </motion.p>
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.7, delay: 0.2 }}
          className="inline-flex flex-wrap items-center justify-center gap-3"
        >
          {!session?.user ? (
            <>
              <AnimatedButton href="/signup" variant="primary" size="md" glow={false}>
                Connect GitHub <ArrowRight size={14} />
              </AnimatedButton>
              <AnimatedButton href="/help" variant="default" size="md" glow={false}>
                Documentation
              </AnimatedButton>
            </>
          ) : (
            <AnimatedButton href="/app" variant="primary" size="md" glow={false}>
              Open app <ArrowRight size={14} />
            </AnimatedButton>
          )}
        </motion.div>
      </div>
    </section>
  );
};

// ─────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────

const DemoHomeView: React.FC = () => {
  return (
    <div
      className="min-h-screen bg-[#06060b] text-slate-200 overflow-x-hidden selection:bg-white/20 selection:text-white"
      style={PAGE_STYLE}
    >
      <MobileWarning />

      <DemoNav />

      <main>
        <Hero />
        <TechTicker />
        <Claims />
        <DemoShowcase />
        <HomeMethodology />
        <HomeStoryScroll />
        <FeaturesBento />
        <ImpactBlast />
        <InsightsPreview />
        <FinalCTA />
      </main>

      <HomeFooter />
    </div>
  );
};

export default DemoHomeView;
