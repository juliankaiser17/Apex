/**
 * APEX v2 — Stage B: Gallery Vector Retrieval & Open-Set Detection
 * 
 * Functions:
 * 1. Image-derived feature extraction from input image bytes using ImageFeatureExtractor.
 * 2. Reference Gallery k-NN Search across Tier 1 canonical vehicles.
 * 3. Open-set anomaly detection: Detects uncatalogued vehicles and unusual non-car inputs.
 * 4. Margin gating: Determines whether retrieval alone is decisive or needs Stage C adjudication.
 * 
 * HARD INVARIANTS:
 * 1. Zero synthetic hint usage in production/blind mode.
 * 2. If image embedding cannot be extracted, fails safely with empty candidates (never defaults to a specific car).
 * 3. Only compares against gallery entries matching current extractor version (EXTRACTOR_VERSION).
 */

import { TIER_1_GALLERY_CATALOGUE, type GalleryReferenceEntry } from './galleryData.ts';
import { getEmbeddingExtractor, type IEmbeddingExtractor } from './learnedEmbeddingExtractor.ts';
import { getClipReferenceVector } from './clipGalleryAuthority.ts';
import type { GalleryCandidate, RetrievalResult } from './types';
import type { ViewpointType } from '../types';

function computeVectorCosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return Number((dot / (Math.sqrt(normA) * Math.sqrt(normB))).toFixed(5));
}

export class GalleryRetrievalEngine {
  private gallery: GalleryReferenceEntry[] = TIER_1_GALLERY_CATALOGUE;
  private openSetSimilarityFloor = 0.45; // Similarity < 0.45 -> Not in catalogue / open-set anomaly
  private decisiveMarginThreshold = 0.16; // Margin >= 0.16 -> Decisive variant match

  /**
   * Generates genuine visual query representation directly from decoded image pixels.
   * If extraction fails, payload is missing, or embedding service is down, returns null.
   * Hard Invariant: Synthetic hints or label injection are NEVER used.
   */
  public async generateQueryVector(
    imageInput?: string | Buffer,
    _simulatedPerceptualHints?: any
  ): Promise<number[] | null> {
    if (!imageInput) return null;

    try {
      const extractor: IEmbeddingExtractor = getEmbeddingExtractor();
      const vector = await extractor.extractVector(imageInput);
      if (vector && extractor.validateVector(vector)) {
        return vector;
      }
    } catch (err) {
      console.warn('[GalleryRetrievalEngine] Query vector extraction failed:', err);
    }

    return null;
  }

  /**
   * Execute retrieval across reference gallery.
   * STRICT INVARIANTS:
   * 1. If query vector is missing or unparseable, returns empty candidates with isOpenSetAnomaly: false (fail-closed uncertain).
   * 2. Only compares vectors matching the exact active extractor dimension and version.
   * 3. Never mixes 64D with 512D or 384D vectors.
   */
  public searchGallery(
    queryVector: number[] | null,
    viewpoint: ViewpointType = 'front_3q',
    options?: {
      targetMake?: string | null;
      topK?: number;
    }
  ): RetrievalResult {
    const extractor = getEmbeddingExtractor();
    const expectedDim = extractor.dimension;
    const expectedVer = extractor.version;

    // Fail-Closed Rule: A missing or invalid vector is a RETRIEVAL FAILURE, NOT proof of catalogue absence!
    if (!queryVector || !Array.isArray(queryVector) || queryVector.length !== expectedDim) {
      return {
        topCandidates: [],
        isDecisive: false,
        bestDistance: 1.0,
        isOpenSetAnomaly: false, // Invariant: Failure to retrieve does NOT prove vehicle is absent from catalogue!
        marginToSecond: 0.0
      };
    }

    const topK = options?.topK || 5;
    const targetMake = options?.targetMake ? options.targetMake.toLowerCase().trim() : null;

    const scoredEntries: Array<{ entry: GalleryReferenceEntry; similarity: number; viewpointBonus: number }> = [];

    for (const entry of this.gallery) {
      // Determine reference vector matching active extractor dimension
      let refVector: number[] | null = null;
      if (expectedDim === 512) {
        refVector = getClipReferenceVector(entry.canonicalId);
      } else if (
        entry.hasReferenceEmbedding &&
        entry.featureVector &&
        entry.featureVector.length === expectedDim &&
        (!entry.extractorVersion || entry.extractorVersion === expectedVer)
      ) {
        refVector = entry.featureVector;
      }

      if (!refVector || refVector.length !== expectedDim) {
        continue;
      }

      // If targetMake is specified with high certainty, filter by make
      if (targetMake && !entry.make.toLowerCase().includes(targetMake) && !targetMake.includes(entry.make.toLowerCase())) {
        continue;
      }

      const rawSimilarity = computeVectorCosineSimilarity(queryVector, refVector);

      // Viewpoint alignment factor (0.015 weight)
      let viewpointBonus = 0.0;
      const vp = viewpoint === 'front_3q' ? 'front' : viewpoint;
      if ((entry.viewpointSignatures as any)[vp]) {
        viewpointBonus = 0.015;
      }

      const compositeScore = Math.min(0.985, Math.max(-0.985, Number(((rawSimilarity * 0.95) + (viewpointBonus * 0.5)).toFixed(4))));
      scoredEntries.push({
        entry,
        similarity: compositeScore,
        viewpointBonus
      });
    }

    // If no valid reference entries matched:
    if (scoredEntries.length === 0) {
      return {
        topCandidates: [],
        isDecisive: false,
        bestDistance: 1.0,
        isOpenSetAnomaly: false, // Incompatible/empty gallery is retrieval unavailability, NOT open-set proof
        marginToSecond: 0.0
      };
    }

    // Sort descending by similarity
    scoredEntries.sort((a, b) => b.similarity - a.similarity);

    const candidates: GalleryCandidate[] = scoredEntries.slice(0, topK).map(s => ({
      canonicalId: s.entry.canonicalId,
      make: s.entry.make,
      model: s.entry.model,
      generation: s.entry.generation,
      variant: s.entry.variant,
      displayName: s.entry.displayName,
      similarityScore: s.similarity,
      viewpointAlignment: Number((0.85 + s.viewpointBonus).toFixed(2)),
      distinguishingFeatures: s.entry.distinguishingFeatures,
      referenceThumbnail: `gallery/${s.entry.canonicalId}.jpg`
    }));

    const topScore = candidates[0]?.similarityScore || 0;
    const secondScore = candidates[1]?.similarityScore || 0;
    const margin = Number((topScore - secondScore).toFixed(3));
    const bestDistance = Number((1.0 - topScore).toFixed(3));

    // Open set anomaly: true ONLY when candidates were successfully scored and top score < similarity floor
    const similarityFloor = expectedDim === 512 ? 0.65 : this.openSetSimilarityFloor;
    const isOpenSet = topScore < similarityFloor;

    // Decisive Retrieval Path Invariant:
    // Strictly disabled by default. May be enabled only behind DECISIVE_RETRIEVAL_ENABLED='true'
    const decisiveFlag = typeof process !== 'undefined' && process.env.DECISIVE_RETRIEVAL_ENABLED === 'true';
    const decisiveMargin = expectedDim === 512 ? 0.08 : this.decisiveMarginThreshold;
    const decisiveMinSim = expectedDim === 512 ? 0.94 : 0.96;
    const isDecisive = decisiveFlag && !isOpenSet && topScore >= decisiveMinSim && margin >= decisiveMargin;

    return {
      topCandidates: candidates,
      isDecisive,
      bestDistance,
      isOpenSetAnomaly: isOpenSet,
      marginToSecond: margin
    };
  }
}

export const galleryRetrievalEngine = new GalleryRetrievalEngine();
