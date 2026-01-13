"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { dexApi, GraphData } from '@/lib/api';
import { 
  GitBranch, RefreshCw, Zap, Search, Terminal, MessageSquare,
  Info, Folder, File, Box, Code, Database, FileCode, 
  ChevronRight, ChevronDown, ZoomIn, ZoomOut, Move, LayoutTemplate,
  Play, Layers
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import dynamic from 'next/dynamic';

// Dynamic import for D3 Tree
const Tree = dynamic(() => import('react-d3-tree'), { ssr: false });

// -----------------------------------------------------------------------------
// Visual Config
// -----------------------------------------------------------------------------
const NODE_CONFIG: any = {
  folder:   { color: '#fbbf24', icon: Folder, label: 'Directory' },
  file:     { color: '#60a5fa', icon: File,   label: 'Source File' },
  class:    { color: '#f472b6', icon: Box,    label: 'Class/Struct' },
  function: { color: '#34d399', icon: Code,   label: 'Function' },
  module:   { color: '#a78bfa', icon: Database, label: 'Module' },
  default:  { color: '#94a3b8', icon: FileCode, label: 'Asset' }
};

// -----------------------------------------------------------------------------
// Data Helpers
// -----------------------------------------------------------------------------
const buildHierarchy = (nodes: any[], links: any[]) => {
    if (!nodes.length) return { name: 'Repository', attributes: { type: 'root', id: 'root' }, children: [] };

    const nodeMap = new Map();
    nodes.forEach(n => {
        nodeMap.set(n.id, { 
            name: n.name || n.id, 
            attributes: { ...n }, 
            children: [] 
        });
    });

    const childrenSet = new Set();
    
    links.forEach(link => {
        const parentId = typeof link.source === 'object' ? link.source.id : link.source;
        const childId = typeof link.target === 'object' ? link.target.id : link.target;
        
        const parent = nodeMap.get(parentId);
        const child = nodeMap.get(childId);

        if (parent && child && parentId !== childId) {
            parent.children.push(child);
            childrenSet.add(childId);
        }
    });

    const roots: any[] = [];
    nodeMap.forEach((val, key) => {
        if (!childrenSet.has(key)) roots.push(val);
    });

    if (roots.length === 1) return roots[0];
    return { name: 'Root', attributes: { type: 'folder', id: 'root' }, children: roots };
};

const buildParentMap = (links: any[]) => {
    const map = new Map<string, string>();
    links.forEach(link => {
        const s = typeof link.source === 'object' ? link.source.id : link.source;
        const t = typeof link.target === 'object' ? link.target.id : link.target;
        map.set(t, s);
    });
    return map;
};

export default function Dashboard() {
  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------
  const [mounted, setMounted] = useState(false); // HYDRATION FIX
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [ragResult, setRagResult] = useState<string | null>(null);
  const [graphData, setGraphData] = useState<GraphData>({ nodes: [], links: [] });
  const [repoUrl, setRepoUrl] = useState('https://github.com/rhythm2211/ai-analyst');
  const [ingesting, setIngesting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [step, setStep] = useState('');
  
  const [selectedNode, setSelectedNode] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'assistant' | 'details'>('assistant');
  
  const [pathSet, setPathSet] = useState<Set<string>>(new Set());
  const [treeOrientation, setTreeOrientation] = useState<'vertical' | 'horizontal'>('vertical');
  const [treeTranslate, setTreeTranslate] = useState({ x: 0, y: 0 });
  const treeContainer = useRef<HTMLDivElement>(null);

  // ---------------------------------------------------------------------------
  // Lifecycle & Logic
  // ---------------------------------------------------------------------------
  
  // FIX: Prevent Hydration Mismatch
  useEffect(() => {
      setMounted(true);
  }, []);

  const hierarchyData = useMemo(() => buildHierarchy(graphData.nodes, graphData.links), [graphData]);
  const parentMap = useMemo(() => buildParentMap(graphData.links), [graphData.links]);

  const centerTree = useCallback(() => {
      if (treeContainer.current) {
          const { width, height } = treeContainer.current.getBoundingClientRect();
          if (treeOrientation === 'vertical') setTreeTranslate({ x: width / 2, y: 50 });
          else setTreeTranslate({ x: 50, y: height / 2 });
      }
  }, [treeOrientation]);

  useEffect(() => {
      const t = setTimeout(centerTree, 500);
      return () => clearTimeout(t);
  }, [centerTree, graphData, treeOrientation]);

  // ---------------------------------------------------------------------------
  // Interaction
  // ---------------------------------------------------------------------------
  const handleNodeClick = (nodeAttributes: any) => {
      setSelectedNode(nodeAttributes);
      setActiveTab('details');

      const newPath = new Set<string>();
      let currentId = nodeAttributes.id;
      newPath.add(currentId);

      while (currentId && parentMap.has(currentId)) {
          const parentId = parentMap.get(currentId);
          if (parentId) {
              newPath.add(parentId);
              currentId = parentId;
          } else {
              break;
          }
      }
      setPathSet(newPath);
  };

  const clearSelection = () => {
      setSelectedNode(null);
      setPathSet(new Set());
  };

  // ---------------------------------------------------------------------------
  // Renderers
  // ---------------------------------------------------------------------------
  
  // Controls the CSS class of the connecting lines
  const getPathClass = ({ source, target }: any) => {
      if (pathSet.has(target.data.attributes?.id)) {
          return 'link-active'; 
      }
      return 'link-base';
  };

  const renderCustomNode = ({ nodeDatum, toggleNode }: any) => {
      const type = nodeDatum.attributes?.type || 'default';
      const config = NODE_CONFIG[type as keyof typeof NODE_CONFIG] || NODE_CONFIG.default;
      const id = nodeDatum.attributes?.id;
      
      const isSelected = selectedNode?.id === id;
      const isHighlighted = pathSet.has(id);
      
      const charWidth = 8;
      const baseWidth = 40;
      const width = Math.max(140, (nodeDatum.name.length * charWidth) + baseWidth);
      const height = 40;

      return (
        <g onClick={(e) => { e.stopPropagation(); handleNodeClick(nodeDatum.attributes); }}>
          {isHighlighted && (
              <rect width={width + 4} height={height + 4} x={-(width/2) - 2} y={-(height/2) - 2} rx={8} fill={config.color} fillOpacity={0.3} filter="url(#glow)" />
          )}
          <rect 
            width={width} height={height} x={-width/2} y={-height/2} rx={6} 
            fill="#121212" stroke={isSelected ? '#fff' : (isHighlighted ? config.color : '#333')} 
            strokeWidth={isSelected || isHighlighted ? 2 : 1}
            className="cursor-pointer transition-all duration-200"
          />
          <foreignObject x={(-width/2) + 12} y={-8} width={16} height={16} style={{pointerEvents: 'none'}}>
             <config.icon size={16} color={isHighlighted ? '#fff' : config.color} />
          </foreignObject>
          <text 
            fill={isHighlighted ? '#fff' : '#94a3b8'} x={(-width/2) + 36} y={5} strokeWidth="0" fontSize="13" 
            fontWeight={isHighlighted ? "700" : "500"} style={{ fontFamily: 'system-ui, sans-serif', pointerEvents: 'none' }}
          >
            {nodeDatum.name}
          </text>
          {nodeDatum.children && nodeDatum.children.length > 0 && (
              <g onClick={(e) => { e.stopPropagation(); toggleNode(); }} className="cursor-pointer hover:opacity-80">
                  <circle r={8} cx={width/2} cy={0} fill="#222" stroke={isHighlighted ? config.color : "#555"} strokeWidth={1} />
                  <text x={width/2} y={4} textAnchor="middle" fill="#fff" fontSize="12" fontWeight="bold">{nodeDatum.__rd3t.collapsed ? '+' : '-'}</text>
              </g>
          )}
        </g>
      );
  };

  // API Handlers
  const loadGraph = useCallback(async () => { const data = await dexApi.getGraphData(); if(data?.nodes?.length) setGraphData(data); }, []);
  const pollIngestion = useCallback(() => { const i = setInterval(async () => { try { const s = await dexApi.getIngestStatus(); setProgress(s.progress); setStep(s.step); if (s.state === 'completed') { clearInterval(i); setIngesting(false); loadGraph(); } } catch(e) {} }, 1000); }, [loadGraph]);
  useEffect(() => { dexApi.getIngestStatus().then(s => { if(s.state === 'processing' || s.state === 'cloning') { setIngesting(true); pollIngestion(); } }).catch(() => {}); }, [pollIngestion]);
  const handleIngest = async () => { setIngesting(true); setGraphData({ nodes: [], links: [] }); try { await dexApi.triggerIngestion(repoUrl); } catch (err) { setIngesting(false); } pollIngestion(); };
  const handleExecute = async () => { if(!query) return; setLoading(true); const res = await dexApi.queryRAG(query); setRagResult(res.answer); setLoading(false); setActiveTab('assistant'); };

  // ---------------------------------------------------------------------------
  // RENDER
  // ---------------------------------------------------------------------------
  if (!mounted) return null; // FIX: Return null on server to prevent Hydration Error

  return (
    <div className="flex h-screen w-full bg-[#050505] text-slate-200 font-sans selection:bg-indigo-500/30 overflow-hidden">
      
      {/* 1. Global CSS to ensure Lines are Visible */}
      <style jsx global>{`
        /* Default Lines (Inactive) */
        .link-base {
            fill: none;
            stroke: #444;  /* Lighter grey to be visible on black */
            stroke-width: 1.5px;
            transition: all 0.3s ease;
        }
        /* Active Lines (Highlighted) */
        .link-active {
            fill: none;
            stroke: #22d3ee; /* Cyan */
            stroke-width: 2px;
            stroke-dasharray: 5;
            animation: dash 1s linear infinite;
            z-index: 50;
        }
        @keyframes dash {
            to { stroke-dashoffset: -10; }
        }
      `}</style>

      {/* 2. SVG Filters */}
      <svg style={{ position: 'absolute', width: 0, height: 0 }}>
        <defs>
            <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
                <feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge>
            </filter>
        </defs>
      </svg>

      {/* LEFT SIDEBAR */}
      <aside className="w-[400px] min-w-[400px] flex flex-col border-r border-white/5 bg-[#0a0a0a] z-20 shadow-2xl">
        {/* Header */}
        <div className="h-14 flex items-center justify-between px-6 border-b border-white/5 bg-black/20 shrink-0">
            <div className="flex items-center gap-3">
                <div className="p-1.5 bg-indigo-500/10 rounded-lg border border-indigo-500/20"><Terminal className="text-indigo-500" size={16} /></div>
                <h1 className="text-sm font-bold text-white tracking-widest leading-none">DEX<span className="text-slate-600 font-light">TREE</span></h1>
            </div>
            <div className="flex items-center gap-2 px-2 py-1 rounded-full bg-emerald-500/5 border border-emerald-500/10">
                 <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)] animate-pulse" />
                 <span className="text-[10px] text-emerald-500 font-medium uppercase tracking-wider">Online</span>
            </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-white/5 bg-[#0a0a0a]">
            <button onClick={() => setActiveTab('assistant')} className={`flex-1 py-3 text-[10px] font-bold uppercase tracking-widest transition-all border-b-2 ${activeTab === 'assistant' ? 'border-indigo-500 text-white bg-white/5' : 'border-transparent text-slate-500 hover:text-slate-300'}`}>
                <div className="flex items-center justify-center gap-2"><MessageSquare size={12} /> Assistant</div>
            </button>
            <button onClick={() => setActiveTab('details')} className={`flex-1 py-3 text-[10px] font-bold uppercase tracking-widest transition-all border-b-2 ${activeTab === 'details' ? 'border-emerald-500 text-white bg-white/5' : 'border-transparent text-slate-500 hover:text-slate-300'}`}>
                <div className="flex items-center justify-center gap-2"><Info size={12} /> Details</div>
            </button>
        </div>

        {/* Tab 1: Assistant */}
        {activeTab === 'assistant' && (
            <div className="flex-1 flex flex-col min-h-0 animate-in fade-in slide-in-from-left-4 duration-300">
                <div className="p-5 border-b border-white/5 bg-[#0a0a0a]/50 shrink-0 space-y-3">
                    <div className="flex justify-between items-baseline">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Repository URL</label>
                        {step && ingesting && <span className="text-[10px] text-indigo-400 animate-pulse font-mono">{step}</span>}
                    </div>
                    <div className="flex gap-2">
                        <input value={repoUrl} onChange={(e) => setRepoUrl(e.target.value)} className="w-full bg-[#111] border border-white/10 rounded-lg px-3 py-2 text-xs text-slate-300 outline-none focus:border-indigo-500/50 transition-all font-mono" />
                        <button onClick={handleIngest} disabled={ingesting} className="bg-indigo-600 hover:bg-indigo-500 text-white px-3 rounded-lg transition-all flex items-center justify-center shrink-0">
                            {ingesting ? <RefreshCw className="animate-spin" size={14}/> : <RefreshCw size={14}/>}
                        </button>
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto p-5 scrollbar-thin scrollbar-thumb-white/10 bg-[#0c0c0c]">
                    {ragResult ? (
                        <div className="prose prose-invert prose-sm max-w-none text-slate-300 leading-relaxed font-light text-sm"><ReactMarkdown remarkPlugins={[remarkGfm]}>{ragResult}</ReactMarkdown></div>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-slate-800 gap-3 opacity-60"><MessageSquare size={28} /><p className="text-[10px] uppercase tracking-widest">Ready to analyze</p></div>
                    )}
                </div>
                <div className="p-5 border-t border-white/5 bg-[#0a0a0a] shrink-0">
                    <div className="relative group">
                        <textarea value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Ask about structure..." className="w-full bg-[#111] border border-white/10 rounded-xl p-4 pr-12 text-xs text-white focus:border-indigo-500/50 outline-none resize-none h-24 shadow-inner transition-all focus:bg-[#151515]" />
                        <button onClick={handleExecute} disabled={loading || !query} className="absolute right-3 bottom-3 p-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-all shadow-lg">{loading ? <RefreshCw className="animate-spin" size={14}/> : <Play size={14} fill="currentColor"/>}</button>
                    </div>
                </div>
            </div>
        )}

        {/* Tab 2: Details + LEGEND */}
        {activeTab === 'details' && (
            <div className="flex-1 flex flex-col min-h-0 animate-in fade-in slide-in-from-right-4 duration-300">
                {/* Node Inspector */}
                <div className="flex-1 p-5 overflow-y-auto border-b border-white/5">
                    <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2"><Search size={12}/> Inspector</div>
                    {selectedNode ? (
                        <div className="space-y-4">
                            <div className="p-4 rounded-xl bg-gradient-to-br from-white/5 to-white/0 border border-white/10 shadow-sm">
                                <div className="text-[9px] text-indigo-400 font-bold mb-2 uppercase tracking-wider">Active Node</div>
                                <div className="text-sm font-mono text-white break-all">{selectedNode.name || selectedNode.id}</div>
                            </div>
                            <div className="p-3 rounded-lg bg-[#111] border border-white/5">
                                <div className="text-[9px] text-slate-500 mb-1 uppercase">Node Type</div>
                                <div className="text-xs font-bold text-white capitalize flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full" style={{backgroundColor: (NODE_CONFIG[selectedNode.type as keyof typeof NODE_CONFIG] || NODE_CONFIG.default).color}}></div>
                                    {selectedNode.type}
                                </div>
                            </div>
                            <button onClick={handleExecute} className="w-full py-3 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-all flex items-center justify-center gap-2">
                                <Zap size={12} className="text-yellow-400" fill="currentColor"/> Analyze Node
                            </button>
                            <button onClick={clearSelection} className="w-full py-2 bg-transparent hover:bg-white/5 border border-transparent hover:border-white/10 text-slate-500 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-all">
                                Clear Selection
                            </button>
                        </div>
                    ) : (
                        <div className="py-10 flex flex-col items-center justify-center text-slate-700 gap-3 opacity-60">
                            <Search size={28} />
                            <p className="text-[10px] uppercase tracking-widest">Select a node</p>
                        </div>
                    )}
                </div>

                {/* LEGEND SECTION */}
                <div className="h-[40%] flex flex-col bg-[#0a0a0a]">
                    <div className="p-4 border-b border-white/5 bg-[#0f0f0f] shrink-0">
                         <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                            <Layers size={12} className="text-purple-500" /> Legend
                         </span>
                    </div>
                    <div className="flex-1 overflow-y-auto p-2">
                        <table className="w-full text-left border-collapse">
                            <tbody className="divide-y divide-white/5">
                                {Object.entries(NODE_CONFIG).map(([key, config]: any) => (
                                    <tr key={key} className="hover:bg-white/5 transition-colors group cursor-default">
                                        <td className="px-3 py-2.5">
                                            <div className="flex items-center gap-2">
                                                <config.icon size={12} className="text-slate-600" />
                                                <div className="text-[11px] font-bold text-slate-300">{config.label}</div>
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

      {/* MAIN TREE */}
      <main className="flex-1 min-w-0 relative bg-[#050505] cursor-move overflow-hidden" ref={treeContainer}>
        <div className="absolute top-6 left-6 z-10 flex gap-2">
            <div className="p-1 rounded-lg bg-black/60 backdrop-blur-md border border-white/10 flex gap-2">
                <button onClick={() => setTreeOrientation('vertical')} className={`px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all flex items-center gap-2 ${treeOrientation === 'vertical' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}><ChevronDown size={12} /> Vertical</button>
                <button onClick={() => setTreeOrientation('horizontal')} className={`px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all flex items-center gap-2 ${treeOrientation === 'horizontal' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}><ChevronRight size={12} /> Horizontal</button>
                <div className="w-px h-full bg-white/10 mx-1"></div>
                <button onClick={centerTree} className="px-3 py-1.5 text-slate-400 hover:text-white transition-colors flex items-center gap-2" title="Center Tree"><Move size={12} /> Center</button>
            </div>
        </div>

        <div className="w-full h-full">
            {graphData.nodes.length > 0 ? (
                <Tree 
                    data={hierarchyData} 
                    translate={treeTranslate}
                    orientation={treeOrientation}
                    renderCustomNodeElement={renderCustomNode}
                    pathFunc="step" 
                    pathClassFunc={getPathClass} // Apply line classes
                    nodeSize={treeOrientation === 'vertical' ? { x: 220, y: 120 } : { x: 250, y: 80 }} 
                    separation={{ siblings: 1.1, nonSiblings: 1.5 }}
                    enableLegacyTransitions={true}
                    transitionDuration={400}
                    zoomable={true}
                    draggable={true}
                    scaleExtent={{ min: 0.1, max: 1.5 }}
                />
            ) : (
                <div className="flex flex-col items-center justify-center h-full text-slate-700 animate-pulse gap-4">
                    <LayoutTemplate size={48} strokeWidth={1} />
                    <span className="uppercase tracking-widest text-xs">Waiting for Repository...</span>
                </div>
            )}
        </div>
      </main>
    </div>
  );
}