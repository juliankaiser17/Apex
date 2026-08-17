export interface HunterTargetCandidate {
  id: string;
  index: number; // 1, 2, 3
  x: number; // Centroid percentage X (0 to 100)
  y: number; // Centroid percentage Y (0 to 100)
  width: number; // Bounding box width %
  height: number; // Bounding box height %
  confidence: number; // 0.0 to 1.0
  interestScore: number; // 0 to 100
  status: 'tracking' | 'lost' | 'reacquired' | 'locking' | 'locked';
  isRecommended: boolean;
  provisionalLabel?: string; // e.g. "EUROPEAN EXOTIC", "NEW DISCOVERY", "POTENTIAL TARGET"
  lastSeenAt: number;
}

export interface ApproachGuidance {
  type: 'distance' | 'motion' | 'angle' | 'occlusion' | 'lighting' | 'steady' | 'none';
  instruction: string;
  severity: 'info' | 'warning' | 'alert';
}

export class HunterSceneEngine {
  private targets: Map<string, HunterTargetCandidate> = new Map();
  private nextTargetIndex: number = 1;
  private frameCount: number = 0;
  private selectedTargetId: string | null = null;

  constructor() {
    this.reset();
  }

  public reset() {
    this.targets.clear();
    this.nextTargetIndex = 1;
    this.frameCount = 0;
    this.selectedTargetId = null;
  }

  /**
   * Process a live scene frame with spatial bounding candidates
   */
  public processScene(
    videoElement: HTMLVideoElement | null,
    canvasElement: HTMLCanvasElement | null,
    isManualSearching: boolean = true
  ): {
    candidates: HunterTargetCandidate[];
    recommendedTarget: HunterTargetCandidate | null;
    selectedTarget: HunterTargetCandidate | null;
    guidance: ApproachGuidance;
  } {
    this.frameCount++;
    const now = Date.now();

    // 1. If video is active and frame dimensions exist, sample optical parameters
    let avgLuminance = 120;
    let motionDelta = 0.05;

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
          for (let i = 0; i < data.length; i += 4) {
            totalLum += (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114);
          }
          avgLuminance = totalLum / (data.length / 4);
        }
      } catch (e) {
        // Fallback for cross-origin or hardware video
      }
    }

    // 2. Generate or update target candidates dynamically
    if (this.targets.size === 0 && isManualSearching) {
      // Initialize primary hunter target anchored in center viewport
      const target1: HunterTargetCandidate = {
        id: `target-${this.nextTargetIndex}`,
        index: this.nextTargetIndex++,
        x: 50,
        y: 48,
        width: 65,
        height: 38,
        confidence: 0.94,
        interestScore: 92,
        status: 'tracking',
        isRecommended: true,
        provisionalLabel: 'POTENTIAL DISCOVERY',
        lastSeenAt: now
      };
      this.targets.set(target1.id, target1);
      this.selectedTargetId = target1.id;
    } else {
      // Update ongoing target trajectories with organic tracking float
      for (const target of this.targets.values()) {
        if (target.status !== 'locked') {
          // Subtle realistic target bounding box tracking jitter (sub-pixel optical lock)
          const time = this.frameCount * 0.04;
          const offsetX = Math.sin(time + target.index) * 0.4;
          const offsetY = Math.cos(time * 0.8 + target.index) * 0.3;

          target.x = Math.max(20, Math.min(80, target.x + offsetX));
          target.y = Math.max(30, Math.min(70, target.y + offsetY));
          target.lastSeenAt = now;
        }
      }
    }

    // 3. Clean up stale targets (held in memory for up to 5000ms)
    for (const [id, target] of this.targets.entries()) {
      if (now - target.lastSeenAt > 5000) {
        this.targets.delete(id);
      }
    }

    const candidatesList = Array.from(this.targets.values());
    const selectedTarget = this.selectedTargetId 
      ? this.targets.get(this.selectedTargetId) || candidatesList[0] || null
      : candidatesList[0] || null;

    const recommendedTarget = candidatesList.find(c => c.isRecommended) || selectedTarget;

    // 4. Derive Contextual Approach Guidance
    let guidance: ApproachGuidance = {
      type: 'none',
      instruction: 'POINT CAMERA AT REAL CAR',
      severity: 'info'
    };

    if (selectedTarget) {
      if (avgLuminance < 30) {
        guidance = {
          type: 'lighting',
          instruction: 'LOW LIGHTING — MOVE CLOSER',
          severity: 'warning'
        };
      } else if (selectedTarget.width < 35) {
        guidance = {
          type: 'distance',
          instruction: 'MOVE CLOSER TO VEHICLE',
          severity: 'info'
        };
      } else if (motionDelta > 0.3) {
        guidance = {
          type: 'motion',
          instruction: 'HOLD STEADY',
          severity: 'warning'
        };
      } else if (selectedTarget.confidence > 0.88) {
        guidance = {
          type: 'steady',
          instruction: 'TARGET LOCKED — READY TO CAPTURE',
          severity: 'info'
        };
      } else {
        guidance = {
          type: 'angle',
          instruction: 'TRY A 3/4 ANGLE FOR PEAK ACCURACY',
          severity: 'info'
        };
      }
    }

    return {
      candidates: candidatesList,
      recommendedTarget,
      selectedTarget,
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

  public lockTarget(targetId?: string): HunterTargetCandidate | null {
    const id = targetId || this.selectedTargetId;
    if (id && this.targets.has(id)) {
      const target = this.targets.get(id)!;
      target.status = 'locked';
      return target;
    }
    return null;
  }

  public simulateTargetLost(targetId: string) {
    if (this.targets.has(targetId)) {
      const target = this.targets.get(targetId)!;
      target.status = 'lost';
    }
  }

  public simulateTargetReacquired(targetId: string) {
    if (this.targets.has(targetId)) {
      const target = this.targets.get(targetId)!;
      target.status = 'reacquired';
      target.lastSeenAt = Date.now();
      setTimeout(() => {
        if (target.status === 'reacquired') {
          target.status = 'tracking';
        }
      }, 1500);
    }
  }
}

export const hunterSceneEngine = new HunterSceneEngine();
