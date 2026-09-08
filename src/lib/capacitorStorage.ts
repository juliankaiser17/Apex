/**
 * APEX — Native Capacitor Preferences Storage Adapter for Supabase Auth & App State
 * 
 * On native Android/iOS, localStorage inside WebView can be cleared when the app
 * process is killed or memory is reclaimed. This adapter uses @capacitor/preferences
 * (native Android SharedPreferences / iOS UserDefaults) to persist Supabase auth
 * tokens and Apex user sessions across app restarts and updates.
 */

import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';

const memoryCache = new Map<string, string>();

/**
 * Pre-load all native Preferences into memoryCache and localStorage on app startup.
 * Must be called BEFORE creating Supabase client and before Zustand store initializes.
 */
export async function preloadAuthStorage(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;

  try {
    const { keys } = await Preferences.keys();
    for (const key of keys) {
      try {
        const { value } = await Preferences.get({ key });
        if (value !== null) {
          memoryCache.set(key, value);
          try {
            localStorage.setItem(key, value);
          } catch (_) {}
        }
      } catch (_) {}
    }
  } catch (e) {
    console.warn('Error preloading native storage:', e);
  }
}

/**
 * Custom storage adapter for Supabase auth.
 * Supports both async Supabase v2 calls and sync fallback.
 */
export const capacitorStorage = {
  getItem: (key: string): string | null => {
    const mem = memoryCache.get(key);
    if (mem !== undefined) return mem;
    try {
      return localStorage.getItem(key);
    } catch (_) {
      return null;
    }
  },

  setItem: (key: string, value: string): void => {
    memoryCache.set(key, value);
    try {
      localStorage.setItem(key, value);
    } catch (_) {}
    if (Capacitor.isNativePlatform()) {
      Preferences.set({ key, value }).catch(() => {});
    }
  },

  removeItem: (key: string): void => {
    memoryCache.delete(key);
    try {
      localStorage.removeItem(key);
    } catch (_) {}
    if (Capacitor.isNativePlatform()) {
      Preferences.remove({ key }).catch(() => {});
    }
  },
};

/**
 * Helper to synchronously and natively persist key-value pairs
 */
export const persistItem = (key: string, value: string): void => {
  capacitorStorage.setItem(key, value);
};

/**
 * Helper to remove key from both native and local storage
 */
export const removeItem = (key: string): void => {
  capacitorStorage.removeItem(key);
};
