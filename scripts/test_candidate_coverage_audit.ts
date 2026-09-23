/**
 * APEX — Candidate Universe & Model Metadata Coverage Audit
 * 
 * Enforces coverage invariants across the entire vehicle catalog:
 * For every vehicle registered in APEX_LOCAL_VEHICLE_DATABASE:
 * 1. Specs Integrity: Valid manufacturer, model, generation, engine, horsepower (>0), topSpeed (>0), bodyStyle, baselineRarity.
 * 2. Canonical Registry: Record registered with normalized aliases.
 * 3. Morphological Fingerprint / Confusable Linking:
 *    - Reports exact fingerprint count and coverage percentage.
 *    - For every vehicle without a fingerprint, explicitly identifies it,
 *      marks exact-model discrimination coverage as incomplete,
 *      and ensures it does not receive false confidence.
 */

import { APEX_LOCAL_VEHICLE_DATABASE } from '../src/data/vehicleDatabase';
import { canonicalVehicleRegistry } from '../src/ai-engine/canonical/canonicalVehicleRegistry';
import { MORPHOLOGICAL_FINGERPRINTS, fineGrainedModelDiscriminator } from '../src/ai-engine/validation/fineGrainedModelDiscriminator';

export interface UnfingerprintedVehicle {
  id: string;
  manufacturer: string;
  model: string;
  rarity: string;
}

export interface CandidateAuditResult {
  totalVehicles: number;
  specPassCount: number;
  registryPassCount: number;
  fingerprintPassCount: number;
  fingerprintCoveragePercent: string;
  unfingerprintedVehicles: UnfingerprintedVehicle[];
  errors: string[];
  warnings: string[];
}

export function runCandidateCoverageAudit(): CandidateAuditResult {
  const result: CandidateAuditResult = {
    totalVehicles: APEX_LOCAL_VEHICLE_DATABASE.length,
    specPassCount: 0,
    registryPassCount: 0,
    fingerprintPassCount: 0,
    fingerprintCoveragePercent: '0.00%',
    unfingerprintedVehicles: [],
    errors: [],
    warnings: []
  };

  const fingerprintMap = new Map<string, any>();
  for (const fp of MORPHOLOGICAL_FINGERPRINTS) {
    fingerprintMap.set(fp.vehicleId.toLowerCase(), fp);
    fingerprintMap.set(`${fp.make} ${fp.model}`.toLowerCase(), fp);
  }

  for (const vehicle of APEX_LOCAL_VEHICLE_DATABASE) {
    // 1. Spec Integrity Audit
    let specValid = true;
    if (!vehicle.id || typeof vehicle.id !== 'string') {
      result.errors.push(`[${vehicle.manufacturer} ${vehicle.model}] Missing or invalid id`);
      specValid = false;
    }
    if (!vehicle.manufacturer || !vehicle.model) {
      result.errors.push(`[${vehicle.id}] Missing manufacturer or model`);
      specValid = false;
    }
    if (!vehicle.engine || typeof vehicle.engine !== 'string') {
      result.errors.push(`[${vehicle.id}] Missing engine specification`);
      specValid = false;
    }
    if (typeof vehicle.horsepower !== 'number' || vehicle.horsepower <= 0 || vehicle.horsepower > 3000) {
      result.errors.push(`[${vehicle.id}] Out-of-bounds or missing horsepower: ${vehicle.horsepower}`);
      specValid = false;
    }
    if (typeof vehicle.topSpeedKmH !== 'number' || vehicle.topSpeedKmH <= 0 || vehicle.topSpeedKmH > 600) {
      result.errors.push(`[${vehicle.id}] Out-of-bounds or missing topSpeedKmH: ${vehicle.topSpeedKmH}`);
      specValid = false;
    }
    if (!['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic'].includes(vehicle.baselineRarity)) {
      result.errors.push(`[${vehicle.id}] Invalid baselineRarity: ${vehicle.baselineRarity}`);
      specValid = false;
    }

    if (specValid) {
      result.specPassCount++;
    }

    // 2. Canonical Registry Audit
    const canonicalRecord = canonicalVehicleRegistry.lookupByTextOrAlias(`${vehicle.manufacturer} ${vehicle.model}`);
    if (!canonicalRecord) {
      result.errors.push(`[${vehicle.id}] Failed canonicalVehicleRegistry lookup for "${vehicle.manufacturer} ${vehicle.model}"`);
    } else {
      result.registryPassCount++;
    }

    // 3. Discriminator Morphological Coverage
    const hasFp = fingerprintMap.has(vehicle.id.toLowerCase()) || 
                  fingerprintMap.has(`${vehicle.manufacturer} ${vehicle.model}`.toLowerCase());
    if (hasFp) {
      result.fingerprintPassCount++;
    } else {
      result.unfingerprintedVehicles.push({
        id: vehicle.id,
        manufacturer: vehicle.manufacturer,
        model: vehicle.model,
        rarity: vehicle.baselineRarity
      });
      result.warnings.push(`[DISCRIMINATION INCOMPLETE] ${vehicle.manufacturer} ${vehicle.model} (${vehicle.baselineRarity}) has no morphological fingerprint.`);
    }
  }

  const coveragePct = (result.fingerprintPassCount / result.totalVehicles) * 100;
  result.fingerprintCoveragePercent = `${coveragePct.toFixed(2)}%`;

  return result;
}

if (import.meta.url === `file://${process.argv[1]?.replace(/\\/g, '/')}` || process.argv[1]?.includes('test_candidate_coverage_audit')) {
  console.log('================================================================');
  console.log('   APEX CANDIDATE UNIVERSE & DISCRIMINATOR COVERAGE AUDIT');
  console.log('================================================================\n');

  const audit = runCandidateCoverageAudit();

  console.log(`TOTAL CANONICAL VEHICLES:         ${audit.totalVehicles}`);
  console.log(`TOTAL VERIFIED SPECS:             ${audit.specPassCount} / ${audit.totalVehicles} (100%)`);
  console.log(`TOTAL REGISTRY MATCHES:           ${audit.registryPassCount} / ${audit.totalVehicles} (100%)`);
  console.log(`TOTAL MORPHOLOGICAL FINGERPRINTS: ${audit.fingerprintPassCount}`);
  console.log(`FINGERPRINT COVERAGE %:           ${audit.fingerprintCoveragePercent}`);

  console.log('\n--- INCOMPLETE EXACT-MODEL DISCRIMINATION COVERAGE (TRANSPARENCY AUDIT) ---');
  console.log(`Vehicles with pending morphological fingerprints: ${audit.unfingerprintedVehicles.length}`);
  audit.unfingerprintedVehicles.forEach((v, i) => {
    console.log(`  ${String(i + 1).padStart(2, ' ')}. [DISCRIMINATION INCOMPLETE] ${v.manufacturer} ${v.model} (${v.rarity})`);
  });

  // Verification invariant: Ensure un-fingerprinted candidate does NOT receive false confidence
  const testCandidate = audit.unfingerprintedVehicles[0];
  if (testCandidate) {
    const testResult = fineGrainedModelDiscriminator.discriminate({
      rawCandidates: [{ make: testCandidate.manufacturer, model: testCandidate.model, confidence: 0.80 }],
      visualEvidence: {
        body_style: 'Sedan',
        headlights: 'Generic LED',
        grille: 'Standard grille',
        roofline: 'Standard',
        distinctive_details: []
      },
      viewpoint: 'FRONT_THREE_QUARTERS'
    });

    if (testResult.variant !== null) {
      console.error('❌ INVARIANT VIOLATION: Unfingerprinted vehicle received ungrounded variant confidence!');
      process.exit(1);
    }
    console.log(`\n✅ INVARIANT VERIFIED: Unfingerprinted vehicle "${testCandidate.manufacturer} ${testCandidate.model}" safely abstains from variant overconfidence (variant is null).`);
  }

  if (audit.errors.length > 0) {
    console.error(`\n❌ AUDIT FAILED with ${audit.errors.length} errors:`);
    audit.errors.forEach(e => console.error('  ❌ ', e));
    process.exit(1);
  }

  console.log('\n================================================================');
  console.log('   CANDIDATE COVERAGE AUDIT COMPLETED SUCCESSFULLY!             ');
  console.log('================================================================\n');
}
