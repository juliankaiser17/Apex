# APEX — Production Threat Model
**Target System:** APEX Android Application & Cloud Infrastructure  
**Methodology:** Asset-Driven Threat Modeling across Adversarial Trust Boundaries  
**Framework Alignment:** OWASP Threat Modeling Guide, OWASP MASVS v2.0  

---

## Threat Model 1: User XP & Global Leaderboard Integrity

```
Asset: User XP, Level, and Competitive Leaderboard Standings
↓
Entry point: Supabase PostgREST Profiles Endpoint (`PATCH /rest/v1/profiles`)
↓
Trust boundary: TB-1 (Adversarial Client <--> Supabase Database)
↓
Threat: Direct Manipulation of Profile XP, Coins, and Level via Authenticated HTTP Requests
↓
Impact: Complete collapse of competitive game mechanics; attackers can set arbitrary level (e.g., Level 50), unlimited XP (9,999,999), and steal top leaderboard ranks without scanning vehicles.
↓
Mitigation: 
  1. Revoke client-side UPDATE permission on `xp`, `level`, `coins`, `total_spots` columns in `profiles` table.
  2. Implement an atomic PostgreSQL RPC function (e.g. `submit_scan_verification()`) that calculates and credits XP strictly on the server based on verified scan records.
  3. Enforce strict database column-level security and trigger-based score reconciliation.
↓
Verification test: 
  Authenticate with a test user session JWT. Attempt an HTTP PATCH request to `/rest/v1/profiles?id=eq.<uid>` setting `{"xp": 999999, "level": 50}`. The database must return HTTP 403 Forbidden or reject modifying the restricted columns.
```

---

## Threat Model 2: Collectible Card Rarity & Garage Integrity

```
Asset: Digital Collectible Car Inventory & Rarity Roster
↓
Entry point: Supabase PostgREST Garage Endpoint (`POST /rest/v1/garage`)
↓
Trust boundary: TB-1 (Adversarial Client <--> Supabase Database)
↓
Threat: Spoofing Vehicle Rarity, Performance Stats, and Digital Cards
↓
Impact: Attackers can insert fake "Mythic" Bugatti/LaFerrari cards with maximum stats and arbitrary metadata directly into their garage without ever taking a photo or invoking AI vision.
↓
Mitigation:
  1. Prevent direct client INSERTs into the `garage` table.
  2. Create a server-side ingestion pipeline (Supabase Edge Function or RPC) that validates AI vision classification and assigns rarity server-side using server-managed production volume tables before issuing a new card.
  3. Cryptographically sign scan verification tokens on the backend before inserting into `garage`.
↓
Verification test:
  Issue a direct POST request to `/rest/v1/garage` with a fabricated payload `{"make": "Bugatti", "model": "Chiron", "rarity": "mythic", "xp_earned": 5000}`. The request must fail with an authorization error.
```

---

## Threat Model 3: Gemini & OpenAI API Credential Exfiltration & Quota Exhaustion

```
Asset: Cloud AI Vision API Credits & Billing Quotas (Google Cloud & OpenAI)
↓
Entry point: Client APK Asset Bundle (`dist/assets/*.js`) and Public Vercel Proxy (`/api/analyze`)
↓
Trust boundary: TB-2 & TB-3 (Public Internet / Decompiled Client <--> Cloud AI Endpoints)
↓
Threat: Extraction of `VITE_GEMINI_API_KEY` from Client Bundle & Unauthenticated Flooding of `/api/analyze`
↓
Impact: Attackers extract the Gemini API key from the disassembled APK to execute arbitrary LLM workloads on the developer's account, or flood `/api/analyze` with multi-megabyte payloads, causing denial of service and thousands of dollars in billing exhaustion.
↓
Mitigation:
  1. Remove all AI API keys from client environment variables and client bundles.
  2. Require valid Supabase Bearer JWT authentication on all `/api/analyze` requests.
  3. Implement strict IP and user rate limiting (e.g. Upstash Redis token bucket: max 10 scans/hour/user).
  4. Enforce server-side HMAC validation or Google Play Integrity attestation tokens on analysis requests.
↓
Verification test:
  1. Search compiled APK string tables for Gemini API keys — zero keys should be present.
  2. Attempt an unauthenticated HTTP POST to `/api/analyze` without an `Authorization: Bearer <jwt>` header. The server must return HTTP 401 Unauthorized immediately without calling OpenAI/Gemini.
```

---

## Threat Model 4: Photo Authenticity & Real-World Car Spotting Verification

```
Asset: Real-World Vehicle Authenticity (Ensuring Photos Are Real Cars, Taken Live)
↓
Entry point: Scanner Modal Image Ingestion Pipeline (`identifyVehicleWithAi`)
↓
Trust boundary: TB-1 (Adversarial Client <--> Cloud Vision Engine)
↓
Threat: Bypassing Client-Side EXIF and Authenticity Checks with Downloaded Web Images or AI Renders
↓
Impact: Users can upload stock Google/Pinterest images, video game screenshots (Forza/Gran Turismo), or AI-generated cars, breaking the core premise of real-world car hunting and devaluing honest players' collections.
↓
Mitigation:
  1. Relocate all EXIF timestamp/software verification and visual authenticity analysis (screen detection, AI artifact detection) to server-side execution.
  2. Enforce camera-only capture pipeline natively via Capacitor Camera (preventing file gallery selection).
  3. Reject images with missing/modified EXIF or software tags indicating editing tools (Photoshop, Canva, Snapseed).
  4. Perform perceptual hashing (pHash) against an indexed database of known web images to detect scraped photos.
↓
Verification test:
  Submit a known high-resolution stock photo of a Ferrari from Unsplash to the ingestion endpoint. The server must detect that the photo timestamp/hash violates live-capture constraints and reject the scan.
```

---

## Threat Model 5: Account Identity Spoofing & Insecure Offline Fallback

```
Asset: User Account Identity & Authentication State
↓
Entry point: Google Auth Service Fallback Handler (`triggerGoogleSignIn` in `src/services/googleAuthService.ts`)
↓
Trust boundary: TB-1 (Client Logic <--> User Session Management)
↓
Threat: Simulated Demo Account Generation & Unverified Profile Creation
↓
Impact: If client-side Google GIS initialization fails, the application generates a local fake session (`google-user-${Date.now()}`) and allows unverified client-side database insertion, corrupting user profiles.
↓
Mitigation:
  1. Completely remove insecure mock/demo user fallback logic from `googleAuthService.ts`.
  2. Enforce atomic server-side user provisioning via a PostgreSQL `AFTER INSERT ON auth.users` trigger that creates the `profiles` row inside the same database transaction.
  3. Require cryptographic verification of Google ID tokens via Supabase Auth backend.
↓
Verification test:
  Disconnect network access during Google GIS sign-in. Verify that the application displays an explicit error message and halts rather than logging in as a mock `spotter@apex.app` user.
```

---

## Threat Model 6: Binary Tampering, Hooking & APK Repackaging

```
Asset: Application Binary Integrity & JavaScript Bundle Logic
↓
Entry point: Android APK Package (`org.juliankaiser.apex`)
↓
Trust boundary: TB-1 (Device Runtime <--> Operating System)
↓
Threat: Decompilation, Runtime Hooking (Frida/Xposed), and APK Repackaging with Modified Logic
↓
Impact: Attackers decompile the app using `jadx`/`apktool`, locate client game engine rules (e.g. `regionalRarityEngine.ts`), force 100% Mythic drop rates, re-sign the APK, and distribute cracked binaries.
↓
Mitigation:
  1. Enable R8 code shrinking and ProGuard obfuscation (`minifyEnabled true`) in `android/app/build.gradle`.
  2. Implement Google Play Integrity API to verify binary signature and hardware attestation on critical actions.
  3. Shift all game-critical score calculations to the backend so modified client logic cannot alter game state.
↓
Verification test:
  Decompile release APK with `jadx-gui`. Verify that native class names, method signatures, and sensitive strings are obfuscated and unreadable.
```

---

## Threat Model 7: User Geolocation Privacy & Spatial Location Disclosure

```
Asset: User Physical Location & Home Privacy
↓
Entry point: GPS Geolocation Ingestion (`reverseGeocodeCity` and `posts` / `garage` latitude/longitude columns)
↓
Trust boundary: TB-1 (Client Geolocation <--> Public PostgREST Database)
↓
Threat: Storage & Leakage of Exact User Coordinates from Private Scans
↓
Impact: If a user scans a vehicle in their private residential driveway, exact GPS coordinates stored in the public `garage` or `posts` table would allow malicious actors to track user residences.
↓
Mitigation:
  1. Never store raw GPS latitude/longitude in public database columns.
  2. Enforce spatial fuzzing/blurring (1.5km–2.5km grid truncation or reverse-geocoded city name only) on the server before persisting post data.
  3. Implement strict PostgreSQL column masking for location attributes when `privacy_level != 'public'`.
↓
Verification test:
  Query `/rest/v1/garage` for other users' public spots. Inspect the returned JSON payload to confirm that raw coordinates are either null or generalized to city-level precision.
```

---

## Threat Model 8: Unprotected Plaintext Session Tokens in WebStorage

```
Asset: Supabase Session JWTs & User Profile Cache
↓
Entry point: Webview Sandbox `localStorage` LevelDB Database
↓
Trust boundary: TB-1 (Android Sandbox <--> Local Storage Subsystem)
↓
Threat: Plaintext Token Extraction from Web Storage on Rooted or Compromised Devices
↓
Impact: Access tokens and long-lived refresh tokens stored unencrypted in `localStorage` can be extracted by malware with root access or local forensic inspection tools.
↓
Mitigation:
  1. Maintain `android:allowBackup="false"` (already implemented).
  2. Migrate session token storage on Android from HTML5 `localStorage` to Android Keystore / EncryptedSharedPreferences via Capacitor Secure Storage plugin.
  3. Configure short-lived JWT access tokens (e.g. 15 minutes) with rotating refresh tokens and token reuse detection in Supabase Auth.
↓
Verification test:
  Inspect `/data/data/org.juliankaiser.apex/app_webview/` on a rooted test device. Verify that sensitive authentication tokens cannot be retrieved in plaintext from LevelDB files.
```
