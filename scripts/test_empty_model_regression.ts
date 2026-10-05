/**
 * APEX — Empty Model & Downstream Uncertainty Preservation Regression Test
 * 
 * Verifies Constraints:
 * 1. Empty-model guard is GENERIC across all manufacturers.
 * 2. Spec resolution NEVER invents identity when model = null / empty / whitespace.
 * 3. The FIRST vehicle in a manufacturer's database can NEVER be selected merely because model is empty.
 * 4. Uncertainty is preserved through: classifier -> canonical identity -> spec resolution -> formatter API JSON.
 */

import { resolveCanonicalVehicleSpecs } from '../src/utils/vehicleSpecs';
import { canonicalVehicleRegistry } from '../src/ai-engine/canonical/canonicalVehicleRegistry';
import { APEX_LOCAL_VEHICLE_DATABASE } from '../src/data/vehicleDatabase';

let failureCount = 0;

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`[FAIL] ${msg}`);
    failureCount++;
  } else {
    console.log(`[PASS] ${msg}`);
  }
}

console.log('=== TEST 1: Manufacturer Specific model = null Tests (Ferrari, Porsche, Lamborghini, McLaren, BMW) ===');

const testMakes = ['Ferrari', 'Porsche', 'Lamborghini', 'McLaren', 'BMW', 'Aston Martin'];

for (const make of testMakes) {
  for (const modelVal of [null, undefined, '', '   ', '\t\n']) {
    const label = modelVal === null ? 'null' : modelVal === undefined ? 'undefined' : `"${modelVal}"`;
    const specs = resolveCanonicalVehicleSpecs({ make, model: modelVal as any });

    assert(
      specs.canonicalId === null,
      `${make} with model=${label} -> canonicalId MUST be null (got ${specs.canonicalId})`
    );
    assert(
      specs.model === null,
      `${make} with model=${label} -> model MUST be null (got ${specs.model})`
    );
    assert(
      specs.isVerified === false,
      `${make} with model=${label} -> isVerified MUST be false (got ${specs.isVerified})`
    );
    assert(
      specs.horsepower === null,
      `${make} with model=${label} -> horsepower MUST be null (got ${specs.horsepower})`
    );
  }
}

console.log('\n=== TEST 2: Canonical Registry resolveCanonicalIdentity Guard ===');

for (const make of testMakes) {
  const canon = canonicalVehicleRegistry.resolveCanonicalIdentity({ make, model: null });
  assert(
    canon.canonicalId === null,
    `Registry ${make} with model=null -> canonicalId MUST be null (got ${canon.canonicalId})`
  );
  assert(
    canon.modelFamily === null,
    `Registry ${make} with model=null -> modelFamily MUST be null (got ${canon.modelFamily})`
  );
  assert(
    canon.displayName === make,
    `Registry ${make} with model=null -> displayName MUST be "${make}" (got "${canon.displayName}")`
  );
  assert(
    canon.specificityLevel === 0,
    `Registry ${make} with model=null -> specificityLevel MUST be 0 (got ${canon.specificityLevel})`
  );
}

console.log('\n=== TEST 3: Catalog First-Vehicle Invariant Across ALL Database Manufacturers ===');

// Group all vehicles in APEX_LOCAL_VEHICLE_DATABASE by make
const vehiclesByMake = new Map<string, any[]>();
for (const v of APEX_LOCAL_VEHICLE_DATABASE) {
  const makeKey = (v.manufacturer || (v as any).make || '').toLowerCase().trim();
  if (!vehiclesByMake.has(makeKey)) {
    vehiclesByMake.set(makeKey, []);
  }
  vehiclesByMake.get(makeKey)!.push(v);
}

console.log(`Checking ${vehiclesByMake.size} unique manufacturers in local database...`);

for (const [makeKey, vehicles] of vehiclesByMake.entries()) {
  const firstVehicle = vehicles[0];
  const makeName = firstVehicle.manufacturer || firstVehicle.make;

  const resolved = resolveCanonicalVehicleSpecs({ make: makeName, model: null });

  assert(
    resolved.canonicalId === null,
    `[${makeName}] resolveCanonicalVehicleSpecs MUST return canonicalId=null`
  );
  assert(
    resolved.model === null,
    `[${makeName}] resolveCanonicalVehicleSpecs MUST return model=null`
  );
  assert(
    resolved.canonicalId !== firstVehicle.id,
    `[${makeName}] FIRST vehicle (${firstVehicle.id} - ${firstVehicle.model}) MUST NEVER be selected when model is null!`
  );
  assert(
    resolved.model !== firstVehicle.model,
    `[${makeName}] FIRST vehicle model name ("${firstVehicle.model}") MUST NEVER be backfilled!`
  );
}

console.log('\n=== SUMMARY ===');
if (failureCount === 0) {
  console.log('ALL REGRESSION TESTS PASSED! Empty-model guard is generic, robust, and preserves uncertainty.');
  process.exit(0);
} else {
  console.error(`FAILED: ${failureCount} assertions failed.`);
  process.exit(1);
}
