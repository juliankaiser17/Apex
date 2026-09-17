/**
 * APEX — Local Fallback AI Provider
 * 
 * When external AI vision providers are unavailable or throttled, this provider
 * returns an explicit, calibrated abstention.
 * 
 * CRITICAL INVARIANT:
 * NEVER manufactures a specific vehicle identity (e.g. Porsche 911 GT3 RS)
 * merely because the primary provider is unavailable or candidates are provided.
 */

import type { AIProvider, AIProviderRequest, AIProviderResponse } from './types';
import type { CanonicalScanResult, ModelIdentificationOutput } from '../types';

export class MockFallbackProvider implements AIProvider {
  public name = 'ApexFallbackEngine';

  public async isAvailable(): Promise<boolean> {
    return true;
  }

  public async identify(_request: AIProviderRequest): Promise<AIProviderResponse> {
    const startTime = Date.now();

    // Explicit abstention: no genuine local optical model is currently loaded.
    // We strictly refuse to guess or default to any registry vehicle.
    const output: ModelIdentificationOutput = {
      vehicleId: null,
      make: 'Unknown Make',
      model: 'Unknown Model',
      generation: 'Unknown',
      trim: null,
      yearEstimate: 'Unknown',
      color: 'Unknown',
      rarity: 'common',
      engine: 'Unknown Engine',
      horsepower: 0,
      torqueNm: 0,
      topSpeedKmH: 0,
      zeroToHundredSec: 0,
      kerbWeightKg: 0,
      productionYears: 'Unknown',
      originCountry: 'Unknown',
      bodyStyle: 'Coupe',
      historicalInformation: 'Vision provider unavailable. Explicit abstention enforced.',
      interestingFacts: '',
      aftermarketPartsDetected: [],
      modelConfidence: 0.0,
      evidence: [],
      alternatives: [],
      needsReview: true,
      abstentionReason: 'vision_provider_unavailable'
    };

    const canonicalResult: CanonicalScanResult = {
      status: 'uncertain',
      vehicle_present: true,
      image_quality: {
        usable: true,
        score: 0.75,
        issues: ['Primary vision provider unavailable; optical evidence could not be extracted.']
      },
      viewpoint: 'unknown',
      visual_evidence: {
        body_style: null,
        grille: null,
        headlights: null,
        taillights: null,
        hood: null,
        roofline: null,
        windows: null,
        wheels: null,
        exhaust: null,
        aero: null,
        badges: null,
        text: null,
        body_proportions: null,
        distinctive_details: []
      },
      identification: {
        make: null,
        model_family: null,
        generation: null,
        variant: null
      },
      confidence: {
        make_score: 0,
        model_score: 0,
        generation_score: 0,
        variant_score: 0,
        overall_score: 0
      },
      candidates: [],
      contradictions: ['Cloud vision provider is unavailable and no local optical vision model is active.'],
      specificity_level: 'make',
      reason: 'vision_provider_unavailable',
      needs_retake: false,
      needs_review: true
    };

    return {
      success: true,
      output,
      canonicalResult,
      providerName: this.name,
      modelUsed: 'apex-local-embedded',
      tokensConsumed: { promptTokens: 0, outputTokens: 0, totalTokens: 0 },
      durationMs: Date.now() - startTime
    };
  }
}
