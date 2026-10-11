# APEX MASTER PROGRAM — PROGRESS TRACKER

**Single Source of Truth**: [docs/APEX_MASTER_PROGRAM.md](file:///c:/Users/DELL/Downloads/Apex-main/Apex-main/docs/APEX_MASTER_PROGRAM.md)  
**Plan**: [docs/program/PLAN.md](file:///c:/Users/DELL/Downloads/Apex-main/Apex-main/docs/program/PLAN.md)  
**Last Updated**: October 11, 2026  

---

## 1. Current Status Summary
- **Completed Tracks**: Track R (Stability and Release Engineering), Track A (AI Identification: Phase 13)
- **Active Track**: Track U (UI Redesign: Appendix A)
- **Overall Program State**: Track R & Track A completed with full cryptographic evidence and tests passing. Starting Track U (UI Redesign: Tokens, Components, Screens).

---

## 2. Track Breakdown

### Track R: Stability & Release Engineering (`fix/stability`)
- [x] **R1: Client bundle hygiene**
  - [x] Remove `sharp` and `crypto` alias stubs in `vite.config.ts`; make build fail on bare server imports
  - [x] Decouple real import graph: split shared types into client-safe module; ensure client code never imports `src/ai-engine/**` server parts or `api/**`
  - [x] Gate admin AI Control Center, load simulator, and "Reset development state" behind compile-time flag (`VITE_ENABLE_ADMIN`); verify string absence in `dist/` and Android assets
  - [x] Write `scripts/check-client-bundle.mjs` and wire into `npm run build` and CI
  - [x] Add ESLint boundary rule (`scripts/lint-boundaries.mjs`) preventing client code from importing server paths
  - [x] Audit every client use of `crypto`; verify Web Crypto (`crypto.subtle`, `crypto.randomUUID`) with tests (`scripts/test_web_crypto.ts`)
- [x] **R2: Boot reliability**
  - [x] Staged watchdog in `index.html` (calm notice at 7s, recovery actions at 20s)
  - [x] Non-destructive "Clear Cache and Restart" (preserves auth data unless user chooses)
  - [x] Startup Android System WebView compatibility check (< Chrome 111 guidance screen)
  - [x] Local boot failure recorder in storage for support diagnostics
- [x] **R3: Audit auth-adjacent changes**
  - [x] Test `preloadAuthStorage()` behavior under 3s delay; ensure session is never lost on slow storage (`AppBootloader` in `src/main.tsx`)
  - [x] Formulate Lane 2 proposal in `docs/proposals/auth_oauth_callback_timeout.md` for OAuth callback timeout (Gate G7)
- [x] **R4: Android release engineering**
  - [x] Document and script signed release build (`scripts/build-android-release.mjs`, `docs/program/ANDROID_RELEASE_SIGNING.md`) with Gradle signing config
  - [x] Release build settings: `targetSdk 36` check, minification/proguard rules, cleartext traffic off via network security config, debugging off
  - [x] Audit `AndroidManifest.xml` permissions (zero background location requested) and exported components
  - [x] Audit `capacitor.config.ts` (no `server.url`, safe splash)
- [x] **R5: CI and test gates**
  - [x] GitHub Actions workflow (`.github/workflows/ci.yml`) (typecheck, lint boundaries, tests, build, bundle check, frozen paths, browser smoke test, Android assembly)
  - [x] Browser smoke test (`scripts/test_browser_boot.mjs`)
- [x] **R6: Crash and error reporting**
  - [x] Vendor-neutral crash reporting interface (`src/services/crashReporter.ts`) wired into `RootErrorBoundary` and `ModuleErrorBoundary`
  - [x] Proposal for Sentry vs Crashlytics in `docs/proposals/crash_reporting_vendor.md` (Gate G9)
- [x] **R7: Performance baseline**
  - [x] Code-split non-startup screens (`MapScreen`, `GarageScreen`, `SocialScreen`, `ScannerModal`, `Card3DDetail`, etc.) with `React.lazy` and `React.Suspense`
  - [x] Measured entry chunk reduction from 1,370 kB down to 266 kB (>80% reduction)
- [x] **R8: Security and privacy hardening**
  - [x] Secret pattern scanner (`scripts/scan_secrets.mjs`) passing with 0 leaked secrets
  - [x] Restrictive Content Security Policy added to `index.html`
  - [x] Automated read-only RLS test script (`scripts/test_rls_policies.ts`) verifying all 5 core tables fail closed on unauthorized operations
- [x] **R9: Runbook**
  - [x] Write `docs/program/RUNBOOK.md` covering build, sync, install, logcat capture, and black-screen triage checklist

### Track A: AI Identification (`ai/identification`)
- [x] **13A: Scope decision and metric split**
  - [x] Separated metrics into In-catalogue exotics vs Out-of-catalogue commuter vehicles (`docs/ai/PHASE14_RELEASE_RESCUE_REPORT.md`)
  - [x] 0.0% false acceptance of uncatalogued vehicles achieved across 193 uncatalogued items
- [x] **13B: Three-way baseline evaluation on 316-image pool**
  - [x] Benchmarked v1 pipeline, open-vocab VLM-first, and v2 pipeline on identical 316-image pool
- [x] **13C: Shortlist anchoring fix in Stage C**
  - [x] Two-step reasoning protocol: Step 1 free open-world identity, Step 2 catalogue matching
  - [x] Contradiction guard discarding candidate match when open-world make contradicts candidate make
  - [x] Verified by `scripts/test_fail_closed_regression.ts` (12/12 passed)
- [x] **13D: Open-set retrieval calibration**
  - [x] Calibrated open-set anomaly floors (0.65 for CLIP, 0.45 for 64D) in `stageB_galleryRetrieval.ts`
- [x] **13E: Reference data plan**
  - [x] Executed subsampling experiment (k=1, 2, 3) in `scripts/benchmark_learning_curve.ts` (raw file: `eval/raw_responses/learning_curve_raw.json`, SHA-256: `5436a80b...`)
  - [x] Written `docs/ai/proposals/REFERENCE_DATA_PLAN.md` covering lawful acquisition, 515 anchor targets, and owner decisions
- [x] **13F: Production stopgap implementation behind flags**
  - [x] Server-side Gemini 3.5 Flash primary with Gemini 3.1 Flash-Lite fallback behind config flags
  - [x] Bounded 8.5s timeouts, distinct error codes (`VISION_QUOTA_EXHAUSTED`, `VISION_TIMEOUT`, `PROVIDER_UNAVAILABLE`)
  - [x] Written `docs/ai/proposals/PRODUCTION_STOPGAP_PROPOSAL.md` with client bridge diff and cost models ($0.81/mo at 100/day, $8.10/mo at 1k/day)
- [x] **13G: Registry evidence hardening**
  - [x] Audited 70 vehicle variants (350 spec values) in `scripts/audit_registry_evidence_hardening.ts`
  - [x] Saved 350 raw HTML/text page snapshots in `eval/registry_evidence/snapshots/`
  - [x] Generated `eval/registry_evidence/hardened_spotcheck_report.json` (SHA-256: `7679899e...`) with 0% error rate
- [x] **13H: Guard checks**
  - [x] Retrieval-only decisive path strictly disabled (`DECISIVE_RETRIEVAL_ENABLED=false`)
  - [x] Deprecated `gemini-2.5-flash` references migrated to `gemini-3.5-flash`
  - [x] Gate G5 LOCKED: 248 held-out test items untouched, unexposed, and unevaluated
  - [x] Gate G1 RESOLVED: clean manifest promoted as `eval/golden/manifest_v2.json` (SHA-256: `F4884118...`) while canonical `manifest.json` remains frozen

### Track U: UI Redesign (`ui/redesign`)
- [ ] Phase 0: Audit & baseline captures
- [ ] Phase 1: Foundations (`tokens.css`, `@fontsource`, type scale, motion tokens)
- [ ] Phase 2: Primitives (`<Button>`, `<RarityBadge>`, `<StatChip>`, `<Slab>`, etc.)
- [ ] Phase 3: Shell (Header, Bottom nav, navigation restructure, dev-tool gating)
- [ ] Phase 4: Garage (Empty, populated, detail)
- [ ] Phase 5: Home and Quests
- [ ] Phase 6: Feed, Ranks, Profile, Settings, Post composer
- [ ] Phase 7: Map
- [ ] Phase 8: Scanner states & reveal retune
- [ ] Phase 9: Accessibility & performance verification
- [ ] Phase 10: Store screenshot mode

### Track F: Functional Audit (`fix/functional`)
- [ ] Full baseline execution across matrix (Android, mobile web)
- [ ] Item 1: Quest & garage mismatch investigation & fix
- [ ] Item 2: XP inflation curve simulation & rebalancing proposal
- [ ] Item 3: Seeded content removal in release builds
- [ ] Item 4: Report and block user audit & proposal
- [ ] Item 5: Quest list blank region fix
- [ ] Item 6: Map tile provider audit & recommendation
- [ ] Item 7: Dev and admin tools removal in release
- [ ] Item 8: Card specs restricted to verified registry values

### Track S: Store Readiness (`release/store-readiness`)
- [ ] S1: Listing package (`docs/store/LISTING.md`)
- [ ] S2: Data-flow audit & privacy policy draft
- [ ] S3: Data Safety worksheet
- [ ] S4: Account deletion specification & static page
- [ ] S5: UGC moderation gap analysis
- [ ] S6: Store assets (screenshots & icon/graphic briefs)
- [ ] S7: Release checklist (`docs/store/RELEASE_CHECKLIST.md`)

---

## 3. Blocked Items & Owner Decisions Needed
*(Refer to `docs/program/OWNER_DECISIONS.md`)*
- None blocking immediate Track R execution.

---

## 4. Completed Tasks Log
- [x] **Master Program Setup**: Created `docs/APEX_MASTER_PROGRAM.md`, `docs/program/PLAN.md`, `docs/program/PROGRESS.md`, `docs/program/OWNER_DECISIONS.md`.
