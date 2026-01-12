"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { dexApi, GraphData } from '@/lib/api';
import { 
  Play, GitBranch, RefreshCw, Zap, Network, Folder, 
  File, Box, Code, BoxSelect, Layers, 
  Database, FileCode, Activity, XCircle, Search, Terminal, MessageSquare,
  Maximize2, Info
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
  folder:   { color: '#fbbf24', label: 'Folder',    desc: 'Container',      icon: Folder,   size: 10 },
  file:     { color: '#3b82f6', label: 'File',      desc: 'Source Code',    icon: File,     size: 5 },
  class:    { color: '#f472b6', label: 'Class',     desc: 'Object Def',     icon: Box,      size: 6 },
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
  const [hoverNode, setHoverNode] = useState<any>(null);

  // UI Toggles
  const [viewMode, setViewMode] = useState<'tree' | 'orbit'>('orbit');
  const [showFunctions, setShowFunctions] = useState(false);
  const [activeTab, setActiveTab] = useState<'assistant' | 'details'>('assistant');

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
  // FORCE CENTER LOGIC (One-Time Only)
  // ---------------------------------------------------------------------------
  useEffect(() => {
    // Only center when new data actually arrives
    if (processedGraph.nodes.length > 0 && graphRef.current) {
        // Wait 1s for physics to settle, then center ONCE
        const t = setTimeout(() => {
            graphRef.current.zoomToFit(1000, 50); 
        }, 1000);
        return () => clearTimeout(t);
    }
  }, [processedGraph]); // Only runs when graph structure changes

  // ---------------------------------------------------------------------------
  // Memoized Handlers (Prevents Flicker/Crash)
  // ---------------------------------------------------------------------------
  const getNodeColor = useCallback((node: any) => {
      if (highlightNodes.size > 0 && !highlightNodes.has(node.id)) return '#1a1a1a'; 
      return (NODE_CONFIG[node.type as keyof typeof NODE_CONFIG] || NODE_CONFIG.default).color;
  }, [highlightNodes]);

  const getNodeThreeObject = useCallback((node: any) => {
      const config = NODE_CONFIG[node.type as keyof typeof NODE_CONFIG] || NODE_CONFIG.default;
      
      const isImportant = node.type === 'folder' || node.type === 'module';
      const isInteracted = highlightNodes.has(node.id) || (hoverNode && hoverNode.id === node.id);
      const shouldShow = viewMode === 'tree' || isImportant || isInteracted;

      if (shouldShow) {
          const sprite = new SpriteText(node.name || node.id);
          sprite.color = highlightNodes.has(node.id) ? '#ffffff' : config.color; 
          sprite.textHeight = 6; 
          sprite.fontWeight = 'bold';
          
          if (isInteracted) {
              sprite.backgroundColor = 'rgba(0,0,0,0.8)';
              sprite.padding = 3;
              sprite.borderRadius = 4;
              sprite.borderColor = 'rgba(255,255,255,0.2)';
              sprite.borderWidth = 1;
          }
          
          const yOffset = -1 * (config.size + 10); 
          sprite.position.set(0, yOffset, 0); 
          return sprite;
      }
  }, [viewMode, highlightNodes, hoverNode]);

  // ---------------------------------------------------------------------------
  // Interaction Logic
  // ---------------------------------------------------------------------------
  
  const handleNodeClick = useCallback((node: any) => {
      if (!node) return;
      setSelectedNode(node);
      setActiveTab('details'); 
      
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

      // Focus Camera (Smooth Fly-In)
      const distance = 150;
      const distRatio = 1 + distance/Math.hypot(node.x, node.y, node.z);
      
      if (graphRef.current) {
          graphRef.current.cameraPosition(
            { x: node.x * distRatio, y: node.y * distRatio, z: node.z * distRatio + 40 }, // Target position
            node, // LookAt
            1500  // Duration (ms)
          );
      }

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
  const loadGraph = useCallback(async () => {
      const data = await dexApi.getGraphData();
      if(data?.nodes?.length) setGraphData(data);
  }, []);

  const pollIngestion = useCallback(() => {
      const i = setInterval(async () => {
          try {
              const s = await dexApi.getIngestStatus();
              setProgress(s.progress); setStep(s.step);
              if (s.state === 'completed') { clearInterval(i); setIngesting(false); loadGraph(); }
          } catch(e) { console.error("Polling error", e); }
      }, 1000);
  }, [loadGraph]);

  useEffect(() => {
    dexApi.getIngestStatus().then(s => {
        if(s.state === 'processing' || s.state === 'cloning') {
            setIngesting(true);
            pollIngestion();
        }
    }).catch(e => console.log("No active session"));
  }, [pollIngestion]);

  const handleIngest = async () => {
      setIngesting(true); setGraphData({ nodes: [], links: [] });
      try { await dexApi.triggerIngestion(repoUrl); } 
      catch (err: any) {
          if (err.response?.status === 409 || err.message?.includes("already running")) {
              console.log("Ingestion running");
          } else {
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
      setActiveTab('assistant');
  };

  // ---------------------------------------------------------------------------
  // RENDER
  // ---------------------------------------------------------------------------
  return (
    <div className="flex h-screen w-full bg-[#050505] text-slate-200 overflow-hidden font-sans selection:bg-indigo-500/30">
      
      {/* ==================================================================
          LEFT SIDEBAR: CONTROLLER (420px Fixed)
      ================================================================== */}
      <aside className="w-[420px] min-w-[420px] flex flex-col border-r border-white/5 bg-[#0a0a0a] z-20 shadow-2xl relative">
        
        {/* Header */}
        <div className="h-14 flex items-center justify-between px-6 border-b border-white/5 bg-black/20 shrink-0">
            <div className="flex items-center gap-3">
                <div className="p-1.5 bg-indigo-500/10 rounded-lg border border-indigo-500/20">
                    <Terminal className="text-indigo-500" size={16} />
                </div>
                <h1 className="text-sm font-bold text-white tracking-widest leading-none">DEX<span className="text-slate-600 font-light">GRAPH</span></h1>
            </div>
            <div className="flex items-center gap-2 px-2 py-1 rounded-full bg-emerald-500/5 border border-emerald-500/10">
                 <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)] animate-pulse" />
                 <span className="text-[10px] text-emerald-500 font-medium uppercase tracking-wider">Online</span>
            </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-white/5 bg-[#0a0a0a]">
            <button 
                onClick={() => setActiveTab('assistant')}
                className={`flex-1 py-3 text-[10px] font-bold uppercase tracking-widest transition-all border-b-2 ${activeTab === 'assistant' ? 'border-indigo-500 text-white bg-white/5' : 'border-transparent text-slate-500 hover:text-slate-300 hover:bg-white/5'}`}
            >
                <div className="flex items-center justify-center gap-2">
                    <MessageSquare size={12} /> Assistant
                </div>
            </button>
            <button 
                onClick={() => setActiveTab('details')}
                className={`flex-1 py-3 text-[10px] font-bold uppercase tracking-widest transition-all border-b-2 ${activeTab === 'details' ? 'border-emerald-500 text-white bg-white/5' : 'border-transparent text-slate-500 hover:text-slate-300 hover:bg-white/5'}`}
            >
                <div className="flex items-center justify-center gap-2">
                    <Info size={12} /> Graph Details
                </div>
            </button>
        </div>

        {/* --- TAB CONTENT: ASSISTANT --- */}
        {activeTab === 'assistant' && (
            <div className="flex-1 flex flex-col min-h-0 animate-in fade-in slide-in-from-left-4 duration-300">
                {/* Repo Input */}
                <div className="p-5 border-b border-white/5 bg-[#0a0a0a]/50 shrink-0 space-y-3">
                    <div className="flex justify-between items-baseline">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                            <GitBranch size={12}/> Target Repository
                        </label>
                        {step && ingesting && <span className="text-[10px] text-indigo-400 animate-pulse font-mono">{step}</span>}
                    </div>
                    <div className="flex gap-2">
                        <input 
                            value={repoUrl} onChange={(e) => setRepoUrl(e.target.value)}
                            className="w-full bg-[#111] border border-white/10 rounded-lg px-3 py-2 text-xs text-slate-300 outline-none focus:border-indigo-500/50 focus:bg-[#161616] transition-all placeholder:text-slate-700 font-mono shadow-inner"
                            placeholder="https://github.com/..."
                        />
                        <button onClick={handleIngest} disabled={ingesting} className="bg-indigo-600 hover:bg-indigo-500 text-white px-3 rounded-lg transition-all border border-indigo-400/20 flex items-center justify-center shrink-0">
                            {ingesting ? <RefreshCw className="animate-spin" size={14}/> : <RefreshCw size={14}/>}
                        </button>
                    </div>
                    {ingesting && (
                        <div className="h-1 bg-slate-800 rounded-full overflow-hidden w-full">
                            <div className="h-full bg-indigo-500 relative" style={{width: `${progress}%`}}/>
                        </div>
                    )}
                </div>

                {/* Analysis Stream */}
                <div className="flex-1 overflow-y-auto p-5 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent bg-[#0c0c0c]">
                    {ragResult ? (
                        <div className="prose prose-invert prose-sm max-w-none text-slate-300 leading-relaxed font-light text-sm">
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>{ragResult}</ReactMarkdown>
                        </div>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-slate-800 gap-4 select-none opacity-50">
                            <Activity size={32} strokeWidth={1.5} />
                            <div className="text-center">
                                <p className="text-xs font-bold uppercase tracking-widest text-slate-600">AI Ready</p>
                                <p className="text-[10px] text-slate-700 mt-1">Ingest a repo to begin</p>
                            </div>
                        </div>
                    )}
                </div>

                {/* Input */}
                <div className="p-5 border-t border-white/5 bg-[#0a0a0a] shrink-0">
                    <div className="relative group">
                        <textarea 
                            value={query} onChange={(e) => setQuery(e.target.value)}
                            placeholder="Ask about architecture..."
                            className="w-full bg-[#111] border border-white/10 rounded-xl p-4 pr-12 text-xs text-white focus:border-indigo-500/50 outline-none resize-none h-24 shadow-inner placeholder:text-slate-600 transition-all focus:bg-[#151515]"
                        />
                        <button onClick={handleExecute} disabled={loading || !query} className="absolute right-3 bottom-3 p-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-all shadow-lg hover:shadow-indigo-500/20">
                            {loading ? <RefreshCw className="animate-spin" size={14}/> : <Play size={14} fill="currentColor"/>}
                        </button>
                    </div>
                </div>
            </div>
        )}

        {/* --- TAB CONTENT: DETAILS --- */}
        {activeTab === 'details' && (
            <div className="flex-1 flex flex-col min-h-0 animate-in fade-in slide-in-from-right-4 duration-300">
                {/* Node Inspector Section */}
                <div className="flex-1 p-5 overflow-y-auto border-b border-white/5">
                    <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                        <Search size={12}/> Inspector
                    </div>
                    {selectedNode ? (
                        <div className="space-y-4">
                            <div className="p-4 rounded-xl bg-gradient-to-br from-white/5 to-white/0 border border-white/10 shadow-sm">
                                <div className="text-[9px] text-indigo-400 font-bold mb-2 uppercase tracking-wider">Active Selection</div>
                                <div className="text-sm font-mono text-white break-all leading-relaxed">{selectedNode.name || selectedNode.id}</div>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <div className="p-3 rounded-lg bg-[#111] border border-white/5">
                                    <div className="text-[9px] text-slate-500 mb-1 uppercase">Type</div>
                                    <div className="text-xs font-bold text-white capitalize flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full" style={{backgroundColor: (NODE_CONFIG[selectedNode.type as keyof typeof NODE_CONFIG] || NODE_CONFIG.default).color}}></div>
                                        {selectedNode.type}
                                    </div>
                                </div>
                                <div className="p-3 rounded-lg bg-[#111] border border-white/5">
                                    <div className="text-[9px] text-slate-500 mb-1 uppercase">Links</div>
                                    <div className="text-xs font-bold text-emerald-400">
                                        {processedGraph.links.filter(l => (l.source as any).id === selectedNode.id || (l.target as any).id === selectedNode.id).length}
                                    </div>
                                </div>
                            </div>
                            <button onClick={handleExecute} className="w-full py-3 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-all flex items-center justify-center gap-2">
                                <Zap size={12} className="text-yellow-400" fill="currentColor"/> Analyze Node
                            </button>
                        </div>
                    ) : (
                        <div className="py-10 flex flex-col items-center justify-center text-slate-700 gap-3 opacity-60">
                            <BoxSelect size={32} strokeWidth={1} />
                            <p className="text-[10px] text-center uppercase tracking-widest">Select a node</p>
                        </div>
                    )}
                </div>

                {/* Legend Section */}
                <div className="h-[40%] flex flex-col bg-[#0a0a0a]">
                    <div className="p-4 border-b border-white/5 bg-[#0f0f0f] shrink-0">
                         <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                            <Layers size={12} className="text-purple-500" /> Graph Legend
                         </span>
                    </div>
                    <div className="flex-1 overflow-y-auto p-2">
                        <table className="w-full text-left border-collapse">
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
                                        <td className="px-3 py-2.5 text-right">
                                            <div className="inline-block w-2.5 h-2.5 rounded-full border border-white/10" style={{ backgroundColor: config.color, boxShadow: `0 0 8px ${config.color}40` }}></div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        )}
      </aside>

      {/* ==================================================================
          MAIN: 3D GRAPH (Flexible Width)
      ================================================================== */}
      <main className="flex-1 min-w-0 relative bg-black cursor-move flex flex-col items-center justify-center">
        
        {/* Floating Controls */}
        <div className="absolute top-6 left-6 z-10 flex gap-2 pointer-events-none">
            <div className="pointer-events-auto flex gap-2 p-1 rounded-lg bg-black/60 backdrop-blur-md border border-white/10">
                <button onClick={() => setViewMode('tree')} className={`px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all flex items-center gap-2 ${viewMode === 'tree' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}>
                    <Network size={12} /> Tree
                </button>
                <button onClick={() => setViewMode('orbit')} className={`px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all flex items-center gap-2 ${viewMode === 'orbit' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}>
                    <Activity size={12} /> Orbit
                </button>
                <div className="w-px h-full bg-white/10 mx-1"></div>
                <button onClick={() => graphRef.current?.zoomToFit(1000, 50)} className="px-2 py-1.5 text-slate-400 hover:text-white transition-colors" title="Center Graph">
                    <Maximize2 size={14} />
                </button>
            </div>
            {selectedNode && (
                <button onClick={handleBackgroundClick} className="pointer-events-auto px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider border border-red-500/30 bg-red-950/30 text-red-400 backdrop-blur-md flex items-center gap-2 hover:bg-red-900/40 transition-all shadow-lg">
                    <XCircle size={14} /> Clear Focus
                </button>
            )}
        </div>

        <div className="w-full h-full">
            <ForceGraph3D
                ref={graphRef}
                graphData={processedGraph}
                backgroundColor="#050505"
                
                // --- STABLE SETTINGS ---
                enableNodeDrag={false} 
                cooldownTicks={100}
                // Removed onEngineStop to prevent auto-centering loop
                
                dagMode={viewMode === 'tree' ? 'td' : undefined} 
                dagLevelDistance={80}
                controlType="orbit"

                linkColor={link => highlightLinks.has(link) ? '#ffffff' : '#222222'}
                linkWidth={link => highlightLinks.has(link) ? 2 : 0.5}
                linkOpacity={link => highlightLinks.has(link) ? 0.8 : 0.1}
                
                nodeLabel="id"
                nodeRelSize={7} 
                nodeResolution={16}
                
                // Memoized handlers
                nodeColor={getNodeColor}
                nodeThreeObject={getNodeThreeObject}
                nodeThreeObjectExtend={true}
                
                nodeOpacity={node => (highlightNodes.size > 0 && !highlightNodes.has(node.id) ? 0.1 : 1)}
                nodeVal={(node: any) => (NODE_CONFIG[node.type as keyof typeof NODE_CONFIG] || NODE_CONFIG.default).size}
                
                onNodeClick={handleNodeClick}
                onBackgroundClick={handleBackgroundClick}
                onNodeHover={setHoverNode}
            />
        </div>
      </main>
    </div>
  );
}