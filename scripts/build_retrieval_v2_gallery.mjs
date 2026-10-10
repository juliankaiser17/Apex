// scripts/build_retrieval_v2_gallery.mjs
// Phase 5: Production Gallery v2 Builder.
// Ingests ONLY allowed_in_production_gallery with verified provenance,
// enforces group-disjointness from held-out test split,
// enforces viewpoint and image coverage thresholds,
// and builds the local vector store index.

import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';

const require = createRequire(process.cwd() + '/package.json');
const sharp = require('sharp');

function getTrueSessionKey(item, corpus) {
  const corp = corpus[item.id] || {};
  const origTitle = (corp.original_title || '').replace(/^File:/, '').toLowerCase();
  const url = decodeURIComponent(item.provenance?.source_url || corp.source_url || '').toLowerCase();
  const artist = (item.provenance?.artist || corp.artist || 'unknown').trim().toLowerCase();
  const make = (item.make || 'noncar').trim().toLowerCase();
  const model = (item.model || 'unknown').trim().toLowerCase();

  if (item.id && item.id.startsWith('REAL_FIELD_')) return 'FABRICATED_FIELD__' + item.id;

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

// Color-robust feature extractor (Phase 5)
async function extractColorRobustVector(filePath) {
  const buf = fs.readFileSync(filePath);
  const img = sharp(buf);
  const meta = await img.metadata();
  const width = meta.width || 128;
  const height = meta.height || 128;
  const aspectRatio = width / (height || 1);

  const { data: rawGrey } = await sharp(buf)
    .resize(48, 48, { fit: 'fill' })
    .grayscale()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const vector = new Array(64).fill(0);

  // 1. Proportions & Geometry (Dims 0-7)
  vector[0] = Math.tanh((aspectRatio - 1.6) * 2.5);
  vector[1] = Math.tanh((aspectRatio - 2.0) * 3.5);
  vector[2] = (width > height ? 1.0 : -1.0);
  vector[3] = Math.min(1.0, Math.max(-1.0, (aspectRatio - 1.0) / 1.5));

  // 2. Luminance distribution across 4 vertical zones (Dims 4-15)
  for (let z = 0; z < 4; z++) {
    let lum = 0;
    for (let y = z * 12; y < (z + 1) * 12; y++) {
      for (let x = 0; x < 48; x++) lum += rawGrey[y * 48 + x];
    }
    vector[4 + z] = (lum / (576 * 255)) * 2 - 1;
  }

  // 3. Structural Gradient & Edge Energies (Dims 8-39)
  for (let gy = 0; gy < 4; gy++) {
    for (let gx = 0; gx < 4; gx++) {
      let gh = 0, gv = 0;
      for (let y = gy * 12; y < (gy + 1) * 12; y++) {
        for (let x = gx * 8; x < (gx + 1) * 8; x++) {
          const c = rawGrey[y * 48 + x];
          gh += Math.abs((x < 47 ? rawGrey[y * 48 + x + 1] : c) - c);
          gv += Math.abs((y < 47 ? rawGrey[(y + 1) * 48 + x] : c) - c);
        }
      }
      vector[8 + (gy * 4 + gx)] = ((gh + gv) / (96 * 255)) * 2 - 1;
    }
  }

  // Directional edge anisotropy
  let totalH = 0, totalV = 0, totalDiag = 0;
  for (let y = 0; y < 47; y++) {
    for (let x = 0; x < 47; x++) {
      const c = rawGrey[y * 48 + x];
      totalH += Math.abs(rawGrey[y * 48 + x + 1] - c);
      totalV += Math.abs(rawGrey[(y + 1) * 48 + x] - c);
      totalDiag += Math.abs(rawGrey[(y + 1) * 48 + x + 1] - c);
    }
  }
  const normFactor = 47 * 47 * 255;
  vector[24] = (totalH / normFactor) * 2 - 1;
  vector[25] = (totalV / normFactor) * 2 - 1;
  vector[26] = (totalDiag / normFactor) * 2 - 1;
  vector[27] = ((totalH - totalV) / (totalH + totalV + 1e-5));

  // 4. Low-Frequency 2D Discrete Cosine Transform (Dims 28-63, 36 coefficients)
  let dctIdx = 28;
  for (let u = 0; u < 6; u++) {
    for (let v = 0; v < 6; v++) {
      let sum = 0;
      for (let x = 0; x < 24; x++) {
        for (let y = 0; y < 24; y++) {
          const pixel = rawGrey[y * 2 * 48 + x * 2];
          sum += pixel * Math.cos(((2 * x + 1) * u * Math.PI) / 48) * Math.cos(((2 * y + 1) * v * Math.PI) / 48);
        }
      }
      const alphaU = u === 0 ? 1 / Math.SQRT2 : 1;
      const alphaV = v === 0 ? 1 / Math.SQRT2 : 1;
      if (dctIdx < 64) {
        vector[dctIdx++] = (0.25 * alphaU * alphaV * sum) / (576 * 255) * 2;
      }
    }
  }

  // L2 Normalization
  let sumSq = 0;
  for (let i = 0; i < 64; i++) sumSq += vector[i] * vector[i];
  const l2Norm = Math.sqrt(sumSq) || 1.0;
  return vector.map(x => Number((x / l2Norm).toFixed(5)));
}

async function buildGalleryV2() {
  console.log('====================================================');
  console.log('APEX PHASE 5: RETRIEVAL V2 GALLERY BUILD');
  console.log('====================================================');

  const manifest = JSON.parse(fs.readFileSync('eval/golden/proposed_clean_manifest.json', 'utf8'));
  const corpus = JSON.parse(fs.readFileSync('benchmark/real_world_1000/corpus_manifest.json', 'utf8'));
  const provenanceLedger = JSON.parse(fs.readFileSync('eval/provenance/provenance_ledger_v2.json', 'utf8'));
  const quarantine = JSON.parse(fs.readFileSync('eval/quarantine/ledger.json', 'utf8'));

  const allowedImageIds = new Set();
  for (const r of provenanceLedger.records) {
    // Only verified provenance and permitted in production gallery (or permissive / CC-BY)
    if (r.provenance_verified && (r.allowed_in_production_gallery === 'true' || r.allowed_in_production_gallery === 'conditional_share_alike')) {
      allowedImageIds.add(r.id);
    }
  }

  const qIds = new Set(quarantine.items.map(x => x.id));

  // Determine test session keys to ensure strict group-disjointness
  const testSessionKeys = new Set();
  for (const item of manifest) {
    if (item.split === 'test') {
      testSessionKeys.add(getTrueSessionKey(item, corpus));
    }
  }

  // Ingest only Dev items with verified production gallery license, no quarantine, no test group overlap
  const eligibleItems = manifest.filter(item => {
    if (item.split !== 'dev' || !item.canonical_id || !item.is_in_catalogue) return false;
    if (qIds.has(item.id)) return false;
    if (!allowedImageIds.has(item.id)) return false;
    const sessionKey = getTrueSessionKey(item, corpus);
    return !testSessionKeys.has(sessionKey);
  });

  console.log(`Eligible Reference Assets for Production Gallery: ${eligibleItems.length}`);

  // Group by canonical model to calculate viewpoint & image coverage
  const byModel = new Map();
  for (const item of eligibleItems) {
    if (!byModel.has(item.canonical_id)) {
      byModel.set(item.canonical_id, []);
    }
    byModel.get(item.canonical_id).push(item);
  }

  const vectorDocuments = [];
  const galleryCoverageReport = [];

  for (const [canonicalId, items] of byModel.entries()) {
    const viewpoints = new Set(items.map(i => i.viewpoint));
    const hasSufficientCoverage = items.length >= 2 && viewpoints.size >= 2;

    galleryCoverageReport.push({
      canonicalId,
      imageCount: items.length,
      viewpoints: Array.from(viewpoints),
      hasSufficientCoverage,
      coverageTier: hasSufficientCoverage ? 'sufficient_for_variant' : 'insufficient_for_variant'
    });

    for (const item of items) {
      if (!fs.existsSync(item.image_path)) continue;
      const vec = await extractColorRobustVector(item.image_path);
      vectorDocuments.push({
        id: `doc_${item.id}`,
        canonicalId,
        make: item.make,
        model: item.model,
        generation: item.generation || 'Base',
        variant: item.variant || null,
        displayName: item.display_name,
        viewpoint: item.viewpoint,
        vector: vec,
        provenanceId: item.id,
        hasSufficientCoverage
      });
    }
  }

  console.log(`Indexed ${vectorDocuments.length} color-robust vector documents across ${byModel.size} canonical models.`);

  fs.mkdirSync('eval/gallery', { recursive: true });
  fs.writeFileSync('eval/gallery/retrieval_v2_index.json', JSON.stringify({
    version: '2.0.0',
    generatedAt: new Date().toISOString(),
    totalDocuments: vectorDocuments.length,
    canonicalModelsCovered: byModel.size,
    coverageSummary: galleryCoverageReport,
    documents: vectorDocuments
  }, null, 2), 'utf8');

  console.log('Saved eval/gallery/retrieval_v2_index.json.');
  console.log('====================================================\n');
}

buildGalleryV2().catch(err => {
  console.error('Fatal error in buildGalleryV2:', err);
  process.exit(1);
});
