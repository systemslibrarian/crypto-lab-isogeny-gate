import { describe, it, expect } from 'vitest';
import { countPoints, jInvariant, isIsomorphic, type Curve } from './ec';
import {
  PARAMS,
  applyIsogenyStep,
  groupAction,
  keySpaceSize,
  candidateAt,
} from './csidh';
import {
  buildIsogenyGraph,
  describeGraphModel,
  randomWalk,
  walkStart,
  walkSequence,
  stepInGraph,
  nodeIdForCurve,
} from './graph';

const graph = buildIsogenyGraph();
const [ELL_A, ELL_B] = PARAMS.ells;

describe('isogeny graph', () => {
  it('has more than one node and starts at E0', () => {
    expect(graph.nodes.length).toBeGreaterThan(1);
    expect(graph.nodes[0].curve).toEqual(PARAMS.E0);
  });

  it('every node is a supersingular curve (#E = p + 1)', () => {
    for (const n of graph.nodes) expect(countPoints(n.curve)).toBe(420n);
  });

  it('vertices are isomorphism classes, not j-invariants', () => {
    // No two vertices are GF(p)-isomorphic …
    for (let i = 0; i < graph.nodes.length; i++) {
      for (let k = i + 1; k < graph.nodes.length; k++) {
        expect(isIsomorphic(graph.nodes[i].curve, graph.nodes[k].curve)).toBe(false);
      }
    }
    // … but some of them do share a j-invariant (a curve and its quadratic
    // twist), which is exactly why keying vertices by j merges distinct curves.
    const js = new Set(graph.nodes.map((n) => String(n.j)));
    expect(js.size).toBeLessThan(graph.nodes.length);
    // Labels stay unique even where j does not.
    expect(new Set(graph.nodes.map((n) => n.label)).size).toBe(graph.nodes.length);
  });

  it('every edge really is an ℓ-isogeny between its endpoints', () => {
    for (const e of graph.edges) {
      const from = graph.nodes[e.from].curve;
      const to = graph.nodes[e.to].curve;
      const f2t = applyIsogenyStep(from, e.ell);
      const t2f = applyIsogenyStep(to, e.ell);
      expect(isIsomorphic(f2t, to) || isIsomorphic(t2f, from)).toBe(true);
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
    const walk = randomWalk(graph, walkStart(graph), 5, PARAMS, (n) => {
      const out = bytes.slice(bytePos, bytePos + n);
      bytePos += n;
      return out;
    });
    const path = walk.states.map((s) => s.nodeId);
    expect(path[0]).toBe(0);
    expect(walk.ells.length).toBe(5);
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

/**
 * The exhibit's guarantee: the walk a learner builds one button at a time IS the
 * CSIDH group action, and it does not care in what order the steps were taken.
 * This used to be false — the walk stepped from each vertex's stored
 * representative curve instead of the curve actually reached — and it disagreed
 * with the group action for 36 of the 64 exponent vectors.
 */
describe('the button walk is the group action', () => {
  const keySpace = keySpaceSize();

  it(`agrees with groupAction for all ${keySpace} exponent vectors`, () => {
    let agree = 0;
    for (let idx = 0; idx < keySpace; idx++) {
      const [i, j] = candidateAt(idx);
      const seq = [...Array(i).fill(ELL_A), ...Array(j).fill(ELL_B)];
      const end = walkSequence(graph, walkStart(graph), seq).states.pop()!;
      const viaAction = groupAction(PARAMS.E0, [i, j]);
      if (
        isIsomorphic(end.curve, viaAction) &&
        end.nodeId === nodeIdForCurve(graph, viaAction)
      ) {
        agree += 1;
      }
    }
    expect(agree).toBe(keySpace);
  });

  it(`lands on the same vertex in either ℓ order for all ${keySpace} vectors`, () => {
    let same = 0;
    for (let idx = 0; idx < keySpace; idx++) {
      const [i, j] = candidateAt(idx);
      const a = walkSequence(graph, walkStart(graph), [
        ...Array(i).fill(ELL_A),
        ...Array(j).fill(ELL_B),
      ]).states.pop()!;
      const b = walkSequence(graph, walkStart(graph), [
        ...Array(j).fill(ELL_B),
        ...Array(i).fill(ELL_A),
      ]).states.pop()!;
      if (a.nodeId === b.nodeId) same += 1;
    }
    expect(same).toBe(keySpace);
  });

  it('a step follows the curve you are on, not the vertex representative', () => {
    const one = stepInGraph(graph, walkStart(graph), ELL_A);
    const two = stepInGraph(graph, one, ELL_B);
    expect(isIsomorphic(two.curve, groupAction(PARAMS.E0, [1, 1]))).toBe(true);
    expect(two.nodeId).toBe(nodeIdForCurve(graph, two.curve));
  });
});

/**
 * The numbers the UI's model note quotes. They are stated on the page, so they
 * are pinned here — including the expensive ones the page cannot afford to
 * recompute on every load.
 */
describe('what the drawing leaves out', () => {
  it('draws every class reachable from E0 by the ℓ it uses', () => {
    const model = describeGraphModel(graph);
    expect(model.allSupersingular).toBe(true);
    expect(model.vertices).toBe(27);
    expect(model.distinctJs).toBe(14);
    expect(model.ells).toEqual(PARAMS.ells);
  });

  it('adding ℓ = 3 reaches no new curve', () => {
    const classes: Curve[] = [PARAMS.E0];
    const findClass = (c: Curve) => classes.findIndex((k) => isIsomorphic(k, c));
    for (let i = 0; i < classes.length; i++) {
      for (const ell of [3, ...PARAMS.ells]) {
        const t = applyIsogenyStep(classes[i], ell);
        if (findClass(t) === -1) classes.push(t);
      }
    }
    expect(classes.length).toBe(graph.nodes.length);
  });

  it('GF(419) has 36 supersingular classes and 18 supersingular j-invariants', () => {
    const classes: Curve[] = [];
    const js = new Set<string>();
    for (let a = 0n; a < PARAMS.p; a++) {
      for (let b = 0n; b < PARAMS.p; b++) {
        if ((4n * a * a * a + 27n * b * b) % PARAMS.p === 0n) continue;
        const curve: Curve = { a, b, p: PARAMS.p };
        if (countPoints(curve) !== PARAMS.p + 1n) continue;
        js.add(String(jInvariant(curve)));
        if (!classes.some((k) => isIsomorphic(k, curve))) classes.push(curve);
      }
    }
    expect(classes.length).toBe(36);
    expect(js.size).toBe(18);
    // The drawing is a proper part of that world, and the UI says so.
    expect(graph.nodes.length).toBeLessThan(classes.length);
  });

  it('the key space collapses: 64 exponent vectors reach 27 curves', () => {
    const keySpace = keySpaceSize();
    const reached = new Set<number>();
    for (let idx = 0; idx < keySpace; idx++) {
      reached.add(nodeIdForCurve(graph, groupAction(PARAMS.E0, candidateAt(idx))));
    }
    expect(keySpace).toBe(64);
    expect(reached.size).toBe(27);
    expect(reached.has(-1)).toBe(false);
  });
});
