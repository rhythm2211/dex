"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { dexApi, GraphData } from '@/lib/api';
import { 
  RefreshCw, Zap, Search, Terminal, MessageSquare,
  Info, Folder, File, Box, Code, Database, FileCode, 
  ChevronRight, ChevronDown, Move, LayoutTemplate,
  Play
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import * as d3 from 'd3';

// -----------------------------------------------------------------------------
// Visual Config & Color Palette
// -----------------------------------------------------------------------------
const BRANCH_COLORS = [
  '#ef4444', // Red (Server/Core)
  '#f59e0b', // Amber (Client/UI)
  '#8b5cf6', // Violet (Config/Scripts)
  '#ec4899', // Pink
  '#10b981', // Emerald
  '#3b82f6', // Blue
];

const NODE_CONFIG: any = {
  folder:   { icon: Folder, label: 'Directory' },
  file:     { icon: File,   label: 'File' },
  class:    { icon: Box,    label: 'Class' },
  function: { icon: Code,   label: 'Function' },
  module:   { icon: Database, label: 'Module' },
  default:  { icon: FileCode, label: 'Asset' }
};

// -----------------------------------------------------------------------------
// Data Helpers (Graph -> Tree Conversion)
// -----------------------------------------------------------------------------

const assignBranchColors = (node: any, colorIndex = 0, depth = 0) => {
    if (depth === 0 && node.children) {
        node.children.forEach((child: any, index: number) => {
            const color = BRANCH_COLORS[index % BRANCH_COLORS.length];
            child.attributes.branchColor = color;
            assignBranchColors(child, 0, depth + 1);
        });
        return;
    }

    if (node.children) {
        node.children.forEach((child: any) => {
            child.attributes.branchColor = node.attributes.branchColor;
            assignBranchColors(child, 0, depth + 1);
        });
    }
};

const buildHierarchy = (nodes: any[], links: any[]) => {
    if (!nodes.length) return null;

    const nodeMap = new Map();
    nodes.forEach(n => {
        nodeMap.set(n.id, { 
            name: n.name || n.id, 
            attributes: { ...n, type: n.type?.toLowerCase() || 'default' }, 
            children: [] 
        });
    });

    const childrenSet = new Set();
    
    links.forEach(link => {
        const relation = link.relation || link.type;
        // Strict hierarchy relations
        if (relation !== 'CONTAINS' && relation !== 'DEFINES') return;

        const parentId = typeof link.source === 'object' ? link.source.id : link.source;
        const childId = typeof link.target === 'object' ? link.target.id : link.target;

        const parent = nodeMap.get(parentId);
        const child = nodeMap.get(childId);

        if (parent && child && parentId !== childId) {
            if (!childrenSet.has(childId)) { // Prevent cycles/multiple parents for tree
                parent.children.push(child);
                childrenSet.add(childId);
            }
        }
    });

    const roots: any[] = [];
    nodeMap.forEach((val, key) => {
        if (!childrenSet.has(key)) roots.push(val);
    });

    let finalTree;
    if (roots.length === 1) {
        finalTree = roots[0];
    } else {
        finalTree = { 
            name: 'Repository', 
            attributes: { type: 'root', id: 'root' }, 
            children: roots 
        };
    }

    assignBranchColors(finalTree);
    return finalTree;
};

const buildParentMap = (nodes: any[], links: any[]) => {
    const map = new Map<string, string>();
    links.forEach(link => {
        const relation = link.relation || link.type;
        if (relation !== 'CONTAINS' && relation !== 'DEFINES') return;
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
  const [mounted, setMounted] = useState(false);
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
  const [treeOrientation, setTreeOrientation] = useState<'vertical' | 'horizontal'>('horizontal');
  
  // D3 Refs
  const svgRef = useRef<SVGSVGElement>(null);
  const wrapperRef = useRef<SVGGElement>(null);
  // FIX: Define treeContainer ref
  const treeContainer = useRef<HTMLDivElement>(null);

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------
  useEffect(() => { setMounted(true); }, []);

  const hierarchyData = useMemo(() => buildHierarchy(graphData.nodes, graphData.links), [graphData]);
  const parentMap = useMemo(() => buildParentMap(graphData.nodes, graphData.links), [graphData]);

  // ---------------------------------------------------------------------------
  // API
  // ---------------------------------------------------------------------------
  const loadGraph = useCallback(async () => { const data = await dexApi.getGraphData(); if(data?.nodes?.length) setGraphData(data); }, []);
  
  const pollIngestion = useCallback(() => { 
    const i = setInterval(async () => { 
        try { 
            const s = await dexApi.getIngestStatus(); 
            setProgress(s.progress); 
            setStep(s.step); 
            if (s.state === 'completed') { clearInterval(i); setIngesting(false); loadGraph(); } 
        } catch(e) {} 
    }, 1000); 
  }, [loadGraph]);

  useEffect(() => { 
    dexApi.getIngestStatus().then(s => { 
        if(s.state === 'processing' || s.state === 'cloning' || s.state === 'running') { 
            setIngesting(true); pollIngestion(); 
        } 
    }).catch(() => {}); 
  }, [pollIngestion]);

  const handleIngest = async () => { 
      setIngesting(true); setGraphData({ nodes: [], links: [] }); 
      try { await dexApi.triggerIngestion(repoUrl); } catch (err) { setIngesting(false); } 
      pollIngestion(); 
  };
  
  const handleExecute = async (manualQuery?: string) => { 
      const text = manualQuery || query;
      if(!text) return; 
      if(manualQuery) setQuery(manualQuery);
      
      setLoading(true); 
      const res = await dexApi.queryRAG(text); 
      setRagResult(res.answer); setLoading(false); setActiveTab('assistant'); 
  };

  // ---------------------------------------------------------------------------
  // Interaction
  // ---------------------------------------------------------------------------
  const handleNodeClick = useCallback((nodeAttributes: any) => {
      setSelectedNode(nodeAttributes);
      
      const newPath = new Set<string>();
      let currentId = nodeAttributes.id;
      newPath.add(currentId);
      while (currentId && parentMap.has(currentId)) {
          const parentId = parentMap.get(currentId);
          if (parentId) { newPath.add(parentId); currentId = parentId; } 
          else break;
      }
      setPathSet(newPath);
  }, [parentMap]);

  const handleNodeChat = useCallback((nodeAttributes: any) => {
      handleNodeClick(nodeAttributes);
      const prompt = `Explain more about the path to the selected node: "${nodeAttributes.name}"`;
      handleExecute(prompt);
  }, [handleNodeClick]); 

  // ---------------------------------------------------------------------------
  // Custom D3 Implementation
  // ---------------------------------------------------------------------------
  
  const centerTree = useCallback(() => {
    if (svgRef.current) {
        const svg = d3.select(svgRef.current);
        const { width, height } = svgRef.current.getBoundingClientRect();
        
        const transform = d3.zoomIdentity.translate(width / 4, height / 2).scale(0.8);
        svg.transition().duration(750).call(d3.zoom().transform as any, transform);
    }
  }, []);

  useEffect(() => {
    if (!hierarchyData || !svgRef.current || !wrapperRef.current) return;

    const svg = d3.select(svgRef.current);
    const g = d3.select(wrapperRef.current);
    const { width, height } = svgRef.current.getBoundingClientRect();

    // 1. Setup Zoom
    const zoom = d3.zoom()
        .scaleExtent([0.1, 3])
        .on("zoom", (event) => {
            g.attr("transform", event.transform);
        });

    svg.call(zoom as any);

    // 2. Setup Tree Layout
    const root = d3.hierarchy(hierarchyData);
    
    // Node size: [height, width] for horizontal
    const nodeWidth = 220; 
    const nodeHeight = 50;
    
    const treeLayout = d3.tree().nodeSize(
        treeOrientation === 'horizontal' 
        ? [nodeHeight, nodeWidth] 
        : [nodeWidth, nodeHeight]
    );

    // 3. Update Function
    const update = (source: any) => {
        const treeData = treeLayout(root);
        const nodes = treeData.descendants();
        const links = treeData.links();

        // --- Nodes ---
        const nodeGroup = g.selectAll(".node")
            .data(nodes, (d: any) => d.data.id || d.id);

        const nodeEnter = nodeGroup.enter().append("g")
            .attr("class", "node cursor-pointer")
            .attr("transform", (d: any) => {
                const x = source.y0 || source.y; 
                const y = source.x0 || source.x;
                return treeOrientation === 'horizontal' 
                    ? `translate(${y},${x})` 
                    : `translate(${x},${y})`;
            })
            .on("click", (event, d: any) => {
                event.stopPropagation();
                if (d.children) {
                    d._children = d.children;
                    d.children = null;
                } else {
                    d.children = d._children;
                    d._children = null;
                }
                update(d);
            });

        // Add Circle
        nodeEnter.append("circle")
            .attr("r", 0) 
            .attr("fill", (d: any) => d.data.attributes.type === 'root' ? '#fff' : (d.data.attributes.branchColor || '#666'))
            .attr("stroke", (d: any) => d.data.attributes.type === 'root' ? '#000' : 'none')
            .transition().duration(500)
            .attr("r", (d: any) => d.data.attributes.type === 'root' ? 8 : 5);

        // Add Text
        nodeEnter.append("text")
            .attr("dy", "0.31em")
            .attr("x", (d: any) => d.children || d._children ? -10 : 10)
            .attr("text-anchor", (d: any) => d.children || d._children ? "end" : "start")
            .text((d: any) => d.data.name)
            .style("fill-opacity", 0)
            .style("font-size", "12px")
            .style("fill", "#94a3b8")
            .style("font-family", "system-ui")
            .transition().duration(500)
            .style("fill-opacity", 1);
            
        // Add "Chat" Action Icon
        nodeEnter.append("circle")
            .attr("r", 15)
            .attr("fill", "transparent")
            .on("click", (e, d: any) => {
                e.stopPropagation();
                handleNodeChat(d.data.attributes);
            });

        // UPDATE (Transition to new position)
        const nodeUpdate = nodeGroup.merge(nodeEnter as any).transition().duration(500)
            .attr("transform", (d: any) => 
                treeOrientation === 'horizontal' 
                ? `translate(${d.y},${d.x})` 
                : `translate(${d.x},${d.y})`
            );

        nodeGroup.merge(nodeEnter as any).select("circle")
             .attr("stroke", (d: any) => selectedNode?.id === d.data.id ? "#fff" : "none")
             .attr("stroke-width", (d: any) => selectedNode?.id === d.data.id ? 2 : 0)
             .style("filter", (d: any) => pathSet.has(d.data.id) ? `drop-shadow(0 0 6px ${d.data.attributes.branchColor})` : "none")
             .style("opacity", (d: any) => (pathSet.size > 0 && !pathSet.has(d.data.id)) ? 0.3 : 1);
        
        nodeGroup.merge(nodeEnter as any).select("text")
             .style("fill", (d: any) => pathSet.has(d.data.id) ? "#fff" : "#94a3b8")
             .style("font-weight", (d: any) => pathSet.has(d.data.id) ? "bold" : "normal")
             .style("opacity", (d: any) => (pathSet.size > 0 && !pathSet.has(d.data.id)) ? 0.3 : 1);


        // EXIT
        nodeGroup.exit().transition().duration(500)
            .attr("transform", (d: any) => 
                treeOrientation === 'horizontal' 
                ? `translate(${source.y},${source.x})` 
                : `translate(${source.x},${source.y})`
            )
            .remove();

        // --- Links ---
        const linkGroup = g.selectAll(".link")
            .data(links, (d: any) => d.target.id);

        const linkEnter = linkGroup.enter().insert("path", "g")
            .attr("class", "link")
            .attr("fill", "none")
            .attr("stroke", "#333")
            .attr("stroke-width", 1.5)
            .attr("d", (d: any) => {
                const o = { x: source.x0 || source.x, y: source.y0 || source.y };
                return diagonal(o, o);
            });

        const linkUpdate = linkGroup.merge(linkEnter as any);

        linkUpdate.transition().duration(500)
            .attr("d", (d: any) => diagonal(d.source, d.target))
            .attr("stroke", (d: any) => d.target.data.attributes.branchColor || "#333")
            .attr("class", (d: any) => pathSet.has(d.target.data.id) ? "link link-active" : "link link-base");

        linkGroup.exit().transition().duration(500)
            .attr("d", (d: any) => {
                const o = { x: source.x, y: source.y };
                return diagonal(o, o);
            })
            .remove();

        // Stash the old positions for transition.
        nodes.forEach((d: any) => {
            d.x0 = d.x;
            d.y0 = d.y;
        });
    };

    // Helper for Diagonal Paths
    const diagonal = (s: any, d: any) => {
        if (treeOrientation === 'horizontal') {
            return `M ${s.y} ${s.x}
                    C ${(s.y + d.y) / 2} ${s.x},
                      ${(s.y + d.y) / 2} ${d.x},
                      ${d.y} ${d.x}`;
        } else {
            return `M ${s.x} ${s.y}
                    C ${s.x} ${(s.y + d.y) / 2},
                      ${d.x} ${(s.y + d.y) / 2},
                      ${d.x} ${d.y}`;
        }
    };

    // Initial Update
    if(root) {
        centerTree();
        update(root);
    }
    
  }, [hierarchyData, treeOrientation, pathSet, selectedNode, handleNodeChat, centerTree]);


  if (!mounted) return null;

  return (
    <div className="flex h-screen w-full bg-[#050505] text-slate-200 font-sans overflow-hidden">
      
      <style dangerouslySetInnerHTML={{__html: `
        .link-base {
            fill: none;
            stroke-width: 1.5px;
            transition: stroke 0.5s ease, opacity 0.5s ease;
            opacity: 0.4;
        }
        .link-active {
            fill: none;
            stroke-width: 2px;
            stroke-dasharray: 8;
            animation: flow 1s linear infinite;
            opacity: 1;
        }
        @keyframes flow {
            from { stroke-dashoffset: 16; }
            to { stroke-dashoffset: 0; }
        }
        .node text {
            text-shadow: 0 1px 3px rgba(0,0,0,0.8);
        }
      `}} />
      
      {/* --- SIDEBAR --- */}
      <aside className="w-[400px] min-w-[400px] flex flex-col border-r border-white/5 bg-[#0a0a0a] z-20 shadow-2xl">
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

        <div className="flex border-b border-white/5 bg-[#0a0a0a]">
            <button onClick={() => setActiveTab('assistant')} className={`flex-1 py-3 text-[10px] font-bold uppercase tracking-widest transition-all border-b-2 ${activeTab === 'assistant' ? 'border-indigo-500 text-white bg-white/5' : 'border-transparent text-slate-500 hover:text-slate-300'}`}>
                <div className="flex items-center justify-center gap-2"><MessageSquare size={12} /> Assistant</div>
            </button>
            <button onClick={() => setActiveTab('details')} className={`flex-1 py-3 text-[10px] font-bold uppercase tracking-widest transition-all border-b-2 ${activeTab === 'details' ? 'border-emerald-500 text-white bg-white/5' : 'border-transparent text-slate-500 hover:text-slate-300'}`}>
                <div className="flex items-center justify-center gap-2"><Info size={12} /> Details</div>
            </button>
        </div>

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
                        <button onClick={() => handleExecute()} disabled={loading || !query} className="absolute right-3 bottom-3 p-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-all shadow-lg">{loading ? <RefreshCw className="animate-spin" size={14}/> : <Play size={14} fill="currentColor"/>}</button>
                    </div>
                </div>
            </div>
        )}

        {activeTab === 'details' && (
            <div className="flex-1 flex flex-col min-h-0 animate-in fade-in slide-in-from-right-4 duration-300">
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
                                    <div className="w-2 h-2 rounded-full" style={{backgroundColor: selectedNode.branchColor || '#fff'}}></div>
                                    {selectedNode.type}
                                </div>
                            </div>
                            <button onClick={() => handleNodeChat(selectedNode)} className="w-full py-3 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-all flex items-center justify-center gap-2">
                                <Zap size={12} className="text-yellow-400" fill="currentColor"/> Chat About Node
                            </button>
                        </div>
                    ) : (
                        <div className="py-10 flex flex-col items-center justify-center text-slate-700 gap-3 opacity-60">
                            <Search size={28} />
                            <p className="text-[10px] uppercase tracking-widest">Select a node</p>
                        </div>
                    )}
                </div>
                
                <div className="h-[20%] flex flex-col bg-[#0a0a0a] border-t border-white/5 p-4">
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Structure Key</div>
                    <div className="grid grid-cols-2 gap-2">
                        {Object.entries(NODE_CONFIG).map(([key, config]: any) => (
                             <div key={key} className="flex items-center gap-2 text-[11px] text-slate-500">
                                 <config.icon size={10} /> {config.label}
                             </div>
                        ))}
                    </div>
                </div>
            </div>
        )}
      </aside>

      {/* --- GRAPH AREA --- */}
      <main className="flex-1 min-w-0 relative bg-[#050505] cursor-move overflow-hidden" ref={treeContainer}>
        {/* Graph Controls */}
        <div className="absolute top-6 left-6 z-10 flex gap-2">
            <div className="p-1 rounded-lg bg-black/60 backdrop-blur-md border border-white/10 flex gap-2">
                <button onClick={() => setTreeOrientation('vertical')} className={`px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all flex items-center gap-2 ${treeOrientation === 'vertical' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}><ChevronDown size={12} /> Vert</button>
                <button onClick={() => setTreeOrientation('horizontal')} className={`px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all flex items-center gap-2 ${treeOrientation === 'horizontal' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}><ChevronRight size={12} /> Horz</button>
                <div className="w-px h-full bg-white/10 mx-1"></div>
                <button onClick={centerTree} className="px-3 py-1.5 text-slate-400 hover:text-white transition-colors flex items-center gap-2" title="Center Tree"><Move size={12} /> Center</button>
            </div>
        </div>

        {/* The D3 Tree */}
        <div className="w-full h-full relative">
            {graphData.nodes.length > 0 ? (
                <svg 
                    ref={svgRef} 
                    className="w-full h-full block"
                    viewBox="0 0 1000 800"
                >
                    <g ref={wrapperRef} />
                </svg>
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