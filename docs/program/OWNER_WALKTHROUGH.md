# Apex Private Beta — Complete Owner Walkthrough & Manual Action Guide

**Target Audience:** Repository Owner / Lead Engineer  
**Classification:** Internal & Confidential (Contains complete operational instructions and infrastructure references)  
**Date:** October 12, 2026  

---

## 1. What Antigravity Accomplished (Sprint Walkthrough)

### A. Keystore Hygiene & Security Hardening
- **Git History Audit:** Scanned the complete Git history (`git log --all --full-history`) and search logs (`git log -S "apexbeta2026"`). Confirmed that **neither the keystore nor any signing password was ever committed**.
- **Credential Scrubbing:** Purged all plaintext passwords and hardcoded fallback keys from [ANDROID_RELEASE_SIGNING.md](file:///c:/Users/DELL/Downloads/Apex-main/Apex-main/docs/program/ANDROID_RELEASE_SIGNING.md), [FINAL_REPORT.md](file:///c:/Users/DELL/Downloads/Apex-main/Apex-main/docs/program/FINAL_REPORT.md), and [build-android-release.mjs](file:///c:/Users/DELL/Downloads/Apex-main/Apex-main/scripts/build-android-release.mjs).
- **Gitignore Protection:** Added `keystore.properties` (and confirmed `*.jks`) to [.gitignore](file:///c:/Users/DELL/Downloads/Apex-main/Apex-main/.gitignore).
- **Environment-Only Release Script:** Updated [scripts/build-android-release.mjs](file:///c:/Users/DELL/Downloads/Apex-main/Apex-main/scripts/build-android-release.mjs) so signing keys and passwords can only be provided via environment variables (`APEX_RELEASE_KEYSTORE`, `APEX_RELEASE_STORE_PASSWORD`, `APEX_RELEASE_KEY_ALIAS`, `APEX_RELEASE_KEY_PASSWORD`).

### B. Pipeline Parity & Stratified 60-Image Re-Measurement
- **Disclosed Image Discrepancy:** Identified that the previous measurement harness evaluated raw uncompressed images directly from disk. The production client app actually downscales photos to max 768px at 82% JPEG (`optimizeScanImage`).
- **Production Parity Eval Run:** Authored and ran [scripts/run_production_parity_eval.ts](file:///c:/Users/DELL/Downloads/Apex-main/Apex-main/scripts/run_production_parity_eval.ts) evaluating 60 stratified validation images (35 in-catalogue sports/exotics, 20 commuter vehicles, 5 synthetic negatives) with client-identical 768px, 82% JPEG preprocessing on `gemini-3.5-flash-lite`:
  - **Answer Rate:** 40.0% (14/35) [95% CI: 25.6% – 56.4%]
  - **Model Accuracy (Answered):** **92.9%** (13/14) [95% CI: 68.5% – 98.7%] — **Passes $\ge 90\%$ bar**
  - **Wrong-but-Confident (Model):** **0.0%** (0/35) — **Passes $\le 5\%$ bar**
  - **Out-of-Catalogue Correct Rejection:** 88.0% (22/25)
  - **Synthetic Negatives Rejection:** 100% (5/5 rejected)
  - **Consistency with Raw Baseline:** 74.3%
- **Production Default Setting:** Updated [LAUNCH_DAY.md](file:///c:/Users/DELL/Downloads/Apex-main/Apex-main/docs/program/LAUNCH_DAY.md) to set `AI_PIPELINE=vlm-first` and `VLM_FIRST_ENABLED=true` while keeping `v1` as the instant one-step rollback.

### C. Combined Policy Offline Computation ($N=245$)
- Evaluated the two-tier escalation policy (`gemini-3.5-flash-lite` primary $\to$ `gemini-3.1-flash-lite` on abstention) using [scripts/compute_combined_policy_offline.ts](file:///c:/Users/DELL/Downloads/Apex-main/Apex-main/scripts/compute_combined_policy_offline.ts):
  - **Answer Rate:** Jumped to **55.6%** (75/135) [95% CI: 47.1% – 63.7%] — **Passes $\ge 50\%$ bar**
  - **Model Accuracy (Answered):** **94.7%** (71/75) [95% CI: 87.1% – 97.9%] — **Passes $\ge 90\%$ bar**
  - **Model Wrong-but-Confident:** **3.0%** (4/135) [95% CI: 1.2% – 7.4%] — **Passes $\le 5\%$ bar**
  - **Variant Wrong-but-Confident:** **3.0%** (4/135) [95% CI: 1.2% – 7.4%] — **Passes $\le 5\%$ bar**
- Implemented this policy behind the `COMBINED_ESCALATION_ENABLED=true` configuration flag in [src/ai-engine/v2/vlmFirstEngine.ts](file:///c:/Users/DELL/Downloads/Apex-main/Apex-main/src/ai-engine/v2/vlmFirstEngine.ts) and [src/ai-engine/config/pipelineConfig.ts](file:///c:/Users/DELL/Downloads/Apex-main/Apex-main/src/ai-engine/config/pipelineConfig.ts).

### D. UI Variant Gating Hardening
- Updated [src/components/scanner/ScannerModal.tsx](file:///c:/Users/DELL/Downloads/Apex-main/Apex-main/src/components/scanner/ScannerModal.tsx#L470-L480):
  - If vehicle identification status is `identified_model`, or variant confidence is below threshold (< 0.70), or variant is unverified: `card.trim` is strictly set to `undefined` and `card.specificityLevel` to `'model_family'`.
  - The collectible card and hero title display only the base model family (e.g. `Porsche 911`, `Lamborghini Huracán`), and the discovery reveal subtitle explicitly shows `"Specific trim unverified from visible angle"`.

### E. Quota Management & Error Mapping
- **Daily Scans Counter:** Confirmed `daily_scans_count` is incremented server-side only in Postgres RPC `record_car_scan` (`supabase/schema.sql`). Authored proposal [docs/proposals/server_authoritative_daily_scan_counter.md](file:///c:/Users/DELL/Downloads/Apex-main/Apex-main/docs/proposals/server_authoritative_daily_scan_counter.md) for non-collectible scan attempts.
- **Configurable Per-User Cap:** Made daily cap configurable with default 10 across [pipelineConfig.ts](file:///c:/Users/DELL/Downloads/Apex-main/Apex-main/src/ai-engine/config/pipelineConfig.ts) and [HunterOverlay.tsx](file:///c:/Users/DELL/Downloads/Apex-main/Apex-main/src/components/scanner/HunterOverlay.tsx).
- **HTTP 429 Graceful Error Mapping:** Updated [src/api/analyze.ts](file:///c:/Users/DELL/Downloads/Apex-main/Apex-main/src/api/analyze.ts) and [api/analyze.js](file:///c:/Users/DELL/Downloads/Apex-main/Apex-main/api/analyze.js) so upstream Gemini 429 / quota exhaustion errors fail gracefully with HTTP 503 `SCANNER_BUSY` (`"Scanner busy, daily community quota reached. Please try tomorrow!"`).

### F. Launch Day Safety Rules in Runbook
- Updated [docs/program/LAUNCH_DAY.md](file:///c:/Users/DELL/Downloads/Apex-main/Apex-main/docs/program/LAUNCH_DAY.md):
  - **Zero Evals on Launch Day:** Strict rule against running evals to preserve the 500 requests/day quota for testers.
  - **Quota Reset Window:** Documented quota reset timing at midnight Pacific Time (~12:30 PM IST / 07:00 UTC).
  - **Territorial Restriction:** Restricted distribution away from EEA/UK/Switzerland (due to EU AI Act and GDPR free-tier API terms).
  - **Play Protect Notice:** Provided the exact prompt dialog text and instructions for testers installing sideloaded APKs.

---

## 2. What YOU Have to Do Manually Now (Step-by-Step)

Follow this checklist in order before distributing the APK to testers:

### Step 1: Create Your Private Release Keystore (Outside Repo)
Open a terminal (PowerShell or Bash) and run:

```bash
# 1. Create a secure folder in your user home directory (OUTSIDE this git repository):
mkdir -p "$HOME/apex-secure-keys"

# 2. Generate your upload keypair:
keytool -genkeypair -v \
  -keystore "$HOME/apex-secure-keys/apex-release-key.jks" \
  -alias apex-release \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000

# When prompted, enter a strong password and your name/org details.
```

### Step 2: Extract SHA-1 Fingerprint
Print the certificate fingerprint to configure Google Cloud OAuth:

```bash
keytool -list -v \
  -keystore "$HOME/apex-secure-keys/apex-release-key.jks" \
  -alias apex-release
```
Look for the line:
`SHA1: XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX`  
Copy this value.

### Step 3: Configure Google Cloud Console OAuth Client
1. Open [Google Cloud Console Credentials](https://console.cloud.google.com/apis/credentials).
2. Ensure you have the Apex project selected.
3. Click **Create Credentials** > **OAuth client ID**.
4. Choose Application Type: **Android**.
   - **Package name:** `org.juliankaiser.apex`
   - **SHA-1 certificate fingerprint:** Paste the SHA-1 you extracted in Step 2.
5. Save the client ID.

### Step 4: Verify Supabase Google Auth Provider
1. Open your [Supabase Dashboard](https://supabase.com/dashboard) > Your Project > **Authentication** > **Providers** > **Google**.
2. Confirm Google is enabled and the **Client ID** matches your Google Web OAuth Client ID.
3. Ensure `VITE_GOOGLE_CLIENT_ID` in your `.env` matches this Web Client ID.

### Step 5: Configure Vercel Production Environment Variables
1. Open [Vercel Dashboard](https://vercel.com) > Apex Project > **Settings** > **Environment Variables**.
2. Configure or confirm the following values for Production:
   - `AI_PIPELINE` = `vlm-first`
   - `VLM_FIRST_ENABLED` = `true`
   - `VISION_PROVIDER` = `gemini`
   - `GEMINI_SCANNING_ENABLED` = `true`
   - `CLOUDFLARE_SCANNING_ENABLED` = `false`
   - `GEMINI_API_KEY` = `<your_active_gemini_api_key>`
   - `USER_DAILY_SCAN_CAP` = `10`
   - `EXPENSIVE_VERIFICATION_ENABLED` = `false`
   - `COMBINED_ESCALATION_ENABLED` = `false` *(keep false for baseline, or set true if you want 3.1 fallback on abstention)*
   - `LOCAL_RARITY_ENABLED` = `true`
   - `LOCAL_RARITY_XP_ENABLED` = `true`
3. Trigger a **Redeploy** on Vercel (Deployments > three dots > Redeploy) to ensure the variables take effect.

### Step 6: Build the Signed Release APK
In your project terminal, set the environment variables and run the release build script:

**On Windows PowerShell:**
```powershell
$env:APEX_RELEASE_KEYSTORE = "$HOME\apex-secure-keys\apex-release-key.jks"
$env:APEX_RELEASE_STORE_PASSWORD = "your-keystore-password"
$env:APEX_RELEASE_KEY_ALIAS = "apex-release"
$env:APEX_RELEASE_KEY_PASSWORD = "your-key-password"

node scripts/build-android-release.mjs
```

**On macOS / Linux:**
```bash
export APEX_RELEASE_KEYSTORE="$HOME/apex-secure-keys/apex-release-key.jks"
export APEX_RELEASE_STORE_PASSWORD="your-keystore-password"
export APEX_RELEASE_KEY_ALIAS="apex-release"
export APEX_RELEASE_KEY_PASSWORD="your-key-password"

node scripts/build-android-release.mjs
```

This will output:
- **Release APK:** `android/app/build/outputs/apk/release/app-release.apk`
- **Release AAB:** `android/app/build/outputs/bundle/release/app-release.aab`

### Step 7: Perform Physical Device Smoke Test
Before distributing to anyone else, test on your own physical Android phone:
1. Transfer `app-release.apk` to your phone via USB or Google Drive.
2. Tap the APK to install.
3. When **Google Play Protect** displays:  
   `"Blocked by Play Protect — Apex is an unrecognized app"`  
   Tap **"More details"**, then tap **"Install anyway"**.
4. Launch Apex.
5. Tap the Camera / Scanner icon:
   - Confirm the **AI Vision Privacy & Beta Consent Modal** appears.
   - Tap **"Accept & Continue"**.
   - Check that the header displays **"Beta"** and **"10 scans left today"**.
6. Scan a picture of a Porsche 911 or Ferrari on your computer monitor:
   - Confirm it scans smoothly and reveals the car card.
   - Check that the scan counter decrements to 9.
7. Cover the camera lens with your finger and take a dark photo:
   - Confirm it returns `"Photo too dark or unclear..."` without crashing.

### Step 8: Distribute to Beta Testers
1. Upload `app-release.apk` to Google Drive or send it directly to your test cohort (recommended: 5–15 testers).
2. Copy and send them the ready-to-use message below:

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

### Step 9: Launch Day Monitoring
- Open [Vercel Dashboard Logs](https://vercel.com) and filter by `/api/analyze`.
- Monitor requests and ensure HTTP 200 responses are returning with 2.5s–5.5s latency.
- If upstream Gemini quota is exhausted, the app will safely respond with HTTP 503 `SCANNER_BUSY`.
- In case of any unexpected issue, toggle Vercel environment variable `AI_PIPELINE=v1` and `VLM_FIRST_ENABLED=false` for instant one-step rollback.
