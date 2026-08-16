# APEX — Android Attack Surface & IPC Security Audit

**Target:** Android Components, Manifest Configuration, Permissions, IPC & WebViews  
**Package:** `org.juliankaiser.apex`  
**Standards Alignment:** OWASP MASVS-PLATFORM (Platform Interaction & IPC), Android 14 Least-Privilege Security Guidance  

---

## 1. Android Component Security Audit Matrix

| COMPONENT | TYPE | EXPORTED? | REASON / JUSTIFICATION | INPUT AUTH & VALIDATION | SENSITIVE ACTIONS TRIGGERED? | DATA LEAKAGE RISK? | UNSAFE STATE RISK? |
|---|---|---|---|---|---|---|---|
| `org.juliankaiser.apex.MainActivity` | Activity (`BridgeActivity`) | **Yes (`android:exported="true"`)** | **Required:** Primary Launcher Activity (`MAIN` / `LAUNCHER`). | Handled by Capacitor Bridge; no unauthenticated deep parameter execution. | No; initializes UI WebView and local JavaScript bundle. | No; returns zero data to calling applications. | No; `launchMode="singleTask"` prevents task hijack / overlay replay. |
| `androidx.core.content.FileProvider` | ContentProvider | **No (`android:exported="false"`)** | **Required:** Grants transient per-URI photo permissions to camera app. | Secured via `android:grantUriPermissions="true"` and scoped XML paths. | No; cannot read arbitrary app storage. | No; private to camera staging pipeline. | No; `exported="false"` prevents direct third-party access. |
| **Services** | Service | **None** | No background services declared. | N/A | N/A | N/A | N/A |
| **BroadcastReceivers** | BroadcastReceiver | **None** | No custom broadcast receivers declared. | N/A | N/A | N/A | N/A |
| **PendingIntents** | IPC Wrapper | **None** | No custom PendingIntents exported to external apps. | N/A | N/A | N/A | N/A |

---

## 2. Component Hardening & Least-Privilege Measures

### 2.1 FileProvider Path Scoping & Hardening
* **Pre-Audit Configuration (`file_paths.xml`):**
  ```xml
  <paths xmlns:android="http://schemas.android.com/apk/res/android">
      <external-path name="my_images" path="." />
      <cache-path name="my_cache_images" path="." />
  </paths>
  ```
  *Risk:* `<external-path path="." />` grants access to the root of external storage if a URI permission is granted.
* **Hardened Configuration ([`android/app/src/main/res/xml/file_paths.xml`](file:///c:/Apex/android/app/src/main/res/xml/file_paths.xml)):**
  ```xml
  <paths xmlns:android="http://schemas.android.com/apk/res/android">
      <cache-path name="camera_cache" path="." />
      <files-path name="camera_images" path="." />
  </paths>
  ```
  *Hardening Impact:* Scopes FileProvider strictly to the application's private cache and files directory. Zero external storage roots exposed.

### 2.2 Permissions Audit (Least Privilege Analysis)
* **Granted Permissions:**
  1. `android.permission.INTERNET` (Normal permission) — Supabase, AI vision, and map rendering.
  2. `android.permission.ACCESS_COARSE_LOCATION` (Runtime permission) — City-level localization.
  3. `android.permission.ACCESS_FINE_LOCATION` (Runtime permission) — Precise spot coordinate capture.
  4. `android.permission.CAMERA` (Runtime permission) — Real vehicle photography.
* **Prohibited / Avoided Permissions:**
  * No `READ_EXTERNAL_STORAGE` or `WRITE_EXTERNAL_STORAGE` (legacy shared storage access avoided).
  * No `READ_MEDIA_IMAGES` or `READ_MEDIA_VIDEO`.
  * No `ACCESS_BACKGROUND_LOCATION` (location only queried while app is active).
  * No `SYSTEM_ALERT_WINDOW` or overlay permissions.

### 2.3 WebView & JavaScript Bridge Security
* **Asset Packaging:** WebView exclusively renders local bundled assets (`dist/`) packaged inside the APK.
* **Cross-Origin & File Isolation:** `setAllowFileAccessFromFileURLs(false)` and `setAllowUniversalAccessFromFileURLs(false)` are enforced by modern Android WebView defaults.
* **Plugin Bridge Scope:** `@JavascriptInterface` bridge is restricted strictly to registered Capacitor plugins (`Camera`, `Geolocation`, `PushNotifications`, `GoogleSignIn`).

---

## 3. Automated Regression Test Verification

Android platform security assertions were added to [`scripts/test_authorization.mjs`](file:///c:/Apex/scripts/test_authorization.mjs):
```
  ✅ [PASS] Attack 25: Android Surface: Only launcher activity is exported; zero unprotected services
  ✅ [PASS] Attack 26: Android Surface: FileProvider is not exported and restricted to private directories
  ✅ [PASS] Attack 27: Android Surface: Least privilege permissions enforced (No broad storage perms)
```
