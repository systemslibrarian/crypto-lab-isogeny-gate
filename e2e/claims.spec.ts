import { expect, test as base, type Page } from '@playwright/test';

/**
 * Functional claims gate.
 *
 * app.spec.ts proves the exhibits render; this suite proves what they assert is
 * true, and true of each other. Nothing here compares against a hardcoded
 * mathematical result — every expected value is read back out of something the
 * page itself computed, so the suite fails when a number stops meaning what the
 * prose beside it says.
 *
 * The load-bearing claims:
 *  - exhibit 2's self-check tallies must be complete (n/n), not merely present;
 *  - exhibit 3's two re-walks must land on one curve, and that curve must be the
 *    shared secret it prints;
 *  - the secret picker must feed the *real* group action: different exponents
 *    must move the published curve, and the exponents in the fields must always
 *    be the exponents of the exchange on screen;
 *  - the picker's advertised 0..expBound bound must be enforced, not decorative
 *    — an out-of-range secret would be one exhibit 4's grid does not contain;
 *  - exhibit 3 predicts the exact vector exhibit 4's search will return, so the
 *    search has to return it;
 *  - exhibit 4's counters must be consistent with the key space it draws.
 */

const test = base.extend<Record<string, never>>({
  page: async ({ page }, use) => {
    const problems: string[] = [];
    page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
    page.on('console', (m) => {
      if (m.type() === 'error') problems.push(`console.error: ${m.text()}`);
    });
    await use(page);
    expect(problems, 'page must raise no uncaught exceptions or console errors').toEqual([]);
  },
});

async function open(page: Page): Promise<void> {
  await page.goto('./');
  await expect(page.getByRole('heading', { name: 'Isogeny Gate' })).toBeVisible();
}

/** Exhibit 3's summary as one whitespace-normalised string. */
async function summary(page: Page): Promise<string> {
  return ((await page.locator('#sidh-output').textContent()) ?? '').replace(/\s+/g, ' ');
}

async function setSecrets(
  page: Page,
  alice: [string, string],
  bob: [string, string],
): Promise<void> {
  await page.locator('#in-alice-a').fill(alice[0]);
  await page.locator('#in-alice-b').fill(alice[1]);
  await page.locator('#in-bob-a').fill(bob[0]);
  await page.locator('#in-bob-b').fill(bob[1]);
}

/** The exponents currently sitting in the four picker fields. */
async function fieldValues(page: Page): Promise<string[]> {
  return Promise.all(
    ['#in-alice-a', '#in-alice-b', '#in-bob-a', '#in-bob-b'].map((sel) =>
      page.locator(sel).inputValue(),
    ),
  );
}

/** The bound the fields advertise — read from the DOM, not assumed. */
async function expBound(page: Page): Promise<number> {
  return Number(await page.locator('#in-alice-a').getAttribute('max'));
}

// --- exhibit 2: the self-check tallies ---------------------------------------

test('the graph self-check is complete, not merely present', async ({ page }) => {
  await open(page);
  const model = page.locator('#graph-model');
  await expect(model).toContainText('Walk = group action');

  const text = ((await model.textContent()) ?? '').replace(/\s+/g, ' ');
  // Both tallies are "k/n"; a self-check that passes on a subset is not a
  // self-check. Parts must equal the whole, with n read off the page.
  const tallies = [...text.matchAll(/(\d+)\/(\d+) exponent vectors/g)];
  expect(tallies.length, 'both walk and commutativity tallies must be reported').toBe(2);
  for (const [, got, total] of tallies) {
    expect(Number(got), `self-check must cover all ${total} vectors`).toBe(Number(total));
  }
  expect(text).not.toContain('✗');

  // The key-space collapse figure feeds exhibit 4's honesty note, so it must be
  // a real subset: fewer distinct curves than vectors, but at least one.
  const collapse = /the (\d+) exponent vectors reach only (\d+) distinct curves/.exec(text)!;
  expect(collapse, 'the collapse figure must be reported').not.toBeNull();
  expect(Number(collapse[2])).toBeGreaterThan(0);
  expect(Number(collapse[2])).toBeLessThanOrEqual(Number(collapse[1]));
});

// --- exhibit 3: the exchange -------------------------------------------------

test('both parties re-walk onto one curve, and that curve is the shared secret', async ({
  page,
}) => {
  await open(page);
  await page.locator('#btn-run-sidh').click();

  const out = await summary(page);
  const aliceRe = /Alice re-walks\s*her secret from Bob's curve → j = (\d+)/.exec(out)!;
  const bobRe = /Bob re-walks\s*his secret from Alice's curve → j = (\d+)/.exec(out)!;
  expect(aliceRe, 'the re-walks must be reported').not.toBeNull();
  expect(bobRe).not.toBeNull();
  // Commutativity is the claim of the whole exhibit: the same j, both ways.
  expect(bobRe[1], "Bob's re-walk must land where Alice's did").toBe(aliceRe[1]);

  // ...and the "shared secret" line must be that same j, not a third number.
  expect(out).toContain('both parties agree');
  const shared = /same vertex: j = (\d+)/.exec(out)!;
  expect(shared[1]).toBe(aliceRe[1]);
});

// --- exhibit 3: the learner-supplied secrets ---------------------------------

test('typed exponents reach the real arithmetic — the fields are load-bearing', async ({
  page,
}) => {
  await open(page);

  // Two different Alices; the published curve must move with the exponents. If
  // the picker were cosmetic, or fed a preset, these would not differ.
  await setSecrets(page, ['1', '0'], ['1', '0']);
  await page.locator('#btn-use-secrets').click();
  const first = await summary(page);
  expect(first).toContain('Alice secret[1, 0]');
  const jFirst = /Alice public\s*j = (\d+)/.exec(first)![1];

  await setSecrets(page, ['0', '1'], ['1', '0']);
  await page.locator('#btn-use-secrets').click();
  const second = await summary(page);
  expect(second).toContain('Alice secret[0, 1]');
  const jSecond = /Alice public\s*j = (\d+)/.exec(second)![1];

  expect(jSecond, 'one 5-isogeny and one 7-isogeny are different walks').not.toBe(jFirst);

  // And the exchange still closes for the learner's own secrets.
  expect(second).toContain('both parties agree');
  await expect(page.locator('#secret-error')).toHaveText('');
});

test('the picker fields always name the exchange on screen', async ({ page }) => {
  await open(page);

  // On first paint the exchange is random, so the fields must already have been
  // written from it — defaults of 0 beside a random Alice would be two surfaces
  // disagreeing about one run.
  const shownAtLoad = await summary(page);
  const atLoad = /Alice secret\s*\[(\d+), (\d+)\].*Bob secret\s*\[(\d+), (\d+)\]/.exec(
    shownAtLoad,
  )!;
  expect(await fieldValues(page)).toEqual([atLoad[1], atLoad[2], atLoad[3], atLoad[4]]);

  // Same after a random run, and after the randomise button.
  for (const button of ['#btn-run-sidh', '#btn-random-secrets']) {
    await page.locator(button).click();
    const out = await summary(page);
    const m = /Alice secret\s*\[(\d+), (\d+)\].*Bob secret\s*\[(\d+), (\d+)\]/.exec(out)!;
    expect(await fieldValues(page), `${button} must write back what it ran`).toEqual([
      m[1],
      m[2],
      m[3],
      m[4],
    ]);
  }
});

test('randomise draws inside the bound it advertises', async ({ page }) => {
  await open(page);
  const bound = await expBound(page);
  for (let i = 0; i < 8; i++) {
    await page.locator('#btn-random-secrets').click();
    for (const v of await fieldValues(page)) {
      const n = Number(v);
      expect(Number.isInteger(n)).toBe(true);
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThanOrEqual(bound);
    }
  }
});

test('the advertised exponent bound is enforced, not decorative', async ({ page }) => {
  await open(page);
  const bound = await expBound(page);
  const error = page.locator('#secret-error');

  await setSecrets(page, ['2', '2'], ['2', '2']);
  await page.locator('#btn-use-secrets').click();
  const accepted = await summary(page);
  await expect(error).toHaveText('');

  // Past the bound: an exponent outside the key space exhibit 4 enumerates
  // would make exhibit 4 report "no vector reproduced the public key" about a
  // key this page just told the learner to make.
  for (const bad of [[String(bound + 1), '0'], ['-1', '0'], ['1.5', '0'], ['', '0']] as [
    string,
    string,
  ][]) {
    await setSecrets(page, bad, ['1', '1']);
    await page.locator('#btn-use-secrets').click();
    await expect(error, `"${bad[0]}" must be rejected out loud`).not.toHaveText('');
    // Rejected means unchanged — no silent clamp to a secret nobody asked for.
    expect(await summary(page), `"${bad[0]}" must not change the exchange`).toBe(accepted);
  }

  // Bob is validated too.
  await setSecrets(page, ['1', '1'], ['0', String(bound + 5)]);
  await page.locator('#btn-use-secrets').click();
  await expect(error).toContainText("Bob's");
  expect(await summary(page)).toBe(accepted);

  // And a good secret clears the complaint and runs.
  await setSecrets(page, ['3', '2'], ['1', '4']);
  await page.locator('#btn-use-secrets').click();
  await expect(error).toHaveText('');
  expect(await summary(page)).toContain('Alice secret[3, 2]');
});

// --- exhibit 3 -> exhibit 4 --------------------------------------------------

test('exhibit 3 predicts the vector exhibit 4 recovers, for a learner-chosen secret', async ({
  page,
}) => {
  await open(page);
  await setSecrets(page, ['4', '3'], ['2', '2']);
  await page.locator('#btn-use-secrets').click();

  const claim = ((await page.locator('#collision-class').textContent()) ?? '').replace(/\s+/g, ' ');
  const predicted = /it will report \[(\d+), (\d+)\]/.exec(claim);
  const alone = /is the only one of the \d+ exponent vectors/.test(claim);
  expect(
    predicted !== null || alone,
    'exhibit 3 must either name the vector exhibit 4 will find or say hers is unique',
  ).toBe(true);
  const expected = predicted ? `[${predicted[1]}, ${predicted[2]}]` : '[4, 3]';

  await page.locator('#btn-run-attack').click();
  const attack = page.locator('#attack-output');
  await expect(attack).toContainText('toy broken', { timeout: 20000 });
  const out = ((await attack.textContent()) ?? '').replace(/\s+/g, ' ');

  const recovered = /Recovered secret\s*\[(\d+), (\d+)\]/.exec(out)!;
  expect(
    `[${recovered[1]}, ${recovered[2]}]`,
    'the search must return the vector exhibit 3 said it would',
  ).toBe(expected);

  // The attack must be on the Alice above, and must genuinely reproduce her key.
  const aliceJ = /Alice public\s*j = (\d+)/.exec(await summary(page))![1];
  expect(out).toContain(`j = ${aliceJ}`);
  expect(out).toContain('✓ yes');
});

test('the brute force counters are consistent with the key space it draws', async ({ page }) => {
  await open(page);
  const bound = await expBound(page);
  const cells = (bound + 1) ** 2;

  await page.locator('#btn-run-attack').click();
  const attack = page.locator('#attack-output');
  await expect(attack).toContainText('toy broken', { timeout: 20000 });
  const out = ((await attack.textContent()) ?? '').replace(/\s+/g, ' ');

  const space = /(\d+) candidate exponent vectors — but they reach only (\d+) distinct curves/.exec(
    out,
  )!;
  expect(Number(space[1]), 'the key space must be the grid the page draws').toBe(cells);
  expect(Number(space[2])).toBeLessThanOrEqual(cells);

  const tested = Number(/tested (\d+) before a match/.exec(out)![1]);
  expect(tested).toBeGreaterThan(0);
  expect(tested, 'an exhaustive search cannot test more cells than exist').toBeLessThanOrEqual(
    cells,
  );

  // The exhibit 5 lesson rests on this: the toy really is broken.
  expect(out).toContain('Reproduces public key');
  expect(out).toContain('✓ yes');
});

test('a new exchange retires the attack it invalidates', async ({ page }) => {
  await open(page);
  await page.locator('#btn-run-attack').click();
  await expect(page.locator('#attack-output')).toContainText('toy broken', { timeout: 20000 });

  // Exhibit 4's panel described the previous Alice; leaving it up beside a new
  // one would put two different Alices under the same name, one panel apart.
  await setSecrets(page, ['5', '2'], ['3', '3']);
  await page.locator('#btn-use-secrets').click();
  await expect(page.locator('#attack-output')).toHaveText('');

  await page.locator('#btn-run-attack').click();
  await expect(page.locator('#attack-output')).toContainText('toy broken', { timeout: 20000 });
  const aliceJ = /Alice public\s*j = (\d+)/.exec(await summary(page))![1];
  expect(((await page.locator('#attack-output').textContent()) ?? '')).toContain(`j = ${aliceJ}`);
});

// --- the [hidden] override trap ----------------------------------------------

test('no element carrying the hidden attribute is actually rendered', async ({ page }) => {
  await open(page);
  // Open a gloss popover and close it, so the toggled-hidden elements are the
  // ones under test rather than untouched markup.
  await page.locator('.gloss').first().click();
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);

  const leaks = await page.evaluate(() => {
    const out: { tag: string; cls: string; display: string }[] = [];
    for (const el of Array.from(document.querySelectorAll('[hidden]'))) {
      const cs = getComputedStyle(el as HTMLElement);
      if (cs.display !== 'none') {
        out.push({
          tag: (el as HTMLElement).tagName.toLowerCase(),
          cls: (el as HTMLElement).className?.toString().slice(0, 60) ?? '',
          display: cs.display,
        });
      }
    }
    return out;
  });
  expect(leaks, `elements marked hidden that still render: ${JSON.stringify(leaks)}`).toEqual([]);
});

// --- dead controls -----------------------------------------------------------

test('every button on the page is wired to something', async ({ page }) => {
  // A control the app never listens to is indistinguishable from a broken one —
  // and markup can outlive its handler, which is exactly how the secret picker
  // shipped as four fields and two buttons that did nothing. Record every click
  // listener the app registers, then require each rendered button to be covered
  // by one, directly or by delegation from an ancestor.
  await page.addInitScript(() => {
    const original = EventTarget.prototype.addEventListener;
    EventTarget.prototype.addEventListener = function (
      type: string,
      ...rest: unknown[]
    ): void {
      if (type === 'click') {
        (this as unknown as { __clickWired?: boolean }).__clickWired = true;
      }
      return (original as unknown as (...a: unknown[]) => void).call(this, type, ...rest);
    } as typeof EventTarget.prototype.addEventListener;
  });
  await open(page);

  const unwired = await page.evaluate(() => {
    const wired = (el: unknown): boolean => !!(el as { __clickWired?: boolean }).__clickWired;
    const out: string[] = [];
    for (const btn of Array.from(document.querySelectorAll('button'))) {
      // Walk elements only, stopping below <body>: the page keeps a
      // document-level click listener to dismiss gloss popovers, and counting
      // that as coverage would make this check pass for anything.
      let node: HTMLElement | null = btn;
      let covered = false;
      while (node && node !== document.body) {
        if (wired(node)) {
          covered = true;
          break;
        }
        node = node.parentElement;
      }
      if (!covered) out.push(btn.id || btn.textContent?.trim().slice(0, 40) || '<button>');
    }
    return out;
  });

  expect(unwired, `buttons with no click handler: ${JSON.stringify(unwired)}`).toEqual([]);
});
