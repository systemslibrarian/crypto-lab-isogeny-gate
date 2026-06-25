import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

/**
 * Automated WCAG 2.1 contrast check. Parses the CSS custom properties for each
 * theme straight out of style.css and asserts that every text/background pair we
 * actually render meets its AA threshold (4.5:1 for normal text, 3:1 for large
 * headings and UI elements). This is a guard, not a vibe — if a colour drifts,
 * the build fails.
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
