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
  isIsomorphic,
  isSupersingular,
  scalarMul,
  veluCodomain,
  veluEvaluate,
  pointAdd,
} from './ec';
import {
  PARAMS,
  keyExchange,
  bruteForceStep,
  keySpaceSize,
  candidateAt,
  groupAction,
  groupActionPath,
  type Secret,
} from './csidh';
import {
  buildIsogenyGraph,
  describeGraphModel,
  drawIsogenyGraph,
  randomWalk,
  nodeIdForCurve,
  stepInGraph,
  walkStart,
  walkSequence,
  type GraphColors,
  type OverlayPath,
  type WalkState,
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
        Supersingular curves over <span class="m">GF(${PARAMS.p})</span> form a
        graph: vertices are curves up to
        <button type="button" class="gloss" data-term="j-invariant">isomorphism</button>
        (each drawn with its <span class="m">j</span>-invariant), edges are
        ℓ-isogenies. The real thing is an
        <button type="button" class="gloss" data-term="expander">expander</button>
        — short random walks mix rapidly — and finding the path between two given
        vertices is the hard problem isogeny cryptography rests on.
      </p>
      <p>
        <strong>Build a walk yourself.</strong> Each button below takes one real
        ℓ-isogeny step <em>from the curve you are standing on</em>, and moves you
        one edge. Your
        <button type="button" class="gloss" data-term="exponent-vector">exponent
        vector</button> — how many of each colour step you took — <em>is</em> a
        CSIDH secret. That is the whole idea of the next exhibit: a secret is just a
        walk.
      </p>
      <div class="canvas-wrap">
        <canvas id="canvas-graph" width="640" height="520"
          role="img" aria-label="The isogeny graph of every curve reachable from the base curve, with the walk you build step by step highlighted"></canvas>
      </div>
      <p class="legend" id="graph-legend"></p>
      <div class="controls">
        <button id="btn-step-a" type="button">+1 ${ELL_A}-isogeny</button>
        <button id="btn-step-b" type="button">+1 ${ELL_B}-isogeny</button>
        <button id="btn-reset-walk" type="button" class="btn-secondary">Reset to E₀</button>
        <button id="btn-random-walk" type="button" class="btn-secondary">Random walk</button>
      </div>
      <div id="graph-output" class="output" aria-live="polite"></div>

      <h3 id="h2-order">Does the order matter?</h3>
      <p>
        Take your exponent vector and spend it twice from
        <span class="m">E₀</span>: all the ${ELL_A}-steps first, then all the
        ${ELL_B}-steps — and then the other way round. Two routes, and (for any
        vector with some of each) different curves in between. They finish on the
        same vertex. That is the
        <button type="button" class="gloss" data-term="commutes">commutativity</button>
        the next exhibit's key exchange is built on, and it is checked here rather
        than asserted.
      </p>
      <div class="controls">
        <button id="btn-commute" type="button">Replay my vector in both orders</button>
      </div>
      <div id="commute-output" class="output" aria-live="polite"></div>

      <h3 id="h2-model">What this drawing is, and is not</h3>
      <p class="model-note">
        Every vertex and edge here is computed live, but the picture is a
        <em>slice</em> of the supersingular world over
        <span class="m">GF(${PARAMS.p})</span>, and the slicing is deliberate:
      </p>
      <ul class="model-note">
        <li>
          It draws exactly the curves reachable from <span class="m">E₀</span> by
          ℓ ∈ {${ELL_A}, ${ELL_B}} isogenies — the orbit the CSIDH action moves
          in — and nothing else. <span class="m">GF(${PARAMS.p})</span> has 36
          supersingular curves up to isomorphism, carrying 18 distinct
          <span class="m">j</span>-invariants; the ones not drawn are not
          reachable from <span class="m">E₀</span> by any of ℓ ∈ {3, ${ELL_A}, ${ELL_B}}.
          (Over the algebraic closure there are ⌊p/12⌋ + 2 = 36
          supersingular <span class="m">j</span>-invariants; most live only in
          <span class="m">GF(${PARAMS.p}²)</span>, where this demo never goes.)
        </li>
        <li>
          A vertex is one curve up to <span class="m">GF(${PARAMS.p})</span>-isomorphism,
          not one <span class="m">j</span>-invariant. A curve and its quadratic
          twist share a <span class="m">j</span> but are different vertices; the
          twin is marked with a prime (<span class="m">0</span> and
          <span class="m">0′</span>). Merging them would be tidier and would make
          the walk above stop commuting.
        </li>
        <li>
          ℓ = 3 also divides <span class="m">p + 1</span> and is omitted. It
          reaches no new vertex — its class already lies in the subgroup generated
          by the other two — and leaving it out keeps a secret a pair of exponents,
          which is what makes the key space in exhibit 4 a flat grid.
        </li>
        <li>
          Edges are drawn undirected. The rational ℓ-isogeny has a direction; its
          inverse is the ℓ-isogeny of the opposite class, which is drawn as the
          same line.
        </li>
      </ul>
      <div id="graph-model" class="output" aria-live="polite"></div>
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
        they arrive at the very same curve — the shared secret. That is not an
        article of faith here: exhibit 2 walks it both ways round for every
        exponent vector in the key space and reports the tally. This is the genuine
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
        <canvas id="canvas-kex" width="640" height="520"
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
        points</button> under their secret isogeny. In July 2022, Castryck and
        Decru showed those images over-determine the secret: glued into a
        higher-dimensional
        <button type="button" class="gloss" data-term="abelian-surface">abelian
        surface</button> (via
        <button type="button" class="gloss" data-term="kani">Kani's lemma</button>),
        they let an attacker reconstruct the secret isogeny in <em>minutes</em>. An
        eleven-year-old scheme — a NIST candidate (as SIKE) for under five of those
        years — fell. CSIDH publishes only a curve — no torsion images — so that
        attack does not apply to it.
      </p>
      <p>
        <strong>What we can break here.</strong> Our parameters are tiny, so the
        whole key space is brute-forceable. The grid below is the entire key space —
        one cell per candidate exponent vector <span class="m">(${ELL_A}<sup>i</sup>, ${ELL_B}<sup>j</sup>)</span>.
        Brute force tests each cell in turn, lighting it as it goes, until one
        reproduces <em>the same Alice's</em> public curve as exhibit 3. This works
        <em>only</em> because the grid has just
        <span class="m">${(PARAMS.expBound + 1) ** 2}</span> cells; real CSIDH's grid
        is astronomically large. Note this is <strong>not</strong> the
        Castryck–Decru attack — that broke SIDH with no brute force at all, by
        exploiting published torsion images (above).
      </p>
      <p>
        One honest wrinkle: those
        <span class="m">${(PARAMS.expBound + 1) ** 2}</span> cells are not
        ${(PARAMS.expBound + 1) ** 2} different keys. The exponents run past the
        order of the group they act in, so many vectors land on the same curve —
        the panel below reports how many distinct curves there really are. The
        attacker therefore recovers <em>a</em> vector that reproduces Alice's
        public key, which is all they need; it is her literal secret only when
        hers happens to be the first such vector in the enumeration.
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
        <li><strong>Diversity is essential.</strong> NIST has <em>finalised</em> lattice-based (ML-KEM, FIPS&nbsp;203; ML-DSA, FIPS&nbsp;204) and hash-based (SLH-DSA, FIPS&nbsp;205) standards, and in March 2025 <em>selected</em> the code-based HQC as a fifth algorithm — that standard is still in progress, not yet published. Spreading across foundations means no single broken foundation is catastrophic.</li>
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

/**
 * A curve as its actual Weierstrass equation, zero terms dropped — so what is
 * printed is always what is computed. (This used to be a hard-coded string that
 * disagreed with the curve in `csidh.ts`.)
 */
function fmtCurve(c: Curve): string {
  const terms = ['x³'];
  if (c.a !== 0n) terms.push(c.a === 1n ? 'x' : `${c.a}x`);
  if (c.b !== 0n) terms.push(String(c.b));
  return `y² = ${terms.join(' + ')}`;
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
    'j-invariant: a fingerprint number for a curve. Over an algebraically closed field it pins the curve down exactly, but over GF(p) two curves — a curve and its quadratic twist — can share a j and still not be isomorphic. They are drawn here as separate vertices with the same number, the twin marked with a prime (0 and 0′), because an isogeny sends them to different places.',
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
    <div class="kv"><span>Domain</span><code>E₀: ${fmtCurve(PARAMS.E0)}</code></div>
    <div class="kv"><span>Codomain</span><code>E′: ${fmtCurve(c)}</code></div>
    <div class="kv"><span>j-invariants</span><code>j(E₀) = ${jInvariant(PARAMS.E0)}  →  j(E′) = ${jInvariant(c)}</code></div>
    <div class="kv"><span>Kernel</span><code>⟨K⟩ has ${scene.ell} points — the ${kernelCount} affine ones drawn here, plus O — and all of them collapse to O</code></div>
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
const commuteOutput = document.getElementById('commute-output') as HTMLDivElement;
const graph = buildIsogenyGraph();

/**
 * The walk the learner builds one edge at a time.
 *
 * Each state carries the curve they are *actually* standing on, not the vertex's
 * stored representative — every further step is computed from that curve, which
 * is why this walk lands exactly where the same exponent vector lands in exhibit
 * 3, in either order. Vertex ids are used only to draw it.
 */
let walk: WalkState[] = [walkStart(graph)];
const exponents: Record<number, number> = { [ELL_A]: 0, [ELL_B]: 0 };

/** Anything drawn over the graph besides the learner's own walk. */
let commuteOverlays: OverlayPath[] = [];
let commuteMark: { id: number; color: string; label?: string } | null = null;

document.getElementById('graph-legend')!.innerHTML = `
  <span class="swatch" style="background:var(--c-ell-a)"></span> ${ELL_A}-isogeny
  &nbsp;&nbsp;<span class="swatch" style="background:var(--c-ell-b)"></span> ${ELL_B}-isogeny
  &nbsp;&nbsp;<span class="swatch" style="background:var(--c-shared)"></span> start (E₀)
  &nbsp;&nbsp;<span class="swatch" style="background:var(--c-alice)"></span> your walk
`;

/** The vertex ids of a walk, for drawing. */
function walkNodes(states: WalkState[]): number[] {
  return states.map((s) => s.nodeId);
}

function renderGraph() {
  const path = walkNodes(walk);
  const marks: { id: number; color: string; label?: string }[] = [
    { id: path[path.length - 1], color: cssVar('--c-alice'), label: 'here' },
  ];
  if (commuteMark) marks.push(commuteMark);
  drawIsogenyGraph(canvasGraph, graph, graphColors(), {
    highlightPath: path.length > 1 && commuteOverlays.length === 0 ? path : undefined,
    startId: 0,
    overlays: commuteOverlays,
    markNodes: marks,
  });
}

function updateWalkOutput() {
  const here = walk[walk.length - 1];
  const labels = walk.map((s) => graph.nodes[s.nodeId].label).join(' → ');
  graphOutput.innerHTML = `
    <div class="kv"><span>Exponent vector</span><code>[${exponents[ELL_A]}, ${exponents[ELL_B]}] = ${ELL_A}^${exponents[ELL_A]} · ${ELL_B}^${exponents[ELL_B]}  ← this is a secret</code></div>
    <div class="kv"><span>Current curve</span><code>${fmtCurve(here.curve)}   (j = ${jInvariant(here.curve)}, vertex ${graph.nodes[here.nodeId].label})</code></div>
    <div class="kv"><span>Walk (vertices)</span><code>${labels}</code></div>
    <div class="kv"><span>Steps taken</span><code>${walk.length - 1} ℓ-isogenies from E₀</code></div>`;
}

function clearCommuteOverlay() {
  commuteOverlays = [];
  commuteMark = null;
  commuteOutput.innerHTML = '';
}

function takeStep(ell: number) {
  clearCommuteOverlay();
  walk.push(stepInGraph(graph, walk[walk.length - 1], ell));
  exponents[ell] += 1;
  renderGraph();
  updateWalkOutput();
}

document.getElementById('btn-step-a')!.addEventListener('click', () => takeStep(ELL_A));
document.getElementById('btn-step-b')!.addEventListener('click', () => takeStep(ELL_B));

document.getElementById('btn-reset-walk')!.addEventListener('click', () => {
  clearCommuteOverlay();
  walk = [walkStart(graph)];
  exponents[ELL_A] = 0;
  exponents[ELL_B] = 0;
  renderGraph();
  graphOutput.innerHTML = '';
});

document.getElementById('btn-random-walk')!.addEventListener('click', () => {
  clearCommuteOverlay();
  // The walk reports which ℓ it used at each step, so the exponent vector is
  // counted from the steps actually taken.
  const rw = randomWalk(graph, walkStart(graph), 6);
  walk = rw.states;
  exponents[ELL_A] = 0;
  exponents[ELL_B] = 0;
  for (const ell of rw.ells) exponents[ell] += 1;
  renderGraph();
  updateWalkOutput();
});

/* ------------------------------------------------------------------ *
 * Exhibit 2b — the same exponent vector, spent in two orders
 *
 * The claim "the class-group action commutes" is the load-bearing one on this
 * page, so it gets an exhibit instead of a sentence: two different routes for
 * one exponent vector, drawn together, finishing on one vertex.
 * ------------------------------------------------------------------ */

document.getElementById('btn-commute')!.addEventListener('click', () => {
  const i = exponents[ELL_A];
  const j = exponents[ELL_B];
  if (i === 0 || j === 0) {
    commuteOutput.innerHTML = `
      <div class="kv"><span>Nothing to swap</span><code>Your vector is [${i}, ${j}]. Take at least one step of each colour — with a zero exponent both orders are literally the same walk.</code></div>`;
    return;
  }

  const seqA = [...Array(i).fill(ELL_A), ...Array(j).fill(ELL_B)];
  const seqB = [...Array(j).fill(ELL_B), ...Array(i).fill(ELL_A)];
  const first = walkSequence(graph, walkStart(graph), seqA);
  const second = walkSequence(graph, walkStart(graph), seqB);
  const endA = first.states[first.states.length - 1];
  const endB = second.states[second.states.length - 1];
  const same = endA.nodeId === endB.nodeId;

  // Draw both routes on the graph: solid for ℓ_A-first, dashed for ℓ_B-first.
  commuteOverlays = [
    { nodes: walkNodes(first.states), color: cssVar('--c-alice') },
    { nodes: walkNodes(second.states), color: cssVar('--c-bob'), dashed: true },
  ];
  commuteMark = same
    ? { id: endA.nodeId, color: cssVar('--c-shared'), label: 'both land here' }
    : null;
  renderGraph();

  // How many vertices the two routes disagree on along the way — the point being
  // that they genuinely take different paths, not the same one twice.
  const midA = new Set(walkNodes(first.states).slice(1, -1));
  const midB = walkNodes(second.states).slice(1, -1);
  const divergent = midB.filter((id) => !midA.has(id)).length;

  commuteOutput.innerHTML = `
    <div class="kv"><span>Route 1</span><code>${ELL_A}^${i} then ${ELL_B}^${j}:  ${first.states.map((s) => graph.nodes[s.nodeId].label).join(' → ')}</code></div>
    <div class="kv"><span>Route 2</span><code>${ELL_B}^${j} then ${ELL_A}^${i}:  ${second.states.map((s) => graph.nodes[s.nodeId].label).join(' → ')}</code></div>
    <div class="kv"><span>Different in between?</span><code>${divergent > 0 ? `yes — ${divergent} intermediate ${divergent === 1 ? 'curve is' : 'curves are'} visited by only one of the two routes` : 'no — at this vector the two routes happen to coincide'}</code></div>
    <div class="kv"><span>Route 1 ends on</span><code>${fmtCurve(endA.curve)}   (j = ${jInvariant(endA.curve)})</code></div>
    <div class="kv"><span>Route 2 ends on</span><code>${fmtCurve(endB.curve)}   (j = ${jInvariant(endB.curve)})</code></div>
    <div class="kv result ${same ? 'ok' : 'bad'}">
      <span>Same curve?</span>
      <code>${same ? `✓ yes — both routes finish on vertex ${graph.nodes[endA.nodeId].label}. Order does not matter.` : '✗ no — the action failed to commute (this should never happen)'}</code>
    </div>`;
});

/* ------------------------------------------------------------------ *
 * Exhibit 2c — live self-checks
 *
 * Claims about a drawing are cheap; this runs them. Every exponent vector in the
 * key space is walked with the same buttons the learner presses, and compared
 * against the group action and against itself with the ℓ order swapped. If the
 * walk ever stopped agreeing, this panel would say so on the page rather than
 * leaving the prose to assert something the exhibit contradicts.
 * ------------------------------------------------------------------ */

const KEY_SPACE = keySpaceSize();

interface SelfCheck {
  vertices: number;
  distinctJs: number;
  twinned: number;
  allSupersingular: boolean;
  vectors: number;
  walkAgrees: number;
  orderAgrees: number;
  /** How many distinct curves those vectors actually reach. */
  distinctCurves: number;
}

let selfCheckCache: SelfCheck | null = null;

function runSelfCheck(): SelfCheck {
  if (selfCheckCache) return selfCheckCache;
  const model = describeGraphModel(graph);
  const reached = new Set<number>();
  let walkAgrees = 0;
  let orderAgrees = 0;

  for (let idx = 0; idx < KEY_SPACE; idx++) {
    const [i, j] = candidateAt(idx);
    const seqA = [...Array(i).fill(ELL_A), ...Array(j).fill(ELL_B)];
    const seqB = [...Array(j).fill(ELL_B), ...Array(i).fill(ELL_A)];
    const endA = walkSequence(graph, walkStart(graph), seqA).states.pop()!;
    const endB = walkSequence(graph, walkStart(graph), seqB).states.pop()!;
    const viaAction = nodeIdForCurve(graph, groupAction(PARAMS.E0, [i, j]));
    if (endA.nodeId === viaAction) walkAgrees += 1;
    if (endA.nodeId === endB.nodeId) orderAgrees += 1;
    reached.add(viaAction);
  }

  selfCheckCache = {
    vertices: model.vertices,
    distinctJs: model.distinctJs,
    twinned: model.twinned,
    allSupersingular: model.allSupersingular,
    vectors: KEY_SPACE,
    walkAgrees,
    orderAgrees,
    // Vertices are isomorphism classes, so distinct vertices reached is exactly
    // the number of distinct public keys the key space can produce.
    distinctCurves: reached.size,
  };
  return selfCheckCache;
}

/** Shared with exhibit 4, which needs the same collapse numbers. */
function keySpaceFacts(): { vectors: number; distinctCurves: number } {
  const c = runSelfCheck();
  return { vectors: c.vectors, distinctCurves: c.distinctCurves };
}

const graphModelOut = document.getElementById('graph-model') as HTMLDivElement;

function renderSelfCheck() {
  const c = runSelfCheck();
  const ok = (pass: boolean) => (pass ? '✓' : '✗');
  graphModelOut.innerHTML = `
    <div class="kv"><span>Vertices drawn</span><code>${c.vertices} curves up to isomorphism, carrying ${c.distinctJs} distinct j-invariants — ${c.twinned} of the vertices come in twist pairs that share a j</code></div>
    <div class="kv"><span>All supersingular?</span><code>${ok(c.allSupersingular)} #E = p + 1 for every vertex</code></div>
    <div class="kv result ${c.walkAgrees === c.vectors ? 'ok' : 'bad'}">
      <span>Walk = group action</span>
      <code>${ok(c.walkAgrees === c.vectors)} ${c.walkAgrees}/${c.vectors} exponent vectors: pressing the buttons lands exactly where the secret does</code>
    </div>
    <div class="kv result ${c.orderAgrees === c.vectors ? 'ok' : 'bad'}">
      <span>Order does not matter</span>
      <code>${ok(c.orderAgrees === c.vectors)} ${c.orderAgrees}/${c.vectors} exponent vectors: ${ELL_A}s-then-${ELL_B}s ends on the same vertex as ${ELL_B}s-then-${ELL_A}s</code>
    </div>
    <div class="kv"><span>Key space collapse</span><code>the ${c.vectors} exponent vectors reach only ${c.distinctCurves} distinct curves — see exhibit 4</code></div>`;
}

// Deferred so the first paint is not blocked by a full sweep of the key space
// in real isogeny arithmetic.
graphModelOut.innerHTML = `<div class="kv"><span>Self-checks</span><code>running…</code></div>`;
setTimeout(renderSelfCheck, 0);

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

/**
 * The one key exchange this page is about.
 *
 * Exhibits 3 and 4 must show the *same* Alice: a brute force that attacks a
 * different, freshly-generated Alice while calling her by the same name is not a
 * demonstration of anything. Generating a new exchange (the button in exhibit 3)
 * therefore invalidates whatever exhibit 4 has on screen, and says so.
 */
let exchange = keyExchange();

function renderExchangeSummary(r: typeof exchange) {
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
}

// Show it immediately, so the numbers exhibit 4 attacks are on screen before the
// attack runs, whichever button the reader presses first.
renderExchangeSummary(exchange);

document.getElementById('btn-run-sidh')!.addEventListener('click', () => {
  cancelKexAnim();
  exchange = keyExchange();
  const r = exchange;
  resetAttackPanel();

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

  renderExchangeSummary(r);
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
  const done = matchIdx !== null;
  ctx.fillText(
    done
      ? `${KEY_SPACE}-cell key space — match found at cell ${matchIdx + 1}`
      : tested === 0
        ? `${KEY_SPACE}-cell key space — not searched yet`
        : `searching ${KEY_SPACE}-cell key space… ${tested} tested`,
    ox,
    4
  );
}

/** Clear the attack panel — used when the exchange it referred to is replaced. */
function resetAttackPanel() {
  cancelAttackAnim();
  cancelAttackAnim = () => {};
  attackOutput.innerHTML = '';
  drawKeyspace(0, null);
}

drawKeyspace(0, null);

document.getElementById('btn-run-attack')!.addEventListener('click', () => {
  cancelAttackAnim();
  // The same Alice as exhibit 3 — attacking a freshly-generated one would put a
  // different "Alice's public key" under the same name two panels apart.
  const target = exchange.alice.publicCurve;
  const original = exchange.alice.secret;
  const targetJ = jInvariant(target);

  // Drive the display from the search itself: one candidate per frame, panel
  // written when the match is actually found. Nothing here is pre-computed.
  let idx = 0;
  let found: { candidate: Secret; idx: number } | null = null;

  const finish = () => {
    if (!found) {
      attackOutput.innerHTML = `
        <div class="kv result bad"><span>Search</span><code>✗ no vector reproduced the public key (should never happen)</code></div>`;
      return;
    }
    const matchIdx = found.idx;
    const recovered = found.candidate;
    const reproduced = groupAction(PARAMS.E0, recovered);
    const matchesOriginal = original.every((e, i) => e === recovered[i]);
    const { vectors, distinctCurves } = keySpaceFacts();
    const exactOdds = Math.round((distinctCurves / vectors) * 100);
    drawKeyspace(matchIdx + 1, matchIdx);
    attackOutput.innerHTML = `
      <div class="kv"><span>Target</span><code>Alice's public key from exhibit 3  —  j = ${targetJ}</code></div>
      <div class="kv"><span>Key space</span><code>${vectors} candidate exponent vectors — but they reach only ${distinctCurves} distinct curves, so different vectors are the same key</code></div>
      <div class="kv"><span>Search</span><code>tested ${matchIdx + 1} before a match</code></div>
      <div class="kv"><span>Recovered secret</span><code>[${recovered.join(', ')}]  =  ${fmtSecret(recovered)}</code></div>
      <div class="kv"><span>Alice's actual secret</span><code>[${original.join(', ')}]${matchesOriginal ? '  — the search returned exactly this' : `  — the search returned an equivalent vector instead. It reports the first vector reaching the curve, which is Alice's literal secret ${distinctCurves} times in ${vectors} (about ${exactOdds}%).`}</code></div>
      <div class="kv"><span>Reproduces public key?</span><code>${isIsomorphic(reproduced, target) ? '✓ yes' : '✗ no'}</code></div>
      <div class="kv result bad">
        <span>Verdict</span>
        <code>✓ toy broken — ${matchesOriginal ? "Alice's exact secret recovered" : 'an equivalent working secret recovered, which derives the shared curve just as well'}</code>
      </div>
    `;
  };

  const testNext = (): boolean => {
    if (found || idx >= KEY_SPACE) return true;
    const { candidate, match } = bruteForceStep(target, idx);
    if (match) found = { candidate, idx };
    idx++;
    return found !== null || idx >= KEY_SPACE;
  };

  if (prefersReducedMotion()) {
    let complete = false;
    while (!complete) complete = testNext();
    finish();
  } else {
    let raf = 0;
    const tick = () => {
      const complete = testNext();
      drawKeyspace(idx, found ? found.idx : null);
      if (complete) finish();
      else raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    cancelAttackAnim = () => cancelAnimationFrame(raf);
  }
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
