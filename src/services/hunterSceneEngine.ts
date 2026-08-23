export interface HunterTargetCandidate {
  id: string;
  index: number;
  x: number; // Centroid percentage X (0 to 100)
  y: number; // Centroid percentage Y (0 to 100)
  width: number; // Bounding box width %
  height: number; // Bounding box height %
  confidence: number; // 0.0 to 1.0
  status: 'tracking' | 'lost' | 'reacquired' | 'locking' | 'locked';
  isRecommended: boolean;
  lastSeenAt: number;
}

export interface ApproachGuidance {
  type: 'distance' | 'motion' | 'angle' | 'lighting' | 'steady' | 'none';
  instruction: string;
  severity: 'info' | 'warning' | 'alert';
}

export interface SceneProcessingResult {
  hasVehicle: boolean;
  isStableTarget: boolean;
  candidates: HunterTargetCandidate[];
  primaryTarget: HunterTargetCandidate | null;
  guidance: ApproachGuidance;
}

export class HunterSceneEngine {
  private targets: Map<string, HunterTargetCandidate> = new Map();
  private selectedTargetId: string | null = null;
  private consecutiveFramesWithCar: number = 0;
  private lastVehicleDetectedTime: number = 0;
  private readonly gracePeriodMs: number = 700; // brief grace period to absorb a single dropped frame, not long enough to keep a stale false-positive alive

  public reset() {
    this.targets.clear();
    this.selectedTargetId = null;
    this.consecutiveFramesWithCar = 0;
    this.lastVehicleDetectedTime = 0;
  }

  /**
   * Process a live scene frame to detect and track vehicles with temporal stability
   */
  public processScene(
    videoElement: HTMLVideoElement | null,
    canvasElement: HTMLCanvasElement | null
  ): SceneProcessingResult {
    const now = Date.now();
    let detectedInFrame = false;
    let avgLuminance = 120;

    // Optical frame evaluation
    // NOTE: this is a heuristic optical proxy (luminance + 2D edge structure), not a trained
    // object-detection model. It cannot achieve true semantic "is this a car" certainty on-device
    // without bundling a real vision model. The checks below are tuned to sharply reduce false
    // positives on plain, texturally-flat or texturally-uniform, non-vehicle scenes (walls, open
    // road, sky, grass, pavement) by requiring BOTH strong 2D edge density AND that the edge
    // energy is concentrated toward the center of frame (where a user-framed vehicle sits),
    // rather than any single global contrast/texture signal.
    if (videoElement && canvasElement && videoElement.videoWidth > 0) {
      try {
        const ctx = canvasElement.getContext('2d', { willReadFrequently: true });
        if (ctx) {
          const W = 64, H = 36;
          canvasElement.width = W;
          canvasElement.height = H;
          ctx.drawImage(videoElement, 0, 0, W, H);
          const imgData = ctx.getImageData(0, 0, W, H);
          const data = imgData.data;
          const pixelCount = W * H;

          // Precompute per-pixel luminance grid once.
          const lumGrid = new Float32Array(pixelCount);
          let totalLum = 0;
          for (let p = 0; p < pixelCount; p++) {
            const i = p * 4;
            const lum = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
            lumGrid[p] = lum;
            totalLum += lum;
          }
          avgLuminance = totalLum / pixelCount;

          // True 2D gradient magnitude (horizontal + vertical neighbor diffs), not a
          // row-major linear scan that silently blends adjacent rows together.
          // Track edge energy separately for the center region (inner ~50%) vs the
          // full frame so we can require the edges to be centrally concentrated.
          const cx0 = Math.floor(W * 0.25), cx1 = Math.ceil(W * 0.75);
          const cy0 = Math.floor(H * 0.2), cy1 = Math.ceil(H * 0.8);
          // Per-pixel edge threshold — a real edge (bumper line, window trim, wheel arch)
          // reads much stronger than diffuse texture noise (foliage, gravel, carpet, brick).
          const EDGE_PIXEL_THRESHOLD = 22;

          let totalEdgeEnergy = 0;
          let centerEdgeEnergy = 0;
          let strongEdgePixels = 0;

          for (let y = 1; y < H - 1; y++) {
            for (let x = 1; x < W - 1; x++) {
              const p = y * W + x;
              const gx = Math.abs(lumGrid[p + 1] - lumGrid[p - 1]);
              const gy = Math.abs(lumGrid[p + W] - lumGrid[p - W]);
              const mag = gx + gy;
              totalEdgeEnergy += mag;
              if (mag > EDGE_PIXEL_THRESHOLD) strongEdgePixels++;
              if (x >= cx0 && x < cx1 && y >= cy0 && y < cy1) centerEdgeEnergy += mag;
            }
          }

          const strongEdgeDensity = strongEdgePixels / pixelCount; // fraction of pixels with a real edge
          const centerShare = totalEdgeEnergy > 0 ? centerEdgeEnergy / totalEdgeEnergy : 0;
          const centerArea = (cx1 - cx0) * (cy1 - cy0) / pixelCount; // ~0.30 for the box above

          // Require: enough light to see by, a meaningfully high density of real (not
          // diffuse-texture) edges, AND those edges concentrated in the reticle's center
          // well beyond what the center region's raw area share would predict at random
          // (i.e. not just "the whole frame is uniformly textured").
          if (
            avgLuminance > 22 &&
            strongEdgeDensity > 0.085 &&
            centerShare > centerArea * 1.6
          ) {
            detectedInFrame = true;
          }
        }
      } catch (e) {
        // Fallback
      }
    }

    if (detectedInFrame) {
      this.consecutiveFramesWithCar++;
      this.lastVehicleDetectedTime = now;
    } else {
      // Decay faster than we accumulate so a brief false trigger (e.g. passing behind a
      // textured wall) doesn't linger and keep the "potential discovery" state alive.
      this.consecutiveFramesWithCar = Math.max(0, this.consecutiveFramesWithCar - 2);
    }

    // Has vehicle is true only after sustained multi-frame agreement, or within the (short)
    // grace period immediately after losing a previously-sustained detection.
    const isWithinGracePeriod = (now - this.lastVehicleDetectedTime) < this.gracePeriodMs && this.lastVehicleDetectedTime > 0 && this.consecutiveFramesWithCar > 0;
    const hasVehicle = (this.consecutiveFramesWithCar >= 6) || isWithinGracePeriod;
    const isStableTarget = this.consecutiveFramesWithCar >= 9;

    // Manage targets based on real detection
    if (hasVehicle) {
      if (this.targets.size === 0) {
        const primary: HunterTargetCandidate = {
          id: 'target-01',
          index: 1,
          x: 50,
          y: 48,
          width: 60,
          height: 36,
          confidence: Math.min(0.96, 0.72 + (this.consecutiveFramesWithCar * 0.05)),
          status: 'tracking',
          isRecommended: true,
          lastSeenAt: now
        };
        this.targets.set(primary.id, primary);
        this.selectedTargetId = primary.id;
      } else {
        const primary = this.targets.get(this.selectedTargetId || 'target-01') || this.targets.values().next().value;
        if (primary) {
          primary.confidence = Math.min(0.98, 0.75 + (this.consecutiveFramesWithCar * 0.04));
          primary.status = detectedInFrame ? 'tracking' : 'lost';
          primary.lastSeenAt = now;
        }
      }
    } else {
      // Clean no-car state: completely clear targets
      this.targets.clear();
      this.selectedTargetId = null;
    }

    const candidatesList = Array.from(this.targets.values());
    const primaryTarget = this.selectedTargetId 
      ? this.targets.get(this.selectedTargetId) || candidatesList[0] || null
      : candidatesList[0] || null;

    // Contextual Approach Guidance
    let guidance: ApproachGuidance = {
      type: 'none',
      instruction: '',
      severity: 'info'
    };

    if (!hasVehicle) {
      guidance = {
        type: 'none',
        instruction: '',
        severity: 'info'
      };
    } else if (avgLuminance < 25) {
      guidance = {
        type: 'lighting',
        instruction: 'LOW LIGHTING — MOVE CLOSER',
        severity: 'warning'
      };
    } else if (isStableTarget) {
      guidance = {
        type: 'steady',
        instruction: 'TARGET ACQUIRED — TAP CAPTURE',
        severity: 'info'
      };
    } else {
      guidance = {
        type: 'distance',
        instruction: 'ALIGN VEHICLE IN RETICLE',
        severity: 'info'
      };
    }

    return {
      hasVehicle,
      isStableTarget,
      candidates: candidatesList,
      primaryTarget,
      guidance
    };
  }

  public selectTarget(targetId: string): HunterTargetCandidate | null {
    if (this.targets.has(targetId)) {
      this.selectedTargetId = targetId;
      const target = this.targets.get(targetId)!;
      target.status = 'tracking';
      return target;
    }
    return null;
  }

  public lockTarget(): HunterTargetCandidate | null {
    if (this.selectedTargetId && this.targets.has(this.selectedTargetId)) {
      const target = this.targets.get(this.selectedTargetId)!;
      target.status = 'locked';
      return target;
    }
    return null;
  }
}

export const hunterSceneEngine = new HunterSceneEngine();
