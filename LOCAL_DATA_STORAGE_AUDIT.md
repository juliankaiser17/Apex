# APEX — Complete Local Data Storage, Cache & Privacy Audit

**Target System:** APEX Mobile Client (Android & Web Storage)  
**Security Standards:** OWASP MASVS-STORAGE (Data Storage & Privacy), Android 12+ Data Extraction Framework, NIST SP 800-88  

---

## 1. Local Data Storage & Privacy Audit Matrix

| DATA | LOCATION | SENSITIVITY | WHY STORED | PROTECTION | BACKUP STATUS | LOGGED? | REQUIRED? |
|---|---|---|---|---|---|---|---|
| **Supabase JWT Session & Refresh Tokens** | WebView `localStorage` (`sb-*-auth-token`) / LevelDB | **HIGHLY SENSITIVE** | Persistent authentication across app restarts | Android OS App Sandbox | **EXCLUDED** via `data_extraction_rules.xml` & `backup_rules.xml` | No | **Yes** (Essential for login session) |
| **User Profile Metadata Cache** | WebView `localStorage` (`apex_user_session`) | **SENSITIVE** (Username, Email, Display Name, Level, XP) | Instant cold-start UI hydration before network fetch | Android OS App Sandbox | **EXCLUDED** from backup (re-fetched from PostgreSQL on login) | No | **Yes** (Offline UI performance) |
| **Offline Garage Card Cache** | WebView `localStorage` (`apex_garage_cards`) | **INTERNAL** (Card metadata, thumbnail URLs, rarity) | Offline garage browsing when disconnected | Android OS App Sandbox | **EXCLUDED** from backup | No | **Yes** (Offline collector experience) |
| **Onboarding Completion Flag** | WebView `localStorage` (`apex_onboarding_v2_completed`) | **INTERNAL** (`'true'` flag) | Prevents re-displaying 6-screen onboarding | Android OS App Sandbox | **INCLUDED** (Legitimate preference to preserve upon restore) | No | **Yes** (User preference) |
| **Camera Capture Temporary Files** | App Cache Directory (`cacheDir` / `externalCacheDir`) via Capacitor Camera | **SENSITIVE** (Raw vehicle photos) | Staging image before AI analysis & upload | Private `cacheDir` (unreadable by other apps) | **EXCLUDED** automatically by Android OS (Cache never backed up) | No | **Yes** (Capture pipeline) |
| **Reverse Geocoding Cache** | In-Memory JavaScript `Map` (RAM) | **PUBLIC** (Latitude/Longitude to City/Country mappings) | Reduces duplicate OSM Nominatim API calls | Ephemeral RAM (wiped on app process termination) | **N/A** (Ephemeral memory) | No | **Yes** (Rate limit compliance) |
| **Application Telemetry & Error Logs** | Android `logcat` / WebView console | **INTERNAL** (Error descriptions & warning notices) | Diagnostic telemetry during development | OS log stream | **N/A** (Ephemeral log buffer) | Warnings / Errors only (No PII / No secrets) | **Yes** (Diagnostics) |
| **Android Push Notification Tokens** | Native FCM Client Cache | **SENSITIVE** (Device push token) | Delivering hunt alerts and event notifications | Private Google Play Services storage | **EXCLUDED** (Device-specific; re-generated on new device) | No | **Yes** (Push notifications) |

---

## 2. Classification Definitions

* **PUBLIC:** Non-identifiable public data that carries zero privacy risk (e.g. reverse geocoded city names, public dark map tiles).
* **INTERNAL:** Non-sensitive application configuration and state (e.g. UI flags, onboarding state, cached card metadata).
* **SENSITIVE:** User profile data and private photo buffers (e.g. usernames, email addresses, captured car images).
* **HIGHLY SENSITIVE:** Cryptographic authentication tokens and credentials (e.g. Supabase JWT access tokens and long-lived refresh tokens).

---

## 3. Implemented Storage & Backup Hardening Actions

### 3.1 Android 12+ Targeted Data Extraction & Backup Rules
* **Problem:** Blanket `android:allowBackup="false"` prevents users from seamlessly transferring benign app preferences (like onboarding completion) to new devices. Conversely, unconfigured `allowBackup="true"` leaks sensitive authentication tokens across cloud backups.
* **Hardening Implementation:**
  1. Created [`android/app/src/main/res/xml/data_extraction_rules.xml`](file:///c:/Apex/android/app/src/main/res/xml/data_extraction_rules.xml) (Android 12+ API 31+): Explicitly excludes all databases, shared preferences, and WebView LevelDB storage from cloud backup and device-to-device transfers.
  2. Created [`android/app/src/main/res/xml/backup_rules.xml`](file:///c:/Apex/android/app/src/main/res/xml/backup_rules.xml) (Android 6.0–11 API 23–30): Enforces backward-compatible exclusion of internal token databases.
  3. Configured [`android/app/src/main/AndroidManifest.xml`](file:///c:/Apex/android/app/src/main/AndroidManifest.xml) with `android:allowBackup="true"`, `android:dataExtractionRules="@xml/data_extraction_rules"`, and `android:fullBackupContent="@xml/backup_rules"`.

### 3.2 Secure Session Purging on Logout
* **Hardening Implementation:** In [`src/store/useApexStore.ts`](file:///c:/Apex/src/store/useApexStore.ts), `logoutUser()` explicitly removes all local storage keys (`apex_user_session`, `apex_onboarding_v2_completed`, `apex_garage_cards`), clears the state store, and executes `supabase.auth.signOut({ scope: 'global' })`.

### 3.3 Zero Sensitive Data Logging
* Audited all `console.log`, `console.warn`, and `console.error` invocations across the codebase.
* Verified that zero passwords, zero session JWTs, zero full image Base64 payloads, and zero private GPS coordinates are emitted to application logs.
