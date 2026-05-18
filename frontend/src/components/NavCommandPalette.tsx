"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  User,
  Settings,
  Search,
  ArrowRight,
  Home,
  HelpCircle,
} from "lucide-react";
import { useState, useEffect, useRef, useCallback } from "react";

export const PALETTE_ITEMS = [
  { label: "Open app", href: "/app", icon: <Home size={15} />, group: "Navigate" },
  { label: "Profile", href: "/profile", icon: <User size={15} />, group: "Account" },
  { label: "Settings", href: "/settings", icon: <Settings size={15} />, group: "Account" },
  { label: "Help & Docs", href: "/help", icon: <HelpCircle size={15} />, group: "Account" },
] as const;

export function CommandPalette({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = PALETTE_ITEMS.filter(
    (item) =>
      !query ||
      item.label.toLowerCase().includes(query.toLowerCase()) ||
      item.href.toLowerCase().includes(query.toLowerCase())
  );

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    setSelected(0);
  }, [query]);

  const navigate = useCallback(
    (href: string) => {
      router.push(href);
      onClose();
    },
    [router, onClose]
  );

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelected((s) => Math.min(s + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelected((s) => Math.max(s - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filtered[selected]) navigate(filtered[selected].href);
    } else if (e.key === "Escape") {
      onClose();
    }
  };

  const groups = [...new Set(filtered.map((i) => i.group))];

  return (
    <>
      <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div
        className="fixed top-[20vh] left-1/2 -translate-x-1/2 z-[101] w-full max-w-lg"
        style={{ animation: "cmd-in .15s cubic-bezier(.4,0,.2,1) forwards" }}
      >
        <style>{`
          @keyframes cmd-in {
            from { opacity:0; transform:translateX(-50%) scale(.96); }
            to   { opacity:1; transform:translateX(-50%) scale(1); }
          }
        `}</style>
        <div className="bg-[#0c0c14] border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
          <div className="flex items-center gap-3 px-4 py-3.5 border-b border-white/8">
            <Search size={16} className="text-slate-500 flex-shrink-0" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Search pages, commands…"
              className="flex-1 bg-transparent text-base text-white placeholder-slate-600 outline-none"
            />
            <kbd className="text-[11px] text-slate-600 bg-white/5 border border-white/10 px-1.5 py-0.5 rounded">
              ESC
            </kbd>
          </div>
          <div className="max-h-72 overflow-y-auto py-2">
            {filtered.length === 0 && (
              <div className="px-4 py-6 text-center text-sm text-slate-600">No results for &quot;{query}&quot;</div>
            )}
            {groups.map((group) => (
              <div key={group}>
                <div className="px-4 py-1.5 text-[11px] font-bold uppercase tracking-widest text-slate-600">
                  {group}
                </div>
                {filtered
                  .filter((i) => i.group === group)
                  .map((item) => {
                    const globalIdx = filtered.indexOf(item);
                    return (
                      <button
                        key={item.href}
                        type="button"
                        onMouseEnter={() => setSelected(globalIdx)}
                        onClick={() => navigate(item.href)}
                        className={`w-full flex items-center gap-3 px-4 py-2.5 text-[15px] leading-snug transition-colors ${
                          selected === globalIdx
                            ? "bg-indigo-500/15 text-white"
                            : "text-slate-400 hover:text-white"
                        }`}
                      >
                        <span className={selected === globalIdx ? "text-indigo-400" : "text-slate-600"}>
                          {item.icon}
                        </span>
                        <span className="flex-1 text-left">{item.label}</span>
                        {selected === globalIdx && <ArrowRight size={14} className="text-indigo-400" />}
                      </button>
                    );
                  })}
              </div>
            ))}
          </div>
          <div className="flex items-center gap-4 px-4 py-2.5 border-t border-white/5 bg-white/2">
            <span className="flex items-center gap-1 text-[11px] text-slate-600">
              <kbd className="bg-white/5 border border-white/10 rounded px-1">↑↓</kbd> navigate
            </span>
            <span className="flex items-center gap-1 text-[11px] text-slate-600">
              <kbd className="bg-white/5 border border-white/10 rounded px-1">↵</kbd> open
            </span>
          </div>
        </div>
      </div>
    </>
  );
}
