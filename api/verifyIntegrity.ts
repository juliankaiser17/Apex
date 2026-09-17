/**
 * APEX Server-Side Play Integrity Verifier & Tiered Policy Engine
 * Decodes Google Play Integrity verdicts and enforces graduated trust boundaries.
 */

import crypto from 'crypto';

export interface IntegrityVerificationResult {
  allowed: boolean;
  tier: 'TIER_1_CERTIFIED' | 'TIER_2_BASIC' | 'TIER_3_VIRTUAL' | 'TIER_4_TAMPERED' | 'FALLBACK_WEB';
  reason: string;
  leaderboardEligible: boolean;
  appRecognitionVerdict?: string;
  deviceRecognitionVerdict?: string[];
}

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

export function computeServerRequestHash(payload: Record<string, any>): string {
  const canonical = canonicalizeJson(payload);
  return crypto.createHash('sha256').update(canonical).digest('hex');
}

/**
 * Evaluates decoded Play Integrity response with Tiered Enforcement
 */
export function evaluateIntegrityVerdict(
  decodedToken: any,
  expectedPayload: Record<string, any>
): IntegrityVerificationResult {
  if (!decodedToken) {
    return {
      allowed: true,
      tier: 'FALLBACK_WEB',
      reason: 'No Play Integrity token provided; falling back to standard rate-limiting.',
      leaderboardEligible: false
    };
  }

  const requestDetails = decodedToken.requestDetails || {};
  const appIntegrity = decodedToken.appIntegrity || {};
  const deviceIntegrity = decodedToken.deviceIntegrity || {};

  // 1. Verify Package Name
  if (requestDetails.requestPackageName !== 'org.juliankaiser.apex') {
    return {
      allowed: false,
      tier: 'TIER_4_TAMPERED',
      reason: `Package name mismatch: expected org.juliankaiser.apex, received ${requestDetails.requestPackageName}`,
      leaderboardEligible: false
    };
  }

  // 2. Verify Request Hash against Server Recomputed Hash
  const expectedHash = computeServerRequestHash(expectedPayload);
  if (requestDetails.requestHash !== expectedHash) {
    return {
      allowed: false,
      tier: 'TIER_4_TAMPERED',
      reason: 'Cryptographic requestHash mismatch: payload was modified in transit.',
      leaderboardEligible: false
    };
  }

  // 3. Verify App Integrity (Binary signature and Play Recognition)
  const appVerdict = appIntegrity.appRecognitionVerdict;
  if (appVerdict !== 'PLAY_RECOGNIZED') {
    return {
      allowed: false,
      tier: 'TIER_4_TAMPERED',
      reason: `App binary is not recognized by Google Play: ${appVerdict}`,
      leaderboardEligible: false
    };
  }

  // 4. Verify Device Integrity
  const deviceVerdicts: string[] = deviceIntegrity.deviceRecognitionVerdict || [];

  if (deviceVerdicts.includes('MEETS_STRONG_INTEGRITY') || deviceVerdicts.includes('MEETS_DEVICE_INTEGRITY')) {
    return {
      allowed: true,
      tier: 'TIER_1_CERTIFIED',
      reason: 'Device hardware and binary integrity fully verified.',
      leaderboardEligible: true,
      appRecognitionVerdict: appVerdict,
      deviceRecognitionVerdict: deviceVerdicts
    };
  }

  if (deviceVerdicts.includes('MEETS_BASIC_INTEGRITY')) {
    return {
      allowed: true,
      tier: 'TIER_2_BASIC',
      reason: 'Basic device integrity met (e.g. unlocked bootloader/rooted device). Allowed with tightened rate limits.',
      leaderboardEligible: false,
      appRecognitionVerdict: appVerdict,
      deviceRecognitionVerdict: deviceVerdicts
    };
  }

  if (deviceVerdicts.includes('MEETS_VIRTUAL_INTEGRITY')) {
    return {
      allowed: true,
      tier: 'TIER_3_VIRTUAL',
      reason: 'Virtual emulator environment detected. Sandboxed from competitive leaderboards.',
      leaderboardEligible: false,
      appRecognitionVerdict: appVerdict,
      deviceRecognitionVerdict: deviceVerdicts
    };
  }

  return {
    allowed: false,
    tier: 'TIER_4_TAMPERED',
    reason: 'Device failed all integrity baselines.',
    leaderboardEligible: false,
    appRecognitionVerdict: appVerdict,
    deviceRecognitionVerdict: deviceVerdicts
  };
}
