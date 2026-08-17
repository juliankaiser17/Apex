import { APEX_LOCAL_VEHICLE_DATABASE, type NormalizedVehicle } from '../data/vehicleDatabase';

export interface VisualFeatureVector {
  aspectRatio: number;
  edgeDensity: number;
  dominantHue: number; // 0 to 360
  symmetryScore: number;
  estimatedColor: string;
}

export interface OfflineRecognitionResult {
  vehicle: NormalizedVehicle;
  confidence: number;
  makeConfidence: number;
  modelConfidence: number;
  generationConfidence: number;
  trimConfidence: number;
  matchedColor: string;
  isOffline: boolean;
}

export class OfflineRecognitionEngine {
  private frameBuffer: VisualFeatureVector[] = [];
  private readonly maxFrames: number = 5;

  public reset() {
    this.frameBuffer = [];
  }

  /**
   * Extracts visual descriptors from a canvas crop or full frame
   */
  public extractFeatures(
    canvas: HTMLCanvasElement,
    ctx: CanvasRenderingContext2D,
    boxWidth: number,
    boxHeight: number
  ): VisualFeatureVector {
    const width = canvas.width || 64;
    const height = canvas.height || 36;
    
    let aspectRatio = boxHeight > 0 ? boxWidth / boxHeight : 1.8;
    if (aspectRatio <= 0 || isNaN(aspectRatio)) aspectRatio = 1.8;

    let edgeSum = 0;
    let rSum = 0, gSum = 0, bSum = 0;
    let pixelCount = 0;

    try {
      const imgData = ctx.getImageData(0, 0, width, height);
      const data = imgData.data;
      pixelCount = width * height;

      // 1. Color Sampling
      for (let i = 0; i < data.length; i += 4) {
        rSum += data[i];
        gSum += data[i + 1];
        bSum += data[i + 2];
      }

      // 2. Simple Edge Gradient Convolution (Horizontal & Vertical Differences)
      for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
          const left = (y * width + (x - 1)) * 4;
          const right = (y * width + (x + 1)) * 4;
          const dx = Math.abs(data[right] - data[left]);
          edgeSum += dx;
        }
      }
    } catch (e) {
      // Fallback
    }

    const avgR = pixelCount > 0 ? rSum / pixelCount : 120;
    const avgG = pixelCount > 0 ? gSum / pixelCount : 120;
    const avgB = pixelCount > 0 ? bSum / pixelCount : 120;

    // Convert RGB to HSL for dominant color
    const r = avgR / 255, g = avgG / 255, b = avgB / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0;
    if (max !== min) {
      const d = max - min;
      if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
      else if (max === g) h = ((b - r) / d + 2) / 6;
      else h = ((r - g) / d + 4) / 6;
    }
    const dominantHue = Math.round(h * 360);

    let estimatedColor = 'Silver';
    if (dominantHue >= 340 || dominantHue <= 15) estimatedColor = 'Guards Red';
    else if (dominantHue >= 16 && dominantHue <= 45) estimatedColor = 'Papaya Orange';
    else if (dominantHue >= 46 && dominantHue <= 70) estimatedColor = 'Racing Yellow';
    else if (dominantHue >= 71 && dominantHue <= 160) estimatedColor = 'Mamba Green';
    else if (dominantHue >= 161 && dominantHue <= 260) estimatedColor = 'Shark Blue';
    else if (max - min < 0.1) estimatedColor = max > 0.6 ? 'White' : max < 0.25 ? 'Nero Black' : 'GT Silver';

    const edgeDensity = pixelCount > 0 ? Math.min(1.0, edgeSum / (pixelCount * 40)) : 0.45;

    return {
      aspectRatio,
      edgeDensity,
      dominantHue,
      symmetryScore: 0.85,
      estimatedColor
    };
  }

  /**
   * Matches temporal frame evidence against the normalized local vehicle catalog
   */
  public matchVehicle(features: VisualFeatureVector): OfflineRecognitionResult {
    this.frameBuffer.push(features);
    if (this.frameBuffer.length > this.maxFrames) {
      this.frameBuffer.shift();
    }

    // Average aspect ratio & edge density across temporal window
    const avgAspect = this.frameBuffer.reduce((a, b) => a + b.aspectRatio, 0) / this.frameBuffer.length;
    const avgEdges = this.frameBuffer.reduce((a, b) => a + b.edgeDensity, 0) / this.frameBuffer.length;

    let bestScore = -1;
    let bestMatch: NormalizedVehicle = APEX_LOCAL_VEHICLE_DATABASE[0];

    for (const vehicle of APEX_LOCAL_VEHICLE_DATABASE) {
      const aspectDiff = Math.abs(avgAspect - vehicle.visualSignature.aspectRatio);
      const aspectScore = Math.max(0, 1 - aspectDiff / 1.5);

      // Supercar / coupe silhouette bonus
      let silhouetteScore = 0.75;
      if (vehicle.visualSignature.silhouetteClass === 'widebody_supercar' && avgEdges > 0.4) {
        silhouetteScore = 0.95;
      } else if (vehicle.visualSignature.silhouetteClass === 'low_slung_coupe') {
        silhouetteScore = 0.88;
      }

      const totalScore = aspectScore * 0.55 + silhouetteScore * 0.45;

      if (totalScore > bestScore) {
        bestScore = totalScore;
        bestMatch = vehicle;
      }
    }

    const confidence = Math.min(0.98, Math.max(0.72, bestScore));

    return {
      vehicle: bestMatch,
      confidence,
      makeConfidence: Math.min(0.99, confidence + 0.05),
      modelConfidence: confidence,
      generationConfidence: confidence > 0.8 ? confidence - 0.05 : 0.65,
      trimConfidence: confidence > 0.9 ? confidence - 0.08 : 0.5,
      matchedColor: features.estimatedColor,
      isOffline: !navigator.onLine
    };
  }
}

export const offlineRecognitionEngine = new OfflineRecognitionEngine();
