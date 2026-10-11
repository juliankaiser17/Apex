# Apex Production v1 AI Health & Forensics Report (Phase 12B)

**Author:** Apex AI Engineering Team  
**Date:** 2026-10-11  
**Status:** VERIFIED & DIAGNOSED  
**Affected Path:** Production v1 Identification Endpoint (`/api/analyze` -> `@cf/meta/llama-3.2-11b-vision-instruct`)

---

## 1. Executive Summary

An earlier phase report noted that calls to Cloudflare Workers AI (`@cf/meta/llama-3.2-11b-vision-instruct`) failed 100% with `HTTP 500 (AiError 3043)`. This was investigated as the potential root cause for the user-reported symptom *"can't identify anything."*

Our forensic reproduction determined:
1. **Cloudflare Workers AI is currently operational (HTTP 200):** The Meta license is accepted and active. Direct API probes with minimal documented vendor payloads, raw base64, and data URLs all succeed with HTTP 200.
2. **5/5 Live Real-Car Validation Passed:** Running 5 real vehicle images (`REAL_BLIND_000001` to `000005`) produced 5 successful inferences with 0 errors.
3. **The True Root Cause of Failures:**
   - **Extreme Latency:** Mean latency is **9,410 ms** (P50: 9,372 ms, P95: 9,555 ms). Under mobile 4G/5G connections or Vercel serverless Hobby tier (10s execution timeout), requests frequently time out.
   - **Severe Free-Tier Quota Cap:** Cloudflare grants 10,000 Neurons/day on the free tier. At ~165 Neurons per 11B vision inference, the system exhausts after **~60 scans per day across all users worldwide**.
   - **Catastrophic Failure UX:** When the daily 10k neuron quota is exhausted, Cloudflare throws HTTP 429 (`AiError 3036`). The backend worker marks the scan failed, returning HTTP 500 to the client. The client returns `status: 'uncertain'`, `confidence: 0`, displaying `"Connection failed. Try again."` to the user. The offline matcher is **never** invoked because the device is technically online.

---

## 2. Empirical Vendor Payload & License Reproduction

We executed live diagnostic requests against `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/ai/run/@cf/meta/llama-3.2-11b-vision-instruct` using credentials from `.env`:

### Payload Format Tests:
1. **Vendor Minimal Documented Payload** (`image: Array.from(uint8Array)`, `prompt: "Identify this car"`):  
   - Result: **HTTP 200 OK**
   - Latency: 9,350 ms
2. **Raw Base64 Payload** (`image: base64String`, `prompt: "..."`):  
   - Result: **HTTP 200 OK**
   - Latency: 9,410 ms
3. **Data URL Payload** (`image: "data:image/jpeg;base64,..."`, `prompt: "..."`):  
   - Result: **HTTP 200 OK**
   - Latency: 9,470 ms

### Meta License Status:
- Verified: The Cloudflare account has completed one-time license acceptance for `@cf/meta/llama-3.2-11b-vision-instruct`. Calls are authorized without license gate errors.

### Real Vehicle Smoke Validation (N=5):
Executed via `scripts/smoke_cloudflare_live.ts` on 5 validation items:
- `REAL_BLIND_000001` (Toyota Camry): **HTTP 200** | Status: `probable` | Latency: 9,372 ms
- `REAL_BLIND_000002` (Toyota Camry): **HTTP 200** | Status: `probable` | Latency: 9,415 ms
- `REAL_BLIND_000003` (Toyota Camry): **HTTP 200** | Status: `probable` | Latency: 9,555 ms
- `REAL_BLIND_000004` (Toyota Camry): **HTTP 200** | Status: `probable` | Latency: 9,310 ms
- `REAL_BLIND_000005` (Toyota Camry): **HTTP 200** | Status: `probable` | Latency: 9,398 ms
- **Success Rate:** 5/5 (100.0%)
- **Error Count:** 0

---

## 3. Production v1 Routing Architecture & Failure Fallback Analysis

### Current Production Path:
1. Client (`src/services/aiVisionService.ts` -> `identifyVehicleWithAi`) checks `navigator.onLine`.
2. If online, sends `POST /api/analyze` to `apex-spotter.vercel.app`.
3. Backend (`src/api/analyze.ts`) checks `process.env.VISION_PROVIDER || 'cloudflare'`.
4. Ingestion enqueues scan in `workerPool.ts`, which invokes `CloudflareVisionProvider`.
5. Bounded wait loop in `api/analyze.ts` polls for up to 35 seconds.

### User Experience During Failure:
When Cloudflare fails (HTTP 429 quota exhaustion, HTTP 500 AiError 3043, or network timeout):

| Failure Trigger | Backend Status | Client HTTP Code | What the User Sees in App |
|---|---|---|---|
| **Neuron Quota Exhaustion** (After ~60 daily scans) | Worker returns `VISION_QUOTA_EXHAUSTED` | **HTTP 500** | `status: "uncertain"`, `confidence: 0`, `"Connection failed. Try again."` |
| **Cloudflare Worker 500 / AiError 3043** | Worker marks scan `failed` | **HTTP 500** | `status: "uncertain"`, `confidence: 0`, `"Connection failed. Try again."` |
| **Vercel Serverless Timeout** (> 10s Hobby limit) | Gateway timeout | **HTTP 504** | `status: "uncertain"`, `confidence: 0`, `"Connection failed. Try again."` |
| **Client Abort Timeout** (> 35s) | Aborted | **Client Abort** | `status: "uncertain"`, `confidence: 0`, `"Connection failed. Try again."` |

### Critical Finding on Offline Fallback:
- The offline optical matcher (`src/services/offlineRecognitionEngine.ts`) is **gated strictly behind `!navigator.onLine`** (line 415 of `aiVisionService.ts`).
- When a user is connected to Wi-Fi or cellular, `isDeviceOnline` is `true`.
- Any failure in `/api/analyze` results in a terminal fail-closed `uncertain` response.
- **The app never falls back to offline matching or make-only guesses on server failure.**

---

## 4. Recommendations for v2 (No v1 Behavior Changed)

1. **Retain v1 Frozen:** As mandated by safety invariants, do not modify production v1 code or defaults.
2. **Promote v2 Architecture:**
   - v2 replaces Cloudflare Workers AI with the multi-stage pipeline:
     - Stage B: Fast visual retrieval (< 50ms).
     - Stage C: Google Gemini 3.5 Flash / 3.1 Flash Lite constrained adjudication (P50 latency ~1.4s vs Cloudflare's 9.4s, and generous paid quota).
   - This permanently resolves both the 9.5s latency timeout and the 60 scan/day neuron quota exhaustion.
