/**
 * APEX — Capability-Based Low-End & Hardware Performance Detector
 * 
 * Automatically detects device capabilities (CPU cores, RAM, motion preferences)
 * to eliminate expensive rendering passes without compromising features or visuals.
 */

export interface DevicePerformanceProfile {
  tier: 'low' | 'mid' | 'high';
  isLowEnd: boolean;
  prefersReducedMotion: boolean;
  hardwareConcurrency: number;
  deviceMemoryGb?: number;
}

let cachedProfile: DevicePerformanceProfile | null = null;

export function getDevicePerformanceProfile(): DevicePerformanceProfile {
  if (cachedProfile) return cachedProfile;

  let concurrency = 4;
  let memoryGb: number | undefined = undefined;
  let isReducedMotion = false;

  try {
    if (typeof navigator !== 'undefined') {
      if (typeof navigator.hardwareConcurrency === 'number') {
        concurrency = navigator.hardwareConcurrency;
      }
      if ('deviceMemory' in navigator && typeof (navigator as any).deviceMemory === 'number') {
        memoryGb = (navigator as any).deviceMemory;
      }
    }

    if (typeof window !== 'undefined' && window.matchMedia) {
      isReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }
  } catch (e) {
    // Safe fallbacks in constrained environments
  }

  // Determine performance tier
  let tier: 'low' | 'mid' | 'high' = 'high';
  if (isReducedMotion || concurrency <= 4 || (memoryGb !== undefined && memoryGb <= 4)) {
    tier = 'low';
  } else if (concurrency <= 6 || (memoryGb !== undefined && memoryGb <= 6)) {
    tier = 'mid';
  }

  cachedProfile = {
    tier,
    isLowEnd: tier === 'low',
    prefersReducedMotion: isReducedMotion,
    hardwareConcurrency: concurrency,
    deviceMemoryGb: memoryGb
  };

  return cachedProfile;
}

export function isLowEndDevice(): boolean {
  return getDevicePerformanceProfile().isLowEnd;
}

export function shouldReduceMotion(): boolean {
  return getDevicePerformanceProfile().prefersReducedMotion;
}
