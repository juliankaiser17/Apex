/**
 * APEX — Cryptographic SHA-256 Verification & Latency Benchmark
 * 
 * Verifies:
 * 1. FIPS 180-4 Known-Answer Test Vectors (empty, "abc", known binary payload).
 * 2. Deterministic Invariant: identical image bytes produce identical digests.
 * 3. Collision Resistance: different image byte arrays produce different digests.
 * 4. Avalanche Effect: 1-bit alteration completely changes digest.
 * 5. Measured Hashing Latency on a representative 1.5 MB image payload.
 */

import crypto from 'crypto';
import { computeSha256, computeImageSha256, base64ToUint8Array } from '../src/ai-engine/crypto/sha256';
import { apexEngine } from '../src/ai-engine/engine';

export async function runSha256VerificationSuite(): Promise<{ avgLatencyMs: number }> {
  console.log('\n==============================================================');
  console.log('SHA-256 CRYPTOGRAPHIC CORRECTNESS & LATENCY BENCHMARK');
  console.log('==============================================================\n');

  let passed = 0;
  let total = 0;

  // ── TEST 1: KNOWN-ANSWER TEST VECTORS ──
  console.log('[TEST 1] FIPS 180-4 Known-Answer Vectors');

  // Vector 1: Empty input (0 bytes)
  total++;
  const emptyBytes = new Uint8Array(0);
  const emptyHash = computeSha256(emptyBytes);
  const expectedEmpty = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
  if (emptyHash === expectedEmpty) {
    console.log(`  [PASS] Empty Input (0 bytes) -> ${emptyHash}`);
    passed++;
  } else {
    console.error(`  [FAIL] Empty Input: Expected ${expectedEmpty}, got ${emptyHash}`);
  }

  // Vector 2: "abc"
  total++;
  const abcBytes = new TextEncoder().encode('abc');
  const abcHash = computeSha256(abcBytes);
  const expectedAbc = 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad';
  if (abcHash === expectedAbc) {
    console.log(`  [PASS] "abc" -> ${abcHash}`);
    passed++;
  } else {
    console.error(`  [FAIL] "abc": Expected ${expectedAbc}, got ${abcHash}`);
  }

  // Vector 3: Known binary payload [0x01, 0x02, 0x03, 0x04]
  total++;
  const binPayload = new Uint8Array([0x01, 0x02, 0x03, 0x04]);
  const binHash = computeSha256(binPayload);
  const expectedBin = crypto.createHash('sha256').update(binPayload).digest('hex');
  if (binHash === expectedBin) {
    console.log(`  [PASS] Known Binary Payload [0x01..0x04] -> ${binHash}`);
    passed++;
  } else {
    console.error(`  [FAIL] Binary Payload: Expected ${expectedBin}, got ${binHash}`);
  }

  // Vector 4: 1000-character multi-block payload
  total++;
  const longPayload = Buffer.alloc(1000, 0x61); // 1000 'a's
  const longHash = computeSha256(new Uint8Array(longPayload));
  const expectedLong = crypto.createHash('sha256').update(longPayload).digest('hex');
  if (longHash === expectedLong) {
    console.log(`  [PASS] 1000-byte Payload Multi-block -> ${longHash}`);
    passed++;
  } else {
    console.error(`  [FAIL] 1000-byte Payload: Expected ${expectedLong}, got ${longHash}`);
  }

  // ── TEST 2: IMAGE-LEVEL DETERMINISM & UNIQUENESS ──
  console.log('\n[TEST 2] Image-Level Determinism & Collision Resistance');

  // Create two distinct simulated image payloads
  const imageSize = 1_500_000; // 1.5 MB
  const imageBytesA = Buffer.alloc(imageSize);
  const imageBytesB = Buffer.alloc(imageSize);
  for (let i = 0; i < imageSize; i++) {
    imageBytesA[i] = (i * 37 + 13) & 0xff;
    imageBytesB[i] = (i * 59 + 29) & 0xff;
  }

  const base64A = `data:image/jpeg;base64,${imageBytesA.toString('base64')}`;
  const base64B = `data:image/jpeg;base64,${imageBytesB.toString('base64')}`;

  // Determinism test: identical bytes produce identical digest
  total++;
  const hashA1 = apexEngine.computeImageHash(base64A);
  const hashA2 = apexEngine.computeImageHash(base64A);
  if (hashA1 === hashA2 && hashA1.length === 64 && /^[0-9a-f]{64}$/.test(hashA1)) {
    console.log(`  [PASS] Determinism: Identical 1.5MB images produce identical 64-char hex digest:`);
    console.log(`         Hash A: ${hashA1}`);
    passed++;
  } else {
    console.error(`  [FAIL] Determinism check failed for image A!`);
  }

  // Uniqueness test: different images produce different digests
  total++;
  const hashB = apexEngine.computeImageHash(base64B);
  if (hashA1 !== hashB && hashB.length === 64 && /^[0-9a-f]{64}$/.test(hashB)) {
    console.log(`  [PASS] Collision Resistance: Two different 1.5MB images produce completely distinct digests:`);
    console.log(`         Hash B: ${hashB}`);
    passed++;
  } else {
    console.error(`  [FAIL] Collision detected between Image A and Image B!`);
  }

  // Single-byte alteration (Avalanche effect test)
  total++;
  const imageBytesA_Modified = Buffer.from(imageBytesA);
  imageBytesA_Modified[imageSize - 1] ^= 0x01; // flip 1 bit at the very end
  const base64A_Modified = `data:image/jpeg;base64,${imageBytesA_Modified.toString('base64')}`;
  const hashA_Mod = apexEngine.computeImageHash(base64A_Modified);
  if (hashA1 !== hashA_Mod) {
    console.log(`  [PASS] Avalanche Effect: Flipping 1 bit in 1.5MB image produces completely different digest:`);
    console.log(`         Original: ${hashA1}`);
    console.log(`         Modified: ${hashA_Mod}`);
    passed++;
  } else {
    console.error(`  [FAIL] 1-bit alteration at end of image did not change hash!`);
  }

  // Compare engine hash with native Node crypto
  total++;
  const expectedEngineHash = crypto.createHash('sha256').update(imageBytesA).digest('hex');
  if (hashA1 === expectedEngineHash) {
    console.log(`  [PASS] Cryptographic Equivalence: Matches native OpenSSL/Node crypto bit-for-bit.`);
    passed++;
  } else {
    console.error(`  [FAIL] Engine hash does not match native crypto! Expected ${expectedEngineHash}, got ${hashA1}`);
  }

  // ── TEST 3: MEASURED HASHING LATENCY BENCHMARK (1.5 MB Image) ──
  console.log('\n[TEST 3] Measured Hashing Latency Benchmark (1.5 MB Image)');
  const warmupRuns = 2;
  const benchmarkRuns = 10;
  const latencies: number[] = [];

  for (let i = 0; i < warmupRuns; i++) {
    apexEngine.computeImageHash(base64A);
  }

  for (let i = 0; i < benchmarkRuns; i++) {
    const t0 = performance.now();
    apexEngine.computeImageHash(base64A);
    latencies.push(performance.now() - t0);
  }

  const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
  const minLatency = Math.min(...latencies);
  const maxLatency = Math.max(...latencies);

  console.log(`  Image Size:               ${(imageSize / 1024 / 1024).toFixed(2)} MB (${imageSize.toLocaleString()} bytes)`);
  console.log(`  Base64 Payload:           ${base64A.length.toLocaleString()} characters`);
  console.log(`  Benchmark Iterations:     ${benchmarkRuns}`);
  console.log(`  Average Hashing Latency:  ${avgLatency.toFixed(2)} ms`);
  console.log(`  Min Hashing Latency:      ${minLatency.toFixed(2)} ms`);
  console.log(`  Max Hashing Latency:      ${maxLatency.toFixed(2)} ms`);

  // Assert UX latency budget: < 150 ms
  total++;
  if (avgLatency < 150) {
    console.log(`  [PASS] UX Latency Budget Met: ${avgLatency.toFixed(2)} ms << 150 ms (negligible impact on scan UX)`);
    passed++;
  } else {
    console.error(`  [FAIL] Hashing latency ${avgLatency.toFixed(2)} ms exceeds 150 ms budget!`);
  }

  console.log('\n==============================================================');
  console.log(`SHA-256 VERIFICATION SUMMARY: ${passed} / ${total} Tests Passed`);
  console.log('==============================================================\n');

  if (passed !== total) {
    throw new Error('SHA-256 verification suite failed!');
  }

  return { avgLatencyMs: avgLatency };
}

// Standalone execution support
if (process.argv[1]?.endsWith('test_sha256_verification.ts') || process.argv[1]?.includes('test_sha256_verification')) {
  runSha256VerificationSuite()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
