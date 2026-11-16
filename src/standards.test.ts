import { it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

/**
 * Standards reviewed 15 November 2026.
 *
 * NIST IR 8610 (May 2026) closed the second round of the Additional Digital
 * Signature Schemes process on 14 May 2026 and selected nine candidates for the
 * third round; SQIsign is the only isogeny-based one. "Submitted to NIST's
 * additional-signatures process" was true but undated, and a reader cannot tell
 * from it whether SQIsign is still in the running.
 *
 * The sizes come from the round-3 SQIsign specification, version 3.0
 * (1 September 2026), Table 12: NIST-I public key 83 B, secret key 270 B,
 * signature 200 B. Round 3 RAISED these — §1.4 of that spec records increased
 * parameter sizes in reaction to a new attack — so an undated "very small
 * signatures" claim needs the version that produced the number.
 *
 * This lab implements toy CSIDH, not SQIsign, so no SQIsign timing is quoted
 * here and none should be added: the spec reports cycles on named CPUs, and a
 * cycle count converted to milliseconds would be an invented figure.
 */
const readme = readFileSync('README.md', 'utf8');

it('the SQIsign entry states the round 3 advancement with its date and source', () => {
  expect(readme).toMatch(/\*\*SQIsign\*\*[\s\S]{0,400}advanced to round 3/);
  expect(readme).toMatch(/\*\*SQIsign\*\*[\s\S]{0,400}14 May 2026/);
  expect(readme).toMatch(/\*\*SQIsign\*\*[\s\S]{0,500}NIST IR 8610/);
});

it('quotes the round-3 sizes with the spec version they come from', () => {
  expect(readme).toMatch(/version 3\.0, 1 September 2026/);
  expect(readme).toMatch(/83-byte public key/);
  expect(readme).toMatch(/200-byte signature/);
});

it('cites the CSRC round 3 announcement, not a nist.gov news path', () => {
  expect(readme).toContain(
    'https://csrc.nist.gov/News/2026/nist-advances-9-candidates-to-the-3rd-round-of-pqc',
  );
});

it('carries the dated standards note and disclaims SQIsign figures it does not run', () => {
  expect(readme).toMatch(/\*\*Standards reviewed 15 November 2026:\*\*/);
  expect(readme).toMatch(/does not implement SQIsign/);
});
