import type { Edge, Node } from 'reactflow';
import type { BridgeGraphEdge, BridgeGraphNode, SubgraphResponse } from '@/lib/api';
import { LAYER_ORDER, NODE_HEIGHT, NODE_WIDTH } from './constants';
import type { FocusedNodeData } from './nodes/FocusedNode';

export interface BuildFlowOptions {
  matchedScores: Map<string, number>;
  selectedNodeId: string | null;
  focusNodeId: string | null;
  neighborIds: Set<string>;
  positions: Record<string, { x: number; y: number }>;
}

function shortLabel(name: string, id: string): string {
  const raw = name || id;
  const base = raw.split('/').pop()?.split('\\').pop() || raw;
  return base.length > 28 ? `${base.slice(0, 26)}…` : base;
}

function layerPartition(layer?: string): number {
  const idx = LAYER_ORDER.indexOf(layer as (typeof LAYER_ORDER)[number]);
  return idx >= 0 ? idx : LAYER_ORDER.length - 1;
}

export function buildElkInput(
  nodes: BridgeGraphNode[],
  edges: BridgeGraphEdge[],
  visibleIds: Set<string>
) {
  const elkNodes = nodes
    .filter((n) => visibleIds.has(n.id))
    .map((n) => ({
      id: n.id,
      width: NODE_WIDTH,
      height: NODE_HEIGHT,
      partition: layerPartition(n.layer),
    }));
  const elkEdges = edges
    .filter((e) => visibleIds.has(e.source) && visibleIds.has(e.target))
    .map((e) => ({ source: e.source, target: e.target }));
  return { elkNodes, elkEdges };
}

export function computeNeighborSet(
  selectedId: string | null,
  edges: BridgeGraphEdge[]
): Set<string> {
  const s = new Set<string>();
  if (!selectedId) return s;
  s.add(selectedId);
  for (const e of edges) {
    if (e.source === selectedId) s.add(e.target);
    if (e.target === selectedId) s.add(e.source);
  }
  return s;
}

export function computeFocusVisibleIds(
  focusId: string | null,
  nodeIds: Set<string>,
  edges: BridgeGraphEdge[]
): Set<string> {
  if (!focusId || !nodeIds.has(focusId)) return nodeIds;
  const keep = new Set<string>([focusId]);
  for (const e of edges) {
    if (e.source === focusId && nodeIds.has(e.target)) keep.add(e.target);
    if (e.target === focusId && nodeIds.has(e.source)) keep.add(e.source);
  }
  return keep;
}

export function buildFlowGraph(
  data: SubgraphResponse,
  opts: BuildFlowOptions
): { nodes: Node<FocusedNodeData>[]; edges: Edge[] } {
  const allIds = new Set(data.nodes.map((n) => n.id));
  const visibleIds = opts.focusNodeId
    ? computeFocusVisibleIds(opts.focusNodeId, allIds, data.edges)
    : allIds;

  const hasSelection = !!opts.selectedNodeId;
  const flowNodes: Node<FocusedNodeData>[] = data.nodes
    .filter((n) => visibleIds.has(n.id))
    .map((n) => {
      const pos = opts.positions[n.id] ?? { x: 0, y: 0 };
      const searchScore = opts.matchedScores.get(n.id);
      const isHighlighted = searchScore !== undefined;
      const isSelected = opts.selectedNodeId === n.id;
      const isNeighbor = hasSelection && opts.neighborIds.has(n.id) && !isSelected;
      const isSelectionFaded = hasSelection && !opts.neighborIds.has(n.id);

      return {
        id: n.id,
        type: 'focused',
        position: pos,
        data: {
          label: shortLabel(n.name, n.id),
          fullName: n.name || n.id,
          nodeType: n.type,
          layer: n.layer || 'other',
          layerName: n.layerName || n.layer || 'other',
          color: n.color || '#475569',
          complexity: (n.complexity as FocusedNodeData['complexity']) || 'moderate',
          summary: n.summary || '',
          isHighlighted,
          searchScore,
          isSelected,
          isNeighbor,
          isSelectionFaded,
          isSeed: isHighlighted,
        },
        draggable: false,
      };
    });

  const flowEdges: Edge[] = data.edges
    .filter((e) => visibleIds.has(e.source) && visibleIds.has(e.target))
    .map((e, i) => {
      const active =
        opts.selectedNodeId &&
        (e.source === opts.selectedNodeId || e.target === opts.selectedNodeId);
      return {
        id: `e-${i}-${e.source}-${e.target}`,
        source: e.source,
        target: e.target,
        type: 'default',
        animated: false,
        style: {
          stroke: active ? 'rgba(251,191,36,0.7)' : 'rgba(100,116,139,0.28)',
          strokeWidth: active ? 1.5 : 0.8,
        },
      };
    });

  return { nodes: flowNodes, edges: flowEdges };
}
