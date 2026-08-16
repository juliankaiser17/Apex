# APEX — Google Play Store Submission Audit (August 2026 Policy Baseline)

**Target Application:** APEX Mobile (`org.juliankaiser.apex`)  
**Target Release Date:** August 2026  
**Google Play Policy Standards:** Google Play Developer Program Policies, Android Target SDK Mandates, Data Safety Section Specifications  

---

## 1. Google Play Technical Compliance Summary

| Submission Requirement | Project Value / Configuration | Policy Requirement (Aug 2026) | Status | Verification & Rationale |
|---|---|---|---|---|
| **Target SDK Version** | `targetSdkVersion = 36` (Android 16) | Must target at least API 35 (Android 15) | **COMPLIANT** | Confirmed in [`android/variables.gradle`](file:///c:/Apex/android/variables.gradle). |
| **Compile SDK Version** | `compileSdkVersion = 36` | Must be $\ge$ targetSdk | **COMPLIANT** | Matches targetSdk. |
| **Minimum SDK Version** | `minSdkVersion = 24` (Android 7.0) | Recommended $\ge$ 24 | **COMPLIANT** | Covers 98%+ of global active Android devices. |
| **Binary Format** | Android App Bundle (`.aab`) | Mandatory for all new apps on Google Play | **COMPLIANT** | Generated via `cd android && ./gradlew bundleRelease`. |
| **Play App Signing** | Cloud HSM App Signing Key | Mandatory | **ENFORCED** | Separates Upload Key from Google-managed Root Key. |
| **Cleartext Traffic Policy** | `cleartextTrafficPermitted="false"` | Disallowed by policy | **COMPLIANT** | Enforced at OS level via `network_security_config.xml`. |
| **Data Extraction & Backup** | `data_extraction_rules.xml` (API 31+) | Required for Android 12+ | **COMPLIANT** | Configured in `AndroidManifest.xml`. |
| **Exported Components** | Only `MainActivity` exported | Explicit `android:exported` required | **COMPLIANT** | All non-launcher components set to `exported="false"`. |

---

## 2. Android Permissions Audit & Policy Justification

| Declared Permission | Protection Level | Actual Project Purpose | Play Policy Justification & Prominent Disclosure |
|---|---|---|---|
| `android.permission.INTERNET` | Normal | Supabase database sync, Vision AI analysis, map raster tiles. | Normal permission; automatically granted at install time. |
| `android.permission.CAMERA` | Dangerous (Runtime) | Live vehicle photography for AI scanner. | **Core Feature:** Requested in-context during Onboarding Step 4 or upon tapping the primary Camera shutter. Features `<uses-feature android:name="android.hardware.camera" android:required="false" />`. |
| `android.permission.ACCESS_FINE_LOCATION` | Dangerous (Runtime) | Capturing precise coordinates when a vehicle is spotted. | **Core Gameplay:** Used to pin car location on user's garage map and apply privacy blurring. |
| `android.permission.ACCESS_COARSE_LOCATION` | Dangerous (Runtime) | Determining city and country for regional vehicle rarity multipliers. | **Core Gameplay:** Used by `calculateRegionalRarity()` to assign regional rarity multipliers. |

> [!NOTE]
> **Zero Background Location:** APEX intentionally does **NOT** declare or request `ACCESS_BACKGROUND_LOCATION`. Location is queried exclusively while the app is in the foreground. This eliminates Google Play's rigorous Background Location Declaration and video review process.

---

## 3. Google Play Data Safety Disclosure Matrix

To be filled out in Google Play Console -> App Content -> Data Safety:

### 3.1 Data Collection & Usage

| Data Category | Data Type | Collected? | Shared? | Processing Purpose | Linked to User? |
|---|---|---|---|---|---|
| **Location** | Approximate Location | **Yes** | No | App Functionality, Regional Rarity Multipliers | **Yes** (Linked to User Profile) |
| **Location** | Precise Location | **Yes** | No | App Functionality, Spot Map Pinning (with user privacy radius controls) | **Yes** |
| **Personal Info** | Email Address | **Yes** | No | Account Authentication (Email OTP / Google OAuth) | **Yes** |
| **Personal Info** | Name / Username / User ID | **Yes** | No | Account Profile, Social Garage Display | **Yes** |
| **Photos & Videos** | Photos | **Yes** | No | Vehicle Scan Identification & Garage Card Minting | **Yes** |
| **Device or Other IDs** | Device Token / Push Token | **Yes** | No | Push Notifications (Nearby Hunt Alerts) | **Yes** |

### 3.2 Security Practices
* **Data Encrypted in Transit:** **Yes** (All data transferred over TLS 1.3 / HTTPS).
* **Data Deletion Mechanism:** **Yes** (Users can request account and data deletion via in-app settings or web deletion URL).
* **Target Audience:** General Audience (Age 13+). Not targeted primarily at children under 13 (COPPA compliant).

---

## 4. Play Console Action Items Requiring Developer Confirmation

The following configuration steps must be verified directly inside the Google Play Console UI before production launch:

1. **Privacy Policy URL:**
   * Enter a publicly accessible Privacy Policy URL in Play Console (e.g. `https://apex-spotter.vercel.app/privacy`).
2. **Account Deletion Web URL:**
   * Provide a web-based account deletion URL (required by Google Play policy for apps with account creation).
3. **Content Rating Questionnaire:**
   * Complete the IARC rating questionnaire (expected rating: PEGI 3 / ESRB Everyone).
4. **Target Audience & Content:**
   * Declare target age group: **13 and older**.
5. **Data Safety Form:**
   * Input the exact answers documented in Section 3 above.
6. **Play App Signing Enrollment:**
   * Ensure Play App Signing is active when creating the app release track.
