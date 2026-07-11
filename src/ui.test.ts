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

  it('renders both canvases without throwing', () => {
    // If drawing threw, importing main (which calls renderAll) would have failed.
    expect(document.querySelectorAll('canvas').length).toBe(2);
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

  it('exhibit 2 walks the graph', () => {
    document.getElementById('btn-random-walk')!.dispatchEvent(new Event('click'));
    expect(document.getElementById('graph-output')!.textContent).toContain('Walk');
  });

  it('exhibit 3 reaches an agreed shared secret', () => {
    document.getElementById('btn-run-sidh')!.dispatchEvent(new Event('click'));
    const out = document.getElementById('sidh-output')!.textContent ?? '';
    expect(out).toContain('both parties agree');
  });

  it('exhibit 4 brute-forces a working secret', () => {
    document.getElementById('btn-run-attack')!.dispatchEvent(new Event('click'));
    const out = document.getElementById('attack-output')!.textContent ?? '';
    expect(out).toContain('toy broken');
    expect(out).toContain('✓ yes'); // reproduces public key
  });
});
