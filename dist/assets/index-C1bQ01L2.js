(function(){const r=document.createElement("link").relList;if(r&&r.supports&&r.supports("modulepreload"))return;for(const e of document.querySelectorAll('link[rel="modulepreload"]'))s(e);new MutationObserver(e=>{for(const t of e)if(t.type==="childList")for(const n of t.addedNodes)n.tagName==="LINK"&&n.rel==="modulepreload"&&s(n)}).observe(document,{childList:!0,subtree:!0});function a(e){const t={};return e.integrity&&(t.integrity=e.integrity),e.referrerPolicy&&(t.referrerPolicy=e.referrerPolicy),e.crossOrigin==="use-credentials"?t.credentials="include":e.crossOrigin==="anonymous"?t.credentials="omit":t.credentials="same-origin",t}function s(e){if(e.ep)return;e.ep=!0;const t=a(e);fetch(e.href,t)}})();const l=document.getElementById("app");if(!l)throw new Error("No #app element");const d=`
  <header>
    <h1>crypto-lab-isogeny-gate</h1>
    <button class="theme-toggle" id="theme-toggle">🌙</button>
  </header>
  <main>
    <p>Building the isogeny cryptography demo...</p>
  </main>
  <footer>
    <p>"Whether therefore ye eat, or drink, or whatsoever ye do,<br/>
    do all to the glory of God." — 1 Corinthians 10:31</p>
  </footer>
`;l.innerHTML=d;const i=document.getElementById("theme-toggle"),c=document.documentElement;function u(){const o=localStorage.getItem("cv-theme")||"dark";c.setAttribute("data-theme",o),i.textContent=o==="dark"?"☀️":"🌙"}i.addEventListener("click",()=>{const r=c.getAttribute("data-theme")==="dark"?"light":"dark";c.setAttribute("data-theme",r),localStorage.setItem("cv-theme",r),i.textContent=r==="dark"?"☀️":"🌙"});u();
