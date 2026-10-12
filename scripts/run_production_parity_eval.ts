/**
 * APEX PRIVATE BETA — PRODUCTION PARITY EVALUATION (60-IMAGE STRATIFIED SUBSET)
 * 
 * Verifies whether client-side preprocessing (768px, 82% JPEG) alters
 * accuracy, answer rate, or calibration compared to raw uncompressed images.
 * 
 * Strict Blast Radius & Invariant Constraints:
 * 1. Gate G5 LOCKED: Test split (N=248) is strictly uninspected and untouched.
 * 2. Stratified 60-image subset drawn exclusively from validation split:
 *    - 35 In-Catalogue (Porsche, Ferrari, Lamborghini, McLaren, Nissan GT-R, Corvette)
 *    - 20 Out-of-Catalogue (Commuter vehicles)
 *    - 5 Synthetic Negatives (noise, black, texture, solid)
 * 3. Rate limiter strictly < 15 RPM (4.3s interval, pacing ~13.95 RPM).
 * 4. Model: gemini-3.5-flash-lite (production free-tier candidate).
 * 5. Cost: 60 requests * $0.00 = $0.00 (within 500 daily free tier budget).
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import sharp from 'sharp';

// Load environment variables
if (fs.existsSync('.env')) {
  const envContent = fs.readFileSync('.env', 'utf8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
      const idx = trimmed.indexOf('=');
      const key = trimmed.slice(0, idx).trim();
      const val = trimmed.slice(idx + 1).trim();
      if (!process.env[key]) process.env[key] = val;
    }
  }
}

import { vlmFirstEngine } from '../src/ai-engine/v2/vlmFirstEngine';

export function wilsonCi(k: number, n: number): [number, number] {
  if (n === 0) return [0, 0];
  const z = 1.95996;
  const p = k / n;
  const denom = 1 + (z * z) / n;
  const center = (p + (z * z) / (2 * n)) / denom;
  const margin = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / denom;
  return [
    Number(Math.max(0, center - margin).toFixed(4)),
    Number(Math.min(1, center + margin).toFixed(4))
  ];
}

async function preprocessProductionImage(imagePath: string): Promise<string> {
  const fileBuffer = fs.readFileSync(imagePath);
  const processedBuffer = await sharp(fileBuffer)
    .resize({
      width: 768,
      height: 768,
      fit: 'inside',
      withoutEnlargement: true
    })
    .jpeg({ quality: 82 })
    .toBuffer();
  return `data:image/jpeg;base64,${processedBuffer.toString('base64')}`;
}

async function createSyntheticNegativePreprocessed(type: 'noise' | 'black' | 'texture' | 'solid'): Promise<string> {
  let img: sharp.Sharp;
  if (type === 'noise') {
    const raw = Buffer.alloc(256 * 256 * 3);
    for (let i = 0; i < raw.length; i++) raw[i] = (i * 37) % 256;
    img = sharp(raw, { raw: { width: 256, height: 256, channels: 3 } });
  } else if (type === 'black') {
    img = sharp({ create: { width: 256, height: 256, channels: 3, background: { r: 5, g: 5, b: 5 } } });
  } else if (type === 'texture') {
    img = sharp({ create: { width: 256, height: 256, channels: 3, background: { r: 180, g: 140, b: 90 } } });
  } else {
    img = sharp({ create: { width: 256, height: 256, channels: 3, background: { r: 240, g: 240, b: 240 } } });
  }
  const buf = await img.jpeg({ quality: 82 }).toBuffer();
  return `data:image/jpeg;base64,${buf.toString('base64')}`;
}

const CACHE_DIR = 'eval/cache';
const CACHE_FILE = path.join(CACHE_DIR, 'production_parity_cache.json');
const RAW_LOG_FILE = 'eval/production_parity_raw_calls.jsonl';

if (!fs.existsSync(CACHE_DIR)) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
}

let parityCache: Record<string, { rawText: string; tokens?: any; latencyMs: number }> = {};
if (fs.existsSync(CACHE_FILE)) {
  try {
    parityCache = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
  } catch {}
}

function saveCache() {
  fs.writeFileSync(CACHE_FILE, JSON.stringify(parityCache, null, 2));
}

let lastCallTimestamp = 0;
const MIN_CALL_INTERVAL_MS = 4300; // ~13.95 RPM (strictly under 15 RPM)

async function rateLimitedResumableVlmCaller(
  prompt: string,
  imageDataUrl: string,
  modelName: string,
  timeoutMs: number
): Promise<{ rawText: string; tokens?: any; latencyMs: number }> {
  const imageHash = crypto.createHash('sha256').update(imageDataUrl).digest('hex').substring(0, 32);
  const promptHash = crypto.createHash('sha256').update(prompt).digest('hex').substring(0, 16);
  const cacheKey = `parity_${modelName}_${imageHash}_${promptHash}`;

  if (parityCache[cacheKey]) {
    return parityCache[cacheKey];
  }

  const apiKey = process.env.GEMINI_API_KEY?.trim() || '';
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY missing from environment');
  }

  let base64Data = '';
  let mimeType = 'image/jpeg';
  if (imageDataUrl.includes(',')) {
    const parts = imageDataUrl.split(',');
    base64Data = parts[1];
    const match = parts[0].match(/:(.*?);/);
    if (match) mimeType = match[1];
  } else {
    base64Data = imageDataUrl;
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent`;

  let attempt = 0;
  while (true) {
    attempt++;
    const elapsed = Date.now() - lastCallTimestamp;
    if (elapsed < MIN_CALL_INTERVAL_MS) {
      await new Promise(r => setTimeout(r, MIN_CALL_INTERVAL_MS - elapsed));
    }
    lastCallTimestamp = Date.now();

    const t0 = performance.now();
    try {
      const controller = new AbortController();
      const currentTimeout = Math.min(60000, (timeoutMs || 30000) + (attempt - 1) * 10000);
      const timer = setTimeout(() => controller.abort(), currentTimeout);

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: prompt },
                { inlineData: { mimeType, data: base64Data } }
              ]
            }
          ],
          generationConfig: {
            temperature: 0.1,
            responseMimeType: 'application/json',
            maxOutputTokens: 2048
          }
        }),
        signal: controller.signal
      });
      clearTimeout(timer);
      const latencyMs = Math.round(performance.now() - t0);

      if (res.status === 429) {
        console.warn(`[RATE_LIMIT] HTTP 429 on ${modelName}. Backing off 60s for minute reset (attempt ${attempt})...`);
        await new Promise(r => setTimeout(r, 60000));
        continue;
      }

      if (res.status === 503 || res.status === 500) {
        console.warn(`[SERVER_RETRY] HTTP ${res.status} on ${modelName}. Backing off 5s (attempt ${attempt})...`);
        await new Promise(r => setTimeout(r, 5000));
        continue;
      }

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`HTTP ${res.status}: ${errText}`);
      }

      const json: any = await res.json();
      const rawText = json.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!rawText) throw new Error('Empty payload returned from Gemini');

      const entry = {
        rawText,
        tokens: json.usageMetadata || {},
        latencyMs
      };

      parityCache[cacheKey] = entry;
      saveCache();

      const rawLogEntry = {
        timestamp: new Date().toISOString(),
        model: modelName,
        imageHash,
        promptHash,
        latencyMs,
        tokens: entry.tokens,
        status: 'SUCCESS'
      };
      fs.appendFileSync(RAW_LOG_FILE, JSON.stringify(rawLogEntry) + '\n');

      return entry;
    } catch (err: any) {
      if (err.name === 'AbortError' || err.message?.includes('aborted')) {
        console.warn(`[TIMEOUT] Request aborted for ${modelName} (attempt ${attempt}). Retrying...`);
        if (attempt > 4) throw err;
        await new Promise(r => setTimeout(r, 2000));
        continue;
      }
      if (attempt > 3) throw err;
      console.warn(`[RETRY] Network error on ${modelName}: ${err.message}. Retrying in 3s...`);
      await new Promise(r => setTimeout(r, 3000));
    }
  }
}

interface EvalSample {
  id: string;
  imagePath: string;
  imageDataUrl: string;
  population: 'in_catalogue' | 'out_of_catalogue' | 'non_vehicle';
  trueMake: string | null;
  trueModel: string | null;
  trueGeneration: string | null;
  trueVariant: string | null;
  trueCanonicalId: string | null;
}

async function main() {
  console.log('========================================================================');
  console.log('APEX PRIVATE BETA — PRODUCTION PARITY EVALUATION (60 SAMPLES)');
  console.log('Preprocessing: 768px, 82% JPEG | Model: gemini-3.5-flash-lite');
  console.log('========================================================================\n');

  // 1. Verify Manifest Integrity & Gate G5
  const manifestPath = 'eval/golden/proposed_clean_manifest.json';
  const manifestRaw = fs.readFileSync(manifestPath);
  const manifestHash = crypto.createHash('sha256').update(manifestRaw).digest('hex');
  const EXPECTED_HASH = 'f488411844bdf6f04a8cccdccc5a10f9b6c2a07f6d4d1310d9e2e9c336e0d7f6';
  if (manifestHash !== EXPECTED_HASH) {
    throw new Error(`Gate G5 Violation: Manifest SHA256 mismatch: ${manifestHash}`);
  }
  console.log(`[Safety Guard] Manifest SHA256 verified: ${manifestHash}`);

  const manifest: any[] = JSON.parse(manifestRaw.toString('utf8'));
  const testItems = manifest.filter(m => m.split === 'test');
  console.log(`[Safety Guard] Gate G5 LOCKED: ${testItems.length} test split items untouched.\n`);

  const valManifest = manifest.filter(m => m.split === 'val');
  const inCatCorpus = JSON.parse(fs.readFileSync('eval/golden/in_catalogue_eval_set_v2.json', 'utf8'));
  const inCatValIds = new Set(inCatCorpus.items.filter((i: any) => i.split === 'val').map((i: any) => i.id));

  // Stratify 35 In-Catalogue samples
  // Priority: 10 Porsche, 10 Ferrari, 6 Lamborghini, 4 McLaren, 5 other iconic launch models
  const inCatValItems = valManifest.filter(m => inCatValIds.has(m.id) && fs.existsSync(m.image_path));
  const porscheItems = inCatValItems.filter(m => m.make === 'Porsche').slice(0, 10);
  const ferrariItems = inCatValItems.filter(m => m.make === 'Ferrari').slice(0, 10);
  const lamboItems = inCatValItems.filter(m => m.make === 'Lamborghini').slice(0, 6);
  const mclarenItems = inCatValItems.filter(m => m.make === 'McLaren').slice(0, 4);
  const otherIconicItems = inCatValItems.filter(m => !['Porsche', 'Ferrari', 'Lamborghini', 'McLaren'].includes(m.make)).slice(0, 5);

  const selectedInCat = [
    ...porscheItems,
    ...ferrariItems,
    ...lamboItems,
    ...mclarenItems,
    ...otherIconicItems
  ];

  if (selectedInCat.length !== 35) {
    throw new Error(`Expected 35 in-cat items, got ${selectedInCat.length}`);
  }

  // Stratify 20 Out-of-Catalogue commuter samples
  const outValItems = valManifest.filter(m => !inCatValIds.has(m.id) && fs.existsSync(m.image_path));
  const selectedOut = outValItems.slice(0, 20);

  if (selectedOut.length !== 20) {
    throw new Error(`Expected 20 out-of-cat items, got ${selectedOut.length}`);
  }

  console.log(`Stratification Selected:`);
  console.log(`  - In-Catalogue (35): Porsche(${porscheItems.length}), Ferrari(${ferrariItems.length}), Lambo(${lamboItems.length}), McLaren(${mclarenItems.length}), Other(${otherIconicItems.length})`);
  console.log(`  - Out-of-Catalogue (20 commuter vehicles)`);
  console.log(`  - Synthetic Negatives (5 non-vehicle images)\n`);

  // Build samples with production preprocessing (768px, 82% JPEG)
  const samples: EvalSample[] = [];

  for (const item of selectedInCat) {
    const dataUrl = await preprocessProductionImage(item.image_path);
    samples.push({
      id: item.id,
      imagePath: item.image_path,
      imageDataUrl: dataUrl,
      population: 'in_catalogue',
      trueMake: item.make || null,
      trueModel: item.model || null,
      trueGeneration: item.generation || null,
      trueVariant: item.variant || null,
      trueCanonicalId: item.canonical_id || null
    });
  }

  for (const item of selectedOut) {
    const dataUrl = await preprocessProductionImage(item.image_path);
    samples.push({
      id: item.id,
      imagePath: item.image_path,
      imageDataUrl: dataUrl,
      population: 'out_of_catalogue',
      trueMake: item.make || null,
      trueModel: item.model || null,
      trueGeneration: item.generation || null,
      trueVariant: item.variant || null,
      trueCanonicalId: item.canonical_id || null
    });
  }

  const negTypes: Array<'noise' | 'black' | 'texture' | 'solid'> = ['noise', 'black', 'texture', 'solid', 'noise'];
  for (let i = 0; i < 5; i++) {
    const negType = negTypes[i];
    const dataUrl = await createSyntheticNegativePreprocessed(negType);
    samples.push({
      id: `PARITY_NEG_${i + 1}`,
      imagePath: `[synthetic_${negType}]`,
      imageDataUrl: dataUrl,
      population: 'non_vehicle',
      trueMake: null,
      trueModel: null,
      trueGeneration: null,
      trueVariant: null,
      trueCanonicalId: null
    });
  }

  console.log(`Total Samples to Evaluate: ${samples.length} (35 In-Cat, 20 Out-Cat, 5 Synthetic Negatives)\n`);

  // Execute evaluation on gemini-3.5-flash-lite
  const modelName = 'gemini-3.5-flash-lite';
  const predictions: any[] = [];
  let completed = 0;

  for (const sample of samples) {
    completed++;
    const tStart = performance.now();
    const out = await vlmFirstEngine.execute({
      imageDataUrl: sample.imageDataUrl,
      traceId: `parity_${sample.id}`,
      customVlmCaller: rateLimitedResumableVlmCaller,
      preferredModel: modelName,
      enableSecondOpinion: false
    });
    const elapsedMs = Math.round(performance.now() - tStart);

    console.log(`[${completed}/${samples.length}] (${sample.population}) ID: ${sample.id} -> Status: ${out.status} | Make: ${out.make || 'none'} | Model: ${out.model || 'none'} | Conf: ${out.calibratedConfidence.overall.toFixed(2)} (${elapsedMs}ms)`);

    const norm = (s: string | null) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const trueM = norm(sample.trueMake);
    const predM = norm(out.make);
    const trueMod = norm(sample.trueModel);
    const predMod = norm(out.model);
    const trueVar = norm(sample.trueVariant);
    const predVar = norm(out.variant);

    const isAnswered = out.status === 'identified' || out.status === 'identified_model';
    const isMakeMatch = Boolean(trueM && predM && (trueM.includes(predM) || predM.includes(trueM)));
    const isModelMatch = Boolean(isMakeMatch && trueMod && predMod && (trueMod.includes(predMod) || predMod.includes(trueMod)));
    const isVariantMatch = Boolean(isModelMatch && ((!trueVar && !predVar) || (trueVar && predVar && (trueVar.includes(predVar) || predVar.includes(trueVar)))));

    const isWrong = !isModelMatch;
    const isWrongConfident = isWrong && isAnswered && out.calibratedConfidence.overall >= 0.80;
    const isCorrectRejection = sample.population !== 'in_catalogue' && (out.status === 'not_in_catalogue' || out.status === 'rejected');
    const isFalseAccept = sample.population !== 'in_catalogue' && out.canonicalVehicleId !== null && (out.status === 'identified' || out.status === 'identified_model');

    predictions.push({
      sampleId: sample.id,
      population: sample.population,
      model: modelName,
      trueMake: sample.trueMake,
      trueModel: sample.trueModel,
      trueVariant: sample.trueVariant,
      predMake: out.make,
      predModel: out.model,
      predVariant: out.variant,
      predCanonicalId: out.canonicalVehicleId,
      predStatus: out.status,
      predConfidence: out.calibratedConfidence.overall,
      isAnswered,
      isMakeMatch,
      isModelMatch,
      isVariantMatch,
      isWrongConfident,
      isCorrectRejection,
      isFalseAccept,
      latencyMs: out.totalLatencyMs
    });
  }

  // Load raw-resolution baseline for these exact 60 samples
  const rawPredsAll: any[] = JSON.parse(fs.readFileSync('eval/beta_val_predictions.json', 'utf8'));
  const rawPreds35 = new Map<string, any>();
  for (const p of rawPredsAll) {
    if (p.model === modelName) {
      rawPreds35.set(p.sampleId, p);
    }
  }

  // Compute Metrics for Preprocessed 60-image subset
  const inc = predictions.filter(p => p.population === 'in_catalogue');
  const out = predictions.filter(p => p.population !== 'in_catalogue');

  const answered = inc.filter(p => p.isAnswered);
  const answerRate = answered.length / inc.length;
  const answerRateCi = wilsonCi(answered.length, inc.length);

  const modelMatches = answered.filter(p => p.isModelMatch);
  const modelAcc = answered.length ? modelMatches.length / answered.length : 0;
  const modelAccCi = wilsonCi(modelMatches.length, answered.length);

  const answeredWithVar = answered.filter(p => Boolean(p.trueVariant));
  const varMatches = answeredWithVar.filter(p => p.isVariantMatch);
  const varAcc = answeredWithVar.length ? varMatches.length / answeredWithVar.length : 0;

  // Wrong-but-confident breakdown
  const wrongModelConf = inc.filter(p => p.isAnswered && p.predConfidence >= 0.80 && !p.isModelMatch);
  const wrongModelConfRate = wrongModelConf.length / inc.length;
  const wrongModelConfCi = wilsonCi(wrongModelConf.length, inc.length);

  const assertedVar = inc.filter(p => p.isAnswered && Boolean(p.predVariant) && Boolean(p.trueVariant));
  const wrongVarConf = assertedVar.filter(p => p.predConfidence >= 0.80 && !p.isVariantMatch);
  const wrongVarConfRate = wrongVarConf.length / inc.length;

  const correctRej = out.filter(p => p.isCorrectRejection);
  const correctRejRate = correctRej.length / out.length;
  const correctRejCi = wilsonCi(correctRej.length, out.length);

  const falseAccept = out.filter(p => p.isFalseAccept);
  const falseAcceptRate = falseAccept.length / out.length;
  const falseAcceptCi = wilsonCi(falseAccept.length, out.length);

  // Compare matched items with raw baseline
  let rawAnsweredCount = 0;
  let rawModelMatchCount = 0;
  let matchedComparisons = 0;
  let answerMatchesRaw = 0;

  for (const p of inc) {
    const raw = rawPreds35.get(p.sampleId);
    if (raw) {
      matchedComparisons++;
      if (raw.isAnswered) rawAnsweredCount++;
      if (raw.isAnswered && raw.isModelMatch) rawModelMatchCount++;
      if (p.isAnswered === raw.isAnswered && p.predModel === raw.predModel) {
        answerMatchesRaw++;
      }
    }
  }

  const rawAnswerRate = matchedComparisons ? rawAnsweredCount / matchedComparisons : 0;
  const rawModelAcc = rawAnsweredCount ? rawModelMatchCount / rawAnsweredCount : 0;
  const parityConsistency = matchedComparisons ? answerMatchesRaw / matchedComparisons : 0;

  const report = {
    subsetSize: samples.length,
    inCatalogueN: inc.length,
    outOfCatalogueN: out.length,
    preprocessing: '768px, 82% JPEG',
    model: modelName,
    preprocessedMetrics: {
      answerRate: { count: answered.length, rate: answerRate, ci95: answerRateCi },
      modelAccuracy: { count: modelMatches.length, totalAnswered: answered.length, rate: modelAcc, ci95: modelAccCi },
      variantAccuracy: { count: varMatches.length, totalVarAnswered: answeredWithVar.length, rate: varAcc },
      wrongModelConfident: { count: wrongModelConf.length, rate: wrongModelConfRate, ci95: wrongModelConfCi },
      wrongVariantConfident: { count: wrongVarConf.length, rate: wrongVarConfRate },
      correctRejectionRate: { count: correctRej.length, rate: correctRejRate, ci95: correctRejCi },
      falseAcceptRate: { count: falseAccept.length, rate: falseAcceptRate, ci95: falseAcceptCi }
    },
    rawBaselineComparison: {
      matchedComparisons,
      rawAnswerRate,
      preprocessedAnswerRate: answerRate,
      rawModelAcc,
      preprocessedModelAcc: modelAcc,
      exactMatchConsistency: parityConsistency
    },
    timestamp: new Date().toISOString()
  };

  fs.writeFileSync('eval/production_parity_60_metrics.json', JSON.stringify(report, null, 2));
  fs.writeFileSync('eval/production_parity_60_predictions.json', JSON.stringify(predictions, null, 2));

  console.log('\n========================================================================');
  console.log('PRODUCTION PARITY EVALUATION COMPLETE');
  console.log('========================================================================');
  console.log(`Preprocessed Answer Rate: ${(answerRate * 100).toFixed(1)}% (${answered.length}/${inc.length}) [vs Raw Baseline: ${(rawAnswerRate * 100).toFixed(1)}%]`);
  console.log(`Preprocessed Model Accuracy: ${(modelAcc * 100).toFixed(1)}% (${modelMatches.length}/${answered.length}) [vs Raw Baseline: ${(rawModelAcc * 100).toFixed(1)}%]`);
  console.log(`Wrong-but-Confident (Model): ${(wrongModelConfRate * 100).toFixed(1)}% (${wrongModelConf.length}/${inc.length})`);
  console.log(`Out-of-Catalogue Correct Rejection: ${(correctRejRate * 100).toFixed(1)}% (${correctRej.length}/${out.length})`);
  console.log(`Out-of-Catalogue False Accept: ${(falseAcceptRate * 100).toFixed(1)}% (${falseAccept.length}/${out.length})`);
  console.log(`Image-by-Image Parity Consistency: ${(parityConsistency * 100).toFixed(1)}%`);
  console.log('Saved to: eval/production_parity_60_metrics.json and eval/production_parity_60_predictions.json\n');
}

main().catch(err => {
  console.error('Parity evaluation failed:', err);
  process.exit(1);
});
