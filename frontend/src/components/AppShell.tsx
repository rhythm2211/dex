"use client";

import Navigation from "@/components/Navigation";

const chromeClass =
  "min-h-screen bg-[#050505] text-slate-200 antialiased selection:bg-indigo-500/30 selection:text-indigo-100 [font-family:var(--font-geist-sans),ui-sans-serif,system-ui,sans-serif]";

type AppShellProps = {
  children: React.ReactNode;
  /** Blast / Evolution: fill viewport under the fixed nav without double scrollbars */
  variant?: "default" | "fullBleed";
};

export default function AppShell({ children, variant = "default" }: AppShellProps) {
  if (variant === "fullBleed") {
    return (
      <div className={chromeClass}>
        <Navigation />
        <main className="box-border w-full pt-16 h-[calc(100dvh-4rem)] min-h-0 overflow-hidden">
          {children}
        </main>
      </div>
    );
  }

  return (
    <div className={chromeClass}>
      <Navigation />
      <div className="pt-16 min-h-[calc(100dvh-4rem)]">{children}</div>
    </div>
  );
}
