/**
 * APEX — Tactile Haptics Engine
 * Provides subtle, physical micro-feedback for navigation, scanning,
 * button presses, and discovery unlocks.
 * 
 * Includes a persistent global toggle (ON / OFF) that completely suppresses
 * all haptic/vibration feedback when disabled by the user in Settings.
 * Uses @capacitor/haptics on mobile with silent graceful fallback to navigator.vibrate.
 */

import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';

const HAPTICS_STORAGE_KEY = 'apex_haptics_enabled';

// Internal cached state with eager local storage recovery
let _hapticsEnabled: boolean = (() => {
  try {
    if (typeof localStorage !== 'undefined') {
      const stored = localStorage.getItem(HAPTICS_STORAGE_KEY);
      if (stored !== null) {
        return stored === 'true';
      }
    }
  } catch {}
  return true; // Enabled by default
})();

/**
 * Configure global haptics/vibration preference.
 * Persists immediately to localStorage for session durability.
 */
export function setHapticsEnabled(enabled: boolean): void {
  _hapticsEnabled = enabled;
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(HAPTICS_STORAGE_KEY, enabled ? 'true' : 'false');
    }
  } catch {}
}

/**
 * Query current global haptics preference.
 */
export function isHapticsEnabled(): boolean {
  try {
    if (typeof localStorage !== 'undefined') {
      const stored = localStorage.getItem(HAPTICS_STORAGE_KEY);
      if (stored !== null) {
        return stored === 'true';
      }
    }
  } catch {}
  return _hapticsEnabled;
}

/**
 * Lightweight tactile tap for standard tab changes & UI navigation
 */
export async function hapticTap(): Promise<void> {
  if (!isHapticsEnabled()) return;
  try {
    await Haptics.impact({ style: ImpactStyle.Light });
  } catch {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(10);
    }
  }
}

/**
 * Crisp tactile impact for shutter releases, primary buttons, and mode switches
 */
export async function hapticImpact(style: 'light' | 'medium' | 'heavy' = 'medium'): Promise<void> {
  if (!isHapticsEnabled()) return;
  try {
    const capStyle = style === 'heavy' 
      ? ImpactStyle.Heavy 
      : style === 'medium' 
      ? ImpactStyle.Medium 
      : ImpactStyle.Light;
    await Haptics.impact({ style: capStyle });
  } catch {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      const duration = style === 'heavy' ? 35 : style === 'medium' ? 20 : 10;
      navigator.vibrate(duration);
    }
  }
}

/**
 * Rewarding haptic celebration pulse for rare car unlocks, quest completions, and level-ups
 */
export async function hapticSuccess(): Promise<void> {
  if (!isHapticsEnabled()) return;
  try {
    await Haptics.notification({ type: NotificationType.Success });
  } catch {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate([15, 50, 25]);
    }
  }
}

/**
 * Tactile warning/rejection bump for errors, abstentions, or invalid actions
 */
export async function hapticWarning(): Promise<void> {
  if (!isHapticsEnabled()) return;
  try {
    await Haptics.notification({ type: NotificationType.Warning });
  } catch {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate([25, 40, 25]);
    }
  }
}

/**
 * Micro-tick feedback for slider drags and carousel turns
 */
export async function hapticSelection(): Promise<void> {
  if (!isHapticsEnabled()) return;
  try {
    await Haptics.selectionChanged();
  } catch {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(6);
    }
  }
}
