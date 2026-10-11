// scripts/check_gallery_test_disjoint.mjs
// Phase 4B: Enforce strict disjointness between reference gallery, test split, and quarantined assets.
// Fails build (exit code 1) on any item-level or capture-group-level overlap.

import fs from 'fs';
import path from 'path';

function getTrueSessionKey(item, corpus) {
  const corp = corpus[item.id] || {};
  const origTitle = (corp.original_title || '').replace(/^File:/, '').toLowerCase();
  const url = decodeURIComponent(item.provenance?.source_url || corp.source_url || '').toLowerCase();
  const artist = (item.provenance?.artist || corp.artist || 'unknown').trim().toLowerCase();
  const make = (item.make || 'noncar').trim().toLowerCase();
  const model = (item.model || 'unknown').trim().toLowerCase();

  if (item.id && item.id.startsWith('REAL_FIELD_')) {
    return 'FABRICATED_FIELD__' + item.id;
  }

  const events = ['gims', 'geneva', 'iaa', 'frankfurt', 'grand_basel', 'solitude_revival', 'goodwood', 'paris_motor_show', 'concorso', 'autoville', 'pebble_beach', 'shizuoka', 'tokyo_auto_salon'];
  const matchedEvent = events.find(e => url.includes(e) || origTitle.includes(e));
  if (matchedEvent && artist !== 'unknown') {
    return 'session__' + artist + '__' + make + '_' + model + '__' + matchedEvent;
  }

  const frameMatch = (url || origTitle).match(/(?:img_|dsc_|1x7a|p\d{3}|_)(\d{3,})/i);
  if (frameMatch && artist !== 'unknown') {
    const frameNum = parseInt(frameMatch[1], 10);
    const cluster = Math.floor(frameNum / 20);
    return 'burst__' + artist + '__' + make + '_' + model + '__c' + cluster;
  }

  const stem = origTitle.replace(/[\(\s_-](edited|cropped|rr|\d+)\.jpg$/i, '').trim();
  if (stem.length > 8 && artist !== 'unknown') {
    return 'stem__' + artist + '__' + stem;
  }

  return 'single__' + item.id;
}

async function main() {
  console.log('====================================================');
  console.log('APEX PHASE 4B: GALLERY-TEST DISJOINTNESS CI CHECK');
  console.log('====================================================');

  const manifestPath = 'eval/golden/proposed_clean_manifest.json';
  const canonicalManifestPath = 'eval/golden/manifest.json';
  const corpusPath = 'benchmark/real_world_1000/corpus_manifest.json';
  const quarantinePath = 'eval/quarantine/ledger.json';

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const canonicalManifest = JSON.parse(fs.readFileSync(canonicalManifestPath, 'utf8'));
  const corpus = JSON.parse(fs.readFileSync(corpusPath, 'utf8'));
  const quarantine = JSON.parse(fs.readFileSync(quarantinePath, 'utf8'));
  const { TIER_1_GALLERY_CATALOGUE } = await import('../src/ai-engine/v2/galleryData.ts');

  const testItems = manifest.filter(x => x.split === 'test');
  const testIds = new Set(testItems.map(x => x.id));
  const quarantinedIds = new Set((quarantine.items || []).map(x => x.id));

  // Compute true session keys for all items
  const itemToSessionKey = new Map();
  const testSessionKeys = new Set();
  const quarantineSessionKeys = new Set();

  for (const item of canonicalManifest) {
    const k = getTrueSessionKey(item, corpus);
    itemToSessionKey.set(item.id, k);
    if (item.split === 'test') {
      testSessionKeys.add(k);
    }
  }

  for (const qItem of quarantine.items || []) {
    const fullItem = canonicalManifest.find(x => x.id === qItem.id) || qItem;
    const k = getTrueSessionKey(fullItem, corpus);
    itemToSessionKey.set(qItem.id, k);
    quarantineSessionKeys.add(k);
  }

  console.log(`Active Test Split: ${testIds.size} records across ${testSessionKeys.size} distinct capture sessions.`);
  console.log(`Quarantine Ledger: ${quarantinedIds.size} records across ${quarantineSessionKeys.size} sessions.`);

  const violations = [];
  let checkedEntries = 0;
  let totalRefAssets = 0;

  for (const entry of TIER_1_GALLERY_CATALOGUE) {
    if (!entry.hasReferenceEmbedding) continue;
    checkedEntries++;
    const refIds = entry.referenceAssetIds || [];
    totalRefAssets += refIds.length;

    if (refIds.length === 0) {
      violations.push({
        canonicalId: entry.canonicalId,
        type: 'MISSING_PROVENANCE_IDS',
        detail: 'Entry has hasReferenceEmbedding=true but referenceAssetIds is empty.'
      });
      continue;
    }

    for (const refId of refIds) {
      // 1. Direct test split overlap
      if (testIds.has(refId)) {
        violations.push({
          canonicalId: entry.canonicalId,
          type: 'DIRECT_TEST_LEAKAGE',
          detail: `Reference asset ${refId} is in held-out test split!`
        });
      }

      // 2. Direct quarantine overlap
      if (quarantinedIds.has(refId)) {
        violations.push({
          canonicalId: entry.canonicalId,
          type: 'QUARANTINE_OVERLAP',
          detail: `Reference asset ${refId} is in quarantine ledger!`
        });
      }

      // 3. Group-level test overlap (same photographer/date/burst)
      const sessionKey = itemToSessionKey.get(refId);
      if (sessionKey && testSessionKeys.has(sessionKey)) {
        violations.push({
          canonicalId: entry.canonicalId,
          type: 'SESSION_BURST_TEST_LEAKAGE',
          detail: `Reference asset ${refId} shares capture session "${sessionKey}" with held-out test split!`
        });
      }
    }
  }

  console.log(`Audited ${checkedEntries} gallery entries with reference vectors (${totalRefAssets} reference asset IDs).`);

  if (violations.length > 0) {
    console.error('\n❌ CRITICAL DISJOINTNESS VIOLATIONS DETECTED:');
    for (const v of violations) {
      console.error(`  [${v.type}] ${v.canonicalId}: ${v.detail}`);
    }
    console.error('\nBuild failed: Reference gallery must be strictly disjoint from test and quarantine.');
    process.exit(1);
  }

  console.log('\n✅ GALLERY DISJOINTNESS VERIFIED:');
  console.log('  - 0 direct test split reference assets (PASS)');
  console.log('  - 0 quarantined reference assets (PASS)');
  console.log('  - 0 session/burst cross-split leaks into test split (PASS)');
  console.log('====================================================\n');
}

main().catch(err => {
  console.error('Fatal error in check_gallery_test_disjoint:', err);
  process.exit(1);
});
