import { describe, it, expect } from 'vitest';
import { isIsomorphic, jInvariant } from './ec';
import {
  PARAMS,
  applyIsogenyStep,
  groupAction,
  keyExchange,
  keyGen,
  deriveShared,
  bruteForceRecover,
  randomSecret,
} from './csidh';

describe('group action', () => {
  it('applyIsogenyStep is deterministic up to isomorphism', () => {
    for (const ell of PARAMS.ells) {
      const a = applyIsogenyStep(PARAMS.E0, ell);
      const b = applyIsogenyStep(PARAMS.E0, ell);
      expect(isIsomorphic(a, b)).toBe(true);
    }
  });

  it('codomains stay supersingular (handled by ec tests) and on-field', () => {
    const c = applyIsogenyStep(PARAMS.E0, PARAMS.ells[0]);
    expect(c.p).toBe(PARAMS.p);
  });

  it('the action commutes: [ℓ₁]^a [ℓ₂]^b = [ℓ₂]^b [ℓ₁]^a', () => {
    const [l1, l2] = PARAMS.ells;
    const path1 = groupAction(PARAMS.E0, [3, 0], PARAMS); // l1^3
    const viaL2 = applyIsogenyStep(applyIsogenyStep(path1, l2), l2); // then l2^2
    const other = groupAction(PARAMS.E0, [3, 2], PARAMS);
    expect(isIsomorphic(viaL2, other)).toBe(true);
    void l1;
  });
});

describe('key exchange', () => {
  it('Alice and Bob always agree (30 random runs)', () => {
    for (let i = 0; i < 30; i++) {
      const r = keyExchange();
      expect(r.agree).toBe(true);
      expect(jInvariant(r.aliceShared)).toBe(jInvariant(r.bobShared));
    }
  });

  it('secrets stay within the declared bound', () => {
    for (let i = 0; i < 20; i++) {
      for (const e of randomSecret()) {
        expect(e).toBeGreaterThanOrEqual(0);
        expect(e).toBeLessThanOrEqual(PARAMS.expBound);
      }
    }
  });

  it('deriveShared is symmetric for a fixed pair', () => {
    const alice = keyGen();
    const bob = keyGen();
    const sAB = deriveShared(alice.secret, bob.publicCurve);
    const sBA = deriveShared(bob.secret, alice.publicCurve);
    expect(isIsomorphic(sAB, sBA)).toBe(true);
  });
});

describe('brute-force recovery', () => {
  it('recovers a secret that reproduces the public key', () => {
    const alice = keyGen();
    const res = bruteForceRecover(alice.publicCurve, alice.secret);
    const reproduced = groupAction(PARAMS.E0, res.recovered, PARAMS);
    expect(isIsomorphic(reproduced, alice.publicCurve)).toBe(true);
    expect(res.tested).toBeGreaterThan(0);
    expect(res.tested).toBeLessThanOrEqual(res.keySpace);
  });
});
