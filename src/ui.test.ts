// @vitest-environment jsdom
import { describe, it, expect, beforeAll } from 'vitest';

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
