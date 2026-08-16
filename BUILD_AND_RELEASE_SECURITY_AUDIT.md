# APEX — Build & Release Security Audit & Checklist

**Target:** Android Build System, Gradle Configurations, Release Packaging & Google Play App Signing  
**Standards:** OWASP MASVS-RESILIENCE, OWASP MASVS-CODE, Google Play App Signing Guidelines  

---

## 1. Release Security Checklist

| Security Control | Implementation / Setting | Status | Verification & Rationale |
|---|---|---|---|
| **Non-Debuggable Binary** | `debuggable false`, `jniDebuggable false` | **ENFORCED** | Prevents runtime attaching via `adb jdwp`, memory dumping, and dynamic debugging. |
| **Code Minification (R8)** | `minifyEnabled true` | **ENFORCED** | Renames and optimizes internal classes, stripping dead code and making reverse engineering harder. |
| **Resource Shrinking** | `shrinkResources true` | **ENFORCED** | AAPT2 and R8 remove unused assets and debug drawables from release AAB/APK. |
| **Log Stripping in Release** | `-assumenosideeffects class android.util.Log` | **ENFORCED** | Strips verbose/debug Android logs so sensitive internal execution flow is not emitted. |
| **Google Play App Signing** | Cloud HSM App Signing Key + Separate Upload Key | **ENFORCED** | Separates upload credentials from permanent app signing authority. Keys never stored in git. |
| **Zero Secrets in Client** | Serverless `/api/analyze` proxy with server env vars | **ENFORCED** | Stripped `@google/genai` and API keys from bundle; verified with recursive string scans. |
| **Platform TLS & Cleartext Block** | `cleartextTrafficPermitted="false"` | **ENFORCED** | Blocked unencrypted HTTP traffic at OS level. |
| **Scoped File Sharing** | Scoped `cache-path` & `files-path` in `file_paths.xml` | **ENFORCED** | Eliminated broad `external-path` shared storage grants. |
| **Exported Components Least-Privilege** | Only `MainActivity` exported for launcher | **ENFORCED** | Zero unprotected exported services or content providers. |
| **Granular Backup Rules** | `data_extraction_rules.xml` & `backup_rules.xml` | **ENFORCED** | Preserves user preferences while excluding tokens, LevelDB, and databases from cloud backup. |

---

## 2. Play App Signing vs. Upload Key Separation Architecture

```
[Developer / CI Environment]
  1. GitHub Actions / Local Build compiles Android App Bundle (AAB)
  2. Signs AAB using Upload Keystore (stored securely in CI Secrets / HSM)
  3. Uploads AAB to Google Play Console via Play Developer API

[Google Play Cloud Infrastructure]
  4. Google Play verifies Upload Key signature
  5. Strips Upload Key signature and optimizes AAB into device-specific APK splits
  6. Re-signs APKs with permanent Google-managed App Signing Key stored in Google Cloud HSM
  7. Distributes signed APKs to end-user devices via Google Play Store
```

### Benefits:
- **Key Loss Recovery:** If the upload key is lost or compromised, Google Play support can register a new upload key without requiring an entirely new app package name.
- **Hardware Security:** The master signing key is protected inside Google's enterprise Cloud HSMs and is never exposed to developer workstations or CI runners.

---

## 3. ProGuard & R8 Optimization Profile

```proguard
# Capacitor Bridge & Plugins Protection
-keep class com.getcapacitor.** { *; }
-keep interface com.getcapacitor.** { *; }
-keep public class * extends com.getcapacitor.Plugin { *; }
-keepclassmembers class * extends com.getcapacitor.Plugin {
    @com.getcapacitor.PluginMethod public *;
}

# Preserve JavascriptInterfaces
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# Google Play Services & Identity
-keep class com.google.android.gms.** { *; }
-dontwarn com.google.android.gms.**

# Strip debug log invocations in release builds
-assumenosideeffects class android.util.Log {
    public static boolean isLoggable(java.lang.String, int);
    public static int v(...);
    public static int d(...);
    public static int i(...);
}
```

---

## 4. Automated Regression Verification

The build and release security invariants were verified in [`scripts/test_authorization.mjs`](file:///c:/Apex/scripts/test_authorization.mjs):
```
  ✅ [PASS] Attack 32: Release Security: Release build type disables debuggable flags
  ✅ [PASS] Attack 33: Release Security: R8 minification and resource shrinking enabled
  ✅ [PASS] Attack 34: Release Security: ProGuard rules strip verbose/debug logs from release binary
  ✅ [PASS] Attack 35: Release Security: Play App Signing upload key segregation policy
```
