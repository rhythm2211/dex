"use client";

import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { usePathname } from "next/navigation";
import {
  Terminal, User, LogOut, Menu, X, Settings, GitPullRequest,
  Zap, Shield, Activity, Users, Clock, Command,
  Home, BarChart3
} from "lucide-react";
import { useState, useEffect } from "react";
import { CommandPalette } from "@/components/NavCommandPalette";

// ---------------------------------------------------------------------------
// MAIN NAVIGATION
// ---------------------------------------------------------------------------
const navLinks = [
  { href: "/app",               label: "Dashboard",    icon: <Home size={15} /> },
  { href: "/health",            label: "Health",       icon: <Shield size={15} /> },
  { href: "/blast-radius",      label: "Blast Radius", icon: <Zap size={15} /> },
  { href: "/pr-review",         label: "PR Review",    icon: <GitPullRequest size={15} /> },
  { href: "/evolution",         label: "Evolution",    icon: <Clock size={15} /> },
  { href: "/insights/activity", label: "Activity",     icon: <Activity size={15} /> },
  { href: "/insights/team",     label: "Team",         icon: <Users size={15} /> },
  { href: "/insights/leadership", label: "Leadership", icon: <BarChart3 size={15} /> },
];

export default function Navigation() {
  const { data: session } = useSession();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [cmdOpen, setCmdOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Global ⌘K / Ctrl+K shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setCmdOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname?.startsWith(href);

  return (
    <>
      {cmdOpen && <CommandPalette onClose={() => setCmdOpen(false)} />}

      <header
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-200 ${
          scrolled
            ? "border-b border-white/8 bg-[#050505]/90 backdrop-blur-md shadow-[0_4px_24px_rgba(0,0,0,.4)]"
            : "border-b border-white/5 bg-[#050505]/70 backdrop-blur-sm"
        }`}
      >
        <div className="mx-auto max-w-7xl px-5 sm:px-6 h-16 flex items-center justify-between gap-4">

          {/* Logo */}
          <Link href="/" className="group flex items-center gap-3 flex-shrink-0">
            <span className="relative flex h-9 w-9 items-center justify-center rounded-lg bg-white/[0.03] surface-edge transition-all duration-300 group-hover:bg-white/[0.05]">
              <Terminal
                size={18}
                className="relative z-10 text-white transition-colors group-hover:text-indigo-400"
                aria-hidden
              />
            </span>
            <span className="text-base font-bold tracking-[0.2em] text-white">DEX</span>
          </Link>

          {/* Desktop Nav */}
          {session && (
            <nav className="hidden lg:flex items-center gap-0.5">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`relative flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-all duration-150 ${
                    isActive(link.href)
                      ? "text-white bg-white/8"
                      : "text-slate-500 hover:text-slate-200 hover:bg-white/5"
                  }`}
                >
                  <span className={isActive(link.href) ? "text-indigo-400" : "opacity-60"}>
                    {link.icon}
                  </span>
                  {link.label}
                  {isActive(link.href) && (
                    <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-4 h-0.5 bg-indigo-500 rounded-full" />
                  )}
                </Link>
              ))}
            </nav>
          )}

          {/* Right side */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* ⌘K Button */}
            {session && (
              <button
                onClick={() => setCmdOpen(true)}
                className="hidden md:flex items-center gap-2 px-3.5 py-2 rounded-lg bg-white/5 border border-white/8 text-slate-500 hover:text-slate-300 hover:border-white/15 transition-all text-sm"
              >
                <Command size={14} />
                <span>Search</span>
                <kbd className="text-[10px] bg-white/5 border border-white/10 rounded px-1.5">⌘K</kbd>
              </button>
            )}

            {session ? (
              <>
                <Link
                  href="/profile"
                  className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-indigo-500/10 border border-indigo-500/20 hover:bg-indigo-500/20 hover:border-indigo-500/35 transition-all"
                >
                  <div className="w-6 h-6 rounded-full bg-indigo-500/30 flex items-center justify-center text-xs font-bold text-indigo-300">
                    {(session.user?.name || session.user?.email || "U")[0].toUpperCase()}
                  </div>
                  <span className="text-sm text-indigo-300 font-medium max-w-[100px] truncate">
                    {session.user?.name || session.user?.email}
                  </span>
                </Link>
                <button
                  onClick={() => signOut({ callbackUrl: "/" })}
                  className="p-2 rounded-lg bg-white/5 border border-white/8 text-slate-500 hover:bg-red-500/10 hover:border-red-500/25 hover:text-red-400 transition-all"
                  title="Sign out"
                >
                  <LogOut size={15} />
                </button>
                <button
                  onClick={() => setMobileOpen(!mobileOpen)}
                  className="lg:hidden p-2 rounded-lg bg-white/5 border border-white/8 text-slate-400 hover:text-white transition-all"
                >
                  {mobileOpen ? <X size={18} /> : <Menu size={18} />}
                </button>
              </>
            ) : (
              <>
                <Link
                  href="/login"
                  className="px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-slate-300 hover:text-white hover:bg-white/8 transition-all text-sm font-medium"
                >
                  Sign In
                </Link>
                <Link
                  href="/signup"
                  className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-all text-sm font-semibold shadow-[0_0_20px_rgba(99,102,241,.3)]"
                >
                  Sign Up
                </Link>
              </>
            )}
          </div>
        </div>

        {/* Mobile drawer */}
        {mobileOpen && session && (
          <div className="lg:hidden border-t border-white/8 bg-[#050505]/98 backdrop-blur-md">
            <nav className="px-5 py-4 space-y-1">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl text-base font-medium transition-all ${
                    isActive(link.href)
                      ? "bg-indigo-500/15 text-white border border-indigo-500/20"
                      : "text-slate-400 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  <span className={isActive(link.href) ? "text-indigo-400" : "text-slate-600"}>
                    {link.icon}
                  </span>
                  {link.label}
                </Link>
              ))}
              <div className="pt-2 border-t border-white/5 mt-2 space-y-1">
                <Link href="/settings" onClick={() => setMobileOpen(false)}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl text-base text-slate-400 hover:bg-white/5 hover:text-white transition-all">
                  <Settings size={15} className="text-slate-600" /> Settings
                </Link>
                <button
                  onClick={() => { signOut({ callbackUrl: "/" }); setMobileOpen(false); }}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-base text-red-400 hover:bg-red-500/10 transition-all"
                >
                  <LogOut size={15} /> Sign Out
                </button>
              </div>
            </nav>
          </div>
        )}
      </header>
    </>
  );
}
