import { test, expect } from '@playwright/test';

test('research note preserves evidence and attack-model boundaries', async ({ page }) => {
  await page.goto('./');
  const note = page.locator('#csidh-fault-research');
  await expect(note).toBeVisible();
  await expect(note).toContainText('20 October 2026');
  await expect(note).toContainText('preprint');
  await expect(note).toContainText('software fault simulation');
  await expect(note).toContainText('separately');
  await expect(note).toContainText('targeted fault injection');
  await expect(note).toContainText('not complete hardware key recovery');
  await expect(note).toContainText('does not implement the attacked variants');
  await expect(note.locator('a[href="https://eprint.iacr.org/2026/2542"]')).toBeVisible();
});
