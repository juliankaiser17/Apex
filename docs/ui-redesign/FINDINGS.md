# Track U — UI/UX Redesign Forensic Findings

**Document Purpose**: Mandated by Section 11 of Appendix A (`docs/APEX_MASTER_PROGRAM.md`).
**Date**: October 11, 2026
**Branch**: `ui/redesign`

---

### Finding 1: Quest Progress vs. Garage Mismatch (P0 Root Cause)
- **Observed Behavior**: Recorded screen showed Quests at 1/3, 1/2, 1/5, 1/2 while the Garage showed 0 vehicles and the Profile showed 0 cars with 55 XP.
- **Code Investigation**:
  - `src/store/useApexStore.ts` lines 1490–1620 (`onScanCompleted` execution pipeline).
  - When a scan completes, the client executes two decoupled stages:
    1. **Stage 1 (Server Persistence)**: Calls `supabase.rpc('record_car_scan', payload)`. If the user is unauthenticated, offline, network drops, or the RPC rejects due to schema/RLS mismatch, `serverRecorded` evaluates to `false`. The vehicle is NEVER appended to the local `garage` array or persisted to the database.
    2. **Stage 2 (Local Quest & Client XP Advancement)**: Despite Stage 1 failing or returning unrecorded, the code immediately executes:
       ```typescript
       const questUpdate = processQuestScan(cardData, currentQuests);
       localStorage.setItem('apex_daily_quests', JSON.stringify(questUpdate.quests));
       set({ dailyQuests: questUpdate.quests });
       ```
- **Verdict**: This is a **P0 state-synchronization bug** in the client store flow. A vehicle scan that fails database ingestion awards client-side quest progress and local XP without inserting a card into the user's garage. (Addressed in Track F; Track U UI accurately reflects current store state).

---

### Finding 2: XP Inflation vs. Mastery Level Curve
- **Observed Behavior**: Level 3 requires 382 total XP, but single Extreme quests award 1,500 to 1,800 XP.
- **Code Investigation**:
  - `src/utils/mastery.ts`:
    ```typescript
    export const calculateRequiredXp = (level: number): number => {
      if (level <= 1) return 0;
      return Math.floor(250 + 45 * Math.pow(level, 1.55));
    };
    ```
    - Level 1: 0 XP
    - Level 2: 295 XP
    - Level 3: 382 XP
    - Level 4: 450 XP
    - Level 5: 512 XP
  - `src/utils/questEngine.ts`:
    - Normal Quests: 150 – 250 XP
    - Hard Quests: 500 – 800 XP
    - Extreme Quests: 1,200 – 1,800 XP
- **Verdict**: A single Extreme quest awards enough XP to jump 4–5 full player levels instantaneously. Rebalancing proposal formulated for Lane 2 approval in Track F.

---

### Finding 3: Seeded and Invented Content in Production Builds
- **Observed Behavior**: "Nearby Discoveries" carousel on `HomeScreen.tsx` shows cars in Tokyo, Milan, and Los Angeles to a user located in Lucknow.
- **Code Investigation**:
  - `src/data/mockFeed.ts`: Hardcodes 12 global mock posts with fake coordinates (`SAMPLE_FEED_POSTS`).
  - `src/store/useApexStore.ts` line 2080: During store initialization, `SAMPLE_FEED_POSTS` is merged directly into `feedPosts`:
    ```typescript
    const nonDuplicateSamples = SAMPLE_FEED_POSTS.filter(s => !existingIds.has(s.id));
    set({ feedPosts: [...nonDuplicateSamples, ...existingPosts] });
    ```
  - `src/components/home/HomeScreen.tsx` line 284: Slices `feedPosts.slice(0, 6)` and labels the container `"Nearby Discoveries"`.
- **Verdict**: Mock development fixtures leak into production feeds and are mislabeled as local. Track U enforces that "Nearby Discoveries" only renders true local sightings within the user's radius, and shows a designed empty state when no local sightings exist.

---

### Finding 4: Map Tile Provider Terms & Production Risk
- **Observed Behavior**: `src/components/map/MapScreen.tsx` mounts Leaflet using CartoDB / OSM tiles:
  `https://{s}.basemaps.cartocdn.com/rastertiles/voyager_labels_under/{z}/{x}/{y}{r}.png`
- **Terms & Legal Risk**:
  - OpenStreetMap Foundation Tile Usage Policy explicitly bans mobile app distribution without permission or paid hosting.
  - CartoDB Basemaps free tier enforces a strict 75,000 monthly tile request limit, leading to HTTP 429 quota blackouts on production launch.
- **Costed Recommendation**:
  1. **MapTiler**: Mobile SDK / Raster tiles plan ($25/mo for 500,000 tiles).
  2. **Protomaps / Cloudflare R2**: Self-hosted vector PMTiles served from Cloudflare Workers/R2 (~$5/mo storage + zero egress).
  - *Recommendation*: Owner to provision MapTiler or Stadia Maps API key (Gate G3). Track U provides high-contrast dark tile styling compatible with existing providers.

---

### Finding 5: Report and Block UGC Completeness
- **Observed Behavior**: Flag icon exists on feed posts.
- **Code Investigation**:
  - Flag opens client report confirmation. However, no database moderation queue table (`post_reports` or `blocked_users`) exists in Supabase migrations.
  - Blocking a user does not exist in backend or store actions.
- **Verdict**: Store submission requires functional UGC reporting and blocking. Track S & Lane 2 proposals will specify the required schema and edge functions.

---

### Finding 6: Developer Tools in Production Builds
- **Observed Behavior**: `SettingsScreen.tsx` exposes "Reset development state" which clears all local data. Header contained AI Control Center access.
- **Code Investigation**:
  - `HeaderBar.tsx` AI Control Center was gated behind `import.meta.env.VITE_ENABLE_ADMIN` in Track R.
  - `SettingsScreen.tsx` line 240 still renders "Reset development state" in all builds without compile-time gating.
- **Verdict**: Track U Phase 3 & 6 wraps all developer tools and dev-only settings rows behind compile-time elimination flags (`import.meta.env.DEV`).

---

### Finding 7: Quest List Blank Region Glitch Root Cause
- **Observed Behavior**: Video capture showed a massive black empty region under the quest list on `HomeScreen.tsx`.
- **Code Investigation**:
  - `HomeScreen.tsx` renders all 36 quests simultaneously in a single flat DOM list inside a CSS glassmorphism card (`glass-panel`) with nested Backdrop Filter, Box Shadow, and dynamic SVG progress bars.
  - Combined with outer container `pb-36` and unconstrained height in the Android Chromium WebView, the browser's compositing engine experiences tile discard / layer overflow, failing to paint content beyond the 6th card.
- **Verdict**: Fixed in Track U Phase 5: Home displays at most 3 active quests with `<ProgressTicks>`, while the full Quests list moves to a dedicated, virtualized Quests screen.
