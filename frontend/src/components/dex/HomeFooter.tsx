"use client";

import Link from "next/link";
import { Terminal, ArrowRight } from "lucide-react";
import { AnimatedButton } from "@/components/ui/animated-button";

/**
 * Site-wide footer preserved from the original homepage — identical structure
 * and links so Legal, Account, and product surfaces stay one click away.
 */
export default function HomeFooter() {
  return (
    <footer className="border-t border-white/5 bg-[#020202] py-12">
      <div className="mx-auto max-w-6xl px-6">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8 mb-12">
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2 mb-4">
              <span className="w-6 h-6 bg-slate-800 rounded flex items-center justify-center">
                <Terminal size={12} />
              </span>
              <span className="font-bold text-white">DEX</span>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed mb-4">
              The intelligence layer for modern software engineering teams.
            </p>
            <div className="flex flex-col gap-2">
              <AnimatedButton href="/app" variant="primary" size="sm" glow={false}>
                Open app <ArrowRight size={12} />
              </AnimatedButton>
              <Link href="/help" className="text-xs text-indigo-400 hover:text-indigo-300 font-medium">
                Get Help →
              </Link>
            </div>
          </div>
          <div>
            <h4 className="text-xs font-bold text-white uppercase tracking-widest mb-4">Product</h4>
            <ul className="space-y-2 text-xs text-slate-500">
              <li>
                <Link href="/app" className="hover:text-indigo-400">
                  Open app
                </Link>
              </li>
              <li>
                <Link href="/help" className="hover:text-indigo-400">
                  Docs &amp; help
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h4 className="text-xs font-bold text-white uppercase tracking-widest mb-4">Account & Support</h4>
            <ul className="space-y-2 text-xs text-slate-500">
              <li>
                <Link href="/profile" className="hover:text-indigo-400">
                  Profile
                </Link>
              </li>
              <li>
                <Link href="/settings" className="hover:text-indigo-400">
                  Settings
                </Link>
              </li>
              <li>
                <Link href="/help" className="hover:text-indigo-400">
                  Help & Docs
                </Link>
              </li>
              <li>
                <Link href="/grievance" className="hover:text-indigo-400">
                  Contact Support
                </Link>
              </li>
              <li>
                <Link href="/about" className="hover:text-indigo-400">
                  About
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h4 className="text-xs font-bold text-white uppercase tracking-widest mb-4">Legal & Security</h4>
            <ul className="space-y-2 text-xs text-slate-500">
              <li>
                <Link href="/privacy" className="hover:text-indigo-400">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link href="/terms" className="hover:text-indigo-400">
                  Terms of Service
                </Link>
              </li>
              <li>
                <Link href="/security" className="hover:text-indigo-400">
                  Security
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h4 className="text-xs font-bold text-white uppercase tracking-widest mb-4">Quick Links</h4>
            <ul className="space-y-2 text-xs text-slate-500">
              <li>
                <Link href="/login" className="hover:text-indigo-400">
                  Login
                </Link>
              </li>
              <li>
                <Link href="/signup" className="hover:text-indigo-400">
                  Sign Up
                </Link>
              </li>
              <li>
                <Link href="/onboarding" className="hover:text-indigo-400">
                  Onboarding
                </Link>
              </li>
              <li>
                <Link href="/help" className="hover:text-indigo-400">
                  Documentation
                </Link>
              </li>
            </ul>
          </div>
        </div>
        <div className="border-t border-white/5 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="text-[10px] text-slate-600">
            © 2026 Dex Inc. All rights reserved. | Developed by Rhythm Suthar 2026
          </div>
          <div className="flex gap-4">
            <div className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="text-[10px] text-emerald-500 font-medium">All Systems Operational</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
