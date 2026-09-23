/**
 * APEX — Registry Namespace, Confusable Graph, and Vision-Prompt Invariants
 *
 * Permanent guards for the three generalized defect classes that were proven to cause
 * cross-brand and same-manufacturer exact-model failures in production:
 *
 * INVARIANT A — ALIAS NAMESPACE DISJOINTNESS
 *   A canonical record's own model name must never be hijacked by a sibling record's aliases.
 *   (Proven defect: "Porsche 911 Turbo S" resolved to porsche-911-turbo.)
 *
 * INVARIANT B — CONFUSABLE GRAPH INTEGRITY
 *   Every confusableWith edge resolves to a registered record of the same manufacturer and is
 *   reciprocated. No orphaned or one-way edges.
 *
 * INVARIANT C — NO PROMPT INHERITANCE
 *   The vision provider prompt must not contain model-specific morphological vocabulary that the
 *   VLM can echo back onto an unrelated car. (Proven defect: enumerating "horizontal strakes /
 *   headlight eyelids / wraparound visor canopy" made every photograph — including a Toyota Camry
 *   and a Porsche 911 — report Daytona SP3 morphology, which the discriminator then scored as
 *   decisive Ferrari Daytona SP3 evidence.)
 *
 * INVARIANT D — GENERIC VOCABULARY CANNOT LOCK A MANUFACTURER
 *   A generic active-aero/body phrase must never hard-lock a manufacturer and exclude the true make.
 */

import fs from 'fs';
import { canonicalVehicleRegistry } from '../src/ai-engine/canonical/canonicalVehicleRegistry';
import { APEX_LOCAL_VEHICLE_DATABASE } from '../src/data/vehicleDatabase';
import {
  fineGrainedModelDiscriminator,
  MORPHOLOGICAL_FINGERPRINTS,
  buildZonedEvidence,
} from '../src/ai-engine/validation/fineGrainedModelDiscriminator';
import { hierarchicalClassifier } from '../src/ai-engine/validation/hierarchicalClassifier';
import type { VisualEvidence } from '../src/ai-engine/types';

let failures = 0;
function assert(cond: boolean, msg: string) {
  if (cond) {
    console.log(`✅ PASS: ${msg}`);
  } else {
    console.error(`❌ FAIL: ${msg}`);
    failures++;
  }
}

console.log('================================================================');
console.log('  APEX REGISTRY / GRAPH / PROMPT INVARIANTS');
console.log('================================================================\n');

// ─────────────────────────────────────────────────────────────────────────────
// INVARIANT A: alias namespace disjointness (self-resolution must be exact)
// ─────────────────────────────────────────────────────────────────────────────
console.log('--- INVARIANT A: Alias Namespace Disjointness ---');
{
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

  for (const v of APEX_LOCAL_VEHICLE_DATABASE) {
    const found = canonicalVehicleRegistry.lookupByTextOrAlias(`${v.manufacturer} ${v.model}`, v.manufacturer);
    if (!found) {
      assert(false, `"${v.manufacturer} ${v.model}" resolves (expected ${v.id})`);
      continue;
    }
    // A bare model name may legitimately promote to a different GENERATION of the same model,
    // and to a different body style of the same model. It must never resolve to a different MODEL.
    const sameFamily = norm(found.model) === norm(v.model)
      || norm(found.model).startsWith(norm(v.model))
      || norm(v.model).startsWith(norm(found.model));
    if (!sameFamily) {
      assert(false, `"${v.manufacturer} ${v.model}" resolved to a DIFFERENT MODEL: ${found.vehicleId} ("${found.model}")`);
    }
  }
  assert(true, 'No canonical record is hijacked by an unrelated sibling model name');

  // Explicit regression for the proven defect.
  const turboS = canonicalVehicleRegistry.lookupByTextOrAlias('Porsche 911 Turbo S', 'Porsche');
  assert(turboS?.vehicleId === 'porsche-911-turbo-s-992', `"Porsche 911 Turbo S" -> porsche-911-turbo-s-992 (got ${turboS?.vehicleId})`);
  const turbo = canonicalVehicleRegistry.lookupByTextOrAlias('Porsche 911 Turbo', 'Porsche');
  assert(turbo?.vehicleId === 'porsche-911-turbo', `"Porsche 911 Turbo" -> porsche-911-turbo (got ${turbo?.vehicleId})`);
  assert(turboS?.vehicleId !== turbo?.vehicleId, '911 Turbo and 911 Turbo S remain distinct canonical identities');
}

// ─────────────────────────────────────────────────────────────────────────────
// INVARIANT B: confusable graph integrity (rejects orphaned references)
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n--- INVARIANT B: Confusable Graph Integrity ---');
{
  const graph = fineGrainedModelDiscriminator.validateConfusableGraph();
  assert(graph.valid, `Confusable graph is valid with zero orphaned/one-way edges (errors: ${graph.errors.length})`);
  graph.errors.forEach((e) => console.error('    ' + e));

  const ids = new Set(MORPHOLOGICAL_FINGERPRINTS.map((f) => f.vehicleId));
  let orphans = 0;
  for (const fp of MORPHOLOGICAL_FINGERPRINTS) {
    for (const peer of fp.confusableWith || []) {
      if (!ids.has(peer)) orphans++;
    }
  }
  assert(orphans === 0, `Zero orphaned confusable references across ${MORPHOLOGICAL_FINGERPRINTS.length} fingerprints`);
}

// ─────────────────────────────────────────────────────────────────────────────
// INVARIANT C: no prompt inheritance
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n--- INVARIANT C: Vision Prompt Contains No Model-Specific Vocabulary ---');
{
  const src = fs.readFileSync('src/ai-engine/providers/cloudflareVisionProvider.ts', 'utf8');

  // Extract the prompt string literals only (the two perception prompts).
  const promptStart = src.indexOf('APEX EVIDENTIARY VEHICLE PERCEPTION PROMPTS');
  const promptEnd = src.indexOf('const format = request.options?.format');
  const promptRegion = src.slice(promptStart, promptEnd > promptStart ? promptEnd : promptStart + 8000);

  // Vocabulary that belongs to specific model fingerprints and must never be planted in the prompt.
  const forbidden = [
    'wraparound visor',
    'visor canopy',
    'eyelid',
    'partial covers',
    'horizontal strakes',
    'horizontal slats',
    'swan',
    'nostril',
    'crescent',
    'teardrop',
    'flyline',
    'airbrake',
    'longtail',
    'flying buttress',
    'dihedral',
    'panamericana',
    'kidney grille',
    'mustache'
  ];

  for (const term of forbidden) {
    const present = promptRegion.toLowerCase().includes(term);
    assert(!present, `Prompt does not contain model-specific vocabulary "${term}"`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// INVARIANT D: generic vocabulary cannot lock a manufacturer
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n--- INVARIANT D: Generic Vocabulary Cannot Lock a Manufacturer ---');
{
  // A Porsche photographed from the front, where the only "exotic" sounding phrasing is the generic
  // active-aero vocabulary that previously locked Ferrari and discarded every Porsche candidate.
  const evidence: VisualEvidence = {
    body_style: 'two-door sports coupe',
    grille: 'horizontal strakes across the lower bumper',
    headlights: 'LED lamps with horizontal partial covers',
    roofline: 'wraparound visor greenhouse',
    aero: 'horizontal louvers and a large rear wing',
    badges: 'Porsche crest on the bonnet',
    distinctive_details: ['horizontal strakes', 'horizontal partial covers', 'wraparound visor greenhouse'],
  };

  const result = hierarchicalClassifier.classify({
    visual_evidence: evidence,
    viewpoint: 'front_3q',
    raw_make: 'Porsche',
    raw_model: '911 GT3 RS',
    raw_generation: '992',
    raw_variant: null,
    raw_candidates: [
      { name: 'Porsche 911 GT3 RS', score: 0.88, supporting_evidence: [], contradictions: [] },
      { name: 'Ferrari Daytona SP3', score: 0.50, supporting_evidence: [], contradictions: [] },
    ],
  });

  assert(result.identification.make === 'Porsche', `Manufacturer remains Porsche (got ${result.identification.make})`);
  assert(
    (result.canonical_vehicle_id || '').startsWith('porsche-'),
    `Final canonical identity is a Porsche (got ${result.canonical_vehicle_id})`
  );

  const ferrariCandidate = result.calibrated_candidates.find((c) => c.name.includes('Daytona'));
  assert(
    Boolean(ferrariCandidate?.invalid) || (ferrariCandidate?.score ?? 1) < 0.5,
    'Ferrari Daytona SP3 candidate is excluded/demoted when only generic vocabulary is present'
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// INVARIANT E: field-aware / semantic evidence routing
//   A rear-lamp description must never satisfy a front-lamp fingerprint.
//   Evidence below is the verbatim field payload captured from the LIVE provider on the authentic
//   Ferrari SF90 Stradale photograph REAL_BLIND_000410, which previously resolved to 458 Spider
//   because "Rear: two vertical LED strips" matched the 458's FRONT headlight trait.
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n--- INVARIANT E: Rear Evidence Cannot Satisfy A Front Trait ---');
{
  const captured: VisualEvidence = {
    body_style: 'Two-door, two-seat, convertible sports car with a sloping hood and a short rear deck.',
    grille: 'Front: A large, horizontal grille with a mesh pattern. Rear: A small, vertical opening behind the license plate.',
    headlights: 'Front: Two horizontal LED strips on either side of the grille. Rear: Two vertical LED strips on either side of the license plate.',
    taillights: 'Front: Two horizontal LED strips on either side of the grille. Rear: Two vertical LED strips on either side of the license plate.',
    aero: 'A distinctive, angular rear spoiler.',
    body_proportions: 'Two-door, two-seat, convertible sports car with a sloping hood and a short rear deck.',
    distinctive_details: [
      'Front: Two horizontal LED strips on either side of the grille. Rear: Two vertical LED strips on either side of the license plate.',
      'A prominent, curved air intake on the front bumper.',
      'A distinctive, angular rear spoiler.',
    ],
  };

  // Routing unit check: the rear clause must be excluded from a front trait's eligible evidence.
  const zoned = buildZonedEvidence([captured.headlights!]);
  assert(
    !zoned.forCategory('headlight_shape').includes('vertical led strips'),
    'Rear lamp clause is excluded from headlight_shape eligible evidence'
  );
  assert(
    zoned.forCategory('rear_architecture_and_exhaust').includes('vertical led strips'),
    'Rear lamp clause remains available to rear traits'
  );
  assert(
    zoned.forCategory('roofline_greenhouse').includes('vertical led strips'),
    'Ambiguous/proportional traits retain full evidence (no over-restriction)'
  );

  const result = fineGrainedModelDiscriminator.discriminate({
    visualEvidence: captured,
    viewpoint: 'front_3q',
    candidates: [{ name: 'Ferrari 458 Spider', score: 0.85 }],
    fallbackMake: 'Ferrari',
    fallbackModel: 'SF90 Stradale',
  });

  const f458 = result.scoredCandidates.find((c) => c.vehicleId === 'ferrari-458-spider');
  const headlightEval = f458?.evaluations.find((e) => e.category === 'headlight_shape');
  assert(
    !(headlightEval?.matched),
    `Ferrari 458 Spider headlight_shape is NOT satisfied by rear-lamp text (got matched=${headlightEval?.matched})`
  );
  assert(
    !(f458?.supportingEvidence || []).some((s) => s.includes('headlight shape')),
    'Ferrari 458 Spider gains no supporting evidence from headlight shape on this photograph'
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// INVARIANT — FAMILY-SHARED ARCHITECTURE CANNOT MANUFACTURE MODEL-SPECIFIC EVIDENCE
// The 488 GTB shares the S-duct hood channel and swept projector lamps with the 488 Pista.
// Sibling-family wording may support the candidate, but must never register as model-SPECIFIC
// separation (the 000389 live failure class: a base 488 GTB photo becoming "488 Pista").
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n--- INVARIANT: Family-Shared Architecture Cannot Manufacture Model-Specific Evidence ---');
{
  const { fineGrainedModelDiscriminator } = await import('../src/ai-engine/validation/fineGrainedModelDiscriminator');
  const evidence = {
    body_style: 'low, wide, and sleek mid-engine berlinetta',
    headlights: 'thin, horizontal headlamps',
    hood: 'front hood S-duct air channel',
    grille: 'wide lower mesh mouth',
  } as any;
  const fg = fineGrainedModelDiscriminator.discriminate({
    visualEvidence: evidence,
    viewpoint: 'front_3q' as const,
    candidates: [
      { name: 'Ferrari 488 GTB', score: 0.9 },
      { name: 'Ferrari 488 Pista', score: 0.5 },
    ],
    fallbackMake: 'Ferrari',
    fallbackModel: '488 GTB',
  });
  const pista = fg.scoredCandidates.find((c) => c.vehicleId === 'ferrari-488-pista');
  const sDuctEval = pista?.evaluations.find((e) => e.category === 'front_intake_grille');
  if (sDuctEval && sDuctEval.matched) {
    assert(
      sDuctEval.scoreDelta <= 0.05 + 1e-9,
      `Pista S-duct match on family-shared wording is generic-weight (got d=${sDuctEval.scoreDelta})`
    );
  }
  assert(
    (pista?.specificEvidenceCount ?? 0) === 0,
    `488 Pista gains ZERO model-specific evidence from family-shared 488 GTB wording (got spec=${pista?.specificEvidenceCount})`
  );
}

console.log('\n================================================================');
if (failures > 0) {
  console.error(`❌ ${failures} INVARIANT FAILURE(S)`);
  process.exit(1);
}
console.log('  ✅ ALL REGISTRY / GRAPH / PROMPT INVARIANTS HOLD');
console.log('================================================================\n');
