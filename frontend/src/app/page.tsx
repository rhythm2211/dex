"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { dexApi, GraphData } from '@/lib/api';
import { 
  Play, GitBranch, RefreshCw, Zap, Network, Folder, 
  File, Box, Code, BoxSelect, Layers, 
  Database, FileCode, Activity, XCircle, Search, Terminal
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import dynamic from 'next/dynamic';
import SpriteText from 'three-spritetext';

// Dynamically import ForceGraph to avoid SSR issues
const ForceGraph3D = dynamic(() => import('react-force-graph-3d'), { ssr: false });

// -----------------------------------------------------------------------------
// Visual Config (Cyberpunk / SaaS Palette)
// -----------------------------------------------------------------------------
const NODE_CONFIG = {
  folder:   { color: '#fbbf24', label: 'Folder',    desc: 'Container',      icon: Folder,   size: 12 },
  file:     { color: '#3b82f6', label: 'File',      desc: 'Source Code',    icon: File,     size: 6 },
  class:    { color: '#f472b6', label: 'Class',     desc: 'Object Def',     icon: Box,      size: 7 },
  function: { color: '#34d399', label: 'Function',  desc: 'Logic Unit',     icon: Code,     size: 4 },
  module:   { color: '#a78bfa', label: 'Module',    desc: 'Dependency',     icon: Database, size: 8 },
  default:  { color: '#94a3b8', label: 'Asset',     desc: 'Static Res',     icon: FileCode, size: 3 }
};

const BLACKLIST = ['.jar', '.class', '.lock', '.png', '.jpg', '.json', 'node_modules', '.git'];

export default function Dashboard() {
  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [ragResult, setRagResult] = useState<string | null>(null);
  const [graphData, setGraphData] = useState<GraphData>({ nodes: [], links: [] });
  const graphRef = useRef<any>(null);
  const [repoUrl, setRepoUrl] = useState('https://github.com/rhythm2211/ai-analyst');
  const [ingesting, setIngesting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [step, setStep] = useState('');
  
  // Selection & Highlighting State
  const [selectedNode, setSelectedNode] = useState<any>(null);
  const [highlightNodes, setHighlightNodes] = useState(new Set());
  const [highlightLinks, setHighlightLinks] = useState(new Set());

  // Toggles
  const [viewMode, setViewMode] = useState<'tree' | 'orbit'>('tree');
  const [showFunctions, setShowFunctions] = useState(false);

  // ---------------------------------------------------------------------------
  // Graph Logic (Filtering)
  // ---------------------------------------------------------------------------
  const processedGraph = useMemo(() => {
    if (!graphData.nodes.length) return { nodes: [], links: [] };

    const activeNodes = graphData.nodes.filter(node => {
        const idLower = node.id.toLowerCase();
        if (BLACKLIST.some(b => idLower.includes(b))) return false;
        if (!showFunctions && node.type === 'function') return false;
        return true;
    });

    const activeNodeIds = new Set(activeNodes.map(n => n.id));
    const activeLinks = graphData.links.filter(link => {
        const s = typeof link.source === 'object' ? (link.source as any).id : link.source;
        const t = typeof link.target === 'object' ? (link.target as any).id : link.target;
        return activeNodeIds.has(s) && activeNodeIds.has(t);
    });

    return { nodes: activeNodes, links: activeLinks };
  }, [graphData, showFunctions]);

  // ---------------------------------------------------------------------------
  // Interaction Logic (Click & Highlight)
  // ---------------------------------------------------------------------------
  
  const handleNodeClick = useCallback((node: any) => {
      // Safety check: ensure node coordinates exist to prevent crash
      if (!node || node.x === undefined || node.y === undefined) return;

      setSelectedNode(node);
      
      // 1. Calculate Highlights
      const newHighlightNodes = new Set();
      const newHighlightLinks = new Set();
      newHighlightNodes.add(node.id);

      processedGraph.links.forEach((link: any) => {
          const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
          const targetId = typeof link.target === 'object' ? link.target.id : link.target;

          if (sourceId === node.id || targetId === node.id) {
              newHighlightLinks.add(link);
              newHighlightNodes.add(sourceId);
              newHighlightNodes.add(targetId);
          }
      });

      setHighlightNodes(newHighlightNodes);
      setHighlightLinks(newHighlightLinks);

      // 2. Camera Focus (Wrapped in RAF to avoid event conflict)
      requestAnimationFrame(() => {
          const distance = 150;
          const distRatio = 1 + distance/Math.hypot(node.x, node.y, node.z);
          graphRef.current?.cameraPosition(
            { x: node.x * distRatio, y: node.y * distRatio, z: node.z * distRatio + 40 },
            node, 
            1500
          );
      });

      // 3. Auto-Prompt
      setQuery(`Explain the architecture of ${node.id} and its dependencies.`);

  }, [processedGraph]);

  const handleBackgroundClick = useCallback(() => {
      setSelectedNode(null);
      setHighlightNodes(new Set());
      setHighlightLinks(new Set());
  }, []);

  // ---------------------------------------------------------------------------
  // API Handlers
  // ---------------------------------------------------------------------------
  
  // Load graph on mount or after ingest
  const loadGraph = useCallback(async () => {
      const data = await dexApi.getGraphData();
      if(data?.nodes?.length) setGraphData(data);
  }, []);

  // Poll status until complete
  const pollIngestion = useCallback(() => {
      const i = setInterval(async () => {
          try {
              const s = await dexApi.getIngestStatus();
              setProgress(s.progress); 
              setStep(s.step);
              
              if (s.state === 'completed') { 
                  clearInterval(i); 
                  setIngesting(false); 
                  loadGraph(); 
              }
          } catch(e) {
              console.error("Polling error", e);
          }
      }, 1000);
  }, [loadGraph]);

  // Sync status on initial load
  useEffect(() => {
    dexApi.getIngestStatus().then(s => {
        if(s.state === 'processing' || s.state === 'cloning') {
            setIngesting(true);
            pollIngestion();
        }
    }).catch(e => console.log("No active session"));
  }, [pollIngestion]);

  // Handle Ingest Trigger (Fixed for 409 Conflict)
  const handleIngest = async () => {
      setIngesting(true); setGraphData({ nodes: [], links: [] });
      try {
          await dexApi.triggerIngestion(repoUrl);
      } catch (err: any) {
          // If 409 (Conflict), it means it's already running. Just attach listener.
          if (err.response?.status === 409 || err.message?.includes("already running")) {
              console.log("Ingestion already active, attaching listener...");
          } else {
              console.error(err);
              setIngesting(false);
              return;
          }
      }
      pollIngestion();
  };

  const handleExecute = async () => {
      if(!query) return;
      setLoading(true);
      const res = await dexApi.queryRAG(query);
      setRagResult(res.answer);
      setLoading(false);
  };

  // ---------------------------------------------------------------------------
  // RENDER
  // ---------------------------------------------------------------------------
  return (
    <div className="flex h-screen w-full bg-[#050505] text-slate-200 overflow-hidden font-sans selection:bg-indigo-500/30">
      
      {/* ------------------------------------------------------------------
          LEFT SIDEBAR: CONTROLS & CHAT
      ------------------------------------------------------------------ */}
      <aside className="w-[28%] min-w-[320px] flex flex-col border-r border-white/5 bg-[#0a0a0a] z-20 shadow-2xl relative">
        {/* Header */}
        <div className="h-14 flex items-center justify-between px-5 border-b border-white/5 bg-black/20 shrink-0">
            <div className="flex items-center gap-2.5 group cursor-pointer">
                <div className="p-1.5 bg-indigo-500/10 rounded-md border border-indigo-500/20 group-hover:bg-indigo-500/20 transition-colors">
                    <Terminal className="text-indigo-500" size={16} />
                </div>
                <h1 className="text-sm font-bold text-white tracking-widest">
                    DEX <span className="text-slate-600 font-light">GRAPH</span>
                </h1>
            </div>
            <div className="flex items-center gap-2">
                 <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)] animate-pulse" />
                 <span className="text-[10px] text-emerald-500 font-medium uppercase tracking-wider">Online</span>
            </div>
        </div>

        {/* Scrollable Content Area */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
            
            {/* Repo Input */}
            <div className="space-y-2">
                <div className="flex justify-between items-baseline">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Target Repository</label>
                    {step && ingesting && <span className="text-[10px] text-indigo-400 animate-pulse">{step}</span>}
                </div>
                <div className="flex gap-2">
                    <div className="relative flex-1 group">
                        <GitBranch size={14} className="absolute left-3 top-2.5 text-slate-500 group-focus-within:text-indigo-400 transition-colors" />
                        <input 
                            value={repoUrl} onChange={(e) => setRepoUrl(e.target.value)}
                            className="w-full bg-[#111] border border-white/10 rounded-lg pl-9 pr-3 py-2 text-xs text-slate-300 outline-none focus:border-indigo-500/50 focus:bg-[#161616] transition-all placeholder:text-slate-700 font-mono"
                            placeholder="https://github.com/..."
                        />
                    </div>
                    <button 
                        onClick={handleIngest} 
                        disabled={ingesting} 
                        className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-3 rounded-lg transition-all border border-indigo-400/20 shadow-[0_0_15px_rgba(79,70,229,0.1)]"
                    >
                        {ingesting ? <RefreshCw className="animate-spin" size={14}/> : <RefreshCw size={14}/>}
                    </button>
                </div>
                {ingesting && (
                    <div className="h-1 bg-slate-800 rounded-full overflow-hidden w-full mt-2">
                        <div className="h-full bg-gradient-to-r from-indigo-600 to-purple-500 transition-all duration-300 relative" style={{width: `${progress}%`}}>
                            <div className="absolute inset-0 bg-white/20 animate-pulse-fast"></div>
                        </div>
                    </div>
                )}
            </div>

            {/* AI Chat / Results Area */}
            <div className="flex flex-col min-h-[300px]">
                <div className="flex items-center gap-2 mb-3">
                    <Zap size={14} className={ragResult ? "text-emerald-400" : "text-slate-600"} fill="currentColor" /> 
                    <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Analysis Stream</span>
                </div>
                
                <div className="flex-1 rounded-xl bg-[#0f0f0f] border border-white/5 p-4 relative overflow-hidden group min-h-[200px]">
                    {ragResult ? (
                        <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
                            <div className="prose prose-invert prose-xs max-w-none text-slate-300 leading-relaxed font-light">
                                <ReactMarkdown remarkPlugins={[remarkGfm]}>{ragResult}</ReactMarkdown>
                            </div>
                        </div>
                    ) : (
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-700 gap-3 select-none">
                            <Activity size={32} strokeWidth={1} className="opacity-20" />
                            <p className="text-[10px] uppercase tracking-widest opacity-40">Ready for Query</p>
                        </div>
                    )}
                </div>
            </div>
        </div>

        {/* Query Input (Fixed at Bottom) */}
        <div className="p-5 border-t border-white/5 bg-[#0a0a0a] shrink-0 backdrop-blur-sm z-10">
            <div className="relative group">
                <textarea 
                    value={query} onChange={(e) => setQuery(e.target.value)}
                    placeholder="Ask Dex about the architecture..."
                    className="w-full bg-[#111] border border-white/10 rounded-xl p-4 pr-12 text-xs text-white focus:border-indigo-500/50 outline-none resize-none h-24 shadow-inner placeholder:text-slate-600 transition-all focus:bg-[#151515]"
                />
                <button 
                    onClick={handleExecute} 
                    disabled={loading || !query} 
                    className="absolute right-3 bottom-3 p-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-600 text-white rounded-lg transition-all shadow-lg hover:shadow-indigo-500/20"
                >
                    {loading ? <RefreshCw className="animate-spin" size={14}/> : <Play size={14} fill="currentColor"/>}
                </button>
            </div>
        </div>
      </aside>

      {/* ------------------------------------------------------------------
          CENTER: 3D GRAPH VISUALIZATION
      ------------------------------------------------------------------ */}
      <main className="flex-1 relative bg-black cursor-move">
        {/* Floating Toolbar */}
        <div className="absolute top-6 left-6 z-10 flex flex-col gap-2 pointer-events-none">
            <div className="pointer-events-auto flex gap-2">
                <button onClick={() => setViewMode('tree')} className={`px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider border transition-all flex items-center gap-2 ${viewMode === 'tree' ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-900/20' : 'bg-black/60 border-white/10 text-slate-400 hover:bg-white/5 backdrop-blur-md'}`}>
                    <Network size={12} /> Tree View
                </button>
                <button onClick={() => setViewMode('orbit')} className={`px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider border transition-all flex items-center gap-2 ${viewMode === 'orbit' ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-900/20' : 'bg-black/60 border-white/10 text-slate-400 hover:bg-white/5 backdrop-blur-md'}`}>
                    <Activity size={12} /> Orbit View
                </button>
            </div>
            
            {/* Context Stats */}
            <div className="bg-black/40 backdrop-blur-md border border-white/5 rounded-lg p-3 text-[10px] text-slate-400 w-fit pointer-events-auto">
                <div className="flex items-center gap-4">
                    <span>Nodes: <b className="text-slate-200">{processedGraph.nodes.length}</b></span>
                    <span>Links: <b className="text-slate-200">{processedGraph.links.length}</b></span>
                </div>
            </div>

            {/* Clear Filter Button */}
            {selectedNode && (
                <button onClick={handleBackgroundClick} className="pointer-events-auto px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider border border-red-500/30 bg-red-950/30 text-red-400 backdrop-blur-md flex items-center gap-2 hover:bg-red-900/40 transition-all animate-in fade-in zoom-in-95">
                    <XCircle size={14} /> Clear Focus
                </button>
            )}
        </div>

        <ForceGraph3D
            ref={graphRef}
            graphData={processedGraph}
            backgroundColor="#000000"
            
            // --- FIX IS HERE: DISABLE DRAG TO PREVENT CRASH ---
            enableNodeDrag={false} 
            // --------------------------------------------------

            // Layout
            dagMode={viewMode === 'tree' ? 'td' : undefined} 
            dagLevelDistance={80}
            controlType="orbit"
            
            // Link Styling
            linkColor={link => highlightLinks.has(link) ? '#ffffff' : '#333333'}
            linkWidth={link => highlightLinks.has(link) ? 1.5 : 0.5}
            linkOpacity={link => highlightLinks.has(link) ? 0.8 : (highlightLinks.size > 0 ? 0.05 : 0.2)}
            linkDirectionalParticles={link => highlightLinks.has(link) ? 4 : 0}
            linkDirectionalParticleWidth={2}
            
            // Node Styling
            nodeLabel="id"
            nodeRelSize={6}
            nodeResolution={16}
            
            nodeColor={(node: any) => {
                if (highlightNodes.size > 0 && !highlightNodes.has(node.id)) return '#1a1a1a'; 
                return (NODE_CONFIG[node.type as keyof typeof NODE_CONFIG] || NODE_CONFIG.default).color;
            }}
            
            nodeOpacity={node => (highlightNodes.size > 0 && !highlightNodes.has(node.id) ? 0.1 : 0.9)}

            nodeVal={(node: any) => (NODE_CONFIG[node.type as keyof typeof NODE_CONFIG] || NODE_CONFIG.default).size}
            
            // Text Rendering
            nodeThreeObject={(node: any) => {
                const config = NODE_CONFIG[node.type as keyof typeof NODE_CONFIG] || NODE_CONFIG.default;
                
                // Show label if: Tree Mode OR Folder OR Highlighted OR Node is very large (Module)
                const shouldShow = viewMode === 'tree' || node.type === 'folder' || node.type === 'module' || highlightNodes.has(node.id);

                if (shouldShow) {
                    const sprite = new SpriteText(node.name || node.id);
                    sprite.color = highlightNodes.has(node.id) ? '#ffffff' : config.color; 
                    sprite.textHeight = node.type === 'folder' ? 5 : (highlightNodes.has(node.id) ? 6 : 3);
                    sprite.fontWeight = 'bold';
                    sprite.backgroundColor = highlightNodes.has(node.id) ? 'rgba(0,0,0,0.8)' : 'transparent';
                    sprite.padding = 2;
                    sprite.borderRadius = 2;
                    
                    const yOffset = -1 * (config.size + 8); 
                    sprite.position.set(0, yOffset, 0); 
                    return sprite;
                }
            }}
            nodeThreeObjectExtend={true}

            onNodeClick={handleNodeClick}
            onBackgroundClick={handleBackgroundClick}
        />
      </main>

      {/* ------------------------------------------------------------------
          RIGHT SIDEBAR: INSPECTOR & LEGEND
      ------------------------------------------------------------------ */}
      <aside className="w-[22%] min-w-[280px] border-l border-white/5 bg-[#0a0a0a] flex flex-col h-full z-20 shadow-[-10px_0_30px_rgba(0,0,0,0.5)]">
          
          {/* TOP PANEL: INSPECTOR (60% Height) */}
          <div className="h-[60%] flex flex-col border-b border-white/5 bg-[#0a0a0a]">
              <div className="h-14 flex items-center px-4 border-b border-white/5 bg-[#0f0f0f] shrink-0">
                 <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <Search size={14} className="text-indigo-500"/> Node Inspector
                 </span>
              </div>
              <div className="flex-1 p-5 overflow-y-auto">
                 {selectedNode ? (
                    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                        {/* Title Card */}
                        <div className="p-4 rounded-xl bg-gradient-to-br from-white/5 to-white/0 border border-white/10 shadow-sm relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-2 opacity-10">
                                <BoxSelect size={40} />
                            </div>
                            <div className="text-[9px] text-indigo-400 font-bold mb-2 uppercase tracking-wider">Selected Node</div>
                            <div className="text-sm font-mono text-white break-all leading-snug">{selectedNode.name || selectedNode.id}</div>
                        </div>

                        {/* Metrics Grid */}
                        <div className="grid grid-cols-2 gap-3">
                             <div className="p-3 rounded-lg bg-[#111] border border-white/5 group hover:border-indigo-500/30 transition-colors">
                                <div className="text-[9px] text-slate-500 mb-1 uppercase">Type</div>
                                <div className="text-xs font-bold text-white capitalize flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full" style={{backgroundColor: (NODE_CONFIG[selectedNode.type as keyof typeof NODE_CONFIG] || NODE_CONFIG.default).color}}></div>
                                    {selectedNode.type}
                                </div>
                             </div>
                             <div className="p-3 rounded-lg bg-[#111] border border-white/5 group hover:border-emerald-500/30 transition-colors">
                                <div className="text-[9px] text-slate-500 mb-1 uppercase">Degree</div>
                                <div className="text-xs font-bold text-emerald-400">
                                    {processedGraph.links.filter(l => (l.source as any).id === selectedNode.id || (l.target as any).id === selectedNode.id).length} links
                                </div>
                             </div>
                        </div>

                        {/* Actions */}
                        <button 
                             onClick={handleExecute} 
                             className="w-full py-3 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 text-slate-200 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-all flex items-center justify-center gap-2 group"
                        >
                             <Zap size={12} className="text-yellow-400 group-hover:scale-110 transition-transform" fill="currentColor"/>
                             Analyze Context
                        </button>
                    </div>
                 ) : (
                    <div className="h-full flex flex-col items-center justify-center text-slate-700 space-y-3 opacity-60">
                        <BoxSelect size={32} strokeWidth={1} />
                        <p className="text-[10px] text-center uppercase tracking-widest">Select a node<br/>to view details</p>
                    </div>
                 )}
              </div>
          </div>

          {/* BOTTOM PANEL: LEGEND (40% Height) */}
          <div className="h-[40%] flex flex-col min-h-0 bg-[#0a0a0a]">
              <div className="h-10 flex items-center px-4 border-b border-white/5 bg-[#0f0f0f] shrink-0">
                 <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <Layers size={14} className="text-purple-500" /> Graph Legend
                 </span>
              </div>
              
              <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-white/10 p-2">
                  <table className="w-full text-left border-collapse">
                      <thead className="bg-[#111] text-[8px] text-slate-500 uppercase sticky top-0 z-10">
                          <tr>
                              <th className="px-3 py-2 font-semibold border-b border-white/5">Type</th>
                              <th className="px-3 py-2 font-semibold border-b border-white/5 text-right">Style</th>
                          </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                          {Object.entries(NODE_CONFIG).map(([key, config]) => (
                              <tr key={key} className="hover:bg-white/5 transition-colors group cursor-default">
                                  <td className="px-3 py-2.5">
                                      <div className="flex items-center gap-2">
                                          <config.icon size={12} className="text-slate-600" />
                                          <div>
                                              <div className="text-[10px] font-bold text-slate-300">{config.label}</div>
                                              <div className="text-[8px] text-slate-600 font-mono">{config.desc}</div>
                                          </div>
                                      </div>
                                  </td>
                                  <td className="px-3 py-2.5">
                                      <div className="flex items-center justify-end gap-3">
                                          <div className="w-2 h-2 rounded-full shadow-[0_0_8px_rgba(0,0,0,0.8)] border border-white/10" style={{ backgroundColor: config.color, boxShadow: `0 0 8px ${config.color}40` }}></div>
                                      </div>
                                  </td>
                              </tr>
                          ))}
                      </tbody>
                  </table>
              </div>
          </div>
      </aside>
    </div>
  );
}