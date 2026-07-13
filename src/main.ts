/**
 * crypto-lab-isogeny-gate — interactive UI.
 *
 * Every exhibit is wired to the real arithmetic in ec.ts / csidh.ts / graph.ts.
 * Numbers shown here are computed live in your browser with exact BigInt math.
 */

import {
  Curve,
  ECPoint,
  allPoints,
  countPoints,
  jInvariant,
  isSupersingular,
  scalarMul,
  veluCodomain,
  veluEvaluate,
  pointAdd,
} from './ec';
import {
  PARAMS,
  keyExchange,
  bruteForceRecover,
  groupAction,
  groupActionPath,
  type Secret,
} from './csidh';
import {
  buildIsogenyGraph,
  drawIsogenyGraph,
  randomWalk,
  nodeIdForCurve,
  stepInGraph,
  type GraphColors,
  type OverlayPath,
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
    <section id="primer" aria-labelledby="h-primer" class="primer">
      <h2 id="h-primer">What you're looking at</h2>
      <p>
        An <strong>elliptic curve</strong> is a set of points you can <em>add</em>
        together like numbers — the additions form a group. An
        <strong>isogeny</strong> is a controlled way to hop from one such curve to
        a related one that keeps the addition working. Stringing hops together is a
        <strong>walk</strong>. The whole security idea: after someone walks, you
        can see <em>where</em> they landed but not <em>how they got there</em> — and
        that one-way walk is enough to build a shared secret two strangers can agree
        on. The five exhibits below build that up, then show how a cousin scheme
        (SIDH) leaked just enough extra information to be broken. Every number is
        computed live in your browser with exact arithmetic over
        <span class="m">GF(${PARAMS.p})</span>; nothing is faked.
      </p>
    </section>

    <section id="exhibit-1" aria-labelledby="h1-1">
      <h2 id="h1-1">1 · What is an isogeny?</h2>
      <p>
        An isogeny <span class="m">φ: E → E′</span> is a non-trivial map between
        elliptic curves that is both a
        <button type="button" class="gloss" data-term="homomorphism">group
        homomorphism</button> and a rational map. It sends the identity to the
        identity and respects point addition. Below, <span class="m">φ</span> is a
        real ${ELL_A}-isogeny computed with Vélu's formulas from the base curve.
      </p>
      <p>
        The static picture of two point clouds hides what <span class="m">φ</span>
        actually <em>does</em>. Press <strong>Animate the map</strong> to watch each
        point of <span class="m">E₀</span> travel to its image
        <span class="m">φ(P)</span> on <span class="m">E′</span>. Two things to
        watch: the <span class="swatch-inline swatch-kernel"></span>
        <strong>kernel</strong> points all collapse onto a single spot — the
        identity — and a
        <button type="button" class="gloss" data-term="preserved">preserved
        addition</button> <span class="m">P + Q</span> lands exactly on
        <span class="m">φ(P) + φ(Q)</span>. That is what "structure-preserving map"
        means, shown rather than asserted.
      </p>
      <div class="canvas-wrap">
        <canvas id="canvas-isogeny" width="640" height="360"
          role="img" aria-label="Animation of a real isogeny mapping each point of the domain curve to its image on the codomain curve, with the kernel collapsing to the identity and one preserved point addition"></canvas>
      </div>
      <div class="controls">
        <button id="btn-run-isogeny" type="button">Animate the map φ</button>
        <button id="btn-replay-isogeny" type="button" hidden>Replay</button>
      </div>
      <div id="isogeny-output" class="output" aria-live="polite"></div>
    </section>

    <section id="exhibit-2" aria-labelledby="h1-2">
      <h2 id="h1-2">2 · The isogeny graph</h2>
      <p>
        The supersingular curves over <span class="m">GF(${PARAMS.p})</span> form
        a graph: vertices are
        <button type="button" class="gloss" data-term="j-invariant"><span class="m">j</span>-invariants</button>,
        edges are ℓ-isogenies. It is an
        <button type="button" class="gloss" data-term="expander">expander</button>
        — short random walks mix rapidly — and finding the path between two given
        vertices is the hard problem isogeny cryptography rests on.
      </p>
      <p>
        <strong>Build a walk yourself.</strong> Each button below takes one real
        ℓ-isogeny step and moves the current vertex by one edge. Your
        <button type="button" class="gloss" data-term="exponent-vector">exponent
        vector</button> — how many of each colour step you took — <em>is</em> a
        CSIDH secret. That is the whole idea of the next exhibit: a secret is just a
        walk.
      </p>
      <div class="canvas-wrap">
        <canvas id="canvas-graph" width="640" height="440"
          role="img" aria-label="The supersingular isogeny graph with the walk you build step by step highlighted"></canvas>
      </div>
      <p class="legend" id="graph-legend"></p>
      <div class="controls">
        <button id="btn-step-a" type="button">+1 ${ELL_A}-isogeny</button>
        <button id="btn-step-b" type="button">+1 ${ELL_B}-isogeny</button>
        <button id="btn-reset-walk" type="button" class="btn-secondary">Reset to E₀</button>
        <button id="btn-random-walk" type="button" class="btn-secondary">Random walk</button>
      </div>
      <div id="graph-output" class="output" aria-live="polite"></div>
    </section>

    <section id="exhibit-3" aria-labelledby="h1-3">
      <h2 id="h1-3">3 · CSIDH key exchange</h2>
      <p>
        Alice and Bob each pick a secret vector of exponents and walk the graph
        from the base curve. They publish where they land; then each walks their
        own secret again from the other's curve. Because the
        <button type="button" class="gloss" data-term="group-action">class-group
        action</button>
        <button type="button" class="gloss" data-term="commutes"><strong>commutes</strong></button>,
        they arrive at the very same curve — the shared secret. This is the genuine
        CSIDH construction, a present-day survivor of the isogeny world.
      </p>
      <p>
        Watch it happen <em>on the same graph as exhibit 2</em>:
        <span class="swatch-inline" style="background:var(--c-alice)"></span>
        Alice walks from <span class="m">E₀</span>,
        <span class="swatch-inline" style="background:var(--c-bob)"></span>
        Bob walks from <span class="m">E₀</span>, then each re-walks their own secret
        (dashed) from the other's endpoint. The two dashed paths close into one
        vertex — the
        <span class="swatch-inline" style="background:var(--c-shared)"></span>
        <strong>shared secret</strong>. That closing diamond <em>is</em>
        commutativity.
      </p>
      <div class="canvas-wrap">
        <canvas id="canvas-kex" width="640" height="440"
          role="img" aria-label="Alice's and Bob's key-exchange walks animated on the isogeny graph, converging on a single shared-secret vertex"></canvas>
      </div>
      <p class="legend" id="kex-legend"></p>
      <div class="controls">
        <button id="btn-run-sidh" type="button">Animate the key exchange</button>
      </div>
      <div id="sidh-output" class="output" aria-live="polite"></div>
    </section>

    <section id="exhibit-4" aria-labelledby="h1-4">
      <h2 id="h1-4">4 · The gate: breaking it</h2>
      <p>
        <strong>What broke SIDH.</strong> SIDH (a different scheme) had each party
        publish not just their curve but the
        <button type="button" class="gloss" data-term="torsion">images of torsion
        points</button> under their secret isogeny. In August 2022, Castryck and
        Decru showed those images over-determine the secret: glued into a
        higher-dimensional
        <button type="button" class="gloss" data-term="abelian-surface">abelian
        surface</button> (via
        <button type="button" class="gloss" data-term="kani">Kani's lemma</button>),
        they let an attacker reconstruct the secret isogeny in <em>minutes</em>. A
        decade-old candidate fell. CSIDH publishes only a curve — no torsion images
        — so that attack does not apply to it.
      </p>
      <p>
        <strong>What we can break here.</strong> Our parameters are tiny, so the
        whole key space is brute-forceable. The grid below is the entire key space —
        one cell per candidate exponent vector <span class="m">(${ELL_A}<sup>i</sup>, ${ELL_B}<sup>j</sup>)</span>.
        Brute force lights up each cell as it is tested until one reproduces
        Alice's public curve. This works <em>only</em> because the grid has just
        <span class="m">${(PARAMS.expBound + 1) ** 2}</span> cells; real CSIDH's grid
        is astronomically large. Note this is <strong>not</strong> the
        Castryck–Decru attack — that broke SIDH with no brute force at all, by
        exploiting published torsion images (above).
      </p>
      <div class="canvas-wrap">
        <canvas id="canvas-keyspace" width="640" height="300"
          role="img" aria-label="A grid of every candidate secret vector; the brute-force search lights up each cell as it is tested until the matching secret is found"></canvas>
      </div>
      <div class="controls">
        <button id="btn-run-attack" type="button">Brute-force Alice's secret</button>
      </div>
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

  <div id="gloss-popover" class="gloss-popover" role="tooltip" aria-label="Glossary definition" hidden></div>

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

/** Respect the user's reduced-motion preference: skip animation, show end state. */
function prefersReducedMotion(): boolean {
  return (
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/**
 * Run `onFrame(t)` with t going 0→1 over `durationMs`, then `onDone`. If the user
 * prefers reduced motion, jump straight to the final frame. Returns a canceller.
 */
function animate(
  durationMs: number,
  onFrame: (t: number) => void,
  onDone?: () => void
): () => void {
  if (prefersReducedMotion() || durationMs <= 0) {
    onFrame(1);
    onDone?.();
    return () => {};
  }
  let raf = 0;
  const start = performance.now();
  const tick = (now: number) => {
    const t = Math.min(1, (now - start) / durationMs);
    onFrame(t);
    if (t < 1) raf = requestAnimationFrame(tick);
    else onDone?.();
  };
  raf = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(raf);
}

/* ------------------------------------------------------------------ *
 * Glossary — cheap inline definitions for load-bearing jargon. A single
 * popover is positioned under whichever .gloss button is activated. This
 * introduces terms instead of assuming them, without leaving the page.
 * ------------------------------------------------------------------ */

const GLOSSARY: Record<string, string> = {
  'j-invariant':
    'j-invariant: a fingerprint number identifying a curve up to isomorphism. Two curves with the same j are the same shape, so a graph vertex is really "all curves with this j".',
  'homomorphism':
    'group homomorphism: a map that respects addition — φ(P + Q) = φ(P) + φ(Q), and φ(identity) = identity. The isogeny is one, which is why the group structure survives the hop.',
  'preserved':
    'preserved addition: because φ is a homomorphism, adding first then mapping equals mapping first then adding. The animation shows P + Q on E₀ landing on φ(P) + φ(Q) on E′.',
  'expander':
    'expander graph: a graph where short random walks reach anywhere quickly and mix uniformly — so from an endpoint you cannot tell how many steps someone took or which way they went.',
  'exponent-vector':
    'exponent vector: how many steps of each colour (ℓ) you took, e.g. [3, 2] = three 5-isogenies then two 7-isogenies. In CSIDH this vector IS the secret key.',
  'group-action':
    'class-group action: a fixed set of reversible "moves" (one per ℓ) that act on curves. Applying a move commutes with every other, which is exactly what the key exchange needs.',
  'commutes':
    'commutes: order does not matter. Alice-then-Bob lands on the same curve as Bob-then-Alice. That shared landing point is the secret both compute without ever meeting.',
  'torsion':
    'torsion points: points of small fixed order on the curve. SIDH published the images of specific torsion points under each secret isogeny — extra data CSIDH never reveals.',
  'abelian-surface':
    'abelian surface: a two-dimensional generalisation of an elliptic curve. Castryck–Decru glued the SIDH curves into one of these, where the leaked torsion data becomes an exploitable structure.',
  'kani':
    "Kani's lemma: a criterion telling you when two isogenies glue into a single isogeny between abelian surfaces. It is the gluing tool that turned SIDH's torsion images into a fast attack.",
};

const glossPopover = document.getElementById('gloss-popover') as HTMLDivElement;
let glossAnchor: HTMLElement | null = null;

function hideGloss() {
  glossPopover.hidden = true;
  if (glossAnchor) glossAnchor.setAttribute('aria-expanded', 'false');
  glossAnchor = null;
}

function showGloss(btn: HTMLElement) {
  const term = btn.dataset.term ?? '';
  const text = GLOSSARY[term];
  if (!text) return;
  if (glossAnchor === btn && !glossPopover.hidden) {
    hideGloss();
    return;
  }
  glossPopover.textContent = text;
  glossPopover.hidden = false;
  glossAnchor = btn;
  btn.setAttribute('aria-expanded', 'true');
  const r = btn.getBoundingClientRect();
  const top = r.bottom + window.scrollY + 6;
  const maxLeft = window.scrollX + document.documentElement.clientWidth - glossPopover.offsetWidth - 12;
  const left = Math.min(r.left + window.scrollX, Math.max(12, maxLeft));
  glossPopover.style.top = `${top}px`;
  glossPopover.style.left = `${left}px`;
}

document.querySelectorAll('.gloss').forEach((el) => {
  const btn = el as HTMLButtonElement;
  btn.setAttribute('aria-expanded', 'false');
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    showGloss(btn);
  });
});
document.addEventListener('click', (e) => {
  if (glossAnchor && e.target !== glossAnchor && !glossPopover.contains(e.target as Node)) {
    hideGloss();
  }
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') hideGloss();
});

/* ------------------------------------------------------------------ *
 * Exhibit 1 — a real isogeny, drawn as two point clouds
 * ------------------------------------------------------------------ */

const canvasIsogeny = document.getElementById('canvas-isogeny') as HTMLCanvasElement;
const isogenyOutput = document.getElementById('isogeny-output') as HTMLDivElement;
const btnReplayIsog = document.getElementById('btn-replay-isogeny') as HTMLButtonElement;

/**
 * A prepared, deterministic isogeny scene: the real kernel, codomain, and the
 * image of every domain point under φ (all via veluEvaluate), plus a chosen
 * P, Q, P+Q triple whose images demonstrate the homomorphism property.
 */
interface IsogenyScene {
  kernelGen: NonNullable<ECPoint>;
  codomain: Curve;
  ell: number;
  /** For each domain affine point: source (E₀) and image (E′ or identity). */
  moves: { src: NonNullable<ECPoint>; img: ECPoint; inKernel: boolean }[];
  P: NonNullable<ECPoint>;
  Q: NonNullable<ECPoint>;
  PQ: NonNullable<ECPoint>;
}

let scene: IsogenyScene | null = null;
let cancelIsogAnim: () => void = () => {};
let isogAnimT = 1; // 0→1 progress of the last-started animation

/** Find a rational kernel generator of order ELL_A on E₀ (deterministic scan). */
function kernelGeneratorFor(curve: Curve, ell: number): NonNullable<ECPoint> {
  const cof = (curve.p + 1n) / BigInt(ell);
  const ellBig = BigInt(ell);
  // Deterministic: scan x = 0,1,2,… for a point, multiply by cofactor.
  for (let x = 0n; x < curve.p; x++) {
    const rhs = (x * x * x + curve.a * x + curve.b) % curve.p;
    const yy = sceneSqrt(rhs, curve.p);
    if (yy === null) continue;
    const R = { x, y: yy };
    const K = scalarMul(cof, R, curve);
    if (K !== null && scalarMul(ellBig, K, curve) === null) return K;
  }
  throw new Error('no rational kernel generator');
}

// Small local sqrt for the deterministic scan (p ≡ 3 mod 4 fast path is fine here).
function sceneSqrt(n: bigint, p: bigint): bigint | null {
  n = ((n % p) + p) % p;
  if (n === 0n) return 0n;
  let r = 1n;
  let base = n;
  let e = (p + 1n) / 4n;
  while (e > 0n) {
    if (e & 1n) r = (r * base) % p;
    base = (base * base) % p;
    e >>= 1n;
  }
  return (r * r) % p === n ? r : null;
}

function buildScene(): IsogenyScene {
  const ell = ELL_A;
  const K = kernelGeneratorFor(PARAMS.E0, ell);
  const codomain = veluCodomain(PARAMS.E0, K, ell);

  const kernelSet = new Set<string>();
  let Kacc: ECPoint = K;
  for (let i = 1; i < ell; i++) {
    if (Kacc) kernelSet.add(`${Kacc.x},${Kacc.y}`);
    Kacc = pointAdd(Kacc, K, PARAMS.E0);
  }

  const moves = allPoints(PARAMS.E0)
    .filter((P): P is NonNullable<ECPoint> => P !== null)
    .map((src) => ({
      src,
      img: veluEvaluate(PARAMS.E0, K, ell, src),
      inKernel: kernelSet.has(`${src.x},${src.y}`),
    }));

  // Pick a P, Q pair outside the kernel (so their images are affine) for the
  // preserved-addition demo. Deterministic: first two non-kernel points that
  // give a non-identity, non-kernel sum.
  const nonKernel = moves.filter((m) => !m.inKernel && m.img !== null);
  let P = nonKernel[0].src;
  let Q = nonKernel[1].src;
  let PQ = pointAdd(P, Q, PARAMS.E0);
  for (let i = 0; i < nonKernel.length && (PQ === null || veluEvaluate(PARAMS.E0, K, ell, PQ) === null); i++) {
    for (let j = i + 1; j < nonKernel.length; j++) {
      const cand = pointAdd(nonKernel[i].src, nonKernel[j].src, PARAMS.E0);
      if (cand !== null && veluEvaluate(PARAMS.E0, K, ell, cand) !== null) {
        P = nonKernel[i].src;
        Q = nonKernel[j].src;
        PQ = cand;
        break;
      }
    }
  }
  return { kernelGen: K, codomain, ell, moves, P, Q, PQ: PQ as NonNullable<ECPoint> };
}

// Geometry helpers shared by the render.
function isogLayout(cssW: number, cssH: number) {
  const pad = 20;
  const boxW = (cssW - 3 * pad) / 2;
  const boxH = cssH - 84;
  const top = 40;
  return {
    left: { x: pad, y: top, w: boxW, h: boxH },
    right: { x: 2 * pad + boxW, y: top, w: boxW, h: boxH },
  };
}
function mapToBox(P: NonNullable<ECPoint>, box: { x: number; y: number; w: number; h: number }) {
  const p = Number(PARAMS.p);
  return {
    x: box.x + (Number(P.x) / p) * box.w,
    y: box.y + box.h - (Number(P.y) / p) * box.h,
  };
}
// The identity O is drawn at the top-centre of a box (a fixed "collapse target").
function identityPos(box: { x: number; y: number; w: number; h: number }) {
  return { x: box.x + box.w / 2, y: box.y + 12 };
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
  const edge = cssVar('--c-edge');
  const { left, right } = isogLayout(cssW, cssH);

  // Titles + boxes.
  ctx.fillStyle = textColor;
  ctx.font = '13px ui-monospace, monospace';
  ctx.textAlign = 'center';
  ctx.fillText(`E₀  (j = ${jInvariant(PARAMS.E0)})`, left.x + left.w / 2, left.y - 10);
  ctx.strokeStyle = edge;
  ctx.lineWidth = 1;
  ctx.strokeRect(left.x, left.y, left.w, left.h);
  ctx.strokeRect(right.x, right.y, right.w, right.h);

  if (!scene) {
    ctx.fillStyle = cssVar('--c-muted');
    ctx.fillText('φ(E₀) = ?', right.x + right.w / 2, right.y - 10);
    ctx.fillText('Press "Animate the map φ".', right.x + right.w / 2, right.y + right.h / 2);
    // draw domain cloud so there is something to see initially
    ctx.fillStyle = cssVar('--c-accent');
    for (const P of allPoints(PARAMS.E0)) {
      if (!P) continue;
      const q = mapToBox(P, left);
      ctx.beginPath();
      ctx.arc(q.x, q.y, 1.8, 0, 2 * Math.PI);
      ctx.fill();
    }
    return;
  }

  ctx.fillStyle = textColor;
  ctx.fillText(`E′ = φ(E₀)  (j = ${jInvariant(scene.codomain)})`, right.x + right.w / 2, right.y - 10);

  const t = isogAnimT;
  const kernelColor = cssVar('--c-shared');
  const dotColor = cssVar('--c-accent');
  const imgColor = cssVar('--c-bob');
  const idLeft = identityPos(left);
  const idRight = identityPos(right);

  // Every point travels from its source (left) to its image (right, or the
  // identity marker). t interpolates the whole cloud across the gap.
  for (const m of scene.moves) {
    const from = mapToBox(m.src, left);
    const to = m.img ? mapToBox(m.img, right) : idRight;
    const x = from.x + (to.x - from.x) * t;
    const y = from.y + (to.y - from.y) * t;
    ctx.fillStyle = m.inKernel ? kernelColor : t < 0.5 ? dotColor : imgColor;
    ctx.beginPath();
    ctx.arc(x, y, m.inKernel ? 3 : 1.8, 0, 2 * Math.PI);
    ctx.fill();
  }

  // Identity markers (the collapse target) in both boxes.
  for (const idp of [idLeft, idRight]) {
    ctx.strokeStyle = kernelColor;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(idp.x, idp.y, 6, 0, 2 * Math.PI);
    ctx.stroke();
  }
  ctx.fillStyle = kernelColor;
  ctx.font = '11px ui-monospace, monospace';
  ctx.fillText('O (identity)', idRight.x, idRight.y - 10);

  // Preserved-addition triple: label P, Q, P+Q at their images (fade in near end).
  const labelAlpha = Math.max(0, (t - 0.6) / 0.4);
  if (labelAlpha > 0) {
    ctx.save();
    ctx.globalAlpha = labelAlpha;
    const triples: [NonNullable<ECPoint>, string][] = [
      [scene.P, 'φ(P)'],
      [scene.Q, 'φ(Q)'],
      [scene.PQ, 'φ(P+Q) = φ(P)+φ(Q)'],
    ];
    for (const [pt, lbl] of triples) {
      const img = veluEvaluate(PARAMS.E0, scene.kernelGen, scene.ell, pt);
      if (!img) continue;
      const q = mapToBox(img, right);
      ctx.fillStyle = cssVar('--c-accent-strong');
      ctx.beginPath();
      ctx.arc(q.x, q.y, 3.5, 0, 2 * Math.PI);
      ctx.fill();
      ctx.font = 'bold 10px ui-monospace, monospace';
      ctx.textAlign = q.x > right.x + right.w * 0.6 ? 'right' : 'left';
      ctx.fillText(lbl, q.x + (q.x > right.x + right.w * 0.6 ? -6 : 6), q.y - 5);
    }
    ctx.restore();
  }

  // The map arrow.
  ctx.strokeStyle = cssVar('--c-shared');
  ctx.fillStyle = cssVar('--c-shared');
  ctx.lineWidth = 2;
  const ay = left.y + left.h + 22;
  const ax0 = left.x + left.w * 0.5;
  const ax1 = right.x + right.w * 0.5;
  ctx.beginPath();
  ctx.moveTo(ax0, ay);
  ctx.lineTo(ax1, ay);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(ax1, ay);
  ctx.lineTo(ax1 - 9, ay - 5);
  ctx.lineTo(ax1 - 9, ay + 5);
  ctx.fill();
  ctx.font = '12px ui-monospace, monospace';
  ctx.textAlign = 'center';
  ctx.fillText(`φ  (real ${scene.ell}-isogeny, Vélu)`, (ax0 + ax1) / 2, ay - 8);
}

function runIsogenyAnimation() {
  cancelIsogAnim();
  scene = buildScene();
  const c = scene.codomain;
  const ss = isSupersingular(c);
  const kernelCount = scene.moves.filter((m) => m.inKernel).length;
  isogenyOutput.innerHTML = `
    <div class="kv"><span>Domain</span><code>E₀: y² = x³ + x</code></div>
    <div class="kv"><span>Codomain</span><code>E′: y² = x³ + ${c.a}x + ${c.b}</code></div>
    <div class="kv"><span>j-invariants</span><code>j(E₀) = ${jInvariant(PARAMS.E0)}  →  j(E′) = ${jInvariant(c)}</code></div>
    <div class="kv"><span>Kernel</span><code>${kernelCount} points (the ${scene.ell}-torsion subgroup) all collapse to O</code></div>
    <div class="kv"><span>Homomorphism</span><code>φ(P+Q) = φ(P)+φ(Q), verified live for the labelled triple</code></div>
    <div class="kv"><span>Point count</span><code>#E₀ = ${countPoints(PARAMS.E0)},  #E′ = ${countPoints(c)}  (both = p+1)</code></div>
    <div class="kv"><span>Codomain supersingular?</span><code>${ss ? '✓ yes' : '✗ no'}</code></div>
  `;
  btnReplayIsog.hidden = false;
  cancelIsogAnim = animate(
    1600,
    (t) => {
      // ease-in-out
      isogAnimT = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
      renderIsogeny();
    },
    () => {
      isogAnimT = 1;
      renderIsogeny();
    }
  );
}

document.getElementById('btn-run-isogeny')!.addEventListener('click', runIsogenyAnimation);
btnReplayIsog.addEventListener('click', runIsogenyAnimation);

/* ------------------------------------------------------------------ *
 * Exhibit 2 — the real isogeny graph
 * ------------------------------------------------------------------ */

const canvasGraph = document.getElementById('canvas-graph') as HTMLCanvasElement;
const graphOutput = document.getElementById('graph-output') as HTMLDivElement;
const graph = buildIsogenyGraph();

// A walk the learner builds one edge at a time: node ids visited, and how many
// of each ℓ were used (the running exponent vector = a CSIDH secret).
let walkPath: number[] = [0];
const exponents: Record<number, number> = { [ELL_A]: 0, [ELL_B]: 0 };

document.getElementById('graph-legend')!.innerHTML = `
  <span class="swatch" style="background:var(--c-ell-a)"></span> ${ELL_A}-isogeny
  &nbsp;&nbsp;<span class="swatch" style="background:var(--c-ell-b)"></span> ${ELL_B}-isogeny
  &nbsp;&nbsp;<span class="swatch" style="background:var(--c-shared)"></span> start (E₀)
  &nbsp;&nbsp;<span class="swatch" style="background:var(--c-alice)"></span> your walk
`;

function renderGraph() {
  drawIsogenyGraph(canvasGraph, graph, graphColors(), {
    highlightPath: walkPath.length > 1 ? walkPath : undefined,
    startId: 0,
    markNodes: [
      { id: walkPath[walkPath.length - 1], color: cssVar('--c-alice'), label: 'here' },
    ],
  });
}

function updateWalkOutput() {
  const current = walkPath[walkPath.length - 1];
  const js = walkPath.map((id) => graph.nodes[id].j).join(' → ');
  graphOutput.innerHTML = `
    <div class="kv"><span>Exponent vector</span><code>[${exponents[ELL_A]}, ${exponents[ELL_B]}] = ${ELL_A}^${exponents[ELL_A]} · ${ELL_B}^${exponents[ELL_B]}  ← this is a secret</code></div>
    <div class="kv"><span>Current curve</span><code>j = ${graph.nodes[current].j}</code></div>
    <div class="kv"><span>Walk (j-invariants)</span><code>${js}</code></div>
    <div class="kv"><span>Steps taken</span><code>${walkPath.length - 1} ℓ-isogenies from E₀</code></div>`;
}

function takeStep(ell: number) {
  const current = walkPath[walkPath.length - 1];
  const next = stepInGraph(graph, current, ell);
  if (next < 0) return; // should not happen for the fully-explored graph
  walkPath.push(next);
  exponents[ell] += 1;
  renderGraph();
  updateWalkOutput();
}

document.getElementById('btn-step-a')!.addEventListener('click', () => takeStep(ELL_A));
document.getElementById('btn-step-b')!.addEventListener('click', () => takeStep(ELL_B));

document.getElementById('btn-reset-walk')!.addEventListener('click', () => {
  walkPath = [0];
  exponents[ELL_A] = 0;
  exponents[ELL_B] = 0;
  renderGraph();
  graphOutput.innerHTML = '';
});

document.getElementById('btn-random-walk')!.addEventListener('click', () => {
  // Rebuild the exponent vector honestly by counting which ℓ each edge used.
  walkPath = randomWalk(graph, 0, 6);
  exponents[ELL_A] = 0;
  exponents[ELL_B] = 0;
  for (let i = 0; i + 1 < walkPath.length; i++) {
    const a = walkPath[i];
    const b = walkPath[i + 1];
    const edge = graph.edges.find(
      (e) => (e.from === a && e.to === b) || (e.from === b && e.to === a)
    );
    if (edge) exponents[edge.ell] += 1;
  }
  renderGraph();
  updateWalkOutput();
});

/* ------------------------------------------------------------------ *
 * Exhibit 3 — CSIDH key exchange
 * ------------------------------------------------------------------ */

const sidhOutput = document.getElementById('sidh-output') as HTMLDivElement;
const canvasKex = document.getElementById('canvas-kex') as HTMLCanvasElement;
let cancelKexAnim: () => void = () => {};

function fmtSecret(s: Secret): string {
  return PARAMS.ells.map((l, i) => `${l}^${s[i]}`).join(' · ');
}

document.getElementById('kex-legend')!.innerHTML = `
  <span class="swatch" style="background:var(--c-alice)"></span> Alice's walk
  &nbsp;&nbsp;<span class="swatch" style="background:var(--c-bob)"></span> Bob's walk
  &nbsp;&nbsp;<span class="swatch" style="background:var(--c-shared)"></span> shared secret (dashed = re-walk from the other's curve)
`;

// The node-path a secret traces from a starting curve, as graph vertex ids.
function nodePathFor(startCurve: Curve, secret: Secret): number[] {
  const { curves } = groupActionPath(startCurve, secret);
  return curves.map((c) => nodeIdForCurve(graph, c));
}

function drawKex(overlays: OverlayPath[], sharedId: number | null) {
  const marks = sharedId !== null
    ? [{ id: sharedId, color: cssVar('--c-shared'), label: 'shared secret' }]
    : [];
  drawIsogenyGraph(canvasKex, graph, graphColors(), {
    startId: 0,
    overlays,
    markNodes: marks,
  });
}

document.getElementById('btn-run-sidh')!.addEventListener('click', () => {
  cancelKexAnim();
  const r = keyExchange();

  // Real node paths for all four walks (two outbound, two re-walks).
  const alicePub = nodePathFor(PARAMS.E0, r.alice.secret);
  const bobPub = nodePathFor(PARAMS.E0, r.bob.secret);
  const aliceShared = nodePathFor(r.bob.publicCurve, r.alice.secret); // Alice re-walks from Bob's curve
  const bobShared = nodePathFor(r.alice.publicCurve, r.bob.secret); // Bob re-walks from Alice's curve
  const sharedId = aliceShared[aliceShared.length - 1];

  const cAlice = cssVar('--c-alice');
  const cBob = cssVar('--c-bob');

  const outSteps = Math.max(alicePub.length, bobPub.length) - 1;
  const reSteps = Math.max(aliceShared.length, bobShared.length) - 1;

  // Phase 1: both walk out from E₀. Phase 2: both re-walk (dashed) and converge.
  cancelKexAnim = animate(1400, (t) => {
    const p = t * outSteps;
    drawKex(
      [
        { nodes: alicePub, color: cAlice, progress: p },
        { nodes: bobPub, color: cBob, progress: p },
      ],
      null
    );
  }, () => {
    cancelKexAnim = animate(1400, (t) => {
      const p = t * reSteps;
      drawKex(
        [
          { nodes: alicePub, color: cAlice },
          { nodes: bobPub, color: cBob },
          { nodes: aliceShared, color: cAlice, dashed: true, progress: p },
          { nodes: bobShared, color: cBob, dashed: true, progress: p },
        ],
        t >= 1 ? sharedId : null
      );
    }, () => {
      drawKex(
        [
          { nodes: alicePub, color: cAlice },
          { nodes: bobPub, color: cBob },
          { nodes: aliceShared, color: cAlice, dashed: true },
          { nodes: bobShared, color: cBob, dashed: true },
        ],
        sharedId
      );
    });
  });

  sidhOutput.innerHTML = `
    <div class="kv"><span>Alice secret</span><code>[${r.alice.secret.join(', ')}]  =  ${fmtSecret(r.alice.secret)}</code></div>
    <div class="kv"><span>Bob secret</span><code>[${r.bob.secret.join(', ')}]  =  ${fmtSecret(r.bob.secret)}</code></div>
    <div class="kv"><span>Alice public</span><code>j = ${jInvariant(r.alice.publicCurve)}  (where her walk from E₀ ends)</code></div>
    <div class="kv"><span>Bob public</span><code>j = ${jInvariant(r.bob.publicCurve)}  (where his walk from E₀ ends)</code></div>
    <div class="kv"><span>Alice re-walks</span><code>her secret from Bob's curve → j = ${jInvariant(r.aliceShared)}</code></div>
    <div class="kv"><span>Bob re-walks</span><code>his secret from Alice's curve → j = ${jInvariant(r.bobShared)}</code></div>
    <div class="kv result ${r.agree ? 'ok' : 'bad'}">
      <span>Shared secret</span>
      <code>${r.agree ? `✓ both parties agree — the diamonds close on the same vertex:  j = ${r.sharedInvariant}` : '✗ disagreement (should never happen)'}</code>
    </div>
  `;
});

/* ------------------------------------------------------------------ *
 * Exhibit 4 — brute-force recovery
 * ------------------------------------------------------------------ */

const attackOutput = document.getElementById('attack-output') as HTMLDivElement;
const canvasKeyspace = document.getElementById('canvas-keyspace') as HTMLCanvasElement;
const RANGE = PARAMS.expBound + 1; // grid side: exponents 0..expBound

let cancelAttackAnim: () => void = () => {};

/**
 * Draw the key-space grid. `tested` cells (in brute-force enumeration order) are
 * lit as "checked"; `matchIdx` (if set) is drawn as the found secret. The
 * enumeration order matches bruteForceRecover: idx → (idx%RANGE, ⌊idx/RANGE⌋),
 * i.e. the first exponent (5-isogeny count) varies fastest.
 */
function drawKeyspace(tested: number, matchIdx: number | null) {
  const ctx = canvasKeyspace.getContext('2d');
  if (!ctx) return;
  const cssW = canvasKeyspace.clientWidth || canvasKeyspace.width;
  const cssH = canvasKeyspace.clientHeight || canvasKeyspace.height;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvasKeyspace.width = Math.round(cssW * dpr);
  canvasKeyspace.height = Math.round(cssH * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  ctx.fillStyle = cssVar('--canvas-bg');
  ctx.fillRect(0, 0, cssW, cssH);

  const marginL = 46;
  const marginB = 30;
  const marginT = 24;
  const gridW = cssW - marginL - 16;
  const gridH = cssH - marginB - marginT;
  const cell = Math.min(gridW / RANGE, gridH / RANGE);
  const ox = marginL;
  const oy = marginT;

  const border = cssVar('--c-border');
  const untested = cssVar('--c-surface');
  const testedCol = cssVar('--c-ell-b');
  const matchCol = cssVar('--c-shared');
  const textCol = cssVar('--c-text');
  const mutedCol = cssVar('--c-muted');

  for (let idx = 0; idx < RANGE * RANGE; idx++) {
    const i = idx % RANGE; // 5-exponent (column)
    const j = Math.floor(idx / RANGE); // 7-exponent (row)
    const x = ox + i * cell;
    const y = oy + j * cell;
    const isMatch = matchIdx !== null && idx === matchIdx;
    ctx.fillStyle = isMatch ? matchCol : idx < tested ? testedCol : untested;
    ctx.fillRect(x + 1, y + 1, cell - 2, cell - 2);
    ctx.strokeStyle = border;
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 1, y + 1, cell - 2, cell - 2);
    if (isMatch) {
      ctx.fillStyle = cssVar('--canvas-bg');
      ctx.font = 'bold 12px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('✓', x + cell / 2, y + cell / 2);
    }
  }

  // Axis labels.
  ctx.fillStyle = mutedCol;
  ctx.font = '11px ui-monospace, monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText(`${ELL_A}-isogeny exponent i →`, ox + (RANGE * cell) / 2, oy + RANGE * cell + 8);
  ctx.save();
  ctx.translate(14, oy + (RANGE * cell) / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(`${ELL_B}-isogeny exponent j →`, 0, 0);
  ctx.restore();

  ctx.fillStyle = textCol;
  ctx.font = '12px ui-monospace, monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  const done = matchIdx !== null && tested > matchIdx;
  ctx.fillText(
    done ? `${RANGE * RANGE}-cell key space — match found at cell ${matchIdx + 1}` : `searching ${RANGE * RANGE}-cell key space… ${tested} tested`,
    ox,
    4
  );
}

drawKeyspace(0, null);

document.getElementById('btn-run-attack')!.addEventListener('click', () => {
  cancelAttackAnim();
  const r = keyExchange();
  const rec = bruteForceRecover(r.alice.publicCurve, r.alice.secret);
  const reproduced = groupAction(PARAMS.E0, rec.recovered);
  // The matching index in the same enumeration bruteForceRecover uses.
  const matchIdx = rec.recovered[0] + rec.recovered[1] * RANGE;

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

  // Animate the search lighting up cells up to the match.
  cancelAttackAnim = animate(
    Math.min(1800, 40 * rec.tested + 200),
    (t) => {
      const lit = Math.round(t * rec.tested);
      drawKeyspace(lit, lit >= rec.tested ? matchIdx : null);
    },
    () => drawKeyspace(rec.tested, matchIdx)
  );
});

/* ------------------------------------------------------------------ *
 * Initial render + theme-change observer
 * ------------------------------------------------------------------ */

function renderAll() {
  paintToggle();
  renderIsogeny();
  renderGraph();
  // Redraw the static/last-state canvases in the current theme. The kex canvas
  // is animation-only, so a bare graph is fine until the button is pressed again.
  drawKex([], null);
  drawKeyspace(0, null);
  hideGloss();
}

renderAll();

new MutationObserver(renderAll).observe(htmlEl, {
  attributes: true,
  attributeFilter: ['data-theme'],
});

window.addEventListener('resize', () => {
  renderIsogeny();
  renderGraph();
  drawKex([], null);
  drawKeyspace(0, null);
  hideGloss();
});
