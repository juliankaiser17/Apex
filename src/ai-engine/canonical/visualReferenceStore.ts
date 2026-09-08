/**
 * APEX — Visual Reference Store & Vector Candidate Retrieval
 * Performs Top-K (10-30) visual similarity retrieval before AI verification
 */

import type { CandidateVehicle } from '../types';
import { canonicalVehicleRegistry } from './canonicalVehicleRegistry';

export interface VisualFeatureQuery {
  aspectRatio?: number;
  prominentColors?: string[];
  detectedSilhouette?: 'low_slung_coupe' | 'angular_wedge' | 'widebody_supercar' | 'high_rider_suv' | 'grand_tourer';
  rawKeywords?: string[];
  fileName?: string;
}

export class VisualReferenceStore {
  /**
   * Retrieve Top-K candidates using visual features, geometry, and image priors
   */
  public retrieveTopKCandidates(query: VisualFeatureQuery, topK: number = 15): CandidateVehicle[] {
    const allVehicles = canonicalVehicleRegistry.getAll();
    const scoredCandidates: Array<{ vehicle: any; score: number }> = [];

    const normFilename = (query.fileName || '').toLowerCase();
    const queryColors = (query.prominentColors || []).map((c) => c.toLowerCase());

    for (const vehicle of allVehicles) {
      let score = 0.5; // Baseline prior

      // 1. Silhouette matching
      if (query.detectedSilhouette && vehicle.visualFeatures.includes(query.detectedSilhouette)) {
        score += 0.25;
      }

      // 2. Color similarity
      for (const color of queryColors) {
        if (vehicle.visualFeatures.some((f: string) => f.toLowerCase().includes(color))) {
          score += 0.15;
          break;
        }
      }

      // 3. Keyword / filename matching if present
      if (normFilename) {
        if (normFilename.includes(vehicle.make.toLowerCase())) score += 0.3;
        if (normFilename.includes(vehicle.model.toLowerCase())) score += 0.4;
        if (normFilename.includes(vehicle.generation.toLowerCase())) score += 0.25;
      }

      // 4. Raw keyword overlap
      if (query.rawKeywords && query.rawKeywords.length > 0) {
        for (const kw of query.rawKeywords) {
          const normKw = kw.toLowerCase();
          if (
            vehicle.make.toLowerCase().includes(normKw) ||
            vehicle.model.toLowerCase().includes(normKw) ||
            vehicle.aliases.some((a: string) => a.includes(normKw))
          ) {
            score += 0.2;
          }
        }
      }

      scoredCandidates.push({
        vehicle,
        score: Math.min(0.99, Math.max(0.05, score))
      });
    }

    // Sort descending by score
    scoredCandidates.sort((a, b) => b.score - a.score);

    // Take Top-K
    const selected = scoredCandidates.slice(0, Math.max(5, Math.min(30, topK)));

    return selected.map(({ vehicle, score }) => ({
      vehicleId: vehicle.vehicleId,
      make: vehicle.make,
      model: vehicle.model,
      generation: vehicle.generation,
      trim: vehicle.trim,
      bodyStyle: vehicle.bodyStyle,
      yearStart: vehicle.yearStart,
      yearEnd: vehicle.yearEnd,
      visualSimilarityScore: Number(score.toFixed(3)),
      distinguishingFeatures: vehicle.visualFeatures,
      referenceImageUrl: vehicle.referenceImages[0]
    }));
  }
}

export const visualReferenceStore = new VisualReferenceStore();
