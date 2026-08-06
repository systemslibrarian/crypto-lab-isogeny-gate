import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

/**
 * WCAG regression gate. Deploys are gated on accessibility: this scans the
 * full page with every <details> expanded, in both themes, and fails on any
 * WCAG A/AA violation.
 */

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

/**
 * The body transitions background-color/color over 0.3s on theme change, so a
 * scan fired right after the toggle click reads mid-blend colors and reports
 * phantom contrast failures. Zero out motion so axe sees endpoint colors —
 * the endpoints themselves are still fully asserted.
 */
async function neutralizeMotion(page: Page): Promise<void> {
  await page.emulateMedia({ reducedMotion: 'reduce' });
}

async function openAllDetails(page: Page): Promise<void> {
  await page.evaluate(() => {
    for (const details of document.querySelectorAll('details')) {
      details.open = true;
    }
  });
}

async function scan(page: Page): Promise<void> {
  const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  const summary = results.violations.map((v) => ({
    id: v.id,
    impact: v.impact,
    help: v.help,
    nodes: v.nodes.map((n) => n.target.join(' ')).slice(0, 5),
  }));
  expect(summary).toEqual([]);
}

test('no WCAG A/AA violations in dark theme', async ({ page }) => {
  await page.goto('.');
  await neutralizeMotion(page);
  await expect(page.locator('h1')).toBeVisible();
  await openAllDetails(page);
  await scan(page);
});

test('no WCAG A/AA violations in light theme', async ({ page }) => {
  await page.goto('.');
  await neutralizeMotion(page);
  await page.locator('#cl-theme-toggle').click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await expect(page.locator('h1')).toBeVisible();
  await openAllDetails(page);
  await scan(page);
});
