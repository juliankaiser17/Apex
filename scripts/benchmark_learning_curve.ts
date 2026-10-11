/**
 * APEX AI IDENTIFICATION — Reference Data Learning Curve Benchmark (13E)
 *
 * Evaluates retrieval recall as a function of reference images per class
 * (subsampling 1, 2, 3 images per class from dev) against validation set (N=32).
 * Fits empirical curve and projects count needed for 95% Recall@5.
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { clipExtractor } from '../src/ai-engine/v2/learnedEmbeddingExtractor.ts';

function cosineSim(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

function computeCentroid(vectors: number[][]): number[] {
  const dim = vectors[0].length;
  const sum = new Array(dim).fill(0);
  for (const v of vectors) {
    for (let i = 0; i < dim; i++) sum[i] += v[i];
  }
  let norm = 0;
  for (let i = 0; i < dim; i++) {
    sum[i] /= vectors.length;
    norm += sum[i] * sum[i];
  }
  norm = Math.sqrt(norm);
  return sum.map(x => (norm > 0 ? x / norm : 0));
}

async function main() {
  console.log('=== RUNNING REFERENCE DATA LEARNING CURVE EXPERIMENT (13E) ===\n');

  const manifest = JSON.parse(fs.readFileSync('eval/golden/proposed_clean_manifest.json', 'utf8'));
  const quarantine = JSON.parse(fs.readFileSync('eval/quarantine/ledger.json', 'utf8'));
  const qIds = new Set(quarantine.items.map((x: any) => x.id));

  // 1. Group dev items by canonical_id
  const devItemsByClass: Record<string, any[]> = {};
  for (const item of manifest) {
    if (item.split === 'dev' && item.is_in_catalogue && item.canonical_id && !qIds.has(item.id)) {
      if (!devItemsByClass[item.canonical_id]) devItemsByClass[item.canonical_id] = [];
      devItemsByClass[item.canonical_id].push(item);
    }
  }

  // Pre-extract dev embeddings
  console.log('Pre-extracting development image embeddings...');
  const devEmbeddings: Record<string, { item: any; vector: number[] }[]> = {};
  for (const [canonId, items] of Object.entries(devItemsByClass)) {
    devEmbeddings[canonId] = [];
    for (const item of items) {
      if (!fs.existsSync(item.image_path)) continue;
      const buf = fs.readFileSync(item.image_path);
      const vec = await clipExtractor.extractVector(buf);
      if (vec && vec.length === 512) {
        devEmbeddings[canonId].push({ item, vector: vec });
      }
    }
  }

  // 2. Load validation set
  const valCat = manifest.filter((m: any) => m.split === 'val' && m.is_in_catalogue && m.canonical_id);
  console.log(`Pre-extracting validation items (N=${valCat.length})...`);
  const valEmbeddings: { item: any; vector: number[] }[] = [];
  for (const item of valCat) {
    if (!fs.existsSync(item.image_path)) continue;
    const buf = fs.readFileSync(item.image_path);
    const vec = await clipExtractor.extractVector(buf);
    if (vec && vec.length === 512) {
      valEmbeddings.push({ item, vector: vec });
    }
  }

  const kLevels = [1, 2, 3];
  const resultsByK: Record<number, { recallAt1: number; recallAt5: number; recallAt10: number; sampleCount: number }> = {};

  for (const k of kLevels) {
    console.log(`\nEvaluating reference subsample k=${k} images/class...`);

    // Build gallery centroids with up to k references
    const galleryCentroids: { canonicalId: string; vector: number[] }[] = [];
    for (const [canonId, entries] of Object.entries(devEmbeddings)) {
      if (entries.length === 0) continue;
      const subsample = entries.slice(0, k).map(e => e.vector);
      const centroid = computeCentroid(subsample);
      galleryCentroids.push({ canonicalId: canonId, vector: centroid });
    }

    let r1 = 0, r5 = 0, r10 = 0;
    const totalVal = valEmbeddings.length;

    for (const val of valEmbeddings) {
      const trueId = val.item.canonical_id;
      const scores = galleryCentroids.map(g => ({
        id: g.canonicalId,
        sim: cosineSim(val.vector, g.vector)
      })).sort((a, b) => b.sim - a.sim);

      const rank = scores.findIndex(s => s.id === trueId);
      if (rank === 0) r1++;
      if (rank >= 0 && rank < 5) r5++;
      if (rank >= 0 && rank < 10) r10++;
    }

    resultsByK[k] = {
      recallAt1: Number(((r1 / totalVal) * 100).toFixed(1)),
      recallAt5: Number(((r5 / totalVal) * 100).toFixed(1)),
      recallAt10: Number(((r10 / totalVal) * 100).toFixed(1)),
      sampleCount: totalVal
    };

    console.log(`k=${k} -> Recall@1: ${resultsByK[k].recallAt1}%, Recall@5: ${resultsByK[k].recallAt5}%, Recall@10: ${resultsByK[k].recallAt10}%`);
  }

  // Log-linear extrapolation for 95% Recall@5
  // Recall(k) = a * ln(k) + b
  const x1 = Math.log(1), y1 = resultsByK[1].recallAt5;
  const x2 = Math.log(3), y2 = resultsByK[3].recallAt5;
  const slope = (y2 - y1) / (x2 - x1);
  const intercept = y1 - slope * x1;

  // Solve for 95% Recall@5: 95 = a * ln(k) + b  =>  k = exp((95 - b) / a)
  const projectedKFor95 = Math.ceil(Math.exp((95 - intercept) / Math.max(1, slope)));

  console.log('\n--- Empirical Projection ---');
  console.log(`Slope a: ${slope.toFixed(2)}, Intercept b: ${intercept.toFixed(2)}`);
  console.log(`Estimated reference images per class needed for 95% Recall@5: ~${projectedKFor95} images/class`);

  // Save raw results
  const rawDir = path.resolve('eval/raw_responses');
  if (!fs.existsSync(rawDir)) fs.mkdirSync(rawDir, { recursive: true });
  const rawPath = path.join(rawDir, 'learning_curve_raw.json');

  const rawData = {
    timestamp: new Date().toISOString(),
    evaluationPool: 'eval/golden/proposed_clean_manifest.json (val in-catalogue, N=32)',
    subsampleResults: resultsByK,
    fittedModel: {
      formula: 'Recall@5(k) = a * ln(k) + b',
      slope,
      intercept,
      targetRecallAt5: 95.0,
      projectedImagesPerClass: projectedKFor95
    }
  };

  const rawJson = JSON.stringify(rawData, null, 2);
  fs.writeFileSync(rawPath, rawJson, 'utf8');
  const hash = crypto.createHash('sha256').update(rawJson).digest('hex');

  console.log(`\nRaw results saved: ${rawPath}`);
  console.log(`SHA-256: ${hash}`);
}

main().catch(console.error);
