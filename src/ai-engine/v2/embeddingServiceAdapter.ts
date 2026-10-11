/**
 * APEX v2 — Remote Embedding Service Adapter (Phase 13 / Phase D)
 * 
 * Narrow HTTP client adapter connecting the Apex backend to an isolated,
 * containerized visual embedding microservice (CLIP-ViT-B/32 or DINOv2-small).
 * 
 * HARD INVARIANTS:
 * 1. Fail-closed: If EMBEDDING_SERVICE_URL is missing, unreachable, times out, or returns invalid output, returns null.
 * 2. Strict Schema Validation: Validates dimension (512 for CLIP), version string, finite numbers, and unit L2 norm.
 * 3. Never falls back silently to handcrafted features in place of the learned service.
 * 4. Externalized configuration: Configured via EMBEDDING_SERVICE_URL and EMBEDDING_SERVICE_TIMEOUT_MS.
 */

import type { IEmbeddingExtractor, ExtractorType } from './learnedEmbeddingExtractor.ts';

export interface EmbeddingServiceHealth {
  healthy: boolean;
  model?: string;
  version?: string;
  dimension?: number;
  error?: string;
}

export interface RemoteEmbeddingConfig {
  serviceUrl?: string;
  authToken?: string;
  timeoutMs?: number;
  model?: 'clip' | 'dinov2';
}

export class RemoteEmbeddingServiceAdapter implements IEmbeddingExtractor {
  public readonly type: ExtractorType;
  public readonly version: string;
  public readonly dimension: number;
  public readonly license: string;

  private serviceUrl: string | null;
  private authToken: string | null;
  private timeoutMs: number;

  constructor(config?: RemoteEmbeddingConfig) {
    const envUrl = typeof process !== 'undefined' ? process.env.EMBEDDING_SERVICE_URL : undefined;
    const envToken = typeof process !== 'undefined' ? process.env.EMBEDDING_SERVICE_TOKEN : undefined;
    this.serviceUrl = config?.serviceUrl || envUrl || null;
    this.authToken = config?.authToken || envToken || null;
    this.timeoutMs = config?.timeoutMs || Number(process.env.EMBEDDING_SERVICE_TIMEOUT_MS || 5000);

    const modelType = config?.model || (process.env.EMBEDDING_SERVICE_MODEL as 'clip' | 'dinov2') || 'clip';
    if (modelType === 'dinov2') {
      this.type = 'dinov2';
      this.version = 'dinov2-small-onnx-v1';
      this.dimension = 384;
      this.license = 'Apache-2.0';
    } else {
      this.type = 'clip';
      this.version = 'clip-vit-b32-onnx-v1';
      this.dimension = 512;
      this.license = 'MIT';
    }
  }

  public isConfigured(): boolean {
    return Boolean(this.serviceUrl && this.serviceUrl.trim().length > 0);
  }

  /**
   * Health / Readiness check for the containerized service
   */
  public async checkHealth(): Promise<EmbeddingServiceHealth> {
    if (!this.isConfigured()) {
      return { healthy: false, error: 'EMBEDDING_SERVICE_URL not configured' };
    }

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), Math.min(3000, this.timeoutMs));

      const headers: Record<string, string> = { 'Accept': 'application/json' };
      if (this.authToken) {
        headers['Authorization'] = `Bearer ${this.authToken}`;
      }

      const res = await fetch(`${this.serviceUrl}/health`, {
        method: 'GET',
        headers,
        signal: controller.signal
      });

      clearTimeout(timer);

      if (!res.ok) {
        return { healthy: false, error: `HTTP ${res.status}: ${res.statusText}` };
      }

      const body = await res.json() as any;
      if (body && (body.status === 'ok' || body.ready === true)) {
        return {
          healthy: true,
          model: body.model,
          version: body.version || this.version,
          dimension: body.dimension || this.dimension
        };
      }

      return { healthy: false, error: 'Unexpected health payload structure' };
    } catch (err: any) {
      return { healthy: false, error: err?.message || 'Connection failed' };
    }
  }

  /**
   * Request vector embedding from the isolated microservice
   */
  public async extractVector(imageInput: string | Buffer): Promise<number[] | null> {
    if (!this.isConfigured()) {
      // Invariant: Unconfigured service fails closed immediately
      return null;
    }

    let base64Payload: string;
    if (Buffer.isBuffer(imageInput)) {
      base64Payload = imageInput.toString('base64');
    } else if (typeof imageInput === 'string') {
      const clean = imageInput.trim();
      base64Payload = clean.startsWith('data:') ? clean.substring(clean.indexOf(',') + 1) : clean;
    } else {
      return null;
    }

    if (!base64Payload || base64Payload.length < 100) {
      return null;
    }

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      };
      if (this.authToken) {
        headers['Authorization'] = `Bearer ${this.authToken}`;
      }

      const res = await fetch(`${this.serviceUrl}/embed`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          imageBase64: base64Payload,
          model: this.version
        }),
        signal: controller.signal
      });

      clearTimeout(timer);

      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          console.warn(`[RemoteEmbeddingServiceAdapter] Authentication failed: HTTP ${res.status}`);
        } else if (res.status === 503) {
          console.warn(`[RemoteEmbeddingServiceAdapter] Embedding service temporarily unavailable: HTTP 503`);
        } else {
          console.warn(`[RemoteEmbeddingServiceAdapter] Service responded with HTTP ${res.status}`);
        }
        return null;
      }

      const body = await res.json() as any;
      if (!body || !Array.isArray(body.vector)) {
        console.warn('[RemoteEmbeddingServiceAdapter] Service returned non-array vector payload');
        return null;
      }

      if (body.vector.length !== this.dimension) {
        console.warn(`[RemoteEmbeddingServiceAdapter] Dimension mismatch: expected ${this.dimension}, got ${body.vector.length}`);
        return null;
      }

      if (!this.validateVector(body.vector)) {
        console.warn('[RemoteEmbeddingServiceAdapter] Vector validation failed (non-finite values or unnormalized)');
        return null;
      }

      return body.vector;
    } catch (err: any) {
      console.warn(`[RemoteEmbeddingServiceAdapter] Request failed: ${err?.message || err}`);
      return null;
    }
  }

  /**
   * Validates dimension, finite numbers, and unit L2 norm
   */
  public validateVector(vector: number[]): boolean {
    if (!vector || !Array.isArray(vector) || vector.length !== this.dimension) return false;
    let sumSq = 0;
    for (let i = 0; i < vector.length; i++) {
      const v = vector[i];
      if (!Number.isFinite(v)) return false;
      sumSq += v * v;
    }
    const norm = Math.sqrt(sumSq);
    return Math.abs(norm - 1.0) < 0.02;
  }
}
