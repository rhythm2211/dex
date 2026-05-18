'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import AppShell from '@/components/AppShell';
import { ArrowLeft, Users, UserX } from 'lucide-react';
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
  const svgRef = useRef<SVGSVGElement>(null);
  const [data, setData] = useState<TeamTopologyResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [whatIfPerson, setWhatIfPerson] = useState('');
  const [whatIfLoading, setWhatIfLoading] = useState(false);
  const [whatIfResult, setWhatIfResult] = useState<{ critical_files: { file: string; bus_risk: number; next_owners: string[] }[]; handoff_plan: string } | null>(null);

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
      .attr(
        "font-family",
        "var(--font-geist-sans), ui-sans-serif, system-ui, sans-serif"
      );

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
    <AppShell>
      <GlobalStyles />

      {/* Background (matches main) */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-indigo-900/10 blur-[150px] rounded-full mix-blend-screen opacity-50" />
        <div className="absolute top-[40%] right-[-10%] w-[40%] h-[40%] bg-emerald-900/5 blur-[120px] rounded-full mix-blend-screen opacity-40" />
        <div className="absolute bottom-[-20%] left-[20%] w-[60%] h-[40%] bg-violet-900/10 blur-[150px] rounded-full mix-blend-screen opacity-30" />
        <div className="absolute inset-0 cyber-grid" />
      </div>

      <main className="relative z-10 overflow-x-hidden pb-20">
        <div className="max-w-6xl mx-auto px-6 pt-6">
          {/* Back Button */}
          <Link 
            href="/app" 
            className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-indigo-400 transition-colors mb-6 group"
          >
            <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
            Back to Dashboard
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

          <div className="mt-10 bg-[#0A0A0A] border border-white/10 rounded-xl p-6">
            <div className="flex items-center gap-2 mb-3">
              <UserX className="text-indigo-400" size={20} />
              <h2 className="text-xl font-semibold text-white">What if they leave?</h2>
            </div>
            <p className="text-sm text-slate-400 mb-4">
              Enter a developer name as it appears in <code className="text-indigo-300">top_owner</code> from git blame (e.g. from graph node details).
            </p>
            <div className="flex flex-col sm:flex-row gap-3 mb-4">
              <input
                value={whatIfPerson}
                onChange={(e) => setWhatIfPerson(e.target.value)}
                placeholder="Developer name"
                className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
              />
              <button
                type="button"
                disabled={whatIfLoading || !whatIfPerson.trim()}
                onClick={async () => {
                  setWhatIfLoading(true);
                  setWhatIfResult(null);
                  try {
                    const r = await dexApi.getWhatIfLeaves(whatIfPerson.trim());
                    setWhatIfResult(r);
                  } catch (e) {
                    console.error(e);
                    setWhatIfResult({ critical_files: [], handoff_plan: String(e) });
                  } finally {
                    setWhatIfLoading(false);
                  }
                }}
                className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold disabled:opacity-40"
              >
                {whatIfLoading ? 'Analyzing…' : 'Simulate'}
              </button>
            </div>
            {whatIfResult && (
              <div className="space-y-4 text-sm">
                <p className="text-slate-300">
                  <span className="text-white font-medium">{whatIfResult.critical_files?.length || 0}</span> files
                  list this person as primary owner.
                </p>
                <div className="max-h-48 overflow-y-auto rounded-lg border border-white/10">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-white/5 text-slate-500">
                      <tr>
                        <th className="p-2">File</th>
                        <th className="p-2">Bus risk</th>
                        <th className="p-2">Next owners</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(whatIfResult.critical_files || []).slice(0, 40).map((row) => (
                        <tr key={row.file} className="border-t border-white/5">
                          <td className="p-2 font-mono text-indigo-200">{row.file}</td>
                          <td className="p-2">{row.bus_risk.toFixed(2)}</td>
                          <td className="p-2">{(row.next_owners || []).join(', ') || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="rounded-lg bg-white/5 border border-white/10 p-4 text-slate-300 whitespace-pre-wrap">
                  {whatIfResult.handoff_plan}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/5 bg-[#020202] py-8">
        <div className="mx-auto max-w-6xl px-6 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="font-black tracking-[0.2em] text-white text-xs">DEX</span>
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
    </AppShell>
  );
}