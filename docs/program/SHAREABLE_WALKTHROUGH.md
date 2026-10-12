# Apex Private Beta — Sprint Walkthrough & Operational Guide

**Classification:** Shareable / Team Copy  
**Target:** Team Members, Beta Coordinators & External Collaborators  
**Date:** October 12, 2026  

---

## 1. What Was Accomplished (Sprint Walkthrough)

### A. Release Build & Signing Security
- **Security Audit:** Conducted a comprehensive Git history audit across all branches. Verified that no signing certificates, keystore files, or sensitive secrets were ever committed to version control.
- **Credential Protection:** Configured repository ignore rules to prevent `.jks` and keystore property files from being tracked.
- **Environment-Driven Release Automation:** Upgraded the Android release build script to ingest signing credentials exclusively via environment variables during local or CI build jobs.

### B. Vision AI Pipeline Parity & Re-Measurement
- **Image Preprocessing Parity:** Aligned the evaluation harness with production mobile client behavior (progressive downscale to 768px at 82% JPEG compression).
- **Parity Re-Measurement Evaluation:** Evaluated a stratified 60-image validation benchmark (35 in-catalogue enthusiast and exotic sports cars, 20 commuter models, 5 non-vehicle negatives) on `gemini-3.5-flash-lite`:
  - **Model Identification Accuracy (Answered):** **92.9%** (13/14) — *Exceeds the $\ge 90\%$ production threshold.*
  - **Wrong-but-Confident Rate (Model Level):** **0.0%** (0/35) — *Exceeds the $\le 5\%$ safety threshold.*
  - **Commuter & Anomaly Rejection:** **88.0%** (22/25) of out-of-catalogue commuter vehicles and synthetic negatives were correctly rejected.
  - **Negative Image Detection:** **100%** of non-vehicle images were correctly filtered.
- **Production Pipeline Baseline:** Configured `vlm-first` as the active production pipeline mode, with the Phase 1 pipeline preserved as an instant rollback option.

### C. Combined Escalation Policy
- **Offline Benchmark Analysis ($N=245$):** Evaluated a dual-tier policy combining primary inference (`gemini-3.5-flash-lite`) with selective secondary fallback (`gemini-3.1-flash-lite`) when the primary model abstains on ambiguous angles:
  - **Answer Rate:** Increased to **55.6%** (75/135) — *Surpasses the $\ge 50\%$ bar.*
  - **Model Accuracy (Answered):** Maintained at **94.7%** (71/75).
  - **Model Wrong-but-Confident:** **3.0%** (4/135) — *Well within the $\le 5\%$ safety ceiling.*
- **Implementation:** Gated this escalation logic behind a configuration flag (`COMBINED_ESCALATION_ENABLED`) to ensure strictly bounded provider calls per scan.

### D. Safe UI Variant Gating
- Hardened the scanner interface and collectible card presentation:
  - When the AI engine identifies the model family but cannot verify the specific trim with high certainty ($\ge 70\%$), the vehicle trim is omitted.
  - The card displays the confirmed base model family (e.g., `Porsche 911`), and the user receives clear feedback: *"Specific trim unverified from visible angle"*.

### E. Rate Limits & Fair-Use Quota Management
- **Daily Scan Allocation:** Set a default fair-use limit of 10 scans per user per day.
- **Server-Side Enforcement:** Scan counters are validated server-side to prevent client bypass.
- **Graceful Upstream Error Handling:** Upstream provider quota exhaustion or temporary server busy states automatically resolve to user-friendly status notifications (`"Scanner busy, daily community quota reached"`), avoiding unexpected app disruptions.

### F. Launch Safeguards & Guidelines
- **Zero Benchmarks on Launch Day:** All automated evaluation scripts are paused on launch day to preserve community free-tier quotas for real beta testers.
- **Geographic Eligibility:** Beta invitations are focused on testers in non-EEA regions (e.g. US, Canada, Japan, India).
- **Tester Sideload Instructions:** Standardized installation instructions for Google Play Protect dialogs during sideload setup.

---

## 2. Beta Rollout & Tester Onboarding Guide

### Step 1: Release Artifact Verification
Ensure the generated Android release package is verified before distribution:
- **Package Name:** `org.juliankaiser.apex`
- **Minimum Supported OS:** Android 7.0 (API Level 24)
- **Target OS:** Android 16 (API Level 36)
- **Artifact:** `app-release.apk`
- **Security Check:** Zero server modules, development stubs, or uncompiled assets present in bundle.

### Step 2: Environment Configuration Checklist
Confirm production deployment settings in your hosting dashboard:
- Primary Vision Provider: `gemini`
- Active Pipeline Mode: `vlm-first`
- User Daily Scan Allocation: `10`
- Kill Switch Ready: Fast rollback available via configuration toggle.

### Step 3: Physical Device Verification Smoke Test
Before sharing with invited testers, verify the application on a physical device:
1. Sideload `app-release.apk`.
2. When the Android Play Protect dialog appears (*"Unrecognized app from an unknown source"*), tap **More details** $\to$ **Install anyway**.
3. Launch Apex and tap the camera button.
4. Confirm the **AI Vision Privacy & Beta Consent Screen** displays on first launch.
5. Capture a test vehicle image in daylight or from a screen to confirm the scanning sequence, discovery reveal, and quota counter decrement.

### Step 4: Shareable Message for Invited Beta Testers
Copy and send this text to beta testers alongside the installation package:

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
- Vehicle photos are analyzed via AI under fair-use developer terms.
- For best accuracy, capture a clear 3/4 front or rear view in good lighting.

⏱️ Beta Quotas & Fair Use:
- Each tester has 10 scans per day.
- Quotas reset daily at midnight Pacific Time (~12:30 PM IST / 07:00 UTC).
- If the global community scanner reaches capacity, you may see "Scanner busy, daily community quota reached".

🌍 Regional Eligibility:
- The private beta is available in the US, Canada, Japan, India, and non-EEA countries.

🐛 Feedback & Bugs:
- If the scanner misidentifies a vehicle, please share a screenshot with the actual make and model!

Happy spotting! 🏁
```

---

## 3. Operational Monitoring Checklist
- **Function Logs:** Review live serverless endpoint logs for scan activity, latency, and status code distributions.
- **Provider Quota Metrics:** Monitor daily and per-minute usage in the cloud provider quota dashboard to ensure smooth operating margins.
- **Rollback Procedure:** If unexpected behavior is observed, the primary pipeline flag can be toggled to restore baseline operation immediately without rebuilding the native app.
