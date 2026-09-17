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
    format?: 'messages' | 'inst';
    schema?: 'minimal' | 'monolithic';
    maxTokens?: number;
    stream?: boolean;
    seed?: number;
    isColdStart?: boolean;
    idleBeforeRequestMs?: number;
    imagePreprocessingMs?: number;
    imageDimensions?: [number, number];
  };
}

export interface VisionStageTelemetry {
  isColdStart: boolean;
  warmState: boolean;
  idleBeforeRequestMs?: number;
  timeToFirstByteMs?: number;
  imagePreprocessingMs?: number;
  encodedImageBytes?: number;
  imageDimensions?: [number, number];
  uploadStartTimestamp: string;
  cloudflareRequestDurationMs: number;
  timeToFirstTokenMs?: number | null;
  totalModelResponseDurationMs: number;
  jsonParsingMs: number;
  deterministicValidationMs: number;
  totalEndToEndMs: number;
  neurons?: number;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
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
  neuronsConsumed?: number;
  telemetry?: VisionStageTelemetry;
  durationMs: number;
}

export interface AIProvider {
  name: string;
  isAvailable(): Promise<boolean>;
  identify(request: AIProviderRequest): Promise<AIProviderResponse>;
}
