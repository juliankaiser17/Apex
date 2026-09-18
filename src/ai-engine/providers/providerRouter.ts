/**
 * APEX — AI Provider Router & Circuit Breaker Controller
 * Enforces global AI concurrency limits, rate limit tracking, circuit breaker tripping, and graceful fallback.
 */

import type { AIProvider, AIProviderRequest, AIProviderResponse } from './types';
import { GeminiProvider } from './geminiProvider';
import { CloudflareVisionProvider } from './cloudflareVisionProvider';
import { MockFallbackProvider } from './mockFallbackProvider';
import type { CircuitBreakerState, ProviderCapacityConfig } from '../types';

declare const process: any;

export class AIProviderRouter {
  private primaryProvider: AIProvider;
  private fallbackProvider: AIProvider;

  // Circuit Breaker State
  private circuitState: CircuitBreakerState = 'CLOSED';
  private failureCount: number = 0;
  private lastFailureTime: number = 0;
  private readonly failureThreshold: number = 4;
  private readonly recoveryTimeoutMs: number = 15000; // 15s before HALF_OPEN probe

  // Concurrency & Rate Limit Management
  private activeConcurrency: number = 0;
  private maxConcurrency: number = 20; // Internal application concurrency guard
  private dailyScansCount: number = 0;
  private dailyCostEstimateUsd: number = 0;

  // Provider configuration (Cloudflare Workers AI reference & application guard)
  private config: ProviderCapacityConfig = {
    providerName: 'Cloudflare Workers AI',
    primaryModel: '@cf/meta/llama-3.2-11b-vision-instruct',
    secondaryModel: 'gemini-2.5-flash',
    rpmLimit: 720, // Cloudflare platform Image-to-Text reference limit
    tpmLimit: 100000,
    maxConcurrency: 20,
    timeoutMs: 35000,
    costPerScanUsd: 0.0003,
    dailyBudgetUsd: 25.0,
    monthlyBudgetUsd: 750.0,
    enabled: true
  };

  constructor(primaryProvider?: AIProvider, fallbackProvider?: AIProvider) {
    if (primaryProvider) {
      this.primaryProvider = primaryProvider;
    } else {
      const rawProvider = (typeof process !== 'undefined' && process.env?.VISION_PROVIDER) || 'cloudflare';
      const requestedProvider = rawProvider.toLowerCase().trim();
      if (requestedProvider === 'cloudflare') {
        this.primaryProvider = new CloudflareVisionProvider();
        this.config.providerName = 'Cloudflare Workers AI';
        this.config.primaryModel = '@cf/meta/llama-3.2-11b-vision-instruct';
      } else if (requestedProvider === 'gemini') {
        this.primaryProvider = new GeminiProvider();
        this.config.providerName = 'Google Gemini';
        this.config.primaryModel = 'gemini-2.5-flash';
      } else {
        throw new Error(
          `[AIProviderRouter Configuration Error] Invalid VISION_PROVIDER="${rawProvider}". ` +
          `Supported values are "cloudflare" or "gemini". Application fails closed to prevent unintended fallback.`
        );
      }
    }
    this.fallbackProvider = fallbackProvider || new MockFallbackProvider();
  }

  public getCircuitState(): CircuitBreakerState {
    if (this.circuitState === 'OPEN') {
      if (Date.now() - this.lastFailureTime > this.recoveryTimeoutMs) {
        this.circuitState = 'HALF_OPEN';
      }
    }
    return this.circuitState;
  }

  public getActiveConcurrency(): number {
    return this.activeConcurrency;
  }

  public getConfig(): ProviderCapacityConfig {
    return { ...this.config };
  }

  public getPrimaryProvider(): AIProvider {
    return this.primaryProvider;
  }

  public getFallbackProvider(): AIProvider {
    return this.fallbackProvider;
  }

  public async getActiveProviderName(): Promise<string> {
    const isPrimary = await this.primaryProvider.isAvailable();
    const allowMockFallback = typeof process !== 'undefined' && process.env?.ALLOW_MOCK_FALLBACK === 'true';
    if (this.config.enabled && isPrimary && this.getCircuitState() !== 'OPEN') {
      return this.primaryProvider.name;
    }
    return (allowMockFallback && this.fallbackEnabled) ? this.fallbackProvider.name : 'none';
  }

  public updateConfig(newConfig: Partial<ProviderCapacityConfig>) {
    this.config = { ...this.config, ...newConfig };
    if (newConfig.maxConcurrency) {
      this.maxConcurrency = newConfig.maxConcurrency;
    }
  }

  private fallbackEnabled: boolean = false;

  public setFallbackEnabled(enabled: boolean): void {
    this.fallbackEnabled = enabled;
  }

  public isFallbackEnabled(): boolean {
    return this.fallbackEnabled;
  }

  public async getProviderDiagnostics(): Promise<{
    providerName: string;
    primaryModel: string;
    isAvailable: boolean;
    circuitState: CircuitBreakerState;
    fallbackEnabled: boolean;
    activeConcurrency: number;
  }> {
    const isAvailable = await this.primaryProvider.isAvailable();
    return {
      providerName: this.primaryProvider.name,
      primaryModel: this.config.primaryModel,
      isAvailable,
      circuitState: this.getCircuitState(),
      fallbackEnabled: this.fallbackEnabled,
      activeConcurrency: this.activeConcurrency
    };
  }

  public resetCircuit() {
    this.circuitState = 'CLOSED';
    this.failureCount = 0;
  }

  /**
   * Routes request through circuit breaker with backpressure & fallback
   */
  public async routeIdentification(request: AIProviderRequest): Promise<AIProviderResponse> {
    const currentState = this.getCircuitState();
    const providerAttempted = this.primaryProvider.name;

    // Safe Diagnostic Logging (Never log secrets or token values)
    console.log('[AIProviderRouter] Diagnostics:', {
      provider: (typeof process !== 'undefined' && process.env?.VISION_PROVIDER) || 'cloudflare',
      cloudflareAccountConfigured: Boolean(typeof process !== 'undefined' && process.env?.CLOUDFLARE_ACCOUNT_ID),
      cloudflareTokenConfigured: Boolean(typeof process !== 'undefined' && process.env?.CLOUDFLARE_AUTH_TOKEN),
      scanningEnabled: typeof process !== 'undefined' ? process.env?.CLOUDFLARE_SCANNING_ENABLED !== 'false' : true,
      visionScanningEnabled: typeof process !== 'undefined' ? process.env?.VISION_SCANNING_ENABLED !== 'false' : true,
      allowMockFallback: typeof process !== 'undefined' && process.env?.ALLOW_MOCK_FALLBACK === 'true'
    });

    // In production, ALLOW_MOCK_FALLBACK defaults to false; MockFallbackProvider never runs silently
    const allowMockFallback = typeof process !== 'undefined' && process.env?.ALLOW_MOCK_FALLBACK === 'true';
    const isFallbackPermitted = allowMockFallback && this.fallbackEnabled && !request.options?.disableFallback;

    // 1. Check if circuit is OPEN, Concurrency is Saturated, or Budget/Killswitch is Active
    const isPrimaryAvailable = await this.primaryProvider.isAvailable();
    const isScanningEnabled = typeof process !== 'undefined'
      ? (this.primaryProvider.name === 'CloudflareVisionProvider'
          ? process.env?.CLOUDFLARE_SCANNING_ENABLED !== 'false' && process.env?.VISION_SCANNING_ENABLED !== 'false'
          : process.env?.GEMINI_SCANNING_ENABLED !== 'false' && process.env?.VISION_SCANNING_ENABLED !== 'false')
      : true;
    const isBudgetExceeded = this.dailyCostEstimateUsd >= this.config.dailyBudgetUsd;

    const canAttemptPrimary =
      this.config.enabled &&
      isScanningEnabled &&
      !isBudgetExceeded &&
      isPrimaryAvailable &&
      currentState !== 'OPEN' &&
      this.activeConcurrency < this.maxConcurrency;

    if (!canAttemptPrimary) {
      let failureReason = `Primary vision provider unavailable (isAvailable=${isPrimaryAvailable}, circuitState=${currentState}).`;
      if (!isScanningEnabled) failureReason = `${this.primaryProvider.name} scanning is disabled via emergency kill switch.`;
      if (isBudgetExceeded) failureReason = `Daily ${this.primaryProvider.name} budget exceeded ($${this.dailyCostEstimateUsd.toFixed(2)} >= $${this.config.dailyBudgetUsd.toFixed(2)}).`;

      if (!isFallbackPermitted) {
        return {
          success: false,
          error: failureReason,
          errorType: !isScanningEnabled ? 'PROVIDER_UNAVAILABLE' : isBudgetExceeded ? 'PROVIDER_UNAVAILABLE' : !isPrimaryAvailable ? 'AUTH_ERROR' : currentState === 'OPEN' ? '429' : 'PROVIDER_UNAVAILABLE',
          providerStatus: !isPrimaryAvailable ? 401 : !isScanningEnabled ? 503 : 500,
          providerErrorCode: !isPrimaryAvailable ? 'MISSING_CREDENTIALS' : undefined,
          providerName: this.primaryProvider.name,
          modelUsed: 'none',
          providerAttempted,
          fallbackUsed: false,
          retriesAttempted: 0,
          retryConsumed: false,
          tokensConsumed: { promptTokens: 0, outputTokens: 0, totalTokens: 0 },
          durationMs: 0
        };
      }
      // Only runs if explicitly enabled via ALLOW_MOCK_FALLBACK=true
      const fallbackResponse = await this.fallbackProvider.identify(request);
      return {
        ...fallbackResponse,
        providerAttempted,
        fallbackUsed: true
      };
    }

    // 2. Execute via Primary Provider with Concurrency Guard
    this.activeConcurrency += 1;
    try {
      const response = await this.primaryProvider.identify(request);

      if (response.success) {
        this.onSuccess();
        this.dailyScansCount += 1;
        this.dailyCostEstimateUsd += this.config.costPerScanUsd;
        return {
          ...response,
          providerAttempted,
          fallbackUsed: false
        };
      }

      // Handle Provider Failures (429 / 5xx / Timeout / Quota / Agreement)
      this.onFailure(response.errorType);

      if (!isFallbackPermitted) {
        return {
          ...response,
          providerName: this.primaryProvider.name,
          providerAttempted,
          fallbackUsed: false
        };
      }

      // Explicit dev fallback
      const fallbackResponse = await this.fallbackProvider.identify(request);
      return {
        ...fallbackResponse,
        providerAttempted,
        fallbackUsed: true,
        error: `Primary AI degraded (${response.error || 'Throttled'}). Used fallback engine.`
      };
    } catch (err: any) {
      this.onFailure('5xx');
      if (!isFallbackPermitted) {
        return {
          success: false,
          error: err?.message || 'Primary provider threw exception',
          errorType: '5xx',
          providerStatus: err?.status || 500,
          providerErrorCode: err?.errorCode,
          retriesAttempted: 0,
          retryConsumed: false,
          providerName: this.primaryProvider.name,
          modelUsed: 'none',
          providerAttempted,
          fallbackUsed: false,
          tokensConsumed: { promptTokens: 0, outputTokens: 0, totalTokens: 0 },
          durationMs: 0
        };
      }
      const fallbackResponse = await this.fallbackProvider.identify(request);
      return {
        ...fallbackResponse,
        providerAttempted,
        fallbackUsed: true
      };
    } finally {
      this.activeConcurrency = Math.max(0, this.activeConcurrency - 1);
    }
  }

  private onSuccess() {
    if (this.circuitState === 'HALF_OPEN') {
      this.circuitState = 'CLOSED';
      this.failureCount = 0;
    }
  }

  private onFailure(errorType?: string) {
    this.failureCount += 1;
    this.lastFailureTime = Date.now();

    if (errorType === '429' || this.failureCount >= this.failureThreshold) {
      this.circuitState = 'OPEN';
    }
  }
}

export const aiProviderRouter = new AIProviderRouter();
