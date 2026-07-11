import { describe, it, expect } from 'vitest';
import { countPoints, jInvariant } from './ec';
import { PARAMS, applyIsogenyStep } from './csidh';
import { buildIsogenyGraph, randomWalk } from './graph';

const graph = buildIsogenyGraph();

describe('isogeny graph', () => {
  it('has more than one node and starts at E0', () => {
    expect(graph.nodes.length).toBeGreaterThan(1);
    expect(graph.nodes[0].curve).toEqual(PARAMS.E0);
  });

  it('every node is a supersingular curve (#E = p + 1)', () => {
    for (const n of graph.nodes) expect(countPoints(n.curve)).toBe(420n);
  });

  it('every edge really is an ℓ-isogeny between its endpoints', () => {
    for (const e of graph.edges) {
      const from = graph.nodes[e.from].curve;
      const to = graph.nodes[e.to].curve;
      // Stepping from one endpoint by ℓ lands on the other vertex (matched by
      // j-invariant, since vertices are j-invariants).
      const f2t = jInvariant(applyIsogenyStep(from, e.ell));
      const t2f = jInvariant(applyIsogenyStep(to, e.ell));
      expect(f2t === graph.nodes[e.to].j || t2f === graph.nodes[e.from].j).toBe(true);
    }
  });

  it('is connected (E0 reaches every node)', () => {
    const seen = new Set<number>([0]);
    const stack = [0];
    while (stack.length) {
      const id = stack.pop()!;
      for (const e of graph.edges) {
        const next = e.from === id ? e.to : e.to === id ? e.from : -1;
        if (next >= 0 && !seen.has(next)) {
          seen.add(next);
          stack.push(next);
        }
      }
    }
    expect(seen.size).toBe(graph.nodes.length);
  });

  it('a random walk stays on the graph and produces edges', () => {
    let bytePos = 0;
    const bytes = new Uint8Array([0, 1, 0, 1, 0, 1, 0, 1]);
    const path = randomWalk(graph, 0, 5, PARAMS, (n) => {
      const out = bytes.slice(bytePos, bytePos + n);
      bytePos += n;
      return out;
    });
    expect(path[0]).toBe(0);
    for (let i = 1; i < path.length; i++) {
      const a = path[i - 1];
      const b = path[i];
      const connected = graph.edges.some(
        (e) => (e.from === a && e.to === b) || (e.from === b && e.to === a)
      );
      expect(connected).toBe(true);
    }
  });
});
