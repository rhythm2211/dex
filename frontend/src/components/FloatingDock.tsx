"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  LayoutDashboard,
  HeartPulse,
  Crosshair,
  GitMerge,
  TrendingUp,
  BarChart3,
  Network,
  ChevronsUpDown,
  Minus,
} from "lucide-react";
import { useState, useEffect } from "react";

const NAV_ITEMS = [
  {
    href: "/app",
    icon: LayoutDashboard,
    label: "Graph",
    sub: "Codebase map",
    color: "#818cf8",
    glow: "rgba(129,140,248,0.35)",
  },
  {
    href: "/health",
    icon: HeartPulse,
    label: "Health",
    sub: "Repo vitals",
    color: "#34d399",
    glow: "rgba(52,211,153,0.35)",
  },
  {
    href: "/blast-radius",
    icon: Crosshair,
    label: "Blast Radius",
    sub: "Impact analysis",
    color: "#fb923c",
    glow: "rgba(251,146,60,0.35)",
  },
  {
    href: "/pr-review",
    icon: GitMerge,
    label: "PR Review",
    sub: "Pull requests",
    color: "#a78bfa",
    glow: "rgba(167,139,250,0.35)",
  },
  {
    href: "/evolution",
    icon: TrendingUp,
    label: "Evolution",
    sub: "Code history",
    color: "#38bdf8",
    glow: "rgba(56,189,248,0.35)",
  },
  {
    href: "/insights/activity",
    icon: BarChart3,
    label: "Activity",
    sub: "Dev signals",
    color: "#f472b6",
    glow: "rgba(244,114,182,0.35)",
  },
  {
    href: "/insights/team",
    icon: Network,
    label: "Team",
    sub: "Contributors",
    color: "#22d3ee",
    glow: "rgba(34,211,238,0.35)",
  },
];

const DOCK_PATHS = ["/app", "/health", "/blast-radius", "/pr-review", "/evolution", "/insights"];

export default function FloatingDock() {
  const { data: session } = useSession();
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [hovered, setHovered] = useState<string | null>(null);

  const shouldShow = session && DOCK_PATHS.some(p => pathname?.startsWith(p));

  useEffect(() => {
    if (!shouldShow) return;
    const saved = localStorage.getItem("dex-dock-minimized");
    if (saved === "true") setMinimized(true);
    const t = setTimeout(() => setVisible(true), 600);
    return () => clearTimeout(t);
  }, [shouldShow]);

  const toggleMinimized = () => {
    const next = !minimized;
    setMinimized(next);
    localStorage.setItem("dex-dock-minimized", String(next));
  };

  if (!shouldShow) return null;

  return (
    <div
      className="fixed bottom-5 left-1/2 z-50 select-none"
      style={{
        transform: "translateX(-50%)",
        opacity: visible ? 1 : 0,
        translate: visible ? "0 0" : "0 16px",
        transition: "opacity 0.45s ease, translate 0.45s cubic-bezier(.16,1,.3,1)",
        fontFamily: "var(--font-geist-sans, ui-sans-serif, system-ui, sans-serif)",
      }}
    >
      {minimized ? (
        /* ── MINIMIZED PILL ── */
        <button
          onClick={toggleMinimized}
          className="flex items-center gap-2 px-4 py-2 rounded-full transition-all hover:scale-105 active:scale-95"
          style={{
            background: "rgba(10,10,16,0.88)",
            backdropFilter: "blur(24px)",
            WebkitBackdropFilter: "blur(24px)",
            border: "1px solid rgba(255,255,255,0.1)",
            boxShadow: "0 4px 24px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.06)",
            color: "rgba(255,255,255,0.55)",
          }}
        >
          <ChevronsUpDown size={13} />
          <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.05em" }}>Navigation</span>
        </button>
      ) : (
        /* ── FULL DOCK ── */
        <div
          className="flex items-end gap-1 rounded-2xl"
          style={{
            background: "rgba(8,8,14,0.82)",
            backdropFilter: "blur(28px) saturate(1.6)",
            WebkitBackdropFilter: "blur(28px) saturate(1.6)",
            border: "1px solid rgba(255,255,255,0.09)",
            boxShadow:
              "0 12px 48px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.03), inset 0 1px 0 rgba(255,255,255,0.07)",
            padding: "8px 10px 8px 10px",
          }}
        >
          {NAV_ITEMS.map((item) => {
            const isActive =
              item.href === "/app" ? pathname === "/app" : pathname?.startsWith(item.href);
            const isHov = hovered === item.href;
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                onMouseEnter={() => setHovered(item.href)}
                onMouseLeave={() => setHovered(null)}
                className="relative flex flex-col items-center gap-1.5 px-2 py-1.5 rounded-xl group"
                style={{
                  transition: "transform 0.18s cubic-bezier(.34,1.56,.64,1), background 0.15s",
                  transform: isHov ? "translateY(-6px) scale(1.08)" : isActive ? "scale(1.04)" : "scale(1)",
                  background: isHov
                    ? `rgba(255,255,255,0.06)`
                    : isActive
                    ? `${item.color}14`
                    : "transparent",
                  minWidth: 52,
                }}
              >
                {/* Tooltip */}
                <div
                  className="absolute -top-11 left-1/2 flex flex-col items-center pointer-events-none"
                  style={{
                    transform: "translateX(-50%)",
                    opacity: isHov ? 1 : 0,
                    translate: isHov ? "0 0" : "0 4px",
                    transition: "opacity 0.15s, translate 0.15s",
                    whiteSpace: "nowrap",
                  }}
                >
                  <div
                    className="px-2.5 py-1.5 rounded-lg text-center"
                    style={{
                      background: "rgba(10,10,18,0.95)",
                      border: `1px solid ${item.color}30`,
                      boxShadow: `0 4px 16px rgba(0,0,0,0.5), 0 0 0 1px ${item.color}15`,
                    }}
                  >
                    <p style={{ fontSize: 11, fontWeight: 600, color: "#fff", letterSpacing: "0.02em" }}>
                      {item.label}
                    </p>
                    <p style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", marginTop: 1 }}>
                      {item.sub}
                    </p>
                  </div>
                  <div
                    className="w-1.5 h-1.5 rotate-45 -mt-px"
                    style={{ background: "rgba(10,10,18,0.95)", border: `0 solid ${item.color}30`, borderRightWidth: 1, borderBottomWidth: 1 }}
                  />
                </div>

                {/* Icon container */}
                <div
                  className="flex items-center justify-center rounded-xl"
                  style={{
                    width: 38,
                    height: 38,
                    background: isActive
                      ? `${item.color}22`
                      : isHov
                      ? `${item.color}14`
                      : "rgba(255,255,255,0.04)",
                    border: isActive
                      ? `1px solid ${item.color}45`
                      : isHov
                      ? `1px solid ${item.color}25`
                      : "1px solid rgba(255,255,255,0.06)",
                    boxShadow: isActive
                      ? `0 0 18px ${item.glow}, inset 0 1px 0 rgba(255,255,255,0.08)`
                      : isHov
                      ? `0 0 10px ${item.glow}`
                      : "none",
                    color: isActive ? item.color : isHov ? item.color : "rgba(255,255,255,0.35)",
                    transition: "all 0.15s",
                  }}
                >
                  <Icon size={17} strokeWidth={isActive ? 2 : 1.75} />
                </div>

                {/* Label */}
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: isActive ? 600 : 500,
                    color: isActive ? item.color : isHov ? "rgba(255,255,255,0.75)" : "rgba(255,255,255,0.3)",
                    letterSpacing: "0.02em",
                    transition: "color 0.15s",
                  }}
                >
                  {item.label}
                </span>

                {/* Active dot */}
                {isActive && (
                  <div
                    className="absolute -bottom-1 w-1 h-1 rounded-full"
                    style={{
                      background: item.color,
                      boxShadow: `0 0 6px ${item.color}`,
                    }}
                  />
                )}
              </Link>
            );
          })}

          {/* Divider + minimize */}
          <div
            className="flex items-center self-stretch ml-1"
            style={{ borderLeft: "1px solid rgba(255,255,255,0.07)", paddingLeft: 8 }}
          >
            <button
              onClick={toggleMinimized}
              className="flex flex-col items-center gap-1.5 px-2 py-1.5 rounded-xl transition-all hover:opacity-70 active:scale-95"
              style={{ color: "rgba(255,255,255,0.25)", minWidth: 40 }}
              title="Minimize dock"
            >
              <div
                className="flex items-center justify-center rounded-xl"
                style={{
                  width: 38,
                  height: 38,
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.06)",
                }}
              >
                <Minus size={14} strokeWidth={2} />
              </div>
              <span style={{ fontSize: 10, fontWeight: 500, letterSpacing: "0.02em" }}>Hide</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
