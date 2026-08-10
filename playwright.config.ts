import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end + accessibility gate. Tests run against the production build
 * served by `vite preview`, so what passes here is what actually ships to
 * Pages. The webServer builds a fresh bundle first, then serves it on a
 * fixed strict port under the deployed base path.
 *
 * e2e/app.spec.ts    — functional smoke tests of the five exhibits.
 * e2e/claims.spec.ts — the arithmetic claims the page makes, checked live.
 * e2e/a11y.spec.ts   — WCAG A/AA gate over {dark, light} x {1280px, 380px},
 *                      driving every exhibit and scanning after every step.
 *                      Set A11Y_COLLECT=1 to enumerate all findings in one
 *                      pass instead of stopping at the first; that mode is
 *                      built so it can never report a pass. See e2e/gate.ts.
 */

const PORT = 4653;
export const BASE_URL = `http://localhost:${PORT}/crypto-lab-isogeny-gate/`;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'list' : [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: BASE_URL,
    colorScheme: 'dark',
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  // Build a fresh bundle and serve it, exactly as production would.
  webServer: {
    command: `npm run build && npm run preview -- --port ${PORT} --strictPort`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
