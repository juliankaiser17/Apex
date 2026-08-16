# APEX — Complete Network Security & TLS Architecture Audit

**Target:** Android Network Stack, WebViews, Endpoints, APIs, and External Integrations  
**Standards Alignment:** OWASP MASVS-NETWORK (Network Communication Security), Android Network Security Configuration Standard  

---

## 1. Network Endpoint & Communication Inventory

| Endpoint / Target | Protocol / TLS | Authentication | Purpose | Cleartext Allowed? | Certificate Validation |
|---|---|---|---|---|---|
| `https://nxrtnexhyieiszgglhbn.supabase.co` | TLS 1.3 / HTTPS | Bearer JWT / Anon Key | PostgREST Database & Auth Gateway | **No (Strict TLS)** | System CA Root |
| `https://api.openai.com/v1/chat/completions` | TLS 1.3 / HTTPS | Server-Side Secret Key | Server-Side Vision AI Analysis (`api/analyze.ts`) | **No (Strict TLS)** | System CA Root |
| `https://generativelanguage.googleapis.com` | TLS 1.3 / HTTPS | Server-Side Secret Key | Server-Side Gemini 2.5 Flash Fallback | **No (Strict TLS)** | System CA Root |
| `https://accounts.google.com/gsi/client` | TLS 1.3 / HTTPS | Client ID / OIDC | Google Identity Services Client Library | **No (Strict TLS)** | System CA Root |
| `https://nominatim.openstreetmap.org/reverse` | TLS 1.3 / HTTPS | None (Public API) | Reverse Geocoding Coordinates to City | **No (Strict TLS)** | System CA Root |
| `https://{s}.basemaps.cartocdn.com/dark_all/*` | TLS 1.3 / HTTPS | None (Public CDN) | Dark Raster Map Tiles | **No (Strict TLS)** | System CA Root |

---

## 2. Key Security Audit Findings & Verifications

### 2.1 Complete Disallowance of Cleartext HTTP
* **Audit Result:** Audited all source code, SVG namespaces, and configs. Zero unencrypted `http://` network requests exist in the codebase.
* **Android Enforcement:** [`android/app/src/main/res/xml/network_security_config.xml`](file:///c:/Apex/android/app/src/main/res/xml/network_security_config.xml) explicitly declares:
  ```xml
  <network-security-config>
      <base-config cleartextTrafficPermitted="false">
          <trust-anchors>
              <certificates src="system" />
          </trust-anchors>
      </base-config>
  </network-security-config>
  ```
  This disables cleartext HTTP at the Android OS platform level across all network sockets, OkHttp, and WebView instances.

### 2.2 Certificate Validation & Hostname Verification
* Standard Android platform-level certificate validation is enforced.
* Release builds trust only verified system Root Certificate Authorities. User-installed CA certificates (e.g. from network sniffing proxies) are not trusted by default in release builds.

### 2.3 Certificate Pinning Threat-Model Analysis & Recommendation
* **Requirement Evaluation:**
  - Supabase (`*.supabase.co`) and OpenStreetMap use multi-tenant cloud infrastructure with dynamic Let's Encrypt / Cloudflare certificates where public keys rotate every 90 days.
  - Hardcoding static certificate pins for third-party hostnames without an in-house reverse proxy domain (`api.apex.app`) and multiple backup pin sets carries an extreme risk of bricking mobile client connectivity upon certificate rotation.
  - **Verdict:** Strict system CA trust anchoring + `cleartextTrafficPermitted="false"` + Play Integrity device attestation is the recommended and resilient strategy for APEX at this stage.

### 2.4 Token Leakage & Error Sanitization
* **URL Hash Scrubbing:** Access and refresh tokens returned from OAuth callbacks are sanitized from `window.location` immediately via `window.history.replaceState()`.
* **API Error Sanitization:** Production 500 responses in [`api/analyze.ts`](file:///c:/Apex/api/analyze.ts) are sanitized to return generic status messages without leaking internal database strings or stack traces.

---

## 3. Automated Regression Test Verification

Network security assertions were integrated into [`scripts/test_authorization.mjs`](file:///c:/Apex/scripts/test_authorization.mjs):
```
  ✅ [PASS] Attack 21: Network Security: Android XML disallows cleartext HTTP
  ✅ [PASS] Attack 22: Network Security: System CA trust anchors enforced in release builds
  ✅ [PASS] Attack 23: Network Security: Production API 500 errors sanitized against internal leakage
  ✅ [PASS] Attack 24: Network Security: OAuth URL hash scrubbed immediately upon token extraction
```
