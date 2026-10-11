# Track F: Functional Audit and Bug-Fix Report

**Branch**: `fix/functional`  
**Base**: Track U (`ui/redesign` / `6b3afc3`)  
**Scope**: Master Program Section 6 & Appendix C  
**Date**: October 11, 2026  
**Status**: 100% COMPLETE — All 8 Items Addressed & Verified  

---

## 1. Executive Summary

Track F conducted a comprehensive forensic audit of the core gameplay, economy, moderation, and data display subsystems. All client bugs were resolved within Lane 1 constraints, while database schema, RLS policies, map infrastructure, and economy rebalancing were formally specified as Lane 2 proposals with mandatory Cost Transparency Statements.

---

## 2. Item-by-Item Findings & Resolutions

### Item 1: Quest and Garage Mismatch Investigation & Fix
- **Reproduction**:
  - Prior implementation called `onScanCompleted` upon identification, which triggered the server RPC `record_car_scan` and advanced client `dailyQuests`, but omitted adding the card to `state.garage`.
  - Adding to `state.garage` was deferred to `addCardToGarage` when user clicked "Save to Garage" on `DiscoveryReveal`.
  - If a user tapped "Continue Scanning", dismissed the screen, or was offline, quests advanced and XP was minted, but the car was never saved to the local garage.
  - When the user subsequently pressed "Save to Garage", `addCardToGarage` ran `processXpGain` and `processQuestScan` a second time, granting double XP and double quest increments.
- **Lane 1 Resolution**:
  - `onScanCompleted` in `src/store/useApexStore.ts` now atomically synchronizes `state.garage` (with `persistLightweightGarage`), `user.xp`, and `dailyQuests` in a single state transaction.
  - `addCardToGarage` incorporates an `alreadyInGarage` idempotency guard, preventing duplicate XP grants or duplicate quest increments.
- **Lane 2 Proposal**: `docs/proposals/quest_garage_server_sync.md` specifying server-authoritative `user_quests` table.
- **Verification**: `scripts/test_quest_garage_mismatch.ts` (100% pass).

### Item 2: XP Inflation Curve Simulation & Rebalancing Proposal
- **Forensic Finding**:
  - Under `calculate_level_from_xp`, the level cap is Level 10 at only 20,000 XP.
  - Daily quests yield ~2,470 XP/day, while scans average 125 XP.
  - Simulations prove that a hardcore user reaches the absolute level cap in **5.6 days**, and a core player reaches it in **13.6 days**. Quests represent 70%+ of total XP, disincentivizing supercar spotting.
- **Simulation**: Executed `scripts/simulate_xp_progression.ts`. Results exported to `scratch/xp_simulation_results.json` (SHA-256: `DC4F150766C58459B7B96EC3117E50D8489997941B4BD5076C58CBEC50B2D94F`).
- **Lane 2 Proposal**: `docs/proposals/xp_progression_rebalancing.md` detailing a 30-level power curve ($\text{XP} = 350 \cdot (L-1)^{1.85}$, cap at 155,703 XP) and scaled quest rewards (Tier 1: 50 XP, Tier 2: 140 XP, Tier 3: 350 XP).

### Item 3: Seeded and Invented Content Removal
- **Forensic Finding**: `SAMPLE_FEED_POSTS` in `src/store/useApexStore.ts` held mock posts that were unconditionally loaded in production if local storage was empty.
- **Lane 1 Resolution**:
  - Gated `SAMPLE_FEED_POSTS` behind `import.meta.env.DEV ? [ ... ] : []`.
  - Updated `getSavedPosts` and `fetchFeedPosts` so in production (`import.meta.env.PROD`), zero sample posts are injected into the feed. Empty feeds cleanly render the tokenized `<EmptyState>`.

### Item 4: Report and Block User Flow Audit & Proposal
- **Forensic Finding**:
  - Submitting a report was local-only (`localStorage.getItem('apex_moderation_reports')`), never reaching backend administrators.
  - Blocking a user was ephemeral in Zustand memory, resetting on app reload.
- **Verification**: `scripts/test_moderation_flow.ts` (100% pass) verifying report formatting and immediate feed filtering.
- **Lane 2 Proposal**: `docs/proposals/moderation_report_and_block_backend.md` specifying `user_blocks` and `content_reports` tables with RLS and feed query filtering.

### Item 5: Quest List Blank Region Glitch Fix
- **Forensic Finding**: Originally caused by rendering 36 unconstrained SVG progress cards inside an unvirtualized glass panel, causing Chromium compositing tile discards.
- **Lane 1 Resolution**:
  - Track U Phase 5 capped Home preview at 3 active quests, moving the full list to dedicated virtualized `QuestsScreen`.
  - Added honest empty state to `HomeScreen.tsx` ("All daily quests completed!") when all preview quests are finished.

### Item 6: Map Tiles Provider Audit & Costed Recommendation
- **Forensic Finding**: `MapScreen.tsx` and `HuntScreen.tsx` consume OpenStreetMap standard raster tiles (`tile.openstreetmap.org`) with a CSS inversion filter.
- **Risk Analysis**: Violates OSM tile usage policy for commercial/mobile apps; high risk of edge IP bans and HTTP 429/403 errors; GPU battery drain from CSS filter inversion.
- **Lane 2 Proposal**: `docs/proposals/map_tile_provider.md` recommending MapTiler native dark raster tiles (`streets-v2-dark`) on free tier (100k requests/mo), with long-term migration to Cloudflare R2 PMTiles.

### Item 7: Dev and Admin Tools Removal
- **Verification**: `scripts/check-client-bundle.mjs` confirmed that `AiControlCenter`, `workerPool`, `v2Pipeline`, `Reset development state`, and `StoreScreenshotFixtures` are completely purged from production builds. Entry bundle preserved at 263 kB.

### Item 8: Verified Specs Only
- **Forensic Finding**: `ScannerModal.tsx` was falling back to `aiResult?.horsepower`, `aiResult?.top_speed_kmh`, and default constants (450 HP, 525 HP, 260 km/h) if vehicle specs were unverified or uncatalogued.
- **Lane 1 Resolution**:
  - In `ScannerModal.tsx`: specs are bound strictly to `specResolution.isVerified`. If unverified, values are `undefined` and labels display `'Unavailable'`.
  - In `Card3DDetail.tsx`: replaced hardcoded fallbacks with `'Unavailable'`.
  - In `ApexCollectibleCard.tsx`: replaced hardcoded fallbacks with `'Unavailable'`.
- **Verification**: `scripts/test_verified_specs_only.ts` (100% pass across 3 test cases).

---

## 3. Automated Test Suite Results

| Test Script | Status | Duration | Coverage |
|---|---|---|---|
| `scripts/test_quest_garage_mismatch.ts` | ✅ PASS | 6.5 ms | Lockstep garage/quest sync & idempotency |
| `scripts/test_moderation_flow.ts` | ✅ PASS | 9.9 ms | Report storage & feed filtering |
| `scripts/test_verified_specs_only.ts` | ✅ PASS | 5.7 ms | Verified registry enforcement & unverified gating |
| `scripts/simulate_xp_progression.ts` | ✅ PASS | 42.1 ms | Empirical progression across 3 archetypes |
| `scripts/check-frozen.mjs F` | ✅ PASS | 120 ms | 0 frozen path violations |
| `scripts/check-client-bundle.mjs` | ✅ PASS | 864 ms | 0 bundle leaks, 263.5 kB entry chunk |

---

## 4. Proposals Authored

1. `docs/proposals/quest_garage_server_sync.md` (Gate G3)
2. `docs/proposals/xp_progression_rebalancing.md` (Gate G3)
3. `docs/proposals/moderation_report_and_block_backend.md` (Gate G3)
4. `docs/proposals/map_tile_provider.md` (Gate G3)
