/**
 * APEX AI Engine — Centralized Configuration & Resilience Registry
 * 
 * INVARIANTS:
 * 1. Zero hardcoded model strings: all models and providers are configured here.
 * 2. Gemini Migration: gemini-2.5-flash is retired (shutdown 16 Oct 2026).
 *    Configured for gemini-3.5-flash and gemini-3.1-flash-lite.
 * 3. Feature Flag: AI_PIPELINE = 'v1' | 'v2' | 'shadow'.
 * 4. Hard Cost Invariant: Max 2 VLM requests per scan, max $0.0050 ceiling.
 */

export type PipelineMode = 'v1' | 'v2' | 'shadow';
export type VisionProviderType = 'cloudflare' | 'gemini' | 'mock' | 'retrieval_only';

export interface ProviderEndpointConfig {
  provider: VisionProviderType;
  model: string;
  fallbackModel?: string;
  timeoutMs: number;
  maxRetries: number;
  retryJitterMs: number;
  circuitBreakerThresholdFailures: number;
  circuitBreakerCooldownMs: number;
}

export interface PipelineConfig {
  mode: PipelineMode;
  primaryProvider: VisionProviderType;
  providerFallbackChain: VisionProviderType[];
  providers: {
    cloudflare: ProviderEndpointConfig;
    gemini: ProviderEndpointConfig;
  };
  budgets: {
    maxVlmCallsPerScan: number;
    maxCostPerScanUsd: number;
    p95LatencyCeilingMs: number;
  };
  killSwitches: {
    visionScanningEnabled: boolean;
    geminiScanningEnabled: boolean;
    cloudflareScanningEnabled: boolean;
    expensiveVerificationEnabled: boolean;
  };
}

export function resolvePipelineConfig(): PipelineConfig {
  const env = (typeof process !== 'undefined' ? process.env : {}) as Record<string, string | undefined>;

  const rawMode = (env.AI_PIPELINE || 'v2').toLowerCase().trim();
  const mode: PipelineMode = rawMode === 'v1' || rawMode === 'shadow' ? rawMode : 'v2';

  const rawProvider = (env.VISION_PROVIDER || 'cloudflare').toLowerCase().trim();
  const primaryProvider: VisionProviderType = rawProvider === 'gemini' ? 'gemini' : 'cloudflare';

  return {
    mode,
    primaryProvider,
    providerFallbackChain: [primaryProvider, primaryProvider === 'cloudflare' ? 'gemini' : 'cloudflare', 'retrieval_only'],
    providers: {
      cloudflare: {
        provider: 'cloudflare',
        model: env.CLOUDFLARE_MODEL || '@cf/meta/llama-3.2-11b-vision-instruct',
        timeoutMs: Number(env.CLOUDFLARE_TIMEOUT_MS || 9000),
        maxRetries: 1,
        retryJitterMs: 250,
        circuitBreakerThresholdFailures: 5,
        circuitBreakerCooldownMs: 30000
      },
      gemini: {
        provider: 'gemini',
        // MIGRATED: gemini-2.5-flash deprecated/closing 16 Oct 2026. Upgraded to gemini-3.5-flash!
        model: env.GEMINI_MODEL || 'gemini-3.5-flash',
        fallbackModel: 'gemini-3.1-flash-lite',
        timeoutMs: Number(env.GEMINI_TIMEOUT_MS || 7000),
        maxRetries: 1,
        retryJitterMs: 200,
        circuitBreakerThresholdFailures: 3,
        circuitBreakerCooldownMs: 45000
      }
    },
    budgets: {
      maxVlmCallsPerScan: 2,
      maxCostPerScanUsd: 0.0050,
      p95LatencyCeilingMs: 6000
    },
    killSwitches: {
      visionScanningEnabled: env.VISION_SCANNING_ENABLED !== 'false',
      geminiScanningEnabled: env.GEMINI_SCANNING_ENABLED !== 'false',
      cloudflareScanningEnabled: env.CLOUDFLARE_SCANNING_ENABLED !== 'false',
      expensiveVerificationEnabled: env.EXPENSIVE_VERIFICATION_ENABLED !== 'false'
    }
  };
}

export const pipelineConfig = resolvePipelineConfig();
