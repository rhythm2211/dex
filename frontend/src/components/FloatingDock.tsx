"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  Home, Shield, Zap, GitPullRequest, Clock,
  Activity, Users, Command
} from "lucide-react";
import { useState, useEffect } from "react";

const DOCK_ITEMS = [
  { href: "/app",               icon: <Home size={16} />,            label: "Dashboard",   color: "#6366f1" },
  { href: "/health",            icon: <Shield size={16} />,          label: "Health",      color: "#22c55e" },
  { href: "/blast-radius",      icon: <Zap size={16} />,             label: "Blast",       color: "#f59e0b" },
  { href: "/pr-review",         icon: <GitPullRequest size={16} />,  label: "PR Review",   color: "#a78bfa" },
  { href: "/evolution",         icon: <Clock size={16} />,           label: "Evolution",   color: "#60a5fa" },
  { href: "/insights/activity", icon: <Activity size={16} />,        label: "Activity",    color: "#ef4444" },
  { href: "/insights/team",     icon: <Users size={16} />,           label: "Team",        color: "#34d399" },
];

// Pages where the dock should be shown (inner app pages, not landing)
const DOCK_PATHS = ["/app", "/health", "/blast-radius", "/pr-review", "/evolution", "/insights"];

export default function FloatingDock() {
  const { data: session } = useSession();
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);
  const [hovered, setHovered] = useState<string | null>(null);

  const shouldShow = session && DOCK_PATHS.some(p => pathname?.startsWith(p));

  useEffect(() => {
    if (!shouldShow) return;
    const timer = setTimeout(() => setVisible(true), 800);
    return () => clearTimeout(timer);
  }, [shouldShow]);

  if (!shouldShow) return null;

  return (
    <div
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 transition-all duration-500 font-sans [font-family:var(--font-geist-sans),ui-sans-serif,system-ui,sans-serif]"
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateX(-50%) translateY(0)' : 'translateX(-50%) translateY(20px)',
      }}
    >
      <div
        className="flex items-end gap-1 px-3 py-2 rounded-2xl"
        style={{
          background: 'rgba(8, 8, 14, 0.88)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: '1px solid rgba(255,255,255,0.08)',
          boxShadow: '0 8px 40px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04), inset 0 1px 0 rgba(255,255,255,0.06)',
        }}
      >
        {DOCK_ITEMS.map((item) => {
          const isActive = item.href === "/app"
            ? pathname === "/app"
            : pathname?.startsWith(item.href);
          const isHovered = hovered === item.href;
          const scale = isHovered ? 1.4 : isActive ? 1.2 : 1;

          return (
            <Link
              key={item.href}
              href={item.href}
              onMouseEnter={() => setHovered(item.href)}
              onMouseLeave={() => setHovered(null)}
              className="relative flex flex-col items-center"
              style={{ transition: 'transform 0.15s cubic-bezier(.34,1.56,.64,1)' }}
            >
              {/* Tooltip */}
              <div
                className="absolute -top-9 left-1/2 -translate-x-1/2 whitespace-nowrap text-[11px] font-medium text-white bg-[#0c0c18] border border-white/10 px-2.5 py-1 rounded-lg pointer-events-none transition-all duration-150"
                style={{ opacity: isHovered ? 1 : 0, transform: `translateX(-50%) scale(${isHovered ? 1 : 0.8})` }}
              >
                {item.label}
              </div>

              {/* Icon button */}
              <div
                className="relative p-2 rounded-xl"
                style={{
                  transform: `scale(${scale})`,
                  transition: 'transform 0.15s cubic-bezier(.34,1.56,.64,1)',
                  background: isActive
                    ? `${item.color}22`
                    : isHovered
                    ? 'rgba(255,255,255,0.08)'
                    : 'rgba(255,255,255,0.04)',
                  border: isActive
                    ? `1px solid ${item.color}44`
                    : '1px solid rgba(255,255,255,0.06)',
                  color: isActive ? item.color : isHovered ? '#fff' : 'rgba(255,255,255,0.4)',
                  boxShadow: isActive ? `0 0 12px ${item.color}33` : 'none',
                }}
              >
                {item.icon}
              </div>

              {/* Active dot */}
              {isActive && (
                <div
                  className="absolute -bottom-1.5 w-1 h-1 rounded-full"
                  style={{ background: item.color, boxShadow: `0 0 6px ${item.color}` }}
                />
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
