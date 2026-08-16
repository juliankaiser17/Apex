# APEX — Google Play Integrity API Architecture & Implementation Specification

**Target:** APEX Android Mobile Client & Serverless Verification Architecture  
**API Model:** Google Play Integrity Standard API  
**Standards Alignment:** OWASP MASVS-RESILIENCE, Google Play Integrity Best Practices  

---

## 1. High-Value Action Qualification Matrix

| Candidate Action | High-Value Economy Impact | Play Integrity Justified? | Rationale & Enforcement Level |
|---|---|---|---|
| **High-Rarity Vehicle Discovery (`record_car_scan` on Epic/Legendary/Mythic)** | **Critical** (Rare card minting, XP surge, global leaderboard shift) | **YES (Standard API)** | High-value game asset; validates that discovery originates from genuine camera hardware and untampered app binary. |
| **Global Leaderboard Spot & Competitive Submissions** | **Critical** (Top 100 rankings, seasonal prizes) | **YES (Leaderboard Attestation)** | Prevents emulators/bots from poisoning competitive global leaderboards. |
| **Level-Up Milestone Bonus Claims** | High (500–2,500 Coin rewards, rare badge) | **YES (Step-Up Check)** | Prevents multi-account automated milestone reward farming. |
| **Routine Daily Quest / Mission Claims** | Low / Medium (100–500 XP) | **NO** (Server Idempotency Table) | Routine micro-actions; server idempotency in `reward_claims` and rate-limits prevent duplication without incurring API latency. |
| **Common/Uncommon Vehicle Scans** | Low / Standard Gameplay | **NO** (AI Vision Hash Receipt) | Ensures fast, responsive everyday scanning UX. |

---

## 2. Protected Request Flow & Request-Binding Protocol

### 2.1 Protocol Steps

```
[Android Client]
  1. High-value action initiated (e.g. Legendary Car Discovery)
  2. Canonicalize JSON payload (alphabetically sorted keys, normalized formatting)
  3. Compute SHA-256 digest of canonical string -> `requestHash`
  4. Call Native Play Integrity Standard API: `StandardIntegrityTokenProvider.request({ requestHash })`
  5. Send `{ ...scanPayload, integrityToken }` to `/api/scan`

[Serverless Gateway / PostgreSQL]
  6. Recompute `expectedRequestHash = SHA256(canonicalize(scanPayload))`
  7. Invoke Google Play Integrity API: `playintegrity.decodeIntegrityToken(integrityToken)`
  8. Validate Decoded Verdicts:
     - `requestDetails.requestPackageName == "org.juliankaiser.apex"`
     - `requestDetails.requestHash == expectedRequestHash`
     - `appIntegrity.appRecognitionVerdict == "PLAY_RECOGNIZED"`
     - `deviceIntegrity.deviceRecognitionVerdict` evaluation (Tiered Enforcement)
  9. Apply Tiered Action & Record Nonce/Decision in Audit Log
```

---

## 3. Tiered Enforcement Policy (Avoiding Blind Bans)

| Tier | App Recognition | Device Recognition | System Decision | User Experience Impact |
|---|---|---|---|---|
| **Tier 1: Certified Genuine Device** | `PLAY_RECOGNIZED` | `MEETS_DEVICE_INTEGRITY` or `MEETS_STRONG_INTEGRITY` | **Full Approval** | 100% normal rewards, eligible for Global Top 100 Leaderboards. |
| **Tier 2: Basic Device / Rooted Enthusiast** | `PLAY_RECOGNIZED` | `MEETS_BASIC_INTEGRITY` only | **Conditional Approval** | Card added to personal garage; rate limit tightened to 10 scans/hr; excluded from competitive leaderboard. |
| **Tier 3: Virtual Emulator / Unrecognized Hardware** | `PLAY_RECOGNIZED` | `MEETS_VIRTUAL_INTEGRITY` or empty | **Single-Player Sandbox** | Single-player offline garage browsing allowed; excluded from global leaderboard and social feeds. |
| **Tier 4: Tampered Binary / Repackaged APK** | `UNRECOGNIZED_VERSION` or signature mismatch | Any | **Hard Rejection** | Scan rejected with user prompt: *"Please install the official APEX app from Google Play."* |
| **Fallback: Web / Local Development** | N/A | N/A | **Graceful Fallback** | Fallback to server rate-limiting and AI vision receipt verification. |

---

## 4. Architectural Boundaries: What Play Integrity Protects vs. Does Not Protect

### What Play Integrity Protects:
- **Binary Tampering:** Verifies APK was built by Julian Kaiser and distributed via Google Play.
- **Hardware-Backed Device Attestation:** Verifies request originates from a genuine physical Android device.
- **Man-in-the-Middle Request Tampering:** `requestHash` cryptographically binds the token to the specific request payload.
- **Automated Bot Farms:** Thwarts large-scale automated headless emulators from minting rare cards.

### What Play Integrity Does NOT Protect:
- **Physical Screen Spoofing:** A real user holding a physical phone pointing at a laptop screen photo of a Ferrari. (Mitigated by AI glare/depth analysis).
- **Compromised Backend Credentials:** Does not replace server-side authorization and RLS policies.
- **Network Outages:** When Google Play Services are temporarily unreachable.

---

## 5. False-Positive Handling & Safe Audit Logging

* **Safe Security Logging:** Security decisions log only the `userId`, `tier`, `action`, and timestamp. Cryptographic tokens, GPS coordinates, and raw image bytes are never written to server logs.
* **Transient Outage Resilience:** If Google Play Integrity servers return a transient 5xx error, high-value requests fall back to **Tier 2 (Conditional Approval)** rather than rejecting legitimate user gameplay.

---

## 6. Automated Regression Verification

The 4 Play Integrity security vectors were verified in [`scripts/test_authorization.mjs`](file:///c:/Apex/scripts/test_authorization.mjs):
```
  ✅ [PASS] Attack 28: Play Integrity: Deterministic JSON serialization and SHA-256 requestHash matching
  ✅ [PASS] Attack 29: Play Integrity: Rejects modified payload in transit (requestHash mismatch)
  ✅ [PASS] Attack 30: Play Integrity: Rejects tampered/repackaged binary (UNRECOGNIZED_VERSION)
  ✅ [PASS] Attack 31: Play Integrity: Tiered enforcement allows single-player on virtual/basic, protects leaderboards
```
