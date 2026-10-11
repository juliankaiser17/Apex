# Proposal: Crash Reporting Vendor Evaluation & Data Safety Impact (Gate G9)

**Author:** Track R (Stability & Release Engineering)  
**Date:** October 2026  
**Status:** PROPOSED (Awaiting Owner Review - Gate G9)  
**Lane:** Lane 2 / Compliance  
**Target:** Error reporting integration for `src/services/crashReporter.ts`

---

## 1. Overview & Objective
To ensure rapid identification of field crashes across Android devices and WebViews, Apex requires a managed crash reporting telemetry backend. Currently, `src/services/crashReporter.ts` provides a vendor-neutral, privacy-preserving ring buffer stored in local client storage. This proposal evaluates **Sentry** vs **Firebase Crashlytics** for production ingestion under Gate G9.

---

## 2. Comparative Matrix

| Feature / Criteria | Sentry (`@sentry/react` + `@sentry/capacitor`) | Firebase Crashlytics (`@capacitor-firebase/crashlytics`) |
| :--- | :--- | :--- |
| **Platform Scope** | Unified SDK covering Web, Capacitor Android, and iOS | Native Android/iOS primary; Web support via Firebase JS |
| **Vite & Source Maps** | First-class Vite plugin for automatic source map upload & redaction | Requires native Gradle plugin & Google Services JSON |
| **Breadcrumb Tracing** | Network breadcrumbs, UI clicks, React lifecycle component stacks | Custom key-value pairs and logs |
| **Privacy Redaction** | Built-in `beforeSend` data scrubbing and PII masking | Manual log filtering required |
| **Pricing / Quota** | Free tier (5,000 errors/month); Developer plan ($26/mo) | Free tier included with Google Firebase / GCP project |
| **Setup Overhead** | Add DSN environment variable; 1 file adapter in `src/services/` | Requires `google-services.json` and Firebase project setup |

---

## 3. Data Safety & Privacy Audit: Exact Data Collected

Regardless of vendor, `src/services/crashReporter.ts` enforces strict client-side sanitization:

### Data Transmitted:
1. **Crash Metadata**: Exception name, message, stack trace, and component stack.
2. **Device State**: Android OS version, WebView version, device manufacturer/model, available memory tier (e.g. `low-ram`).
3. **Application State**: App version (`1.0.1`), build code, active route/module name (e.g. `Radar Map`, `Garage Vault`).
4. **Sanitized Breadcrumbs**: Last 25 UI navigation events and system lifecycle state transitions.

### Data Strictly Redacted & NEVER Collected:
- ❌ Auth tokens (`sb-*` access tokens, refresh tokens, Google OAuth codes)
- ❌ Exact GPS coordinates (latitude / longitude are never logged to breadcrumbs)
- ❌ Raw camera images, photo blobs, or uncompressed visual payloads
- ❌ Passwords, emails, or personal real names
- ❌ Android Advertising ID (AAID)

### Google Play Data Safety Sheet Declaration:
- **Data Type**: Diagnostics -> Crash logs, Diagnostics -> Diagnostics and other app performance data.
- **Purpose**: App functionality, Analytics.
- **Collection**: Collected and linked to User ID (pseudonymous UUID only, never email).
- **Encryption in transit**: Yes (TLS 1.3).
- **User deletion request**: Deletable upon user account deletion request.

---

## 4. Recommendation for Owner (Gate G9)

**Recommendation: Sentry**
- **Reasoning**: Apex is built as a hybrid React 19 + Capacitor application. Sentry provides seamless JavaScript stack trace symbolication directly from Vite minified chunks, catching WebView runtime exceptions that native Crashlytics frequently reports as opaque `WebViewCore` crashes.
- **Alternative**: If the owner already maintains a Google Firebase project for Push Notifications (`google-services.json`), Firebase Crashlytics has zero subscription cost.

---

## 5. Next Steps
- Awaiting Owner decision on Gate G9 in `docs/program/OWNER_DECISIONS.md`.
- Until approved, `crashReporter` remains in zero-leakage local storage mode.
