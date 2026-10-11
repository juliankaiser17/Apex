# APEX PRODUCTION ENGINEERING RUNBOOK

**Target Audience:** Engineering, QA, Release Operations  
**Single Source of Truth:** `docs/APEX_MASTER_PROGRAM.md`

---

## 1. Quick Start: Build, Sync, and Install

### 1.1 Web Client Production Build
To compile the client application with tree-shaking, code-splitting, and bundle hygiene checks:
```bash
npm run build
```
This triggers:
1. `tsc -b` (Full project TypeScript compilation)
2. `vite build` (Vite 8 production build into `dist/`)
3. `node scripts/check-client-bundle.mjs` (Enforces zero bare specifiers, zero Node builtins, zero admin leaks)

### 1.2 Capacitor Native Sync
After any change to web assets (`dist/`), sync the assets to the Android platform:
```bash
npx cap sync android
```
This copies `dist/*` into `android/app/src/main/assets/public/` and updates native Capacitor plugins.

### 1.3 Local Android APK Installation
To compile and install the debug build to a connected Android device or emulator:
```bash
cd android
./gradlew installDebug
```
(On Windows: `.\gradlew.bat installDebug`)

---

## 2. Diagnosing Boot and Black-Screen Failures

If the application displays a black screen, hangs on splash, or terminates unexpectedly, follow this structured triage process:

### 2.1 Mobile Browser Comparison (Isolate Native vs Web)
Run the Vite preview server accessible over local Wi-Fi:
```bash
npm run preview -- --host
```
Open the reported IP address (e.g. `http://192.168.1.X:4173`) in Chrome on the target Android device.
- **If the web preview loads normally**: The failure is native/Capacitor-specific (permissions, native preferences, splash screen plugin, or Android System WebView).
- **If the web preview fails with black screen**: The failure is a JavaScript syntax/runtime error or an unhandled Promise rejection on the main thread.

### 2.2 Live Android Logcat Capture
Connect the device via USB with USB Debugging enabled, and run:

**PowerShell (Windows):**
```powershell
& "C:\Users\DELL\AppData\Local\Android\Sdk\platform-tools\adb.exe" logcat -c
& "C:\Users\DELL\AppData\Local\Android\Sdk\platform-tools\adb.exe" logcat | Select-String "Capacitor|chromium|AndroidRuntime|Uncaught|apex"
```

**Bash / Linux / macOS:**
```bash
adb logcat -c
adb logcat | grep -E "Capacitor|chromium|AndroidRuntime|Uncaught|apex"
```

Look for:
- `chromium: [ERROR:console]` -> Direct JavaScript error trace with file and line number.
- `AndroidRuntime: FATAL EXCEPTION` -> Native Android crash (e.g., missing XML layout or security config).
- `Capacitor: Unable to open asset URL` -> Asset sync mismatch.

### 2.3 Chrome DevTools Remote Inspection
When testing a debug APK (`app-debug.apk`):
1. Open Google Chrome on your development machine.
2. Navigate to `chrome://inspect/#devices`.
3. Locate the `org.juliankaiser.apex` WebView under Remote Target.
4. Click **Inspect** to access DevTools: Console, Network, Elements, and Application storage.

---

## 3. Checklist of Common Black-Screen Causes & Solutions

| Cause | Diagnostic Indicator | Root Fix |
| :--- | :--- | :--- |
| **1. Server-Only Module Leakage** | `Uncaught TypeError: Failed to resolve module specifier "sharp"` | Ensure client never imports server code. Compile-time gate via `adminToolsPlugin` in `vite.config.ts`. Run `node scripts/check-client-bundle.mjs`. |
| **2. Stale Capacitor Native Assets** | Web changes not reflected on device; white/black flash | Run `npx cap sync android` after every `npm run build`. |
| **3. Leftover `server.url`** | `ERR_CONNECTION_REFUSED` in logcat | Verify `capacitor.config.ts` has NO `server.url` defined for production. Native WebView must load local `capacitor://localhost`. |
| **4. Outdated Android System WebView** | CSS styling broken; syntax error on modern ES features | Tailwind v4 requires Chrome 111+. The bootloader displays an explicit "Update Android System WebView" alert. |
| **5. Storage Preload Timeout / Lock** | User silently downgraded to Guest | `AppBootloader` in `src/main.tsx` mounts immediately and holds the splash until storage completes, preventing session loss. |
| **6. Missing Environment Variables** | Supabase client throws initialization error | Verify `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are present at build time (`import.meta.env`). |

---

## 4. Emergency Diagnostic Data Recovery

If a user reports a boot hang or crash, Apex stores sanitized crash forensics in local client storage:
- Stored key: `apex_last_boot_failure` (Bootloader crashes)
- Stored key: `apex_local_crash_reports` (React boundary and uncaught window errors via `crashReporter`)

Users can tap **"Copy Diagnostic Info"** directly on the recovery screen or provide the sanitized JSON export to support.
