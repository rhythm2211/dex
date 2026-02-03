"use client";

import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { usePathname } from "next/navigation";
import { Terminal, User, LogOut, Menu, X, Settings, HelpCircle, Home } from "lucide-react";
import { useState } from "react";

export default function Navigation() {
  const { data: session } = useSession();
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navLinks = [
    { href: "/", label: "Home" },
    { href: "/app", label: "Dashboard" },
    { href: "/health", label: "Health" },
    { href: "/blast-radius", label: "Blast Radius" },
    { href: "/evolution", label: "Evolution" },
    { href: "/insights/activity", label: "Activity" },
    { href: "/insights/team", label: "Team" },
  ];

  const isActive = (href: string) => {
    if (href === "/") {
      return pathname === "/";
    }
    return pathname?.startsWith(href);
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b border-white/5 bg-[#050505]/80 backdrop-blur-sm">
      <div className="mx-auto max-w-7xl px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="group inline-flex items-center gap-3">
          <span className="relative flex items-center justify-center h-8 w-8 rounded bg-[#0A0A0A] border-dashed border-indigo-500/40 group-hover:border-indigo-500/50 transition-colors shadow-[0_0_15px_rgba(0,0,0,0.5)]">
            <Terminal className="text-white relative z-10 group-hover:text-indigo-400 transition-colors" size={16} />
          </span>
          <span className="text-sm font-bold tracking-[0.2em] text-white">DEX</span>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-8 text-xs font-medium text-slate-400">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`hover:text-white transition-colors ${
                isActive(link.href) ? "text-white" : ""
              }`}
            >
              {link.label}
            </Link>
          ))}
          <Link href="/help" className="hover:text-white transition-colors">
            Help
          </Link>
          {session && (
            <>
              <Link href="/settings" className="hover:text-white transition-colors">
                Settings
              </Link>
              <Link href="/about" className="hover:text-white transition-colors">
                About
              </Link>
            </>
          )}
        </nav>

        {/* Right Side Actions */}
        <div className="flex items-center gap-4">
          {session ? (
            <>
              <div className="hidden md:flex items-center gap-3">
                <Link
                  href="/profile"
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-indigo-500/10 border border-indigo-500/20 hover:bg-indigo-500/20 transition-all"
                >
                  <User size={14} className="text-indigo-400" />
                  <span className="text-xs text-indigo-300 font-medium max-w-[100px] truncate">
                    {session.user?.name || session.user?.email}
                  </span>
                </Link>
                <button
                  onClick={() => signOut({ callbackUrl: "/" })}
                  className="p-1.5 rounded-lg bg-white/5 border border-white/10 hover:bg-red-500/10 hover:border-red-500/30 text-slate-400 hover:text-red-400 transition-all"
                  title="Log out"
                >
                  <LogOut size={14} />
                </button>
              </div>
              {/* Mobile Menu Button */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="md:hidden p-2 rounded-lg bg-white/5 border border-white/10 text-slate-400 hover:text-white transition-all"
              >
                {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
              </button>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-slate-300 hover:text-white hover:bg-white/10 transition-all text-xs font-medium"
              >
                Sign In
              </Link>
              <Link
                href="/signup"
                className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-all text-xs font-semibold"
              >
                Sign Up
              </Link>
            </>
          )}
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && session && (
        <div className="md:hidden border-t border-white/5 bg-[#050505]/95 backdrop-blur-sm">
          <nav className="px-6 py-4 space-y-2">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileMenuOpen(false)}
                className={`block px-4 py-2 rounded-lg transition-colors ${
                  isActive(link.href)
                    ? "bg-indigo-500/20 text-white"
                    : "text-slate-400 hover:bg-white/5 hover:text-white"
                }`}
              >
                {link.label}
              </Link>
            ))}
            <Link
              href="/help"
              onClick={() => setMobileMenuOpen(false)}
              className="block px-4 py-2 rounded-lg text-slate-400 hover:bg-white/5 hover:text-white transition-colors"
            >
              Help
            </Link>
            <Link
              href="/settings"
              onClick={() => setMobileMenuOpen(false)}
              className="block px-4 py-2 rounded-lg text-slate-400 hover:bg-white/5 hover:text-white transition-colors"
            >
              Settings
            </Link>
            <Link
              href="/profile"
              onClick={() => setMobileMenuOpen(false)}
              className="block px-4 py-2 rounded-lg text-slate-400 hover:bg-white/5 hover:text-white transition-colors"
            >
              Profile
            </Link>
            <button
              onClick={() => {
                signOut({ callbackUrl: "/" });
                setMobileMenuOpen(false);
              }}
              className="w-full text-left px-4 py-2 rounded-lg text-red-400 hover:bg-red-500/10 transition-colors"
            >
              Sign Out
            </button>
          </nav>
        </div>
      )}
    </header>
  );
}
