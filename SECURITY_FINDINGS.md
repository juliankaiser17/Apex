# APEX — Production Security Findings & Vulnerability Assessment
**Target System:** APEX Android Application & Cloud Services  
**Assessment Phase:** Phase 1 — Reconnaissance & Vulnerability Identification  
**Compliance Standard:** OWASP Mobile Application Security Verification Standard (MASVS v2.0)  

---

## Vulnerability Summary Matrix

| Finding ID | Title | Severity | OWASP MASVS Domain | Affected Component | Status |
|---|---|---|---|---|---|
| **APEX-SEC-01** | Client-Controlled Authority Over XP, Level & Collectible Rarity | **CRITICAL** | MASVS-AUTH / Business Logic | `useApexStore.ts`, `schema.sql` | Open |
| **APEX-SEC-02** | Exposure of Google Gemini API Key in Client JavaScript Bundle | **CRITICAL** | MASVS-CRYPTO / MASVS-STORAGE | `aiVisionService.ts`, `.env` | Open |
| **APEX-SEC-03** | Unauthenticated & Unthrottled AI Vision Proxy Endpoint | **HIGH** | MASVS-NETWORK / Architecture | `api/analyze.ts` | Open |
| **APEX-SEC-04** | Insecure Mock User Account Fallback Mechanism | **HIGH** | MASVS-AUTH | `googleAuthService.ts` | Open |
| **APEX-SEC-05** | Release Code Minification & R8 Obfuscation Disabled | **HIGH** | MASVS-CODE | `android/app/build.gradle` | Open |
| **APEX-SEC-06** | Client-Side Image Authenticity & EXIF Validation Bypass | **MEDIUM** | MASVS-AUTH / Anti-Cheat | `authenticityPipeline.ts` | Open |
| **APEX-SEC-07** | Missing Android Network Security Configuration | **MEDIUM** | MASVS-NETWORK | `AndroidManifest.xml` | Open |
| **APEX-SEC-08** | Insecure Storage of Authentication Tokens in Plaintext WebStorage | **MEDIUM** | MASVS-STORAGE | `supabase.ts`, `localStorage` | Open |
| **APEX-SEC-09** | Missing Server-Side Database Schema Check Constraints | **LOW** | MASVS-PLATFORM | `supabase/schema.sql` | Open |
| **APEX-SEC-10** | Unthrottled Reverse Geocoding via Public Nominatim Instance | **LOW** | MASVS-NETWORK | `geolocation.ts` | Open |

---

## Detailed Vulnerability Analysis

---

### [CRITICAL] APEX-SEC-01: Client-Controlled Authority Over XP, Level & Collectible Rarity

* **MASVS Control:** MASVS-AUTH (Authentication & Session Management / Server-Side Authority)
* **Vulnerability Type:** Broken Business Logic / Insecure Direct Object Manipulation
* **Affected Files:**
  - [`c:\Apex\src\store\useApexStore.ts`](file:///c:/Apex/src/store/useApexStore.ts#L390-L435)
  - [`c:\Apex\supabase\schema.sql`](file:///c:/Apex/supabase/schema.sql#L53-L70)

#### Description
In `useApexStore.ts`, the Android client directly computes the user's scan XP, level progression, and collectible rarity score (`calculateScanXp()`, `getLevelFromXp()`, `calculateRegionalRarity()`), and then executes direct SQL `INSERT` and `UPDATE` queries against Supabase PostgREST:
```typescript
// In useApexStore.ts:
await supabase.from('garage').insert({
  id: newCard.id,
  user_id: state.user.id,
  make: newCard.make,
  model: newCard.model,
  rarity: newCard.rarity, // <-- CLIENT PROVIDED!
  xp_earned: xpGained     // <-- CLIENT CALCULATED!
});

await supabase.from('profiles').update({ 
  xp: state.user.xp + xpGained, // <-- CLIENT OVERWRITE!
  total_spots: state.user.totalSpots + 1 
}).eq('id', state.user.id);
```
The database Row Level Security policy in `schema.sql` only verifies that the authenticated user owns the record (`auth.uid() = id`), but performs **zero validation** on the values being updated.

#### Proof of Concept / Exploit Scenario
An attacker authenticates via Google/Email, captures their session JWT, and executes the following cURL command directly to Supabase:
```bash
curl -X PATCH "https://nxrtnexhyieiszgglhbn.supabase.co/rest/v1/profiles?id=eq.<user-id>" \
  -H "Authorization: Bearer <user-jwt>" \
  -H "apikey: <supabase-anon-key>" \
  -H "Content-Type: application/json" \
  -d '{"xp": 9999999, "level": 50, "total_spots": 5000, "coins": 99999}'
```
**Result:** The database immediately updates the attacker's account to Level 50 with 9,999,999 XP, granting top placement on the global leaderboard without scanning a single vehicle.

#### Remediation Plan
1. Alter `profiles` RLS policy to disallow client `UPDATE` on `xp`, `level`, `coins`, and `total_spots` columns.
2. Implement a PostgreSQL stored procedure / RPC (e.g., `verify_and_record_scan()`) that calculates XP server-side and atomically increments user profile metrics.

---

### [CRITICAL] APEX-SEC-02: Exposure of Google Gemini API Key in Client JavaScript Bundle

* **MASVS Control:** MASVS-CRYPTO / MASVS-STORAGE (Key Management & Storage)
* **Vulnerability Type:** Hardcoded / Bundled API Credential Exposure
* **Affected Files:**
  - [`c:\Apex\src\services\aiVisionService.ts`](file:///c:/Apex/src/services/aiVisionService.ts#L109-L121)
  - [`c:\Apex\.env`](file:///c:/Apex/.env)

#### Description
In `src/services/aiVisionService.ts`, the Google Gemini AI client is initialized directly on the Android device using `import.meta.env.VITE_GEMINI_API_KEY`:
```typescript
const geminiKey = import.meta.env.VITE_GEMINI_API_KEY;
const ai = new GoogleGenAI({ apiKey: geminiKey });
```
Vite embeds all environment variables prefixed with `VITE_` directly into the static JavaScript output during build time (`dist/assets/*.js`), which is packaged inside the APK assets directory (`android/app/src/main/assets/public/`).

#### Proof of Concept / Exploit Scenario
1. Download `APEX.apk` from the device or release repository.
2. Run `strings` or decompile with `unzip` and `grep`:
   ```bash
   grep -rn "AIzaSy" dist/assets/
   ```
3. The full Google Cloud API key is revealed in plaintext, permitting unauthenticated third-party queries against Google Gemini 2.0 Flash at the project owner's expense.

#### Remediation Plan
1. Remove `VITE_GEMINI_API_KEY` from the client codebase.
2. Route all AI vision requests through the serverless backend (`/api/analyze`), holding API keys strictly within server-side environment variables.

---

### [HIGH] APEX-SEC-03: Unauthenticated & Unthrottled AI Vision Proxy Endpoint

* **MASVS Control:** MASVS-NETWORK / Architecture
* **Vulnerability Type:** Unauthenticated Resource Consumption / Denial of Service
* **Affected Files:**
  - [`c:\Apex\api\analyze.ts`](file:///c:/Apex/api/analyze.ts#L39-L57)

#### Description
The serverless endpoint `/api/analyze` accepts Base64 image payloads up to 4MB and forwards them to OpenAI (`gpt-4o`) and Google Gemini (`gemini-2.5-flash`). However, the handler does **not** verify any Supabase Auth JWT header, session cookie, or rate limit.

#### Proof of Concept / Exploit Scenario
An automated bot script executes a loop sending 1,000 requests per minute to `https://apex-spotter.vercel.app/api/analyze` with arbitrary image payloads:
```python
import requests
for i in range(1000):
    requests.post("https://apex-spotter.vercel.app/api/analyze", json={"imageBase64": "...", "mimeType": "image/jpeg"})
```
**Result:** The server executes paid OpenAI GPT-4o Vision queries continuously, exhausting API quotas and incurring significant financial cost within minutes.

#### Remediation Plan
1. Extract and verify the caller's Supabase JWT token using `@supabase/supabase-js` on the server before invoking AI models.
2. Enforce strict rate limits (e.g. 10 requests per user per hour).

---

### [HIGH] APEX-SEC-04: Insecure Mock User Account Fallback Mechanism

* **MASVS Control:** MASVS-AUTH (Authentication Architecture)
* **Vulnerability Type:** Authentication Bypass / Insecure Fallback Logic
* **Affected Files:**
  - [`c:\Apex\src\services\googleAuthService.ts`](file:///c:/Apex/src/services/googleAuthService.ts#L118-L128)

#### Description
In `src/services/googleAuthService.ts`, if Google Identity Services fails to initialize or client credentials are missing, the helper generates a fictitious demo user and stores it directly into `localStorage`:
```typescript
// Fallback demo user sign in if offline / no client id
const fallbackUser: GoogleUserData = {
  id: 'google-user-' + Date.now(),
  email: 'spotter@apex.app',
  name: 'Real Spotter',
  picture: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=400&auto=format&fit=crop'
};
localStorage.setItem('apex_user_session', JSON.stringify(fallbackUser));
onSuccess(fallbackUser);
```

#### Impact
Users or attackers can enter the authenticated app shell without completing valid OAuth authentication, confusing client state and attempting unauthorized writes to the database.

#### Remediation Plan
Remove all synthetic fallback user generation. Fail closed with an explicit user-facing authentication error.

---

### [HIGH] APEX-SEC-05: Release Code Minification & R8 Obfuscation Disabled

* **MASVS Control:** MASVS-CODE (Code Quality & Build Hardening)
* **Vulnerability Type:** Missing Binary Obfuscation / Insecure Build Configuration
* **Affected Files:**
  - [`c:\Apex\android\app\build.gradle`](file:///c:/Apex/android/app/build.gradle#L19-L24)

#### Description
In `android/app/build.gradle`, release builds have minification explicitly turned off:
```groovy
buildTypes {
    release {
        minifyEnabled false
        proguardFiles getDefaultProguardFile('proguard-android.txt'), 'proguard-rules.pro'
    }
}
```

#### Impact
When `minifyEnabled` is false, ProGuard and R8 are skipped. Decompilation of the generated APK (`APEX.apk`) via `jadx-gui` reveals intact Java package hierarchies, method names, and plugin bridge logic, facilitating rapid vulnerability mapping by attackers.

#### Remediation Plan
Set `minifyEnabled true` and configure `proguard-rules.pro` to keep necessary Capacitor and WebView bridge interfaces while obfuscating all application code.

---

### [MEDIUM] APEX-SEC-06: Client-Side Image Authenticity & EXIF Validation Bypass

* **MASVS Control:** MASVS-AUTH / Anti-Cheat
* **Vulnerability Type:** Client-Side Security Control Reliance
* **Affected Files:**
  - [`c:\Apex\src\utils\authenticityPipeline.ts`](file:///c:/Apex/src/utils/authenticityPipeline.ts#L26-L76)

#### Description
`validateExifData()` checks if the photo was taken within 180 seconds and inspects software tags for editing software (e.g. Photoshop). However, this runs entirely within the client's browser runtime, and `runAiAuthenticityCheck()` is a hardcoded client stub returning `passed: true`.

#### Impact
An attacker running a modified client or calling PostgREST directly can upload internet photos, screenshots, or game captures with forged EXIF payloads without triggering validation failures.

#### Remediation Plan
Perform EXIF parsing and server-side authenticity evaluation on the backend ingestion pipeline.

---

### [MEDIUM] APEX-SEC-07: Missing Android Network Security Configuration

* **MASVS Control:** MASVS-NETWORK (Network Communication Security)
* **Vulnerability Type:** Incomplete Network Security Configuration
* **Affected Files:**
  - [`c:\Apex\android\app\src\main\AndroidManifest.xml`](file:///c:/Apex/android/app/src/main/AndroidManifest.xml#L4-L36)

#### Description
The `AndroidManifest.xml` does not specify an `android:networkSecurityConfig` attribute on the `<application>` tag. While modern Android defaults to TLS, explicit network security definitions prevent accidental cleartext fallback and allow certificate pin configurations.

#### Remediation Plan
Create `res/xml/network_security_config.xml` explicitly disallowing cleartext traffic and register it in `AndroidManifest.xml`.

---

### [MEDIUM] APEX-SEC-08: Insecure Storage of Authentication Tokens in Plaintext WebStorage

* **MASVS Control:** MASVS-STORAGE (Data Storage & Privacy)
* **Vulnerability Type:** Insecure Local Data Storage
* **Affected Files:**
  - [`c:\Apex\src\lib\supabase.ts`](file:///c:/Apex/src/lib/supabase.ts#L16-L27)

#### Description
Supabase JS client defaults to storing authentication tokens (`access_token` and `refresh_token`) in HTML5 `localStorage`. In Android WebView environments, `localStorage` is stored as plaintext SQLite/LevelDB files within the application's internal data directory.

#### Remediation Plan
Implement a secure storage adapter backed by Android Keystore and `EncryptedSharedPreferences` for token persistence on Android.

---

### [LOW] APEX-SEC-09: Missing Server-Side Database Schema Check Constraints

* **MASVS Control:** MASVS-PLATFORM (Platform Interaction & Data Integrity)
* **Vulnerability Type:** Data Integrity & Validation Gaps
* **Affected Files:**
  - [`c:\Apex\supabase\schema.sql`](file:///c:/Apex/supabase/schema.sql#L20-L40)

#### Description
The `garage` and `profiles` tables lack SQL `CHECK` constraints on numerical and enumeration columns (e.g., `rarity`, `xp`, `horsepower`, `level`). An attacker can insert negative XP or unknown rarity strings.

#### Remediation Plan
Add SQL check constraints:
```sql
ALTER TABLE garage ADD CONSTRAINT check_rarity CHECK (rarity IN ('common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic'));
ALTER TABLE profiles ADD CONSTRAINT check_positive_xp CHECK (xp >= 0);
ALTER TABLE profiles ADD CONSTRAINT check_level_range CHECK (level >= 1 AND level <= 100);
```

---

### [LOW] APEX-SEC-10: Unthrottled Reverse Geocoding via Public Nominatim Instance

* **MASVS Control:** MASVS-NETWORK / Third-Party Integration
* **Vulnerability Type:** API Rate-Limit & Policy Non-Compliance
* **Affected Files:**
  - [`c:\Apex\src\utils\geolocation.ts`](file:///c:/Apex/src/utils/geolocation.ts#L40-L54)

#### Description
`reverseGeocodeCity()` directly queries `https://nominatim.openstreetmap.org/reverse` without a custom User-Agent header or rate limiter, violating the OpenStreetMap Nominatim Usage Policy and risking IP blocking for all mobile users.

#### Remediation Plan
Route reverse geocoding through a backend geocoder or cache results locally with proper User-Agent attribution.

---

## 3. Prioritized Remediation Roadmap

```
PHASE 1 (Critical Game & API Security):
  ├── [APEX-SEC-01] Shift XP, Level, and Rarity calculations to atomic Server-Side PostgreSQL Functions
  ├── [APEX-SEC-02] Remove VITE_GEMINI_API_KEY from client bundle; route through /api/analyze
  └── [APEX-SEC-03] Enforce Supabase JWT authentication and rate limits on /api/analyze

PHASE 2 (Authentication & Binary Hardening):
  ├── [APEX-SEC-04] Remove mock demo user fallback in googleAuthService.ts
  ├── [APEX-SEC-05] Enable minifyEnabled true with ProGuard/R8 in build.gradle
  └── [APEX-SEC-07] Configure network_security_config.xml in AndroidManifest.xml

PHASE 3 (Defense-in-Depth & Data Integrity):
  ├── [APEX-SEC-06] Migrate EXIF and image authenticity checks to server ingestion pipeline
  ├── [APEX-SEC-08] Use Encrypted Storage for session tokens on Android
  ├── [APEX-SEC-09] Apply SQL CHECK constraints to profiles and garage tables
  └── [APEX-SEC-10] Add User-Agent and caching for reverse geocoding
```
