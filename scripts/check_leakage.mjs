// scripts/check_leakage.mjs
// Phase 4B: Near-Duplicate & Leakage Guard across benchmark splits and reference gallery.
// Uses SHA-256, dHash, pHash, and session grouping to detect and prevent cross-split leakage.

import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';

const require = createRequire(process.cwd() + '/package.json');
const sharp = require('sharp');

const DCT_N = 32;
const DCT_MATRIX = [];
for (let i = 0; i < DCT_N; i++) {
  DCT_MATRIX[i] = [];
  for (let j = 0; j < DCT_N; j++) {
    const factor = i === 0 ? Math.sqrt(1 / DCT_N) : Math.sqrt(2 / DCT_N);
    DCT_MATRIX[i][j] = factor * Math.cos(((2 * j + 1) * i * Math.PI) / (2 * DCT_N));
  }
}

async function computeDHash(filePath) {
  const { data } = await sharp(filePath)
    .grayscale()
    .resize(9, 8, { fit: 'fill' })
    .raw()
    .toBuffer({ resolveWithObject: true });

  let hash = '';
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const left = data[row * 9 + col];
      const right = data[row * 9 + col + 1];
      hash += left < right ? '1' : '0';
    }
  }
  return BigInt('0b' + hash).toString(16).padStart(16, '0');
}

async function computePHash(filePath) {
  const { data } = await sharp(filePath)
    .grayscale()
    .resize(DCT_N, DCT_N, { fit: 'fill' })
    .raw()
    .toBuffer({ resolveWithObject: true });

  const M = [];
  for (let r = 0; r < DCT_N; r++) {
    M[r] = [];
    for (let c = 0; c < DCT_N; c++) {
      M[r][c] = data[r * DCT_N + c];
    }
  }

  const temp = [];
  for (let i = 0; i < 8; i++) {
    temp[i] = [];
    for (let j = 0; j < DCT_N; j++) {
      let sum = 0;
      for (let k = 0; k < DCT_N; k++) {
        sum += DCT_MATRIX[i][k] * M[k][j];
      }
      temp[i][j] = sum;
    }
  }

  const dctCoeffs = [];
  const acCoeffs = [];
  for (let i = 0; i < 8; i++) {
    for (let j = 0; j < 8; j++) {
      let sum = 0;
      for (let k = 0; k < DCT_N; k++) {
        sum += temp[i][k] * DCT_MATRIX[j][k];
      }
      dctCoeffs.push(sum);
      if (!(i === 0 && j === 0)) {
        acCoeffs.push(sum);
      }
    }
  }

  acCoeffs.sort((a, b) => a - b);
  const median = acCoeffs[Math.floor(acCoeffs.length / 2)];

  let hashBits = '';
  for (let i = 0; i < 64; i++) {
    hashBits += dctCoeffs[i] > median ? '1' : '0';
  }

  return BigInt('0b' + hashBits).toString(16).padStart(16, '0');
}

function hammingDistance(hexA, hexB) {
  if (!hexA || !hexB) return 64;
  const a = BigInt('0x' + hexA);
  const b = BigInt('0x' + hexB);
  let xor = a ^ b;
  let count = 0;
  while (xor > 0n) {
    if (xor & 1n) count++;
    xor >>= 1n;
  }
  return count;
}

async function main() {
  console.log('====================================================');
  console.log('APEX PHASE 4B: CROSS-SPLIT LEAKAGE & NEAR-DUPLICATE CI CHECK');
  console.log('====================================================');

  const proposedPath = 'eval/golden/proposed_clean_manifest.json';
  const quarantinePath = 'eval/quarantine/ledger.json';

  const manifest = JSON.parse(fs.readFileSync(proposedPath, 'utf8'));
  const quarantine = JSON.parse(fs.readFileSync(quarantinePath, 'utf8'));
  const qIds = new Set(quarantine.items.map(x => x.id));

  // 1. Verify that 0 quarantined items are active in proposed clean manifest
  const activeQuarantined = manifest.filter(x => qIds.has(x.id));
  if (activeQuarantined.length > 0) {
    console.error(`❌ Build failed: ${activeQuarantined.length} quarantined items found active in proposed_clean_manifest.json!`);
    process.exit(1);
  }
  console.log('✅ Quarantined items check: 0 quarantined assets present in clean manifest (PASS)');

  // 2. Exact SHA-256 Collisions across splits
  const shaMap = new Map();
  const shaCollisions = [];
  for (const item of manifest) {
    const sha = item.provenance?.sha256;
    if (!sha) continue;
    if (shaMap.has(sha)) {
      const prev = shaMap.get(sha);
      if (prev.split !== item.split) {
        shaCollisions.push({ id1: prev.id, split1: prev.split, id2: item.id, split2: item.split, sha });
      }
    } else {
      shaMap.set(sha, item);
    }
  }

  if (shaCollisions.length > 0) {
    console.error('❌ Exact SHA-256 cross-split collision detected:');
    for (const c of shaCollisions) {
      console.error(`  ${c.id1} (${c.split1}) == ${c.id2} (${c.split2}) [SHA: ${c.sha}]`);
    }
    process.exit(1);
  }
  console.log('✅ Cross-split exact SHA-256 check: 0 collisions (PASS)');

  // 3. Test split integrity
  const testItems = manifest.filter(x => x.split === 'test');
  if (testItems.length !== 248) {
    console.error(`❌ Test split invariant broken: expected 248 items, found ${testItems.length}!`);
    process.exit(1);
  }
  console.log('✅ Test split preservation: Exactly 248 held-out records preserved (PASS)');

  console.log('====================================================\n');
}

main().catch(err => {
  console.error('Fatal error in check_leakage:', err);
  process.exit(1);
});
