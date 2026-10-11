/**
 * APEX v2 — Stage D: Evidence Fusion & Statistical Calibration Engine
 * 
 * Functions:
 * 1. Fuses signals: Retrieval Score + VLM Adjudication + Legible Badge Text + Viewpoint.
 * 2. Discriminator as Veto Verifier: Checks hard architectural contradictions (e.g.
 *    fixed roof on open-top spider) to VETO invalid candidates, without blocking
 *    unfingerprinted models.
 * 3. Statistical Confidence Calibration: Calibrated per hierarchy level:
 *    Make, Model Family, Generation, Variant.
 */

import type { CalibratedConfidence, GalleryCandidate, RetrievalResult, VlmAdjudicationOutput } from './types';
import type { ViewpointType } from '../types';

export interface FusionInput {
  retrieval: RetrievalResult;
  adjudication?: VlmAdjudicationOutput;
  observableCues?: string[];
  viewpoint: ViewpointType;
  rawMakeHint?: string | null;
  rawModelHint?: string | null;
}

export interface FusedCandidate {
  candidate: GalleryCandidate;
  fusedScore: number;
  isVetoed: boolean;
  vetoReason?: string;
  supportingCues: string[];
}

export class EvidenceFusionEngine {
  private temperature = 1.25; // Temperature scaling factor calibrated on validation split

  /**
   * Applies temperature scaling to raw probability logit
   */
  private calibrateProbability(rawScore: number, temp = this.temperature): number {
    const clamped = Math.max(0.01, Math.min(0.99, rawScore));
    // Logit transform -> scale by temperature -> sigmoid transform
    const logit = Math.log(clamped / (1.0 - clamped));
    const calibrated = 1.0 / (1.0 + Math.exp(-logit / temp));
    return Number(calibrated.toFixed(3));
  }

  /**
   * Evaluates discriminator rules strictly as an adversarial veto
   */
  private checkArchitecturalVeto(
    candidate: GalleryCandidate,
    cues: string[] = []
  ): { isVetoed: boolean; reason?: string } {
    const textBlob = cues.join(' ').toLowerCase();
    const candName = candidate.displayName.toLowerCase();

    // 1. Roof Architecture Veto: Spider vs Coupe
    const isSpiderCandidate = /\b(spider|spyder|cabriolet|convertible|roadster)\b/i.test(candName);
    const hasFixedCoupeCue = /\b(fixed\s+(?:hardtop|roof|coupe)|full\s+glass\s+bonnet|coupe\s+flyline)\b/i.test(textBlob);
    const hasOpenTopCue = /\b(open\s*top|retractable\s+hardtop|tonneau|twin\s+buttress|targa)\b/i.test(textBlob);

    if (isSpiderCandidate && hasFixedCoupeCue && !hasOpenTopCue) {
      return {
        isVetoed: true,
        reason: `Architectural Contradiction: Fixed-roof coupe features directly contradict convertible/spider candidate ${candidate.displayName}`
      };
    }
    if (!isSpiderCandidate && hasOpenTopCue && !hasFixedCoupeCue) {
      return {
        isVetoed: true,
        reason: `Architectural Contradiction: Open-top roadster buttresses contradict fixed-roof coupe candidate ${candidate.displayName}`
      };
    }

    // 2. Track Aero Veto: GT3 / STO / Speciale vs Base Carrera / Huracán
    const isTrackSpec = /\b(gt3|sto|speciale|pista|675lt|csl)\b/i.test(candName);
    const hasCleanAero = /\b(clean\s+factory|no\s+rear\s+wing|smooth\s+bumper)\b/i.test(textBlob);
    const hasMassiveWing = /\b(massive\s+(?:rear\s+)?wing|swan-neck|extreme\s+track\s+aero|s-duct)\b/i.test(textBlob);

    if (isTrackSpec && hasCleanAero && !hasMassiveWing) {
      return {
        isVetoed: true,
        reason: `Aero Contradiction: Lack of high-downforce aero contradicts track variant ${candidate.displayName}`
      };
    }

    return { isVetoed: false };
  }

  /**
   * Fuse signals and calibrate confidence scores
   */
  public fuse(input: FusionInput): {
    rankedCandidates: FusedCandidate[];
    winningCandidate: FusedCandidate | null;
    calibratedConfidence: CalibratedConfidence;
    isVetoed: boolean;
  } {
    const { retrieval, adjudication, observableCues = [] } = input;
    const candidates = retrieval.topCandidates;

    if (!candidates || candidates.length === 0) {
      return {
        rankedCandidates: [],
        winningCandidate: null,
        calibratedConfidence: { make: 0.0, model: 0.0, generation: 0.0, variant: 0.0, overall: 0.0 },
        isVetoed: false
      };
    }

    const fusedList: FusedCandidate[] = [];

    for (const cand of candidates) {
      let score = cand.similarityScore;

      // 1. VLM Adjudication agreement bonus
      if (adjudication && adjudication.chosenCandidateId === cand.canonicalId) {
        score += 0.15;
      }

      // 2. Legible badge text agreement bonus
      if (adjudication?.legibleBadgeText) {
        const badgeLower = adjudication.legibleBadgeText.toLowerCase();
        if (cand.displayName.toLowerCase().includes(badgeLower) || (cand.variant && cand.variant.toLowerCase() === badgeLower)) {
          score += 0.20;
        }
      }

      // 3. Discriminator Architectural Veto Check
      const veto = this.checkArchitecturalVeto(cand, observableCues);
      if (veto.isVetoed) {
        score = 0.05; // Demoted to non-viable
      }

      const rawScore = veto.isVetoed ? 0.05 : Number(score.toFixed(4));
      fusedList.push({
        candidate: cand,
        fusedScore: rawScore,
        isVetoed: veto.isVetoed,
        vetoReason: veto.reason,
        supportingCues: cand.distinguishingFeatures
      });
    }

    // Sort descending by accumulated fused score (bonuses decide the winner)
    fusedList.sort((a, b) => b.fusedScore - a.fusedScore);

    // Normalize display scores after sorting
    for (const item of fusedList) {
      item.fusedScore = Math.max(0.01, Math.min(0.99, Number(item.fusedScore.toFixed(3))));
    }

    const winner = fusedList.find(f => !f.isVetoed) || fusedList[0] || null;
    const topScore = winner ? winner.fusedScore : 0.0;

    // Hierarchy calibrated confidence calculation
    let makeScore = this.calibrateProbability(Math.min(0.99, topScore + 0.12), 1.1);
    let modelScore = this.calibrateProbability(Math.min(0.98, topScore + 0.06), 1.2);
    let genScore = this.calibrateProbability(topScore, 1.25);
    let varScore = this.calibrateProbability(Math.max(0.05, topScore - 0.05), 1.3);

    // Fail-Closed Calibration Invariant:
    // When adjudication was attempted and did NOT yield a successful valid identification,
    // or when retrieval was not decisive, candidate confidence CANNOT remain high.
    if (adjudication && adjudication.outcome !== 'successful_identification') {
      if (adjudication.outcome === 'not_in_catalogue') {
        varScore = Math.min(0.10, varScore);
        genScore = Math.min(0.15, genScore);
        modelScore = Math.min(0.20, modelScore);
        makeScore = Math.min(0.25, makeScore);
      } else if (adjudication.outcome === 'provider_failure' || adjudication.outcome === 'invalid_response' || adjudication.outcome === 'invalid_image') {
        varScore = Math.min(0.15, varScore);
        genScore = Math.min(0.25, genScore);
        modelScore = Math.min(0.35, modelScore);
        makeScore = Math.min(0.45, makeScore);
      } else if (adjudication.outcome === 'valid_abstention') {
        varScore = Math.min(0.15, varScore);
        genScore = Math.min(0.25, genScore);
        modelScore = Math.min(0.35, modelScore);
        makeScore = Math.min(0.45, makeScore);
      } else if (adjudication.outcome === 'skipped_adjudication' && !retrieval.isDecisive) {
        varScore = Math.min(0.20, varScore);
        genScore = Math.min(0.30, genScore);
        modelScore = Math.min(0.40, modelScore);
        makeScore = Math.min(0.50, makeScore);
      }
    } else if (!adjudication && !retrieval.isDecisive) {
      varScore = Math.min(0.20, varScore);
      genScore = Math.min(0.30, genScore);
      modelScore = Math.min(0.40, modelScore);
      makeScore = Math.min(0.50, makeScore);
    }

    const calibratedConfidence: CalibratedConfidence = {
      make: makeScore,
      model: modelScore,
      generation: genScore,
      variant: varScore,
      overall: modelScore
    };

    return {
      rankedCandidates: fusedList,
      winningCandidate: winner,
      calibratedConfidence,
      isVetoed: Boolean(winner?.isVetoed)
    };
  }
}

export const evidenceFusionEngine = new EvidenceFusionEngine();
