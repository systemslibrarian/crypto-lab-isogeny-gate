/**
 * The real supersingular isogeny graph for the toy CSIDH parameters.
 *
 * Vertices are the supersingular j-invariants over GF(p) reachable from E₀ —
 * the standard vertices of a supersingular isogeny graph. Edges are ℓ-isogenies
 * (one colour per ℓ). Every edge here is computed by the same Vélu routine the
 * key exchange uses, so this is precisely the graph the CSIDH group action walks
 * across. Nothing is hand-placed or faked.
 */

import { Curve, jInvariant } from './ec';
import { CSIDHParams, PARAMS, applyIsogenyStep } from './csidh';

export interface GraphNode {
  id: number;
  curve: Curve;
  j: bigint;
}

export interface GraphEdge {
  from: number;
  to: number;
  ell: number;
}

export interface IsogenyGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

/**
 * Build the isogeny graph by exploring from E₀: for every discovered vertex and
 * every ℓ, follow the rational ℓ-isogeny and record the edge, adding the
 * codomain as a new vertex when its j-invariant has not been seen. Vertices are
 * keyed by j-invariant (so a curve and its quadratic twist share a vertex).
 */
export function buildIsogenyGraph(params: CSIDHParams = PARAMS): IsogenyGraph {
  const nodes: GraphNode[] = [
    { id: 0, curve: params.E0, j: jInvariant(params.E0) },
  ];

  const findNode = (curve: Curve): number => {
    const j = jInvariant(curve);
    for (const n of nodes) if (n.j === j) return n.id;
    return -1;
  };

  const edgeSet = new Set<string>();
  const edges: GraphEdge[] = [];
  const queue: number[] = [0];

  while (queue.length > 0) {
    const id = queue.shift()!;
    const curve = nodes[id].curve;
    for (const ell of params.ells) {
      const target = applyIsogenyStep(curve, ell);
      let tid = findNode(target);
      if (tid === -1) {
        tid = nodes.length;
        nodes.push({ id: tid, curve: target, j: jInvariant(target) });
        queue.push(tid);
      }
      // Record an undirected edge once (the rational direction is one-way, but
      // for a teaching picture an undirected ℓ-edge between the two curves reads
      // more clearly).
      const key = `${Math.min(id, tid)}-${Math.max(id, tid)}-${ell}`;
      if (!edgeSet.has(key)) {
        edgeSet.add(key);
        edges.push({ from: id, to: tid, ell });
      }
    }
  }

  return { nodes, edges };
}

/**
 * A random walk across the graph: from `startId`, repeatedly pick a random ℓ
 * and step to its ℓ-neighbour. This is exactly a random CSIDH group-action walk
 * — the geometric heart of why isogeny key exchange is believed hard.
 *
 * Uses crypto-strength randomness by default; an injectable byte source keeps it
 * testable.
 */
export function randomWalk(
  graph: IsogenyGraph,
  startId: number,
  steps: number,
  _params: CSIDHParams = PARAMS,
  randomBytes: (n: number) => Uint8Array = cryptoBytes
): number[] {
  const path = [startId];
  let current = startId;
  for (let i = 0; i < steps; i++) {
    const outgoing = graph.edges.filter(
      (e) => e.from === current || e.to === current
    );
    if (outgoing.length === 0) break;
    const choice = outgoing[randomBytes(1)[0] % outgoing.length];
    current = choice.from === current ? choice.to : choice.from;
    path.push(current);
  }
  return path;
}

function cryptoBytes(n: number): Uint8Array {
  const b = new Uint8Array(n);
  crypto.getRandomValues(b);
  return b;
}

/* ------------------------------------------------------------------ *
 * Rendering
 * ------------------------------------------------------------------ */

export interface GraphColors {
  bg: string;
  node: string;
  nodeText: string;
  start: string;
  highlight: string;
  edge: string;
  ellEdge: Record<number, string>;
  label: string;
}

/**
 * Draw the graph on a canvas with a circular layout, scaling for the device
 * pixel ratio so it stays crisp. Colours are supplied by the caller so the
 * drawing follows the page theme.
 */
export function drawIsogenyGraph(
  canvas: HTMLCanvasElement,
  graph: IsogenyGraph,
  colors: GraphColors,
  options: { highlightPath?: number[]; startId?: number } = {}
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const cssWidth = canvas.clientWidth || canvas.width;
  const cssHeight = canvas.clientHeight || canvas.height;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(cssWidth * dpr);
  canvas.height = Math.round(cssHeight * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const W = cssWidth;
  const H = cssHeight;
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = colors.bg;
  ctx.fillRect(0, 0, W, H);

  const radius = Math.min(W, H) * 0.38;
  const cx = W / 2;
  const cy = H / 2;
  const n = graph.nodes.length;
  const pos = graph.nodes.map((_, i) => {
    const angle = (i / n) * 2 * Math.PI - Math.PI / 2;
    return { x: cx + radius * Math.cos(angle), y: cy + radius * Math.sin(angle) };
  });

  // Edges.
  ctx.lineWidth = 1.5;
  for (const e of graph.edges) {
    ctx.strokeStyle = colors.ellEdge[e.ell] ?? colors.edge;
    ctx.beginPath();
    ctx.moveTo(pos[e.from].x, pos[e.from].y);
    ctx.lineTo(pos[e.to].x, pos[e.to].y);
    ctx.stroke();
  }

  // Highlighted walk.
  const path = options.highlightPath;
  if (path && path.length > 1) {
    ctx.strokeStyle = colors.highlight;
    ctx.lineWidth = 3.5;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(pos[path[0]].x, pos[path[0]].y);
    for (let i = 1; i < path.length; i++) ctx.lineTo(pos[path[i]].x, pos[path[i]].y);
    ctx.stroke();
  }

  // Nodes.
  const pathSet = new Set(path ?? []);
  for (let i = 0; i < n; i++) {
    const isStart = i === (options.startId ?? 0);
    const inPath = pathSet.has(i);
    ctx.beginPath();
    ctx.arc(pos[i].x, pos[i].y, 16, 0, 2 * Math.PI);
    ctx.fillStyle = isStart ? colors.start : inPath ? colors.highlight : colors.node;
    ctx.fill();

    ctx.fillStyle = colors.nodeText;
    ctx.font = 'bold 11px ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(graph.nodes[i].j), pos[i].x, pos[i].y);
  }
}
