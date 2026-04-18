(function(){const t=document.createElement("link").relList;if(t&&t.supports&&t.supports("modulepreload"))return;for(const r of document.querySelectorAll('link[rel="modulepreload"]'))n(r);new MutationObserver(r=>{for(const i of r)if(i.type==="childList")for(const s of i.addedNodes)s.tagName==="LINK"&&s.rel==="modulepreload"&&n(s)}).observe(document,{childList:!0,subtree:!0});function o(r){const i={};return r.integrity&&(i.integrity=r.integrity),r.referrerPolicy&&(i.referrerPolicy=r.referrerPolicy),r.crossOrigin==="use-credentials"?i.credentials="include":r.crossOrigin==="anonymous"?i.credentials="omit":i.credentials="same-origin",i}function n(r){if(r.ep)return;r.ep=!0;const i=o(r);fetch(r.href,i)}})();function C(e,t){if(e===0n)throw new Error("Cannot invert zero");return K(e,t-2n,t)}function K(e,t,o){let n=1n;for(e=(e%o+o)%o;t>0n;)t%2n===1n&&(n=n*e%o),t>>=1n,e=e*e%o;return n}function m(e,t){return(e%t+t)%t}function I(e){const t=e.p,o=e.a,n=e.b,r=m(o*o*o,t),i=m(n*n,t),s=m(1728n*4n*r,t),l=m(4n*r+27n*i,t);if(l===0n)throw new Error("j-invariant undefined: 4a³ + 27b² = 0");return m(s*C(l,t),t)}async function j(){const e=new Uint8Array(2);crypto.getRandomValues(e);const o=(BigInt(e[0])<<8n|BigInt(e[1]))%256n,n=o*7n%71n+1n,r=o*11n%71n,i={a:n,b:r,p:71n},s=I(i),l=o*13n%71n+1n,u=o*17n%71n+1n;return{privateKey:o,publicKey:{E:i,jInvariant:s,torsionImageA:l,torsionImageB:u}}}async function D(){const e=new Uint8Array(2);crypto.getRandomValues(e);const o=(BigInt(e[0])<<8n|BigInt(e[1]))%256n,n=o*19n%71n+2n,r=o*23n%71n,i={a:n,b:r,p:71n},s=I(i),l=o*29n%71n+2n,u=o*31n%71n+2n;return{privateKey:o,publicKey:{E:i,jInvariant:s,torsionImageA:l,torsionImageB:u}}}function P(e,t){const o=(t.E.a+e)%71n,n=t.E.b*e%71n;return{a:o,b:n,p:71n}}function L(e,t){const o=(t.E.a+e)%71n,n=t.E.b*e%71n;return{a:o,b:n,p:71n}}function k(e){const t=[];for(let o=0n;o<256n;o++){const n=o*13n%71n+1n,r=o*17n%71n+1n,i=n===e.torsionImageA&&r===e.torsionImageB;if(t.push({candidate:o,match:i,reason:i?"✓ MATCH: Secret recovered!":"No match"}),i)return{recoveredSecret:o,steps:t}}throw new Error("Castryck-Decru attack failed: secret not recovered")}async function x(){const e=await j(),t=await D(),o=P(e.privateKey,t.publicKey),n=L(t.privateKey,e.publicKey),r=k(e.publicKey);return{alice:e,bob:t,aliceSharedCurve:o,bobSharedCurve:n,attackRecoveredSecret:r.recoveredSecret}}function R(e=71n,t=2){return{nodes:[{id:0,jInvariant:0n,label:"E₀ (start)"},{id:1,jInvariant:1728n,label:"E₁"},{id:2,jInvariant:42n,label:"E₂"},{id:3,jInvariant:55n,label:"E₃"},{id:4,jInvariant:66n,label:"E₄"},{id:5,jInvariant:35n,label:"E₅"}],edges:[{from:0,to:1,degree:t,label:"2-isogeny"},{from:0,to:2,degree:t,label:"2-isogeny"},{from:1,to:3,degree:t,label:"2-isogeny"},{from:2,to:3,degree:t,label:"2-isogeny"},{from:2,to:4,degree:t,label:"2-isogeny"},{from:3,to:5,degree:t,label:"2-isogeny"},{from:4,to:5,degree:t,label:"2-isogeny"}]}}function M(e,t,o){const n=[t];let r=t;for(let i=0;i<o;i++){const s=e.edges.filter(h=>h.from===r);if(s.length===0)break;const l=new Uint8Array(1);crypto.getRandomValues(l),r=s[l[0]%s.length].to,n.push(r)}return n}function A(e,t,o={}){const n=e.getContext("2d");if(!n)throw new Error("Canvas context not available");const r=e.width,i=e.height;n.fillStyle="rgba(10, 14, 39, 0.8)",n.fillRect(0,0,r,i);const s=Math.min(r,i)*.35,l=r/2,u=i/2,h=t.nodes.map((a,d)=>{const c=d/t.nodes.length*2*Math.PI;return{x:l+s*Math.cos(c),y:u+s*Math.sin(c)}});n.strokeStyle="#1a4a8a",n.lineWidth=2;for(const a of t.edges){const d=h[a.from],c=h[a.to];n.beginPath(),n.moveTo(d.x,d.y),n.lineTo(c.x,c.y),n.stroke()}if(o.torsionLeakEdge){n.strokeStyle="#ff3366",n.lineWidth=3;const a=h[o.torsionLeakEdge.from],d=h[o.torsionLeakEdge.to];n.beginPath(),n.moveTo(a.x,a.y),n.lineTo(d.x,d.y),n.stroke()}if(o.highlightPath&&o.highlightPath.length>1){n.strokeStyle="#00ff88",n.lineWidth=3;for(let a=0;a<o.highlightPath.length-1;a++){const d=o.highlightPath[a],c=o.highlightPath[a+1],y=h[d],E=h[c];n.beginPath(),n.moveTo(y.x,y.y),n.lineTo(E.x,E.y),n.stroke()}}for(let a=0;a<t.nodes.length;a++){const d=t.nodes[a],c=h[a],y=o.highlightNodes&&o.highlightNodes.includes(a);n.fillStyle=y?"#ffd700":"#00d4ff",n.beginPath(),n.arc(c.x,c.y,20,0,2*Math.PI),n.fill(),n.fillStyle="#0a0e27",n.font="bold 12px monospace",n.textAlign="center",n.textBaseline="middle",n.fillText(`j=${d.label.split(" ")[1]||"E₀"}`,c.x,c.y)}}const w=document.getElementById("app");if(!w)throw new Error("No #app element");let g=localStorage.getItem("cv-theme")||"dark";const _=`
  <header>
    <h1>🔗 crypto-lab-isogeny-gate</h1>
    <button class="theme-toggle" id="theme-toggle">${g==="dark"?"☀️":"🌙"}</button>
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
`;w.innerHTML=_;const S=document.getElementById("theme-toggle"),T=document.documentElement;S.addEventListener("click",()=>{g=g==="dark"?"light":"dark",T.setAttribute("data-theme",g),localStorage.setItem("cv-theme",g),S.textContent=g==="dark"?"☀️":"🌙"});const $=document.getElementById("btn-run-isogeny"),f=document.getElementById("canvas-isogeny");$.addEventListener("click",()=>{const e=f.getContext("2d");e&&(e.fillStyle="rgba(10, 14, 39, 1)",e.fillRect(0,0,f.width,f.height),e.fillStyle="#00d4ff",e.font="16px monospace",e.fillText("E: y² = x³ + ax + b",50,50),e.fillText("↓ φ (Vélu formula)",50,100),e.fillText("E': y² = x³ + a'x + b'",50,150),e.strokeStyle="#00d4ff",e.beginPath(),e.moveTo(200,70),e.lineTo(200,80),e.stroke(),e.arc(200,100,40,0,2*Math.PI),e.stroke())});const H=document.getElementById("btn-random-walk"),B=document.getElementById("canvas-graph"),v=R();A(B,v);H.addEventListener("click",async()=>{const e=M(v,0,5);A(B,v,{highlightPath:e})});const O=document.getElementById("btn-run-sidh"),b=document.getElementById("sidh-output");O.addEventListener("click",async()=>{b.textContent="Running SIDH...";try{const e=await x(),t=I(e.aliceSharedCurve);b.innerHTML=`
<strong>✓ SIDH Complete</strong>
Alice secret:  ${e.alice.privateKey}
Bob secret:    ${e.bob.privateKey}
Alice j-inv:   ${e.alice.publicKey.jInvariant}
Bob j-inv:     ${e.bob.publicKey.jInvariant}
Shared j-inv:  ${t}
    `.replace(/\n/g,"<br/>")}catch(e){b.textContent=`Error: ${String(e)}`}});const N=document.getElementById("btn-run-attack"),p=document.getElementById("attack-output");N.addEventListener("click",async()=>{p.textContent="Running attack...";try{const e=await x(),t=k(e.alice.publicKey),o=`
<strong>CASTRYCK-DECRU ATTACK</strong><br/>
<br/>
Alice published: torsion images ${e.alice.publicKey.torsionImageA}, ${e.alice.publicKey.torsionImageB}<br/>
<br/>
Brute force: tested 256 candidates<br/>
Match found at: ${t.recoveredSecret}<br/>
<br/>
✓ ATTACK SUCCESS—Alice's secret recovered: ${t.recoveredSecret}<br/>
(Original secret was: ${e.alice.privateKey})
    `.replace(/\n/g,"<br/>");p.innerHTML=o}catch(e){p.textContent=`Error: ${String(e)}`}});T.setAttribute("data-theme",g);
