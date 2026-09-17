/**
 * APEX — Local Rarity Engine Production Telemetry & Privacy-Preserving Tracer
 * 
 * Strict Privacy & Reliability Invariants:
 * - NEVER log raw GPS latitude/longitude.
 * - Only aggregate 5-character Geohashes, coarse area names, and statistical metrics.
 * - Tracks:
 *   1. Permission conversion (granted, denied, unavailable, prompt)
 *   2. Confidence states distribution (UNKNOWN, EMERGING, ESTABLISHED, HIGH_CONFIDENCE)
 *   3. Rarity divergence (local tier != global tier)
 *   4. XP modifiers (distribution, bonus XP awarded)
 *   5. Abuse rejection events (rate limiting, cooldowns, duplicate hashes, low confidence)
 *   6. Lookup latency (p50, p95 Bayesian calculation and RPC time)
 *   7. Cache behavior (location cache hits/misses)
 */

import type { LocalConfidenceState, RarityTier } from '../../types/apex';

export interface LocalRarityTelemetryEvent {
  eventType: 
    | 'permission_prompt'
    | 'permission_granted'
    | 'permission_denied'
    | 'permission_unavailable'
    | 'calculation_complete'
    | 'rarity_divergence'
    | 'abuse_rejected'
    | 'cache_hit'
    | 'cache_miss';
  timestamp: number;
  geographyBucket?: string; // 5-char geohash only
  coarseAreaName?: string;
  confidenceState?: LocalConfidenceState;
  globalTier?: RarityTier;
  localTier?: RarityTier;
  xpModifier?: number;
  bonusXp?: number;
  rejectionReason?: string;
  durationMs?: number;
}

export interface LocalRarityTelemetrySnapshot {
  totalCalculations: number;
  permissionStats: {
    prompts: number;
    granted: number;
    denied: number;
    unavailable: number;
    conversionRate: number; // 0.0 to 1.0
  };
  confidenceDistribution: Record<LocalConfidenceState, number>;
  rarityDivergenceCount: number;
  rarityDivergenceRate: number;
  averageXpModifier: number;
  totalBonusXpAwarded: number;
  abuseRejections: {
    total: number;
    reasons: Record<string, number>;
  };
  latency: {
    p50Ms: number;
    p95Ms: number;
    sampleCount: number;
  };
  cacheStats: {
    hits: number;
    misses: number;
    hitRate: number;
  };
}

export class LocalRarityTracer {
  private static instance: LocalRarityTracer;

  private totalCalculations: number = 0;
  private promptsCount: number = 0;
  private grantedCount: number = 0;
  private deniedCount: number = 0;
  private unavailableCount: number = 0;

  private confidenceCounts: Record<LocalConfidenceState, number> = {
    LOCAL_UNKNOWN: 0,
    LOCAL_EMERGING: 0,
    LOCAL_ESTABLISHED: 0,
    LOCAL_HIGH_CONFIDENCE: 0
  };

  private divergenceCount: number = 0;
  private totalModifierSum: number = 0;
  private modifierSampleCount: number = 0;
  private totalBonusXp: number = 0;

  private abuseRejectionCount: number = 0;
  private rejectionReasons: Record<string, number> = {};

  private latencySamples: number[] = [];
  private cacheHits: number = 0;
  private cacheMisses: number = 0;

  private recentEvents: LocalRarityTelemetryEvent[] = [];

  private constructor() {}

  public static getInstance(): LocalRarityTracer {
    if (!LocalRarityTracer.instance) {
      LocalRarityTracer.instance = new LocalRarityTracer();
    }
    return LocalRarityTracer.instance;
  }

  /**
   * Track location permission changes and user decisions.
   */
  public recordPermission(event: 'prompt' | 'granted' | 'denied' | 'unavailable') {
    const timestamp = Date.now();
    if (event === 'prompt') this.promptsCount++;
    else if (event === 'granted') this.grantedCount++;
    else if (event === 'denied') this.deniedCount++;
    else if (event === 'unavailable') this.unavailableCount++;

    this.pushEvent({
      eventType: `permission_${event}` as any,
      timestamp
    });
  }

  /**
   * Track cache hits and misses for coarse locations and aggregates.
   */
  public recordCache(hit: boolean) {
    if (hit) {
      this.cacheHits++;
      this.pushEvent({ eventType: 'cache_hit', timestamp: Date.now() });
    } else {
      this.cacheMisses++;
      this.pushEvent({ eventType: 'cache_miss', timestamp: Date.now() });
    }
  }

  /**
   * Track a successful local rarity calculation and divergence from global baseline.
   */
  public recordCalculation(params: {
    durationMs: number;
    geographyBucket?: string;
    coarseAreaName?: string;
    confidenceState: LocalConfidenceState;
    globalTier: RarityTier;
    localTier: RarityTier;
    xpModifier: number;
    bonusXp: number;
  }) {
    this.totalCalculations++;
    this.confidenceCounts[params.confidenceState] = (this.confidenceCounts[params.confidenceState] || 0) + 1;
    
    this.totalModifierSum += params.xpModifier;
    this.modifierSampleCount++;
    this.totalBonusXp += params.bonusXp;

    this.latencySamples.push(params.durationMs);
    if (this.latencySamples.length > 500) {
      this.latencySamples.shift();
    }

    const isDivergent = params.localTier !== params.globalTier;
    if (isDivergent) {
      this.divergenceCount++;
      this.pushEvent({
        eventType: 'rarity_divergence',
        timestamp: Date.now(),
        geographyBucket: params.geographyBucket,
        coarseAreaName: params.coarseAreaName,
        globalTier: params.globalTier,
        localTier: params.localTier,
        xpModifier: params.xpModifier,
        bonusXp: params.bonusXp
      });
    }

    this.pushEvent({
      eventType: 'calculation_complete',
      timestamp: Date.now(),
      geographyBucket: params.geographyBucket,
      coarseAreaName: params.coarseAreaName,
      confidenceState: params.confidenceState,
      globalTier: params.globalTier,
      localTier: params.localTier,
      xpModifier: params.xpModifier,
      bonusXp: params.bonusXp,
      durationMs: params.durationMs
    });
  }

  /**
   * Track abuse rejection events (anti-gaming, duplicate hashes, cooldown rejections).
   */
  public recordAbuseRejection(reason: string, geographyBucket?: string) {
    this.abuseRejectionCount++;
    this.rejectionReasons[reason] = (this.rejectionReasons[reason] || 0) + 1;

    this.pushEvent({
      eventType: 'abuse_rejected',
      timestamp: Date.now(),
      rejectionReason: reason,
      geographyBucket
    });
  }

  private pushEvent(event: LocalRarityTelemetryEvent) {
    this.recentEvents.push(event);
    if (this.recentEvents.length > 100) {
      this.recentEvents.shift();
    }
  }

  /**
   * Returns a complete, aggregated telemetry snapshot.
   */
  public getSnapshot(): LocalRarityTelemetrySnapshot {
    const totalPermDecisions = this.grantedCount + this.deniedCount;
    const conversionRate = totalPermDecisions > 0 
      ? Number((this.grantedCount / totalPermDecisions).toFixed(3)) 
      : 0;

    const divergenceRate = this.totalCalculations > 0 
      ? Number((this.divergenceCount / this.totalCalculations).toFixed(3)) 
      : 0;

    const avgModifier = this.modifierSampleCount > 0 
      ? Number((this.totalModifierSum / this.modifierSampleCount).toFixed(3)) 
      : 1.0;

    const sortedLatency = [...this.latencySamples].sort((a, b) => a - b);
    const p50 = sortedLatency.length > 0 ? sortedLatency[Math.floor(sortedLatency.length * 0.5)] : 0;
    const p95 = sortedLatency.length > 0 ? sortedLatency[Math.floor(sortedLatency.length * 0.95)] : 0;

    const totalCacheAccess = this.cacheHits + this.cacheMisses;
    const cacheHitRate = totalCacheAccess > 0 
      ? Number((this.cacheHits / totalCacheAccess).toFixed(3)) 
      : 0;

    return {
      totalCalculations: this.totalCalculations,
      permissionStats: {
        prompts: this.promptsCount,
        granted: this.grantedCount,
        denied: this.deniedCount,
        unavailable: this.unavailableCount,
        conversionRate
      },
      confidenceDistribution: { ...this.confidenceCounts },
      rarityDivergenceCount: this.divergenceCount,
      rarityDivergenceRate: divergenceRate,
      averageXpModifier: avgModifier,
      totalBonusXpAwarded: this.totalBonusXp,
      abuseRejections: {
        total: this.abuseRejectionCount,
        reasons: { ...this.rejectionReasons }
      },
      latency: {
        p50Ms: p50,
        p95Ms: p95,
        sampleCount: sortedLatency.length
      },
      cacheStats: {
        hits: this.cacheHits,
        misses: this.cacheMisses,
        hitRate: cacheHitRate
      }
    };
  }

  /**
   * Clears telemetry for testing / isolation.
   */
  public reset() {
    this.totalCalculations = 0;
    this.promptsCount = 0;
    this.grantedCount = 0;
    this.deniedCount = 0;
    this.unavailableCount = 0;
    this.confidenceCounts = {
      LOCAL_UNKNOWN: 0,
      LOCAL_EMERGING: 0,
      LOCAL_ESTABLISHED: 0,
      LOCAL_HIGH_CONFIDENCE: 0
    };
    this.divergenceCount = 0;
    this.totalModifierSum = 0;
    this.modifierSampleCount = 0;
    this.totalBonusXp = 0;
    this.abuseRejectionCount = 0;
    this.rejectionReasons = {};
    this.latencySamples = [];
    this.cacheHits = 0;
    this.cacheMisses = 0;
    this.recentEvents = [];
  }
}

export const localRarityTracer = LocalRarityTracer.getInstance();
