/**
 * APEX — Production Feature Flags & Rollback Controls
 * 
 * Central control for progressive rollout and emergency kill switches.
 * 
 * Rollout Stages:
 * - STAGE_0_DISABLED: Local rarity completely disabled (100% universal global rarity).
 * - STAGE_1_INTERNAL_TEST: Active for internal dogfooding & statistical verification.
 * - STAGE_2_UI_ONLY: Local Sighting Rarity displayed visually; XP modifier pinned to 1.00x baseline.
 * - STAGE_3_FULL_ROLLOUT: Full local rarity model and bounded local XP modifiers active.
 * 
 * LOCAL_RARITY_ENABLED and LOCAL_RARITY_XP_ENABLED are maintained as independent controls
 * to decouple display from economy mutations during forensic evaluation.
 */

export type LocalRarityRolloutStage = 
  | 'STAGE_0_DISABLED'
  | 'STAGE_1_INTERNAL_TEST'
  | 'STAGE_2_UI_ONLY'
  | 'STAGE_3_FULL_ROLLOUT';

export const ROLLOUT_STAGES = {
  STAGE_0_DISABLED: 'STAGE_0_DISABLED',
  STAGE_1_INTERNAL_TEST: 'STAGE_1_INTERNAL_TEST',
  STAGE_2_UI_ONLY: 'STAGE_2_UI_ONLY',
  STAGE_3_FULL_ROLLOUT: 'STAGE_3_FULL_ROLLOUT'
} as const;

export class FeatureFlagManager {
  private static instance: FeatureFlagManager;

  private localRarityEnabled: boolean = true;
  private localRarityXpEnabled: boolean = true;
  private rolloutStage: LocalRarityRolloutStage = 'STAGE_3_FULL_ROLLOUT';

  private constructor() {
    // 1. Check environment variables
    if (typeof import.meta !== 'undefined' && import.meta.env) {
      if (import.meta.env.VITE_LOCAL_RARITY_ENABLED !== undefined) {
        this.localRarityEnabled = import.meta.env.VITE_LOCAL_RARITY_ENABLED !== 'false';
      }
      if (import.meta.env.VITE_LOCAL_RARITY_XP_ENABLED !== undefined) {
        this.localRarityXpEnabled = import.meta.env.VITE_LOCAL_RARITY_XP_ENABLED !== 'false';
      }
      if (import.meta.env.VITE_LOCAL_RARITY_ROLLOUT_STAGE) {
        this.setRolloutStage(import.meta.env.VITE_LOCAL_RARITY_ROLLOUT_STAGE as LocalRarityRolloutStage);
      }
    } else if (typeof (globalThis as any).process !== 'undefined' && (globalThis as any).process?.env) {
      const env = (globalThis as any).process.env;
      if (env.LOCAL_RARITY_ENABLED !== undefined) {
        this.localRarityEnabled = env.LOCAL_RARITY_ENABLED !== 'false';
      }
      if (env.LOCAL_RARITY_XP_ENABLED !== undefined) {
        this.localRarityXpEnabled = env.LOCAL_RARITY_XP_ENABLED !== 'false';
      }
      if (env.LOCAL_RARITY_ROLLOUT_STAGE) {
        this.setRolloutStage(env.LOCAL_RARITY_ROLLOUT_STAGE as LocalRarityRolloutStage);
      }
    }
  }

  public static getInstance(): FeatureFlagManager {
    if (!FeatureFlagManager.instance) {
      FeatureFlagManager.instance = new FeatureFlagManager();
    }
    return FeatureFlagManager.instance;
  }

  public getRolloutStage(): LocalRarityRolloutStage {
    return this.rolloutStage;
  }

  public setRolloutStage(stage: LocalRarityRolloutStage) {
    this.rolloutStage = stage;
    switch (stage) {
      case 'STAGE_0_DISABLED':
        this.localRarityEnabled = false;
        this.localRarityXpEnabled = false;
        break;
      case 'STAGE_1_INTERNAL_TEST':
        this.localRarityEnabled = true;
        this.localRarityXpEnabled = true;
        break;
      case 'STAGE_2_UI_ONLY':
        this.localRarityEnabled = true;
        this.localRarityXpEnabled = false;
        break;
      case 'STAGE_3_FULL_ROLLOUT':
        this.localRarityEnabled = true;
        this.localRarityXpEnabled = true;
        break;
    }
  }

  public isLocalRarityEnabled(): boolean {
    return this.localRarityEnabled;
  }

  public isLocalRarityXpEnabled(): boolean {
    return this.localRarityEnabled && this.localRarityXpEnabled;
  }

  public setLocalRarityEnabled(enabled: boolean) {
    this.localRarityEnabled = enabled;
    this.syncStage();
  }

  public setLocalRarityXpEnabled(enabled: boolean) {
    this.localRarityXpEnabled = enabled;
    this.syncStage();
  }

  private syncStage() {
    if (!this.localRarityEnabled) {
      this.rolloutStage = 'STAGE_0_DISABLED';
    } else if (!this.localRarityXpEnabled) {
      this.rolloutStage = 'STAGE_2_UI_ONLY';
    } else {
      this.rolloutStage = 'STAGE_3_FULL_ROLLOUT';
    }
  }

  public resetToDefaults() {
    this.localRarityEnabled = true;
    this.localRarityXpEnabled = true;
    this.rolloutStage = 'STAGE_3_FULL_ROLLOUT';
  }
}

export const featureFlags = FeatureFlagManager.getInstance();
