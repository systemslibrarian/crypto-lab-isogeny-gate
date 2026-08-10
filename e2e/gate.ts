import AxeBuilder from '@axe-core/playwright';
import { expect, type Page } from '@playwright/test';
import { auditContrast, formatContrastFailures } from './contrast';
import { auditNonText } from './nontext';
import { NONTEXT_BASELINE } from './nontext-baseline';

export const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

/** A phone-width viewport, for the WCAG 1.4.10 reflow half of the gate. */
export const NARROW = { width: 380, height: 800 };

/**
 * Shared machinery for the WCAG gate.
 *
 * Three rules govern everything here:
 *
 *  1. NOTHING IS INJECTED INTO THE PAGE BEFORE A SCAN. The gate this file
 *     replaces called `page.evaluate` to force `details.open = true` on every
 *     disclosure, then scanned once — which on this lab checked nothing at all,
 *     because there are no `<details>` elements to open and every result panel
 *     (`#isogeny-output`, `#graph-output`, `#commute-output`, `#sidh-output`,
 *     `#attack-output`) is `display: none` while empty via `.output:empty`. It
 *     never pressed a button, so it scanned five empty containers and reported
 *     green. It also asked for `prefers-reduced-motion` AFTER `goto`, so the
 *     first paint it measured was the un-reduced one.
 *
 *  2. EVERY SCAN ASSERTS ITS CONTENT IS PRESENT FIRST, and there are scans well
 *     past first paint. axe over an empty container passes having checked
 *     nothing — which is exactly what happened above.
 *
 *  3. `violations` IS NOT THE WHOLE ORACLE. See `scan`.
 *
 * What this gate CANNOT see: all five exhibits draw into a `<canvas>`. No DOM
 * oracle reaches inside one, so the graph edges, key-space cells and node
 * labels are hand-measured from screenshot pixels and their fixes live in
 * `src/style.css`. This file covers the DOM around them.
 */

/**
 * Soft-gate collection mode.
 *
 * A gate that throws on the first finding tells you about one defect per run,
 * and a run of this suite is four full drives. With `A11Y_COLLECT=1` every
 * assertion in `scan` records its failure and continues, so one pass enumerates
 * everything wrong in all four configurations.
 *
 * The dangerous version of this idea is a check that merely logs. This one
 * cannot be mistaken for a passing gate: `reportCollected()` runs at the end of
 * every test and FAILS if a collecting run recorded anything at all. So the
 * only way a collecting run goes green is if there was nothing to collect, and
 * the only way to get a green gate is with the env var unset, where every
 * assertion is strict and throws where it stands.
 */
const COLLECTING = !!process.env.A11Y_COLLECT;
const collected: string[] = [];

async function soft(fn: () => void | Promise<void>): Promise<void> {
  if (!COLLECTING) {
    await fn();
    return;
  }
  try {
    await fn();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    collected.push(message);
    console.log(`\n=== COLLECTED #${collected.length} ===\n${message}\n`);
  }
}

/**
 * Fail the test if a collecting run recorded anything. Call at the end of every
 * test — this is what stops a collection pass from ever reading as a pass.
 */
export function reportCollected(): void {
  if (!COLLECTING) return;
  expect(
    collected.length,
    `A11Y_COLLECT run recorded ${collected.length} findings (printed above). ` +
      'This mode never passes with findings; fix them and re-run without the env var.'
  ).toBe(0);
}

/**
 * Wait for every running animation and transition to drain.
 *
 * Transitions drain in waves, not in one batch, so a poll for "nothing running
 * right now" can exit through a gap between waves. Require quiescence to hold
 * for several consecutive frames instead.
 *
 * This lab's own animations are `requestAnimationFrame` loops painting a
 * canvas, which `document.getAnimations()` does not know about — but under
 * `prefers-reduced-motion: reduce` `animate()` in `src/main.ts` jumps straight
 * to the final frame and never starts a loop, so there is nothing to wait for.
 * That is asserted, not assumed: `boot` checks the media query really took.
 */
export async function settle(page: Page): Promise<void> {
  await page.waitForFunction(
    () => {
      const w = window as unknown as { __quietFrames?: number };
      const running = document.getAnimations().filter((a) => a.playState === 'running');
      w.__quietFrames = running.length === 0 ? (w.__quietFrames ?? 0) + 1 : 0;
      return w.__quietFrames >= 6;
    },
    undefined,
    { timeout: 20_000, polling: 'raf' }
  );
}

/**
 * Assert that reduced motion left the page visible, not merely un-animated.
 *
 * The failure mode this guards against is an element whose only route to its
 * visible state is an animation, in a stylesheet whose reduced-motion block
 * cancels that animation without restoring its end state — the element then
 * renders at `opacity: 0` for every reader with the preference set.
 */
async function expectNotBlank(page: Page, label: string): Promise<void> {
  const invisible = await page.evaluate(() => {
    const out: string[] = [];
    for (const el of Array.from(document.querySelectorAll('body *'))) {
      const own = Array.from(el.childNodes)
        .filter((n) => n.nodeType === Node.TEXT_NODE)
        .map((n) => n.textContent ?? '')
        .join('')
        .trim();
      if (!own) continue;
      // Deliberately hidden subtrees are not "blank", they are closed.
      if (!(el as HTMLElement).checkVisibility?.({ checkVisibilityCSS: true })) continue;
      let effective = 1;
      let node: Element | null = el;
      while (node) {
        effective *= parseFloat(getComputedStyle(node).opacity);
        node = node.parentElement;
      }
      if (effective === 0) {
        out.push(`${el.tagName.toLowerCase()}.${(el.getAttribute('class') ?? '').trim()}`);
      }
    }
    return Array.from(new Set(out));
  });
  expect(invisible, `no visible text may render at opacity 0 in state: ${label}`).toEqual([]);
}

/**
 * Load the page in a known theme with reduced motion actually in effect, and
 * assert the content every scan relies on is really on the page.
 *
 * `test.use({ reducedMotion })` silently does nothing on Playwright 1.61.1, so
 * the emulation is applied imperatively BEFORE the navigation and then
 * *asserted* from inside the page. The order matters here more than usual:
 * `src/main.ts` reads `matchMedia('(prefers-reduced-motion: reduce)')` at the
 * moment each animation starts, and `index.html`'s anti-flash script reads
 * `localStorage.theme` before the first paint, so both must be settled before
 * `goto` rather than toggled afterwards.
 */
export async function boot(page: Page, theme: 'dark' | 'light'): Promise<void> {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript((t) => localStorage.setItem('theme', t), theme);
  await page.goto('.');
  expect(
    await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches),
    'reduced-motion emulation must actually be in effect'
  ).toBe(true);
  // This lab stamps `data-theme` for BOTH themes (the anti-flash script writes
  // `saved ?? 'dark'`), so the attribute is asserted directly either way.
  await expect(page.locator('html')).toHaveAttribute('data-theme', theme);

  // ASSERT THE LAB'S DEFAULTS rather than assuming them, and they are not the
  // obvious ones. The markup ships all four exponent inputs at `value="0"` and
  // all five result panels empty — but `src/main.ts` runs
  // `let exchange = keyExchange()` and `renderExchangeSummary(exchange)` at
  // module scope, which draws a RANDOM Alice and Bob, writes their exponents
  // over the four zeros and fills `#sidh-output` before first paint. So the
  // page a visitor actually loads already has exhibit 3 populated. A gate
  // asserting the markup's zeros would fail against a correct page; one that
  // assumed empty panels would scan a state that never exists.
  await expect(page.locator('#app h1')).toBeVisible();
  await expect(page.locator('#canvas-graph')).toBeVisible();
  await expect(page.locator('#sidh-output')).not.toBeEmpty();
  const bound = Number(await page.locator('#in-alice-a').getAttribute('max'));
  expect(Number.isFinite(bound) && bound > 0, 'the exponent inputs must declare an upper bound').toBe(true);
  for (const id of ['in-alice-a', 'in-alice-b', 'in-bob-a', 'in-bob-b']) {
    const v = Number(await page.locator(`#${id}`).inputValue());
    expect(
      Number.isInteger(v) && v >= 0 && v <= bound,
      `${id} must be seeded with an in-range exponent, got ${v}`
    ).toBe(true);
  }
  for (const id of ['isogeny-output', 'graph-output', 'commute-output', 'attack-output']) {
    await expect(page.locator(`#${id}`)).toBeEmpty();
  }
  await expect(page.locator('#gloss-popover')).toBeHidden();
  await expect(page.locator('#btn-replay-isogeny')).toBeHidden();

  await settle(page);
  await expectNotBlank(page, `${theme} first paint`);
}

/**
 * Assert the page does not require horizontal scrolling.
 *
 * WCAG 1.4.10 (Reflow, AA). axe has no rule for this at all, and this lab is a
 * plausible offender: the `.kv` rows are a two-column grid whose first track is
 * `minmax(8rem, 12rem)` and whose second holds unbroken `<code>` runs of curve
 * equations and point tuples, and the five canvases are 640px wide intrinsically.
 */
export async function expectNoHorizontalOverflow(page: Page, label: string): Promise<void> {
  const overflow = await page.evaluate(() => {
    const doc = document.documentElement;
    // `body { overflow-x: hidden }` propagates to the viewport when `html`
    // leaves `overflow` at `visible`, so `scrollWidth` stays equal to
    // `clientWidth` even when content is CUT OFF — a worse 1.4.10 outcome than
    // a scrollbar, and invisible to the standard check. This lab does not have
    // that rule today; the check is written to detect the clipping directly
    // anyway, so adding one later cannot turn this oracle permanently green.
    const clippedByViewport = ['hidden', 'clip'].includes(
      getComputedStyle(document.body).overflowX,
    );
    if (!clippedByViewport && doc.scrollWidth <= doc.clientWidth) return null;

    // Only elements that actually push the DOCUMENT sideways are culprits. A
    // wide block inside an `overflow-x: auto` wrapper has a huge bounding rect
    // but is clipped by its scroller and contributes nothing to the document's
    // scroll width — naming it sends you off fixing the wrong element.
    const clipped = (el: Element): boolean => {
      let n = el.parentElement;
      // Stop BEFORE <body>. When `body { overflow-x: hidden }` propagates to the
      // viewport, body itself answers "hidden" to this walk — so every element
      // on the page reads as clipped, `escaping` is always empty, and the oracle
      // reports nothing at all. That is the failure this whole check exists to
      // avoid: a viewport-level clip is the DEFECT, not a legitimate scroller.
      // Only a genuine scrolling container INSIDE the page excuses an overflow.
      while (n && n !== doc && n !== document.body) {
        const ox = getComputedStyle(n).overflowX;
        if (ox === 'auto' || ox === 'scroll' || ox === 'hidden' || ox === 'clip') return true;
        n = n.parentElement;
      }
      return false;
    };

    const over = Array.from(document.querySelectorAll('body *'))
      .map((el) => ({ el, r: el.getBoundingClientRect() }))
      .filter((x) => x.r.width > 0 && x.r.right > doc.clientWidth + 1)
      .sort((a, b) => b.r.right - a.r.right);
    // Anything inside a real scroller is reachable and is not a finding; only
    // what escapes the viewport with no way back is.
    const escaping = over.filter((x) => !clipped(x.el));
    if (!escaping.length) return null;
    const widest = escaping[0];
    return {
      scrollWidth: doc.scrollWidth,
      clientWidth: doc.clientWidth,
      widest: widest
        ? `${widest.el.tagName.toLowerCase()}${widest.el.id ? '#' + widest.el.id : ''}` +
          `${widest.el.getAttribute('class') ? '.' + widest.el.getAttribute('class')!.trim().split(/\s+/).join('.') : ''}` +
          ` @${Math.round(widest.r.width)}px right=${Math.round(widest.r.right)}`
        : '(none identified)',
    };
  });
  expect(overflow, `page must not scroll horizontally in state: ${label}`).toBeNull();
}

/**
 * Every scrolling container must be operable from the keyboard (WCAG 2.1.1).
 * If it holds no focusable content it needs `tabindex="0"`, so it becomes a
 * focus target arrow keys can then scroll.
 */
export async function expectScrollersReachable(page: Page, label: string): Promise<void> {
  const unreachable = await page.evaluate(() => {
    const FOCUSABLE = 'a[href],button,input,select,textarea,[tabindex]:not([tabindex="-1"])';
    return Array.from(document.querySelectorAll<HTMLElement>('body *'))
      .filter((el) => el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1)
      .filter((el) => {
        const cs = getComputedStyle(el);
        return (
          ['auto', 'scroll'].includes(cs.overflowX) || ['auto', 'scroll'].includes(cs.overflowY)
        );
      })
      .filter((el) => el.tabIndex < 0 && !el.querySelector(FOCUSABLE))
      .map(
        (el) =>
          `${el.tagName.toLowerCase()}.${(el.getAttribute('class') ?? '').trim()}` +
          ` (${el.scrollWidth}x${el.scrollHeight} in ${el.clientWidth}x${el.clientHeight})`
      );
  });
  expect(
    Array.from(new Set(unreachable)),
    `scrolling regions with no keyboard route in state: ${label}`
  ).toEqual([]);
}

/**
 * Scan the page as it currently stands.
 *
 * Six assertions, because axe's `violations` array alone is not a complete
 * oracle:
 *
 *  - `expectNotBlank` — nothing visible may render at effective opacity 0. This
 *    is the reduced-motion end-state check: a stylesheet that cancels an
 *    animation without restoring what it animated TO leaves the element blank
 *    for exactly the readers who asked for less motion.
 *  - `violations` — the usual WCAG A/AA rule failures.
 *  - `incomplete` — axe's "could not decide" bucket, which never reaches the
 *    violations array. The one rule id allowed to remain incomplete is
 *    `color-contrast`, and only because the next assertion computes those
 *    ratios arithmetically. Everything else in that bucket is a real result
 *    axe simply could not finish — including `aria-prohibited-attr`, which is
 *    where an `aria-label` on a role-less div hides, a defect that never
 *    reaches the violations array at all.
 *  - arithmetic contrast — composite-aware WCAG 1.4.3 over every text node.
 *  - keyboard reachability of scrolling regions — WCAG 2.1.1.
 *  - reflow — WCAG 1.4.10, which axe has no rule for at all.
 */
/**
 * WCAG 1.4.11 and generated content, ratcheted against a per-repo baseline.
 *
 * Neither class has ANY other oracle: axe has no rule for non-text contrast,
 * and the arithmetic text walk cannot reach a control's boundary or a
 * `::before` glyph, because a pseudo-element is not an element and owns no text
 * node. Both were being found by hand-sampling screenshot pixels, which does
 * not regress-test.
 *
 * The backlog is real, so this does not block on it — but a check that merely
 * logs is not a gate, and this sweep has spent its whole length deleting checks
 * that could not fail. So it ratchets instead: anything NOT in the baseline
 * fails, anything in the baseline that got WORSE fails, and anything in the
 * baseline that has been FIXED fails until its entry is deleted. That last rule
 * is what stops the allowlist becoming a permanent exemption.
 */
const nonTextSeen = new Set<string>();

export async function expectNoNewNonTextFailures(page: Page, label: string): Promise<void> {
  const found = await auditNonText(page);
  // Capture mode: emit every finding and assert nothing, so a baseline can be
  // generated by the SAME path that checks it. Opt-in via env, and the run is
  // deliberately left failing at the end by `expectBaselineNotStale` so a
  // capture pass can never be mistaken for a passing gate.
  if (process.env.NT_BASELINE_CAPTURE) {
    for (const f of found) {
      console.log(`NTCAP|${f.kind}|${f.selector}|${f.ratio}|${f.required}|${/POSITIONED/.test(f.detail)}`);
    }
    return;
  }
  const problems: string[] = [];
  for (const f of found) {
    const key = `${f.kind}|${f.selector}`;
    nonTextSeen.add(key);
    const base = NONTEXT_BASELINE[key];
    if (!base) {
      problems.push(`NEW ${f.ratio}:1 (needs ${f.required}:1) [${f.kind}] ${f.selector} — ${f.detail}`);
    } else if (f.ratio < base.ratio - 0.01) {
      problems.push(
        `WORSE ${f.selector}: ${f.ratio}:1, baseline recorded ${base.ratio}:1`
      );
    }
  }
  expect(problems, `new or worsened non-text contrast in state: ${label}`).toEqual([]);
}

/**
 * Fail if a baselined finding never appeared during the whole drive.
 *
 * It has either been fixed — in which case delete the entry, which is the point
 * — or the drive stopped reaching the state that shows it, which is a coverage
 * regression worth knowing about. Call once, after `driveAllStates`.
 */
export function expectBaselineNotStale(): void {
  const unseen = Object.keys(NONTEXT_BASELINE).filter((k) => !nonTextSeen.has(k));
  expect(
    unseen,
    'baselined non-text findings that no longer appear — delete them from nontext-baseline.ts (or restore the drive state that showed them)'
  ).toEqual([]);
}

export async function scan(page: Page, label: string): Promise<void> {
  await settle(page);
  await soft(() => expectNotBlank(page, label));
  const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();

  const violations = results.violations.map((v) => ({
    state: label,
    id: v.id,
    impact: v.impact,
    help: v.help,
    nodes: v.nodes.map((n) => n.target.join(' ')).slice(0, 8),
  }));
  await soft(() => expect(violations, `axe violations in state: ${label}`).toEqual([]));

  const unexplainedIncomplete = results.incomplete
    .filter((v) => v.id !== 'color-contrast')
    .map((v) => ({
      state: label,
      id: v.id,
      nodes: v.nodes.map((n) => n.target.join(' ')).slice(0, 8),
    }));
  await soft(() =>
    expect(unexplainedIncomplete, `axe incomplete results in state: ${label}`).toEqual([])
  );

  const contrast = Array.from(new Set(formatContrastFailures(await auditContrast(page))));
  await soft(() => expect(contrast, `measured contrast failures in state: ${label}`).toEqual([]));

  await soft(() => expectScrollersReachable(page, label));
  await soft(() => expectNoHorizontalOverflow(page, label));
  await expectNoNewNonTextFailures(page, label);
}

/**
 * Drive the lab through the states that render content, scanning each.
 *
 * Four of the five exhibits start with an EMPTY result panel that
 * `.output:empty { display: none }` removes from the page entirely (exhibit 3
 * is the exception — see `boot`). So there is no useful scan of this lab that
 * does not press its buttons: the drive walks each exhibit's controls in turn
 * and scans after every single step, including the error and empty branches and
 * the Resets.
 *
 * Order matters in two places and is not incidental:
 *
 *  - exhibit 2b ("both orders") has a genuine EMPTY-STATE branch — with a zero
 *    exponent it refuses and explains why — so it is pressed once before any
 *    step is taken and again after steps of both colours.
 *  - exhibit 4 attacks whichever Alice exhibit 3 last produced, so it is driven
 *    both before exhibit 3 has run (the shipped default exchange) and after a
 *    hand-entered secret has replaced it.
 */
export async function driveAllStates(page: Page, theme: string): Promise<void> {
  await scan(page, `${theme} / first paint`);

  // --- Skip link: parked off-screen until focused. The focused rendering is a
  // real state and the contrast walk deliberately skips the parked one.
  await page.keyboard.press('Tab');
  await expect(page.locator('.cl-skip-link')).toBeFocused();
  await scan(page, `${theme} / skip link focused`);

  // --- Glossary popover. A tooltip is a state, and it is the only floating
  // surface on the page; scan it open, then re-scan it closed.
  const gloss = page.locator('.gloss');
  await gloss.nth(0).click();
  await expect(page.locator('#gloss-popover')).toBeVisible();
  await expect(page.locator('#gloss-popover')).not.toBeEmpty();
  await expect(gloss.nth(0)).toHaveAttribute('aria-expanded', 'true');
  await expect(gloss.nth(0)).toHaveAttribute('aria-describedby', 'gloss-popover');
  await scan(page, `${theme} / glossary popover open`);

  // Switching terms while one is open: the previous button must give up both
  // its expanded state and its description, or two buttons claim one popover.
  await gloss.nth(1).click();
  await expect(page.locator('#gloss-popover')).toBeVisible();
  await expect(gloss.nth(0)).toHaveAttribute('aria-expanded', 'false');
  await expect(gloss.nth(0)).not.toHaveAttribute('aria-describedby', /./);
  await expect(gloss.nth(1)).toHaveAttribute('aria-expanded', 'true');
  await scan(page, `${theme} / glossary popover switched term`);

  await page.keyboard.press('Escape');
  await expect(page.locator('#gloss-popover')).toBeHidden();
  await expect(gloss.nth(1)).toHaveAttribute('aria-expanded', 'false');
  await scan(page, `${theme} / glossary popover closed`);

  // --- Exhibit 1: the isogeny animation, and its Replay button, which ships
  // `hidden` and is only revealed once the animation has run.
  await page.locator('#btn-run-isogeny').click();
  await expect(page.locator('#isogeny-output')).not.toBeEmpty();
  await expect(page.locator('#btn-replay-isogeny')).toBeVisible();
  await scan(page, `${theme} / exhibit 1 run`);
  await page.locator('#btn-replay-isogeny').click();
  await expect(page.locator('#isogeny-output')).not.toBeEmpty();
  await scan(page, `${theme} / exhibit 1 replay`);

  // --- Exhibit 2b BEFORE any step: the refusal branch ("Nothing to swap").
  await page.locator('#btn-commute').click();
  await expect(page.locator('#commute-output')).toContainText('Nothing to swap');
  await scan(page, `${theme} / exhibit 2 commute refused (zero vector)`);

  // --- Exhibit 2: build a walk one edge at a time, scanning each edge.
  await page.locator('#btn-step-a').click();
  await expect(page.locator('#graph-output')).not.toBeEmpty();
  await scan(page, `${theme} / exhibit 2 one A-step`);
  await page.locator('#btn-step-b').click();
  await scan(page, `${theme} / exhibit 2 A+B steps`);

  // Now the commute exhibit has a vector with some of each and draws both routes.
  await page.locator('#btn-commute').click();
  await expect(page.locator('#commute-output')).not.toContainText('Nothing to swap');
  await scan(page, `${theme} / exhibit 2 commute both orders`);

  await page.locator('#btn-random-walk').click();
  await expect(page.locator('#graph-output')).not.toBeEmpty();
  await scan(page, `${theme} / exhibit 2 random walk`);

  await page.locator('#btn-reset-walk').click();
  await expect(page.locator('#graph-output')).toBeEmpty();
  await scan(page, `${theme} / exhibit 2 reset`);

  // --- Exhibit 3. The animated exchange first, then the two secret-picker
  // branches, then the validation error — which is a `role="alert"` that is
  // `display: none` while empty, so it exists only in the state built here.
  await page.locator('#btn-run-sidh').click();
  await expect(page.locator('#sidh-output')).not.toBeEmpty();
  await scan(page, `${theme} / exhibit 3 animated exchange`);

  await page.locator('#btn-random-secrets').click();
  await expect(page.locator('#sidh-output')).not.toBeEmpty();
  await scan(page, `${theme} / exhibit 3 randomised secrets`);

  // Drive the EXTREMES of the exponent inputs, not just the shipped zeros: the
  // upper bound is the longest walk, the widest exponent vector and the largest
  // `.kv` payload the panel ever holds.
  const bound = await page.locator('#in-alice-a').getAttribute('max');
  expect(bound, 'the exponent inputs must declare an upper bound').not.toBeNull();
  for (const id of ['in-alice-a', 'in-alice-b', 'in-bob-a', 'in-bob-b']) {
    await page.locator(`#${id}`).fill(bound as string);
  }
  await page.locator('#btn-use-secrets').click();
  await expect(page.locator('#secret-error')).toBeEmpty();
  await expect(page.locator('#sidh-output')).not.toBeEmpty();
  await scan(page, `${theme} / exhibit 3 secrets at upper bound ${bound}`);

  // Out-of-range input: the error branch, with the panel it refuses to replace
  // still on screen.
  await page.locator('#in-alice-a').fill(String(Number(bound) + 1));
  await page.locator('#btn-use-secrets').click();
  await expect(page.locator('#secret-error')).not.toBeEmpty();
  await scan(page, `${theme} / exhibit 3 secret out of range`);

  await page.locator('#in-alice-a').fill('0');
  await page.locator('#btn-use-secrets').click();
  await expect(page.locator('#secret-error')).toBeEmpty();
  await scan(page, `${theme} / exhibit 3 secrets back in range`);

  // --- Exhibit 4: brute force, against whichever Alice exhibit 3 left behind.
  await page.locator('#btn-run-attack').click();
  await expect(page.locator('#attack-output')).not.toBeEmpty();
  await expect(page.locator('#attack-output')).toContainText('Recovered secret');
  await scan(page, `${theme} / exhibit 4 attack complete`);
}
