# APEX — Collaborator & Co-Founder Setup Guide

Welcome to the **APEX** codebase. This guide explains how to get the project running locally and how environment variables and security are architected.

---

## 🚀 Quick Start (Zero-Config Standalone Mode)

APEX is built with **zero-credential standalone resilience**. You can clone and run the full application locally **without requiring any API keys or credentials**:

```bash
# 1. Install dependencies
npm install

# 2. Run local development server
npm run dev
```

The application will launch at `http://localhost:5173`.

---

## 🛡️ Standalone Mode Features (No API Keys Needed)

When running without a `.env` file, APEX automatically runs in **Local Standalone Mode**:
- **Vision Scanner:** Runs the high-performance local computer vision pipeline (`hunterSceneEngine.ts` and `offlineRecognitionEngine.ts`), recognizing silhouettes, contours, and vehicle badges offline.
- **Garage & Collectibles:** 3D interactive foil cards, card flips, audio synthesis, and stats calculations run completely in client memory and `localStorage`.
- **Telemetry & Quests:** Dynamic radar grids, daily quests, XP progression, and badges function seamlessly.
- **Social & Friends:** Local simulation and friends management with zero backend requirement.

---

## 🔑 Adding Optional Cloud Integrations

If you want to connect your own Supabase backend or AI Vision proxy for live cloud testing:

1. Copy the template:
   ```bash
   cp .env.example .env
   ```
2. Populate the `.env` file with your own developer credentials:
   ```env
   # Frontend Client Variables (Public identifiers)
   VITE_GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key

   # Backend / Serverless Proxy Secrets (Never exposed to mobile/web clients)
   GEMINI_API_KEY=your_gemini_api_key_from_google_ai_studio
   ```

> ⚠️ **Important Security Rule:** Never commit `.env` or any file containing private API keys to git. `.env` is permanently ignored by `.gitignore`.

---

## 📱 Android Development & Building APK

To test or build the Android application locally:

```bash
# 1. Build web distribution
npm run build

# 2. Sync to Android Capacitor project
npx cap sync android

# 3. Compile debug APK
cd android
./gradlew assembleDebug
```
The compiled APK will be located at:
`android/app/build/outputs/apk/debug/app-debug.apk`

---

## 🔒 Security Architecture Highlights

1. **Client-Side Secret Isolation:** No private API keys (such as `GEMINI_API_KEY` or Supabase Service Role keys) are ever embedded in the web bundle or native Android APK.
2. **Serverless AI Proxy:** Live AI vehicle analysis is routed through authenticated backend endpoints (`/api/analyze`), keeping secret keys strictly server-side.
3. **Graceful Failover:** In the absence of network connectivity or backend credentials, the scanner transparently fails over to the local offline engine with zero UI freezes or crashes.
