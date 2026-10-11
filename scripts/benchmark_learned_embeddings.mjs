// scripts/benchmark_learned_embeddings.mjs
// Phase 12C: Evaluation of Learned Visual Embeddings vs Hand-Built Baseline

import fs from 'fs';
import path from 'path';
import { RawImage } from '@xenova/transformers';
import {
  dinov2Extractor,
  clipExtractor,
  l2Normalize
} from '../src/ai-engine/v2/learnedEmbeddingExtractor.ts';

console.log('====================================================');
console.log('PHASE 12C: LEARNED EMBEDDINGS COMPARATIVE BENCHMARK');
console.log('Models: Hand-Built (64D) vs DINOv2-small (384D) vs CLIP-ViT-B/32 (512D)');
console.log('====================================================\n');

// 1. Pure JS Hand-Built 64D Extractor (Aspect ratio, spatial luminance grid, color distribution)
function extractHandbuiltFromRaw(rawImg) {
  const vec = new Array(64).fill(0);
  const width = rawImg.width;
  const height = rawImg.height;
  const aspectRatio = width / (height || 1);

  // Geometry
  vec[0] = Math.tanh((aspectRatio - 1.6) * 2.5);
  vec[1] = Math.tanh((aspectRatio - 2.0) * 3.5);
  vec[2] = (width > height ? 1.0 : -1.0);
  vec[3] = Math.min(1.0, Math.max(-1.0, (aspectRatio - 1.0) / 1.5));

  // 4 vertical zones luminance
  const zoneHeight = Math.floor(height / 4);
  for (let z = 0; z < 4; z++) {
    let lumSum = 0;
    let count = 0;
    const startY = z * zoneHeight;
    const endY = Math.min(height, (z + 1) * zoneHeight);
    for (let y = startY; y < endY; y += 4) {
      for (let x = 0; x < width; x += 4) {
        const idx = (y * width + x) * 3;
        const r = rawImg.data[idx];
        const g = rawImg.data[idx + 1];
        const b = rawImg.data[idx + 2];
        lumSum += 0.299 * r + 0.587 * g + 0.114 * b;
        count++;
      }
    }
    const avgLum = lumSum / (count * 255 || 1);
    vec[4 + z * 3] = avgLum;
    vec[4 + z * 3 + 1] = Math.tanh((avgLum - 0.5) * 3);
    vec[4 + z * 3 + 2] = Math.sin(avgLum * Math.PI);
  }

  // Color slice distributions
  let rSum = 0, gSum = 0, bSum = 0;
  for (let i = 0; i < rawImg.data.length; i += 12) {
    rSum += rawImg.data[i];
    gSum += rawImg.data[i + 1];
    bSum += rawImg.data[i + 2];
  }
  const total = rSum + gSum + bSum || 1;
  vec[16] = rSum / total;
  vec[17] = gSum / total;
  vec[18] = bSum / total;

  return l2Normalize(vec);
}

// 2. Load clean manifest
const manifestPath = path.resolve('eval/golden/proposed_clean_manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const manifestMap = new Map(manifest.map(m => [m.id, m]));

// Filter strictly validation split, vehicle only
const valItems = manifest.filter(m => 
  m.split === 'val' && 
  m.is_vehicle &&
  m.image_path &&
  fs.existsSync(path.resolve(m.image_path))
);

console.log(`Loaded ${valItems.length} clean vehicle validation items (${valItems.filter(x => x.is_in_catalogue).length} in-catalogue).`);

// Load reference gallery index
const galleryIndex = JSON.parse(fs.readFileSync('eval/gallery/retrieval_v2_index.json', 'utf8'));
const galleryDocs = galleryIndex.documents.filter(d => {
  const m = manifestMap.get(d.provenanceId);
  return m && m.image_path && fs.existsSync(path.resolve(m.image_path));
});
console.log(`Loaded ${galleryDocs.length} valid gallery reference documents.`);

// Preload transformers pipelines
console.log('Loading transformer pipelines...');
const { pipeline } = await import('@xenova/transformers');
const dPipe = await pipeline('image-feature-extraction', 'Xenova/dinov2-small');
const cPipe = await pipeline('image-feature-extraction', 'Xenova/clip-vit-base-patch32');
console.log('DINOv2 & CLIP pipelines ready.\n');

// Cosine similarity
function cosineSim(a, b) {
  let dot = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
  }
  return dot;
}

async function extractFromRaw(pipe, rawImg, dims) {
  const resized = await rawImg.resize(224, 224);
  const out = await pipe(resized);
  const rawVec = new Array(dims);
  for (let i = 0; i < dims; i++) {
    rawVec[i] = out.data[i];
  }
  return l2Normalize(rawVec);
}

// Compute gallery embeddings for each model
console.log('Computing gallery embeddings for Hand-Built, DINOv2, and CLIP...');
const galleryHandbuilt = [];
const galleryDinov2 = [];
const galleryClip = [];

for (let i = 0; i < galleryDocs.length; i++) {
  const d = galleryDocs[i];
  const m = manifestMap.get(d.provenanceId);
  const imgPath = path.resolve(m.image_path);
  const buf = fs.readFileSync(imgPath);
  const rawImg = await RawImage.fromBlob(new Blob([buf]));

  const vH = extractHandbuiltFromRaw(rawImg);
  const vD = await extractFromRaw(dPipe, rawImg, 384);
  const vC = await extractFromRaw(cPipe, rawImg, 512);

  if (vH) galleryHandbuilt.push({ meta: d, vector: vH });
  if (vD) galleryDinov2.push({ meta: d, vector: vD });
  if (vC) galleryClip.push({ meta: d, vector: vC });

  if ((i + 1) % 20 === 0 || i + 1 === galleryDocs.length) {
    process.stdout.write(`\rEmbedded ${i + 1}/${galleryDocs.length} gallery items...`);
  }
}
console.log(`\nGallery ready: Handbuilt=${galleryHandbuilt.length}, DINOv2=${galleryDinov2.length}, CLIP=${galleryClip.length}.\n`);

// Metrics tracker
const results = {
  handbuilt: {
    latencies: [],
    makeRecall: { 1: 0, 3: 0, 5: 0, 10: 0 },
    modelRecall: { 1: 0, 3: 0, 5: 0, 10: 0 },
    variantRecall: { 1: 0, 3: 0, 5: 0, 10: 0 },
    grayscaleSims: [],
    hueRotationSims: []
  },
  dinov2: {
    latencies: [],
    makeRecall: { 1: 0, 3: 0, 5: 0, 10: 0 },
    modelRecall: { 1: 0, 3: 0, 5: 0, 10: 0 },
    variantRecall: { 1: 0, 3: 0, 5: 0, 10: 0 },
    grayscaleSims: [],
    hueRotationSims: []
  },
  clip: {
    latencies: [],
    makeRecall: { 1: 0, 3: 0, 5: 0, 10: 0 },
    modelRecall: { 1: 0, 3: 0, 5: 0, 10: 0 },
    variantRecall: { 1: 0, 3: 0, 5: 0, 10: 0 },
    grayscaleSims: [],
    hueRotationSims: []
  }
};

function evaluateRetrieval(queryVec, gallery, groundTruth, modelKey) {
  const scored = gallery.map(item => ({
    meta: item.meta,
    score: cosineSim(queryVec, item.vector)
  }));
  scored.sort((a, b) => b.score - a.score);

  const top10 = scored.slice(0, 10);
  const ks = [1, 3, 5, 10];

  for (const k of ks) {
    const candidates = top10.slice(0, k);
    const hitMake = candidates.some(c => 
      c.meta.make?.toLowerCase() === groundTruth.make?.toLowerCase()
    );
    const hitModel = candidates.some(c => 
      c.meta.model?.toLowerCase() === groundTruth.model?.toLowerCase() ||
      (groundTruth.canonical_id && c.meta.canonicalId === groundTruth.canonical_id)
    );
    const hitVariant = candidates.some(c => 
      (groundTruth.canonical_id && c.meta.canonicalId === groundTruth.canonical_id) ||
      (c.meta.variant && groundTruth.variant && c.meta.variant?.toLowerCase() === groundTruth.variant?.toLowerCase())
    );

    if (hitMake) results[modelKey].makeRecall[k]++;
    if (hitModel) results[modelKey].modelRecall[k]++;
    if (hitVariant) results[modelKey].variantRecall[k]++;
  }
}

// Evaluate in-catalogue validation items for precise variant & model recall
const inCatalogueVal = valItems.filter(x => x.is_in_catalogue);
console.log(`Evaluating ${inCatalogueVal.length} in-catalogue validation items for hierarchical recall...`);

let evaluated = 0;
for (const item of inCatalogueVal) {
  const imgPath = path.resolve(item.image_path);
  const buf = fs.readFileSync(imgPath);

  // Load RawImage
  const blob = new Blob([buf]);
  const rawImg = await RawImage.fromBlob(blob);

  // 3-channel grayscale image
  const greyData = new Uint8ClampedArray(rawImg.data.length);
  for (let i = 0; i < rawImg.data.length; i += 3) {
    const y = Math.round(0.299 * rawImg.data[i] + 0.587 * rawImg.data[i + 1] + 0.114 * rawImg.data[i + 2]);
    greyData[i] = y;
    greyData[i + 1] = y;
    greyData[i + 2] = y;
  }
  const greyImg = new RawImage(greyData, rawImg.width, rawImg.height, 3);

  // 3-channel Hue shift (channel rotation: R->G, G->B, B->R)
  const hueData = new Uint8ClampedArray(rawImg.data.length);
  for (let i = 0; i < rawImg.data.length; i += 3) {
    hueData[i] = rawImg.data[i + 1];
    hueData[i + 1] = rawImg.data[i + 2];
    hueData[i + 2] = rawImg.data[i];
  }
  const hueImg = new RawImage(hueData, rawImg.width, rawImg.height, 3);

  // 1. Handbuilt
  let t0 = performance.now();
  const vecH = extractHandbuiltFromRaw(rawImg);
  results.handbuilt.latencies.push(performance.now() - t0);
  if (vecH) {
    evaluateRetrieval(vecH, galleryHandbuilt, item, 'handbuilt');
    const vecHGrey = extractHandbuiltFromRaw(greyImg);
    const vecHHue = extractHandbuiltFromRaw(hueImg);
    results.handbuilt.grayscaleSims.push(cosineSim(vecH, vecHGrey));
    results.handbuilt.hueRotationSims.push(cosineSim(vecH, vecHHue));
  }

  // 2. DINOv2
  t0 = performance.now();
  const vecD = await extractFromRaw(dPipe, rawImg, 384);
  results.dinov2.latencies.push(performance.now() - t0);
  if (vecD) {
    evaluateRetrieval(vecD, galleryDinov2, item, 'dinov2');
    const vecDGrey = await extractFromRaw(dPipe, greyImg, 384);
    const vecDHue = await extractFromRaw(dPipe, hueImg, 384);
    results.dinov2.grayscaleSims.push(cosineSim(vecD, vecDGrey));
    results.dinov2.hueRotationSims.push(cosineSim(vecD, vecDHue));
  }

  // 3. CLIP
  t0 = performance.now();
  const vecC = await extractFromRaw(cPipe, rawImg, 512);
  results.clip.latencies.push(performance.now() - t0);
  if (vecC) {
    evaluateRetrieval(vecC, galleryClip, item, 'clip');
    const vecCGrey = await extractFromRaw(cPipe, greyImg, 512);
    const vecCHue = await extractFromRaw(cPipe, hueImg, 512);
    results.clip.grayscaleSims.push(cosineSim(vecC, vecCGrey));
    results.clip.hueRotationSims.push(cosineSim(vecC, vecCHue));
  }

  evaluated++;
  process.stdout.write(`\rEvaluated ${evaluated}/${inCatalogueVal.length} items...`);
}

// Compile Summary
function compileStats(key, total) {
  const r = results[key];
  const avg = arr => arr.length ? arr.reduce((a,b)=>a+b,0) / arr.length : 0;
  return {
    makeRecall: {
      r1: (r.makeRecall[1] / total * 100).toFixed(1) + '%',
      r3: (r.makeRecall[3] / total * 100).toFixed(1) + '%',
      r5: (r.makeRecall[5] / total * 100).toFixed(1) + '%',
      r10: (r.makeRecall[10] / total * 100).toFixed(1) + '%'
    },
    modelRecall: {
      r1: (r.modelRecall[1] / total * 100).toFixed(1) + '%',
      r3: (r.modelRecall[3] / total * 100).toFixed(1) + '%',
      r5: (r.modelRecall[5] / total * 100).toFixed(1) + '%',
      r10: (r.modelRecall[10] / total * 100).toFixed(1) + '%'
    },
    variantRecall: {
      r1: (r.variantRecall[1] / total * 100).toFixed(1) + '%',
      r3: (r.variantRecall[3] / total * 100).toFixed(1) + '%',
      r5: (r.variantRecall[5] / total * 100).toFixed(1) + '%',
      r10: (r.variantRecall[10] / total * 100).toFixed(1) + '%'
    },
    meanLatencyMs: avg(r.latencies).toFixed(1),
    meanGrayscaleCosineSim: avg(r.grayscaleSims).toFixed(4),
    meanHueRotationCosineSim: avg(r.hueRotationSims).toFixed(4),
    estimatedCostPer1k: '$0.00'
  };
}

const summary = {
  totalEvaluated: evaluated,
  timestamp: new Date().toISOString(),
  handbuilt: compileStats('handbuilt', evaluated),
  dinov2: compileStats('dinov2', evaluated),
  clip: compileStats('clip', evaluated)
};

console.log('\n\n====================================================');
console.log('BENCHMARK SUMMARY RESULTS:');
console.log(JSON.stringify(summary, null, 2));
console.log('====================================================\n');

fs.writeFileSync('eval/learned_embeddings_benchmark.json', JSON.stringify(summary, null, 2));
console.log('Saved benchmark results to eval/learned_embeddings_benchmark.json');
