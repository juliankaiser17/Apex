# APEX — Automated Security Static Analysis Report

**Target Application:** APEX Mobile (`org.juliankaiser.apex`)  
**Methodology:** Automated AST, Regex Pattern Matching, Manifest Audit, Cryptographic Evaluation & Android Lint  
**Machine-Readable Artifact:** [`security_report.json`](file:///c:/Apex/security_report.json)  
**Security Baseline:** OWASP MASVS (v2.0), OWASP MASTG, Android Security Checklist  

---

## 1. Executive Summary

| Metric | Result | Evaluation |
|---|---|---|
| **Total Security Rules Evaluated** | 35 | Comprehensive coverage across 14 security domains |
| **Active High / Critical Vulnerabilities** | **0** | All previously identified issues remediated |
| **Active Medium / Low Vulnerabilities** | **0** | Clean security profile |
| **Documented False Positives / Suppressions** | 2 | Detailed justifications documented below |
| **Overall Security Posture** | **HARDENED / SECURE** | Compliant with Google Play & OWASP MASVS standards |

---

## 2. Static Analysis Domain Evaluation Matrix

| Security Domain | Evaluated Checks | Findings / Status |
|---|---|---|
| **1. Hardcoded Secrets & Keys** | Scanned for raw API keys (`AIzaSy...`, `sk-...`, `ghp_...`, private RSA keys, database URIs). | **PASSED:** Zero private keys or backend secrets in client codebase. Client `@google/genai` removed. |
| **2. Cryptography & Hashes** | Checked for broken ciphers (DES, ECB) and weak hashes (MD5, SHA-1). | **PASSED:** Cryptographic digests use standard SHA-256 (`crypto.subtle` / `crypto.createHash('sha256')`). |
| **3. Random Number Generation** | Inspected all `Math.random()` vs `crypto.getRandomValues()` usages. | **PASSED (Suppressed cosmetic):** `Math.random()` used exclusively for visual confetti particle physics; auth nonces use Web Crypto. |
| **4. Network Security & TLS** | Verified `network_security_config.xml`, cleartext disallowance, and absence of `http://` API calls. | **PASSED:** `cleartextTrafficPermitted="false"` enforced at OS level; zero unencrypted API calls. |
| **5. WebView Security** | Audited WebView configurations, JavaScript interfaces, and local asset packaging. | **PASSED:** WebView renders local packaged assets; file URL cross-origin access disabled. |
| **6. Android Components & IPC** | Checked `AndroidManifest.xml` for exported Activities, Services, Receivers, and ContentProviders. | **PASSED:** Only launcher `MainActivity` exported; zero unprotected background services. |
| **7. Unsafe Intents & Deep Links** | Inspected Intent filters and URL handling. | **PASSED:** Single-task launch mode prevents task hijacking. |
| **8. File Sharing & FileProvider** | Evaluated `file_paths.xml` for shared storage roots. | **PASSED:** Scoped strictly to private `cache-path` and `files-path`. |
| **9. Sensitive Logging** | Inspected `console.log` and `android.util.Log` calls. | **PASSED:** Zero passwords, tokens, or private GPS coordinates logged; ProGuard strips release logs. |
| **10. Local Data Storage & Backup** | Audited `localStorage`, databases, `data_extraction_rules.xml`, and `backup_rules.xml`. | **PASSED:** Sensitive JWTs and databases excluded from Android cloud backups. |
| **11. Authentication Architecture** | Audited Google OAuth OIDC, Email OTP, and PKCE token flows. | **PASSED:** 100% passwordless, failing closed on errors. |
| **12. Authorization & Anti-Cheat** | Tested 35 adversarial economy, RLS, and race-condition vectors. | **PASSED:** 35/35 automated adversarial regression tests passed. |
| **13. Android Permissions** | Checked for excessive or dangerous permissions. | **PASSED:** Minimal required permissions (`CAMERA`, `ACCESS_FINE_LOCATION`, `INTERNET`); no broad storage permissions. |
| **14. Release Build Configuration** | Verified `debuggable false`, `shrinkResources true`, `minifyEnabled true`. | **PASSED:** R8 minification and resource shrinking active. |

---

## 3. Documented Suppressions & False-Positive Justifications

### Suppression 1: Cosmetic Randomness in UI Animations (`SUP-CRY-01`)
* **Location:** [`src/components/scanner/ScannerModal.tsx`](file:///c:/Apex/src/components/scanner/ScannerModal.tsx) (Line 135)
* **Finding:** Linter flagged `Math.random()` usage in client code.
* **Justification:** `Math.random()` is used strictly for rendering visual confetti dispersion angles and generating decorative card labels (`#APX-XXXX`) before server-authoritative minting. All cryptographic request hashes, session IDs, and nonces use `crypto.subtle.digest('SHA-256')` and `crypto.getRandomValues()`.
* **Verdict:** **Accepted False Positive.**

### Suppression 2: Public Google OAuth Client ID (`SUP-AUT-01`)
* **Location:** [`src/components/onboarding/OnboardingModal.tsx`](file:///c:/Apex/src/components/onboarding/OnboardingModal.tsx) (Line 133)
* **Finding:** Static scanner flagged `VITE_GOOGLE_CLIENT_ID` string in client bundle.
* **Justification:** By Google Identity Services and OAuth 2.0 PKCE design specifications, the Client ID is a **public identifier** required to initialize the client-side consent prompt. No client secret is stored or used in the mobile client.
* **Verdict:** **Accepted False Positive.**
