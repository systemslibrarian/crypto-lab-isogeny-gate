/**
 * crypto-lab-isogeny-gate — interactive UI.
 *
 * Every exhibit is wired to the real arithmetic in ec.ts / csidh.ts / graph.ts.
 * Numbers shown here are computed live in your browser with exact BigInt math.
 */

import {
  Curve,
  allPoints,
  countPoints,
  jInvariant,
  isSupersingular,
} from './ec';
import {
  PARAMS,
  applyIsogenyStep,
  keyExchange,
  bruteForceRecover,
  groupAction,
  type Secret,
} from './csidh';
import {
  buildIsogenyGraph,
  drawIsogenyGraph,
  randomWalk,
  type GraphColors,
} from './graph';

const app = document.getElementById('app');
if (!app) throw new Error('No #app element');

const ELL_A = PARAMS.ells[0]; // 5
const ELL_B = PARAMS.ells[1]; // 7

app.innerHTML = `
  <header class="cl-hero">
    <div class="cl-hero-main">
      <h1 class="cl-hero-title">Isogeny Gate</h1>
      <p class="cl-hero-sub">CSIDH · isogeny key exchange · GF(${PARAMS.p})</p>
      <p class="cl-hero-desc">
        Compute a real toy CSIDH commutative group-action key exchange, walk the
        supersingular isogeny graph it lives on, and brute-force the toy secret to
        watch the scheme break.
      </p>
    </div>
    <aside class="cl-hero-why" aria-label="Why it matters">
      <span class="cl-hero-why-label">WHY IT MATTERS</span>
      <p class="cl-hero-why-text">
        Isogenies are a leading post-quantum family, yet a decade-trusted cousin,
        SIDH, collapsed in minutes to the Castryck–Decru attack. Seeing which
        structure held and which leaked is the difference between a survivor and a
        cautionary tale.
      </p>
    </aside>
    <button class="theme-toggle-btn" id="theme-toggle" type="button"
      aria-label="Toggle color theme">🌙</button>
  </header>

  <main>
    <section id="exhibit-1" aria-labelledby="h1-1">
      <h2 id="h1-1">1 · What is an isogeny?</h2>
      <p>
        An isogeny <span class="m">φ: E → E′</span> is a non-trivial map between
        elliptic curves that is both a group homomorphism and a rational map. It
        sends the identity to the identity and respects point addition. Below,
        <span class="m">φ</span> is a real ${ELL_A}-isogeny computed with Vélu's
        formulas from the base curve.
      </p>
      <div class="canvas-wrap">
        <canvas id="canvas-isogeny" width="640" height="320"
          role="img" aria-label="Point clouds of the domain and codomain curves of a real isogeny"></canvas>
      </div>
      <button id="btn-run-isogeny" type="button">Compute a real ${ELL_A}-isogeny</button>
      <div id="isogeny-output" class="output" aria-live="polite"></div>
    </section>

    <section id="exhibit-2" aria-labelledby="h1-2">
      <h2 id="h1-2">2 · The isogeny graph</h2>
      <p>
        The supersingular curves over <span class="m">GF(${PARAMS.p})</span> form
        a graph: vertices are <span class="m">j</span>-invariants, edges are
        ℓ-isogenies. It is an <em>expander</em> — short random walks mix rapidly —
        and finding the path between two given vertices is the hard problem
        isogeny cryptography rests on.
      </p>
      <div class="canvas-wrap">
        <canvas id="canvas-graph" width="640" height="440"
          role="img" aria-label="The supersingular isogeny graph with a highlighted random walk"></canvas>
      </div>
      <p class="legend" id="graph-legend"></p>
      <button id="btn-random-walk" type="button">Walk a random path</button>
      <div id="graph-output" class="output" aria-live="polite"></div>
    </section>

    <section id="exhibit-3" aria-labelledby="h1-3">
      <h2 id="h1-3">3 · CSIDH key exchange</h2>
      <p>
        Alice and Bob each pick a secret vector of exponents and walk the graph
        from the base curve. They publish where they land; then each walks their
        own secret again from the other's curve. Because the class-group action
        <strong>commutes</strong>, they arrive at the very same curve — the shared
        secret. This is the genuine CSIDH construction, a present-day survivor of
        the isogeny world.
      </p>
      <button id="btn-run-sidh" type="button">Run the key exchange</button>
      <div id="sidh-output" class="output" aria-live="polite"></div>
    </section>

    <section id="exhibit-4" aria-labelledby="h1-4">
      <h2 id="h1-4">4 · The gate: breaking it</h2>
      <p>
        <strong>What broke SIDH.</strong> SIDH (a different scheme) had each party
        publish not just their curve but the <em>images of torsion points</em>
        under their secret isogeny. In August 2022, Castryck and Decru showed
        those images over-determine the secret: glued into a higher-dimensional
        abelian surface (via Kani's lemma), they let an attacker reconstruct the
        secret isogeny in <em>minutes</em>. A decade-old candidate fell.
        CSIDH publishes only a curve — no torsion images — so that attack does not
        apply to it.
      </p>
      <p>
        <strong>What we can break here.</strong> Our parameters are tiny, so the
        whole key space is brute-forceable. Below we recover a working secret for
        Alice's public key by exhaustive search — the honest break of any toy.
      </p>
      <button id="btn-run-attack" type="button">Brute-force Alice's secret</button>
      <div id="attack-output" class="output output--alert" aria-live="polite"></div>
    </section>

    <section id="exhibit-5" aria-labelledby="h1-5">
      <h2 id="h1-5">5 · Lessons for post-quantum design</h2>
      <ul class="lessons">
        <li><strong>Auxiliary information is attack surface.</strong> SIDH's torsion images looked harmless for ten years and were fatal. CSIDH publishes less, and survives.</li>
        <li><strong>Beautiful math is not secure math.</strong> Isogenies are elegant; elegance and long scrutiny did not prevent the break.</li>
        <li><strong>Different problems, different fates.</strong> The pure path-finding problem (CSIDH, SQIsign) still stands; only SIDH's extra structure broke.</li>
        <li><strong>Attacks become tools.</strong> The Castryck–Decru machinery now informs constructive isogeny work, including SQIsign.</li>
        <li><strong>Diversity is essential.</strong> NIST standardised lattice, hash, and code families so that no single broken foundation is catastrophic.</li>
      </ul>
      <p class="disclaimer">
        <strong>Not for production.</strong> Parameters here (<span class="m">p = ${PARAMS.p}</span>)
        are chosen for visibility and are trivially breakable. For real
        key encapsulation use <span class="m">ML-KEM</span> (NIST FIPS&nbsp;203).
      </p>
    </section>
  </main>

  <footer class="scripture-footer">
    <p>Related demos:
      <a href="https://systemslibrarian.github.io/crypto-lab-pq-families/" target="_blank" rel="noopener">crypto-lab-pq-families</a> ·
      <a href="https://systemslibrarian.github.io/crypto-lab-kyber-vault/" target="_blank" rel="noopener">crypto-lab-kyber-vault</a> ·
      <a href="https://systemslibrarian.github.io/crypto-lab-mceliece-gate/" target="_blank" rel="noopener">crypto-lab-mceliece-gate</a> ·
      <a href="https://systemslibrarian.github.io/crypto-lab-multivariate/" target="_blank" rel="noopener">crypto-lab-multivariate</a> ·
      <a href="https://systemslibrarian.github.io/crypto-lab-lll-break/" target="_blank" rel="noopener">crypto-lab-lll-break</a>
    </p>
    <p>So whether you eat or drink or whatever you do, do it all for the glory of God. — 1 Corinthians 10:31</p>
  </footer>
`;

/* ------------------------------------------------------------------ *
 * Theme handling — re-render canvases when the theme changes (either
 * via the in-page toggle or the shared Crypto Lab header toggle).
 * ------------------------------------------------------------------ */

const htmlEl = document.documentElement;
function currentTheme(): 'light' | 'dark' {
  return htmlEl.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
}

const themeToggle = document.getElementById('theme-toggle') as HTMLButtonElement;
function paintToggle() {
  themeToggle.textContent = currentTheme() === 'dark' ? '🌙' : '☀️';
}
themeToggle.addEventListener('click', () => {
  const next = currentTheme() === 'dark' ? 'light' : 'dark';
  htmlEl.setAttribute('data-theme', next);
  try {
    localStorage.setItem('theme', next);
  } catch {
    /* ignore storage errors */
  }
});
paintToggle();

function cssVar(name: string): string {
  return getComputedStyle(htmlEl).getPropertyValue(name).trim();
}

function graphColors(): GraphColors {
  return {
    bg: cssVar('--canvas-bg'),
    node: cssVar('--c-accent'),
    nodeText: cssVar('--canvas-bg'),
    start: cssVar('--c-shared'),
    highlight: cssVar('--c-alice'),
    edge: cssVar('--c-edge'),
    ellEdge: { [ELL_A]: cssVar('--c-ell-a'), [ELL_B]: cssVar('--c-ell-b') },
    label: cssVar('--c-text'),
  };
}

/* ------------------------------------------------------------------ *
 * Exhibit 1 — a real isogeny, drawn as two point clouds
 * ------------------------------------------------------------------ */

const canvasIsogeny = document.getElementById('canvas-isogeny') as HTMLCanvasElement;
const isogenyOutput = document.getElementById('isogeny-output') as HTMLDivElement;
let isogenyCodomain: Curve | null = null;

function plotPoints(
  ctx: CanvasRenderingContext2D,
  curve: Curve,
  box: { x: number; y: number; w: number; h: number },
  title: string,
  dotColor: string,
  textColor: string
) {
  const p = Number(curve.p);
  ctx.fillStyle = textColor;
  ctx.font = '13px ui-monospace, monospace';
  ctx.textAlign = 'center';
  ctx.fillText(title, box.x + box.w / 2, box.y - 8);

  ctx.strokeStyle = cssVar('--c-edge');
  ctx.lineWidth = 1;
  ctx.strokeRect(box.x, box.y, box.w, box.h);

  ctx.fillStyle = dotColor;
  for (const P of allPoints(curve)) {
    if (P === null) continue;
    const px = box.x + (Number(P.x) / p) * box.w;
    const py = box.y + box.h - (Number(P.y) / p) * box.h;
    ctx.beginPath();
    ctx.arc(px, py, 1.6, 0, 2 * Math.PI);
    ctx.fill();
  }
}

function renderIsogeny() {
  const ctx = canvasIsogeny.getContext('2d');
  if (!ctx) return;
  const cssW = canvasIsogeny.clientWidth || canvasIsogeny.width;
  const cssH = canvasIsogeny.clientHeight || canvasIsogeny.height;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvasIsogeny.width = Math.round(cssW * dpr);
  canvasIsogeny.height = Math.round(cssH * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  ctx.fillStyle = cssVar('--canvas-bg');
  ctx.fillRect(0, 0, cssW, cssH);

  const textColor = cssVar('--c-text');
  const pad = 20;
  const boxW = (cssW - 3 * pad) / 2;
  const boxH = cssH - 70;
  const top = 36;
  const left = { x: pad, y: top, w: boxW, h: boxH };
  const right = { x: 2 * pad + boxW, y: top, w: boxW, h: boxH };

  plotPoints(ctx, PARAMS.E0, left, `E₀  (j=${jInvariant(PARAMS.E0)})`, cssVar('--c-accent'), textColor);

  if (isogenyCodomain) {
    plotPoints(ctx, isogenyCodomain, right, `E′ = φ(E₀)  (j=${jInvariant(isogenyCodomain)})`, cssVar('--c-bob'), textColor);
    // arrow between the boxes
    ctx.strokeStyle = cssVar('--c-shared');
    ctx.fillStyle = cssVar('--c-shared');
    ctx.lineWidth = 2;
    const ay = top + boxH / 2;
    const ax0 = left.x + boxW + 4;
    const ax1 = right.x - 4;
    ctx.beginPath();
    ctx.moveTo(ax0, ay);
    ctx.lineTo(ax1, ay);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(ax1, ay);
    ctx.lineTo(ax1 - 8, ay - 5);
    ctx.lineTo(ax1 - 8, ay + 5);
    ctx.fill();
    ctx.font = '12px ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`φ (${ELL_A}-isog.)`, (ax0 + ax1) / 2, ay - 10);
  } else {
    ctx.fillStyle = textColor;
    ctx.font = '13px ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.fillText('Press the button to compute φ(E₀).', right.x + boxW / 2, top + boxH / 2);
    ctx.strokeStyle = cssVar('--c-edge');
    ctx.strokeRect(right.x, right.y, right.w, right.h);
  }
}

document.getElementById('btn-run-isogeny')!.addEventListener('click', () => {
  isogenyCodomain = applyIsogenyStep(PARAMS.E0, ELL_A);
  renderIsogeny();
  const c = isogenyCodomain;
  const ss = isSupersingular(c);
  isogenyOutput.innerHTML = `
    <div class="kv"><span>Domain</span><code>E₀: y² = x³ + x</code></div>
    <div class="kv"><span>Codomain</span><code>E′: y² = x³ + ${c.a}x + ${c.b}</code></div>
    <div class="kv"><span>j-invariants</span><code>j(E₀) = ${jInvariant(PARAMS.E0)}  →  j(E′) = ${jInvariant(c)}</code></div>
    <div class="kv"><span>Point count</span><code>#E₀ = ${countPoints(PARAMS.E0)},  #E′ = ${countPoints(c)}  (both = p+1)</code></div>
    <div class="kv"><span>Codomain supersingular?</span><code>${ss ? '✓ yes' : '✗ no'}</code></div>
  `;
});

/* ------------------------------------------------------------------ *
 * Exhibit 2 — the real isogeny graph
 * ------------------------------------------------------------------ */

const canvasGraph = document.getElementById('canvas-graph') as HTMLCanvasElement;
const graphOutput = document.getElementById('graph-output') as HTMLDivElement;
const graph = buildIsogenyGraph();
let walkPath: number[] | undefined;

document.getElementById('graph-legend')!.innerHTML = `
  <span class="swatch" style="background:var(--c-ell-a)"></span> ${ELL_A}-isogeny
  &nbsp;&nbsp;<span class="swatch" style="background:var(--c-ell-b)"></span> ${ELL_B}-isogeny
  &nbsp;&nbsp;<span class="swatch" style="background:var(--c-shared)"></span> start (E₀)
  &nbsp;&nbsp;<span class="swatch" style="background:var(--c-alice)"></span> walk
`;

function renderGraph() {
  drawIsogenyGraph(canvasGraph, graph, graphColors(), { highlightPath: walkPath, startId: 0 });
}

document.getElementById('btn-random-walk')!.addEventListener('click', () => {
  walkPath = randomWalk(graph, 0, 6);
  renderGraph();
  const js = walkPath.map((id) => graph.nodes[id].j).join(' → ');
  graphOutput.innerHTML = `<div class="kv"><span>Walk (j-invariants)</span><code>${js}</code></div>
    <div class="kv"><span>Steps</span><code>${walkPath.length - 1} random ℓ-isogenies from E₀</code></div>`;
});

/* ------------------------------------------------------------------ *
 * Exhibit 3 — CSIDH key exchange
 * ------------------------------------------------------------------ */

const sidhOutput = document.getElementById('sidh-output') as HTMLDivElement;

function fmtSecret(s: Secret): string {
  return PARAMS.ells.map((l, i) => `${l}^${s[i]}`).join(' · ');
}

document.getElementById('btn-run-sidh')!.addEventListener('click', () => {
  const r = keyExchange();
  sidhOutput.innerHTML = `
    <div class="kv"><span>Alice secret</span><code>[${r.alice.secret.join(', ')}]  =  ${fmtSecret(r.alice.secret)}</code></div>
    <div class="kv"><span>Bob secret</span><code>[${r.bob.secret.join(', ')}]  =  ${fmtSecret(r.bob.secret)}</code></div>
    <div class="kv"><span>Alice public</span><code>j = ${jInvariant(r.alice.publicCurve)}</code></div>
    <div class="kv"><span>Bob public</span><code>j = ${jInvariant(r.bob.publicCurve)}</code></div>
    <div class="kv"><span>Alice computes</span><code>j(secret) = ${jInvariant(r.aliceShared)}</code></div>
    <div class="kv"><span>Bob computes</span><code>j(secret) = ${jInvariant(r.bobShared)}</code></div>
    <div class="kv result ${r.agree ? 'ok' : 'bad'}">
      <span>Shared secret</span>
      <code>${r.agree ? `✓ both parties agree:  j = ${r.sharedInvariant}` : '✗ disagreement (should never happen)'}</code>
    </div>
  `;
});

/* ------------------------------------------------------------------ *
 * Exhibit 4 — brute-force recovery
 * ------------------------------------------------------------------ */

const attackOutput = document.getElementById('attack-output') as HTMLDivElement;

document.getElementById('btn-run-attack')!.addEventListener('click', () => {
  const r = keyExchange();
  const rec = bruteForceRecover(r.alice.publicCurve, r.alice.secret);
  const reproduced = groupAction(PARAMS.E0, rec.recovered);
  attackOutput.innerHTML = `
    <div class="kv"><span>Target</span><code>Alice's public key  j = ${jInvariant(r.alice.publicCurve)}</code></div>
    <div class="kv"><span>Key space</span><code>${rec.keySpace} candidate secret vectors</code></div>
    <div class="kv"><span>Search</span><code>tested ${rec.tested} before a match</code></div>
    <div class="kv"><span>Recovered secret</span><code>[${rec.recovered.join(', ')}]  =  ${fmtSecret(rec.recovered)}</code></div>
    <div class="kv"><span>Reproduces public key?</span><code>${jInvariant(reproduced) === jInvariant(r.alice.publicCurve) ? '✓ yes' : '✗ no'}</code></div>
    <div class="kv result bad">
      <span>Verdict</span>
      <code>✓ toy broken — ${rec.matchesOriginal ? "Alice's exact secret recovered" : 'an equivalent working secret recovered'}</code>
    </div>
  `;
});

/* ------------------------------------------------------------------ *
 * Initial render + theme-change observer
 * ------------------------------------------------------------------ */

function renderAll() {
  paintToggle();
  renderIsogeny();
  renderGraph();
}

renderAll();

new MutationObserver(renderAll).observe(htmlEl, {
  attributes: true,
  attributeFilter: ['data-theme'],
});

window.addEventListener('resize', () => {
  renderIsogeny();
  renderGraph();
});
