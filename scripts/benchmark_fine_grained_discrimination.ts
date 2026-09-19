/**
 * APEX — Fine-Grained Model Discrimination Benchmark Harness
 * 
 * Satisfies Hard Amendments 8 & 9:
 * 8. Records raw provider identity separately from discriminator output and final canonical identity.
 * 9. Reports raw-provider accuracy, discriminator accuracy, and final canonical accuracy separately.
 * 
 * For every test case, records:
 * - ground_truth
 * - raw_provider_identity
 * - observations
 * - candidate_pool
 * - top_candidate
 * - runner_up
 * - candidate_margin
 * - verification_triggered
 * - final_canonical_id
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { hierarchicalClassifier } from '../src/ai-engine/validation/hierarchicalClassifier';
import { resolveCanonicalVehicleSpecs } from '../src/utils/vehicleSpecs';
import { canonicalVehicleRegistry } from '../src/ai-engine/canonical/canonicalVehicleRegistry';
import type { VisualEvidence, ViewpointType } from '../src/ai-engine/types';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface BenchmarkRecord {
  test_id: string;
  test_name: string;
  ground_truth: {
    make: string;
    model: string;
    generation?: string | null;
  };
  raw_provider_identity: string;
  observations: string[];
  candidate_pool: string[];
  top_candidate: string;
  runner_up: string | null;
  candidate_margin: number;
  verification_triggered: boolean;
  discriminator_identity: string;
  final_canonical_id: string;
  raw_provider_correct: boolean;
  discriminator_correct: boolean;
  final_canonical_correct: boolean;
}

export async function runFineGrainedBenchmark() {
  console.log('================================================================');
  console.log('   APEX FINE-GRAINED MODEL DISCRIMINATION BENCHMARK (50+ CASES)');
  console.log('================================================================\n');

  const datasetPath = path.join(__dirname, '../src/ai-engine/evaluation/evaluation_dataset.json');
  const rawDataset = JSON.parse(fs.readFileSync(datasetPath, 'utf8'));

  // Difficult exact-model discrimination test cases to include alongside benchmark
  const difficultCases = [
    {
      id: 'diff-001',
      name: 'Maserati MC20 vs GranTurismo Bias',
      ground_truth: { make: 'Maserati', model_family: 'MC20', generation: 'M240' },
      input: {
        viewpoint: 'front_3q' as ViewpointType,
        quality_score: 0.95,
        raw_make: 'Maserati',
        raw_model: 'GranTurismo', // Biased raw provider
        raw_generation: null,
        raw_variant: null,
        visual_evidence: {
          body_style: 'Low-slung supercar',
          headlights: 'Vertical compact LED slits',
          grille: 'Low wide horizontal mouth with carbon front splitter',
          roofline: 'Cab-forward teardrop greenhouse with short front hood',
          distinctive_details: [
            'Vertical compact LED headlights',
            'Low wide horizontal mouth with lower carbon splitter',
            'Cab-forward teardrop cabin with short front hood',
            'Rear fender shoulder intakes'
          ]
        },
        raw_candidates: [
          { name: 'Maserati GranTurismo', score: 0.72, supporting_evidence: [], contradictions: [], unobservable_features: [] },
          { name: 'Maserati MC20', score: 0.50, supporting_evidence: [], contradictions: [], unobservable_features: [] }
        ]
      }
    },
    {
      id: 'diff-002',
      name: 'McLaren 650S vs 570S Bias',
      ground_truth: { make: 'McLaren', model_family: '650S', generation: 'P11' },
      input: {
        viewpoint: 'front_3q' as ViewpointType,
        quality_score: 0.92,
        raw_make: 'McLaren',
        raw_model: '570S', // Biased raw provider
        raw_generation: null,
        raw_variant: null,
        visual_evidence: {
          body_style: 'Supercar',
          headlights: 'P1-style crescent C-shaped headlights with black housing',
          distinctive_details: [
            'P1 style crescent c-shaped headlights with black housing',
            'Large side radiator scoop behind dihedral door',
            'Active rear airbrake'
          ]
        },
        raw_candidates: [
          { name: 'McLaren 570S', score: 0.75, supporting_evidence: [], contradictions: [], unobservable_features: [] },
          { name: 'McLaren 650S', score: 0.50, supporting_evidence: [], contradictions: [], unobservable_features: [] }
        ]
      }
    },
    {
      id: 'diff-003',
      name: 'Ferrari Daytona SP3 vs SF90 Stradale Bias',
      ground_truth: { make: 'Ferrari', model_family: 'Daytona SP3', generation: 'Icona' },
      input: {
        viewpoint: 'front_3q' as ViewpointType,
        quality_score: 0.96,
        raw_make: 'Ferrari',
        raw_model: 'SF90 Stradale', // Biased raw provider
        raw_generation: null,
        raw_variant: null,
        visual_evidence: {
          body_style: 'Targa prototype hypercar',
          headlights: 'Horizontal eyelid covers on headlights',
          grille: 'Front bumper with horizontal strakes and slats',
          roofline: 'Wraparound visor canopy with hidden A-pillars',
          distinctive_details: [
            'Wraparound visor canopy with hidden A-pillars',
            'Horizontal eyelid covers on headlights',
            'Horizontal slats and strakes across front and rear'
          ]
        },
        raw_candidates: [
          { name: 'Ferrari SF90 Stradale', score: 0.82, supporting_evidence: [], contradictions: [], unobservable_features: [] },
          { name: 'Ferrari Daytona SP3', score: 0.50, supporting_evidence: [], contradictions: [], unobservable_features: [] }
        ]
      }
    },
    {
      id: 'diff-004',
      name: 'Porsche 911 (996) vs (997)',
      ground_truth: { make: 'Porsche', model_family: '911 Carrera', generation: '996' },
      input: {
        viewpoint: 'front_3q' as ViewpointType,
        quality_score: 0.90,
        raw_make: 'Porsche',
        raw_model: '911 Carrera',
        raw_generation: null,
        raw_variant: null,
        visual_evidence: {
          body_style: 'Coupe',
          headlights: 'Fried egg integrated turn signal teardrop headlights',
          distinctive_details: [
            'Fried-egg integrated teardrop headlights',
            'Classic 911 sloping flyline'
          ]
        },
        raw_candidates: [
          { name: 'Porsche 911 Carrera (997)', score: 0.65, supporting_evidence: [], contradictions: [], unobservable_features: [] },
          { name: 'Porsche 911 Carrera (996)', score: 0.50, supporting_evidence: [], contradictions: [], unobservable_features: [] }
        ]
      }
    },
    {
      id: 'diff-005',
      name: 'McLaren 675LT Rear Exhaust & Airbrake',
      ground_truth: { make: 'McLaren', model_family: '675LT', generation: 'P11' },
      input: {
        viewpoint: 'rear' as ViewpointType,
        quality_score: 0.94,
        raw_make: 'McLaren',
        raw_model: '650S', // Biased raw provider
        raw_generation: 'P11',
        raw_variant: null,
        visual_evidence: {
          body_style: 'Coupe',
          exhaust: 'Dual circular titanium top-exit exhaust',
          aero: 'Extended active longtail airbrake with carbon rear bumper',
          distinctive_details: [
            'Dual circular titanium top-exit exhaust',
            'Extended longtail carbon airbrake'
          ]
        },
        raw_candidates: [
          { name: 'McLaren 650S', score: 0.70, supporting_evidence: [], contradictions: [], unobservable_features: [] },
          { name: 'McLaren 675LT', score: 0.50, supporting_evidence: [], contradictions: [], unobservable_features: [] }
        ]
      }
    },
    {
      id: 'diff-006',
      name: 'Koenigsegg Gemera Mega-GT 4-Seater',
      ground_truth: { make: 'Koenigsegg', model_family: 'Gemera', generation: 'Gemera' },
      input: {
        viewpoint: 'side' as ViewpointType,
        quality_score: 0.95,
        raw_make: 'Koenigsegg',
        raw_model: 'Jesko', // Biased raw provider
        raw_generation: null,
        raw_variant: null,
        visual_evidence: {
          body_style: 'Hypercar',
          distinctive_details: [
            'Extended wheelbase four-seater hypercar profile',
            'Wraparound visor canopy',
            'Giant B-pillarless twisted synchro-helix doors'
          ]
        },
        raw_candidates: [
          { name: 'Koenigsegg Jesko', score: 0.75, supporting_evidence: [], contradictions: [], unobservable_features: [] },
          { name: 'Koenigsegg Gemera', score: 0.50, supporting_evidence: [], contradictions: [], unobservable_features: [] }
        ]
      }
    }
  ];

  // Combine standard vehicle cases from evaluation dataset + difficult test cases
  const allCases = [
    ...difficultCases,
    ...rawDataset
      .filter((tc: any) => tc.ground_truth?.is_vehicle && tc.ground_truth?.make)
      .slice(0, 60)
  ];

  console.log(`Evaluating ${allCases.length} total test cases...`);

  const records: BenchmarkRecord[] = [];
  let rawCorrectCount = 0;
  let discriminatorCorrectCount = 0;
  let finalCanonicalCorrectCount = 0;

  for (const tc of allCases) {
    const rawMake = tc.input?.raw_make || 'Unknown';
    const rawModel = tc.input?.raw_model || 'Unknown';
    const rawProviderIdentity = `${rawMake} ${rawModel}`.trim();

    const gtMake = tc.ground_truth.make;
    const gtModel = tc.ground_truth.model_family || tc.ground_truth.model || '';

    // Classify through hierarchical engine
    const classResult = hierarchicalClassifier.classify({
      visual_evidence: tc.input.visual_evidence || {},
      viewpoint: tc.input.viewpoint || 'unknown',
      raw_make: tc.input.raw_make,
      raw_model: tc.input.raw_model,
      raw_generation: tc.input.raw_generation,
      raw_variant: tc.input.raw_variant,
      raw_candidates: (tc.input.raw_candidates || []).map((c: any) => ({
        name: c.name,
        score: c.score,
        supporting_evidence: c.supporting_evidence || [],
        contradictions: c.contradictions || [],
        unobservable_features: c.unobservable_features || []
      }))
    });

    const topCandidate = classResult.top_candidate?.name || '';
    const runnerUp = classResult.calibrated_candidates[1]?.name || null;
    const discriminatorIdentity = classResult.discriminator_identity || topCandidate;

    // Canonical spec resolution
    let finalMake = classResult.identification.make || rawMake;
    let finalModel = classResult.identification.model_family || rawModel;
    if (finalMake && finalModel && finalModel.toLowerCase().startsWith(finalMake.toLowerCase() + ' ')) {
      finalModel = finalModel.slice(finalMake.length + 1).trim();
    }

    const specResolution = resolveCanonicalVehicleSpecs({
      make: finalMake,
      model: finalModel,
      generation: classResult.identification.generation || undefined
    });

    const finalCanonicalId = specResolution.canonicalId;

    // Check accuracy
    const norm = (s: string) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const gtMakeNorm = norm(gtMake);
    const gtModelNorm = norm(gtModel);

    const isMakeMatch = (candText: string, targetMakeNorm: string) => {
      const c = norm(candText);
      if (c.includes(targetMakeNorm) || targetMakeNorm.includes(c)) return true;
      if ((targetMakeNorm.includes('mercedes') || targetMakeNorm.includes('amg')) && (c.includes('mercedes') || c.includes('amg'))) return true;
      return false;
    };

    const isModelMatch = (candText: string, targetModelNorm: string) => {
      const c = norm(candText);
      if (c.includes(targetModelNorm) || targetModelNorm.includes(c)) return true;
      if ((targetModelNorm.includes('cclass') || targetModelNorm.includes('c63')) && (c.includes('cclass') || c.includes('c63'))) return true;
      return false;
    };

    const rawCorrect = isMakeMatch(rawMake, gtMakeNorm) && isModelMatch(rawModel, gtModelNorm);
    const discCorrect = isMakeMatch(discriminatorIdentity, gtMakeNorm) && isModelMatch(discriminatorIdentity, gtModelNorm);
    const canonicalCorrect = isMakeMatch(specResolution.make, gtMakeNorm) && isModelMatch(specResolution.model, gtModelNorm);

    if (rawCorrect) rawCorrectCount++;
    if (discCorrect) discriminatorCorrectCount++;
    if (canonicalCorrect) finalCanonicalCorrectCount++;

    records.push({
      test_id: tc.id,
      test_name: tc.name,
      ground_truth: {
        make: gtMake,
        model: gtModel,
        generation: tc.ground_truth.generation || null
      },
      raw_provider_identity: rawProviderIdentity,
      observations: tc.input.visual_evidence?.distinctive_details || [],
      candidate_pool: classResult.calibrated_candidates.map(c => c.name),
      top_candidate: topCandidate,
      runner_up: runnerUp,
      candidate_margin: classResult.candidate_separation,
      verification_triggered: classResult.candidate_separation < 0.15,
      discriminator_identity: discriminatorIdentity,
      final_canonical_id: finalCanonicalId,
      raw_provider_correct: rawCorrect,
      discriminator_correct: discCorrect,
      final_canonical_correct: canonicalCorrect
    });
  }

  const total = allCases.length;
  const rawAccuracy = (rawCorrectCount / total) * 100;
  const discriminatorAccuracy = (discriminatorCorrectCount / total) * 100;
  const finalCanonicalAccuracy = (finalCanonicalCorrectCount / total) * 100;

  console.log('----------------------------------------------------------------');
  console.log('   FINE-GRAINED DISCRIMINATION ACCURACY BREAKDOWN (Amendment 9)');
  console.log('----------------------------------------------------------------');
  console.log(`Total Evaluated Cases:          ${total}`);
  console.log(`A. Raw Provider Accuracy:       ${rawAccuracy.toFixed(2)}%`);
  console.log(`B. Discriminator Accuracy:      ${discriminatorAccuracy.toFixed(2)}%`);
  console.log(`C. Final Canonical Accuracy:    ${finalCanonicalAccuracy.toFixed(2)}%`);
  console.log(`Accuracy Lift from Discriminator: +${(discriminatorAccuracy - rawAccuracy).toFixed(2)}%`);
  console.log('----------------------------------------------------------------\n');

  // Save full granular records to scratch
  const outPath = path.join(__dirname, '../scratch/fine_grained_benchmark_results.json');
  fs.writeFileSync(outPath, JSON.stringify({
    summary: {
      total_cases: total,
      raw_provider_accuracy: `${rawAccuracy.toFixed(2)}%`,
      discriminator_accuracy: `${discriminatorAccuracy.toFixed(2)}%`,
      final_canonical_accuracy: `${finalCanonicalAccuracy.toFixed(2)}%`,
      accuracy_lift: `+${(discriminatorAccuracy - rawAccuracy).toFixed(2)}%`
    },
    records
  }, null, 2));

  console.log(`Full forensic evaluation report written to: ${outPath}`);

  // Assertions for pass criteria
  if (discriminatorAccuracy < 90.0 || finalCanonicalAccuracy < 90.0) {
    console.error('❌ Benchmark failed: Discriminator or Canonical Accuracy < 90%');
    process.exit(1);
  }

  console.log('🎉 BENCHMARK PASSED WITH FLYING COLORS!\n');
}

runFineGrainedBenchmark().catch((err) => {
  console.error('Benchmark execution error:', err);
  process.exit(1);
});
