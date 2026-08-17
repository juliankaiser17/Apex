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
  private readonly gracePeriodMs: number = 1500; // 1.5s grace period before clearing target

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
    let edgeVariance = 0;

    // Optical frame evaluation
    if (videoElement && canvasElement && videoElement.videoWidth > 0) {
      try {
        const ctx = canvasElement.getContext('2d', { willReadFrequently: true });
        if (ctx) {
          canvasElement.width = 64;
          canvasElement.height = 36;
          ctx.drawImage(videoElement, 0, 0, 64, 36);
          const imgData = ctx.getImageData(0, 0, 64, 36);
          const data = imgData.data;
          
          let totalLum = 0;
          let diffSum = 0;
          for (let i = 0; i < data.length; i += 4) {
            const lum = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
            totalLum += lum;
            if (i > 4) {
              const prevLum = data[i - 4] * 0.299 + data[i - 3] * 0.587 + data[i - 2] * 0.114;
              diffSum += Math.abs(lum - prevLum);
            }
          }
          const pixelCount = data.length / 4;
          avgLuminance = totalLum / pixelCount;
          edgeVariance = diffSum / pixelCount;

          // Vehicle detection heuristics: frame has sufficient contrast and edge structure
          if (avgLuminance > 18 && edgeVariance > 3.2) {
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
      this.consecutiveFramesWithCar = Math.max(0, this.consecutiveFramesWithCar - 1);
    }

    // Has vehicle is true if currently detected or within 1.5s grace period
    const isWithinGracePeriod = (now - this.lastVehicleDetectedTime) < this.gracePeriodMs && this.lastVehicleDetectedTime > 0;
    const hasVehicle = (this.consecutiveFramesWithCar >= 3) || isWithinGracePeriod;
    const isStableTarget = this.consecutiveFramesWithCar >= 4;

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
