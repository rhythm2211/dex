'use client';

import { useCallback, useMemo, useState } from 'react';
import { Loader2, Search, Sparkles, X, Focus, Layers, ChevronRight, Crosshair, Link2 } from 'lucide-react';
import { dexApi, type BridgeGraphNode, type SubgraphResponse, type SymbolReferencesResponse } from '@/lib/api';
import { AnimatedButton } from '@/components/ui/animated-button';
import FocusedGraphCanvas from '@/lib/subgraph-viewer/FocusedGraphCanvas';
import { LAYER_ORDER, LAYER_COLORS } from '@/lib/subgraph-viewer/constants';

const SUGGESTIONS = [
  'authentication flow',
  'payment processing',
  'API routes',
  'data pipeline',
  'user management',
  'database models',
];

const LAYER_LABELS: Record<string, string> = {
  api:     'API',
  service: 'Services',
  data:    'Data',
  ui:      'UI',
  util:    'Utils',
};

export interface FocusedGraphPanelProps {
  repoReady: boolean;
  ingesting: boolean;
}

export default function FocusedGraphPanel({ repoReady, ingesting }: FocusedGraphPanelProps) {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<SubgraphResponse | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [focusNodeId, setFocusNodeId] = useState<string | null>(null);
  const [layoutKey, setLayoutKey] = useState(0);
  const [activeLayer, setActiveLayer] = useState<string | null>(null);
  const [refsData, setRefsData] = useState<SymbolReferencesResponse | null>(null);
  const [refsLoading, setRefsLoading] = useState(false);
  const [refsError, setRefsError] = useState<string | null>(null);

  const selectedNode: BridgeGraphNode | null = useMemo(() => {
    if (!data || !selectedNodeId) return null;
    return data.nodes.find((n) => n.id === selectedNodeId) ?? null;
  }, [data, selectedNodeId]);

  const runSearch = useCallback(async (q: string, layer?: string | null) => {
    const trimmed = q.trim();
    if (!trimmed && !layer) return;
    setLoading(true);
    setError(null);
    setFocusNodeId(null);
    setSelectedNodeId(null);
    try {
      const result = await dexApi.postSubgraph({
        query: trimmed,
        depth: 2,
        max_nodes: 150,
        seed_k: 20,
        layer: layer ?? null,
        include_functions: true,
      });
      setData(result);
      setLayoutKey((k) => k + 1);
      if (result.nodes.length === 0) {
        setError(
          result.meta?.reason === 'error'
            ? 'Subgraph search failed on the server. Restart the backend and try again.'
            : `Nothing matched "${trimmed || layer}". Try a broader term — e.g. "auth", "payment", "api".`
        );
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to build subgraph';
      setError(msg);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    runSearch(query, activeLayer);
  };

  const toggleLayer = (lid: string) => {
    const next = activeLayer === lid ? null : lid;
    setActiveLayer(next);
    runSearch(query, next);
  };

  const loadSymbolRefs = useCallback(async (node: BridgeGraphNode) => {
    const sym = node.id || node.name;
    if (!sym) return;
    setRefsLoading(true);
    setRefsError(null);
    setRefsData(null);
    try {
      const data = await dexApi.getSymbolReferences(sym, 30);
      setRefsData(data);
    } catch (e: unknown) {
      setRefsError(e instanceof Error ? e.message : 'Failed to load references');
    } finally {
      setRefsLoading(false);
    }
  }, []);

  const goToDefinition = useCallback(async (node: BridgeGraphNode) => {
    const sym = node.id || node.name;
    if (!sym) return;
    try {
      const def = await dexApi.getSymbolDefinition(sym);
      if (def?.file_path) {
        setRefsError(null);
        setRefsData({ symbol: sym, definition: def, references: [] });
      }
    } catch {
      setRefsError('Definition not found in graph index');
    }
  }, []);

  const toggleFocusNeighborhood = () => {
    if (!selectedNodeId) return;
    setFocusNodeId((prev) => (prev === selectedNodeId ? null : selectedNodeId));
    setLayoutKey((k) => k + 1);
  };

  if (!repoReady) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-slate-600 gap-4 px-6">
        <Sparkles size={36} className="text-indigo-500/30" />
        <p className="text-sm text-center max-w-sm text-slate-500">
          {ingesting
            ? 'Index is building — come back once ingestion finishes.'
            : 'Index a repository to explore focused subgraphs.'}
        </p>
      </div>
    );
  }

  const layerLegend = data?.layers?.length
    ? data.layers
    : LAYER_ORDER.map((id) => ({ id, name: LAYER_LABELS[id] || id, color: LAYER_COLORS[id] || '#475569', nodeIds: [] as string[] }));

  return (
    <div className="flex flex-col h-full w-full" style={{ background: 'var(--bg-base)' }}>
      {/* ── Search bar ── */}
      <div className="shrink-0 border-b" style={{ borderColor: 'var(--border)', background: 'rgba(8,8,20,0.6)' }}>
        <form onSubmit={onSubmit} className="flex items-center gap-2 px-4 py-2.5">
          <Search size={14} className="flex-shrink-0" style={{ color: 'var(--text-muted)' }} />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Describe a feature — auth flow, payment, API routes…"
            className="flex-1 min-w-0 bg-transparent text-[13px] text-slate-200 focus:outline-none placeholder:text-slate-600 font-mono"
            disabled={loading}
          />
          <button
            type="submit"
            disabled={loading || (!query.trim() && !activeLayer)}
            className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed text-white"
            style={{ background: 'rgba(124,106,247,0.8)' }}
          >
            {loading
              ? <Loader2 size={12} className="animate-spin" />
              : <><ChevronRight size={12} /> Explore</>
            }
          </button>
        </form>

        {/* Layer filter chips */}
        <div className="flex items-center gap-1.5 px-4 pb-2">
          {Object.entries(LAYER_LABELS).map(([id, label]) => {
            const color = LAYER_COLORS[id] || '#475569';
            const active = activeLayer === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => toggleLayer(id)}
                className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium transition-all"
                style={{
                  background: active ? `${color}22` : 'var(--bg-surface)',
                  border: `1px solid ${active ? color + '60' : 'var(--border)'}`,
                  color: active ? color : 'var(--text-muted)',
                }}
              >
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: active ? color : '#475569' }} />
                {label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-1 min-h-0 relative">
        {/* ── Canvas ── */}
        <div className="flex-1 min-w-0 relative">

          {/* Empty state */}
          {!data && !loading && !error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 px-8 z-10 pointer-events-none">
              <div className="flex flex-col items-center gap-2">
                <Sparkles size={28} className="text-indigo-500/40" />
                <p className="text-[13px] text-slate-500 text-center max-w-xs leading-relaxed">
                  Search a feature or pick a layer — e.g.{' '}
                  <span className="text-slate-400 italic">authentication flow</span>,{' '}
                  <span className="text-slate-400 italic">payment processing</span>.
                </p>
              </div>
              <div className="flex flex-wrap gap-2 justify-center pointer-events-auto">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => { setQuery(s); runSearch(s, activeLayer); }}
                    className="text-[11px] px-3 py-1 rounded-full border border-white/[0.08] bg-white/[0.03] text-slate-500 hover:text-slate-200 hover:border-indigo-500/40 hover:bg-indigo-500/[0.07] transition-all"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Error */}
          {error && !loading && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 max-w-md px-4 py-2 rounded-lg bg-amber-950/70 border border-amber-500/20 text-xs text-amber-200/80 text-center">
              {error}
            </div>
          )}

          {/* Focus mode pill */}
          {focusNodeId && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20">
              <button
                type="button"
                onClick={() => { setFocusNodeId(null); setLayoutKey((k) => k + 1); }}
                className="px-3 py-1.5 rounded-full bg-black/80 border border-amber-500/30 text-amber-300/80 text-[11px] font-medium flex items-center gap-1.5 hover:border-amber-400/50 transition-colors"
              >
                Neighborhood view <X size={10} />
              </button>
            </div>
          )}

          {/* Loading overlay */}
          {loading && (
            <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-[#0a0b0f]/70 backdrop-blur-sm gap-3">
              <Loader2 size={24} className="animate-spin text-indigo-400" />
              <p className="text-[11px] text-slate-500 uppercase tracking-widest">Building subgraph…</p>
            </div>
          )}

          <FocusedGraphCanvas
            data={data}
            selectedNodeId={selectedNodeId}
            focusNodeId={focusNodeId}
            onSelectNode={setSelectedNodeId}
            layoutKey={layoutKey}
          />
        </div>

        {/* ── Inspector Sidebar (glass card) ── */}
        <aside className="w-64 shrink-0 flex flex-col overflow-hidden hidden lg:flex panel-enter-right"
          style={{ borderLeft: '1px solid var(--border)', background: 'rgba(8,8,20,0.7)', backdropFilter: 'blur(20px)' }}>

          {/* Header */}
          <div className="px-4 py-3 border-b flex items-center gap-2 shrink-0" style={{ borderColor: 'var(--border)' }}>
            <Layers size={12} style={{ color: 'var(--accent-primary)', opacity: 0.7 }} />
            <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
              {selectedNode ? 'Node Details' : 'Inspector'}
            </span>
          </div>

          {selectedNode ? (
            <div className="p-4 space-y-3.5 overflow-y-auto flex-1">
              {/* Identity card */}
              <div className="p-3 rounded-xl border" style={{ background: 'linear-gradient(135deg,rgba(124,106,247,0.08),rgba(62,207,207,0.04))', borderColor: 'rgba(124,106,247,0.15)' }}>
                <div className="flex items-center gap-1.5 mb-2">
                  {/* Color-coded type pill */}
                  <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full font-mono"
                    style={{ color: selectedNode.color||'#64748b', background:`${selectedNode.color||'#64748b'}18`, border:`1px solid ${selectedNode.color||'#64748b'}30` }}>
                    {selectedNode.type}
                  </span>
                  <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{selectedNode.layerName}</span>
                </div>
                {/* Hero node name */}
                <h3 className="text-[18px] font-bold break-all leading-snug font-mono" style={{ color: 'var(--text-primary)' }}>
                  {selectedNode.name}
                </h3>
              </div>

              {/* Summary */}
              {selectedNode.summary && (
                <p className="text-[11px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                  {selectedNode.summary}
                </p>
              )}

              {/* File path – IDE breadcrumb style */}
              {selectedNode.filePath && (
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-mono break-all" style={{ color: 'var(--text-muted)' }}>
                    📁 {selectedNode.filePath}
                  </span>
                </div>
              )}

              {/* Owner chip */}
              {selectedNode.dex?.top_owner && (
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white"
                    style={{ background: 'linear-gradient(135deg,#7c6af7,#3ecfcf)' }}>
                    {selectedNode.dex.top_owner.charAt(0).toUpperCase()}
                  </div>
                  <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{selectedNode.dex.top_owner}</span>
                </div>
              )}

              {/* Bus-factor warning – amber chip (non-alarming) */}
              {typeof selectedNode.dex?.bus_risk_score === 'number' && selectedNode.dex.bus_risk_score >= 0.5 && (
                <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-[10px] font-medium"
                  style={{ background: 'rgba(245,166,35,0.12)', border: '1px solid rgba(245,166,35,0.25)', color: 'var(--accent-warning)' }}>
                  <span>⚠</span> Elevated bus-factor risk
                </div>
              )}

              {/* Focus neighborhood CTA */}
              <button type="button" onClick={toggleFocusNeighborhood}
                className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-[12px] font-semibold transition-all shimmer-on-hover"
                style={{ background: 'linear-gradient(135deg,rgba(124,106,247,0.2),rgba(62,207,207,0.15))', border: '1px solid rgba(124,106,247,0.3)', color: '#a5b4fc' }}>
                <Focus size={11} />
                {focusNodeId === selectedNodeId ? 'Exit neighborhood' : 'Focus neighborhood'}
              </button>

              <div className="flex flex-col gap-1.5">
                <button type="button" onClick={() => goToDefinition(selectedNode)}
                  className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium border border-slate-700 text-slate-300 hover:border-indigo-500/40 hover:text-indigo-300 transition-colors">
                  <Crosshair size={11} /> Go to definition
                </button>
                <button type="button" onClick={() => loadSymbolRefs(selectedNode)} disabled={refsLoading}
                  className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium border border-slate-700 text-slate-300 hover:border-indigo-500/40 hover:text-indigo-300 transition-colors disabled:opacity-50">
                  <Link2 size={11} /> {refsLoading ? 'Loading refs…' : 'Find references'}
                </button>
              </div>

              {refsError && (
                <p className="text-[10px] text-amber-400/80">{refsError}</p>
              )}
              {refsData?.definition && (
                <p className="text-[10px] font-mono text-emerald-400/90 truncate">
                  def → {refsData.definition.file_path}{refsData.definition.line ? `:${refsData.definition.line}` : ''}
                </p>
              )}
              {refsData && refsData.references.length > 0 && (
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  <p className="text-[9px] uppercase tracking-wider font-bold text-slate-500">
                    References ({refsData.references.length})
                  </p>
                  {refsData.references.slice(0, 8).map((r) => (
                    <div key={r.node_id} className="text-[10px] font-mono text-slate-400 truncate">
                      {r.file_path}{r.line ? `:${r.line}` : ''}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 p-4">
              <Layers size={24} style={{ color: 'var(--text-muted)', opacity: 0.3 }} />
              <p className="text-[11px] text-center leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                Click a node to inspect it.
              </p>
            </div>
          )}

          {/* Layer legend */}
          <div className="mt-auto p-4 border-t shrink-0" style={{ borderColor: 'var(--border)' }}>
            <p className="text-[9px] uppercase tracking-wider mb-2 font-bold" style={{ color: 'var(--text-muted)' }}>Layers</p>
            <div className="flex flex-col gap-1.5">
              {layerLegend.map((l) => (
                <div key={l.id} className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: l.color, boxShadow: `0 0 4px ${l.color}60` }} />
                  <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{l.name}</span>
                  {l.nodeIds?.length > 0 && (
                    <span className="text-[9px] ml-auto font-mono" style={{ color: 'var(--text-muted)', opacity: 0.5 }}>{l.nodeIds.length}</span>
                  )}
                </div>
              ))}
            </div>
            {data?.meta?.elapsedMs != null && (
              <p className="text-[9px] mt-3 font-mono" style={{ color: 'var(--text-muted)', opacity: 0.4 }}>
                {data.meta.nodeCount}n · {data.meta.edgeCount}e · {data.meta.elapsedMs}ms
              </p>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
