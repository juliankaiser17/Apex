/**
 * APEX — AI Provider Interface & Types
 */

import type { CandidateVehicle, CanonicalScanResult, ModelIdentificationOutput } from '../types';

export interface AIProviderRequest {
  scanId: string;
  traceId: string;
  imageDataUrl: string;
  multiFrames?: string[];
  candidates: CandidateVehicle[];
  distinguishingInstructions?: string[];
  options?: {
    modelOverride?: string;
    temperature?: number;
    timeoutMs?: number;
    disableFallback?: boolean;
  };
}

export interface AIProviderResponse {
  success: boolean;
  output?: ModelIdentificationOutput;
  canonicalResult?: CanonicalScanResult;
  error?: string;
  errorType?: '429' | '5xx' | 'TIMEOUT' | 'INVALID_OUTPUT' | 'AUTH_ERROR' | 'PROVIDER_UNAVAILABLE';
  providerName: string;
  modelUsed: string;
  providerAttempted?: string;
  fallbackUsed?: boolean;
  tokensConsumed: {
    promptTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
  durationMs: number;
}

export interface AIProvider {
  name: string;
  isAvailable(): Promise<boolean>;
  identify(request: AIProviderRequest): Promise<AIProviderResponse>;
}
