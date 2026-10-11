# Android Release Signing & Build Guide

**Target Audience:** Repository Owner / Release Engineer  
**Security Invariant:** NEVER commit `.keystore`, `.jks`, or passwords to version control.

---

## 1. Creating the Production Upload Keystore

Run the following command once in a secure, backed-up directory (outside the git repository):

```bash
keytool -genkeypair -v \
  -keystore apex-upload-key.jks \
  -alias apex-upload \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000
```

Store `apex-upload-key.jks` in a secure password manager or offline cold storage.

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
