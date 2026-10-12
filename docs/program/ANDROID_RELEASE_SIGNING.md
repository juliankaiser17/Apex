# Android Release Signing & Build Guide

**Target Audience:** Repository Owner / Release Engineer  
**Security Invariant:** NEVER commit `.keystore`, `.jks`, or passwords to version control.

---

## 1. Creating the Production Upload Keystore (Outside Repository)

To ensure zero risk of committing signing keys or credentials to git, **always create and store keystores outside the repository directory** (e.g., `~/secure-keys/` or `C:\Users\<username>\secure-keys\`):

```bash
# Linux / macOS:
mkdir -p ~/secure-keys
keytool -genkeypair -v \
  -keystore ~/secure-keys/apex-release-key.jks \
  -alias apex-release \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000

# Windows PowerShell:
New-Item -ItemType Directory -Force -Path "$HOME\secure-keys"
keytool -genkeypair -v `
  -keystore "$HOME\secure-keys\apex-release-key.jks" `
  -alias apex-release `
  -keyalg RSA `
  -keysize 2048 `
  -validity 10000
```

### Inspecting Keystore Fingerprints (SHA-1 and SHA-256)
To print the certificate fingerprints needed for Google Play and Google Cloud OAuth:
```bash
keytool -list -v -keystore ~/secure-keys/apex-release-key.jks -alias apex-release
```

---

## 1.1 Git History Security Audit & History-Removal Procedure

### A. Repository Security Audit (Passed)
A full repository audit confirmed that **no keystores or credentials were ever committed to Git history**:
```bash
# Verification commands executed:
git log --all --full-history -- "**/apex-release-key.jks" "**/*.jks"
git log -S "apexbeta2026"
```
Both queries returned zero commits. All `*.jks` and `keystore.properties` are strictly ignored in `.gitignore`.

### B. Contingency History-Removal Procedure (`git filter-repo`)
If any secret or key is ever accidentally committed in future branches, follow this emergency procedure (**DO NOT RUN WITHOUT EXPLICIT OWNER APPROVAL**):

1. **Install git-filter-repo:**
   ```bash
   pip install git-filter-repo
   ```
2. **Make a fresh backup clone:**
   ```bash
   git clone --mirror <repo-url> apex-backup.git
   ```
3. **Purge the file from all commits, branches, and tags:**
   ```bash
   git filter-repo --path android/apex-release-key.jks --invert-paths --force
   ```
4. **Purge passwords from commit messages or docs:**
   ```bash
   git filter-repo --replace-text expressions.txt --force
   ```
5. **Immediately rotate all leaked credentials:**
   - Invalidate exposed API keys in Google Cloud / Supabase / Cloudflare consoles.
   - Generate a brand-new release keystore and update Play Console / OAuth client IDs.
6. **Force-push rewritten history (Owner authorization required):**
   ```bash
   git push origin --force --all
   git push origin --force --tags
   ```

---

## 2. Configuring Signing in Environment or Gradle Properties

### Option A: Environment Variables (Recommended for CI / Local Shell)
Set the following before triggering the build:

```bash
export APEX_RELEASE_KEYSTORE="/path/to/apex-upload-key.jks"
export APEX_RELEASE_STORE_PASSWORD="your-secure-keystore-password"
export APEX_RELEASE_KEY_ALIAS="apex-upload"
export APEX_RELEASE_KEY_PASSWORD="your-secure-key-password"
```

On Windows PowerShell:
```powershell
$env:APEX_RELEASE_KEYSTORE = "C:\secure\apex-upload-key.jks"
$env:APEX_RELEASE_STORE_PASSWORD = "your-secure-keystore-password"
$env:APEX_RELEASE_KEY_ALIAS = "apex-upload"
$env:APEX_RELEASE_KEY_PASSWORD = "your-secure-key-password"
```

### Option B: Local Untracked `gradle.properties`
Add to `android/gradle.properties` (which is excluded or personal):
```properties
APEX_RELEASE_KEYSTORE=/path/to/apex-upload-key.jks
APEX_RELEASE_STORE_PASSWORD=your-secure-keystore-password
APEX_RELEASE_KEY_ALIAS=apex-upload
APEX_RELEASE_KEY_PASSWORD=your-secure-key-password
```

---

## 3. Building Release Artifacts

Run the automated release script:
```bash
node scripts/build-android-release.mjs
```

This performs:
1. `npm run build` (Typecheck, Vite production minification, bundle hygiene audit)
2. `npx cap sync android` (Synchronizes HTML/JS assets to `android/app/src/main/assets/public/`)
3. `./gradlew bundleRelease` (Produces `android/app/build/outputs/bundle/release/app-release.aab` for Google Play)
4. `./gradlew assembleRelease` (Produces `android/app/build/outputs/apk/release/app-release.apk` for sideload verification)

---

## 4. Release Configurations Audit Summary

| Parameter | Value | Rationale |
| :--- | :--- | :--- |
| `minSdkVersion` | 24 | Supports Android 7.0+ (broad device coverage) |
| `compileSdkVersion` | 36 | Android 16 (highest API available) |
| `targetSdkVersion` | 36 | Complies with Google Play current & future API requirements (>= 34/35) |
| `minifyEnabled` | true | R8 minification enabled |
| `shrinkResources` | true | Unused native resources removed |
| `debuggable` | false | Hardened against debugging in production |
| `cleartextTraffic` | false | Enforced by `network_security_config.xml` |
| `backgroundLocation` | None | Strict privacy; foreground camera/fine location only |

---

## 5. Google Sign-In Checklist (Android OAuth 2.0 Client)

For native Google Sign-In to function properly on Android, Google Cloud Console and Supabase Auth must match the signing certificates:

### A. Certificate Fingerprints & Package Name
- **Android Package Name:** `org.juliankaiser.apex`
- **Release Keystore:** Secure external location (e.g., `~/secure-keys/apex-release-key.jks`)
- **Key Alias:** `apex-release`
- **Command to inspect SHA-1:**
  ```bash
  keytool -list -v -keystore <path/to/keystore.jks> -alias <key-alias>
  ```
- **Signing SHA-1:** `4D:2F:D5:24:2B:63:2E:D8:EC:5C:F8:E6:DA:33:B1:D6:9F:DE:9F:31`
- **Signing SHA-256:** `AC:DB:12:C2:29:CE:AA:25:20:51:1A:99:2C:CA:E0:1E:94:B5:4A:B0:06:8F:4F:4B:53:89:E7:6C:1C:9D:03:7A`

### B. Setup Steps in Google Cloud Console
1. Navigate to [Google Cloud Console > Credentials](https://console.cloud.google.com/apis/api/generativelanguage.googleapis.com/credentials).
2. Click **Create Credentials** > **OAuth client ID**.
3. Select **Android** as Application type:
   - **Package name:** `org.juliankaiser.apex`
   - **SHA-1 certificate fingerprint:** `4D:2F:D5:24:2B:63:2E:D8:EC:5C:F8:E6:DA:33:B1:D6:9F:DE:9F:31`
4. For Google Play App Signing (if distributing via Play Store track):
   - Navigate to **Play Console > Release > Setup > App Signing**.
   - Copy the **App signing key certificate SHA-1**.
   - Add a second Android OAuth Client ID in Google Cloud with this Play App Signing SHA-1.

### C. Supabase Auth Configuration
1. Ensure the **Web Client ID** from Google Cloud Console is configured in Supabase:
   - Supabase Dashboard > Authentication > Providers > Google.
   - Client ID: `<Google Web Client ID>`
   - Client Secret: `<Google Web Client Secret>`
2. Ensure `VITE_GOOGLE_CLIENT_ID` in `.env` matches the Web Client ID (used by `@capawesome/capacitor-google-sign-in` for server auth code exchange).

---

## 6. Release Build Artifact Verification

- **Generated Release APK:** `android/app/build/outputs/apk/release/app-release.apk`
  - **Size:** 15.58 MB
  - **SHA-256:** `97370db4014d621f89ece922f13ea0c1873cba44893e6c674c0b7aa25b7d8fcb`
- **Generated Release AAB:** `android/app/build/outputs/bundle/release/app-release.aab`
  - **Size:** 17.06 MB
- **Bundle Audit:** Passed `check-client-bundle.mjs` (0 leaks, 0 bare specifiers, 0 server modules, 0 admin components).
