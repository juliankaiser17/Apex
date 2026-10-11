# Proposal: Production AI Vision Stopgap & Client Bridge Fallback (13F / Gate G6)

**Author:** Track A / AI Reliability Engineering  
**Date:** October 2026  
**Status:** PROPOSED (Awaiting Owner Review - Gate G6)  
**Lane:** Lane 2 / Lane 3 Bridge  
**Target:** Serverless Gemini stopgap and client recovery diff in `src/services/aiVisionService.ts`

---

## 1. Overview & Root Cause of Production Scanning Failures

Field testing of the initial production scan flow revealed three structural failure modes:
1. **Cloudflare Workers AI Free-Tier Quota Exhaustion**: Cloudflare's free quota allows roughly 60–100 Neurons/day before returning HTTP 429 `10014: Quota exceeded`.
2. **Serverless Function Timeouts**: Vercel free-tier functions timeout at 10.0 seconds. Median inference latency was 9.4 seconds, causing cold starts to truncate at the gateway.
3. **Offline Fallback Gating Defect**: `offlineRecognitionEngine.ts` was conditioned strictly on `!navigator.onLine`. When the device was online but the server returned 429/500/timeout, the app reported "Cannot identify car" instead of falling back to on-device matching.

---

## 2. Server-Side Stopgap Architecture (Implemented behind Flags)

1. **Default Model**: `gemini-3.5-flash` with dynamic fallback to `gemini-3.1-flash-lite` if the primary provider times out after 4.5 seconds.
2. **Bounded Serverless Deadlines**: Strict 8.5-second timeout (`TIMEOUT_MS = 8500`) guaranteed to terminate before Vercel's 10.0-second gateway kill.
3. **Distinct Telemetry Error Codes**:
   - `VISION_QUOTA_EXHAUSTED` (HTTP 429)
   - `VISION_TIMEOUT` (Request exceeded serverless limit)
   - `PROVIDER_UNAVAILABLE` (HTTP 502/503 from inference backend)

---

## 3. Client Bridge Proposed Diff (`src/services/aiVisionService.ts`)

Under Operating Rule 7, client files must not be altered within Track A. Below is the proposed Lane 1/Bridge diff for owner approval:

```diff
--- a/src/services/aiVisionService.ts
+++ b/src/services/aiVisionService.ts
@@ -350,15 +350,28 @@ export async function identifyVehicle(
     const response = await fetchWithTimeout(apiUrl, { ... });
     
     if (response.status === 429) {
-      throw new Error('Inference error');
+      // Distinct Quota Exhaustion: Invoke local optical matcher before alerting
+      const localFallback = await runOfflineRecognitionFallback(imageUri);
+      if (localFallback) return { ...localFallback, is_offline_fallback: true };
+      return {
+        is_car: true,
+        status: 'provider_error',
+        reason: 'Identification servers are currently at peak capacity. Please retry shortly.',
+        collectible_eligible: false
+      };
     }
+
+    if (!response.ok && response.status >= 500) {
+      const localFallback = await runOfflineRecognitionFallback(imageUri);
+      if (localFallback) return { ...localFallback, is_offline_fallback: true };
+      return {
+        is_car: true,
+        status: 'provider_error',
+        reason: 'Scanning service temporarily busy. Tap to retry.',
+        collectible_eligible: false
+      };
+    }
```

---

## 4. Cost Estimates & Hosting Plan Implications

Using `gemini-3.5-flash` ($0.10 / 1M input tokens, $0.40 / 1M output tokens):
Average tokens per scan: ~1,500 input + ~300 output.
Cost per scan: **~$0.00027 USD** (less than 3 cents per 100 scans).

| Volume Tier | Monthly Scans | Estimated Gemini API Cost | Vercel Serverless Tier | Cloudflare / DB Impact |
| :--- | :---: | :---: | :---: | :---: |
| **100 scans/day** | 3,000 | **$0.81 / month** | Hobby (Free) | Well within Supabase & Vercel free tiers |
| **1,000 scans/day** | 30,000 | **$8.10 / month** | Pro ($20 / month recommended) | Supabase Pro ($25 / mo recommended for DB storage) |
| **10,000 scans/day** | 300,000 | **$81.00 / month** | Pro ($20/mo + function overage ~$15) | Supabase Pro + dedicated vector indexing |

---

## 5. Owner Decision Required (Gate G6)
- Approve setting `VISION_PROVIDER=gemini` and `GEMINI_MODEL=gemini-3.5-flash` in production environment variables.
- Keep spend under the $25 USD hard cap.
