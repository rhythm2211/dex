/**
 * ELK hierarchical layout utility.
 * Takes a flat list of nodes and edges, returns computed x/y positions.
 * Falls back to a simple grid if ELK throws (e.g. empty graph).
 */
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — elkjs ships its own types; TSC sometimes can't resolve them
import ELK from "elkjs/lib/elk.bundled.js";

const elk = new ELK();

export interface ELKNode {
  id: string;
  width: number;
  height: number;
  /** Optional partition index — ELK will try to cluster same-partition nodes */
  partition?: number;
}

export interface ELKEdge {
  source: string;
  target: string;
}

export interface ELKResult {
  positions: Record<string, { x: number; y: number }>;
  width: number;
  height: number;
}

const LAYERED_OPTIONS: Record<string, string> = {
  "elk.algorithm": "layered",
  "elk.direction": "DOWN",
  "elk.layered.spacing.nodeNodeBetweenLayers": "100",
  "elk.spacing.nodeNode": "60",
  "elk.layered.crossingMinimization.strategy": "LAYER_SWEEP",
  "elk.layered.nodePlacement.strategy": "BRANDES_KOEPF",
  "elk.edgeRouting": "SPLINES",
};

function fallbackGrid(nodes: ELKNode[]): ELKResult {
  const cols = Math.max(1, Math.ceil(Math.sqrt(nodes.length)));
  const positions: Record<string, { x: number; y: number }> = {};
  nodes.forEach((n, i) => {
    positions[n.id] = {
      x: (i % cols) * (n.width + 60),
      y: Math.floor(i / cols) * (n.height + 80),
    };
  });
  const maxCol = Math.min(nodes.length, cols);
  return {
    positions,
    width: maxCol * 300,
    height: Math.ceil(nodes.length / cols) * 180,
  };
}

export async function layoutNodes(
  nodes: ELKNode[],
  edges: ELKEdge[],
  options: Record<string, string> = {}
): Promise<ELKResult> {
  if (nodes.length === 0) return { positions: {}, width: 0, height: 0 };
  if (nodes.length === 1) {
    return { positions: { [nodes[0].id]: { x: 0, y: 0 } }, width: nodes[0].width, height: nodes[0].height };
  }

  const nodeIds = new Set(nodes.map((n) => n.id));
  const validEdges = edges.filter((e) => nodeIds.has(e.source) && nodeIds.has(e.target) && e.source !== e.target);

  const partitioningOpts: Record<string, string> = {};
  const hasPartitions = nodes.some((n) => n.partition !== undefined);
  if (hasPartitions) {
    partitioningOpts["elk.partitioning.activate"] = "true";
  }

  const elkGraph = {
    id: "root",
    layoutOptions: { ...LAYERED_OPTIONS, ...partitioningOpts, ...options },
    children: nodes.map((n) => ({
      id: n.id,
      width: n.width,
      height: n.height,
      ...(n.partition !== undefined
        ? { properties: { "elk.partitioning.partition": String(n.partition) } }
        : {}),
    })),
    edges: validEdges.map((e, i) => ({
      id: `e${i}-${e.source}-${e.target}`,
      sources: [e.source],
      targets: [e.target],
    })),
  };

  try {
    const result = await (elk as any).layout(elkGraph);
    const positions: Record<string, { x: number; y: number }> = {};
    for (const child of result.children ?? []) {
      positions[child.id] = { x: child.x ?? 0, y: child.y ?? 0 };
    }
    return { positions, width: result.width ?? 0, height: result.height ?? 0 };
  } catch (err) {
    console.warn("[elk-layout] ELK failed, using grid fallback:", err);
    return fallbackGrid(nodes);
  }
}
