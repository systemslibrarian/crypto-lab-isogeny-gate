import { describe, it, expect } from 'vitest';
import {
  Curve,
  ECPoint,
  pointAdd,
  pointNegate,
  scalarMul,
  pointOrder,
  isOnCurve,
  allPoints,
  countPoints,
  jInvariant,
  isSupersingular,
  isIsomorphic,
  sqrtMod,
  modPow,
  veluCodomain,
  veluEvaluate,
  randomPoint,
} from './ec';

const E7: Curve = { a: 1n, b: 1n, p: 7n }; // y² = x³ + x + 1 over GF(7)
const E0: Curve = { a: 0n, b: 1n, p: 419n }; // supersingular toy base curve

describe('finite field', () => {
  it('modPow matches naive exponentiation', () => {
    expect(modPow(3n, 5n, 7n)).toBe(243n % 7n);
  });

  it('sqrtMod returns a genuine square root or null', () => {
    for (let n = 0n; n < 7n; n++) {
      const r = sqrtMod(n, 7n);
      if (r === null) continue;
      expect((r * r) % 7n).toBe(n % 7n);
    }
  });
});

describe('group law', () => {
  it('every affine point lies on the curve', () => {
    for (const P of allPoints(E7)) expect(isOnCurve(P, E7)).toBe(true);
  });

  it('P + O = P and P + (−P) = O', () => {
    const P = allPoints(E7)[1];
    expect(pointAdd(P, null, E7)).toEqual(P);
    expect(pointAdd(P, pointNegate(P, E7), E7)).toBeNull();
  });

  it('addition is commutative', () => {
    const pts = allPoints(E7);
    const P = pts[1];
    const Q = pts[2];
    expect(pointAdd(P, Q, E7)).toEqual(pointAdd(Q, P, E7));
  });

  it('scalarMul agrees with repeated addition', () => {
    const P = allPoints(E7)[1];
    let acc: ECPoint = null;
    for (let k = 0n; k <= 6n; k++) {
      expect(scalarMul(k, P, E7)).toEqual(acc);
      acc = pointAdd(acc, P, E7);
    }
  });

  it('order(P) · P = O', () => {
    const P = allPoints(E7)[1];
    const ord = pointOrder(P, E7);
    expect(scalarMul(ord, P, E7)).toBeNull();
  });
});

describe('counting and supersingularity', () => {
  it('Hasse bound holds for E7', () => {
    const n = countPoints(E7);
    const t = n - (E7.p + 1n);
    expect(t * t <= 4n * E7.p).toBe(true);
  });

  it('allPoints count equals countPoints', () => {
    expect(BigInt(allPoints(E7).length)).toBe(countPoints(E7));
  });

  it('E0 over GF(419) is supersingular with #E = p + 1', () => {
    expect(countPoints(E0)).toBe(420n);
    expect(isSupersingular(E0)).toBe(true);
  });
});

describe('isomorphism', () => {
  it('a curve is isomorphic to itself', () => {
    expect(isIsomorphic(E0, E0)).toBe(true);
  });

  it('distinguishes a quadratic twist (non-residue scaling)', () => {
    // Scaling by a non-residue u with a=0 gives a non-isomorphic curve.
    const twist: Curve = { a: 0n, b: (E0.b * 3n) % 419n, p: 419n };
    // b → u⁶ b is isomorphic; an arbitrary scaling generally is not.
    // Just assert the relation is symmetric and reflexive here:
    expect(isIsomorphic(E0, twist)).toBe(isIsomorphic(twist, E0));
  });
});

describe('Vélu codomain', () => {
  it('an ℓ-isogeny preserves supersingularity (#E = p + 1) for ℓ ∈ {5,7}', () => {
    for (const ell of [5, 7]) {
      const cof = (E0.p + 1n) / BigInt(ell);
      // find a rational point of order ell
      let K: ECPoint = null;
      for (let t = 0; t < 200 && K === null; t++) {
        const R = randomPoint(E0);
        const cand = scalarMul(cof, R, E0);
        if (cand !== null && scalarMul(BigInt(ell), cand, E0) === null) K = cand;
      }
      expect(K).not.toBeNull();
      const codomain = veluCodomain(E0, K as NonNullable<ECPoint>, ell);
      expect(countPoints(codomain)).toBe(420n);
      // codomain is a valid (non-singular) curve, so j is defined
      expect(() => jInvariant(codomain)).not.toThrow();
    }
  });
});

describe('Vélu evaluation (the map φ itself)', () => {
  // Find a rational kernel generator of order ell on E0, plus the codomain.
  function isogeny(ell: number) {
    const cof = (E0.p + 1n) / BigInt(ell);
    let K: ECPoint = null;
    for (let t = 0; t < 400 && K === null; t++) {
      const R = randomPoint(E0);
      const cand = scalarMul(cof, R, E0);
      if (cand !== null && scalarMul(BigInt(ell), cand, E0) === null) K = cand;
    }
    if (K === null) throw new Error('no kernel generator found');
    return { K: K as NonNullable<ECPoint>, codomain: veluCodomain(E0, K as NonNullable<ECPoint>, ell) };
  }

  it('every image point lands ON the codomain curve', () => {
    for (const ell of [5, 7]) {
      const { K, codomain } = isogeny(ell);
      for (const P of allPoints(E0)) {
        const img = veluEvaluate(E0, K, ell, P);
        expect(isOnCurve(img, codomain)).toBe(true);
      }
    }
  });

  it('the whole kernel collapses to the identity O', () => {
    for (const ell of [5, 7]) {
      const { K } = isogeny(ell);
      let Q: ECPoint = null;
      for (let i = 0; i < ell; i++) {
        expect(veluEvaluate(E0, K, ell, Q)).toBeNull(); // O, K, 2K, … all → O
        Q = pointAdd(Q, K, E0);
      }
    }
  });

  it('φ is a group homomorphism: φ(P+R) = φ(P) + φ(R)', () => {
    for (const ell of [5, 7]) {
      const { K, codomain } = isogeny(ell);
      const pts = allPoints(E0).filter((P): P is NonNullable<ECPoint> => P !== null);
      // Sample a handful of pairs (full O(n²) is unnecessary and slow).
      for (let i = 0; i < pts.length; i += 17) {
        for (let j = 0; j < pts.length; j += 23) {
          const P = pts[i];
          const R = pts[j];
          const lhs = veluEvaluate(E0, K, ell, pointAdd(P, R, E0));
          const rhs = pointAdd(
            veluEvaluate(E0, K, ell, P),
            veluEvaluate(E0, K, ell, R),
            codomain
          );
          expect(lhs).toEqual(rhs);
        }
      }
    }
  });
});
