/**
 * APEX — Web Crypto & Hash Verification Test
 * 
 * Verifies that client cryptographic operations (UUID generation,
 * image hashing, idempotency keys) use genuine Web Crypto standards
 * and run consistently in Browser / WebView environments.
 */

import { computeImageSha256 } from '../src/ai-engine/crypto/sha256';

async function runWebCryptoTests() {
  console.log('--- TEST 1: Web Crypto randomUUID Availability ---');
  if (typeof crypto === 'undefined' || typeof crypto.randomUUID !== 'function') {
    throw new Error('FATAL: globalThis.crypto.randomUUID is not available in runtime.');
  }
  const uuid1 = crypto.randomUUID();
  const uuid2 = crypto.randomUUID();
  console.log('Generated UUID 1:', uuid1);
  console.log('Generated UUID 2:', uuid2);
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(uuid1) || !uuidRegex.test(uuid2)) {
    throw new Error('Generated UUID does not match RFC 4122 v4 UUID format.');
  }
  if (uuid1 === uuid2) {
    throw new Error('Collision detected in crypto.randomUUID.');
  }
  console.log('✅ Web Crypto UUID test passed.');

  console.log('\n--- TEST 2: Web Crypto Subtle Digest ---');
  if (typeof crypto === 'undefined' || !crypto.subtle) {
    throw new Error('FATAL: crypto.subtle is not available in runtime.');
  }
  const encoder = new TextEncoder();
  const testData = encoder.encode('APEX_SPEED_TEST_PAYLOAD');
  const digestBuffer = await crypto.subtle.digest('SHA-256', testData);
  const digestArray = Array.from(new Uint8Array(digestBuffer));
  const hexDigest = digestArray.map(b => b.toString(16).padStart(2, '0')).join('');
  console.log('Subtle SHA-256 digest:', hexDigest);
  if (hexDigest.length !== 64) {
    throw new Error('Invalid digest length.');
  }
  console.log('✅ Web Crypto subtle digest passed.');

  console.log('\n--- TEST 3: Isomorphic Pure SHA-256 Engine ---');
  const testDataUrl = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';
  const hash1 = computeImageSha256(testDataUrl);
  const hash2 = computeImageSha256(testDataUrl);
  console.log('Image SHA-256 Hash:', hash1);
  if (hash1 !== hash2) {
    throw new Error('Hash non-determinism detected.');
  }
  if (hash1.length !== 64) {
    throw new Error('Invalid SHA-256 length.');
  }
  console.log('✅ Image hashing test passed.');

  console.log('\n🎉 ALL CLIENT CRYPTOGRAPHIC TESTS PASSED!');
}

runWebCryptoTests().catch(err => {
  console.error('❌ Crypto test failed:', err);
  process.exit(1);
});
