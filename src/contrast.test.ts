import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

/**
 * Automated WCAG 2.1 contrast check. Parses the CSS custom properties for each
 * theme straight out of style.css and asserts that the pairs we actually render
 * meet their AA thresholds. This is a guard, not a vibe — if a colour drifts,
 * the build fails.
 *
 * There are two halves and they check different success criteria.
 *
 * 1.4.3 (text) — 4.5:1 for body text, 3:1 for large headings.
 *
 * 1.4.11 (non-text) — 3:1 for the boundary of a control and for a graphic you
 * have to see to understand the exhibit. This half did not exist until an audit
 * measured the running page: the header above used to claim the file covered
 * "UI elements" while every single pair in the list was a text/background pair.
 * Nothing here checked a border, a swatch, or a key-space cell, and all three
 * were failing in both themes. If you add a boundary, add it here — and add the
 * one you think is fine, because the pairs a stylesheet author picks are exactly
 * the ones already known to pass.
 */

const css = readFileSync('src/style.css', 'utf8');

function parseBlock(selector: string): Record<string, string> {
  // Grab the first declaration block following `selector {`.
  const start = css.indexOf(selector);
  const open = css.indexOf('{', start);
  const close = css.indexOf('}', open);
  const body = css.slice(open + 1, close);
  const vars: Record<string, string> = {};
  for (const m of body.matchAll(/(--[\w-]+):\s*([^;]+);/g)) {
    vars[m[1].trim()] = m[2].trim();
  }
  return vars;
}

const dark = parseBlock('[data-theme=\'dark\']');
const light = parseBlock('[data-theme=\'light\']');

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '').trim();
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

function relLuminance(hex: string): number {
  const lin = hexToRgb(hex).map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
}

function contrast(fg: string, bg: string): number {
  const a = relLuminance(fg);
  const b = relLuminance(bg);
  const [hi, lo] = a > b ? [a, b] : [b, a];
  return (hi + 0.05) / (lo + 0.05);
}

interface Pair {
  fg: string;
  bg: string;
  min: number;
  label: string;
}

function pairsFor(v: Record<string, string>): Pair[] {
  const g = (name: string) => {
    const hex = v[name];
    if (!hex || !hex.startsWith('#')) throw new Error(`missing var ${name}`);
    return hex;
  };
  return [
    // Body text on both surfaces (normal text → 4.5)
    { fg: g('--c-text'), bg: g('--c-bg'), min: 4.5, label: 'text on bg' },
    { fg: g('--c-text'), bg: g('--c-surface'), min: 4.5, label: 'text on surface' },
    // Muted text (taglines, kv labels, legend) → 4.5
    { fg: g('--c-muted'), bg: g('--c-bg'), min: 4.5, label: 'muted on bg' },
    { fg: g('--c-muted'), bg: g('--c-surface'), min: 4.5, label: 'muted on surface' },
    // Section headings (large bold) → 3.0
    { fg: g('--c-accent-strong'), bg: g('--c-surface'), min: 3.0, label: 'heading on surface' },
    // Button label / inline accent (normal text) → 4.5
    { fg: g('--c-accent'), bg: g('--c-surface'), min: 4.5, label: 'accent on surface' },
    // Button hover: canvas-bg text on accent fill → 4.5
    { fg: g('--canvas-bg'), bg: g('--c-accent'), min: 4.5, label: 'hover label on accent' },
    // Result/code colours on the kv background (--c-bg) → 4.5
    { fg: g('--c-alice'), bg: g('--c-bg'), min: 4.5, label: 'success on bg' },
    { fg: g('--c-leak'), bg: g('--c-bg'), min: 4.5, label: 'alert on bg' },
  ];
}

/**
 * WCAG 1.4.11 non-text contrast — 3:1, boundaries and meaningful graphics.
 *
 * Every pair here is one a real element draws, against the WORST (nearest)
 * surface that element actually lands on, not the most flattering one:
 *
 *  - `.btn-secondary` is `background: transparent`, so its border is the whole
 *    control, and it sits on `--c-surface` inside a `<section>`.
 *  - `.secret-row input[type=number]` fills with `--c-surface` inside a
 *    fieldset painted `--c-bg` — 1.1:1 — so the border carries it alone.
 *  - the exhibit-4 key-space cells and the exhibit-1 domain/codomain boxes are
 *    strokes on `--canvas-bg`.
 *  - the legend swatch fills are the key that ties a sentence to a colour in
 *    the canvas; each is checked against the section surface it sits on.
 */
function nonTextPairsFor(v: Record<string, string>): Pair[] {
  const g = (name: string) => {
    const hex = v[name];
    if (!hex || !hex.startsWith('#')) throw new Error(`missing var ${name}`);
    return hex;
  };
  return [
    { fg: g('--c-control-border'), bg: g('--c-surface'), min: 3, label: 'control border on surface' },
    { fg: g('--c-control-border'), bg: g('--c-bg'), min: 3, label: 'control border on bg' },
    { fg: g('--c-control-border'), bg: g('--canvas-bg'), min: 3, label: 'control border on canvas' },
    // Primary buttons are delineated by their --c-accent border alone.
    { fg: g('--c-accent'), bg: g('--c-surface'), min: 3, label: 'primary button border on surface' },
    // Focus indicator (:focus-visible outline) against both surfaces it lands on.
    { fg: g('--c-shared'), bg: g('--c-surface'), min: 3, label: 'focus outline on surface' },
    { fg: g('--c-shared'), bg: g('--c-bg'), min: 3, label: 'focus outline on bg' },
    // Legend swatches and the graph/keyspace marks they key.
    { fg: g('--c-alice'), bg: g('--c-surface'), min: 3, label: 'alice swatch on surface' },
    { fg: g('--c-bob'), bg: g('--c-surface'), min: 3, label: 'bob swatch on surface' },
    { fg: g('--c-shared'), bg: g('--c-surface'), min: 3, label: 'shared swatch on surface' },
    { fg: g('--c-ell-a'), bg: g('--c-surface'), min: 3, label: 'ell-a swatch on surface' },
    { fg: g('--c-ell-b'), bg: g('--c-surface'), min: 3, label: 'ell-b swatch on surface' },
    // The same colours as canvas marks, against the canvas they are drawn on.
    { fg: g('--c-alice'), bg: g('--canvas-bg'), min: 3, label: 'walk highlight on canvas' },
    { fg: g('--c-bob'), bg: g('--canvas-bg'), min: 3, label: 'bob path on canvas' },
    { fg: g('--c-shared'), bg: g('--canvas-bg'), min: 3, label: 'start/kernel mark on canvas' },
    { fg: g('--c-ell-a'), bg: g('--canvas-bg'), min: 3, label: 'ell-a edge on canvas' },
    { fg: g('--c-ell-b'), bg: g('--canvas-bg'), min: 3, label: 'ell-b edge on canvas' },
    { fg: g('--c-leak'), bg: g('--canvas-bg'), min: 3, label: 'leak mark on canvas' },
    // A tested key-space cell against an untested one, and against the canvas.
    { fg: g('--c-ell-b'), bg: g('--c-surface'), min: 3, label: 'tested cell vs untested cell' },
  ];
}

describe.each([
  ['dark', dark],
  ['light', light],
])('WCAG AA contrast — %s theme', (_name, vars) => {
  for (const p of pairsFor(vars)) {
    it(`${p.label} ≥ ${p.min}:1`, () => {
      const ratio = contrast(p.fg, p.bg);
      expect(ratio, `${p.fg} on ${p.bg} = ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(p.min);
    });
  }
});

describe.each([
  ['dark', dark],
  ['light', light],
])('WCAG AA non-text contrast (1.4.11) — %s theme', (_name, vars) => {
  for (const p of nonTextPairsFor(vars)) {
    it(`${p.label} ≥ ${p.min}:1`, () => {
      const ratio = contrast(p.fg, p.bg);
      expect(ratio, `${p.fg} on ${p.bg} = ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(p.min);
    });
  }
});

/**
 * The decorative hairline must stay OUT of the 1.4.11 set, and the two tokens
 * must stay distinct. Without this, "fix the contrast" could be satisfied by
 * pointing `--c-control-border` back at `--c-border` and every assertion above
 * would still pass — the tokens would just both be wrong together.
 */
describe.each([
  ['dark', dark],
  ['light', light],
])('boundary tokens stay distinct — %s theme', (_name, vars) => {
  it('--c-control-border is not --c-border', () => {
    expect(vars['--c-control-border']).not.toBe(vars['--c-border']);
  });
  it('--c-control-border clears 3:1 where --c-border does not', () => {
    expect(contrast(vars['--c-control-border'], vars['--c-surface'])).toBeGreaterThanOrEqual(3);
    expect(contrast(vars['--c-border'], vars['--c-surface'])).toBeLessThan(3);
  });
});
