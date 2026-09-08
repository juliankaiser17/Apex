/**
 * APEX — Multi-Tier Identification Caching Layer
 * Caches validated scan results strictly by cryptographic content image hash (SHA-256)
 * to eliminate redundant external AI calls while preventing any cross-scan cache collisions.
 */

import type { IdentificationResult } from '../types';

export class IdentificationCache {
  private resultCache: Map<string, { result: IdentificationResult; expiresAt: number }> = new Map();
  private candidateCache: Map<string, { candidates: any[]; expiresAt: number }> = new Map();

  private readonly ttlMs = 12 * 60 * 60 * 1000; // 12 hours
  private hitCount: number = 0;
  private missCount: number = 0;

  /**
   * Validate that the hash is an authentic 64-character lowercase hexadecimal SHA-256 digest
   */
  private isValidHash(imageHash: string): boolean {
    if (!imageHash || typeof imageHash !== 'string') return false;
    return /^[0-9a-f]{64}$/i.test(imageHash);
  }

  public getResult(imageHash: string): IdentificationResult | null {
    if (!this.isValidHash(imageHash)) {
      this.missCount += 1;
      return null;
    }

    const entry = this.resultCache.get(imageHash);

    if (entry) {
      if (Date.now() < entry.expiresAt) {
        this.hitCount += 1;
        // Return structured clone to prevent object reference leakage between scans
        return {
          ...JSON.parse(JSON.stringify(entry.result)),
          cached: true
        };
      }
      this.resultCache.delete(imageHash);
    }

    this.missCount += 1;
    return null;
  }

  public setResult(imageHash: string, result: IdentificationResult) {
    if (!this.isValidHash(imageHash) || !result) return;
    
    // Store deep clone to guarantee cache immutability
    this.resultCache.set(imageHash, {
      result: JSON.parse(JSON.stringify(result)),
      expiresAt: Date.now() + this.ttlMs
    });
  }

  public has(imageHash: string): boolean {
    if (!this.isValidHash(imageHash)) return false;
    const entry = this.resultCache.get(imageHash);
    if (!entry) return false;
    if (Date.now() >= entry.expiresAt) {
      this.resultCache.delete(imageHash);
      return false;
    }
    return true;
  }

  public delete(imageHash: string): boolean {
    return this.resultCache.delete(imageHash);
  }

  public getStats(): { hitCount: number; missCount: number; hitRatio: number; size: number } {
    const total = this.hitCount + this.missCount;
    const hitRatio = total > 0 ? Number((this.hitCount / total).toFixed(3)) : 0;
    return {
      hitCount: this.hitCount,
      missCount: this.missCount,
      hitRatio,
      size: this.resultCache.size
    };
  }

  /**
   * Completely flushes all cache entries (used for clean sequential test isolation)
   */
  public clear() {
    this.resultCache.clear();
    this.candidateCache.clear();
    this.hitCount = 0;
    this.missCount = 0;
  }
}

export const identificationCache = new IdentificationCache();
