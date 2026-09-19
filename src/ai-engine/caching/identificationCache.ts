/**
 * APEX — Multi-Tier Identification Caching Layer
 * Caches validated scan results strictly by cryptographic content image hash (SHA-256)
 * to eliminate redundant external AI calls while preventing any cross-scan cache collisions.
 */

import type { IdentificationResult } from '../types';

export const VISION_PIPELINE_VERSION = 'v2.7.0-fine-grained-discriminator';

export function buildCacheKey(
  imageHash: string,
  provider: string = 'cloudflare',
  model: string = '@cf/meta/llama-3.2-11b-vision-instruct'
): string {
  const cleanHash = (imageHash || '').toLowerCase().trim();
  const cleanProvider = (provider || 'cloudflare').toLowerCase().trim();
  const cleanModel = (model || '@cf/meta/llama-3.2-11b-vision-instruct').toLowerCase().trim();
  return `vision:${VISION_PIPELINE_VERSION}:${cleanProvider}:${cleanModel}:${cleanHash}`;
}

export class IdentificationCache {
  private resultCache: Map<string, { result: IdentificationResult; expiresAt: number }> = new Map();
  private candidateCache: Map<string, { candidates: any[]; expiresAt: number }> = new Map();

  private readonly ttlMs = 12 * 60 * 60 * 1000; // 12 hours
  private hitCount: number = 0;
  private missCount: number = 0;

  /**
   * Resolve an authoritative namespaced cache key.
   * Enforces: vision:<pipelineVersion>:<provider>:<model>:<sha256>
   */
  private resolveKey(keyOrHash: string, provider?: string, model?: string): string | null {
    if (!keyOrHash || typeof keyOrHash !== 'string') return null;
    if (keyOrHash.startsWith(`vision:${VISION_PIPELINE_VERSION}:`)) {
      return keyOrHash;
    }
    // If raw SHA-256 hash or legacy key, construct canonical namespaced key
    const rawHash = keyOrHash.includes(':') ? keyOrHash.split(':').pop()! : keyOrHash;
    if (!/^[0-9a-f]{64}$/i.test(rawHash)) {
      return null;
    }
    return buildCacheKey(rawHash, provider, model);
  }

  public getResult(keyOrHash: string, provider?: string, model?: string): IdentificationResult | null {
    const key = this.resolveKey(keyOrHash, provider, model);
    if (!key) {
      this.missCount += 1;
      return null;
    }

    const entry = this.resultCache.get(key);

    if (entry) {
      if (Date.now() < entry.expiresAt) {
        // Enforce strict version equality
        if (entry.result.pipelineVersion === VISION_PIPELINE_VERSION) {
          this.hitCount += 1;
          return {
            ...JSON.parse(JSON.stringify(entry.result)),
            cached: true
          };
        }
      }
      this.resultCache.delete(key);
    }

    this.missCount += 1;
    return null;
  }

  public setResult(keyOrHash: string, result: IdentificationResult, provider?: string, model?: string) {
    const key = this.resolveKey(keyOrHash, provider, model);
    if (!key || !result) return;
    
    // Stamp pipelineVersion on result
    result.pipelineVersion = VISION_PIPELINE_VERSION;

    // Store deep clone to guarantee cache immutability
    this.resultCache.set(key, {
      result: JSON.parse(JSON.stringify(result)),
      expiresAt: Date.now() + this.ttlMs
    });
  }

  public has(keyOrHash: string, provider?: string, model?: string): boolean {
    const key = this.resolveKey(keyOrHash, provider, model);
    if (!key) return false;
    const entry = this.resultCache.get(key);
    if (!entry) return false;
    if (Date.now() >= entry.expiresAt || entry.result.pipelineVersion !== VISION_PIPELINE_VERSION) {
      this.resultCache.delete(key);
      return false;
    }
    return true;
  }

  public delete(keyOrHash: string, provider?: string, model?: string): boolean {
    const key = this.resolveKey(keyOrHash, provider, model);
    if (!key) return false;
    return this.resultCache.delete(key);
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
