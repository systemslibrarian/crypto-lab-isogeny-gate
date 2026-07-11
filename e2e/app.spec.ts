import { test, expect } from '@playwright/test';

const SHOTS = 'e2e/.screenshots';

test.describe('Isogeny Gate — real browser', () => {
  test.beforeEach(async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(m.text());
    });
    (page as unknown as { _errors: string[] })._errors = errors;
    await page.goto('./');
    await expect(page.getByRole('heading', { name: 'Isogeny Gate' })).toBeVisible();
  });

  test('loads with no console/page errors and all five exhibits', async ({ page }) => {
    for (let i = 1; i <= 5; i++) {
      await expect(page.locator(`#exhibit-${i}`)).toBeVisible();
    }
    await page.screenshot({ path: `${SHOTS}/home-dark.png`, fullPage: true });
    const errors = (page as unknown as { _errors: string[] })._errors;
    expect(errors).toEqual([]);
  });

  test('exhibit 1 computes a real isogeny and draws it', async ({ page }) => {
    await page.locator('#btn-run-isogeny').click();
    const out = page.locator('#isogeny-output');
    await expect(out).toContainText('Codomain');
    await expect(out).toContainText('supersingular');
    await page.locator('#exhibit-1').screenshot({ path: `${SHOTS}/exhibit1-isogeny.png` });
  });

  test('exhibit 2 walks the graph', async ({ page }) => {
    await page.locator('#btn-random-walk').click();
    await expect(page.locator('#graph-output')).toContainText('Walk');
    await page.locator('#exhibit-2').screenshot({ path: `${SHOTS}/exhibit2-graph.png` });
  });

  test('exhibit 3 reaches an agreed shared secret', async ({ page }) => {
    await page.locator('#btn-run-sidh').click();
    await expect(page.locator('#sidh-output')).toContainText('both parties agree');
    await page.locator('#exhibit-3').screenshot({ path: `${SHOTS}/exhibit3-kex.png` });
  });

  test('exhibit 4 brute-forces a working secret', async ({ page }) => {
    await page.locator('#btn-run-attack').click();
    const out = page.locator('#attack-output');
    await expect(out).toContainText('toy broken');
    await expect(out).toContainText('Reproduces public key');
    await page.locator('#exhibit-4').screenshot({ path: `${SHOTS}/exhibit4-attack.png` });
  });

  test('light theme renders via the shared header toggle', async ({ page }) => {
    await page.locator('#cl-theme-toggle').click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    // recompute exhibit 1 so the canvas redraws in the light palette
    await page.locator('#btn-run-isogeny').click();
    await page.locator('#btn-random-walk').click();
    await page.screenshot({ path: `${SHOTS}/home-light.png`, fullPage: true });
  });
});
