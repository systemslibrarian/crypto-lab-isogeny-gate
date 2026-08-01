/**
 * The isogeny graph the toy CSIDH group action actually moves in.
 *
 * A vertex is one curve *up to GF(p)-isomorphism* — which is the object the
 * class-group action permutes — not one j-invariant. The distinction matters:
 * a curve and its quadratic twist share a j-invariant but are different curves,
 * and an ℓ-isogeny takes them to different places. Keying vertices by j would
 * merge those two states, and a walk stepping from a merged vertex's stored
 * representative would silently jump onto the wrong curve. It would then fail to
 * commute, which is the one property the whole scheme rests on. So vertices here
 * are isomorphism classes; the j-invariant is only the *label* drawn on them, and
 * the two classes sharing a j are distinguished by a prime mark (e.g. 0 and 0′).
 *
 * Edges are ℓ-isogenies (one colour per ℓ), each computed by the same Vélu
 * routine the key exchange uses, so this is precisely the graph the CSIDH group
 * action walks across. Nothing is hand-placed or faked — but it is also not the
 * *whole* supersingular picture over GF(p); see the model note in the UI, and
 * {@link describeGraphModel}, for exactly what is and is not drawn.
 */

import { Curve, jInvariant, isIsomorphic, countPoints } from './ec';
import { CSIDHParams, PARAMS, applyIsogenyStep } from './csidh';

export interface GraphNode {
  id: number;
  /** A representative curve of this GF(p)-isomorphism class. */
  curve: Curve;
  j: bigint;
  /**
   * What is drawn inside the vertex: the j-invariant, with a prime mark for each
   * further class sharing that j (its quadratic twist). Distinct vertices always
   * get distinct labels.
   */
  label: string;
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

/** Are these two curves the same vertex — i.e. GF(p)-isomorphic? */
function sameClass(a: Curve, b: Curve): boolean {
  // j is a cheap necessary condition; the u⁴/u⁶ search decides the rest.
  return jInvariant(a) === jInvariant(b) && isIsomorphic(a, b);
}

/**
 * How many ℓ-steps it takes to return to `start`. The action is invertible, so
 * the orbit of a single ℓ is a clean cycle and this always terminates.
 */
function cycleLength(start: Curve, ell: number, limit = 1024): number {
  let c = applyIsogenyStep(start, ell);
  let n = 1;
  while (!sameClass(c, start) && n < limit) {
    c = applyIsogenyStep(c, ell);
    n++;
  }
  return n;
}

/**
 * Build the isogeny graph by exploring from E₀: for every discovered vertex and
 * every ℓ, follow the rational ℓ-isogeny, record the edge, and add the codomain
 * as a new vertex when its isomorphism class has not been seen.
 *
 * Vertices are laid out in the order of the longest single-ℓ cycle through E₀,
 * so that ℓ's edges form the rim of the circle the renderer draws and the other
 * ℓ's edges are chords of constant span. That layout is not decoration: a
 * commuting action on a cyclic class group *is* a circulant graph, and drawing
 * it as one makes "same exponents, either order, same vertex" visible.
 */
export function buildIsogenyGraph(params: CSIDHParams = PARAMS): IsogenyGraph {
  const reps: Curve[] = [];
  const findClass = (curve: Curve): number =>
    reps.findIndex((rep) => sameClass(rep, curve));

  // Lay the rim out first: the ℓ whose cycle through E₀ is longest.
  let rimEll = params.ells[0];
  let rimLen = 0;
  for (const ell of params.ells) {
    const len = cycleLength(params.E0, ell);
    if (len > rimLen) {
      rimLen = len;
      rimEll = ell;
    }
  }
  let c = params.E0;
  do {
    reps.push(c);
    c = applyIsogenyStep(c, rimEll);
  } while (findClass(c) === -1);

  // Then sweep every vertex in every ℓ-direction, growing the vertex set if a
  // step leaves the rim, and recording the edges.
  const edgeSet = new Set<string>();
  const edges: GraphEdge[] = [];
  for (let id = 0; id < reps.length; id++) {
    for (const ell of params.ells) {
      const target = applyIsogenyStep(reps[id], ell);
      let tid = findClass(target);
      if (tid === -1) {
        tid = reps.length;
        reps.push(target);
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

  // Label vertices by j, priming the twin class that shares each j.
  const seen = new Map<string, number>();
  const nodes: GraphNode[] = reps.map((curve, id) => {
    const j = jInvariant(curve);
    const n = seen.get(String(j)) ?? 0;
    seen.set(String(j), n + 1);
    return { id, curve, j, label: `${j}${'′'.repeat(n)}` };
  });

  return { nodes, edges };
}

/**
 * Where a learner actually is on the graph.
 *
 * `curve` is the real curve they are standing on — the thing every further
 * isogeny must be computed from. `nodeId` is only which vertex draws it. Keeping
 * the curve (and not just the vertex) is the whole point: recomputing the next
 * step from a vertex's stored representative instead of the learner's own curve
 * is how a walk stops matching {@link groupAction} and stops commuting.
 */
export interface WalkState {
  curve: Curve;
  nodeId: number;
}

/** Start a walk at a curve (E₀ by default). */
export function walkStart(
  graph: IsogenyGraph,
  curve: Curve = PARAMS.E0
): WalkState {
  return { curve, nodeId: nodeIdForCurve(graph, curve) };
}

/**
 * Take one real ℓ-isogeny step from where the learner actually is: apply the
 * rational ℓ-isogeny to `from.curve` and report both the curve reached and the
 * vertex that draws it. This is the single "+1 ℓ-isogeny" move a learner can
 * build a walk from, one edge at a time, and it uses the same Vélu arithmetic as
 * {@link groupAction} — so a walk of i ℓ₁-steps and j ℓ₂-steps lands exactly
 * where the secret [i, j] does, in either order.
 */
export function stepInGraph(
  graph: IsogenyGraph,
  from: WalkState,
  ell: number
): WalkState {
  const curve = applyIsogenyStep(from.curve, ell);
  return { curve, nodeId: nodeIdForCurve(graph, curve) };
}

/** A walk: the states visited, and the ℓ used for each step. */
export interface Walk {
  states: WalkState[];
  ells: number[];
}

/** Replay a sequence of ℓ-steps from a starting state, carrying the real curve. */
export function walkSequence(
  graph: IsogenyGraph,
  start: WalkState,
  ells: number[]
): Walk {
  const states: WalkState[] = [start];
  for (const ell of ells) {
    states.push(stepInGraph(graph, states[states.length - 1], ell));
  }
  return { states, ells: ells.slice() };
}

/**
 * A random walk across the graph: from `start`, repeatedly pick a random ℓ and
 * take that real isogeny step. This is exactly a random CSIDH group-action walk
 * — the geometric heart of why isogeny key exchange is believed hard.
 *
 * Uses crypto-strength randomness by default; an injectable byte source keeps it
 * testable.
 */
export function randomWalk(
  graph: IsogenyGraph,
  start: WalkState,
  steps: number,
  params: CSIDHParams = PARAMS,
  randomBytes: (n: number) => Uint8Array = cryptoBytes
): Walk {
  const ells: number[] = [];
  for (let i = 0; i < steps; i++) {
    ells.push(params.ells[randomBytes(1)[0] % params.ells.length]);
  }
  return walkSequence(graph, start, ells);
}

/**
 * The graph node for this curve's isomorphism class, or -1 if the curve is not a
 * vertex of this (fully-explored) graph. Lets a CSIDH walk computed as a sequence
 * of curves be replayed as a sequence of graph vertices.
 */
export function nodeIdForCurve(graph: IsogenyGraph, curve: Curve): number {
  // Fast path: the action returns canonical coefficients, so a walk usually
  // lands on exactly the representative stored in the vertex.
  for (const n of graph.nodes) {
    if (n.curve.a === curve.a && n.curve.b === curve.b) return n.id;
  }
  const j = jInvariant(curve);
  for (const n of graph.nodes) {
    if (n.j === j && isIsomorphic(n.curve, curve)) return n.id;
  }
  return -1;
}

/**
 * What this drawing is — measured from the graph that was actually built, so the
 * UI can state its own simplifications instead of hiding them.
 *
 * What it leaves out cannot be measured this cheaply: counting *all* the
 * supersingular curves over GF(p) is an O(p²) scan of point counts, so that
 * number is established once in the test suite (`graph.test.ts`) and quoted in
 * the UI rather than recomputed on every page load.
 */
export interface GraphModel {
  /** Vertices drawn = GF(p)-isomorphism classes reachable from E₀ by these ℓ. */
  vertices: number;
  /** How many distinct j-invariants those vertices carry. */
  distinctJs: number;
  /** How many vertices share their j with another vertex (twist pairs). */
  twinned: number;
  /** ℓ values that are drawn. */
  ells: number[];
  /** Every vertex passed the #E = p + 1 supersingularity check. */
  allSupersingular: boolean;
}

export function describeGraphModel(
  graph: IsogenyGraph,
  params: CSIDHParams = PARAMS
): GraphModel {
  const byJ = new Map<string, number>();
  for (const n of graph.nodes) {
    byJ.set(String(n.j), (byJ.get(String(n.j)) ?? 0) + 1);
  }
  let twinned = 0;
  for (const count of byJ.values()) if (count > 1) twinned += count;
  return {
    vertices: graph.nodes.length,
    distinctJs: byJ.size,
    twinned,
    ells: params.ells.slice(),
    allSupersingular: graph.nodes.every(
      (n) => countPoints(n.curve) === params.p + 1n
    ),
  };
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

/** A coloured path to overlay on the graph (e.g. Alice's or Bob's walk). */
export interface OverlayPath {
  /** Node ids visited, in order. */
  nodes: number[];
  /** Stroke colour. */
  color: string;
  /** Optional short label drawn at the walk's current head. */
  label?: string;
  /** Draw only the first `progress` edges (for animation). Defaults to all. */
  progress?: number;
  /** Dash the line (used for a re-walk from the other party's curve). */
  dashed?: boolean;
}

/**
 * Draw the graph on a canvas with a circular layout, scaling for the device
 * pixel ratio so it stays crisp. Colours are supplied by the caller so the
 * drawing follows the page theme.
 *
 * `highlightPath` keeps the original single-walk overlay. `overlays` draws any
 * number of independently-coloured walks (used for the commuting-diamond
 * animation: Alice's path, Bob's path, and each re-walk converging on the shared
 * vertex). `markNodes` circles specific vertices (e.g. the shared secret).
 */
export function drawIsogenyGraph(
  canvas: HTMLCanvasElement,
  graph: IsogenyGraph,
  colors: GraphColors,
  options: {
    highlightPath?: number[];
    startId?: number;
    overlays?: OverlayPath[];
    markNodes?: { id: number; color: string; label?: string }[];
  } = {}
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
  // Shrink the vertices so they never overlap, however many there are.
  const nodeR = Math.max(8, Math.min(16, ((2 * Math.PI * radius) / n) * 0.4));
  // Labels can be four characters ("396′"), so keep them inside the disc.
  const labelPx = Math.max(7, Math.round(nodeR * 0.68));

  // Edges.
  ctx.lineWidth = 1.5;
  for (const e of graph.edges) {
    ctx.strokeStyle = colors.ellEdge[e.ell] ?? colors.edge;
    ctx.beginPath();
    ctx.moveTo(pos[e.from].x, pos[e.from].y);
    ctx.lineTo(pos[e.to].x, pos[e.to].y);
    ctx.stroke();
  }

  // Draw one walk as connected segments, honouring `progress` for animation and
  // bowing any repeated-vertex step (an ℓ whose class acts trivially) into a
  // visible loop so no step is hidden.
  const drawWalk = (
    nodes: number[],
    color: string,
    width: number,
    dashed: boolean,
    progress: number
  ) => {
    if (nodes.length < 2) return;
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.setLineDash(dashed ? [6, 5] : []);
    const steps = Math.min(progress, nodes.length - 1);
    for (let i = 0; i < steps; i++) {
      const a = pos[nodes[i]];
      const b = pos[nodes[i + 1]];
      ctx.beginPath();
      if (nodes[i] === nodes[i + 1]) {
        // Self-step: draw a small loop above the node.
        ctx.arc(a.x, a.y - (nodeR + 4), nodeR * 0.75, 0.2 * Math.PI, 2.8 * Math.PI);
      } else {
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
      }
      ctx.stroke();
    }
    ctx.setLineDash([]);
  };

  // Highlighted walk (original single-walk API).
  const path = options.highlightPath;
  if (path && path.length > 1) {
    drawWalk(path, colors.highlight, 3.5, false, path.length - 1);
  }

  // Overlay walks (Alice/Bob commuting-diamond animation).
  const overlays = options.overlays ?? [];
  for (const ov of overlays) {
    const prog = ov.progress ?? ov.nodes.length - 1;
    drawWalk(ov.nodes, ov.color, 3.5, ov.dashed ?? false, prog);
  }

  // Nodes.
  const pathSet = new Set(path ?? []);
  const marks = options.markNodes ?? [];
  const markMap = new Map(marks.map((m) => [m.id, m]));
  for (let i = 0; i < n; i++) {
    const isStart = i === (options.startId ?? 0);
    const inPath = pathSet.has(i);
    ctx.beginPath();
    ctx.arc(pos[i].x, pos[i].y, nodeR, 0, 2 * Math.PI);
    ctx.fillStyle = isStart ? colors.start : inPath ? colors.highlight : colors.node;
    ctx.fill();

    // Ring a marked node (e.g. the shared secret) in its mark colour.
    const mark = markMap.get(i);
    if (mark) {
      ctx.strokeStyle = mark.color;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(pos[i].x, pos[i].y, nodeR + 5, 0, 2 * Math.PI);
      ctx.stroke();
    }

    // The label is the j-invariant, primed for the twist sharing that j — two
    // vertices with the same j are different curves, so they must read as such.
    ctx.fillStyle = colors.nodeText;
    ctx.font = `bold ${labelPx}px ui-monospace, monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(graph.nodes[i].label, pos[i].x, pos[i].y);
  }

  // Mark labels (drawn above the marked nodes, after all nodes so they sit on top).
  for (const m of marks) {
    if (!m.label) continue;
    ctx.fillStyle = m.color;
    ctx.font = 'bold 12px ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(m.label, pos[m.id].x, pos[m.id].y - (nodeR + 10));
  }
}
