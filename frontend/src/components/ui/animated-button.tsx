"use client";

import React, { useEffect, useRef } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

const variantStyles = {
  default:
    "bg-[#0c0c10]/90 border-white/12 text-slate-200 hover:bg-white/[0.08] hover:border-white/22 hover:text-white",
  primary:
    "bg-white/12 border-white/25 text-white backdrop-blur-xl saturate-150 shadow-[inset_0_1px_0_rgba(255,255,255,0.2),0_4px_28px_rgba(0,0,0,0.35)] hover:bg-white/18 hover:border-white/40 hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.28),0_8px_36px_rgba(0,0,0,0.42)] active:bg-white/10",
  ghost:
    "bg-transparent border-white/10 text-slate-400 hover:bg-white/[0.05] hover:text-slate-100",
  danger:
    "bg-red-950/50 border-red-500/25 text-red-300 hover:bg-red-900/60 hover:border-red-500/40",
  tab: "border-transparent text-slate-500 hover:text-slate-300 hover:bg-white/[0.03] rounded-none border-b-2",
  tabActive:
    "border-white/70 text-white bg-white/[0.06] rounded-none border-b-2 shadow-none",
  tabActiveEmerald:
    "border-emerald-500 text-white bg-white/[0.05] rounded-none border-b-2 shadow-none",
} as const;

const sizeStyles = {
  sm: "px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider gap-1.5 rounded-lg",
  md: "px-5 py-2.5 text-xs font-semibold gap-2 rounded-xl",
  lg: "px-6 py-3 text-sm font-medium gap-2 rounded-xl",
  icon: "p-2 rounded-lg shrink-0",
  iconLg: "w-12 h-12 rounded-full shrink-0",
  tab: "flex-1 py-3 text-[10px] font-bold uppercase tracking-widest gap-2 rounded-none border-x-0 border-t-0",
} as const;

export type AnimatedButtonVariant = keyof typeof variantStyles;
export type AnimatedButtonSize = keyof typeof sizeStyles;

export interface AnimatedButtonProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  children: React.ReactNode;
  href?: string;
  variant?: AnimatedButtonVariant;
  size?: AnimatedButtonSize;
  glow?: boolean;
  className?: string;
  active?: boolean;
  accent?: "indigo" | "emerald";
}

const baseStyles =
  "relative inline-flex items-center justify-center font-medium backdrop-blur-md border transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-white/20 disabled:opacity-50 disabled:pointer-events-none overflow-hidden";

function ButtonGlow({
  enabled,
  tone = "muted",
}: {
  enabled: boolean;
  tone?: "primary" | "muted";
}) {
  const glowRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const glow = glowRef.current;
    if (!glow) return;

    const onMove = (e: MouseEvent) => {
      const x = (e.clientX / window.innerWidth) * 100;
      const y = (e.clientY / window.innerHeight) * 100;
      glow.style.transform = `translate(-${50 - (x - 50) / 5}%, -${50 - (y - 50) / 5}%)`;
    };

    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, [enabled]);

  if (!enabled) return null;

  const isPrimary = tone === "primary";

  return (
    <>
      <style>{`
        @keyframes dexButtonGlowPulse {
          0%, 100% { opacity: ${isPrimary ? 0.12 : 0.2}; }
          50% { opacity: ${isPrimary ? 0.22 : 0.32}; }
        }
      `}</style>
      <div
        ref={glowRef}
        aria-hidden
        className={cn(
          "pointer-events-none absolute w-[200%] h-[200%] rounded-full blur-3xl",
          isPrimary
            ? "bg-gradient-to-r from-white/25 via-slate-300/15 to-white/10"
            : "bg-gradient-to-r from-white/15 via-slate-500/10 to-white/5"
        )}
        style={{
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          transition: "transform 150ms ease-out",
          animation: "dexButtonGlowPulse 6s ease-in-out infinite",
        }}
      />
    </>
  );
}

function resolveVariant(
  variant: AnimatedButtonVariant,
  active?: boolean,
  accent?: "indigo" | "emerald"
): AnimatedButtonVariant {
  if (variant === "tab" && active) {
    return accent === "emerald" ? "tabActiveEmerald" : "tabActive";
  }
  return variant;
}

export function AnimatedButton({
  children,
  href,
  variant = "default",
  size = "md",
  glow,
  className,
  active,
  accent = "indigo",
  disabled,
  type = "button",
  ...rest
}: AnimatedButtonProps) {
  const resolved = resolveVariant(variant, active, accent);
  const showGlow = glow ?? resolved === "default";
  const glowTone = resolved === "primary" ? "primary" : "muted";

  const inner = (
    <>
      <ButtonGlow enabled={showGlow && !disabled} tone={glowTone} />
      <span className="relative z-[1] inline-flex items-center justify-center gap-[inherit]">
        {children}
      </span>
    </>
  );

  const classes = cn(
    baseStyles,
    variantStyles[resolved],
    sizeStyles[size] ?? sizeStyles.md,
    (variant === "tab" || resolved.startsWith("tab")) && "shadow-none",
    className
  );

  if (href && !disabled) {
    return (
      <Link href={href} className={cn("group", classes)} role="button">
        {inner}
      </Link>
    );
  }

  return (
    <button type={type} disabled={disabled} className={cn("group", classes)} {...rest}>
      {inner}
    </button>
  );
}

/** Calm status copy — no shimmer or pulse in the main app shell */
export function AppStatusLabel({
  text,
  className,
}: {
  text: string;
  className?: string;
}) {
  return (
    <span className={cn("font-medium text-slate-400 tracking-wide", className)}>
      {text}
    </span>
  );
}
