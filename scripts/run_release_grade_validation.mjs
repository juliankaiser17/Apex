// scripts/run_release_grade_validation.mjs
// Phase 12D: Release-Grade Validation on N >= 300 Pool (Group-Disjoint Dev+Val, 0 Test items)

import fs from 'fs';
import path from 'path';

// Load .env credentials
if (fs.existsSync('.env')) {
  const envText = fs.readFileSync('.env', 'utf8');
  envText.split('\n').forEach(l => {
    const i = l.indexOf('=');
    if (i > -1) {
      const k = l.slice(0, i).trim();
      const v = l.slice(i + 1).trim().replace(/^["']|["']$/g, '');
      if (k && !process.env[k]) process.env[k] = v;
    }
  });
}

import { V2IdentificationPipeline } from '../src/ai-engine/v2/v2Pipeline.ts';

console.log('====================================================');
console.log('PHASE 12D: RELEASE-GRADE VALIDATION (FULL PIPELINE)');
console.log('====================================================\n');

// 1. Load clean manifest
const manifest = JSON.parse(fs.readFileSync('eval/golden/proposed_clean_manifest.json', 'utf8'));

// Filter strictly dev + val vehicles, existing files, non-quarantined
const cleanVehicles = manifest.filter(x => 
  (x.split === 'dev' || x.split === 'val') && 
  x.is_vehicle && 
  !x.is_quarantined &&
  x.image_path && 
  fs.existsSync(path.resolve(x.image_path))
);

console.log(`Eligible clean vehicle images across dev and val: ${cleanVehicles.length}`);

// Build group-disjoint validation pool
const groups = new Map();
for (const x of cleanVehicles) {
  const artist = (x.provenance?.artist || 'unknown').toLowerCase().trim();
  const grp = artist + '__' + x.make.toLowerCase().trim();
  if (!groups.has(grp)) groups.set(grp, []);
  groups.get(grp).push(x);
}

const poolItems = [];
const coveredClasses = new Set();
const selectedGroups = new Set();

// Pass 1: maximize class coverage
for (const [grp, items] of groups.entries()) {
  const newClasses = items.map(x => x.make + ' ' + x.model).filter(c => !coveredClasses.has(c));
  if (newClasses.length > 0) {
    selectedGroups.add(grp);
    for (const item of items) {
      poolItems.push(item);
      coveredClasses.add(item.make + ' ' + item.model);
    }
  }
}

// Pass 2: fill to target size >= 300
for (const [grp, items] of groups.entries()) {
  if (poolItems.length >= 315) break;
  if (!selectedGroups.has(grp)) {
    selectedGroups.add(grp);
    for (const item of items) {
      poolItems.push(item);
      coveredClasses.add(item.make + ' ' + item.model);
    }
  }
}

console.log(`Release Validation Pool constructed: ${poolItems.length} items across ${coveredClasses.size} distinct classes (${selectedGroups.size} session groups).`);

// Save pool manifest
fs.writeFileSync('eval/release_validation_pool.json', JSON.stringify({
  count: poolItems.length,
  classesCount: coveredClasses.size,
  groupsCount: selectedGroups.size,
  items: poolItems.map(p => ({ id: p.id, make: p.make, model: p.model, split: p.split, is_in_catalogue: p.is_in_catalogue }))
}, null, 2));

// Check CLI flags
const isDryRun = process.argv.includes('--dry-run');
const limitArg = process.argv.find(a => a.startsWith('--limit='));
const limit = limitArg ? parseInt(limitArg.split('=')[1], 10) : (isDryRun ? 5 : poolItems.length);

const targetItems = poolItems.slice(0, limit);
console.log(`Executing evaluation on ${targetItems.length} validation pool items (dryRun=${isDryRun})...\n`);

const pipeline = new V2IdentificationPipeline();

// Wilson 95% Confidence Interval
function wilsonCI(k, n) {
  if (n === 0) return { p: 0, low: 0, high: 0, str: '0.0% [0.0% - 0.0%]' };
  const z = 1.95996;
  const p = k / n;
  const denom = 1 + (z * z) / n;
  const center = (p + (z * z) / (2 * n)) / denom;
  const half = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / denom;
  const low = Math.max(0, center - half);
  const high = Math.min(1, center + half);
  return {
    p,
    low,
    high,
    str: `${(p * 100).toFixed(1)}% [${(low * 100).toFixed(1)}% - ${(high * 100).toFixed(1)}%]`
  };
}

// Trackers
const metrics = {
  total: 0,
  makeCorrect: 0,
  modelCorrect: 0,
  genCorrect: 0,
  variantCorrect: 0,
  makeOnly: 0,
  wrongConfident: 0,
  identifiedModel: 0,
  needsMoreViews: 0,
  uncertain: 0,
  notInCatalogue: 0,
  providerFailure: 0,
  latencies: [],
  costs: [],
  confusions: new Map(),
  byViewpoint: new Map(),
  byCondition: new Map(),
  calibrationBins: Array.from({ length: 10 }, () => ({ confs: [], corrects: [] }))
};

let completed = 0;
const resultsLog = [];

for (const item of targetItems) {
  const imgPath = path.resolve(item.image_path);
  const buf = fs.readFileSync(imgPath);
  const dataUrl = `data:image/jpeg;base64,${buf.toString('base64')}`;

  const t0 = performance.now();
  let result;
  let hasProviderError = false;

  try {
    result = await pipeline.execute({
      imageDataUrl: dataUrl,
      traceId: `rel_val_${item.id}`
    });
  } catch (err) {
    hasProviderError = true;
    result = {
      status: 'uncertain',
      make: null,
      model: null,
      generation: null,
      variant: null,
      displayName: 'Unknown',
      calibratedConfidence: { make: 0, model: 0, generation: 0, variant: 0, overall: 0 },
      totalLatencyMs: Math.round(performance.now() - t0),
      estimatedCostUsd: 0.0,
      vlmCallsCount: 0
    };
  }

  const overallConf = result.calibratedConfidence?.overall ?? 0;
  const predMake = result.make?.toLowerCase().trim() || null;
  const trueMake = item.make?.toLowerCase().trim() || null;
  const predModel = result.model?.toLowerCase().trim() || null;
  const trueModel = item.model?.toLowerCase().trim() || null;
  const predVariant = result.variant?.toLowerCase().trim() || null;
  const trueVariant = item.variant?.toLowerCase().trim() || null;
  const predGen = result.generation?.toLowerCase().trim() || null;
  const trueGen = item.generation?.toLowerCase().trim() || null;

  const isMakeMatch = predMake && trueMake && predMake === trueMake;
  const isModelMatch = isMakeMatch && predModel && trueModel && (predModel === trueModel || predModel.includes(trueModel) || trueModel.includes(predModel));
  const isGenMatch = isModelMatch && (!trueGen || predGen === trueGen);
  const isVariantMatch = isModelMatch && (!trueVariant || predVariant === trueVariant);

  metrics.total++;
  if (hasProviderError) metrics.providerFailure++;
  if (isMakeMatch) metrics.makeCorrect++;
  if (isModelMatch) metrics.modelCorrect++;
  if (isGenMatch) metrics.genCorrect++;
  if (isVariantMatch) metrics.variantCorrect++;

  // Status breakdown
  if (result.status === 'identified_model') metrics.identifiedModel++;
  if (result.status === 'needs_more_views') metrics.needsMoreViews++;
  if (result.status === 'uncertain') metrics.uncertain++;
  if (result.status === 'not_in_catalogue') metrics.notInCatalogue++;
  if (isMakeMatch && !predModel) metrics.makeOnly++;

  // Wrong-but-confident invariant (conf >= 0.70 but wrong model)
  const isWrongConfident = overallConf >= 0.70 && !isModelMatch;
  if (isWrongConfident) metrics.wrongConfident++;

  // Latency & cost
  metrics.latencies.push(result.totalLatencyMs || 0);
  metrics.costs.push(result.estimatedCostUsd || 0);

  // Confusions
  if (predMake && predModel && !isModelMatch) {
    const key = `${item.make} ${item.model} → ${result.make} ${result.model}`;
    metrics.confusions.set(key, (metrics.confusions.get(key) || 0) + 1);
  }

  // Viewpoint breakdown
  const vp = item.viewpoint || 'unknown';
  if (!metrics.byViewpoint.has(vp)) metrics.byViewpoint.set(vp, { total: 0, modelCorrect: 0 });
  const vpStats = metrics.byViewpoint.get(vp);
  vpStats.total++;
  if (isModelMatch) vpStats.modelCorrect++;

  // Condition breakdown
  const cond = `${item.conditions?.lighting || 'day'}_${item.conditions?.weather || 'clear'}`;
  if (!metrics.byCondition.has(cond)) metrics.byCondition.set(cond, { total: 0, modelCorrect: 0 });
  const condStats = metrics.byCondition.get(cond);
  condStats.total++;
  if (isModelMatch) condStats.modelCorrect++;

  // Calibration binning
  const binIdx = Math.min(9, Math.floor(overallConf * 10));
  metrics.calibrationBins[binIdx].confs.push(overallConf);
  metrics.calibrationBins[binIdx].corrects.push(isModelMatch ? 1 : 0);

  resultsLog.push({
    id: item.id,
    true: { make: item.make, model: item.model, variant: item.variant },
    pred: { make: result.make, model: result.model, variant: result.variant, status: result.status, confidence: overallConf },
    isModelMatch,
    latencyMs: result.totalLatencyMs,
    costUsd: result.estimatedCostUsd
  });

  completed++;
  if (completed % 10 === 0 || completed === targetItems.length) {
    process.stdout.write(`\rEvaluated ${completed}/${targetItems.length} items...`);
  }

  // Polite delay to preserve API quota bounds
  await new Promise(r => setTimeout(r, 120));
}

console.log('\n\n--- Evaluation Complete! Compiling Release Metrics ---');

// Compute Calibration Curve and ECE
let eceSum = 0;
const calibrationCurve = [];

for (let b = 0; b < 10; b++) {
  const bin = metrics.calibrationBins[b];
  const count = bin.confs.length;
  if (count > 0) {
    const avgConf = bin.confs.reduce((a, b) => a + b, 0) / count;
    const avgAcc = bin.corrects.reduce((a, b) => a + b, 0) / count;
    eceSum += Math.abs(avgAcc - avgConf) * (count / metrics.total);
    calibrationCurve.push({
      range: `[${(b * 0.1).toFixed(1)} - ${((b + 1) * 0.1).toFixed(1)})`,
      count,
      avgConfidence: Number(avgConf.toFixed(3)),
      empiricalAccuracy: Number(avgAcc.toFixed(3)),
      gap: Number(Math.abs(avgAcc - avgConf).toFixed(3))
    });
  } else {
    calibrationCurve.push({
      range: `[${(b * 0.1).toFixed(1)} - ${((b + 1) * 0.1).toFixed(1)})`,
      count: 0,
      avgConfidence: 0,
      empiricalAccuracy: 0,
      gap: 0
    });
  }
}

// Top 10 Confusions
const topConfusions = Array.from(metrics.confusions.entries())
  .sort((a, b) => b[1] - a[1])
  .slice(0, 10)
  .map(([pair, count]) => ({ pair, count }));

const avg = arr => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
const sum = arr => arr.length ? arr.reduce((a, b) => a + b, 0) : 0;

const finalReport = {
  sampleSize: metrics.total,
  classesCovered: coveredClasses.size,
  sessionGroupsCovered: selectedGroups.size,
  timestamp: new Date().toISOString(),
  metrics: {
    makeAccuracy: wilsonCI(metrics.makeCorrect, metrics.total),
    modelAccuracy: wilsonCI(metrics.modelCorrect, metrics.total),
    generationAccuracy: wilsonCI(metrics.genCorrect, metrics.total),
    variantAccuracy: wilsonCI(metrics.variantCorrect, metrics.total),
    makeOnlyRate: wilsonCI(metrics.makeOnly, metrics.total),
    wrongConfidentRate: wilsonCI(metrics.wrongConfident, metrics.total),
    identifiedModelRate: wilsonCI(metrics.identifiedModel, metrics.total),
    needsMoreViewsRate: wilsonCI(metrics.needsMoreViews, metrics.total),
    uncertainRate: wilsonCI(metrics.uncertain, metrics.total),
    notInCatalogueRate: wilsonCI(metrics.notInCatalogue, metrics.total),
    providerFailureRate: wilsonCI(metrics.providerFailure, metrics.total),
    meanLatencyMs: Number(avg(metrics.latencies).toFixed(1)),
    meanCostPerScanUsd: Number(avg(metrics.costs).toFixed(5)),
    totalCostUsd: Number(sum(metrics.costs).toFixed(4)),
    heldOutECE: Number(eceSum.toFixed(4))
  },
  releaseTargetsComparison: {
    makeAccuracy: { target: '98.0%', achieved: wilsonCI(metrics.makeCorrect, metrics.total).str, met: (metrics.makeCorrect / metrics.total) >= 0.98 },
    modelAccuracy: { target: '92.0%', achieved: wilsonCI(metrics.modelCorrect, metrics.total).str, met: (metrics.modelCorrect / metrics.total) >= 0.92 },
    variantAccuracy: { target: '80.0%', achieved: wilsonCI(metrics.variantCorrect, metrics.total).str, met: (metrics.variantCorrect / metrics.total) >= 0.80 },
    wrongConfidentRate: { target: '< 2.0%', achieved: wilsonCI(metrics.wrongConfident, metrics.total).str, met: (metrics.wrongConfident / metrics.total) < 0.02 },
    makeOnlyRate: { target: '< 5.0%', achieved: wilsonCI(metrics.makeOnly, metrics.total).str, met: (metrics.makeOnly / metrics.total) < 0.05 }
  },
  top10Confusions: topConfusions,
  viewpointBreakdown: Object.fromEntries(
    Array.from(metrics.byViewpoint.entries()).map(([k, v]) => [k, { ...v, accuracy: wilsonCI(v.modelCorrect, v.total).str }])
  ),
  conditionBreakdown: Object.fromEntries(
    Array.from(metrics.byCondition.entries()).map(([k, v]) => [k, { ...v, accuracy: wilsonCI(v.modelCorrect, v.total).str }])
  ),
  calibrationCurve
};

console.log('\n====================================================');
console.log('RELEASE-GRADE VALIDATION SUMMARY:');
console.log(JSON.stringify(finalReport, null, 2));
console.log('====================================================\n');

fs.writeFileSync('eval/release_validation_report.json', JSON.stringify(finalReport, null, 2));
fs.writeFileSync('eval/release_validation_predictions.json', JSON.stringify(resultsLog, null, 2));
console.log('Saved reports to eval/release_validation_report.json and eval/release_validation_predictions.json.');
