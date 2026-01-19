"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { dexApi, GraphData } from '@/lib/api';
import {
  RefreshCw, Zap, Search, Terminal, MessageSquare,
  Info, Folder, File, Box, Code, Database, FileCode,
  ChevronRight, ChevronDown, Move, LayoutTemplate,
  Play, LogOut, User
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
  folder:   { icon: Folder,   label: 'Directory', color: '#f59e0b' }, // Amber
  file:     { icon: File,     label: 'File',      color: '#3b82f6' }, // Blue
  class:    { icon: Box,      label: 'Class',     color: '#8b5cf6' }, // Violet
  function: { icon: Code,     label: 'Function',  color: '#10b981' }, // Emerald
  module:   { icon: Database, label: 'Module',    color: '#ec4899' }, // Pink
  default:  { icon: FileCode, label: 'Asset',     color: '#64748b' }  // Slate
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

// Build a strict filesystem-style hierarchy:
// ROOT (repository)
//   -> Folder (top-level, from first path segment)
//     -> File (code file, e.g. .py / .ts)
//       -> Function/Class (defined in that file)
const buildHierarchy = (nodes: any[], _links: any[]) => {
    if (!nodes.length) return null;

    const root: any = {
        name: 'Repository',
        attributes: { type: 'root', id: 'root' },
        children: [] as any[],
    };

    const folderMap = new Map<string, any>();
    const fileNodeMap = new Map<string, any>(); // fileId -> tree node

    const allNodes = nodes || [];

    // 1) Attach files under their top-level folder (no folder->folder links)
    allNodes
        .filter((n: any) => (n.type || '').toLowerCase() === 'file')
        .forEach((file: any) => {
            const rawId = String(file.id || '');
            const pathSepIndex = Math.max(rawId.indexOf('/'), rawId.indexOf('\\'));

            const folderName =
                pathSepIndex > 0 ? rawId.slice(0, pathSepIndex) : '__root__';

            let folderNode = folderMap.get(folderName);
            if (!folderNode) {
                folderNode = {
                    name: folderName === '__root__' ? 'root_files' : folderName,
                    attributes: {
                        id: `folder:${folderName}`,
                        type: 'folder',
                    },
                    children: [] as any[],
                };
                folderMap.set(folderName, folderNode);
                root.children.push(folderNode);
            }

            const fileTreeNode: any = {
                name: file.name || rawId,
                attributes: {
                    ...file,
                    id: file.id,
                    type: 'file',
                },
                children: [] as any[],
            };

            folderNode.children.push(fileTreeNode);
            fileNodeMap.set(file.id, fileTreeNode);
        });

    // 2) Attach functions/classes strictly under their defining file
    allNodes
        .filter((n: any) => {
            const t = (n.type || '').toLowerCase();
            return t === 'function' || t === 'class';
        })
        .forEach((fnNode: any) => {
            const rawId = String(fnNode.id || '');
            const fileId = rawId.split('::')[0]; // our ingestion uses file_path::something

            const parentFileTreeNode = fileNodeMap.get(fileId);
            if (!parentFileTreeNode) return; // if we can't find the file, skip to avoid illegal edges

            const childTreeNode: any = {
                name: fnNode.name || rawId,
                attributes: {
                    ...fnNode,
                    id: fnNode.id,
                    type: (fnNode.type || '').toLowerCase(),
                },
                children: [] as any[],
            };

            parentFileTreeNode.children.push(childTreeNode);
        });

    assignBranchColors(root);
    return root;
};

const buildParentMapFromHierarchy = (root: any | null) => {
    const map = new Map<string, string>();
    if (!root) return map;

    const walk = (node: any, parentId: string | null) => {
        const nodeId = node.attributes?.id;
        if (nodeId && parentId) {
            map.set(nodeId, parentId);
        }
        if (Array.isArray(node.children)) {
            node.children.forEach((child: any) => walk(child, nodeId || parentId));
        }
    };

    walk(root, null);
    return map;
};

export default function Dashboard() {
  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------
  const { data: session } = useSession();
  const router = useRouter();
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
  const parentMap = useMemo(
    () => buildParentMapFromHierarchy(hierarchyData),
    [hierarchyData]
  );

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
        if(s.state === 'running') {
            setIngesting(true); pollIngestion();
        } else if(s.state === 'completed') {
            // Load graph data if ingestion is already completed
            loadGraph();
        }
    }).catch(() => {});
    // Also try to load graph data on mount in case there's existing data
    loadGraph();
  }, [pollIngestion, loadGraph]);

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
    void width; void height;

    // 1. Setup Zoom
    const zoom = d3.zoom()
        .scaleExtent([0.1, 3])
        .on("zoom", (event) => {
            g.attr("transform", event.transform);
        });

    svg.call(zoom as any);
    // Clicking on empty space should clear selection & lineage
    svg.on("click", () => {
        setSelectedNode(null);
        setPathSet(new Set());
    });

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
            .data(nodes, (d: any) => d.data.attributes?.id || d.data.id || d.id);

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

        // Add Circle (colored strictly by node type)
        nodeEnter.append("circle")
            .attr("r", 0)
            .attr("fill", (d: any) => {
                const t = d.data.attributes.type;
                if (t === 'root') return '#e5e7eb';
                const cfg = NODE_CONFIG[t] || NODE_CONFIG.default;
                return cfg.color;
            })
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
                // Only select + highlight lineage on node click;
                // chat is triggered explicitly from the sidebar.
                handleNodeClick(d.data.attributes);
            });

        // UPDATE (Transition to new position)
        nodeGroup.merge(nodeEnter as any).transition().duration(500)
            .attr("transform", (d: any) =>
                treeOrientation === 'horizontal'
                ? `translate(${d.y},${d.x})`
                : `translate(${d.x},${d.y})`
            );

        nodeGroup.merge(nodeEnter as any).select("circle")
             .attr("stroke", (d: any) => selectedNode?.id === (d.data.attributes?.id || d.data.id) ? "#fff" : "none")
             .attr("stroke-width", (d: any) => selectedNode?.id === (d.data.attributes?.id || d.data.id) ? 2 : 0)
             .style("filter", (d: any) => {
                const nodeId = d.data.attributes?.id || d.data.id;
                return pathSet.has(nodeId) ? `drop-shadow(0 0 6px ${d.data.attributes.branchColor})` : "none";
             })
             .style("opacity", (d: any) => {
                const nodeId = d.data.attributes?.id || d.data.id;
                return (pathSet.size > 0 && !pathSet.has(nodeId)) ? 0.3 : 1;
             });

        nodeGroup.merge(nodeEnter as any).select("text")
             .style("fill", (d: any) => {
                const nodeId = d.data.attributes?.id || d.data.id;
                return pathSet.has(nodeId) ? "#fff" : "#94a3b8";
             })
             .style("font-weight", (d: any) => {
                const nodeId = d.data.attributes?.id || d.data.id;
                return pathSet.has(nodeId) ? "bold" : "normal";
             })
             .style("opacity", (d: any) => {
                const nodeId = d.data.attributes?.id || d.data.id;
                return (pathSet.size > 0 && !pathSet.has(nodeId)) ? 0.3 : 1;
             });

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
            .data(links, (d: any) => d.target.data?.attributes?.id || d.target.id);

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
            .attr("class", (d: any) => {
                const targetId = d.target.data.attributes?.id || d.target.data.id;
                return pathSet.has(targetId) ? "link link-active" : "link link-base";
            });

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

  }, [hierarchyData, treeOrientation, pathSet, selectedNode, handleNodeClick, centerTree]);


  if (!mounted) return null;

  return (
    <div className="flex h-screen w-full bg-[#050505] text-slate-200 font-sans overflow-hidden relative">
      {/* Dynamic Background Effects */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-indigo-900/10 blur-[150px] rounded-full mix-blend-screen opacity-50"></div>
        <div className="absolute top-[40%] right-[-10%] w-[40%] h-[40%] bg-emerald-900/5 blur-[120px] rounded-full mix-blend-screen opacity-40"></div>
        <div className="absolute bottom-[-20%] left-[20%] w-[60%] h-[40%] bg-violet-900/10 blur-[150px] rounded-full mix-blend-screen opacity-30"></div>
        <div className="absolute inset-0 cyber-grid"></div>
      </div>

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
        
        /* Custom Scrollbar - Matching Home Page Theme */
        ::-webkit-scrollbar {
            width: 8px;
        }
        ::-webkit-scrollbar-track {
            background: #050505;
        }
        ::-webkit-scrollbar-thumb {
            background: #333;
            border-radius: 4px;
        }
        ::-webkit-scrollbar-thumb:hover {
            background: #444;
        }
        
        /* Firefox Scrollbar */
        * {
            scrollbar-width: thin;
            scrollbar-color: #333 #050505;
        }
        
        /* Glass Effects */
        .glass-panel {
            background: rgba(10, 10, 10, 0.6);
            backdrop-filter: blur(12px);
            border: 1px solid rgba(255, 255, 255, 0.08);
        }
        
        /* Cyber Grid Background */
        .cyber-grid {
            background-size: 50px 50px;
            background-image: linear-gradient(to right, rgba(99, 102, 241, 0.03) 1px, transparent 1px),
                            linear-gradient(to bottom, rgba(99, 102, 241, 0.03) 1px, transparent 1px);
            mask-image: radial-gradient(ellipse at center, black 30%, transparent 70%);
        }
      `}} />

      {/* --- SIDEBAR --- */}
      <aside className="w-[400px] min-w-[400px] flex flex-col border-r border-white/5 bg-[#0a0a0a]/80 backdrop-blur-xl z-20 shadow-2xl relative">
        <div className="h-14 flex items-center justify-between px-6 border-b border-white/5 bg-black/20 shrink-0 backdrop-blur-md">
            <div className="flex items-center gap-3">
                <div className="p-1.5 bg-indigo-500/10 rounded-lg border border-indigo-500/20 shadow-[0_0_15px_rgba(99,102,241,0.2)]"><Terminal className="text-indigo-500" size={16} /></div>
                <h1 className="text-sm font-bold text-white tracking-widest leading-none">DEX</h1>
            </div>
            <div className="flex items-center gap-2">
                {session?.user && (
                    <div className="flex items-center gap-2 px-2 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20">
                        <User size={12} className="text-indigo-400" />
                        <span className="text-[10px] text-indigo-300 font-medium max-w-[100px] truncate">
                            {session.user.name || session.user.email}
                        </span>
                    </div>
                )}
                <div className="flex items-center gap-2 px-2 py-1 rounded-full bg-emerald-500/5 border border-emerald-500/10">
                    <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)] animate-pulse" />
                    <span className="text-[10px] text-emerald-500 font-medium uppercase tracking-wider">Online</span>
                </div>
                {session?.user && (
                    <button
                        onClick={() => signOut({ callbackUrl: '/' })}
                        className="p-1.5 rounded-lg bg-white/5 border border-white/10 hover:bg-red-500/10 hover:border-red-500/30 text-slate-400 hover:text-red-400 transition-all"
                        title="Log out"
                    >
                        <LogOut size={14} />
                    </button>
                )}
            </div>
        </div>

        <div className="flex border-b border-white/5 bg-[#0a0a0a]/50 backdrop-blur-sm">
            <button onClick={() => setActiveTab('assistant')} className={`flex-1 py-3 text-[10px] font-bold uppercase tracking-widest transition-all border-b-2 relative ${activeTab === 'assistant' ? 'border-indigo-500 text-white bg-white/5' : 'border-transparent text-slate-500 hover:text-slate-300 hover:bg-white/2'}`}>
                <div className="flex items-center justify-center gap-2">
                    <MessageSquare size={12} /> Assistant
                </div>
            </button>
            <button onClick={() => setActiveTab('details')} className={`flex-1 py-3 text-[10px] font-bold uppercase tracking-widest transition-all border-b-2 relative ${activeTab === 'details' ? 'border-emerald-500 text-white bg-white/5' : 'border-transparent text-slate-500 hover:text-slate-300 hover:bg-white/2'}`}>
                <div className="flex items-center justify-center gap-2">
                    <Info size={12} /> Details
                </div>
            </button>
        </div>

        {activeTab === 'assistant' && (
            <div className="flex-1 flex flex-col min-h-0 animate-in fade-in slide-in-from-left-4 duration-300">
                <div className="p-5 border-b border-white/5 bg-[#0a0a0a]/50 backdrop-blur-sm shrink-0 space-y-3">
                    <div className="flex justify-between items-baseline">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Repository URL</label>
                        {step && ingesting && <span className="text-[10px] text-indigo-400 animate-pulse font-mono">{step}</span>}
                    </div>
                    <div className="flex gap-2">
                        <input 
                            value={repoUrl} 
                            onChange={(e) => setRepoUrl(e.target.value)} 
                            className="w-full bg-[#111] border border-white/10 rounded-lg px-3 py-2 text-xs text-slate-300 outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 transition-all font-mono shadow-inner" 
                            placeholder="https://github.com/..."
                        />
                        <button 
                            onClick={handleIngest} 
                            disabled={ingesting} 
                            className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-3 rounded-lg transition-all flex items-center justify-center shrink-0 shadow-lg hover:shadow-indigo-500/50"
                        >
                            {ingesting ? <RefreshCw className="animate-spin" size={14}/> : <RefreshCw size={14}/>}
                        </button>
                    </div>
                    {/* Enhanced progress bar */}
                    {ingesting && (
                      <div className="space-y-1">
                        <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                          <span>Ingesting…</span>
                          <span>{Math.min(100, Math.max(0, progress))}%</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-white/5 overflow-hidden shadow-inner">
                          <div 
                              className="h-full bg-gradient-to-r from-indigo-500 to-indigo-400 transition-all duration-300 shadow-[0_0_8px_rgba(99,102,241,0.5)]" 
                              style={{ width: `${Math.min(100, Math.max(0, progress))}%` }} 
                          />
                        </div>
                      </div>
                    )}
                </div>
                {/* Enhanced Chat Space - Inspired by Home Page */}
                <div className="flex-1 flex flex-col min-h-0 bg-[#080808] border-b border-white/5">
                    {/* Chat Header */}
                    <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between bg-white/[0.02] shrink-0 backdrop-blur-sm">
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_#10b981] animate-pulse"></div>
                            <span className="text-xs font-bold text-slate-300 tracking-wide">DEX ASSISTANT</span>
                        </div>
                        <Terminal size={12} className="text-slate-600" />
                    </div>
                    
                    {/* Messages Area */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
                        {ragResult ? (
                            <div className="space-y-4">
                                {/* User Message */}
                                {query && (
                                    <div className="flex justify-end">
                                        <div className="bg-indigo-600/20 border border-indigo-500/30 text-indigo-100 px-3 py-2 rounded-l-lg rounded-tr-lg max-w-[85%] shadow-lg">
                                            <p className="text-xs font-medium">{query}</p>
                                        </div>
                                    </div>
                                )}
                                
                                {/* AI Response */}
                                <div className="flex justify-start relative">
                                    <div className="absolute -left-2 top-0 bottom-0 w-1 bg-gradient-to-b from-indigo-500 to-transparent opacity-50"></div>
                                    <div className="pl-3 text-slate-300 max-w-[90%] space-y-2">
                                        <div className="prose prose-invert prose-sm max-w-none text-slate-300 leading-relaxed font-light text-xs">
                                            <ReactMarkdown remarkPlugins={[remarkGfm]}>{ragResult}</ReactMarkdown>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-slate-700 gap-3 opacity-60">
                                <MessageSquare size={32} className="text-slate-600" />
                                <p className="text-[10px] uppercase tracking-widest font-medium">Ready to analyze</p>
                                <p className="text-[9px] text-slate-600 text-center max-w-[200px]">Ask questions about your codebase structure, dependencies, or specific files</p>
                            </div>
                        )}
                    </div>
                </div>
                
                {/* Enhanced Input Area */}
                <div className="p-5 border-t border-white/5 bg-[#0a0a0a]/80 backdrop-blur-sm shrink-0">
                    <div className="relative group">
                        <textarea 
                            value={query} 
                            onChange={(e) => setQuery(e.target.value)} 
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    if (query && !loading) handleExecute();
                                }
                            }}
                            placeholder="Ask about structure, dependencies, or code..." 
                            className="w-full bg-[#111] border border-white/10 rounded-xl p-4 pr-12 text-xs text-white focus:border-indigo-500/50 outline-none resize-none h-24 shadow-inner transition-all focus:bg-[#151515] focus:ring-1 focus:ring-indigo-500/20" 
                        />
                        <button 
                            onClick={() => handleExecute()} 
                            disabled={loading || !query} 
                            className="absolute right-3 bottom-3 p-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-all shadow-lg hover:shadow-indigo-500/50"
                        >
                            {loading ? <RefreshCw className="animate-spin" size={14}/> : <Play size={14} fill="currentColor"/>}
                        </button>
                    </div>
                    {loading && (
                        <div className="mt-2 flex items-center gap-2 text-[10px] text-indigo-400">
                            <RefreshCw className="animate-spin" size={10} />
                            <span>Analyzing codebase...</span>
                        </div>
                    )}
                </div>
            </div>
        )}

        {activeTab === 'details' && (
            <div className="flex-1 flex flex-col min-h-0 animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="flex-1 p-5 overflow-y-auto border-b border-white/5">
                    <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2"><Search size={12}/> Inspector</div>
                    {selectedNode ? (
                        <div className="space-y-4">
                            <div className="p-4 rounded-xl bg-gradient-to-br from-white/5 to-white/0 border border-white/10 shadow-lg backdrop-blur-sm glass-panel">
                                <div className="text-[9px] text-indigo-400 font-bold mb-2 uppercase tracking-wider">Active Node</div>
                                <div className="text-sm font-mono text-white break-all">{selectedNode.name || selectedNode.id}</div>
                            </div>
                            <div className="p-3 rounded-lg bg-[#111] border border-white/5 backdrop-blur-sm">
                                <div className="text-[9px] text-slate-500 mb-1 uppercase">Node Type</div>
                                <div className="text-xs font-bold text-white capitalize flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full shadow-[0_0_4px_currentColor]" style={{backgroundColor: (NODE_CONFIG[selectedNode.type]?.color || NODE_CONFIG.default.color)}}></div>
                                    {selectedNode.type}
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <button
                                  onClick={() => handleNodeChat(selectedNode)}
                                  className="flex-1 py-3 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-all flex items-center justify-center gap-2 shadow-lg hover:shadow-indigo-500/20"
                                >
                                    <Zap size={12} className="text-yellow-400" fill="currentColor"/> Chat About Node
                                </button>
                                <button
                                  onClick={() => { setSelectedNode(null); setPathSet(new Set()); }}
                                  className="px-3 py-3 bg-[#111] hover:bg-[#1f2933] border border-white/10 text-slate-400 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-all hover:border-white/20"
                                >
                                    Clear
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="py-10 flex flex-col items-center justify-center text-slate-700 gap-3 opacity-60">
                            <Search size={28} />
                            <p className="text-[10px] uppercase tracking-widest">Select a node</p>
                        </div>
                    )}
                </div>

                <div className="h-[20%] flex flex-col bg-[#0a0a0a]/80 backdrop-blur-sm border-t border-white/5 p-4">
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                        <LayoutTemplate size={12} />
                        Structure Key
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        {Object.entries(NODE_CONFIG).map(([key, config]: any) => (
                             <div key={key} className="flex items-center gap-2 text-[11px] text-slate-400 hover:text-slate-300 transition-colors p-1.5 rounded hover:bg-white/5">
                                 <span
                                   className="w-2 h-2 rounded-full shadow-[0_0_4px_currentColor]"
                                   style={{ backgroundColor: config.color }}
                                 />
                                 <config.icon size={10} className="text-slate-500" />
                                 <span className="font-medium">{config.label}</span>
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
        <div className="absolute top-6 left-6 z-10 flex gap-3">
            <div className="p-1 rounded-lg bg-black/70 backdrop-blur-md border border-white/10 shadow-xl flex gap-1 glass-panel">
                <button onClick={() => setTreeOrientation('vertical')} className={`px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all flex items-center gap-2 ${treeOrientation === 'vertical' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}><ChevronDown size={12} /> Vert</button>
                <button onClick={() => setTreeOrientation('horizontal')} className={`px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all flex items-center gap-2 ${treeOrientation === 'horizontal' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}><ChevronRight size={12} /> Horz</button>
                <div className="w-px h-full bg-white/10 mx-1"></div>
                <button onClick={centerTree} className="px-3 py-1.5 text-slate-400 hover:text-white hover:bg-white/5 transition-all rounded-md flex items-center gap-2" title="Center Tree"><Move size={12} /> Center</button>
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
                <div className="flex flex-col items-center justify-center h-full text-slate-700 gap-4 relative">
                    <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-64 h-64 bg-indigo-500/5 rounded-full blur-3xl"></div>
                    </div>
                    <div className="relative z-10 flex flex-col items-center gap-4">
                        <div className="p-4 rounded-xl bg-white/5 border border-white/10 backdrop-blur-sm">
                            <LayoutTemplate size={48} strokeWidth={1} className="text-slate-600" />
                        </div>
                        <span className="uppercase tracking-widest text-xs text-slate-500 font-medium">Waiting for Repository...</span>
                        <p className="text-[10px] text-slate-600 text-center max-w-xs">Enter a repository URL above to begin visualization</p>
                    </div>
                </div>
            )}
        </div>
      </main>
    </div>
  );
}

