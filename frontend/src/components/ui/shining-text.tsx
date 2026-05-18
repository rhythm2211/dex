"use client";

import * as React from "react";
import { motion } from "framer-motion";

import { cn } from "@/lib/utils";

interface ShiningTextProps {
  text: string;
  className?: string;
  duration?: number;
  /**
   * Tailwind text-size class (e.g. text-xs, text-sm). Defaults to text-base.
   * Allows the component to be reused for both heading + caption usage.
   */
  size?: string;
}

/**
 * Animated text with a shimmering highlight that slides across the glyphs.
 * Useful for "AI is thinking", "Analyzing…", "Ingesting…" type ambient
 * status indicators that need a richer feel than a plain pulse.
 */
export function ShiningText({
  text,
  className,
  duration = 2,
  size = "text-base",
}: ShiningTextProps) {
  return (
    <motion.span
      className={cn(
        "inline-block bg-clip-text font-medium text-transparent",
        "bg-[linear-gradient(110deg,#404040,35%,#fff,50%,#404040,75%,#404040)]",
        "bg-[length:200%_100%]",
        size,
        className
      )}
      initial={{ backgroundPosition: "200% 0" }}
      animate={{ backgroundPosition: "-200% 0" }}
      transition={{
        repeat: Infinity,
        duration,
        ease: "linear",
      }}
    >
      {text}
    </motion.span>
  );
}
