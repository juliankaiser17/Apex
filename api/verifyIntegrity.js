// src/api/verifyIntegrity.ts
import crypto from "crypto";
function canonicalizeJson(obj) {
  if (obj === null || typeof obj !== "object") {
    return JSON.stringify(obj);
  }
  if (Array.isArray(obj)) {
    return "[" + obj.map((item) => canonicalizeJson(item)).join(",") + "]";
  }
  const sortedKeys = Object.keys(obj).sort();
  const keyValues = sortedKeys.map((key) => {
    return `${JSON.stringify(key)}:${canonicalizeJson(obj[key])}`;
  });
  return "{" + keyValues.join(",") + "}";
}
function computeServerRequestHash(payload) {
  const canonical = canonicalizeJson(payload);
  return crypto.createHash("sha256").update(canonical).digest("hex");
}
function evaluateIntegrityVerdict(decodedToken, expectedPayload) {
  if (!decodedToken) {
    return {
      allowed: true,
      tier: "FALLBACK_WEB",
      reason: "No Play Integrity token provided; falling back to standard rate-limiting.",
      leaderboardEligible: false
    };
  }
  const requestDetails = decodedToken.requestDetails || {};
  const appIntegrity = decodedToken.appIntegrity || {};
  const deviceIntegrity = decodedToken.deviceIntegrity || {};
  if (requestDetails.requestPackageName !== "org.juliankaiser.apex") {
    return {
      allowed: false,
      tier: "TIER_4_TAMPERED",
      reason: `Package name mismatch: expected org.juliankaiser.apex, received ${requestDetails.requestPackageName}`,
      leaderboardEligible: false
    };
  }
  const expectedHash = computeServerRequestHash(expectedPayload);
  if (requestDetails.requestHash !== expectedHash) {
    return {
      allowed: false,
      tier: "TIER_4_TAMPERED",
      reason: "Cryptographic requestHash mismatch: payload was modified in transit.",
      leaderboardEligible: false
    };
  }
  const appVerdict = appIntegrity.appRecognitionVerdict;
  if (appVerdict !== "PLAY_RECOGNIZED") {
    return {
      allowed: false,
      tier: "TIER_4_TAMPERED",
      reason: `App binary is not recognized by Google Play: ${appVerdict}`,
      leaderboardEligible: false
    };
  }
  const deviceVerdicts = deviceIntegrity.deviceRecognitionVerdict || [];
  if (deviceVerdicts.includes("MEETS_STRONG_INTEGRITY") || deviceVerdicts.includes("MEETS_DEVICE_INTEGRITY")) {
    return {
      allowed: true,
      tier: "TIER_1_CERTIFIED",
      reason: "Device hardware and binary integrity fully verified.",
      leaderboardEligible: true,
      appRecognitionVerdict: appVerdict,
      deviceRecognitionVerdict: deviceVerdicts
    };
  }
  if (deviceVerdicts.includes("MEETS_BASIC_INTEGRITY")) {
    return {
      allowed: true,
      tier: "TIER_2_BASIC",
      reason: "Basic device integrity met (e.g. unlocked bootloader/rooted device). Allowed with tightened rate limits.",
      leaderboardEligible: false,
      appRecognitionVerdict: appVerdict,
      deviceRecognitionVerdict: deviceVerdicts
    };
  }
  if (deviceVerdicts.includes("MEETS_VIRTUAL_INTEGRITY")) {
    return {
      allowed: true,
      tier: "TIER_3_VIRTUAL",
      reason: "Virtual emulator environment detected. Sandboxed from competitive leaderboards.",
      leaderboardEligible: false,
      appRecognitionVerdict: appVerdict,
      deviceRecognitionVerdict: deviceVerdicts
    };
  }
  return {
    allowed: false,
    tier: "TIER_4_TAMPERED",
    reason: "Device failed all integrity baselines.",
    leaderboardEligible: false,
    appRecognitionVerdict: appVerdict,
    deviceRecognitionVerdict: deviceVerdicts
  };
}
async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed: Must be POST." });
  }
  const { integrityToken, packageName, nonce } = req.body || {};
  const result = evaluateIntegrityVerdict(integrityToken, {
    expectedPackageName: packageName,
    expectedNonce: nonce
  });
  return res.status(200).json(result);
}
export {
  canonicalizeJson,
  computeServerRequestHash,
  handler as default,
  evaluateIntegrityVerdict
};
