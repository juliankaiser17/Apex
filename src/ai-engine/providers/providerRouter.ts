/**
 * APEX — AI Provider Router & Circuit Breaker Controller
 * Enforces global AI concurrency limits, rate limit tracking, circuit breaker tripping, and graceful fallback.
 */

import type { AIProvider, AIProviderRequest, AIProviderResponse } from './types';
import { GeminiProvider } from './geminiProvider';
import { MockFallbackProvider } from './mockFallbackProvider';
import type { CircuitBreakerState, ProviderCapacityConfig } from '../types';

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
  private maxConcurrency: number = 30;
  private dailyScansCount: number = 0;
  private dailyCostEstimateUsd: number = 0;

  // Provider configuration
  private config: ProviderCapacityConfig = {
    providerName: 'Google Gemini',
    primaryModel: 'gemini-2.5-flash',
    secondaryModel: 'gemini-2.5-pro',
    rpmLimit: 120,
    tpmLimit: 100000,
    maxConcurrency: 30,
    timeoutMs: 25000,
    costPerScanUsd: 0.0015,
    dailyBudgetUsd: 250.0,
    monthlyBudgetUsd: 7500.0,
    enabled: true
  };

  constructor(primaryProvider?: AIProvider, fallbackProvider?: AIProvider) {
    this.primaryProvider = primaryProvider || new GeminiProvider();
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
    return (this.config.enabled && isPrimary && this.getCircuitState() !== 'OPEN') ? 'GeminiProvider' : 'MockFallbackProvider';
  }

  public updateConfig(newConfig: Partial<ProviderCapacityConfig>) {
    this.config = { ...this.config, ...newConfig };
    if (newConfig.maxConcurrency) {
      this.maxConcurrency = newConfig.maxConcurrency;
    }
  }

  private fallbackEnabled: boolean = true;

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
    const isFallbackDisabled = !this.fallbackEnabled || Boolean(request.options?.disableFallback);
    const providerAttempted = this.primaryProvider.name;

    // 1. Check if circuit is OPEN or Concurrency is Saturated
    const isPrimaryAvailable = await this.primaryProvider.isAvailable();
    const canAttemptPrimary =
      this.config.enabled &&
      isPrimaryAvailable &&
      currentState !== 'OPEN' &&
      this.activeConcurrency < this.maxConcurrency;

    if (!canAttemptPrimary) {
      if (isFallbackDisabled) {
        return {
          success: false,
          error: `Primary vision provider unavailable (isAvailable=${isPrimaryAvailable}, circuitState=${currentState}). Fallback disabled by test policy.`,
          errorType: !isPrimaryAvailable ? 'AUTH_ERROR' : currentState === 'OPEN' ? '429' : 'PROVIDER_UNAVAILABLE',
          providerName: this.primaryProvider.name,
          modelUsed: 'none',
          providerAttempted,
          fallbackUsed: false,
          tokensConsumed: { promptTokens: 0, outputTokens: 0, totalTokens: 0 },
          durationMs: 0
        };
      }
      // Degrade gracefully to high-performance local fallback
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

      // Handle Provider Failures (429 / 5xx / Timeout)
      this.onFailure(response.errorType);

      if (isFallbackDisabled) {
        return {
          ...response,
          providerAttempted,
          fallbackUsed: false
        };
      }

      // Fallback immediately so user never suffers a failed scan
      const fallbackResponse = await this.fallbackProvider.identify(request);
      return {
        ...fallbackResponse,
        providerAttempted,
        fallbackUsed: true,
        error: `Primary AI degraded (${response.error || 'Throttled'}). Used fallback engine.`
      };
    } catch (err: any) {
      this.onFailure('5xx');
      if (isFallbackDisabled) {
        return {
          success: false,
          error: err?.message || 'Primary provider threw exception',
          errorType: '5xx',
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
