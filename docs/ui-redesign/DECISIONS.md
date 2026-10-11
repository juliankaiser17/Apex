# Track U — UI/UX Redesign Decisions Log

**Document Purpose**: Mandated by Section 12 of Appendix A (`docs/APEX_MASTER_PROGRAM.md`).
**Date**: October 11, 2026
**Branch**: `ui/redesign`

All decisions below are implemented with clear, reversible patterns so the owner can adjust or revert any specific behavior if desired.

---

### Decision 1: Navigation Restructure
- **Proposal**:
  - Profile is opened directly from the header avatar as a full-screen view/route, rather than living as a sub-tab inside Feed.
  - Ranks (Leaderboards) is reachable from the Home "Your city" strip and a dedicated trophy icon at the top of the Feed.
  - Feed is dedicated strictly to photography and social discoveries with a clean single header row.
- **Implementation Status**: Implemented in Phase 3 shell. Reversible via standard route switching in `App.tsx`.

---

### Decision 2: Tier-Scaled Reveal Length with Tap-to-Skip
- **Proposal**:
  - Scale the 11-phase reveal choreography duration based on vehicle rarity tier:
    - **Common**: ~1.6s
    - **Uncommon**: ~2.2s
    - **Rare**: ~3.0s
    - **Epic**: ~3.8s
    - **Legendary**: ~4.8s
    - **Mythic**: Full cinematic duration (~6.0s)
  - Lower tiers drop extraneous fireworks/energy streaks to keep repeat scans snappy.
  - Tap-anywhere skip available after the rarity stamp reveals, jumping straight to the collectible `<Slab>` resting state.
  - **Invariance**: Skipping animation NEVER skips or affects server persistence or XP ledger operations.
- **Implementation Status**: Implemented in Phase 8 (`DiscoveryReveal.tsx`). Configurable via `REVEAL_TIER_TIMINGS` constant.

---

### Decision 3: Home Focused Layout (Today Card + Max 3 Quests)
- **Proposal**:
  - Home features one central **Today card** as the screen hero (closest quest to completion + streak status + primary "Scan a car" CTA).
  - Shows at most 3 active quests as compact rows with `<ProgressTicks>`.
  - A "See all quests" button opens the dedicated Quests screen with tabs (Active, Available, Completed) and virtualization.
- **Implementation Status**: Implemented in Phase 5 (`HomeScreen.tsx` and `QuestsScreen.tsx`).

---

### Decision 4: Restricted Accent Color & Semantic Gold for XP
- **Proposal**:
  - `--accent-color` (theme variable) is restricted strictly to:
    1. Scan shutter / navigation button.
    2. Primary screen CTA button.
    3. Live / alert indicators (hunt countdown, unread dots, active scan sweep).
  - Rarity uses dedicated semantic color tokens (`--color-common` through `--color-legendary` and Mythic prismatic gradient).
  - XP, coins, and levels strictly use semantic gold (`--color-xp: #F2B33D`) to eliminate warning-red confusion.
  - Danger/destructive actions strictly use `--color-danger: #E5484D`.
- **Implementation Status**: Implemented in Phase 1 design tokens (`src/styles/tokens.css`).

---

### Decision 5: Honest Partial Identification Handling
- **Proposal**:
  - When the AI identification resolves at model-family level with unconfirmed variant (or low confidence), do NOT auto-mint a placeholder card.
  - Display an honest "Partially Identified" or "Uncertain" result screen detailing what parts/make were recognized and offering a guided angle retake.
  - Protects garage collector value and avoids mislabeled cards in production.
- **Implementation Status**: Implemented in Phase 8 scanner HUD states.

---

### Dependencies Added (Ground Rule 6 Compliance)
- `@fontsource/inter`, `@fontsource/big-shoulders-display`, `@fontsource/jetbrains-mono`: Mandated by Appendix A Section 3 to replace Google Fonts runtime downloads with self-hosted latin-subset offline typography in the Capacitor Android WebView.

