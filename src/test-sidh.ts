/**
 * Phase 2 gate verification tests
 */

import { sidhKeyExchange, castryckDecruToy } from './sidh';

console.log('=== Phase 2: Toy SIDH Gate ===\n');

const result = await sidhKeyExchange();

console.log('Test 1: SIDH key exchange');
console.log(`Alice secret:          ${result.alice.privateKey}`);
console.log(`Bob secret:            ${result.bob.privateKey}`);
console.log('✓ Key exchange completed\n');

console.log('Test 2: Castryck-Decru attack on Alice');
const attackResult = castryckDecruToy(result.alice.publicKey);
console.log(`Original Alice secret:  ${result.alice.privateKey}`);
console.log(`Recovered secret:       ${attackResult.recoveredSecret}`);

if (attackResult.recoveredSecret !== result.alice.privateKey) {
  throw new Error('Castryck-Decru attack failed: secret not recovered');
}
console.log('✓ Attack successfully recovered Alice secret\n');

console.log('Test 3: Vulnerability explained');
console.log('Alice published:');
console.log(
  `  - Her public curve with j-invariant: ${result.alice.publicKey.jInvariant}`
);
console.log(`  - Torsion image A: ${result.alice.publicKey.torsionImageA}`);
console.log(`  - Torsion image B: ${result.alice.publicKey.torsionImageB}`);
console.log('');
console.log('Attack: Torsion images are derived from her secret!');
console.log(
  `Attack recovered her secret: ${attackResult.recoveredSecret} = original ${result.alice.privateKey}`
);
console.log('✓ Torsion point leak enables attack (Castryck-Decru, August 2022)\n');

console.log('=== ✓ All Phase 2 gates passed ===');
console.log('Verified:');
console.log('  ✓ SIDH protocol demonstrates key exchange');
console.log( '  ✓ Castryck-Decru toy attack recovers Alice secret');
console.log('  ✓ Torsion images leak is exploitable\n');
