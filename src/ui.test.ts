// @vitest-environment jsdom
import { describe, it, expect, beforeAll } from 'vitest';
import { PARAMS, groupAction } from './csidh';
import { jInvariant } from './ec';

/**
 * Smoke test: load the real UI module into jsdom, click each exhibit's button,
 * and assert it renders live output. Canvas drawing safely no-ops here (jsdom
 * has no 2D context), so this exercises the wiring and the real math behind it.
 */
describe('UI wiring', () => {
  beforeAll(async () => {
    // jsdom has no real 2D context. Provide a no-op mock so the full drawing
    // path actually runs (exercising the render code, not just skipping it).
    const ctx = new Proxy(
      {},
      { get: () => () => undefined, set: () => true }
    ) as unknown as CanvasRenderingContext2D;
    HTMLCanvasElement.prototype.getContext = (() =>
      ctx) as unknown as typeof HTMLCanvasElement.prototype.getContext;
    document.body.innerHTML = '<div id="app"></div>';
    await import('./main');
  });

  it('renders all four canvases without throwing', () => {
    // If drawing threw, importing main (which calls renderAll) would have failed.
    // Isogeny map, isogeny graph, key-exchange diamond, and key-space grid.
    expect(document.querySelectorAll('canvas').length).toBe(4);
  });

  it('renders all five exhibits', () => {
    for (let i = 1; i <= 5; i++) {
      expect(document.getElementById(`exhibit-${i}`)).not.toBeNull();
    }
  });

  it('exhibit 1 computes a real isogeny', () => {
    document.getElementById('btn-run-isogeny')!.dispatchEvent(new Event('click'));
    const out = document.getElementById('isogeny-output')!.textContent ?? '';
    expect(out).toContain('Codomain');
    expect(out).toContain('supersingular');
  });

  it('exhibit 1 shows the kernel collapsing to the identity, verified per point', () => {
    document.getElementById('btn-run-isogeny')!.dispatchEvent(new Event('click'));
    const out = document.getElementById('isogeny-output')!.textContent ?? '';
    // The verdict is computed by evaluating φ on every kernel point, not asserted:
    // "✓ ⟨K⟩ has ℓ points … and all ℓ evaluate to O under φ (checked)".
    expect(out).toContain('evaluate to O under φ (checked)');
    expect(out).not.toContain('this should never happen');
    expect(out).toContain('Homomorphism');
  });

  it('exhibit 2 walks the graph', () => {
    document.getElementById('btn-random-walk')!.dispatchEvent(new Event('click'));
    expect(document.getElementById('graph-output')!.textContent).toContain('Walk');
  });

  it('exhibit 2 steps one edge at a time and tracks the exponent vector', () => {
    document.getElementById('btn-reset-walk')!.dispatchEvent(new Event('click'));
    document.getElementById('btn-step-a')!.dispatchEvent(new Event('click'));
    document.getElementById('btn-step-b')!.dispatchEvent(new Event('click'));
    const out = document.getElementById('graph-output')!.textContent ?? '';
    expect(out).toContain('[1, 1]'); // one 5-isogeny, one 7-isogeny
    expect(out).toContain('2 ℓ-isogenies');
  });

  it('exhibit 2 spends one exponent vector in both orders and lands once', () => {
    document.getElementById('btn-reset-walk')!.dispatchEvent(new Event('click'));
    for (let i = 0; i < 3; i++) {
      document.getElementById('btn-step-a')!.dispatchEvent(new Event('click'));
    }
    document.getElementById('btn-step-b')!.dispatchEvent(new Event('click'));
    document.getElementById('btn-commute')!.dispatchEvent(new Event('click'));
    const out = document.getElementById('commute-output')!.textContent ?? '';
    expect(out).toContain('Order does not matter');
  });

  it('exhibit 2 self-checks the walk against the group action', async () => {
    const out = await settle('graph-model', 'Walk = group action');
    // Both tallies must be complete, not merely present.
    expect(out).toContain('64/64 exponent vectors');
    expect(out).toContain('Order does not matter');
    expect(out).not.toContain('✗');
  });

  it('exhibit 3 reaches an agreed shared secret', () => {
    document.getElementById('btn-run-sidh')!.dispatchEvent(new Event('click'));
    const out = document.getElementById('sidh-output')!.textContent ?? '';
    expect(out).toContain('both parties agree');
  });

  it('exhibit 4 brute-forces the same Alice exhibit 3 shows', async () => {
    const kex = (document.getElementById('sidh-output')!.textContent ?? '').replace(/\s+/g, ' ');

    document.getElementById('btn-run-attack')!.dispatchEvent(new Event('click'));
    // The search runs one candidate per frame, so the panel appears when the
    // work is done rather than before it starts.
    const out = (await settle('attack-output', 'toy broken')).replace(/\s+/g, ' ');
    expect(out).toContain('✓ yes'); // reproduces public key

    // The target is the exchange on screen above, not a fresh one under the
    // same name: the j it attacks must be the j exhibit 3 published.
    const target = /j = (\d+)/.exec(out);
    expect(target).not.toBeNull();
    expect(kex).toContain(`j = ${target![1]} `);
  });
});

/* ------------------------------------------------------------------ *
 * Exhibit 3 — learner-supplied secrets
 *
 * The picker's whole claim is "nothing here is a preset": the exponents typed
 * in must drive the same Vélu group action the random exchange drives. These
 * tests check that against csidh.ts directly, and check that the advertised
 * bound is actually enforced rather than merely written on the field.
 * ------------------------------------------------------------------ */

describe('exhibit 3 secret picker', () => {
  const field = (id: string) => document.getElementById(id) as HTMLInputElement;
  const setSecrets = (a: [string, string], b: [string, string]) => {
    field('in-alice-a').value = a[0];
    field('in-alice-b').value = a[1];
    field('in-bob-a').value = b[0];
    field('in-bob-b').value = b[1];
  };
  const use = () => document.getElementById('btn-use-secrets')!.dispatchEvent(new Event('click'));
  const summary = () => (document.getElementById('sidh-output')!.textContent ?? '').replace(/\s+/g, ' ');
  const error = () => (document.getElementById('secret-error')!.textContent ?? '').trim();

  it('the picker fields describe the exchange on screen, not stale defaults', () => {
    document.getElementById('btn-run-sidh')!.dispatchEvent(new Event('click'));
    const out = summary();
    const alice = /Alice secret\s*\[(\d+), (\d+)\]/.exec(out)!;
    const bob = /Bob secret\s*\[(\d+), (\d+)\]/.exec(out)!;
    expect(field('in-alice-a').value).toBe(alice[1]);
    expect(field('in-alice-b').value).toBe(alice[2]);
    expect(field('in-bob-a').value).toBe(bob[1]);
    expect(field('in-bob-b').value).toBe(bob[2]);
  });

  it('typed exponents drive the real group action, not a lookup table', () => {
    setSecrets(['2', '1'], ['3', '0']);
    use();
    expect(error()).toBe('');
    const out = summary();
    expect(out).toContain('Alice secret[2, 1]');
    expect(out).toContain('Bob secret[3, 0]');

    // The published curves must be exactly what the Vélu arithmetic in csidh.ts
    // produces for those exponents, computed here independently of the page.
    const aliceJ = jInvariant(groupAction(PARAMS.E0, [2, 1]));
    const bobJ = jInvariant(groupAction(PARAMS.E0, [3, 0]));
    const sharedJ = jInvariant(groupAction(groupAction(PARAMS.E0, [3, 0]), [2, 1]));
    expect(out).toContain(`Alice publicj = ${aliceJ}`);
    expect(out).toContain(`Bob publicj = ${bobJ}`);
    expect(out).toContain('both parties agree');
    expect(out).toContain(`j = ${sharedJ}`);
  });

  it('a different exponent moves the public curve — the input is load-bearing', () => {
    setSecrets(['1', '0'], ['1', '0']);
    use();
    const first = /Alice public\s*j = (\d+)/.exec(summary())![1];
    setSecrets(['0', '1'], ['1', '0']);
    use();
    const second = /Alice public\s*j = (\d+)/.exec(summary())![1];
    // One 5-isogeny and one 7-isogeny land on different vertices of the graph.
    expect(second).not.toBe(first);
    expect(second).toBe(String(jInvariant(groupAction(PARAMS.E0, [0, 1]))));
  });

  it('rejects an exponent past the bound instead of silently clamping it', () => {
    setSecrets(['2', '2'], ['2', '2']);
    use();
    const before = summary();

    setSecrets([String(PARAMS.expBound + 1), '0'], ['1', '1']);
    use();
    expect(error()).toContain(`between 0 and ${PARAMS.expBound}`);
    // Rejected means unchanged: the previous exchange is still the one on screen.
    expect(summary()).toBe(before);
  });

  it('rejects a negative exponent — there is no such thing as a −1 step walk', () => {
    setSecrets(['2', '2'], ['2', '2']);
    use();
    const before = summary();
    setSecrets(['-1', '0'], ['1', '1']);
    use();
    expect(error()).toContain(`between 0 and ${PARAMS.expBound}`);
    expect(summary()).toBe(before);
  });

  it('rejects a fractional or non-numeric exponent', () => {
    setSecrets(['2', '2'], ['2', '2']);
    use();
    const before = summary();

    setSecrets(['1.5', '0'], ['1', '1']);
    use();
    expect(error()).toContain('whole number');
    expect(summary()).toBe(before);

    setSecrets(['', '0'], ['1', '1']);
    use();
    expect(error()).toContain('empty');
    expect(summary()).toBe(before);
  });

  it('clears the error once a valid secret is accepted', () => {
    setSecrets(['99', '0'], ['1', '1']);
    use();
    expect(error()).not.toBe('');
    setSecrets(['1', '1'], ['1', '1']);
    use();
    expect(error()).toBe('');
    expect(summary()).toContain('Alice secret[1, 1]');
  });

  it('Bob is validated too, not just Alice', () => {
    setSecrets(['1', '1'], ['1', '1']);
    use();
    const before = summary();
    setSecrets(['1', '1'], ['0', '99']);
    use();
    expect(error()).toContain("Bob's");
    expect(summary()).toBe(before);
  });

  /**
   * Exhibit 3 names the exact vector exhibit 4's brute force will return. That
   * is a prediction about another panel, so it has to be checked against that
   * panel actually running — a claim about a search is worth nothing if the
   * search disagrees.
   */
  it('the collision class exhibit 3 predicts is what exhibit 4 recovers', async () => {
    setSecrets(['4', '3'], ['2', '2']);
    use();
    const predicted = /it will report \[(\d+), (\d+)\]|only one of the/.exec(
      document.getElementById('collision-class')!.textContent ?? ''
    );
    expect(predicted, 'exhibit 3 must say what exhibit 4 will find').not.toBeNull();

    document.getElementById('btn-run-attack')!.dispatchEvent(new Event('click'));
    const out = (await settle('attack-output', 'toy broken')).replace(/\s+/g, ' ');
    const recovered = /Recovered secret\s*\[(\d+), (\d+)\]/.exec(out)!;

    if (predicted![1] !== undefined) {
      expect(`${recovered[1]},${recovered[2]}`).toBe(`${predicted![1]},${predicted![2]}`);
    } else {
      // No collisions: the only vector reaching the curve is Alice's own.
      expect(`${recovered[1]},${recovered[2]}`).toBe('4,3');
    }
    expect(out).toContain('✓ yes'); // and it does reproduce the public key
  });
});

/** Poll an output element until it says something, or give up. */
async function settle(id: string, needle: string, timeoutMs = 8000): Promise<string> {
  const started = Date.now();
  for (;;) {
    const text = document.getElementById(id)!.textContent ?? '';
    if (text.includes(needle)) return text;
    if (Date.now() - started > timeoutMs) {
      throw new Error(`#${id} never contained "${needle}" (last: ${text.slice(0, 200)})`);
    }
    await new Promise((r) => setTimeout(r, 20));
  }
}
