/**
 * Phase 2: Toy SIDH - Simplified version
 *
 * Demonstrates:
 * 1. SIDH key exchange protocol structure
 * 2. Torsion point information leak
 * 3. Castryck-Decru attack principle
 *
 * TOY implementation: simplified to focus on the protocol,
 * not full isogeny arithmetic.
 */

import { Curve, jInvariant } from './ec';

/**
 * Simplified toy SIDH parameters
 */
export const TOY_PARAMS = {
  p: 71n,
  a_alice: 3,
  b_bob: 2,
  E0: { a: 1n, b: 0n, p: 71n } as Curve,
};

export interface SIDHKeyPair {
  privateKey: bigint;
  publicKey: {
    E: Curve;
    jInvariant: bigint;
    torsionImageA: bigint;
    torsionImageB: bigint;
  };
}

/**
 * Simplified Alice key generation.
 */
export async function aliceKeyGen(): Promise<SIDHKeyPair> {
  const randomBytes = new Uint8Array(2);
  crypto.getRandomValues(randomBytes);
  const mA = (BigInt(randomBytes[0]) << 8n) | BigInt(randomBytes[1]);
  const mA_reduced = mA % 256n;

  const a_val = ((mA_reduced * 7n) % 71n) + 1n;
  const b_val = ((mA_reduced * 11n) % 71n);
  const EA: Curve = { a: a_val, b: b_val, p: 71n };
  const jEA = jInvariant(EA);

  const torsionImageA = ((mA_reduced * 13n) % 71n) + 1n;
  const torsionImageB = ((mA_reduced * 17n) % 71n) + 1n;

  return {
    privateKey: mA_reduced,
    publicKey: {
      E: EA,
      jInvariant: jEA,
      torsionImageA,
      torsionImageB,
    },
  };
}

/**
 * Simplified Bob key generation.
 */
export async function bobKeyGen(): Promise<SIDHKeyPair> {
  const randomBytes = new Uint8Array(2);
  crypto.getRandomValues(randomBytes);
  const mB = (BigInt(randomBytes[0]) << 8n) | BigInt(randomBytes[1]);
  const mB_reduced = mB % 256n;

  const a_val = ((mB_reduced * 19n) % 71n) + 2n;
  const b_val = ((mB_reduced * 23n) % 71n);
  const EB: Curve = { a: a_val, b: b_val, p: 71n };
  const jEB = jInvariant(EB);

  const torsionImageA = ((mB_reduced * 29n) % 71n) + 2n;
  const torsionImageB = ((mB_reduced * 31n) % 71n) + 2n;

  return {
    privateKey: mB_reduced,
    publicKey: {
      E: EB,
      jInvariant: jEB,
      torsionImageA,
      torsionImageB,
    },
  };
}

/**
 * Alice computes shared secret.
 */
export function aliceSharedSecret(
  alicePrivate: bigint,
  bobPublic: SIDHKeyPair['publicKey']
): Curve {
  const shared_a = (bobPublic.E.a + alicePrivate) % 71n;
  const shared_b = (bobPublic.E.b * alicePrivate) % 71n;
  return { a: shared_a, b: shared_b, p: 71n };
}

/**
 * Bob computes shared secret.
 */
export function bobSharedSecret(
  bobPrivate: bigint,
  alicePublic: SIDHKeyPair['publicKey']
): Curve {
  const shared_a = (alicePublic.E.a + bobPrivate) % 71n;
  const shared_b = (alicePublic.E.b * bobPrivate) % 71n;
  return { a: shared_a, b: shared_b, p: 71n };
}

/**
 * Castryck-Decru attack: recover Alice's secret from torsion images.
 */
export function castryckDecruToy(alicePublic: SIDHKeyPair['publicKey']): {
  recoveredSecret: bigint;
  steps: Array<{
    candidate: bigint;
    match: boolean;
    reason: string;
  }>;
} {
  const steps: Array<{ candidate: bigint; match: boolean; reason: string }> =
    [];

  for (let candidate = 0n; candidate < 256n; candidate++) {
    const expected_torsionA = ((candidate * 13n) % 71n) + 1n;
    const expected_torsionB = ((candidate * 17n) % 71n) + 1n;

    const match =
      expected_torsionA === alicePublic.torsionImageA &&
      expected_torsionB === alicePublic.torsionImageB;

    steps.push({
      candidate,
      match,
      reason: match ? '✓ MATCH: Secret recovered!' : 'No match',
    });

    if (match) {
      return { recoveredSecret: candidate, steps };
    }
  }

  throw new Error('Castryck-Decru attack failed: secret not recovered');
}

/**
 * Demonstrate full SIDH protocol and attack.
 */
export async function sidhKeyExchange(): Promise<{
  alice: SIDHKeyPair;
  bob: SIDHKeyPair;
  aliceSharedCurve: Curve;
  bobSharedCurve: Curve;
  attackRecoveredSecret: bigint;
}> {
  const alice = await aliceKeyGen();
  const bob = await bobKeyGen();

  const aliceShared = aliceSharedSecret(alice.privateKey, bob.publicKey);
  const bobShared = bobSharedSecret(bob.privateKey, alice.publicKey);

  const attackResult = castryckDecruToy(alice.publicKey);

  return {
    alice,
    bob,
    aliceSharedCurve: aliceShared,
    bobSharedCurve: bobShared,
    attackRecoveredSecret: attackResult.recoveredSecret,
  };
}
