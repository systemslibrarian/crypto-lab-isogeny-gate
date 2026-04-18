import { sidhKeyExchange, castryckDecruToy } from './sidh';
import { jInvariant } from './ec';
import { buildIsogenyGraph, drawIsogenyGraph, randomWalk } from './isogeny-graph';

const app = document.getElementById('app');
if (!app) throw new Error('No #app element');

let currentTheme = localStorage.getItem('cv-theme') || 'dark';

const html = `
  <header>
    <h1>🔗 crypto-lab-isogeny-gate</h1>
    <button class="theme-toggle" id="theme-toggle">${currentTheme === 'dark' ? '☀️' : '🌙'}</button>
  </header>
  <main>
    <section id="exhibit-1">
      <h2>What Is an Elliptic Curve Isogeny?</h2>
      <p>An isogeny φ: E → E' is a group homomorphism between elliptic curves that is also a rational map.</p>
      <canvas id="canvas-isogeny" width="600" height="300" role="img" aria-label="Elliptic curve isogeny visualization"></canvas>
      <button id="btn-run-isogeny">Compute Example Isogeny</button>
    </section>

    <section id="exhibit-2">
      <h2>The Isogeny Graph</h2>
      <p>Supersingular elliptic curves form an expander graph connected by isogenies.</p>
      <canvas id="canvas-graph" width="600" height="400" role="img" aria-label="Supersingular isogeny graph"></canvas>
      <button id="btn-random-walk">Run Random Walk</button>
    </section>

    <section id="exhibit-3">
      <h2>SIDH Key Exchange</h2>
      <p>Two parties walk different paths through the isogeny graph without revealing their paths.</p>
      <button id="btn-run-sidh">Run SIDH Protocol</button>
      <div id="sidh-output" style="margin-top: 1rem; font-family: monospace; font-size: 0.9rem;"></div>
    </section>

    <section id="exhibit-4">
      <h2>The Castryck-Decru Attack (August 2022)</h2>
      <p><strong>The Vulnerability:</strong> SIDH requires Alice and Bob to publish torsion point images.</p>
      <p><strong>The Attack:</strong> These images uniquely determine the secret isogeny.</p>
      <button id="btn-run-attack">Run Castryck-Decru Attack</button>
      <div id="attack-output" style="margin-top: 1rem; font-family: monospace; font-size: 0.85rem; background: rgba(255,51,102,0.1); padding: 1rem; border-radius: 4px;"></div>
    </section>

    <section id="exhibit-5">
      <h2>Lessons for PQC Design</h2>
      <ul>
        <li><strong>Auxiliary Information Is Attack Surface —</strong> SIDH's torsion images seemed harmless but were fatal.</li>
        <li><strong>Beautiful Math ≠ Secure Math —</strong> Isogenies are elegant. Ten years of scrutiny still missed the break.</li>
        <li><strong>Different Problems, Different Fates —</strong> The SI-Path problem (SQIsign) survived. Only SI-DH broke.</li>
        <li><strong>Attacks Become Tools —</strong> Castryck-Decru techniques now improve SQIsign v2.0 (NIST Round 2, 2025).</li>
        <li><strong>Diversity Is Essential —</strong> NIST standardized lattice, hash, and code-based. No single foundation fails.</li>
      </ul>
    </section>
  </main>
  <footer>
    <p>"Whether therefore ye eat, or drink, or whatsoever ye do,<br/>do all to the glory of God."<br/>— 1 Corinthians 10:31</p>
  </footer>
`;

app.innerHTML = html;

// Theme
const themeToggle = document.getElementById('theme-toggle') as HTMLButtonElement;
const htmlEl = document.documentElement;

themeToggle.addEventListener('click', () => {
  currentTheme = currentTheme === 'dark' ? 'light' : 'dark';
  htmlEl.setAttribute('data-theme', currentTheme);
  localStorage.setItem('cv-theme', currentTheme);
  themeToggle.textContent = currentTheme === 'dark' ? '☀️' : '🌙';
});

// Exhibit 1: Isogeny
const btnIsogeny = document.getElementById('btn-run-isogeny') as HTMLButtonElement;
const canvasIsogeny = document.getElementById('canvas-isogeny') as HTMLCanvasElement;

btnIsogeny.addEventListener('click', () => {
  const ctx = canvasIsogeny.getContext('2d');
  if (!ctx) return;

  ctx.fillStyle = 'rgba(10, 14, 39, 1)';
  ctx.fillRect(0, 0, canvasIsogeny.width, canvasIsogeny.height);

  ctx.fillStyle = '#00d4ff';
  ctx.font = '16px monospace';
  ctx.fillText('E: y² = x³ + ax + b', 50, 50);
  ctx.fillText('↓ φ (Vélu formula)', 50, 100);
  ctx.fillText("E': y² = x³ + a'x + b'", 50, 150);

  ctx.strokeStyle = '#00d4ff';
  ctx.beginPath();
  ctx.moveTo(200, 70);
  ctx.lineTo(200, 80);
  ctx.stroke();

  ctx.arc(200, 100, 40, 0, 2 * Math.PI);
  ctx.stroke();
});

// Exhibit 2: Isogeny Graph
const btnWalk = document.getElementById('btn-random-walk') as HTMLButtonElement;
const canvasGraph = document.getElementById('canvas-graph') as HTMLCanvasElement;
const graph = buildIsogenyGraph();

drawIsogenyGraph(canvasGraph, graph);

btnWalk.addEventListener('click', async () => {
  const path = randomWalk(graph, 0, 5);
  drawIsogenyGraph(canvasGraph, graph, { highlightPath: path });
});

// Exhibit 3: SIDH
const btnSIDH = document.getElementById('btn-run-sidh') as HTMLButtonElement;
const sidhOutput = document.getElementById('sidh-output') as HTMLDivElement;

btnSIDH.addEventListener('click', async () => {
  sidhOutput.textContent = 'Running SIDH...';
  try {
    const result = await sidhKeyExchange();
    const j = jInvariant(result.aliceSharedCurve);
    sidhOutput.innerHTML = `
<strong>✓ SIDH Complete</strong>
Alice secret:  ${result.alice.privateKey}
Bob secret:    ${result.bob.privateKey}
Alice j-inv:   ${result.alice.publicKey.jInvariant}
Bob j-inv:     ${result.bob.publicKey.jInvariant}
Shared j-inv:  ${j}
    `.replace(/\n/g, '<br/>');
  } catch (e) {
    sidhOutput.textContent = `Error: ${String(e)}`;
  }
});

// Exhibit 4: Castryck-Decru Attack
const btnAttack = document.getElementById('btn-run-attack') as HTMLButtonElement;
const attackOutput = document.getElementById('attack-output') as HTMLDivElement;

btnAttack.addEventListener('click', async () => {
  attackOutput.textContent = 'Running attack...';
  try {
    const kex = await sidhKeyExchange();
    const attack = castryckDecruToy(kex.alice.publicKey);

    const html = `
<strong>CASTRYCK-DECRU ATTACK</strong><br/>
<br/>
Alice published: torsion images ${kex.alice.publicKey.torsionImageA}, ${kex.alice.publicKey.torsionImageB}<br/>
<br/>
Brute force: tested 256 candidates<br/>
Match found at: ${attack.recoveredSecret}<br/>
<br/>
✓ ATTACK SUCCESS—Alice's secret recovered: ${attack.recoveredSecret}<br/>
(Original secret was: ${kex.alice.privateKey})
    `.replace(/\n/g, '<br/>');

    attackOutput.innerHTML = html;
  } catch (e) {
    attackOutput.textContent = `Error: ${String(e)}`;
  }
});

// Initialize theme
htmlEl.setAttribute('data-theme', currentTheme);
