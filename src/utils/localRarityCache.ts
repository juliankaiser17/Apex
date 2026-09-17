/**
 * APEX — Local Rarity Model Version-Aware Cache
 * 
 * Implements deterministic cache keying:
 *   `${canonicalId}:${geoBucket}:v${modelVersion}`
 * 
 * Guarantees:
 * 1. Model version isolation (v1 vs v2 keys never collide).
 * 2. Geography isolation (different coarse areas never share entries).
 * 3. Stale cache eviction (configurable TTL, default 5 minutes).
 * 4. Invalidation on aggregate updates, geography changes, or feature disablement.
 * 5. Feature flag gating (returns miss if LOCAL_RARITY_ENABLED is false).
 */

import { featureFlags } from './featureFlags';
import { LOCAL_RARITY_CONFIG, type LocalRarityCalculationResult } from './localRarityEngine';

export interface CacheEntry<T> {
  data: T;
  cachedAt: number;
  ttlMs: number;
  modelVersion: number;
}

export class LocalRarityCache {
  private static instance: LocalRarityCache;
  private cache: Map<string, CacheEntry<LocalRarityCalculationResult>> = new Map();
  private defaultTtlMs: number = 5 * 60 * 1000; // 5 minutes

  public constructor(defaultTtlMs?: number) {
    if (defaultTtlMs !== undefined) {
      this.defaultTtlMs = defaultTtlMs;
    }
  }

  public static getInstance(): LocalRarityCache {
    if (!LocalRarityCache.instance) {
      LocalRarityCache.instance = new LocalRarityCache();
    }
    return LocalRarityCache.instance;
  }

  /**
   * Deterministic cache key generator
   */
  public buildKey(
    canonicalId: string, 
    geoBucket: string, 
    modelVersion: number = LOCAL_RARITY_CONFIG.MODEL_VERSION
  ): string {
    const cleanId = (canonicalId || 'unknown').toLowerCase().trim();
    const cleanBucket = (geoBucket || 'global').toLowerCase().trim();
    return `${cleanId}:${cleanBucket}:v${modelVersion}`;
  }

  /**
   * Retrieves a cached calculation result if valid, not stale, and feature is enabled.
   */
  public get(
    canonicalId: string, 
    geoBucket: string, 
    modelVersion: number = LOCAL_RARITY_CONFIG.MODEL_VERSION
  ): LocalRarityCalculationResult | undefined {
    if (!featureFlags.isLocalRarityEnabled()) {
      return undefined;
    }

    const key = this.buildKey(canonicalId, geoBucket, modelVersion);
    const entry = this.cache.get(key);

    if (!entry) {
      return undefined;
    }

    // Check TTL expiration
    const now = Date.now();
    if (now - entry.cachedAt > entry.ttlMs) {
      this.cache.delete(key);
      return undefined;
    }

    // Check model version match
    if (entry.modelVersion !== modelVersion) {
      this.cache.delete(key);
      return undefined;
    }

    return entry.data;
  }

  /**
   * Sets a cached calculation result.
   */
  public set(
    canonicalId: string, 
    geoBucket: string, 
    data: LocalRarityCalculationResult, 
    ttlMs?: number,
    modelVersion: number = LOCAL_RARITY_CONFIG.MODEL_VERSION
  ): void {
    if (!featureFlags.isLocalRarityEnabled()) {
      return;
    }

    const key = this.buildKey(canonicalId, geoBucket, modelVersion);
    this.cache.set(key, {
      data,
      cachedAt: Date.now(),
      ttlMs: ttlMs !== undefined ? ttlMs : this.defaultTtlMs,
      modelVersion
    });
  }

  /**
   * Checks if an entry exists and is not expired.
   */
  public has(
    canonicalId: string, 
    geoBucket: string, 
    modelVersion: number = LOCAL_RARITY_CONFIG.MODEL_VERSION
  ): boolean {
    return this.get(canonicalId, geoBucket, modelVersion) !== undefined;
  }

  /**
   * Invalidate specific vehicle, optionally scoped to a geography bucket.
   */
  public invalidate(canonicalId: string, geoBucket?: string): void {
    const cleanId = (canonicalId || 'unknown').toLowerCase().trim();
    if (geoBucket) {
      const cleanBucket = (geoBucket || 'global').toLowerCase().trim();
      // Invalidate all model versions for this pair
      for (const key of this.cache.keys()) {
        if (key.startsWith(`${cleanId}:${cleanBucket}:`)) {
          this.cache.delete(key);
        }
      }
    } else {
      // Invalidate vehicle across all buckets
      for (const key of this.cache.keys()) {
        if (key.startsWith(`${cleanId}:`)) {
          this.cache.delete(key);
        }
      }
    }
  }

  /**
   * Invalidate all vehicles in a geography bucket (e.g. after massive new sighting sync).
   */
  public invalidateGeography(geoBucket: string): void {
    const cleanBucket = (geoBucket || 'global').toLowerCase().trim();
    for (const [key] of this.cache.entries()) {
      const parts = key.split(':');
      if (parts.length >= 3 && parts[1] === cleanBucket) {
        this.cache.delete(key);
      }
    }
  }

  public clear(): void {
    this.cache.clear();
  }

  public size(): number {
    return this.cache.size;
  }
}

export const localRarityCache = LocalRarityCache.getInstance();
