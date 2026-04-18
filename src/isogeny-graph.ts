/**
 * Phase 3: Isogeny graph visualization
 *
 * Simplified: computes and visualizes the supersingular isogeny graph
 * for small p. For educational purposes.
 */

export interface IsogenyGraphNode {
  id: number;
  jInvariant: bigint;
  label: string;
}

export interface IsogenyGraphEdge {
  from: number;
  to: number;
  degree: number;
  label: string;
}

export interface IsogenyGraph {
  nodes: IsogenyGraphNode[];
  edges: IsogenyGraphEdge[];
}

/**
 * Minimal isogeny graph for demonstration.
 * In real scenario: compute all supersingular j-invariants over GF(p²)
 * and ℓ-isogeny connections.
 */
export function buildIsogenyGraph(_p: bigint = 71n, ell: number = 2): IsogenyGraph {
  // Toy graph: show basic structure
  // Represents supersingular isogeny graph structure
  const nodes: IsogenyGraphNode[] = [
    { id: 0, jInvariant: 0n, label: 'E₀ (start)' },
    { id: 1, jInvariant: 1728n, label: 'E₁' },
    { id: 2, jInvariant: 42n, label: 'E₂' },
    { id: 3, jInvariant: 55n, label: 'E₃' },
    { id: 4, jInvariant: 66n, label: 'E₄' },
    { id: 5, jInvariant: 35n, label: 'E₅' },
  ];

  const edges: IsogenyGraphEdge[] = [
    { from: 0, to: 1, degree: ell, label: '2-isogeny' },
    { from: 0, to: 2, degree: ell, label: '2-isogeny' },
    { from: 1, to: 3, degree: ell, label: '2-isogeny' },
    { from: 2, to: 3, degree: ell, label: '2-isogeny' },
    { from: 2, to: 4, degree: ell, label: '2-isogeny' },
    { from: 3, to: 5, degree: ell, label: '2-isogeny' },
    { from: 4, to: 5, degree: ell, label: '2-isogeny' },
  ];

  return { nodes, edges };
}

/**
 * Compute a random walk on the isogeny graph.
 */
export function randomWalk(
  graph: IsogenyGraph,
  startNode: number,
  steps: number
): number[] {
  const path: number[] = [startNode];
  let current = startNode;

  for (let i = 0; i < steps; i++) {
    const outgoing = graph.edges.filter((e) => e.from === current);
    if (outgoing.length === 0) break;

    const randomBytes = new Uint8Array(1);
    crypto.getRandomValues(randomBytes);
    const choice = outgoing[randomBytes[0] % outgoing.length];
    current = choice.to;
    path.push(current);
  }

  return path;
}

/**
 * Draw the isogeny graph on a canvas (2D projection).
 */
export function drawIsogenyGraph(
  canvas: HTMLCanvasElement,
  graph: IsogenyGraph,
  options: {
    highlightPath?: number[];
    highlightNodes?: number[];
    torsionLeakEdge?: { from: number; to: number };
  } = {}
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas context not available');

  const width = canvas.width;
  const height = canvas.height;

  // Background
  ctx.fillStyle = 'rgba(10, 14, 39, 0.8)';
  ctx.fillRect(0, 0, width, height);

  // Positions in a circle
  const radius = Math.min(width, height) * 0.35;
  const centerX = width / 2;
  const centerY = height / 2;

  const positions: { x: number; y: number }[] = graph.nodes.map((_, i) => {
    const angle = (i / graph.nodes.length) * 2 * Math.PI;
    return {
      x: centerX + radius * Math.cos(angle),
      y: centerY + radius * Math.sin(angle),
    };
  });

  // Draw edges
  ctx.strokeStyle = '#1a4a8a';
  ctx.lineWidth = 2;
  for (const edge of graph.edges) {
    const p1 = positions[edge.from];
    const p2 = positions[edge.to];
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.stroke();
  }

  // Highlight torsion leak edge
  if (options.torsionLeakEdge) {
    ctx.strokeStyle = '#ff3366';
    ctx.lineWidth = 3;
    const p1 = positions[options.torsionLeakEdge.from];
    const p2 = positions[options.torsionLeakEdge.to];
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.stroke();
  }

  // Highlight path
  if (options.highlightPath && options.highlightPath.length > 1) {
    ctx.strokeStyle = '#00ff88';
    ctx.lineWidth = 3;
    for (let i = 0; i < options.highlightPath.length - 1; i++) {
      const from = options.highlightPath[i];
      const to = options.highlightPath[i + 1];
      const p1 = positions[from];
      const p2 = positions[to];
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
    }
  }

  // Draw nodes
  for (let i = 0; i < graph.nodes.length; i++) {
    const node = graph.nodes[i];
    const pos = positions[i];
    const isHighlighted =
      options.highlightNodes && options.highlightNodes.includes(i);

    ctx.fillStyle = isHighlighted ? '#ffd700' : '#00d4ff';
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, 20, 0, 2 * Math.PI);
    ctx.fill();

    ctx.fillStyle = '#0a0e27';
    ctx.font = 'bold 12px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`j=${node.label.split(' ')[1] || 'E₀'}`, pos.x, pos.y);
  }
}
