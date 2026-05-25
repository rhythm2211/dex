'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ReactFlow, {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type NodeTypes,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { layoutNodes } from '@/utils/elk-layout';
import type { SubgraphResponse } from '@/lib/api';
import FocusedNode, { type FocusedNodeData } from './nodes/FocusedNode';
import {
  buildElkInput,
  buildFlowGraph,
  computeFocusVisibleIds,
  computeNeighborSet,
} from './buildFlowGraph';

const nodeTypes: NodeTypes = { focused: FocusedNode };

function FitViewOnLoad({
  nodeIds,
  layoutKey,
  layoutReady,
}: {
  nodeIds: string[];
  layoutKey: number;
  layoutReady: boolean;
}) {
  const { fitView } = useReactFlow();
  const containerRef = useRef<HTMLDivElement | null>(null);

  const runFit = useCallback(() => {
    if (nodeIds.length === 0) return;
    fitView({
      nodes: nodeIds.map((id) => ({ id })),
      duration: 400,
      padding: 0.25,
      maxZoom: 1.2,
    });
  }, [nodeIds, fitView]);

  // Fit once layout is ready and nodes exist
  useEffect(() => {
    if (!layoutReady || nodeIds.length === 0) return;
    const t = setTimeout(runFit, 80);
    return () => clearTimeout(t);
  }, [layoutKey, layoutReady, nodeIds.length, runFit]);

  // Refit when the canvas gets real dimensions (panel mount / resize)
  useEffect(() => {
    const el = containerRef.current?.parentElement;
    if (!el || !layoutReady || nodeIds.length === 0) return;

    let debounce: ReturnType<typeof setTimeout> | null = null;
    let lastW = 0;
    let lastH = 0;

    const maybeFit = () => {
      const { width, height } = el.getBoundingClientRect();
      if (width < 16 || height < 16) return;
      if (Math.abs(width - lastW) < 4 && Math.abs(height - lastH) < 4 && lastW > 0) return;
      lastW = width;
      lastH = height;
      runFit();
    };

    const ro = new ResizeObserver(() => {
      if (debounce) clearTimeout(debounce);
      debounce = setTimeout(maybeFit, 100);
    });
    ro.observe(el);
    requestAnimationFrame(() => requestAnimationFrame(maybeFit));

    return () => {
      ro.disconnect();
      if (debounce) clearTimeout(debounce);
    };
  }, [layoutReady, nodeIds.length, layoutKey, runFit]);

  return <div ref={containerRef} className="hidden" aria-hidden />;
}

function SelectedFitView({ selectedId }: { selectedId: string | null }) {
  const { fitView } = useReactFlow();
  const prev = useRef<string | null>(null);

  useEffect(() => {
    if (selectedId && selectedId !== prev.current) {
      const t = setTimeout(() => {
        fitView({ nodes: [{ id: selectedId }], duration: 400, padding: 0.4, maxZoom: 1.4 });
      }, 80);
      prev.current = selectedId;
      return () => clearTimeout(t);
    }
    if (!selectedId) prev.current = null;
  }, [selectedId, fitView]);

  return null;
}

export interface FocusedGraphCanvasProps {
  data: SubgraphResponse | null;
  selectedNodeId: string | null;
  focusNodeId: string | null;
  onSelectNode: (id: string | null) => void;
  layoutKey: number;
}

function FocusedGraphCanvasInner({
  data,
  selectedNodeId,
  focusNodeId,
  onSelectNode,
  layoutKey,
}: FocusedGraphCanvasProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState<FocusedNodeData>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [layoutStatus, setLayoutStatus] = useState<'idle' | 'computing' | 'ready'>('idle');
  const positionsRef = useRef<Record<string, { x: number; y: number }>>({});

  const matchedScores = useMemo(() => {
    const m = new Map<string, number>();
    if (!data) return m;
    for (const hit of data.matched) m.set(hit.nodeId, hit.score);
    return m;
  }, [data]);

  const neighborIds = useMemo(
    () => computeNeighborSet(selectedNodeId, data?.edges ?? []),
    [selectedNodeId, data?.edges]
  );

  // ELK layout only when subgraph data / focus / layout key changes (not on every node click)
  useEffect(() => {
    if (!data || data.nodes.length === 0) {
      positionsRef.current = {};
      setNodes([]);
      setEdges([]);
      setLayoutStatus('idle');
      return;
    }

    let cancelled = false;
    setLayoutStatus('computing');

    const allIds = new Set(data.nodes.map((n) => n.id));
    const visibleIds = computeFocusVisibleIds(focusNodeId, allIds, data.edges);

    const { elkNodes, elkEdges } = buildElkInput(data.nodes, data.edges, visibleIds);

    const finishLayout = (positions: Record<string, { x: number; y: number }>) => {
      positionsRef.current = positions;
      setLayoutStatus('ready');
    };

    layoutNodes(elkNodes, elkEdges)
      .then(({ positions }) => {
        if (cancelled) return;
        finishLayout(positions);
      })
      .catch((err) => {
        console.warn('[FocusedGraph] layout failed', err);
        if (cancelled) return;
        const fallbackPositions = Object.fromEntries(
          data.nodes.map((n, i) => [n.id, { x: (i % 6) * 260, y: Math.floor(i / 6) * 100 }])
        );
        finishLayout(fallbackPositions);
      });

    return () => {
      cancelled = true;
    };
  }, [data, layoutKey, focusNodeId]);

  // Apply positions + selection styling (no ELK re-run on click)
  useEffect(() => {
    if (!data || layoutStatus !== 'ready' || Object.keys(positionsRef.current).length === 0) {
      return;
    }
    const { nodes: flowNodes, edges: flowEdges } = buildFlowGraph(data, {
      matchedScores,
      selectedNodeId,
      focusNodeId,
      neighborIds,
      positions: positionsRef.current,
    });
    setNodes(flowNodes);
    setEdges(flowEdges);
  }, [
    data,
    layoutStatus,
    layoutKey,
    selectedNodeId,
    neighborIds,
    matchedScores,
    focusNodeId,
    setNodes,
    setEdges,
  ]);

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: { id: string }) => {
      onSelectNode(node.id);
    },
    [onSelectNode]
  );

  const onPaneClick = useCallback(() => onSelectNode(null), [onSelectNode]);

  const nodeIds = useMemo(() => nodes.map((n) => n.id), [nodes]);

  return (
    <div className="w-full h-full relative">
      {layoutStatus === 'computing' && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <p className="text-xs text-slate-400 uppercase tracking-widest">Computing layout…</p>
        </div>
      )}
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        nodeTypes={nodeTypes}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable
        fitView={false}
        fitViewOptions={{ minZoom: 0.05, maxZoom: 2, padding: 0.15 }}
        minZoom={0.02}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
        style={{ background: 'transparent' }}
      >
        <Background variant={BackgroundVariant.Dots} color="rgba(124,106,247,0.15)" gap={24} size={0.8} />
        <Controls style={{ background: 'rgba(8,8,20,0.88)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, boxShadow: '0 4px 20px rgba(0,0,0,0.5)' }} />
        <MiniMap
          style={{ background: 'rgba(8,8,20,0.88)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8 }}
          nodeColor={(n) => (n.data as FocusedNodeData)?.color || '#475569'}
          maskColor="rgba(5,6,10,0.7)"
        />
        <FitViewOnLoad
          nodeIds={nodeIds}
          layoutKey={layoutKey}
          layoutReady={layoutStatus === 'ready'}
        />
        <SelectedFitView selectedId={selectedNodeId} />
      </ReactFlow>
    </div>
  );
}

export default function FocusedGraphCanvas(props: FocusedGraphCanvasProps) {
  return (
    <ReactFlowProvider>
      <FocusedGraphCanvasInner {...props} />
    </ReactFlowProvider>
  );
}
