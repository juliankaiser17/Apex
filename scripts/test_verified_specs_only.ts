/**
 * APEX — Functional Audit Regression: Verified Specs Only
 * 
 * Verifies that:
 * 1. Specs for uncatalogued or unknown vehicles are never hallucinated from model output.
 * 2. Unverified values strictly resolve to null / undefined / 'Unavailable'.
 * 3. Verified registry matches retain accurate engineering numbers.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { resolveCanonicalVehicleSpecs } from '../src/utils/vehicleSpecs';

describe('Track F Item 8: Verified Specs Only Invariant', () => {
  it('resolves uncatalogued vehicles to isVerified: false and all specs as null', () => {
    const unverified = resolveCanonicalVehicleSpecs({
      make: 'UncataloguedMaker',
      model: 'FantasyCoupe',
      generation: 'G1',
      trim: 'Turbo'
    });

    assert.strictEqual(unverified.isVerified, false, 'Uncatalogued vehicle must be marked isVerified: false');
    assert.strictEqual(unverified.horsepower, null, 'Unverified horsepower must be null');
    assert.strictEqual(unverified.topSpeedKmH, null, 'Unverified topSpeed must be null');
    assert.strictEqual(unverified.torqueNm, null, 'Unverified torque must be null');
    assert.strictEqual(unverified.zeroToHundredSec, null, 'Unverified acceleration must be null');
    assert.strictEqual(unverified.kerbWeightKg, null, 'Unverified weight must be null');
    assert.strictEqual(unverified.productionYears, 'N/A');
  });

  it('resolves verified registry vehicle with exact verified engineering specs', () => {
    const verified = resolveCanonicalVehicleSpecs({
      make: 'Porsche',
      model: '911 GT3 RS',
      canonicalVehicleId: 'porsche-911-gt3-rs-992'
    });

    assert.strictEqual(verified.isVerified, true, 'Porsche 911 GT3 RS must resolve as verified');
    assert.strictEqual(verified.horsepower, 518, 'Horsepower must match verified registry (518 hp)');
    assert.strictEqual(verified.topSpeedKmH, 296, 'Top speed must match verified registry (296 km/h)');
    assert.strictEqual(verified.zeroToHundredSec, 3.2, '0-100 must match verified registry (3.2 s)');
    assert.strictEqual(verified.kerbWeightKg, 1450, 'Weight must match verified registry (1450 kg)');
  });

  it('rejects empty or whitespace models without hallucinating default specs', () => {
    const emptyModel = resolveCanonicalVehicleSpecs({
      make: 'Ferrari',
      model: '   '
    });

    assert.strictEqual(emptyModel.isVerified, false);
    assert.strictEqual(emptyModel.horsepower, null);
    assert.strictEqual(emptyModel.engine, 'Verified Specs Unavailable');
  });
});
