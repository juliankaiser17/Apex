# APEX — Authentication Security Audit & Hardening Architecture

**Target:** APEX Android Mobile & Web Authentication Systems  
**Standards Alignment:** OWASP MASVS-AUTH, NIST SP 800-63B (Digital Identity Guidelines), Android Credential Management & Google Identity Guidance  

---

## 1. Authentication Architecture Overview

APEX utilizes a modern, **100% passwordless authentication model** combining:
1. **Native Android Federated Identity:** `@capawesome/capacitor-google-sign-in` leveraging Google Play Services on Android to obtain cryptographically signed OIDC ID tokens.
2. **Web Federated Identity:** Google Identity Services (GIS) One-Tap / Popup with zero unneeded redirects.
3. **Passwordless Email OTP:** Supabase Auth cryptographically verified 6-digit one-time passcodes.
4. **Token Management:** OAuth 2.0 PKCE (Proof Key for Code Exchange) flow with short-lived JWT access tokens and rotating refresh tokens.

---

## 2. Client vs. Backend Authentication Audit Matrix

| Security Requirement | Client Implementation Status | Backend Implementation Status | Architectural Evaluation |
|---|---|---|---|
| **No Plaintext Passwords** | **Passed:** Passwordless UI (Email OTP + Google OAuth). | **Passed:** No password hashes or credentials stored in database. | Zero credential theft surface. |
| **Credential Hardcoding** | **Remediated:** Centralized Client ID into environment variables. | **Passed:** All backend service keys stored in server environment. | No secret keys in code. |
| **Federated Authentication** | **Passed:** Native Google Sign-In + GIS OIDC tokens passed to Supabase. | **Passed:** Supabase Auth cryptographically verifies Google RSA signatures. | High-security identity delegation. |
| **Token Lifetime & Scope** | **Passed:** Client receives Supabase JWTs with standard 1-hour expiration. | **Passed:** Supabase issues scoped JWTs (`authenticated` role, `sub=uuid`). | Compliant with NIST SP 800-63B. |
| **Secure Token Refresh** | **Passed:** `autoRefreshToken: true` via Supabase JS SDK. | **Passed:** Refresh tokens rotated on every refresh event with reuse detection. | Mitigates replay of stolen refresh tokens. |
| **Logout & Token Revocation** | **Remediated:** Global revocation (`scope: 'global'`) revokes active refresh tokens. | **Passed:** Server invalidates user session across all active devices. | Prevents session hijacking post-logout. |
| **Session Fixation Prevention** | **Passed:** Client state store resets completely on login/logout. | **Passed:** New session ID & JWT issued upon authentication state change. | Prevents session carryover. |
| **URL Token Scrubbing** | **Remediated:** URL hash (`#access_token=...`) scrubbed from browser history immediately. | **Passed:** PKCE flow eliminates token exposure in URL query parameters. | Prevents token leakage via referrers/history. |
| **Account Enumeration** | **Passed:** Standardized error messages during OTP dispatch and verification. | **Passed:** Supabase Auth config prevents revealing user existence on OTP. | Protects user privacy. |
| **Independent Authorization** | **Passed:** Client does not dictate permissions or roles. | **Passed:** PostgreSQL RLS and security-definer RPCs enforce row & column access. | Defense-in-depth authorization. |

---

## 3. Explanations of Implemented Hardening Measures

### 3.1 Global Token Revocation on Logout (`useApexStore.ts`)
* **Rationale:** A standard local signout simply removes tokens from local storage, leaving the refresh token valid on the server until expiration. 
* **Hardening:** Updated `logoutUser()` to invoke `supabase.auth.signOut({ scope: 'global' })`, which contacts the Supabase Auth server and invalidates all active refresh tokens associated with the user account across all devices.

### 3.2 URL Token Sanitization & Leakage Prevention (`App.tsx`)
* **Rationale:** When OAuth flows redirect with hash parameters (`#access_token=...`), tokens can linger in `window.location`, browser history, or analytics trackers.
* **Hardening:** Added immediate URL sanitization via `window.history.replaceState(null, '', window.location.pathname)` immediately after the initial session is captured by the Supabase client.

### 3.3 Elimination of Hardcoded Client Identifiers (`OnboardingModal.tsx`)
* **Rationale:** Hardcoding OAuth client IDs directly in component files leads to drift between staging and production environments.
* **Hardening:** Unified OAuth initialization to read `import.meta.env.VITE_GOOGLE_CLIENT_ID` with standard fallback.

### 3.4 Elimination of Insecure Mock Accounts (`googleAuthService.ts`)
* **Rationale:** Generating synthetic `spotter@apex.app` accounts when Google services were offline created an unauthenticated backdoor into the client shell.
* **Hardening:** Removed the mock generator; authentication now fails closed with a clear error prompt.

---

## 4. Verification & Regression Testing

The authentication hardening was validated through automated tests and build verification:
1. **`scripts/test_authorization.mjs`:** Validated that authentication fails closed and rejects mock sessions.
2. **`npm run build`:** Verified clean compilation with zero TypeScript errors.
