/**
 * APEX v2 — CLIP-ViT-B/32 Reference Gallery Authority (Phase 14)
 * 
 * 512-dimensional unit-normalized reference centroids extracted from clean,
 * group-disjoint development images (zero test set exposure).
 */

import clipVectorsJson from './clipGalleryVectors.json' with { type: 'json' };

export interface ClipReferenceVector {
  canonicalId: string;
  sampleCount: number;
  vector: number[];
}

export const CLIP_GALLERY_CATALOGUE: Record<string, ClipReferenceVector> = clipVectorsJson as any;

export function getClipReferenceVector(canonicalId: string): number[] | null {
  const entry = CLIP_GALLERY_CATALOGUE[canonicalId];
  if (entry && Array.isArray(entry.vector) && entry.vector.length === 512) {
    return entry.vector;
  }
  return null;
}
