# APEX MASTER PROGRAM — OWNER DECISIONS & GATES

**Master Document**: [docs/APEX_MASTER_PROGRAM.md](file:///c:/Users/DELL/Downloads/Apex-main/Apex-main/docs/APEX_MASTER_PROGRAM.md)  
**Spend Cap**: $25.00 USD total across AI provider tests (current usage tracked in `docs/ai/COST_LOG.md`).  

---

## Active Decision Matrix

| Gate | Category | Summary | Current Recommendation | Impact / What is Blocked | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **G1** | Data Manifest | Promote proposed clean manifest as `manifest_v2.json` beside canonical | Promoted as `eval/golden/manifest_v2.json` (SHA-256: `F4884118...`); canonical `manifest.json` completely untouched. | Closed / Approved | **RESOLVED** |
| **G2** | IP / Legal | User photo consent & licensing for shipped gallery references | Restrict release gallery to public-domain / explicitly licensed assets | Blocks bundling user photos in app assets | OPEN |
| **G3** | Infrastructure | Provisioning hosted embedding service / database migrations | Defer hosted embedding until Phase 13B/13E evaluates VLM vs gallery tradeoff | Infrastructure costs paused; no migration applied | OPEN |
| **G4** | Field Campaign | Physical field-photo collection campaign | Run with internal team once release candidate is stable | Blocks adding new camera captures to test splits | OPEN |
| **G5** | Test Split Integrity | Opening single held-out test split for evaluation | Keep CLOSED until all validation targets are achieved | Preserves zero data contamination | **CLOSED** |
| **G6** | Billing & Cloud | Changing AI provider plans (Cloudflare / Gemini paid tiers) | Implement Gemini 3.5 Flash stopgap behind config flags; maintain free tier bounds | Blocks automatic plan upgrades | OPEN |
| **G7** | Authentication | Auth changes / OAuth callback timeout in `App.tsx` | Present Lane 2 proposal in [docs/proposals/auth_oauth_callback_timeout.md](file:///c:/Users/DELL/Downloads/Apex-main/Apex-main/docs/proposals/auth_oauth_callback_timeout.md) | Blocks editing `App.tsx` auth flow | OPEN |
| **G8** | Store & Legal | Play Console submission, legal review of Privacy Policy | Review `docs/store/PRIVACY_POLICY_DRAFT.md` and Data Safety sheet | Blocks production store rollout | OPEN |
| **G9** | Crash Reporting | Choice of crash reporting vendor | Recommend Sentry (or Crashlytics if Firebase already planned) — see [docs/proposals/crash_reporting_vendor.md](file:///c:/Users/DELL/Downloads/Apex-main/Apex-main/docs/proposals/crash_reporting_vendor.md) | Blocks integrating specific vendor SDK | OPEN |

---

## Log of Closed Decisions
*(Entries will be moved here as owner responds)*
