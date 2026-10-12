# Apex Private Beta — Launch Day Runbook

**Date:** October 12, 2026  
**Target:** Safe, Free-Tier-Only Android Private Beta  
**Scope:** Gates G1–G7 Compliance, Free-Tier Rate Limits (15 RPM), $0.00 Cost Guarantee  

---

## 1. Owner Steps in Order (Launch Sequence)

## 1. Owner Steps in Order (Launch Sequence)

### Pre-Launch Preparation (T-60 Minutes)
1. **Verify Environment Variables in Vercel Production Dashboard:**
   - Go to [Vercel Dashboard](https://vercel.com) > Apex Project > **Settings** > **Environment Variables**.
   - Configure measured production pipeline:
     - `AI_PIPELINE=vlm-first` (Measured production pipeline)
     - `VLM_FIRST_ENABLED=true`
     - `VISION_PROVIDER=gemini`
     - `GEMINI_SCANNING_ENABLED=true`
     - `CLOUDFLARE_SCANNING_ENABLED=false` (Enforced off for free tier)
     - `GEMINI_API_KEY=<owner_gemini_api_key>`
     - `USER_DAILY_SCAN_CAP=10` (Configurable per-user limit, default 10)
     - `EXPENSIVE_VERIFICATION_ENABLED=false` (Strictly bounds calls per scan)
     - `COMBINED_ESCALATION_ENABLED=false` (Optional escalation behind flag)
     - `LOCAL_RARITY_ENABLED=true`
     - `LOCAL_RARITY_XP_ENABLED=true`
   - **One-Step Rollback:** If any unforeseen issue occurs, change:
     - `AI_PIPELINE=v1`
     - `VLM_FIRST_ENABLED=false`
     (Instant rollback to baseline Phase 1 pipeline; redeploy takes < 60s).

2. **Verify Google Cloud Android OAuth Client Credentials:**
   - Go to [Google Cloud Console](https://console.cloud.google.com/) > **APIs & Services** > **Credentials**.
   - Verify Android OAuth 2.0 Client ID:
     - **Package Name:** `org.juliankaiser.apex`
     - **Signing Certificate SHA-1:** `4D:2F:D5:24:2B:63:2E:D8:EC:5C:F8:E6:DA:33:B1:D6:9F:DE:9F:31`
   - Confirm Web Client ID matches `VITE_GOOGLE_CLIENT_ID` in Supabase Auth Providers.

3. **Verify Release APK Artifact:**
   - Locate release APK: `android/app/build/outputs/apk/release/app-release.apk`
   - Confirm SHA-256 fingerprint matches the release build report.

---

### Critical Launch Day Safety Invariants

> [!CAUTION]
> **1. ABSOLUTELY ZERO EVALUATIONS ON LAUNCH DAY**  
> Do **NOT** run test harnesses, benchmark suites, or eval scripts (`run_beta_val_measurement.ts`, `run_production_parity_eval.ts`, etc.) on launch day! Each batch evaluation consumes 60–245 requests, which will drain the 500 requests/day free tier quota and cause real beta testers to receive HTTP 503 `SCANNER_BUSY` errors.

> [!IMPORTANT]
> **2. FREE-TIER QUOTA RESET WINDOW**  
> Google Cloud Gemini free-tier daily quotas reset at **midnight Pacific Time (00:00 PST / 07:00 UTC / ~12:30 PM IST)**. Schedule private beta tester distribution to align with fresh daily quota windows.

> [!WARNING]
> **3. GEOGRAPHIC DISTRIBUTION RESTRICTION (NO EEA / UK / SWITZERLAND)**  
> **DO NOT distribute the APK to testers in the European Economic Area (EEA), United Kingdom, or Switzerland.**  
> Under Google Gemini's free-tier Terms of Service, prompt and image data may be reviewed and processed for service improvement. This triggers complex cross-border data transfer rules under GDPR and compliance requirements under the EU AI Act for computer vision systems. Restrict private beta invitations strictly to users in the United States, Canada, Japan, India, and non-EEA jurisdictions.

---

### Distribution to Beta Testers (T-0)
1. Provide `app-release.apk` to the private tester cohort (5–15 testers recommended).
2. Send the **Tester Onboarding Instructions & Play Protect Guidance** (Section 5 below).
3. Confirm testers have Android 7.0+ (API 24+) devices.

---

## 2. Manual Test Checklist (Using Signed APK)

Perform this verification on a physical Android test device before sending to testers:

- [ ] **Clean Install**:
  - Sideload `app-release.apk` onto a test device.
  - Verify app installs cleanly without "Package Corrupt" or certificate signature mismatch errors.
- [ ] **First-Time Launch & Consent Screen**:
  - Open app. Tap camera/scanner icon.
  - Verify the **AI Vision Scanner Privacy & Beta Consent Modal** appears before camera opens.
  - Verify modal text mentions:
    - Photos processed by Google Gemini AI.
    - Free tier terms (service provider data usage).
    - Explicit reminder: **Do NOT photograph people, faces, or legible license plates**.
  - Tap "Accept & Continue". Confirm consent modal does NOT reappear on subsequent scans (`apex_scanner_consent_v1` in storage).
- [ ] **Scanner UI Invariants**:
  - Verify **"Beta"** pill badge is visible in scanner header.
  - Verify **"Scans Left Today"** counter displays (e.g. `30 scans left today`).
- [ ] **Single Clean In-Catalogue Scan**:
  - Scan a clear exotic/sports car (e.g., Porsche 911 or Ferrari on a computer screen).
  - Verify scanning indicator pulses cleanly.
  - Verify vehicle is identified with make, model, and year/generation.
  - Verify counter decrements by 1.
- [ ] **Error Code & User Feedback Mapping**:
  - Dark photo: Cover lens. Tap scan. Verify error toast: `"Photo too dark or unclear. Please ensure the vehicle is well-lit and unobstructed."` (not raw 400).
  - Unclear/No vehicle: Photograph a plain desk surface. Verify abstention: `"Couldn't reliably identify this vehicle."`
- [ ] **Server Timeout & Offline Fallback**:
  - Place phone in airplane mode immediately after tapping capture.
  - Verify graceful invocation of offline local feature matcher or clean offline toast: `"Network connection unstable. Local offline matcher invoked."`
- [ ] **Daily Cap Enforcement**:
  - If daily cap (30 scans) is reached, verify server returns HTTP 429 `USER_DAILY_LIMIT_EXCEEDED` and UI displays `"You have reached your daily beta scan limit (30 scans). Reset at midnight UTC."`

---

## 3. Operational Monitoring During Beta

### A. Watching Vercel Live Function Logs
1. Navigate to: **Vercel Dashboard > apex > Deployments > [Active Deployment] > Logs**
2. In the search filter box, type `/api/analyze` to isolate vision scan executions.
3. Key signals to monitor:
   - **HTTP 200**: Successful scan analysis.
   - **HTTP 304**: Cached image-hash match (0 tokens consumed, fast return).
   - **HTTP 429**: User exceeded 30 daily scans (`USER_DAILY_LIMIT_EXCEEDED`).
   - **HTTP 503**: Global free-tier budget reached (`SCANNER_BUSY`) or kill switch engaged (`SCANNER_DISABLED`).
   - **Latency**: Normal latency is 2.5s – 6.5s. If latency spikes above 15s, upstream Gemini is throttling.

### B. Monitoring Google Cloud Gemini Quota
1. Navigate to: [Google Cloud Console Quotas & System Limits](https://console.cloud.google.com/apis/api/generativelanguage.googleapis.com/quotas)
2. Filter for:
   - `GenerateContent requests per minute` (RPM): **Free-tier hard limit is 15 RPM**.
   - `GenerateContent requests per day` (RPD):
     - `gemini-3.1-flash-lite`: Cap is 500/day.
     - `gemini-3.5-flash-lite`: Cap is 500/day.
     - `gemini-3.5-flash`: Cap is 20/day (escalations only).
3. Verify that requests/minute stays comfortably below 12 RPM.

---

## 4. Emergency Procedures & Rollback

### Level 1: Temporary Scanner Pause (Soft Halt)
If Gemini experiences elevated 429/503 errors or daily provider quota is near 480/500:
1. In Vercel Environment Variables, set:
   ```env
   GEMINI_SCANNING_ENABLED=false
   ```
2. Redeploy or restart function instances.
3. **Behavior:** Scanner immediately returns HTTP 503 `"AI scanning service is temporarily undergoing maintenance. Please try again later."` without making any provider calls.

### Level 2: Pipeline Rollback (Safe V1 Fallback)
If VLM-first pipeline demonstrates unexpected edge regressions:
1. In Vercel Environment Variables, verify/set:
   ```env
   AI_PIPELINE=v1
   VLM_FIRST_ENABLED=false
   ```
2. Redeploy production.
3. **Behavior:** Reverts strictly to the battle-tested Phase 1/v1 pipeline with zero disruption to garage, social, and profile features.

### Level 3: Rarity Pinning
If local rarity calculations experience database lock contention:
1. In Vercel Environment Variables, set:
   ```env
   LOCAL_RARITY_XP_ENABLED=false
   LOCAL_RARITY_ENABLED=false
   ```
2. Reverts rarity multiplier immediately to 1.00x baseline.

---

## 5. Beta Tester Onboarding & Play Protect Sideload Instructions

### Sideload Installation & Google Play Protect Prompt
Because `app-release.apk` is signed with our private release key and distributed directly (outside Google Play Store), Android's Google Play Protect will show a warning dialog upon installation:

> **Play Protect Prompt:**  
> *"Blocked by Play Protect — Apex is an unrecognized app from an unknown developer. Apps from unknown sources may sometimes be unsafe."*

**Tester Action Instructions:**
1. Tap **"More details"** (small expandable text below the main warning).
2. Tap **"Install anyway"**.
3. If prompted by your browser or file manager ("Install unknown apps"), grant permission for that app to install APKs.

---

### Copy-and-Paste Message for Beta Testers
Copy and send this text to invited testers along with `app-release.apk`:

```markdown
👋 Welcome to the Apex Private Beta!

Thank you for helping us test Apex on Android! Here is everything you need to get started:

📲 Installation (Google Play Protect Notice):
Because this is a private prerelease build installed directly, Android Play Protect will show a warning:
"Blocked by Play Protect — Unrecognized app"
👉 Tap "More details" at the bottom of the prompt, then tap "Install anyway".

🚗 What to Spot & Scan:
- Apex is trained on sports cars, exotics, supercars, hypercars, and enthusiast icons (Porsche, Ferrari, Lamborghini, McLaren, Nissan GT-R, Corvette, etc.).
- Standard commuter vehicles (everyday hatchbacks and family sedans) will be recognized as "Uncatalogued / Not in current season".

📸 Privacy & Photography Guidelines:
- Please do NOT photograph people, faces, or legible license plates.
- Vehicle photos are analyzed via Google Gemini AI under free developer tier terms.
- For best accuracy, capture a clear 3/4 front or rear view in good lighting.

⏱️ Beta Quotas & Fair Use:
- Each tester has 10 scans per day.
- Quotas reset daily at midnight Pacific Time (~12:30 PM IST / 07:00 UTC).
- If the global community scanner reaches capacity, you may see "Scanner busy, daily community quota reached".

🌍 Regional Eligibility:
- The private beta is available in the US, Canada, Japan, India, and non-EEA countries. (Distribution to EEA/UK/Switzerland is currently restricted).

🐛 Feedback & Bugs:
- If the scanner misidentifies a vehicle, please send a screenshot to the beta group with the actual make and model!

Happy spotting! 🏁
```
