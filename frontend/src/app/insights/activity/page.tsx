'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSession, signOut } from 'next-auth/react';
import { Terminal, LogOut, ArrowLeft, Activity, Flame } from 'lucide-react';
import { dexApi, ActiveZonesResponse, ZoneData } from '@/lib/api';

const GlobalStyles = () => (
  <style jsx global>{`
    @keyframes fade-in-up {
      0% { opacity: 0; transform: translateY(16px); }
      100% { opacity: 1; transform: translateY(0); }
    }
    .animate-fade-in { animation: fade-in-up 0.6s ease-out forwards; opacity: 0; }
    .delay-150 { animation-delay: 0.15s; }
    .delay-300 { animation-delay: 0.3s; }
    .cyber-grid {
      background-size: 50px 50px;
      background-image: linear-gradient(to right, rgba(99, 102, 241, 0.03) 1px, transparent 1px),
                        linear-gradient(to bottom, rgba(99, 102, 241, 0.03) 1px, transparent 1px);
      mask-image: radial-gradient(ellipse at center, black 30%, transparent 70%);
    }
  `}</style>
);

export default function ActivityInsightsPage() {
  const { data: session } = useSession();
  const [data, setData] = useState<ActiveZonesResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const zones = await dexApi.getActiveZones(30); // Last 30 days
        setData(zones);
      } catch (e: any) {
        console.error("Failed to load heatmap", e);
        // If 404, the endpoint might not be registered - backend may need restart
        if (e?.response?.status === 404) {
          console.warn("Active zones endpoint not found. Ensure backend is running and routes are registered.");
        }
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  // Utility to determine color based on intensity - Updated to match theme
  const getZoneColor = (intensity: 'High' | 'Low', value: number) => {
    if (intensity === 'High') {
      // Hot/Red scale for high activity - using indigo/red mix
      return `rgba(239, 68, 68, ${Math.min(0.4 + (value / 50), 0.9)})`; 
    }
    // Cool/Indigo scale for stable areas
    return `rgba(99, 102, 241, ${Math.min(0.2 + (value / 20), 0.6)})`;
  };

  return (
    <div className="min-h-screen bg-[#050505] text-slate-200 overflow-x-hidden relative selection:bg-indigo-500/30 selection:text-white font-sans">
      <GlobalStyles />

      {/* Background (matches main) */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-indigo-900/10 blur-[150px] rounded-full mix-blend-screen opacity-50" />
        <div className="absolute top-[40%] right-[-10%] w-[40%] h-[40%] bg-emerald-900/5 blur-[120px] rounded-full mix-blend-screen opacity-40" />
        <div className="absolute bottom-[-20%] left-[20%] w-[60%] h-[40%] bg-violet-900/10 blur-[150px] rounded-full mix-blend-screen opacity-30" />
        <div className="absolute inset-0 cyber-grid" />
      </div>

      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 border-b border-white/5 bg-[#050505]/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 h-16">
          <Link href="/" className="group inline-flex items-center gap-3">
            <span className="relative flex items-center justify-center h-8 w-8 rounded bg-[#0A0A0A] border border-white/10 group-hover:border-indigo-500/50 transition-colors shadow-[0_0_15px_rgba(0,0,0,0.5)]">
              <Terminal className="text-white relative z-10 group-hover:text-indigo-400 transition-colors" size={16} />
            </span>
            <span className="text-sm font-bold tracking-[0.2em] text-white">DEX</span>
          </Link>
          <div className="hidden md:flex items-center gap-8 text-xs font-medium text-slate-400">
            <Link href="/#how-it-works" className="hover:text-white transition-colors">Methodology</Link>
            <Link href="/#features" className="hover:text-white transition-colors">Features</Link>
            <Link href="/#security" className="hover:text-white transition-colors">Security</Link>
            <Link href="/about" className="hover:text-white transition-colors">About</Link>
          </div>
          <div className="flex items-center gap-4">
            {session?.user ? (
              <div className="flex items-center gap-3 bg-white/5 px-3 py-1.5 rounded-full border border-white/5">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-xs text-slate-300 max-w-[100px] truncate">{session.user.email}</span>
                <button onClick={() => signOut()} className="text-slate-500 hover:text-white ml-1"><LogOut size={12} /></button>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <Link href="/login" className="text-xs font-semibold text-slate-400 hover:text-white transition-colors">Log in</Link>
                <Link href="/signup" className="hidden sm:inline-flex items-center justify-center rounded-lg bg-indigo-600 text-white px-4 py-2 text-xs font-bold hover:bg-indigo-500 transition-all shadow-[0_0_20px_rgba(99,102,241,0.3)] hover:shadow-[0_0_30px_rgba(99,102,241,0.5)]">
                  Public Beta Access
                </Link>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="relative pt-24 pb-20 z-10">
        <div className="max-w-6xl mx-auto px-6">
          {/* Back Button */}
          <Link 
            href="/about" 
            className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-indigo-400 transition-colors mb-6 group"
          >
            <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
            Back to About
          </Link>

          {/* Header Section */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-indigo-500/20 flex items-center justify-center text-indigo-400">
                <Activity size={20} />
              </div>
              <div>
                <h1 className="text-3xl font-semibold text-white mb-2">Repository Activity</h1>
                <p className="text-slate-400">
                  Identifying high-churn areas in the codebase.
                  <span className="text-red-400 ml-2">● High Activity (Hotspots)</span>
                  <span className="text-indigo-400 ml-2">● Stable (Coldspots)</span>
                </p>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-pulse">
              {[1,2,3,4,5,6].map(i => (
                <div key={i} className="h-32 bg-[#0A0A0A] border border-white/10 rounded-xl"></div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {data?.zones.map((zone: ZoneData, idx) => (
                <div 
                  key={idx}
                  className="relative group overflow-hidden rounded-xl border border-white/10 bg-[#0A0A0A] transition-all hover:scale-[1.02] hover:shadow-xl hover:border-indigo-500/30 backdrop-blur-sm"
                >
                  {/* Background Color Indicator */}
                  <div 
                    className="absolute inset-0 opacity-20 transition-opacity group-hover:opacity-30"
                    style={{ backgroundColor: getZoneColor(zone.intensity, zone.value) }}
                  ></div>
                  
                  {/* Pulse Animation for Hot Zones */}
                  {zone.intensity === 'High' && (
                    <div className="absolute top-3 right-3 w-3 h-3 bg-red-500 rounded-full animate-ping"></div>
                  )}

                  <div className="relative p-6">
                    <div className="flex justify-between items-start mb-4">
                      <span className={`text-xs font-mono px-2 py-1 rounded border ${
                        zone.intensity === 'High' 
                          ? 'border-red-500/30 text-red-300 bg-red-500/10' 
                          : 'border-indigo-500/30 text-indigo-300 bg-indigo-500/10'
                      }`}>
                        {zone.intensity === 'High' ? 'VOLATILE' : 'STABLE'}
                      </span>
                      <span className="text-2xl font-bold text-slate-200">
                        {zone.value}
                      </span>
                    </div>
                    
                    <h3 className="text-lg font-semibold text-white mb-1 break-all">
                      {zone.name}
                    </h3>
                    <p className="text-sm text-slate-500">
                      Commits in last 30 days
                    </p>
                  </div>
                </div>
              ))}
              
              {data?.zones.length === 0 && (
                <div className="col-span-3 text-center py-20 text-slate-500 border border-dashed border-white/10 rounded-xl bg-[#0A0A0A]">
                  No activity detected in the last 30 days.
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/5 bg-[#020202] py-8">
        <div className="mx-auto max-w-6xl px-6 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="w-5 h-5 bg-slate-800 rounded flex items-center justify-center"><Terminal size={10} /></span>
            <span className="font-bold text-white text-sm">DEX</span>
          </div>
          <div className="flex gap-6 text-xs text-slate-500">
            <Link href="/" className="hover:text-indigo-400 transition-colors">Home</Link>
            <Link href="/about" className="hover:text-indigo-400 transition-colors">About</Link>
            <Link href="/insights/team" className="hover:text-indigo-400 transition-colors">Team</Link>
            <Link href="/grievance" className="hover:text-indigo-400 transition-colors">Contact</Link>
          </div>
        </div>
        <div className="mx-auto max-w-6xl px-6 pt-4 border-t border-white/5 mt-4">
          <div className="text-center text-[10px] text-slate-600">
            © 2024 Dex Inc. All rights reserved. | Developed by Rhythm Suthar 2026
          </div>
        </div>
      </footer>
    </div>
  );
}