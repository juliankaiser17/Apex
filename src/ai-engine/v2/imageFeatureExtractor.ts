/**
 * APEX v2 — Stage B: Image-Derived Perceptual Feature Extractor
 * 
 * Extracts standardized 64-dimensional dense visual feature embeddings
 * directly from raw image pixels (aspect ratio, multi-zone HSV color distribution,
 * zero-centered spatial luminance grid, Sobel edge orientations, and symmetry moments).
 * 
 * INVARIANTS:
 * 1. Zero synthetic hint usage: Extraction relies strictly on image pixel content.
 * 2. Deterministic & Normalized: All extracted vectors have L2 norm = 1.00000 (+/- 0.001).
 * 3. Versioned: Prevents mixing vectors from different extractor revisions.
 * 4. Sub-15ms fast-path: Pure local CPU processing with zero external API calls.
 */

export const EXTRACTOR_VERSION = 'v2-sharp-spatial-spectral-v1';
export const EMBEDDING_DIMENSION = 64;

export class ImageFeatureExtractor {
  public readonly version = EXTRACTOR_VERSION;
  public readonly dimension = EMBEDDING_DIMENSION;

  /**
   * Extracts a 64-dimensional feature vector from an image data URL, base64 string, or Buffer.
   * Returns null if decoding fails or the payload is corrupt.
   */
  public async extractVector(imageInput: string | Buffer): Promise<number[] | null> {
    try {
      let buf: Buffer;

      if (typeof Buffer !== 'undefined' && Buffer.isBuffer(imageInput)) {
        buf = imageInput;
      } else if (typeof imageInput === 'string') {
        const clean = imageInput.trim();
        // Never treat an input string as a local filesystem path (prevents arbitrary file read / path traversal)
        if (clean.startsWith('data:image/')) {
          const parts = clean.split(',');
          if (parts.length < 2 || !parts[1]) return null;
          buf = Buffer.from(parts[1], 'base64');
        } else {
          // Plain base64 string
          try {
            buf = Buffer.from(clean, 'base64');
          } catch {
            return null;
          }
        }
      } else {
        return null;
      }

      if (buf.length < 500) {
        // Undersized payload cannot contain a recognizable image
        return null;
      }

      // Dynamically load sharp to avoid client bundle breakage in web targets
      let sharpModule: any;
      try {
        sharpModule = (await import('sharp')).default;
      } catch {
        // Fallback for CommonJS environments
        try {
          // @ts-ignore
          sharpModule = require('sharp');
        } catch {
          sharpModule = null;
        }
      }

      if (!sharpModule) {
        console.warn('[ImageFeatureExtractor] Sharp is not available in current runtime environment.');
        return null;
      }

      const img = sharpModule(buf);
      const metadata = await img.metadata();
      const width = metadata.width || 128;
      const height = metadata.height || 128;
      const aspectRatio = width / (height || 1);

      // 1. Resize to 48x48 sRGB for color and spatial grid analysis
      const { data: rawRgb } = await sharpModule(buf)
        .resize(48, 48, { fit: 'fill' })
        .removeAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });

      // 2. Resize to 32x32 greyscale for Sobel gradient and symmetry analysis
      const { data: rawGrey } = await sharpModule(buf)
        .resize(32, 32, { fit: 'fill' })
        .grayscale()
        .raw()
        .toBuffer({ resolveWithObject: true });

      const vector = new Array(EMBEDDING_DIMENSION).fill(0);

      // --- Dims 0-3: Aspect Ratio and Geometry Moments ---
      vector[0] = Math.tanh((aspectRatio - 1.6) * 2.0);
      vector[1] = Math.tanh((aspectRatio - 2.0) * 3.0);
      vector[2] = width > height ? 1.0 : -1.0;
      vector[3] = Math.min(1.0, Math.max(-1.0, (aspectRatio - 1.0) / 1.5));

      // --- Dims 4-27: Multi-Zone Color Distribution (3 vertical zones x 8 metrics = 24 bins) ---
      for (let zone = 0; zone < 3; zone++) {
        const startY = zone * 16;
        let rSum = 0, gSum = 0, bSum = 0;
        let satSum = 0;
        let hueCosSum = 0, hueSinSum = 0;
        const zonePixels = 16 * 48;

        for (let y = startY; y < startY + 16; y++) {
          for (let x = 0; x < 48; x++) {
            const idx = (y * 48 + x) * 3;
            const r = rawRgb[idx] / 255;
            const g = rawRgb[idx + 1] / 255;
            const b = rawRgb[idx + 2] / 255;
            rSum += r; gSum += g; bSum += b;

            const max = Math.max(r, g, b);
            const min = Math.min(r, g, b);
            const d = max - min;
            const s = max === 0 ? 0 : d / max;
            satSum += s;

            let h = 0;
            if (d !== 0) {
              if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
              else if (max === g) h = ((b - r) / d + 2) / 6;
              else h = ((r - g) / d + 4) / 6;
            }
            hueCosSum += Math.cos(2 * Math.PI * h);
            hueSinSum += Math.sin(2 * Math.PI * h);
          }
        }

        const baseIdx = 4 + zone * 8;
        vector[baseIdx] = (rSum / zonePixels) - 0.5;
        vector[baseIdx + 1] = (gSum / zonePixels) - 0.5;
        vector[baseIdx + 2] = (bSum / zonePixels) - 0.5;
        vector[baseIdx + 3] = (satSum / zonePixels) - 0.4;
        vector[baseIdx + 4] = hueCosSum / zonePixels;
        vector[baseIdx + 5] = hueSinSum / zonePixels;
        vector[baseIdx + 6] = (rSum - (gSum + bSum) * 0.5) / zonePixels;
        vector[baseIdx + 7] = (bSum - (rSum + gSum) * 0.5) / zonePixels;
      }

      // --- Dims 28-43: Spatial Silhouette & Luminance Profile (16 bins) ---
      let globalLuma = 0;
      const tileLuma = new Array(16).fill(0);
      for (let ty = 0; ty < 4; ty++) {
        for (let tx = 0; tx < 4; tx++) {
          let sum = 0;
          for (let y = ty * 12; y < (ty + 1) * 12; y++) {
            for (let x = tx * 48 / 4; x < (tx + 1) * 12; x++) {
              const idx = (y * 48 + x) * 3;
              sum += (0.299 * rawRgb[idx] + 0.587 * rawRgb[idx + 1] + 0.114 * rawRgb[idx + 2]) / 255;
            }
          }
          const avg = sum / (12 * 12);
          tileLuma[ty * 4 + tx] = avg;
          globalLuma += avg;
        }
      }
      globalLuma /= 16;
      for (let i = 0; i < 16; i++) {
        vector[28 + i] = tileLuma[i] - globalLuma;
      }

      // --- Dims 44-59: Spatial Sobel Gradients (16 bins) ---
      for (let qy = 0; qy < 2; qy++) {
        for (let qx = 0; qx < 2; qx++) {
          const qIdx = 44 + (qy * 2 + qx) * 4;
          let hGrad = 0, vGrad = 0, diag1Grad = 0, diag2Grad = 0;
          const startY = qy * 15 + 1;
          const startX = qx * 15 + 1;

          for (let y = startY; y < startY + 15; y++) {
            for (let x = startX; x < startX + 15; x++) {
              const idx = y * 32 + x;
              const dx = (rawGrey[idx + 1] - rawGrey[idx - 1]) / 255;
              const dy = (rawGrey[idx + 32] - rawGrey[idx - 32]) / 255;

              hGrad += Math.abs(dx);
              vGrad += Math.abs(dy);
              diag1Grad += Math.abs(dx + dy) * 0.707;
              diag2Grad += Math.abs(dx - dy) * 0.707;
            }
          }

          const qPixels = 15 * 15;
          vector[qIdx] = (hGrad / qPixels) - 0.15;
          vector[qIdx + 1] = (vGrad / qPixels) - 0.15;
          vector[qIdx + 2] = (diag1Grad / qPixels) - 0.15;
          vector[qIdx + 3] = (diag2Grad / qPixels) - 0.15;
        }
      }

      // --- Dims 60-63: Horizontal Symmetry Differential (4 bins) ---
      for (let band = 0; band < 4; band++) {
        let symDiff = 0;
        const startY = band * 8;
        for (let y = startY; y < startY + 8; y++) {
          for (let x = 0; x < 16; x++) {
            const left = rawGrey[y * 32 + x] / 255;
            const right = rawGrey[y * 32 + (31 - x)] / 255;
            symDiff += Math.abs(left - right);
          }
        }
        vector[60 + band] = 0.5 - (symDiff / (8 * 16));
      }

      // --- L2 Normalization to Unit Sphere ---
      let sumSq = 0;
      for (let i = 0; i < EMBEDDING_DIMENSION; i++) {
        sumSq += vector[i] * vector[i];
      }
      const norm = Math.sqrt(sumSq) || 1.0;
      return vector.map(v => Number((v / norm).toFixed(5)));
    } catch (err: any) {
      console.warn('[ImageFeatureExtractor] Extraction error:', err?.message || err);
      return null;
    }
  }

  /**
   * Computes cosine similarity between two unit-normalized vectors
   */
  public computeCosineSimilarity(a: number[], b: number[]): number {
    if (!a || !b || a.length !== this.dimension || b.length !== this.dimension) {
      return 0.0;
    }
    let dot = 0.0;
    for (let i = 0; i < this.dimension; i++) {
      dot += a[i] * b[i];
    }
    return Math.max(-1.0, Math.min(1.0, dot));
  }

  /**
   * Computes the normalized centroid of multiple feature vectors
   */
  public computeCentroid(vectors: number[][]): number[] {
    if (!vectors || vectors.length === 0) return [];
    const centroid = new Array(this.dimension).fill(0);
    for (const v of vectors) {
      if (v.length === this.dimension) {
        for (let i = 0; i < this.dimension; i++) {
          centroid[i] += v[i];
        }
      }
    }
    for (let i = 0; i < this.dimension; i++) {
      centroid[i] /= vectors.length;
    }
    const norm = Math.sqrt(centroid.reduce((s, v) => s + v * v, 0)) || 1.0;
    return centroid.map(v => Number((v / norm).toFixed(5)));
  }

  /**
   * Validates if a vector matches dimension and unit norm
   */
  public validateVector(vec: number[] | null | undefined): boolean {
    if (!vec || !Array.isArray(vec) || vec.length !== this.dimension) return false;
    const normSq = vec.reduce((s, v) => s + v * v, 0);
    return Math.abs(normSq - 1.0) < 0.01;
  }
}

export const imageFeatureExtractor = new ImageFeatureExtractor();
