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

export type AIProviderErrorType =
  | '429'
  | '5xx'
  | 'TIMEOUT'
  | 'INVALID_OUTPUT'
  | 'AUTH_ERROR'
  | 'PROVIDER_UNAVAILABLE'
  | 'VISION_QUOTA_EXHAUSTED'
  | 'MODEL_AGREEMENT_REQUIRED'
  | 'PROVIDER_CAPACITY'
  | 'INVALID_MODEL'
  | 'REQUEST_TOO_LARGE'
  | 'NETWORK_ERROR';

export interface AIProviderResponse {
  success: boolean;
  output?: ModelIdentificationOutput;
  canonicalResult?: CanonicalScanResult;
  error?: string;
  errorType?: AIProviderErrorType | string;
  providerStatus?: number;
  providerErrorCode?: number | string;
  retriesAttempted?: number;
  retryConsumed?: boolean;
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
