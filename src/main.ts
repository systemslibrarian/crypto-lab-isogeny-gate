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
  randomSecret,
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
          supersingular <span class="m">j</span>-invariants; 18 of those are
          <span class="m">GF(${PARAMS.p})</span>-rational — the ones above — and the
          other half live only in <span class="m">GF(${PARAMS.p}²)</span>, where this
          demo never goes.)
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
      <fieldset class="secret-picker">
        <legend>Choose the secrets yourself</legend>
        <p class="secret-picker-note">
          Each exponent is how many times that party walks in that ℓ-direction, so
          it runs from 0 to ${PARAMS.expBound}. Nothing here is a preset: the
          exponents you type go straight into the same Vélu arithmetic, and
          exhibit 4 then attacks <em>your</em> Alice.
        </p>
        <div class="secret-row">
          <span class="secret-who">Alice</span>
          <label for="in-alice-a">${ELL_A}-isogenies</label>
          <input id="in-alice-a" type="number" min="0" max="${PARAMS.expBound}" step="1" value="0" inputmode="numeric" />
          <label for="in-alice-b">${ELL_B}-isogenies</label>
          <input id="in-alice-b" type="number" min="0" max="${PARAMS.expBound}" step="1" value="0" inputmode="numeric" />
        </div>
        <div class="secret-row">
          <span class="secret-who">Bob</span>
          <label for="in-bob-a">${ELL_A}-isogenies</label>
          <input id="in-bob-a" type="number" min="0" max="${PARAMS.expBound}" step="1" value="0" inputmode="numeric" />
          <label for="in-bob-b">${ELL_B}-isogenies</label>
          <input id="in-bob-b" type="number" min="0" max="${PARAMS.expBound}" step="1" value="0" inputmode="numeric" />
        </div>
        <div class="controls">
          <button id="btn-use-secrets" type="button">Run the exchange with these secrets</button>
          <button id="btn-random-secrets" type="button" class="btn-secondary">Randomise both</button>
        </div>
        <p id="secret-error" class="secret-error" role="alert"></p>
      </fieldset>
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

  <!-- No aria-label here. An aria-label on a tooltip REPLACES its text content
       as the accessible name, so this element used to announce itself as
       "Glossary definition" and the definition itself was never read. The
       content is the name; the term button points at it with aria-describedby
       while it is open. -->
  <div id="gloss-popover" class="gloss-popover" role="tooltip" hidden></div>

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
    // Fallback stroke for an ℓ with no colour of its own. It has never fired —
    // both ℓ values are in `ellEdge` — but a graph edge is a meaningful
    // graphic, so if it ever does it must already meet 1.4.11's 3:1.
    edge: cssVar('--c-control-border'),
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

/** A point as (x, y), or O for the identity. */
function fmtPoint(P: ECPoint): string {
  return P === null ? 'O' : `(${P.x}, ${P.y})`;
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
  if (glossAnchor) {
    glossAnchor.setAttribute('aria-expanded', 'false');
    // The description is only true while the popover is on screen and holding
    // THIS term's text, so the reference is dropped with it. Leaving it behind
    // would point a screen reader at a hidden element describing another word.
    glossAnchor.removeAttribute('aria-describedby');
  }
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
  // Clicking a second term while a first is open used to leave the first
  // button reporting aria-expanded="true" forever, so two buttons claimed an
  // open popover when only one existed. Clear the previous anchor first.
  if (glossAnchor && glossAnchor !== btn) {
    glossAnchor.setAttribute('aria-expanded', 'false');
    glossAnchor.removeAttribute('aria-describedby');
  }
  glossPopover.textContent = text;
  glossPopover.hidden = false;
  glossAnchor = btn;
  btn.setAttribute('aria-expanded', 'true');
  // Without this the definition is unreachable to a screen reader: the popover
  // is not in the button's subtree and nothing referenced it, so activating a
  // glossary term announced a state change and no definition. See index.html
  // for the matching removal of the popover's own aria-label, which was
  // overriding the definition text with the words "Glossary definition".
  btn.setAttribute('aria-describedby', 'gloss-popover');
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
  /** φ(P), φ(Q), φ(P+Q) on the codomain — the points the labels point at. */
  imgP: ECPoint;
  imgQ: ECPoint;
  imgPQ: ECPoint;
  /** φ(P) + φ(Q), added on the CODOMAIN curve. */
  sumOfImages: ECPoint;
  /**
   * Whether φ(P+Q) really equals φ(P)+φ(Q) for this triple — compared here, not
   * assumed. The panel prints whatever this says; if the Vélu image formula were
   * wrong the page would report the failure instead of claiming a verification
   * that never happened.
   */
  homomorphismHolds: boolean;
}

/** Are two codomain points equal (both identity, or same affine coordinates)? */
function samePoint(A: ECPoint, B: ECPoint): boolean {
  if (A === null || B === null) return A === B;
  return A.x === B.x && A.y === B.y;
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
  // Push the triple through φ and ACTUALLY CHECK the homomorphism property:
  // add φ(P) and φ(Q) on the codomain and compare with φ(P+Q). The panel reports
  // the comparison, so "verified live" means a comparison really happened.
  const imgP = veluEvaluate(PARAMS.E0, K, ell, P);
  const imgQ = veluEvaluate(PARAMS.E0, K, ell, Q);
  const imgPQ = veluEvaluate(PARAMS.E0, K, ell, PQ);
  const sumOfImages = pointAdd(imgP, imgQ, codomain);

  return {
    kernelGen: K,
    codomain,
    ell,
    moves,
    P,
    Q,
    PQ: PQ as NonNullable<ECPoint>,
    imgP,
    imgQ,
    imgPQ,
    sumOfImages,
    homomorphismHolds: samePoint(imgPQ, sumOfImages),
  };
}

/**
 * Stroke a 1px rectangle so the line lands on whole device pixels.
 *
 * A 1px stroke is centred on its path, so at integer coordinates it straddles
 * two pixel columns and the compositor paints each at half strength. That
 * halves the line's contrast against the canvas: measured from the shipped
 * build, the exhibit-1 box outline was authored at 2.25:1 (dark) and rendered
 * at 1.43:1 — an antialiasing artefact silently eating a WCAG 1.4.11 boundary.
 * Snapping to half-integer coordinates makes the same stroke crisp, so the
 * colour in the stylesheet is the colour on screen.
 */
function strokeRectCrisp(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number
): void {
  const x0 = Math.round(x) + 0.5;
  const y0 = Math.round(y) + 0.5;
  ctx.strokeRect(x0, y0, Math.round(x + w) - Math.round(x) - 1, Math.round(y + h) - Math.round(y) - 1);
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
  // These two rectangles are what separates "the domain curve E₀" from "the
  // codomain curve E′" — the whole point of the exhibit is which cloud a point
  // is in — so they are a meaningful graphic and owe 1.4.11 its 3:1. They used
  // to be drawn in --c-edge, a decorative hairline that measured 2.25:1 (dark)
  // / 1.90:1 (light) and rendered at 1.43:1 / 1.36:1 once antialiased.
  const edge = cssVar('--c-control-border');
  const { left, right } = isogLayout(cssW, cssH);

  // Titles + boxes.
  ctx.fillStyle = textColor;
  ctx.font = '13px ui-monospace, monospace';
  ctx.textAlign = 'center';
  ctx.fillText(`E₀  (j = ${jInvariant(PARAMS.E0)})`, left.x + left.w / 2, left.y - 10);
  ctx.strokeStyle = edge;
  ctx.lineWidth = 1;
  strokeRectCrisp(ctx, left.x, left.y, left.w, left.h);
  strokeRectCrisp(ctx, right.x, right.y, right.w, right.h);

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
    // The third label only claims the equality when the comparison in
    // buildScene() actually found it; otherwise it names just what is drawn.
    const triples: [ECPoint, string][] = [
      [scene.imgP, 'φ(P)'],
      [scene.imgQ, 'φ(Q)'],
      [
        scene.imgPQ,
        scene.homomorphismHolds ? 'φ(P+Q) = φ(P)+φ(Q) ✓' : 'φ(P+Q) ≠ φ(P)+φ(Q) ✗',
      ],
    ];
    for (const [img, lbl] of triples) {
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
  const kernelMoves = scene.moves.filter((m) => m.inKernel);
  const kernelCount = kernelMoves.length;
  // "The kernel collapses to O" is checked, not asserted: every kernel point's
  // image really is the identity (veluEvaluate returns null), and O itself maps
  // to O. Counted from the images the animation actually draws.
  const collapsed = kernelMoves.filter((m) => m.img === null).length;
  const kernelCollapses =
    collapsed === kernelCount &&
    veluEvaluate(PARAMS.E0, scene.kernelGen, scene.ell, null) === null;
  isogenyOutput.innerHTML = `
    <div class="kv"><span>Domain</span><code>E₀: ${fmtCurve(PARAMS.E0)}</code></div>
    <div class="kv"><span>Codomain</span><code>E′: ${fmtCurve(c)}</code></div>
    <div class="kv"><span>j-invariants</span><code>j(E₀) = ${jInvariant(PARAMS.E0)}  →  j(E′) = ${jInvariant(c)}</code></div>
    <div class="kv result ${kernelCollapses ? 'ok' : 'bad'}">
      <span>Kernel</span>
      <code>${
        kernelCollapses
          ? `✓ ⟨K⟩ has ${scene.ell} points — the ${kernelCount} affine ones drawn here, plus O — and all ${scene.ell} evaluate to O under φ (checked)`
          : `✗ only ${collapsed} of the ${kernelCount} affine kernel points evaluated to O (this should never happen)`
      }</code>
    </div>
    <div class="kv"><span>Preserved addition</span><code>P = ${fmtPoint(scene.P)}, Q = ${fmtPoint(scene.Q)}, P+Q = ${fmtPoint(scene.PQ)}  (on E₀)</code></div>
    <div class="kv"><span></span><code>φ(P) = ${fmtPoint(scene.imgP)}, φ(Q) = ${fmtPoint(scene.imgQ)}  →  φ(P)+φ(Q) = ${fmtPoint(scene.sumOfImages)}  (added on E′)</code></div>
    <div class="kv result ${scene.homomorphismHolds ? 'ok' : 'bad'}">
      <span>Homomorphism</span>
      <code>${
        scene.homomorphismHolds
          ? `✓ φ(P+Q) = ${fmtPoint(scene.imgPQ)} = φ(P)+φ(Q) — compared just now, not assumed`
          : `✗ φ(P+Q) = ${fmtPoint(scene.imgPQ)} but φ(P)+φ(Q) = ${fmtPoint(scene.sumOfImages)} — φ is not a homomorphism here (this should never happen)`
      }</code>
    </div>
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
  /**
   * Vertex id reached by candidate `idx`, for every idx in the key space. This
   * is what lets exhibit 3 name the *whole* collision class of a chosen secret
   * (every exponent vector producing the same public curve) instead of quoting
   * an aggregate collision rate at the learner.
   */
  nodeByIdx: number[];
}

let selfCheckCache: SelfCheck | null = null;

function runSelfCheck(): SelfCheck {
  if (selfCheckCache) return selfCheckCache;
  const model = describeGraphModel(graph);
  const reached = new Set<number>();
  const nodeByIdx: number[] = [];
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
    nodeByIdx[idx] = viaAction;
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
    nodeByIdx,
  };
  return selfCheckCache;
}

/**
 * Every exponent vector in the key space that reaches the same curve as
 * `secret`, in brute-force enumeration order (first exponent fastest).
 *
 * Computed by acting with all KEY_SPACE candidates and comparing vertices — not
 * by any closed form — so it is the ground truth exhibit 4's search must agree
 * with. `predicted` is the vector the brute force will return, because it tests
 * candidates in exactly this order and stops at the first match.
 */
function collisionClass(secret: Secret): { members: Secret[]; predicted: Secret } {
  const { nodeByIdx } = runSelfCheck();
  const target = nodeIdForCurve(graph, groupAction(PARAMS.E0, secret));
  const members: Secret[] = [];
  for (let idx = 0; idx < KEY_SPACE; idx++) {
    if (nodeByIdx[idx] === target) members.push(candidateAt(idx));
  }
  return { members, predicted: members[0] };
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

/**
 * The same exchange {@link keyExchange} performs, but with both secrets supplied
 * rather than drawn at random. Same group action, same commutativity check —
 * nothing about the mathematics changes when the learner picks the exponents.
 */
function exchangeFromSecrets(aliceSecret: Secret, bobSecret: Secret): typeof exchange {
  const alice = { secret: aliceSecret, publicCurve: groupAction(PARAMS.E0, aliceSecret) };
  const bob = { secret: bobSecret, publicCurve: groupAction(PARAMS.E0, bobSecret) };
  const aliceShared = groupAction(bob.publicCurve, aliceSecret);
  const bobShared = groupAction(alice.publicCurve, bobSecret);
  return {
    alice,
    bob,
    aliceShared,
    bobShared,
    sharedInvariant: jInvariant(aliceShared),
    agree: isIsomorphic(aliceShared, bobShared),
  };
}

/* ------------------------------------------------------------------ *
 * Exhibit 3 — learner-supplied secrets
 *
 * The picker is not a menu of presets. Whatever exponents come out of these
 * four fields go into {@link exchangeFromSecrets}, which calls the same
 * {@link groupAction} — the same Vélu isogeny arithmetic — that the random
 * exchange calls, and exhibit 4 then brute-forces the resulting public curve.
 * ------------------------------------------------------------------ */

const secretInputs = {
  alice: [
    document.getElementById('in-alice-a') as HTMLInputElement,
    document.getElementById('in-alice-b') as HTMLInputElement,
  ],
  bob: [
    document.getElementById('in-bob-a') as HTMLInputElement,
    document.getElementById('in-bob-b') as HTMLInputElement,
  ],
};
const secretError = document.getElementById('secret-error') as HTMLParagraphElement;

function sameSecret(a: Secret, b: Secret): boolean {
  return a.length === b.length && a.every((e, i) => e === b[i]);
}

/** Write the exchange actually on screen back into the picker fields. */
function syncSecretInputs(r: typeof exchange) {
  secretInputs.alice.forEach((el, i) => {
    el.value = String(r.alice.secret[i]);
  });
  secretInputs.bob.forEach((el, i) => {
    el.value = String(r.bob.secret[i]);
  });
}

/**
 * Read one party's exponents, enforcing the bound the field advertises.
 *
 * The bound is real arithmetic, not decoration: an exponent is a count of
 * ℓ-isogeny steps, so it must be a non-negative integer, and the brute force in
 * exhibit 4 enumerates exactly `0..expBound` per exponent — a secret outside
 * that box would be a secret its own key-space grid does not contain, and
 * exhibit 4 would then report "no vector reproduced the public key" about a key
 * this page had just told the learner to make. `type=number` alone does not
 * enforce it: browsers happily hand back an out-of-range or fractional value.
 */
function readSecret(fields: HTMLInputElement[], who: string): Secret | string {
  const out: Secret = [];
  for (let i = 0; i < fields.length; i++) {
    const raw = fields[i].value.trim();
    const ell = PARAMS.ells[i];
    if (raw === '') return `${who}'s ${ell}-isogeny exponent is empty — enter a whole number from 0 to ${PARAMS.expBound}.`;
    const n = Number(raw);
    if (!Number.isInteger(n)) {
      return `${who}'s ${ell}-isogeny exponent must be a whole number of steps, not "${raw}".`;
    }
    if (n < 0 || n > PARAMS.expBound) {
      return `${who}'s ${ell}-isogeny exponent must be between 0 and ${PARAMS.expBound} — ${n} is outside the key space exhibit 4 searches.`;
    }
    out.push(n);
  }
  return out;
}

function renderExchangeSummary(r: typeof exchange) {
  // The picker fields must always describe the exchange on screen, whether the
  // learner typed those exponents or the random button drew them. Syncing here,
  // in the one function that renders the exchange, is what makes it impossible
  // for the inputs and the summary to name different Alices.
  syncSecretInputs(r);

  const cls = collisionClass(r.alice.secret);
  const isFirst = cls.predicted.every((e, i) => e === r.alice.secret[i]);
  const others = cls.members.filter((m) => !sameSecret(m, r.alice.secret));
  const collision =
    others.length === 0
      ? `none — [${r.alice.secret.join(', ')}] is the only one of the ${KEY_SPACE} exponent vectors that reaches this curve, so the search can only return hers`
      : `${cls.members.length} of the ${KEY_SPACE} exponent vectors reach this same curve: ${cls.members
          .map((m) => `[${m.join(', ')}]`)
          .join(', ')}. Exhibit 4 searches them in that order and stops at the first, so it will report [${cls.predicted.join(', ')}]${
          isFirst ? ' — which is Alice&rsquo;s own vector' : ' — an equivalent key, not Alice&rsquo;s literal one'
        }`;

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
    <div class="kv"><span id="collision-label">Equivalent secrets</span><code id="collision-class">${collision}</code></div>
  `;
}

// Show it immediately, so the numbers exhibit 4 attacks are on screen before the
// attack runs, whichever button the reader presses first.
renderExchangeSummary(exchange);

/**
 * Put `next` on screen: it becomes *the* exchange, exhibit 4's stale attack on
 * the previous one is cleared, the four walks animate, and the summary re-renders.
 *
 * Every route to a new exchange — the random button, the picker, the randomise
 * button — goes through here, so a learner-supplied secret is animated, summarised
 * and attacked by exactly the same code as a random one. There is no second path
 * that could show them different things.
 */
function showExchange(next: typeof exchange) {
  cancelKexAnim();
  exchange = next;
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
}

document.getElementById('btn-run-sidh')!.addEventListener('click', () => {
  secretError.textContent = '';
  showExchange(keyExchange());
});

document.getElementById('btn-use-secrets')!.addEventListener('click', () => {
  const alice = readSecret(secretInputs.alice, 'Alice');
  const bob = readSecret(secretInputs.bob, 'Bob');
  // Report the first problem and change nothing: silently clamping a rejected
  // exponent would run an exchange the learner did not ask for while their own
  // number sat in the box beside it.
  if (typeof alice === 'string' || typeof bob === 'string') {
    secretError.textContent = typeof alice === 'string' ? alice : (bob as string);
    return;
  }
  secretError.textContent = '';
  showExchange(exchangeFromSecrets(alice, bob));
});

document.getElementById('btn-random-secrets')!.addEventListener('click', () => {
  secretError.textContent = '';
  // Draw into the fields and run from the fields, so what is typed is what ran.
  showExchange(exchangeFromSecrets(randomSecret(), randomSecret()));
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

  // The grid IS exhibit 4's graphic — "the grid below is the entire key space,
  // one cell per candidate exponent vector" — so its cell boundaries owe 1.4.11
  // its 3:1. An untested cell is --c-surface on --canvas-bg, 1.08:1 (dark) /
  // 1.03:1 (light): the fill cannot delineate anything, and with the strokes
  // drawn in the decorative --c-border (1.62:1 / 1.49:1) the grid the prose
  // points at simply did not render until the search started lighting cells.
  const border = cssVar('--c-control-border');
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
    strokeRectCrisp(ctx, x + 1, y + 1, cell - 2, cell - 2);
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
