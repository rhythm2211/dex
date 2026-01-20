'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useSession, signOut } from 'next-auth/react';
import { Terminal, LogOut, ArrowLeft, Users } from 'lucide-react';
import * as d3 from 'd3';
import { dexApi, TeamTopologyResponse } from '@/lib/api';

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

export default function TeamInsightsPage() {
  const { data: session } = useSession();
  const svgRef = useRef<SVGSVGElement>(null);
  const [data, setData] = useState<TeamTopologyResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const topology = await dexApi.getTeamTopology();
        setData(topology);
      } catch (e: any) {
        console.error("Failed to load team data", e);
        // If 404, the endpoint might not be registered - backend may need restart
        if (e?.response?.status === 404) {
          console.warn("Team topology endpoint not found. Ensure backend is running and routes are registered.");
        }
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  useEffect(() => {
    if (!data || !svgRef.current) return;
    
    // Clear previous render
    d3.select(svgRef.current).selectAll("*").remove();

    const width = 800;
    const height = 600;

    const svg = d3.select(svgRef.current)
      .attr("viewBox", `0 0 ${width} ${height}`)
      .classed("w-full h-full", true);

    // Simulation Setup
    const simulation = d3.forceSimulation(data.nodes as d3.SimulationNodeDatum[])
      .force("link", d3.forceLink(data.links).id((d: any) => d.id).distance(100))
      .force("charge", d3.forceManyBody().strength(-300))
      .force("center", d3.forceCenter(width / 2, height / 2));

    // Render Links (Connections) - Updated to match theme
    const link = svg.append("g")
      .selectAll("line")
      .data(data.links)
      .join("line")
      .attr("stroke", "rgba(99, 102, 241, 0.4)") // Indigo with opacity
      .attr("stroke-opacity", 0.6)
      .attr("stroke-width", (d) => Math.sqrt(d.value || 1) * 2);

    // Render Nodes (People) - Updated to match theme
    const node = svg.append("g")
      .selectAll("circle")
      .data(data.nodes)
      .join("circle")
      .attr("r", 20)
      .attr("fill", "#6366f1") // Indigo-500
      .attr("stroke", "#818cf8") // Indigo-400
      .attr("stroke-width", 2)
      .call(drag(simulation) as any);

    // Add Labels (Names) - Updated to match theme
    const labels = svg.append("g")
      .selectAll("text")
      .data(data.nodes)
      .join("text")
      .text((d) => d.id)
      .attr("font-size", "12px")
      .attr("dx", 22)
      .attr("dy", 4)
      .attr("fill", "#e2e8f0") // Slate-200
      .attr("font-family", "system-ui");

    // Update positions on tick
    simulation.on("tick", () => {
      link
        .attr("x1", (d: any) => d.source.x)
        .attr("y1", (d: any) => d.source.y)
        .attr("x2", (d: any) => d.target.x)
        .attr("y2", (d: any) => d.target.y);

      node
        .attr("cx", (d: any) => d.x)
        .attr("cy", (d: any) => d.y);

      labels
        .attr("x", (d: any) => d.x)
        .attr("y", (d: any) => d.y);
    });

  }, [data]);

  // Drag behavior helper
  const drag = (simulation: d3.Simulation<d3.SimulationNodeDatum, undefined>) => {
    function dragstarted(event: any) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      event.subject.fx = event.subject.x;
      event.subject.fy = event.subject.y;
    }
    
    function dragged(event: any) {
      event.subject.fx = event.x;
      event.subject.fy = event.y;
    }
    
    function dragended(event: any) {
      if (!event.active) simulation.alphaTarget(0);
      event.subject.fx = null;
      event.subject.fy = null;
    }
    
    return d3.drag()
      .on("start", dragstarted)
      .on("drag", dragged)
      .on("end", dragended);
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
                <Users size={20} />
              </div>
              <div>
                <h1 className="text-3xl font-semibold text-white mb-2">Team Network</h1>
                <p className="text-slate-400">
                  Visualizing collaboration patterns. Connected nodes represent developers who frequently modify the same files.
                </p>
              </div>
            </div>
          </div>

          {/* Visualization Container */}
          <div className="bg-[#0A0A0A] border border-white/10 rounded-xl overflow-hidden h-[600px] shadow-2xl relative backdrop-blur-sm">
            {loading && (
              <div className="absolute inset-0 flex items-center justify-center z-10">
                <div className="flex flex-col items-center gap-3">
                  <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                  <span className="text-indigo-400 text-sm font-medium">Mapping relationships...</span>
                </div>
              </div>
            )}
            <svg ref={svgRef} className="w-full h-full"></svg>
          </div>
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
            <Link href="/insights/activity" className="hover:text-indigo-400 transition-colors">Activity</Link>
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