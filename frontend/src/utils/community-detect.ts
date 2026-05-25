/**
 * Louvain community detection on the focused subgraph.
 * Uses graphology + graphology-communities-louvain.
 * Falls back to layer-based grouping if Louvain throws or graph is trivial.
 */
import Graph from "graphology";
import louvain from "graphology-communities-louvain";
import type { BridgeGraphNode, BridgeGraphEdge } from "@/lib/api";

export type CommunityMap = Record<string, number>;

export interface CommunityInfo {
  id: number;
  label: string;
  nodeIds: string[];
  dominantLayer: string;
  color: string;
}

const LAYER_COLORS: Record<string, string> = {
  api: "#6366f1",
  service: "#8b5cf6",
  data: "#06b6d4",
  ui: "#f59e0b",
  util: "#64748b",
  other: "#475569",
};

const LAYER_ORDER = ["api", "service", "data", "ui", "util", "other"];

function layerFallback(nodes: BridgeGraphNode[]): CommunityMap {
  const map: CommunityMap = {};
  for (const n of nodes) {
    const layer = n.layer || "other";
    map[n.id] = LAYER_ORDER.indexOf(layer) >= 0 ? LAYER_ORDER.indexOf(layer) : 5;
  }
  return map;
}

export function detectCommunities(
  nodes: BridgeGraphNode[],
  edges: BridgeGraphEdge[]
): { communities: CommunityMap; communityInfos: CommunityInfo[] } {
  if (nodes.length === 0) return { communities: {}, communityInfos: [] };

  // Single node or trivial — just use layer
  if (nodes.length <= 3) {
    const communities = layerFallback(nodes);
    return buildInfos(nodes, communities);
  }

  const graph = new Graph({ type: "undirected", allowSelfLoops: false, multi: false });

  for (const n of nodes) {
    if (!graph.hasNode(n.id)) {
      graph.addNode(n.id, { layer: n.layer || "other" });
    }
  }
  for (const e of edges) {
    if (graph.hasNode(e.source) && graph.hasNode(e.target) && e.source !== e.target) {
      try {
        graph.mergeEdge(e.source, e.target);
      } catch {
        // ignore
      }
    }
  }

  let rawCommunities: CommunityMap;
  try {
    rawCommunities = louvain(graph) as CommunityMap;
  } catch {
    rawCommunities = layerFallback(nodes);
  }

  // Merge tiny communities (fewer than 2 nodes) into the nearest large one
  const byComm: Record<number, string[]> = {};
  for (const [id, commIdx] of Object.entries(rawCommunities)) {
    if (!byComm[commIdx]) byComm[commIdx] = [];
    byComm[commIdx].push(id);
  }

  const MAX_COMMS = 6;
  const sorted = Object.entries(byComm).sort((a, b) => b[1].length - a[1].length);

  const merged: CommunityMap = { ...rawCommunities };
  if (sorted.length > MAX_COMMS) {
    const absorbIdx = parseInt(sorted[0][0]); // largest community absorbs tiny ones
    for (let i = MAX_COMMS; i < sorted.length; i++) {
      for (const nid of sorted[i][1]) {
        merged[nid] = absorbIdx;
      }
    }
  }
  // Also merge singletons
  const mergedByComm: Record<number, string[]> = {};
  for (const [nid, commIdx] of Object.entries(merged)) {
    if (!mergedByComm[commIdx]) mergedByComm[commIdx] = [];
    mergedByComm[commIdx].push(nid);
  }
  const absorbTarget = parseInt(Object.entries(mergedByComm).sort((a, b) => b[1].length - a[1].length)[0][0]);
  for (const [commIdxStr, nodeIds] of Object.entries(mergedByComm)) {
    if (nodeIds.length === 1) {
      for (const nid of nodeIds) {
        merged[nid] = absorbTarget;
      }
    }
  }

  return buildInfos(nodes, merged);
}

function buildInfos(
  nodes: BridgeGraphNode[],
  communities: CommunityMap
): { communities: CommunityMap; communityInfos: CommunityInfo[] } {
  const byComm: Record<number, string[]> = {};
  for (const [nid, commIdx] of Object.entries(communities)) {
    if (!byComm[commIdx]) byComm[commIdx] = [];
    byComm[commIdx].push(nid);
  }

  const nodeById = new Map(nodes.map((n) => [n.id, n]));

  const communityInfos: CommunityInfo[] = Object.entries(byComm).map(([commIdxStr, nodeIds]) => {
    const commIdx = parseInt(commIdxStr);

    // Dominant layer
    const layerCounts: Record<string, number> = {};
    for (const nid of nodeIds) {
      const layer = nodeById.get(nid)?.layer || "other";
      layerCounts[layer] = (layerCounts[layer] || 0) + 1;
    }
    const dominantLayer =
      Object.entries(layerCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "other";

    // Label from top node names
    const label = nodeIds
      .slice(0, 3)
      .map((id) => {
        const n = nodeById.get(id);
        const name = n?.name || id;
        return name.split("/").pop()?.split("\\").pop() || name;
      })
      .join(", ");

    return {
      id: commIdx,
      label: label.length > 40 ? label.slice(0, 38) + "…" : label,
      nodeIds,
      dominantLayer,
      color: LAYER_COLORS[dominantLayer] || LAYER_COLORS.other,
    };
  });

  // Re-index community IDs to 0-based for consistency
  const reindex = new Map<number, number>();
  communityInfos.forEach((info, i) => reindex.set(info.id, i));
  const reindexed: CommunityMap = {};
  for (const [nid, commIdx] of Object.entries(communities)) {
    reindexed[nid] = reindex.get(commIdx) ?? commIdx;
  }
  const reindexedInfos = communityInfos.map((info, i) => ({ ...info, id: i }));

  return { communities: reindexed, communityInfos: reindexedInfos };
}
