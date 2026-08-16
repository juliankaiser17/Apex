/**
 * APEX Play Integrity Service
 * Client-Side Deterministic Request Serialization & Request-Hash Calculation
 * Conforms to Google Play Integrity Standard API specifications.
 */

import { Capacitor } from '@capacitor/core';

export interface IntegrityProtectedPayload {
  make?: string;
  model?: string;
  photoHash?: string;
  timestamp?: number;
  userId?: string;
  action?: string;
  [key: string]: any;
}

/**
 * Deterministically serialize a JavaScript object into canonical JSON format.
 * Sorts object keys alphabetically and normalizes spacing.
 */
export function canonicalizeJson(obj: Record<string, any>): string {
  if (obj === null || typeof obj !== 'object') {
    return JSON.stringify(obj);
  }

  if (Array.isArray(obj)) {
    return '[' + obj.map(item => canonicalizeJson(item)).join(',') + ']';
  }

  const sortedKeys = Object.keys(obj).sort();
  const keyValues = sortedKeys.map(key => {
    return `${JSON.stringify(key)}:${canonicalizeJson(obj[key])}`;
  });

  return '{' + keyValues.join(',') + '}';
}

/**
 * Compute SHA-256 digest of canonicalized payload as a Web/Android standard requestHash.
 */
export async function computeRequestHash(payload: IntegrityProtectedPayload): Promise<string> {
  const canonical = canonicalizeJson(payload);
  const encoder = new TextEncoder();
  const data = encoder.encode(canonical);

  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  // Fallback string hash for testing environments without Web Crypto
  let hash = 0;
  for (let i = 0; i < canonical.length; i++) {
    const char = canonical.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16).padStart(64, '0');
}

/**
 * Request Play Integrity token from native Android layer when executing high-value actions.
 * If running on Web / Dev environment, returns null to trigger graceful fallback.
 */
export async function requestPlayIntegrityToken(payload: IntegrityProtectedPayload): Promise<{
  integrityToken: string | null;
  requestHash: string;
}> {
  const requestHash = await computeRequestHash(payload);

  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') {
    // Graceful web/iOS/dev fallback
    return {
      integrityToken: null,
      requestHash
    };
  }

  try {
    // Native Play Integrity call via Capacitor Android Bridge
    // StandardIntegrityTokenProvider.request(requestHash)
    const plugins = (window as any).Capacitor?.Plugins;
    if (plugins?.PlayIntegrity?.requestIntegrityToken) {
      const res = await plugins.PlayIntegrity.requestIntegrityToken({ requestHash });
      return {
        integrityToken: res.token || null,
        requestHash
      };
    }
  } catch (err) {
    console.warn('Native Play Integrity token acquisition failed:', err);
  }

  return {
    integrityToken: null,
    requestHash
  };
}
