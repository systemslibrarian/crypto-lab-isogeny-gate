/**
 * A real (but tiny) CSIDH-style commutative isogeny key exchange.
 *
 * This is genuine isogeny cryptography, not a mock-up:
 *
 *   • Curves are real supersingular elliptic curves over GF(p) with p = 419.
 *   • E₀: y² = x³ + x is supersingular because p ≡ 3 (mod 4); #E₀ = p + 1 = 420.
 *   • For each small odd prime ℓ | (p + 1) the curve has a unique GF(p)-rational
 *     subgroup of order ℓ (the +1 eigenspace of Frobenius). Quotienting by it with
 *     Vélu's formulas gives a well-defined ℓ-isogeny — one fixed "direction" of the
 *     class-group action. A secret exponent says how many times to walk that way.
 *   • Because the class group is abelian, the walks commute: Alice applying her
 *     secret to Bob's curve lands on exactly the same curve as Bob applying his to
 *     Alice's. That shared curve (its j-invariant) is the agreed secret.
 *
 * The parameters are minuscule, so the whole key space can be brute-forced in a
 * blink (see {@link bruteForceRecover}). That is the point of a teaching toy:
 * the mathematics is exact and honest; only the size is insecure.
 *
 * This is the CSIDH family — a *survivor* of the isogeny world. It is NOT SIDH,
 * and it is exactly because CSIDH publishes only a curve (and no torsion-point
 * images) that the Castryck–Decru attack on SIDH does not apply to it.
 */

import {
  Curve,
  ECPoint,
  jInvariant,
  scalarMul,
  randomPoint,
  veluCodomain,
  isIsomorphic,
} from './ec';

export interface CSIDHParams {
  /** Prime field characteristic. */
  p: bigint;
  /** Starting supersingular curve E₀: y² = x³ + x. */
  E0: Curve;
  /** Small odd primes ℓ used as isogeny degrees (each divides p + 1). */
  ells: number[];
  /** Each secret exponent is drawn from {0, 1, …, expBound}. */
  expBound: number;
}

/**
 * Toy parameters. p + 1 = 420 = 2²·3·5·7. We use ℓ ∈ {5, 7}: the 3-isogeny
 * direction is principal here (it acts trivially on E₀'s class), so it would be
 * a "dead" generator and is omitted.
 */
export const PARAMS: CSIDHParams = {
  p: 419n,
  E0: { a: 0n, b: 1n, p: 419n },
  ells: [5, 7],
  expBound: 7,
};

/** A secret key: one exponent per ℓ in {@link CSIDHParams.ells}. */
export type Secret = number[];

/* ------------------------------------------------------------------ *
 * The group action
 * ------------------------------------------------------------------ */

/**
 * Apply a single ℓ-isogeny in the GF(p)-rational direction.
 *
 * Sample a random point R, multiply by the cofactor (p + 1)/ℓ to land in the
 * ℓ-torsion, and (if that yields a point of order ℓ) take the Vélu codomain.
 * The codomain depends only on the kernel subgroup, which is unique, so the
 * result is deterministic regardless of which R was sampled.
 */
export function applyIsogenyStep(
  curve: Curve,
  ell: number,
  rand: () => number = Math.random
): Curve {
  const cofactor = (curve.p + 1n) / BigInt(ell);
  const ellBig = BigInt(ell);
  for (let attempt = 0; attempt < 400; attempt++) {
    const R = randomPoint(curve, rand);
    const K = scalarMul(cofactor, R, curve);
    if (K === null) continue; // R had no ℓ-torsion component
    if (scalarMul(ellBig, K, curve) !== null) continue; // order not exactly ℓ
    return veluCodomain(curve, K as NonNullable<ECPoint>, ell);
  }
  throw new Error(`applyIsogenyStep: no rational point of order ${ell}`);
}

/**
 * The class-group action: starting from `curve`, walk each ℓ-direction
 * `secret[i]` times. Order does not matter (the action is commutative), which
 * is exactly what makes the key exchange work.
 */
export function groupAction(
  curve: Curve,
  secret: Secret,
  params: CSIDHParams = PARAMS,
  rand: () => number = Math.random
): Curve {
  let result = curve;
  for (let i = 0; i < params.ells.length; i++) {
    for (let n = 0; n < secret[i]; n++) {
      result = applyIsogenyStep(result, params.ells[i], rand);
    }
  }
  return result;
}

/* ------------------------------------------------------------------ *
 * Key exchange
 * ------------------------------------------------------------------ */

/** Cryptographically-random secret exponent vector. */
export function randomSecret(params: CSIDHParams = PARAMS): Secret {
  const bytes = new Uint8Array(params.ells.length);
  crypto.getRandomValues(bytes);
  return params.ells.map((_, i) => bytes[i] % (params.expBound + 1));
}

export interface KeyPair {
  secret: Secret;
  /** Public key: the curve E₀ acted on by the secret. */
  publicCurve: Curve;
}

/** Generate a key pair: pick a secret, publish E₀ acted on by it. */
export function keyGen(
  params: CSIDHParams = PARAMS,
  rand: () => number = Math.random
): KeyPair {
  const secret = randomSecret(params);
  return { secret, publicCurve: groupAction(params.E0, secret, params, rand) };
}

/** Derive the shared curve by acting with my secret on their public curve. */
export function deriveShared(
  mySecret: Secret,
  theirPublic: Curve,
  params: CSIDHParams = PARAMS,
  rand: () => number = Math.random
): Curve {
  return groupAction(theirPublic, mySecret, params, rand);
}

export interface KeyExchangeResult {
  alice: KeyPair;
  bob: KeyPair;
  aliceShared: Curve;
  bobShared: Curve;
  /** The agreed secret value both parties compute. */
  sharedInvariant: bigint;
  /** True iff both parties really landed on the same curve. */
  agree: boolean;
}

/**
 * Run a full exchange and verify that both parties agree. The agreement is a
 * theorem (commutativity of the class-group action), checked here at runtime.
 */
export function keyExchange(
  params: CSIDHParams = PARAMS,
  rand: () => number = Math.random
): KeyExchangeResult {
  const alice = keyGen(params, rand);
  const bob = keyGen(params, rand);
  const aliceShared = deriveShared(alice.secret, bob.publicCurve, params, rand);
  const bobShared = deriveShared(bob.secret, alice.publicCurve, params, rand);
  return {
    alice,
    bob,
    aliceShared,
    bobShared,
    sharedInvariant: jInvariant(aliceShared),
    agree: isIsomorphic(aliceShared, bobShared),
  };
}

/* ------------------------------------------------------------------ *
 * Breaking the toy: brute-force key recovery
 * ------------------------------------------------------------------ */

export interface RecoveryResult {
  /** A secret vector that reproduces the target public key. */
  recovered: Secret;
  /** How many candidate secrets were tried before a match. */
  tested: number;
  /** Size of the exhaustively-searchable key space. */
  keySpace: number;
  /** Whether the recovered vector equals the original secret (if provided). */
  matchesOriginal: boolean;
}

/**
 * Recover a working secret for `publicCurve` by exhaustively walking the entire
 * (tiny) key space until a vector reproduces the public key.
 *
 * This is the honest break of a toy: not the deep Castryck–Decru attack on SIDH
 * (which exploited *torsion-point images* via higher-genus gluing — see the UI),
 * but the brute force that always works once the parameters are small enough. It
 * recovers *a* secret consistent with the public key; several vectors can map to
 * the same curve, so it need not equal the original — any preimage is a valid key.
 */
export function bruteForceRecover(
  publicCurve: Curve,
  original?: Secret,
  params: CSIDHParams = PARAMS
): RecoveryResult {
  const dims = params.ells.length;
  const range = params.expBound + 1;
  const keySpace = range ** dims;

  let tested = 0;
  // Enumerate the grid {0..expBound}^dims.
  const candidate = new Array(dims).fill(0);
  for (let idx = 0; idx < keySpace; idx++) {
    let rem = idx;
    for (let d = 0; d < dims; d++) {
      candidate[d] = rem % range;
      rem = Math.floor(rem / range);
    }
    tested++;
    const guessCurve = groupAction(params.E0, candidate, params);
    if (isIsomorphic(guessCurve, publicCurve)) {
      const recovered = candidate.slice();
      const matchesOriginal =
        !!original && original.every((e, i) => e === recovered[i]);
      return { recovered, tested, keySpace, matchesOriginal };
    }
  }
  throw new Error('bruteForceRecover: no secret reproduced the public key');
}
