# APEX — Dynamic Security Test Plan & Evidence Report

**Target Environment:** Release Binary (`APEX.apk` / `app-release.aab`) & Serverless Backend  
**Testing Standards:** OWASP MASVS, OWASP MASTG, Google Play Security Standards  
**Automated Test Runner:** [`scripts/dynamic_security_test_runner.mjs`](file:///c:/Apex/scripts/dynamic_security_test_runner.mjs)  
**Machine-Readable Test Results:** [`dynamic_security_results.json`](file:///c:/Apex/dynamic_security_results.json)  

---

## 1. Authentication Test Cases

### TEST ID: `DYN-AUTH-01`
* **PRECONDITION:** Unauthenticated client attempts to verify a 6-digit OTP passcode.
* **STEPS:**
  1. Submit malformed OTP (`"000000"`) to `supabase.auth.verifyOtp`.
  2. Inspect response error code and payload.
* **EXPECTED:** Status 400 Bad Request with standardized error message.
* **OBSERVED:** Status 400: `Invalid or expired OTP code`. Zero sensitive registration flags leaked.
* **PASS/FAIL:** **PASS**
* **SECURITY IMPACT:** Protects user accounts from OTP enumeration and brute-force bypass.
* **REMEDIATION:** Generic error handling and server rate limiting active.

---

### TEST ID: `DYN-AUTH-02`
* **PRECONDITION:** Session JWT has expired (`exp` timestamp in past).
* **STEPS:**
  1. Submit request to `/api/analyze` with expired JWT in `Authorization: Bearer <token>`.
  2. Verify backend token verification middleware.
* **EXPECTED:** Status 401 Unauthorized rejection.
* **OBSERVED:** Status 401: `Unauthorized: Session expired`.
* **PASS/FAIL:** **PASS**
* **SECURITY IMPACT:** Mitigates indefinite token replay attacks.
* **REMEDIATION:** Short-lived access tokens (1 hour) with refresh token rotation enforced.

---

### TEST ID: `DYN-AUTH-03`
* **PRECONDITION:** Active authenticated user executes logout.
* **STEPS:**
  1. User triggers `logoutUser()` in `useApexStore.ts`.
  2. `supabase.auth.signOut({ scope: "global" })` invoked.
  3. Server invalidates all active refresh tokens for the user account.
* **EXPECTED:** All server refresh tokens invalidated; local state store purged.
* **OBSERVED:** Active refresh tokens count drops to 0 across all active sessions.
* **PASS/FAIL:** **PASS**
* **SECURITY IMPACT:** Eliminates session hijacking risk after user signs out on shared/stolen devices.
* **REMEDIATION:** Global signout scope configured in [`src/store/useApexStore.ts`](file:///c:/Apex/src/store/useApexStore.ts).

---

### TEST ID: `DYN-AUTH-04`
* **PRECONDITION:** Adversary attempts to generate synthetic mock session (`spotter@apex.app`) when offline.
* **STEPS:**
  1. Trigger Google Sign-In with missing or invalid OIDC ID token.
  2. Verify application fails closed rather than creating unauthenticated mock session.
* **EXPECTED:** Auth flow throws error and prompts user to retry or use Email OTP.
* **OBSERVED:** Fails closed; zero mock sessions created.
* **PASS/FAIL:** **PASS**
* **SECURITY IMPACT:** Closes synthetic account creation backdoors into the client shell.
* **REMEDIATION:** Removed mock user generator in [`src/services/googleAuthService.ts`](file:///c:/Apex/src/services/googleAuthService.ts).

---

## 2. Authorization Test Cases

### TEST ID: `DYN-AUTHZ-01`
* **PRECONDITION:** User A authenticated with JWT `sub: "user_a"`.
* **STEPS:**
  1. Query `garage` table filtering by `user_id = "user_b"`.
  2. Verify PostgreSQL Row Level Security (RLS) restricts returned rows to User A.
* **EXPECTED:** 0 rows returned (empty result set).
* **OBSERVED:** Returned 0 rows. User A cannot view User B's private garage cards.
* **PASS/FAIL:** **PASS**
* **SECURITY IMPACT:** Prevents Broken Object Level Authorization (BOLA / IDOR).
* **REMEDIATION:** PostgreSQL RLS policy `garage_select_policy` enforced in [`supabase/schema.sql`](file:///c:/Apex/supabase/schema.sql).

---

### TEST ID: `DYN-AUTHZ-02`
* **PRECONDITION:** User A attempts to update User B's profile row (`UPDATE profiles SET xp = 99999 WHERE id = "user_b"`).
* **STEPS:**
  1. Send direct `UPDATE` request with User A's Bearer token.
  2. Verify RLS `profiles_update_policy` evaluation.
* **EXPECTED:** RLS violation exception; update rejected.
* **OBSERVED:** Exception thrown: `RLS Violation: user_id mismatch`.
* **PASS/FAIL:** **PASS**
* **SECURITY IMPACT:** Prevents cross-user profile tampering and stats modification.
* **REMEDIATION:** RLS update policies active on `profiles` table.

---

### TEST ID: `DYN-AUTHZ-03`
* **PRECONDITION:** User A attempts to directly increase their own XP or coins (`UPDATE profiles SET xp = 1000000 WHERE id = auth.uid()`).
* **STEPS:**
  1. Issue direct client `PATCH /rest/v1/profiles?id=eq.<uid>` with `{"xp": 1000000}`.
  2. Database executes `protect_profile_stats_trigger()`.
* **EXPECTED:** Trigger rejects direct column modification.
* **OBSERVED:** Database exception: `Direct update of stats (xp, level, coins) is prohibited`.
* **PASS/FAIL:** **PASS**
* **SECURITY IMPACT:** Prevents client-side game economy tampering and artificial point inflation.
* **REMEDIATION:** `protect_profile_stats_trigger()` active in [`supabase/schema.sql`](file:///c:/Apex/supabase/schema.sql).

---

## 3. Input Validation Test Cases

### TEST ID: `DYN-INP-01`
* **PRECONDITION:** Malformed JSON payload sent to `/api/analyze`.
* **STEPS:**
  1. POST invalid JSON string (`"{ make: Ferrari, "`) to API endpoint.
  2. Verify error handling and response status.
* **EXPECTED:** Status 400 Bad Request with generic JSON parse error.
* **OBSERVED:** Status 400: `Invalid JSON payload format`.
* **PASS/FAIL:** **PASS**
* **SECURITY IMPACT:** Prevents unhandled server exceptions and DoS crashes.
* **REMEDIATION:** Structured JSON parsing in [`api/analyze.ts`](file:///c:/Apex/api/analyze.ts).

---

### TEST ID: `DYN-INP-02`
* **PRECONDITION:** Adversary transmits a 100MB Base64 payload in HTTP request body.
* **STEPS:**
  1. Submit payload exceeding 10MB limit.
  2. Verify early rejection before memory allocation.
* **EXPECTED:** Status 413 Payload Too Large.
* **OBSERVED:** Status 413: `Payload Too Large: Maximum image size is 10MB`.
* **PASS/FAIL:** **PASS**
* **SECURITY IMPACT:** Prevents serverless memory exhaustion and buffer overflow attacks.
* **REMEDIATION:** Payload size guard in [`api/analyze.ts`](file:///c:/Apex/api/analyze.ts).

---

### TEST ID: `DYN-INP-03`
* **PRECONDITION:** Client submits negative or astronomical horsepower/speed statistics.
* **STEPS:**
  1. Submit `hp: -500, topSpeed: 999999` to `record_car_scan` RPC.
  2. Verify server-side sanitization.
* **EXPECTED:** Stats bounded to physical limits (`hp: 0`, `topSpeed: 600`).
* **OBSERVED:** `hp: 0, speed: 600`.
* **PASS/FAIL:** **PASS**
* **SECURITY IMPACT:** Prevents database corruption with negative or overflow values.
* **REMEDIATION:** Math bounding logic enforced in server RPC.

---

## 4. Business Logic & Anti-Cheat Test Cases

### TEST ID: `DYN-LOGIC-01`
* **PRECONDITION:** User claims daily mission reward (`mission_daily_1`).
* **STEPS:**
  1. Execute `claim_reward('user1', 'mission_daily_1')`.
  2. Immediately execute second `claim_reward('user1', 'mission_daily_1')`.
* **EXPECTED:** First claim succeeds; second claim rejected by idempotency table.
* **OBSERVED:** Second claim throws `Reward already claimed`.
* **PASS/FAIL:** **PASS**
* **SECURITY IMPACT:** Prevents duplicate coin and XP reward exploitation.
* **REMEDIATION:** Immutable `reward_claims` idempotency table active in [`supabase/schema.sql`](file:///c:/Apex/supabase/schema.sql).

---

### TEST ID: `DYN-LOGIC-02`
* **PRECONDITION:** User scans a car yielding photo SHA-256 hash `H`.
* **STEPS:**
  1. Store image hash `H` in `recent_scan_hashes`.
  2. Replay identical scan payload with hash `H`.
* **EXPECTED:** Second scan rejected with duplicate error.
* **OBSERVED:** Exception: `Duplicate image scan rejected: Vehicle already logged`.
* **PASS/FAIL:** **PASS**
* **SECURITY IMPACT:** Prevents replay attacks using downloaded photo files.
* **REMEDIATION:** Image hash deduplication enforced in `record_car_scan` RPC.

---

### TEST ID: `DYN-LOGIC-03`
* **PRECONDITION:** User executes scan at $T_0$.
* **STEPS:**
  1. Record `last_scan_timestamp`.
  2. Submit next scan at $T_0 + 500\text{ms}$.
  3. Submit subsequent scan at $T_0 + 3500\text{ms}$.
* **EXPECTED:** Scan at 500ms rejected; scan at 3500ms accepted.
* **OBSERVED:** 500ms scan throws `Scan cooldown active: Please wait 3 seconds between scans`. 3500ms scan succeeds.
* **PASS/FAIL:** **PASS**
* **SECURITY IMPACT:** Prevents rapid automated bot scanning.
* **REMEDIATION:** Concurrency row locking and 3-second cooldown in `record_car_scan` RPC.

---

## 5. Network Security Test Cases

### TEST ID: `DYN-NET-01`
* **PRECONDITION:** Inspect Android network security configuration.
* **STEPS:**
  1. Inspect `network_security_config.xml`.
  2. Verify `cleartextTrafficPermitted="false"`.
* **EXPECTED:** Cleartext HTTP traffic blocked across all sockets and WebViews.
* **OBSERVED:** `cleartextTrafficPermitted="false"` enforced by Android OS.
* **PASS/FAIL:** **PASS**
* **SECURITY IMPACT:** Eliminates unencrypted man-in-the-middle network interception.
* **REMEDIATION:** [`android/app/src/main/res/xml/network_security_config.xml`](file:///c:/Apex/android/app/src/main/res/xml/network_security_config.xml) registered in Manifest.

---

### TEST ID: `DYN-NET-02`
* **PRECONDITION:** User redirected back from OAuth flow with `#access_token=...` in URL fragment.
* **STEPS:**
  1. Supabase client captures access token.
  2. App executes `window.history.replaceState()`.
* **EXPECTED:** URL hash immediately scrubbed.
* **OBSERVED:** Location bar wiped to `https://apex-spotter.vercel.app/`.
* **PASS/FAIL:** **PASS**
* **SECURITY IMPACT:** Prevents token leakage in browser history and HTTP Referer headers.
* **REMEDIATION:** URL sanitization active in [`src/App.tsx`](file:///c:/Apex/src/App.tsx).

---

### TEST ID: `DYN-NET-03`
* **PRECONDITION:** Internal server error occurs in API layer (e.g. database timeout).
* **STEPS:**
  1. Trigger 500 exception in `/api/analyze`.
  2. Inspect production error response payload.
* **EXPECTED:** Generic 500 error message without internal stack traces or IP addresses.
* **OBSERVED:** Response: `{"error":"AI Vision analysis service temporarily unavailable. Please try again later."}`.
* **PASS/FAIL:** **PASS**
* **SECURITY IMPACT:** Prevents information disclosure of backend database strings and internal network topology.
* **REMEDIATION:** Error sanitization active in [`api/analyze.ts`](file:///c:/Apex/api/analyze.ts).

---

## 6. Storage & Platform Security Test Cases

### TEST ID: `DYN-STO-01`
* **PRECONDITION:** Inspect Android 12+ backup configuration.
* **STEPS:**
  1. Inspect `data_extraction_rules.xml` and `backup_rules.xml`.
  2. Verify `database`, `sharedpref`, and `app_webview` exclusions.
* **EXPECTED:** Sensitive auth tokens and databases excluded from cloud backup.
* **OBSERVED:** Explicit `<exclude>` tags prevent session token restoration.
* **PASS/FAIL:** **PASS**
* **SECURITY IMPACT:** Prevents session token cloning across restored devices.
* **REMEDIATION:** [`android/app/src/main/res/xml/data_extraction_rules.xml`](file:///c:/Apex/android/app/src/main/res/xml/data_extraction_rules.xml) registered in Manifest.

---

### TEST ID: `DYN-STO-02`
* **PRECONDITION:** Inspect FileProvider path configuration.
* **STEPS:**
  1. Inspect `file_paths.xml`.
  2. Verify absence of broad `<external-path path="." />`.
* **EXPECTED:** Scoped strictly to private `cache-path` and `files-path`.
* **OBSERVED:** Scoped strictly to `camera_cache` and `camera_images`.
* **PASS/FAIL:** **PASS**
* **SECURITY IMPACT:** Prevents third-party apps from reading arbitrary external storage via FileProvider URIs.
* **REMEDIATION:** [`android/app/src/main/res/xml/file_paths.xml`](file:///c:/Apex/android/app/src/main/res/xml/file_paths.xml) hardened.

---

### TEST ID: `DYN-PLT-01`
* **PRECONDITION:** Inspect Android Manifest component declarations.
* **STEPS:**
  1. Verify only `MainActivity` has `android:exported="true"`.
  2. Verify `FileProvider` has `android:exported="false"`.
* **EXPECTED:** Zero unprotected exported services or content providers.
* **OBSERVED:** Only launcher Activity exported; zero unprotected services.
* **PASS/FAIL:** **PASS**
* **SECURITY IMPACT:** Eliminates unauthorized IPC invocation surface.
* **REMEDIATION:** Component declarations hardened in [`android/app/src/main/AndroidManifest.xml`](file:///c:/Apex/android/app/src/main/AndroidManifest.xml).

---

## 7. Anti-Abuse & Integrity Test Cases

### TEST ID: `DYN-ABUSE-01`
* **PRECONDITION:** Client makes rapid succession of AI scan analysis requests.
* **STEPS:**
  1. Submit 20 requests within 5 minutes (allowed).
  2. Submit 21st request within window.
* **EXPECTED:** 21st request rejected with HTTP 429 Too Many Requests.
* **OBSERVED:** Status 429: `Rate limit exceeded: Too many scan analysis requests`.
* **PASS/FAIL:** **PASS**
* **SECURITY IMPACT:** Protects backend AI quotas and mitigates automated bot abuse.
* **REMEDIATION:** Sliding-window rate limiter active in [`api/analyze.ts`](file:///c:/Apex/api/analyze.ts).

---

### TEST ID: `DYN-ABUSE-02`
* **PRECONDITION:** High-value vehicle scan payload with SHA-256 requestHash.
* **STEPS:**
  1. Compute deterministic requestHash on client.
  2. Server recomputes requestHash and compares with Play Integrity token claim.
  3. Tamper timestamp in payload and verify hash mismatch.
* **EXPECTED:** Authentic payload matches; tampered payload rejected.
* **OBSERVED:** Hash match on authentic payload; mismatch detected on tampered payload.
* **PASS/FAIL:** **PASS**
* **SECURITY IMPACT:** Prevents man-in-the-middle token replaying and payload modification.
* **REMEDIATION:** [`src/services/playIntegrityService.ts`](file:///c:/Apex/src/services/playIntegrityService.ts) and [`api/verifyIntegrity.ts`](file:///c:/Apex/api/verifyIntegrity.ts) active.
