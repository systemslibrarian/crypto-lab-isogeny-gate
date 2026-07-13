/**
 * Elliptic-curve and finite-field arithmetic over GF(p).
 *
 * This is a *toy* implementation for small primes, written for clarity and for
 * exact, reproducible results in the browser. Every operation uses BigInt, so
 * the arithmetic is exact — but the parameters are far too small for security.
 * Do not use any of this in production.
 *
 * Curves are in short Weierstrass form  y² = x³ + a·x + b  (mod p).
 * The point at infinity (the group identity) is represented by `null`.
 */

/** A point on an elliptic curve, or `null` for the point at infinity. */
export type ECPoint = { x: bigint; y: bigint } | null;

/** Short Weierstrass curve y² = x³ + a·x + b over GF(p). */
export interface Curve {
  a: bigint;
  b: bigint;
  p: bigint; // prime modulus
}

/* ------------------------------------------------------------------ *
 * Finite-field arithmetic (GF(p))
 * ------------------------------------------------------------------ */

/** Reduce x into the canonical range [0, p). */
export function mod(x: bigint, p: bigint): bigint {
  return ((x % p) + p) % p;
}

/** Modular exponentiation: base^exp mod m (square-and-multiply). */
export function modPow(base: bigint, exp: bigint, m: bigint): bigint {
  let result = 1n;
  base = mod(base, m);
  while (exp > 0n) {
    if (exp & 1n) result = (result * base) % m;
    exp >>= 1n;
    base = (base * base) % m;
  }
  return result;
}

/** Modular inverse via Fermat's little theorem (p must be prime). */
export function modInverse(a: bigint, p: bigint): bigint {
  if (mod(a, p) === 0n) throw new Error('Cannot invert zero mod p');
  return modPow(a, p - 2n, p);
}

/** Euler's criterion: is n a non-zero quadratic residue mod p? (0 counts as a residue) */
export function isQuadraticResidue(n: bigint, p: bigint): boolean {
  n = mod(n, p);
  if (n === 0n) return true;
  return modPow(n, (p - 1n) / 2n, p) === 1n;
}

/**
 * Square root mod p via Tonelli–Shanks. Returns a y with y² ≡ n (mod p),
 * or `null` if n is a non-residue. Handles the common p ≡ 3 (mod 4) fast path.
 */
export function sqrtMod(n: bigint, p: bigint): bigint | null {
  n = mod(n, p);
  if (n === 0n) return 0n;
  if (!isQuadraticResidue(n, p)) return null;

  if (p % 4n === 3n) {
    return modPow(n, (p + 1n) / 4n, p);
  }

  // General Tonelli–Shanks.
  let Q = p - 1n;
  let S = 0n;
  while ((Q & 1n) === 0n) {
    Q >>= 1n;
    S += 1n;
  }
  let z = 2n;
  while (modPow(z, (p - 1n) / 2n, p) !== p - 1n) z += 1n;

  let M = S;
  let c = modPow(z, Q, p);
  let t = modPow(n, Q, p);
  let R = modPow(n, (Q + 1n) / 2n, p);

  while (t !== 1n) {
    let i = 1n;
    let temp = mod(t * t, p);
    while (temp !== 1n && i < M) {
      temp = mod(temp * temp, p);
      i += 1n;
    }
    const b = modPow(c, 1n << (M - i - 1n), p);
    M = i;
    c = mod(b * b, p);
    t = mod(t * c, p);
    R = mod(R * b, p);
  }
  return R;
}

/* ------------------------------------------------------------------ *
 * Elliptic-curve group law
 * ------------------------------------------------------------------ */

/** Is P on the curve? (the point at infinity always is) */
export function isOnCurve(P: ECPoint, curve: Curve): boolean {
  if (P === null) return true;
  const { p, a, b } = curve;
  const lhs = mod(P.y * P.y, p);
  const rhs = mod(P.x * P.x * P.x + a * P.x + b, p);
  return lhs === rhs;
}

/** Additive inverse of P. */
export function pointNegate(P: ECPoint, curve: Curve): ECPoint {
  if (P === null) return null;
  return { x: P.x, y: mod(-P.y, curve.p) };
}

/** Elliptic-curve point addition (handles doubling and the identity). */
export function pointAdd(P: ECPoint, Q: ECPoint, curve: Curve): ECPoint {
  if (P === null) return Q;
  if (Q === null) return P;

  const { p, a } = curve;
  const { x: x1, y: y1 } = P;
  const { x: x2, y: y2 } = Q;

  if (x1 === x2) {
    // P + (−P) = O
    if (mod(y1 + y2, p) === 0n) return null;
    // Doubling.
    const s = mod((3n * x1 * x1 + a) * modInverse(2n * y1, p), p);
    const x3 = mod(s * s - 2n * x1, p);
    const y3 = mod(s * (x1 - x3) - y1, p);
    return { x: x3, y: y3 };
  }

  const s = mod((y2 - y1) * modInverse(x2 - x1, p), p);
  const x3 = mod(s * s - x1 - x2, p);
  const y3 = mod(s * (x1 - x3) - y1, p);
  return { x: x3, y: y3 };
}

/** Scalar multiplication k·P via double-and-add. */
export function scalarMul(k: bigint, P: ECPoint, curve: Curve): ECPoint {
  if (P === null || k === 0n) return null;
  if (k < 0n) return scalarMul(-k, pointNegate(P, curve), curve);

  let result: ECPoint = null;
  let addend: ECPoint = P;
  while (k > 0n) {
    if (k & 1n) result = pointAdd(result, addend, curve);
    addend = pointAdd(addend, addend, curve);
    k >>= 1n;
  }
  return result;
}

/** Order of P: smallest m > 0 with m·P = O. Bounded for safety. */
export function pointOrder(P: ECPoint, curve: Curve, limit = 100000n): bigint {
  if (P === null) return 1n;
  let order = 1n;
  let current: ECPoint = P;
  while (current !== null) {
    current = pointAdd(current, P, curve);
    order += 1n;
    if (order > limit) throw new Error('pointOrder exceeded limit');
  }
  return order;
}

/* ------------------------------------------------------------------ *
 * Point counting, sampling, and invariants
 * ------------------------------------------------------------------ */

/**
 * #E(GF(p)) — the number of points including the point at infinity.
 * O(p): one Legendre symbol per x. Fine for the small primes used here.
 */
export function countPoints(curve: Curve): bigint {
  const { p, a, b } = curve;
  let count = 1n; // point at infinity
  for (let x = 0n; x < p; x++) {
    const rhs = mod(x * x * x + a * x + b, p);
    if (rhs === 0n) count += 1n;
    else if (isQuadraticResidue(rhs, p)) count += 2n;
  }
  return count;
}

/** Every affine point on the curve, plus the point at infinity. */
export function allPoints(curve: Curve): ECPoint[] {
  const { p, a, b } = curve;
  const points: ECPoint[] = [null];
  for (let x = 0n; x < p; x++) {
    const rhs = mod(x * x * x + a * x + b, p);
    const y = sqrtMod(rhs, p);
    if (y === null) continue;
    points.push({ x, y });
    if (y !== 0n) points.push({ x, y: mod(-y, p) });
  }
  return points;
}

/**
 * A uniformly-random affine point on the curve, found by rejection sampling.
 * `rand` returns a float in [0, 1); defaults to Math.random. Throws if no point
 * is found within the attempt budget (effectively never for these curves).
 */
export function randomPoint(
  curve: Curve,
  rand: () => number = Math.random,
  attempts = 10000
): NonNullable<ECPoint> {
  const { p, a, b } = curve;
  for (let i = 0; i < attempts; i++) {
    const x = BigInt(Math.floor(rand() * Number(p)));
    const rhs = mod(x * x * x + a * x + b, p);
    const y = sqrtMod(rhs, p);
    if (y !== null) return { x, y };
  }
  throw new Error('randomPoint: exhausted attempts');
}

/** j-invariant: j = 1728 · 4a³ / (4a³ + 27b²) (mod p). */
export function jInvariant(curve: Curve): bigint {
  const { p, a, b } = curve;
  const a3 = mod(a * a * a, p);
  const num = mod(1728n * 4n * a3, p);
  const den = mod(4n * a3 + 27n * b * b, p);
  if (den === 0n) throw new Error('Singular curve: 4a³ + 27b² ≡ 0');
  return mod(num * modInverse(den, p), p);
}

/**
 * Supersingularity test for small p: over GF(p) a curve is supersingular iff
 * #E(GF(p)) = p + 1 (trace of Frobenius is 0).
 */
export function isSupersingular(curve: Curve): boolean {
  return countPoints(curve) === curve.p + 1n;
}

/**
 * Are two curves isomorphic over GF(p)? They are iff there is u ≠ 0 with
 * a₂ = u⁴·a₁ and b₂ = u⁶·b₁. O(p) search — only for small p.
 */
export function isIsomorphic(c1: Curve, c2: Curve): boolean {
  const p = c1.p;
  if (c2.p !== p) return false;
  for (let u = 1n; u < p; u++) {
    const u2 = mod(u * u, p);
    const u4 = mod(u2 * u2, p);
    const u6 = mod(u4 * u2, p);
    if (mod(c1.a * u4, p) === mod(c2.a, p) && mod(c1.b * u6, p) === mod(c2.b, p)) {
      return true;
    }
  }
  return false;
}

/* ------------------------------------------------------------------ *
 * Vélu's formulas
 * ------------------------------------------------------------------ */

/**
 * Codomain of the ℓ-isogeny with kernel ⟨K⟩, for ODD prime ℓ, via Vélu's
 * formulas on a short Weierstrass curve y² = x³ + a·x + b.
 *
 * Summing over a set S of (ℓ−1)/2 representatives — one from each {Q, −Q} pair
 * in the kernel — with, for each Q = (xQ, yQ):
 *
 *     gxQ = 3·xQ² + a,   gyQ = −2·yQ
 *     vQ  = 2·gxQ,       uQ  = gyQ²
 *     v  += vQ,          w  += uQ + xQ·vQ
 *
 * the codomain is  y² = x³ + (a − 5v)·x + (b − 7w).
 *
 * @param curve  domain curve
 * @param K      a generator of the kernel (a point of order ℓ)
 * @param ell    the (odd, prime) kernel order
 */
export function veluCodomain(curve: Curve, K: NonNullable<ECPoint>, ell: number): Curve {
  if (ell % 2 === 0) throw new Error('veluCodomain supports odd ℓ only');
  const { p, a, b } = curve;
  let v = 0n;
  let w = 0n;
  let Q: ECPoint = K;
  for (let i = 0; i < (ell - 1) / 2; i++) {
    if (Q === null) throw new Error('Kernel generator does not have order ℓ');
    const gx = mod(3n * Q.x * Q.x + a, p);
    const gy = mod(-2n * Q.y, p);
    const vQ = mod(2n * gx, p);
    const uQ = mod(gy * gy, p);
    v = mod(v + vQ, p);
    w = mod(w + uQ + Q.x * vQ, p);
    Q = pointAdd(Q, K, curve);
  }
  return { a: mod(a - 5n * v, p), b: mod(b - 7n * w, p), p };
}

/**
 * Evaluate the ℓ-isogeny with kernel ⟨K⟩ at a point P — i.e. compute φ(P) on the
 * codomain returned by {@link veluCodomain}. This is Vélu's *image* formula, the
 * companion to the codomain formula above, and it is what makes the map (not just
 * its target curve) visible:
 *
 *     φ(P) = ( xP + Σ_Q [ x(P+Q) − x(Q) ],  yP + Σ_Q [ y(P+Q) − y(Q) ] )
 *
 * where Q runs over the non-identity kernel points ⟨K⟩ \ {O}. Every point of the
 * kernel maps to the identity O (represented as `null`) — that is precisely what
 * "the kernel collapses to the identity" means, made concrete. And because φ is a
 * group homomorphism, φ(P + R) = φ(P) + φ(R): addition is preserved across the map.
 *
 * @param curve  domain curve
 * @param K      a generator of the kernel (a point of order ℓ)
 * @param ell    the (odd, prime) kernel order
 * @param P      the point to push through φ (or `null` for the identity)
 * @returns      φ(P) on the codomain curve, or `null` if P is in the kernel
 */
export function veluEvaluate(
  curve: Curve,
  K: NonNullable<ECPoint>,
  ell: number,
  P: ECPoint
): ECPoint {
  if (P === null) return null;

  // Build the kernel ⟨K⟩ once: O, K, 2K, …, (ℓ−1)K.
  const kernel: ECPoint[] = [];
  let Q: ECPoint = K;
  for (let i = 1; i < ell; i++) {
    if (Q === null) throw new Error('Kernel generator does not have order ℓ');
    kernel.push(Q);
    Q = pointAdd(Q, K, curve);
  }

  // If P itself is a kernel point (including O), φ(P) = O.
  const { p } = curve;
  for (const Qk of kernel) {
    if (Qk !== null && Qk.x === P.x && Qk.y === P.y) return null;
  }

  let xImg = P.x;
  let yImg = P.y;
  for (const Qk of kernel) {
    const PQ = pointAdd(P, Qk, curve);
    if (PQ === null || Qk === null) {
      // P + Q = O would mean P = −Q is in the kernel; already handled above.
      throw new Error('veluEvaluate: unexpected identity in image sum');
    }
    xImg = mod(xImg + PQ.x - Qk.x, p);
    yImg = mod(yImg + PQ.y - Qk.y, p);
  }
  return { x: xImg, y: yImg };
}
