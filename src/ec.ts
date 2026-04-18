/**
 * Phase 1: Elliptic curve arithmetic over GF(p)
 *
 * Toy implementation for visualization over small primes.
 * All arithmetic exact integers mod p using BigInt.
 * Not for production use.
 */

/**
 * A point on elliptic curve y² = x³ + ax + b (mod p).
 * null represents the point at infinity.
 */
export type ECPoint = { x: bigint; y: bigint } | null;

export interface Curve {
  a: bigint;
  b: bigint;
  p: bigint; // prime modulus
}

/**
 * Modular inverse using Fermat's little theorem (p prime).
 * Returns a^(p-2) mod p.
 */
export function modInverse(a: bigint, p: bigint): bigint {
  if (a === 0n) throw new Error('Cannot invert zero');
  return modPow(a, p - 2n, p);
}

/**
 * Modular exponentiation: base^exp mod modulus
 */
function modPow(base: bigint, exp: bigint, mod: bigint): bigint {
  let result = 1n;
  base = ((base % mod) + mod) % mod;
  while (exp > 0n) {
    if (exp % 2n === 1n) result = (result * base) % mod;
    exp >>= 1n;
    base = (base * base) % mod;
  }
  return result;
}

/**
 * Modular reduction that always returns positive result
 */
function mod(x: bigint, p: bigint): bigint {
  return ((x % p) + p) % p;
}

/**
 * Check if a point is on the curve.
 */
export function isOnCurve(P: ECPoint, curve: Curve): boolean {
  if (P === null) return true; // point at infinity

  const p = curve.p;
  const { x, y } = P;
  const left = mod(y * y, p);
  const right = mod(x * x * x + curve.a * x + curve.b, p);
  return left === right;
}

/**
 * Elliptic curve point addition over GF(p).
 * Handles: P + Q, P + P (doubling), P + O (identity).
 */
export function pointAdd(P: ECPoint, Q: ECPoint, curve: Curve): ECPoint {
  // P + O = P, O + Q = Q
  if (P === null) return Q;
  if (Q === null) return P;

  const p = curve.p;
  const { x: x1, y: y1 } = P;
  const { x: x2, y: y2 } = Q;

  // P + (-P) = O
  if (x1 === x2) {
    if (mod(y1 + y2, p) === 0n) return null;
    // P + P (doubling)
    const s = mod((3n * x1 * x1 + curve.a) * modInverse(2n * y1, p), p);
    const x3 = mod(s * s - 2n * x1, p);
    const y3 = mod(s * (x1 - x3) - y1, p);
    return { x: x3, y: y3 } as ECPoint;
  }

  // General case: P + Q where x1 ≠ x2
  const s = mod((y2 - y1) * modInverse(x2 - x1, p), p);
  const x3 = mod(s * s - x1 - x2, p);
  const y3 = mod(s * (x1 - x3) - y1, p);

  return { x: x3, y: y3 } as ECPoint;
}

/**
 * Scalar multiplication: k*P using double-and-add.
 */
export function scalarMul(k: bigint, P: ECPoint, curve: Curve): ECPoint {
  if (P === null) return null;
  if (k === 0n) return null; // point at infinity
  if (k < 0n) {
    // k*P = -(-k)*P
    const neg_P = P.y === null ? null : { x: P.x, y: mod(-P.y, curve.p) };
    return scalarMul(-k, neg_P, curve);
  }

  let result: ECPoint = null;
  let addend: ECPoint = P;

  while (k > 0n) {
    if ((k & 1n) === 1n) {
      result = pointAdd(result, addend, curve);
    }
    addend = pointAdd(addend, addend, curve);
    k >>= 1n;
  }

  return result;
}

/**
 * Find all points on a curve over GF(p) (only feasible for small p).
 * Returns array of all affine points plus the point at infinity.
 */
export function allPoints(curve: Curve): ECPoint[] {
  const points: ECPoint[] = [null]; // point at infinity
  const p = curve.p;

  for (let x = 0n; x < p; x++) {
    // y² = x³ + ax + b
    const rhs = mod(x * x * x + curve.a * x + curve.b, p);

    // Check if rhs is a quadratic residue mod p
    // Using Euler's criterion: a^((p-1)/2) ≡ 1 (mod p) iff a is QR
    const legendre = modPow(rhs, (p - 1n) / 2n, p);
    if (legendre !== 1n && legendre !== 0n) continue; // not a QR

    // Find square roots
    if (rhs === 0n) {
      points.push({ x, y: 0n } as ECPoint);
    } else {
      // Tonelli-Shanks for small p
      const y = tonelliShanks(rhs, p);
      if (y !== null) {
        points.push({ x, y } as ECPoint);
        if (y !== 0n) {
          points.push({ x, y: mod(-y, p) } as ECPoint);
        }
      }
    }
  }

  return points;
}

/**
 * Tonelli-Shanks algorithm for finding square roots mod p.
 */
function tonelliShanks(n: bigint, p: bigint): bigint | null {
  // Check if n is a quadratic residue
  if (modPow(n, (p - 1n) / 2n, p) !== 1n) return null;

  // Find Q and S such that p - 1 = Q * 2^S
  let Q = p - 1n;
  let S = 0n;
  while ((Q & 1n) === 0n) {
    Q >>= 1n;
    S += 1n;
  }

  if (S === 1n) {
    return modPow(n, (p + 1n) / 4n, p);
  }

  // Find a quadratic non-residue z
  let z = 2n;
  while (modPow(z, (p - 1n) / 2n, p) !== p - 1n) {
    z += 1n;
  }

  let M = S;
  let c = modPow(z, Q, p);
  let t = modPow(n, Q, p);
  let R = modPow(n, (Q + 1n) / 2n, p);

  while (t !== 1n) {
    // Find the least i such that t^(2^i) = 1
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

/**
 * Compute the order of a point P (smallest k > 0 such that k*P = O).
 */
export function pointOrder(P: ECPoint, curve: Curve): bigint {
  if (P === null) return 1n;

  let order = 0n;
  let current: ECPoint = P;

  while (current !== null) {
    order += 1n;
    current = pointAdd(current, P, curve);
    if (order > 1000n) {
      throw new Error('Point order calculation exceeded limit');
    }
  }

  return order;
}

/**
 * Vélu's formula: compute the kernel of an isogeny from a list of
 * kernel generators. Returns { newCurve, mapPoint } where mapPoint
 * maps points on the original curve to points on newCurve.
 */
export function veluIsogeny(
  sourceCurve: Curve,
  kernelGenerator: ECPoint,
  kernelOrder: number
): {
  targetCurve: Curve;
  mapPoint: (P: ECPoint) => ECPoint;
} {
  if (kernelGenerator === null) {
    throw new Error('Kernel generator cannot be point at infinity');
  }

  const p = sourceCurve.p;
  const a = sourceCurve.a;
  const b = sourceCurve.b;

  // Compute kernel points {P, 2P, ..., (kernelOrder-1)P}
  const kernelPoints: ECPoint[] = [];
  let current: ECPoint = kernelGenerator;
  for (let i = 0; i < kernelOrder - 1; i++) {
    if (current === null) break;
    kernelPoints.push(current as ECPoint);
    current = pointAdd(current, kernelGenerator, sourceCurve);
  }

  // Compute Vélu's invariants
  let t = 0n;
  let u = 0n;

  for (const Q of kernelPoints) {
    if (Q === null) continue;
    const xQ = Q.x;
    const yQ = Q.y;
    t = mod(t + 3n * xQ * xQ + a, p);
    u = mod(u + 2n * yQ * yQ, p);
  }

  // New curve coefficients
  const a_new = mod(a - 5n * t, p);
  const b_new = mod(b - 7n * u, p);

  const targetCurve: Curve = { a: a_new, b: b_new, p };

  // Isogeny map function
  function mapPoint(P: ECPoint): ECPoint {
    if (P === null) return null;
    if (!isOnCurve(P, sourceCurve)) {
      throw new Error('Point not on source curve');
    }

    let num_x = 0n;
    let den_x = 1n;
    let num_y = P.y;
    let den_y = 1n;

    for (const Q of kernelPoints) {
      if (Q === null) continue;
      const xQ = Q.x;
      const yQ = Q.y;
      const dx = mod(P.x - xQ, p);
      const dy = mod(P.y - yQ, p);

      // Accumulate (x - xQ)² and (x - xQ)³
      const dx2 = mod(dx * dx, p);
      const dx3 = mod(dx2 * dx, p);

      num_x = mod(num_x + dx2, p);
      const w = mod(yQ * yQ - 3n * xQ * xQ - a, p);
      den_x = mod(den_x - w * dx2, p);

      num_y = mod(num_y * dy, p);
      den_y = mod(den_y * dx3, p);
    }

    // Compute final coordinates
    const inv_den_x = modInverse(den_x, p);
    const inv_den_y = modInverse(den_y, p);

    const x_new = mod(P.x - num_x, p);
    const x_final = mod(x_new * inv_den_x, p);
    const y_final = mod(num_y * inv_den_y, p);

    return { x: x_final, y: y_final };
  }

  return { targetCurve, mapPoint };
}

/**
 * j-invariant of y² = x³ + ax + b: j = 1728 * 4a³ / (4a³ + 27b²) mod p
 */
export function jInvariant(curve: Curve): bigint {
  const p = curve.p;
  const a = curve.a;
  const b = curve.b;

  const a3 = mod(a * a * a, p);
  const b2 = mod(b * b, p);

  const num = mod(1728n * 4n * a3, p);
  const den = mod(4n * a3 + 27n * b2, p);

  if (den === 0n) throw new Error('j-invariant undefined: 4a³ + 27b² = 0');

  return mod(num * modInverse(den, p), p);
}

/**
 * Supersingularity check for small p:
 * E is supersingular over GF(p) iff #E(GF(p)) = p + 1.
 */
export function isSupersingular(curve: Curve): boolean {
  const points = allPoints(curve);
  const num_points = BigInt(points.length);
  return num_points === curve.p + 1n;
}
