"use client";

import { useState, useEffect } from "react";
import { Monitor, X, Smartphone } from "lucide-react";

export default function MobileWarning() {
  const [isMobile, setIsMobile] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      // Check if device is mobile/tablet
      const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera;
      const isMobileDevice = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent.toLowerCase());
      const isSmallScreen = window.innerWidth < 1024; // Less than desktop breakpoint
      
      setIsMobile(isMobileDevice || isSmallScreen);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    // Check if user has dismissed before (stored in localStorage)
    const hasDismissed = localStorage.getItem('dex-mobile-warning-dismissed');
    if (hasDismissed === 'true') {
      setDismissed(true);
    }

    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const handleDismiss = () => {
    setDismissed(true);
    localStorage.setItem('dex-mobile-warning-dismissed', 'true');
  };

  if (!isMobile || dismissed) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[9999] bg-[#050505]/95 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="max-w-md w-full rounded-2xl border border-yellow-500/30 bg-gradient-to-br from-yellow-500/10 to-orange-500/5 p-8 shadow-2xl relative">
        <button
          onClick={handleDismiss}
          className="absolute top-4 right-4 p-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-slate-400 hover:text-white transition-all"
        >
          <X size={18} />
        </button>

        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-yellow-500/20 border border-yellow-500/30 mb-4">
            <Smartphone size={40} className="text-yellow-400" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Desktop Experience Recommended</h2>
          <p className="text-slate-300 text-sm leading-relaxed">
            DEX is optimized for desktop browsers and works best on larger screens. For the best experience, please access DEX from a desktop or laptop computer.
          </p>
        </div>

        <div className="space-y-3">
          <div className="flex items-start gap-3 p-3 rounded-lg bg-white/5 border border-white/10">
            <Monitor size={20} className="text-indigo-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-white mb-1">Why Desktop?</p>
              <p className="text-xs text-slate-400">
                The interactive graph visualizations, code analysis tools, and dashboard features require a larger screen and precise mouse interactions for optimal use.
              </p>
            </div>
          </div>

          <button
            onClick={handleDismiss}
            className="w-full py-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition-all shadow-lg hover:shadow-indigo-500/50"
          >
            Continue Anyway
          </button>
          
          <p className="text-xs text-slate-500 text-center">
            You can dismiss this message, but some features may not work properly on mobile devices.
          </p>
        </div>
      </div>
    </div>
  );
}
