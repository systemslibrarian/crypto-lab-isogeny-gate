// crypto-lab-isogeny-gate — main entry point
// Phase 0: Repository gate

const app = document.getElementById('app');
if (!app) throw new Error('No #app element');

const html = `
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
`;

app.innerHTML = html;

// Theme toggle
const themeToggle = document.getElementById('theme-toggle') as HTMLButtonElement;
const htmlEl = document.documentElement;

function initTheme(): void {
  const theme = localStorage.getItem('cv-theme') || 'dark';
  htmlEl.setAttribute('data-theme', theme);
  themeToggle.textContent = theme === 'dark' ? '☀️' : '🌙';
}

themeToggle.addEventListener('click', () => {
  const current = htmlEl.getAttribute('data-theme');
  const next = current === 'dark' ? 'light' : 'dark';
  htmlEl.setAttribute('data-theme', next);
  localStorage.setItem('cv-theme', next);
  themeToggle.textContent = next === 'dark' ? '☀️' : '🌙';
});

initTheme();
