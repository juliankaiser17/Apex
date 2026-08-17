export interface HunterTargetCandidate {
  id: string;
  index: number;
  x: number;
  y: number;
  width: number;
  height: number;
  confidence: number;
  interestScore: number;
  status: 'tracking' | 'lost' | 'reacquired' | 'locking' | 'locked';
  isRecommended: boolean;
  provisionalLabel?: string;
  lastSeenAt: number;
}

export interface ApproachGuidance {
  type: 'distance' | 'motion' | 'angle' | 'occlusion' | 'lighting' | 'steady' | 'none';
  instruction: string;
  severity: 'info' | 'warning' | 'alert';
}

export class HunterSceneEngine {
  private targets: Map<string, HunterTargetCandidate> = new Map();
  private frameCount: number = 0;
  private selectedTargetId: string | null = null;

  constructor() {
    this.reset();
  }

  public reset() {
    this.targets.clear();
    this.frameCount = 0;
    this.selectedTargetId = null;
  }

  public processScene(
    videoElement: HTMLVideoElement | null,
    canvasElement: HTMLCanvasElement | null,
    _isManualSearching: boolean = false
  ): {
    candidates: HunterTargetCandidate[];
    recommendedTarget: HunterTargetCandidate | null;
    selectedTarget: HunterTargetCandidate | null;
    guidance: ApproachGuidance;
  } {
    this.frameCount++;
    const now = Date.now();

    let avgLuminance = 120;

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
      } catch (e) {}
    }

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

    let guidance: ApproachGuidance = {
      type: 'none',
      instruction: 'POINT CAMERA AT REAL CAR',
      severity: 'info'
    };

    if (avgLuminance < 30) {
      guidance = {
        type: 'lighting',
        instruction: 'LOW LIGHTING — MOVE CLOSER',
        severity: 'warning'
      };
    } else {
      guidance = {
        type: 'steady',
        instruction: 'ALIGN CAR IN RETICLE & TAP CAPTURE',
        severity: 'info'
      };
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
}

export const hunterSceneEngine = new HunterSceneEngine();
