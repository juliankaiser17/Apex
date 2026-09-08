/**
 * APEX — Development Performance Toggles
 * 
 * Allows isolating and profiling individual visual subsystems (confetti,
 * live backdrops, counters, decorative glows) to measure exact frame-time
 * impact on the Samsung Galaxy A54 5G.
 */

export interface PerformanceToggles {
  CONFETTI_ENABLED: boolean;
  NOTIFICATION_BACKDROP_ENABLED: boolean;
  XP_ANIMATION_ENABLED: boolean;
  DECORATIVE_EFFECTS_ENABLED: boolean;
}

const DEFAULT_TOGGLES: PerformanceToggles = {
  CONFETTI_ENABLED: true,
  NOTIFICATION_BACKDROP_ENABLED: true,
  XP_ANIMATION_ENABLED: true,
  DECORATIVE_EFFECTS_ENABLED: true,
};

let currentToggles: PerformanceToggles = { ...DEFAULT_TOGGLES };

export function getPerformanceToggle<K extends keyof PerformanceToggles>(key: K): boolean {
  return currentToggles[key];
}

export function setPerformanceToggle<K extends keyof PerformanceToggles>(key: K, value: boolean): void {
  currentToggles[key] = value;
}

export function getAllPerformanceToggles(): PerformanceToggles {
  return { ...currentToggles };
}

export function resetPerformanceToggles(): void {
  currentToggles = { ...DEFAULT_TOGGLES };
}
