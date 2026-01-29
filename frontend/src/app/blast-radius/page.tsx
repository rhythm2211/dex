"use client";

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import BlastRadiusGraph from '@/components/BlastRadiusGraph';
import { X, Search, ArrowRight, Code2, GitCommit, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

function BlastRadiusContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [nodeId, setNodeId] = useState<string>('');
  const [inputNodeId, setInputNodeId] = useState<string>('');
  const [isFocused, setIsFocused] = useState(false);

  // Get nodeId from URL query parameter
  useEffect(() => {
    const nodeIdParam = searchParams.get('node');
    if (nodeIdParam) {
      setNodeId(nodeIdParam);
      setInputNodeId(nodeIdParam);
    }
  }, [searchParams]);

  const handleAnalyze = () => {
    if (inputNodeId.trim()) {
      setNodeId(inputNodeId.trim());
      // Update URL without page reload
      router.push(`/blast-radius?node=${encodeURIComponent(inputNodeId.trim())}`);
    }
  };

  const handleClose = () => {
    setNodeId('');
    router.push('/app'); 
  };

  // Mock recent searches for better UX/Utility (Replace with real local storage later)
  const recentSearches = [
    { label: "auth/service.ts", risk: "High", type: "file" },
    { label: "payment_gateway.py::process", risk: "Critical", type: "function" },
    { label: "utils/logger.js", risk: "Low", type: "file" },
  ];

  return (
    <div className="w-full h-screen bg-[#050505] relative overflow-hidden text-gray-200 selection:bg-indigo-500/30 selection:text-indigo-200 font-sans">
      
      {/* Background Ambient Glows */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-indigo-900/20 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-purple-900/10 blur-[120px] rounded-full pointer-events-none" />

      {/* Grid Overlay Pattern */}
      <div className="absolute inset-0 bg-[url('/grid-pattern.svg')] opacity-[0.03] pointer-events-none" />

      <AnimatePresence mode="wait">
        {!nodeId ? (
          // --- 1. SEARCH / INPUT STATE ---
          <motion.div 
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95, filter: "blur(10px)" }}
            transition={{ duration: 0.3 }}
            className="flex items-center justify-center h-full relative z-10"
          >
            <div className="w-full max-w-2xl px-6">
              
              {/* Main Card Container */}
              <div className="bg-[#0f0f11]/80 backdrop-blur-xl border border-white/5 rounded-2xl p-1 shadow-2xl ring-1 ring-white/5">
                <div className="bg-[#0a0a0a] rounded-xl p-8 border border-white/5 relative overflow-hidden group">
                  
                  {/* Subtle Top Highlight */}
                  <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-indigo-500/50 to-transparent opacity-50" />

                  {/* Header Section */}
                  <div className="flex flex-col items-center text-center mb-8 space-y-4">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 flex items-center justify-center border border-white/5 shadow-inner shadow-indigo-500/10 mb-2">
                      <Zap className="w-8 h-8 text-indigo-400 drop-shadow-[0_0_10px_rgba(129,140,248,0.5)]" />
                    </div>
                    <div>
                      <h1 className="text-3xl font-bold text-white tracking-tight">Blast Radius Analysis</h1>
                      <p className="text-gray-400 mt-2 max-w-md mx-auto">
                        Visualize the ripple effect of your code changes. Predict breakage before it happens.
                      </p>
                    </div>
                  </div>

                  {/* Input Section */}
                  <div className="space-y-6 relative">
                    <div className="group/input relative">
                      {/* Animated Gradient Border on Focus */}
                      <div className={`absolute -inset-0.5 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-lg opacity-0 transition duration-500 group-focus-within/input:opacity-30 blur ${isFocused ? 'opacity-40' : ''}`}></div>
                      
                      <div className="relative flex items-center bg-[#151518] rounded-lg border border-white/10 focus-within:border-indigo-500/50 transition-colors">
                        <Search className={`w-5 h-5 ml-4 transition-colors ${isFocused ? 'text-indigo-400' : 'text-gray-600'}`} />
                        <input
                          type="text"
                          value={inputNodeId}
                          onChange={(e) => setInputNodeId(e.target.value)}
                          onFocus={() => setIsFocused(true)}
                          onBlur={() => setIsFocused(false)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleAnalyze();
                          }}
                          placeholder="Search file path or function (e.g., auth/login.ts)"
                          className="w-full bg-transparent border-none px-4 py-4 text-base text-white placeholder-gray-600 focus:outline-none focus:ring-0 font-mono"
                          autoFocus
                        />
                        <div className="mr-3">
                           <kbd className="hidden sm:inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-gray-500 bg-[#1f1f23] border border-white/10 rounded">
                            ENTER
                          </kbd>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={handleAnalyze}
                      disabled={!inputNodeId.trim()}
                      className="w-full group relative overflow-hidden bg-white text-black hover:bg-indigo-50 disabled:bg-gray-800 disabled:text-gray-500 disabled:cursor-not-allowed px-6 py-4 rounded-lg transition-all duration-200 font-semibold flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(255,255,255,0.1)] hover:shadow-[0_0_25px_rgba(129,140,248,0.3)]"
                    >
                      <span className="relative z-10 flex items-center gap-2">
                         Run Impact Analysis <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                      </span>
                    </button>
                  </div>

                  {/* Recent Searches (Utility Feature) */}
                  <div className="mt-8 pt-6 border-t border-white/5">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Recent Hotspots</p>
                    <div className="flex flex-wrap gap-2">
                      {recentSearches.map((item, i) => (
                        <button 
                          key={i}
                          onClick={() => {
                            setInputNodeId(item.label);
                            setNodeId(item.label);
                          }}
                          className="flex items-center gap-2 px-3 py-2 bg-[#151518] hover:bg-[#1f1f23] border border-white/5 hover:border-white/10 rounded-md transition-colors group"
                        >
                          {item.type === 'file' ? <Code2 className="w-3.5 h-3.5 text-blue-400" /> : <GitCommit className="w-3.5 h-3.5 text-purple-400" />}
                          <span className="text-sm text-gray-300 group-hover:text-white font-mono">{item.label}</span>
                          {item.risk === 'Critical' && (
                             <span className="flex h-1.5 w-1.5 rounded-full bg-red-500 shadow-[0_0_5px_rgba(239,68,68,0.8)]" />
                          )}
                        </button>
                      ))}
                    </div>
                  </div>

                </div>
              </div>
              
              {/* Footer text */}
              <p className="text-center text-gray-600 text-sm mt-6 font-mono">
                Powered by <span className="text-indigo-500">Dex GraphRAG</span> • v2.4.0
              </p>

            </div>
          </motion.div>
        ) : (
          // --- 2. GRAPH VIEW STATE ---
          <motion.div 
            key="graph"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            className="w-full h-full relative"
          >
             {/* Floating Header Overlay */}
             <div className="absolute top-0 left-0 w-full h-20 z-50 flex items-center justify-between px-6 bg-gradient-to-b from-black/90 via-black/40 to-transparent pointer-events-none">
                <div className="pointer-events-auto flex items-center gap-4 mt-4">
                  <button 
                    onClick={handleClose}
                    className="p-2 rounded-full bg-black/50 border border-white/10 text-gray-400 hover:text-white hover:bg-white/10 transition-colors backdrop-blur-md group"
                  >
                    <X className="w-5 h-5 group-hover:rotate-90 transition-transform duration-200" />
                  </button>
                  <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20 tracking-wider">ANALYZING IMPACT</span>
                    </div>
                    <h2 className="text-white font-mono text-sm font-medium opacity-90">{nodeId}</h2>
                  </div>
                </div>
             </div>

            <BlastRadiusGraph nodeId={nodeId} onClose={handleClose} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function BlastRadiusPage() {
  return (
    <Suspense fallback={
      <div className="w-full h-screen bg-[#050505] flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 flex items-center justify-center border border-white/5 shadow-inner shadow-indigo-500/10 mb-4 mx-auto animate-pulse">
            <Zap className="w-8 h-8 text-indigo-400" />
          </div>
          <p className="text-gray-400 text-sm">Loading Blast Radius...</p>
        </div>
      </div>
    }>
      <BlastRadiusContent />
    </Suspense>
  );
}