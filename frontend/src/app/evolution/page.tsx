"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import Link from 'next/link';
import AppShell from '@/components/AppShell';
import { dexApi, GraphData, CommitNode } from '@/lib/api';
import { 
  Play, Pause, ChevronLeft, ChevronRight, 
  GitCommit, Clock, User, Calendar, 
  ArrowLeft, Layers, Zap, XCircle 
} from 'lucide-react';
import dynamic from 'next/dynamic';
import SpriteText from 'three-spritetext';
import * as THREE from 'three';

// Dynamic Import for 3D Graph
const ForceGraph3D = dynamic(() => import('react-force-graph-3d'), { ssr: false });

// --- Color Palette for Authors (Blame Mode) ---
const AUTHOR_COLORS = [
  '#3b82f6', // Blue
  '#ef4444', // Red
  '#10b981', // Emerald
  '#f59e0b', // Amber
  '#8b5cf6', // Violet
  '#ec4899', // Pink
  '#06b6d4', // Cyan
];

export default function EvolutionPage() {
  // --- State ---
  const [graphData, setGraphData] = useState<GraphData>({ nodes: [], links: [] });
  const [history, setHistory] = useState<CommitNode[]>([]);
  const [currentCommitIdx, setCurrentCommitIdx] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [viewMode, setViewMode] = useState<'blame' | 'impact'>('blame');
  const [selectedNode, setSelectedNode] = useState<any>(null);
  
  // Impact Mode State
  const [impactGraph, setImpactGraph] = useState<GraphData | null>(null);

  const graphRef = useRef<any>(null);

  // --- 1. Load Data ---
  useEffect(() => {
    async function init() {
      const [gData, hData] = await Promise.all([
        dexApi.getGraphData(),
        dexApi.getGitHistory()
      ]);
      setGraphData(gData);
      // Reverse history so index 0 is the oldest commit (Start of time)
      setHistory(hData.reverse()); 
    }
    init();
  }, []);

  // --- 2. Playback Logic ---
  useEffect(() => {
    let interval: NodeJS.Timeout | undefined;
    if (isPlaying) {
      interval = setInterval(() => {
        setCurrentCommitIdx(prev => {
          if (prev >= history.length - 1) {
            setIsPlaying(false);
            return prev;
          }
          return prev + 1;
        });
      }, 150); // Speed of playback
    }
    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [isPlaying, history.length]);

  // --- 3. Compute Visuals ---
  const currentCommit = history[currentCommitIdx];

  // Helper: Assign colors to authors deterministically
  const getAuthorColor = (author: string) => {
    if (!author) return '#475569';
    let hash = 0;
    for (let i = 0; i < author.length; i++) hash = author.charCodeAt(i) + ((hash << 5) - hash);
    const index = Math.abs(hash) % AUTHOR_COLORS.length;
    return AUTHOR_COLORS[index];
  };

  // --- 4. Node Coloring Logic ---
  const getNodeColor = useCallback((node: any) => {
    // A. IMPACT MODE
    if (viewMode === 'impact' && impactGraph) {
      const isInImpact = impactGraph.nodes.find(n => n.id === node.id);
      return isInImpact ? '#ef4444' : '#1a1a1a'; // Red for danger, dark for safe
    }

    // B. BLAME / EVOLUTION MODE
    if (currentCommit) {
      // Check if this file was changed in the current commit
      // Note: commit.files usually has full paths, node.id might be relative. 
      // We do a loose includes check.
      const isChanged = currentCommit.files.some(f => node.id.includes(f));
      
      if (isChanged) return '#ffffff'; // FLASH WHITE on change
    }

    // Default: Color by Author (Blame)
    return getAuthorColor(node.last_author);
  }, [currentCommit, viewMode, impactGraph]);

  const getNodeVal = useCallback((node: any) => {
    if (viewMode === 'impact' && impactGraph) {
      return impactGraph.nodes.find(n => n.id === node.id) ? 10 : 1;
    }
    return node.val || 5;
  }, [viewMode, impactGraph]);

  // --- 5. Interaction Handlers ---
  const handleNodeClick = async (node: any) => {
    setSelectedNode(node);
    
    // Switch to Impact Mode automatically
    setViewMode('impact');
    
    // Fetch Blast Radius
    const impactData = await dexApi.getImpactGraph(node.id);
    setImpactGraph(impactData);

    // Focus Camera
    if (graphRef.current) {
        const distance = 100;
        const distRatio = 1 + distance/Math.hypot(node.x, node.y, node.z);
        graphRef.current.cameraPosition(
          { x: node.x * distRatio, y: node.y * distRatio, z: node.z * distRatio },
          node,
          1000
        );
    }
  };

  const clearImpactMode = () => {
    setViewMode('blame');
    setImpactGraph(null);
    setSelectedNode(null);
  };

  // Node three object function - must always return Object3D
  const getNodeThreeObject = useCallback((node: any): THREE.Object3D => {
    const shouldShowLabel = node.type === 'folder' || node.val > 10 || (currentCommit?.files.some(f => node.id.includes(f)));
    
    if (shouldShowLabel) {
      const sprite = new SpriteText(node.name);
      sprite.color = getNodeColor(node);
      sprite.textHeight = 4;
      // Type assertion: SpriteText extends THREE.Sprite which has position
      (sprite as any).position.set(0, -12, 0);
      return sprite as THREE.Object3D;
    }
    
    // Always return an Object3D - use empty group when label is not needed
    return new THREE.Group();
  }, [currentCommit, getNodeColor]);

  return (
    <AppShell variant="fullBleed">
    <div className="flex h-full w-full min-h-0 bg-[#050505] text-slate-200 overflow-hidden">
      
      {/* --- SIDEBAR: EVOLUTION DETAILS --- */}
      <aside className="w-[350px] flex flex-col border-r border-white/5 bg-[#0a0a0a] z-20">
        <div className="h-14 flex items-center gap-3 px-6 border-b border-white/5">
            <Link href="/app" className="p-1.5 rounded-lg hover:bg-white/10 transition-colors">
                <ArrowLeft size={16} className="text-slate-400"/>
            </Link>
            <h1 className="text-sm font-bold text-white tracking-widest uppercase">Time Travel</h1>
        </div>

        {/* Current Commit Info Card */}
        <div className="flex-1 p-6 overflow-y-auto">
            {currentCommit ? (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
                    
                    {/* Date Badge */}
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-[10px] font-bold uppercase tracking-wider">
                        <Calendar size={12} />
                        {new Date(currentCommit.date).toLocaleDateString()}
                    </div>

                    {/* Commit Message */}
                    <div>
                        <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-2">Commit Message</div>
                        <div className="text-lg font-light text-white leading-relaxed">
                            "{currentCommit.msg}"
                        </div>
                    </div>

                    {/* Meta Grid */}
                    <div className="grid grid-cols-2 gap-3">
                        <div className="p-3 rounded-lg bg-[#111] border border-white/5">
                            <div className="flex items-center gap-2 text-[10px] text-slate-500 uppercase mb-1">
                                <User size={12}/> Author
                            </div>
                            <div className="text-xs font-bold text-white truncate" style={{color: getAuthorColor(currentCommit.author)}}>
                                {currentCommit.author}
                            </div>
                        </div>
                        <div className="p-3 rounded-lg bg-[#111] border border-white/5">
                            <div className="flex items-center gap-2 text-[10px] text-slate-500 uppercase mb-1">
                                <GitCommit size={12}/> Hash
                            </div>
                            <div className="text-xs font-mono text-slate-400 truncate">
                                {currentCommit.hash.substring(0, 7)}
                            </div>
                        </div>
                    </div>

                    {/* Changes List */}
                    <div>
                        <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-3 flex items-center justify-between">
                            <span>Affected Files</span>
                            <span className="px-1.5 py-0.5 rounded bg-white/10 text-white text-[9px]">{currentCommit.files.length}</span>
                        </div>
                        <div className="space-y-1 max-h-[300px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-white/10">
                            {currentCommit.files.map((f, i) => (
                                <div key={i} className="text-xs text-slate-400 font-mono py-1 px-2 rounded hover:bg-white/5 truncate">
                                    {f}
                                </div>
                            ))}
                        </div>
                    </div>

                </div>
            ) : (
                <div className="flex flex-col items-center justify-center h-full text-slate-600 gap-4 opacity-50">
                    <Clock size={32} />
                    <span className="text-xs font-bold uppercase tracking-widest">Loading History...</span>
                </div>
            )}
        </div>
      </aside>

      {/* --- MAIN: 3D GRAPH --- */}
      <main className="flex-1 relative bg-black flex flex-col">
        
        {/* IMPACT MODE BANNER */}
        {viewMode === 'impact' && (
            <div className="absolute top-6 left-6 z-10 animate-in fade-in slide-in-from-top-4">
                <div className="px-4 py-3 rounded-xl bg-red-950/80 backdrop-blur-md border border-red-500/30 shadow-2xl flex items-center gap-4">
                    <div>
                        <div className="text-[10px] font-bold text-red-400 uppercase tracking-widest flex items-center gap-2">
                            <Zap size={12} fill="currentColor"/> Impact Radar Active
                        </div>
                        <div className="text-xs text-red-200 mt-1">
                            Showing blast radius for <span className="font-mono font-bold">{selectedNode?.name}</span>
                        </div>
                    </div>
                    <button onClick={clearImpactMode} className="p-2 hover:bg-red-900/50 rounded-lg transition-colors text-red-300">
                        <XCircle size={16} />
                    </button>
                </div>
            </div>
        )}

        <div className="flex-1 w-full h-full">
            <ForceGraph3D
                ref={graphRef}
                graphData={graphData}
                backgroundColor="#050505"
                
                // Visuals
                nodeColor={getNodeColor}
                nodeVal={getNodeVal}
                nodeRelSize={6}
                nodeResolution={16}
                nodeOpacity={1}
                
                // Links
                linkColor={() => viewMode === 'impact' ? '#333' : '#222'}
                linkWidth={viewMode === 'impact' ? 1 : 0.5}
                
                // Interaction
                onNodeClick={handleNodeClick}
                
                // Labels (Only show important ones to reduce clutter)
                nodeThreeObject={getNodeThreeObject}
            />
        </div>

        {/* --- BOTTOM: TIMELINE PLAYER --- */}
        <div className="h-24 bg-[#0a0a0a] border-t border-white/5 px-6 flex items-center gap-6 z-20">
            
            {/* Controls */}
            <button 
                onClick={() => setIsPlaying(!isPlaying)}
                className="w-12 h-12 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white flex items-center justify-center transition-all shadow-lg hover:shadow-indigo-500/25 shrink-0"
            >
                {isPlaying ? <Pause size={20} fill="currentColor"/> : <Play size={20} fill="currentColor" className="ml-1"/>}
            </button>

            {/* Slider Track */}
            <div className="flex-1 flex flex-col gap-2">
                <div className="flex justify-between text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                    <span>Project Start</span>
                    <span>Present Day</span>
                </div>
                <input 
                    type="range" 
                    min={0} 
                    max={Math.max(0, history.length - 1)} 
                    value={currentCommitIdx}
                    onChange={(e) => {
                        setIsPlaying(false);
                        setCurrentCommitIdx(parseInt(e.target.value));
                    }}
                    className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500 hover:accent-indigo-400"
                />
                <div className="text-center text-xs font-mono text-indigo-400">
                    Commit {currentCommitIdx + 1} / {history.length}
                </div>
            </div>

            {/* Step Controls */}
            <div className="flex gap-2">
                <button onClick={() => setCurrentCommitIdx(c => Math.max(0, c - 1))} className="p-2 rounded-lg bg-[#111] hover:bg-white/10 text-slate-400 border border-white/5 transition-colors">
                    <ChevronLeft size={16}/>
                </button>
                <button onClick={() => setCurrentCommitIdx(c => Math.min(history.length - 1, c + 1))} className="p-2 rounded-lg bg-[#111] hover:bg-white/10 text-slate-400 border border-white/5 transition-colors">
                    <ChevronRight size={16}/>
                </button>
            </div>
        </div>
      </main>
    </div>
    </AppShell>
  );
}