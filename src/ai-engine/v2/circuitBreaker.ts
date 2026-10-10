/**
 * APEX v2 — Circuit Breaker for Multimodal Vision Providers
 * 
 * Protects downstream inference pipelines from cascading quota exhaustion (HTTP 429),
 * consecutive timeouts, and provider outages.
 * 
 * States:
 * - CLOSED: Normal operational state. All calls pass through.
 * - OPEN: Provider tripped (consecutive errors or 429). Calls fail fast or route to fallback.
 * - HALF_OPEN: Cooldown expired. Single test probe permitted to check recovery.
 */

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface CircuitBreakerOptions {
  failureThreshold?: number;
  cooldownMs?: number;
}

export class CircuitBreaker {
  public readonly providerId: string;
  private state: CircuitState = 'CLOSED';
  private failureCount = 0;
  private lastFailureTime = 0;
  private readonly failureThreshold: number;
  private readonly cooldownMs: number;

  constructor(providerId: string, options: CircuitBreakerOptions = {}) {
    this.providerId = providerId;
    this.failureThreshold = options.failureThreshold || 3;
    this.cooldownMs = options.cooldownMs || 30000;
  }

  public getState(): CircuitState {
    if (this.state === 'OPEN') {
      const elapsed = Date.now() - this.lastFailureTime;
      if (elapsed >= this.cooldownMs) {
        this.state = 'HALF_OPEN';
      }
    }
    return this.state;
  }

  public isAvailable(): boolean {
    const s = this.getState();
    return s === 'CLOSED' || s === 'HALF_OPEN';
  }

  public recordSuccess(): void {
    this.failureCount = 0;
    this.state = 'CLOSED';
  }

  public recordFailure(isFatalQuota: boolean = false): void {
    this.lastFailureTime = Date.now();
    this.failureCount++;

    if (isFatalQuota || this.failureCount >= this.failureThreshold) {
      this.state = 'OPEN';
      console.warn(`[CircuitBreaker] Provider "${this.providerId}" tripped to OPEN state (failures: ${this.failureCount}, isFatalQuota: ${isFatalQuota}). Fallback activated.`);
    }
  }

  public reset(): void {
    this.state = 'CLOSED';
    this.failureCount = 0;
    this.lastFailureTime = 0;
  }
}

export const geminiCircuitBreaker = new CircuitBreaker('gemini', { failureThreshold: 3, cooldownMs: 45000 });
export const cloudflareCircuitBreaker = new CircuitBreaker('cloudflare', { failureThreshold: 5, cooldownMs: 30000 });
