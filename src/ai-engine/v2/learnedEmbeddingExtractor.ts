/**
 * APEX v2 — Learned Visual Embedding Extractor Architecture (Phase 12C)
 * 
 * Provides an index adapter interface supporting multiple visual feature extractors:
 * 1. Hand-Built Baseline: 64-dimensional spatial-spectral + Sobel heuristic.
 * 2. DINOv2-small: 384-dimensional self-supervised Vision Transformer (Apache-2.0).
 * 3. CLIP-ViT-B/32: 512-dimensional multimodal vision encoder (MIT).
 * 
 * INVARIANTS:
 * 1. All output vectors are unit-normalized (L2 norm = 1.00000 +/- 0.001).
 * 2. Deterministic execution: identical image pixels produce identical embeddings.
 * 3. Fail-closed: invalid or unparseable images return null, never fall back to synthetic guesses.
 * 4. Extractor type is switchable via configuration (STAGE_B_EXTRACTOR_TYPE).
 */

import { imageFeatureExtractor, EXTRACTOR_VERSION as HANDBUILT_VERSION } from './imageFeatureExtractor.ts';

export type ExtractorType = 'handbuilt' | 'dinov2' | 'clip' | 'service';

export interface IEmbeddingExtractor {
  readonly type: ExtractorType;
  readonly version: string;
  readonly dimension: number;
  readonly license: string;
  extractVector(imageInput: string | Buffer): Promise<number[] | null>;
  validateVector(vector: number[]): boolean;
}

/**
 * 1. Hand-Built 64D Spatial-Spectral Extractor (Baseline)
 */
export class HandBuiltExtractor implements IEmbeddingExtractor {
  public readonly type: ExtractorType = 'handbuilt';
  public readonly version = HANDBUILT_VERSION;
  public readonly dimension = 64;
  public readonly license = 'Internal / Proprietary';

  public async extractVector(imageInput: string | Buffer): Promise<number[] | null> {
    return await imageFeatureExtractor.extractVector(imageInput);
  }

  public validateVector(vector: number[]): boolean {
    return imageFeatureExtractor.validateVector(vector);
  }
}

/**
 * Normalizes vector to unit length (L2 norm = 1.0)
 */
export function l2Normalize(vec: number[]): number[] {
  let sumSq = 0;
  for (let i = 0; i < vec.length; i++) {
    sumSq += vec[i] * vec[i];
  }
  const norm = Math.sqrt(sumSq);
  if (norm === 0) return vec;
  return vec.map(v => Number((v / norm).toFixed(6)));
}

/**
 * Convert string (data url, file path, base64) or Buffer to image Buffer
 */
async function toImageBuffer(imageInput: string | Buffer): Promise<Buffer | null> {
  if (Buffer.isBuffer(imageInput)) return imageInput;
  if (typeof imageInput !== 'string') return null;

  const clean = imageInput.trim();
  // Safe input decoding: never treat string as a local file path
  if (clean.startsWith('data:image/')) {
    const parts = clean.split(',');
    if (parts.length < 2 || !parts[1]) return null;
    try {
      return Buffer.from(parts[1], 'base64');
    } catch {
      return null;
    }
  }

  try {
    return Buffer.from(clean, 'base64');
  } catch {
    return null;
  }
}

/**
 * 2. DINOv2-small 384D Extractor (Apache-2.0)
 * Uses Xenova/dinov2-small via ONNX Runtime WebAssembly.
 */
export class Dinov2Extractor implements IEmbeddingExtractor {
  public readonly type: ExtractorType = 'dinov2';
  public readonly version = 'dinov2-small-onnx-v1';
  public readonly dimension = 384;
  public readonly license = 'Apache-2.0';

  private pipe: any = null;
  private loadPromise: Promise<void> | null = null;

  private async ensureLoaded(): Promise<void> {
    if (this.pipe) return;
    if (this.loadPromise) return await this.loadPromise;

    this.loadPromise = (async () => {
      const { pipeline } = await import('@xenova/transformers');
      this.pipe = await pipeline('image-feature-extraction', 'Xenova/dinov2-small');
    })();

    await this.loadPromise;
  }

  public async extractVector(imageInput: string | Buffer): Promise<number[] | null> {
    try {
      const buf = await toImageBuffer(imageInput);
      if (!buf || buf.length < 100) return null;

      await this.ensureLoaded();

      const { RawImage } = await import('@xenova/transformers');
      const blob = new Blob([new Uint8Array(buf)]);
      const rawImg = await RawImage.fromBlob(blob);
      const resized = await rawImg.resize(224, 224);

      const output = await this.pipe(resized);

      // Extract CLS token (first 384 values from [1, 257, 384])
      const hiddenSize = 384;
      const rawVector = new Array(hiddenSize);
      for (let i = 0; i < hiddenSize; i++) {
        rawVector[i] = output.data[i];
      }

      return l2Normalize(rawVector);
    } catch (err) {
      console.warn('[Dinov2Extractor] Feature extraction failed:', err);
      return null;
    }
  }

  public validateVector(vector: number[]): boolean {
    if (!vector || !Array.isArray(vector) || vector.length !== this.dimension) return false;
    let sumSq = 0;
    for (let i = 0; i < vector.length; i++) {
      if (!Number.isFinite(vector[i])) return false;
      sumSq += vector[i] * vector[i];
    }
    const norm = Math.sqrt(sumSq);
    return Math.abs(norm - 1.0) < 0.01;
  }
}

/**
 * 3. CLIP-ViT-B/32 512D Extractor (MIT)
 * Uses Xenova/clip-vit-base-patch32 via ONNX Runtime.
 */
export class ClipExtractor implements IEmbeddingExtractor {
  public readonly type: ExtractorType = 'clip';
  public readonly version = 'clip-vit-b32-onnx-v1';
  public readonly dimension = 512;
  public readonly license = 'MIT';

  private pipe: any = null;
  private loadPromise: Promise<void> | null = null;

  private async ensureLoaded(): Promise<void> {
    if (this.pipe) return;
    if (this.loadPromise) return await this.loadPromise;

    this.loadPromise = (async () => {
      const { pipeline } = await import('@xenova/transformers');
      this.pipe = await pipeline('image-feature-extraction', 'Xenova/clip-vit-base-patch32');
    })();

    await this.loadPromise;
  }

  public async extractVector(imageInput: string | Buffer): Promise<number[] | null> {
    try {
      const buf = await toImageBuffer(imageInput);
      if (!buf || buf.length < 100) return null;

      await this.ensureLoaded();

      const { RawImage } = await import('@xenova/transformers');
      const blob = new Blob([new Uint8Array(buf)]);
      const rawImg = await RawImage.fromBlob(blob);
      const resized = await rawImg.resize(224, 224);

      const output = await this.pipe(resized);

      // output dims: [1, 512]
      const hiddenSize = 512;
      const rawVector = new Array(hiddenSize);
      for (let i = 0; i < hiddenSize; i++) {
        rawVector[i] = output.data[i];
      }

      return l2Normalize(rawVector);
    } catch (err) {
      console.warn('[ClipExtractor] Feature extraction failed:', err);
      return null;
    }
  }

  public validateVector(vector: number[]): boolean {
    if (!vector || !Array.isArray(vector) || vector.length !== this.dimension) return false;
    let sumSq = 0;
    for (let i = 0; i < vector.length; i++) {
      if (!Number.isFinite(vector[i])) return false;
      sumSq += vector[i] * vector[i];
    }
    const norm = Math.sqrt(sumSq);
    return Math.abs(norm - 1.0) < 0.01;
  }
}

/**
 * Singleton instances
 */
export const handbuiltExtractor = new HandBuiltExtractor();
export const dinov2Extractor = new Dinov2Extractor();
export const clipExtractor = new ClipExtractor();

import { RemoteEmbeddingServiceAdapter } from './embeddingServiceAdapter.ts';

export const remoteServiceAdapter = new RemoteEmbeddingServiceAdapter();

/**
 * Factory resolver based on configuration or explicit parameter.
 * Prefers containerized remote embedding service if EMBEDDING_SERVICE_URL is set,
 * or in-process learned extractors when configured.
 */
export function getEmbeddingExtractor(type?: ExtractorType): IEmbeddingExtractor {
  if (type === 'service' || (typeof process !== 'undefined' && process.env.EMBEDDING_SERVICE_URL)) {
    return remoteServiceAdapter;
  }

  const chosen = type || (process.env.STAGE_B_EXTRACTOR_TYPE as ExtractorType) || 'handbuilt';
  switch (chosen) {
    case 'service':
      return remoteServiceAdapter;
    case 'dinov2':
      return dinov2Extractor;
    case 'clip':
      return clipExtractor;
    case 'handbuilt':
    default:
      return handbuiltExtractor;
  }
}
