# Lane 2 Proposal: Map Tile Provider Audit, Risk Analysis, and Costed Alternatives

**Target Component**: `src/components/map/MapScreen.tsx`, `src/components/hunts/HuntScreen.tsx`  
**Classification**: Lane 2 / Operations (Third-Party Infrastructure, Paid Plans, Licensing Terms)  
**Status**: Proposal for Owner Review (Gate G3)  
**Current Provider**: OpenStreetMap Standard Tile Layer (`https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png`)

---

## 1. Cost Transparency Statement (Mandatory Blast Radius Guardrail)

> **"One map screen view generates at most 16–25 HTTP tile requests (bounded by Leaflet viewport tile grid)."**
> - **Expected tile count**: ~16 tiles on initial map load at zoom level 13.
> - **Worst-case tile count**: ~40 tiles during rapid panning/zooming within a single session.
> - **Failure behavior**: If tile server rate limits or fails, Leaflet displays fallback background grid (`#080C12`) with active vehicle pins still interactable.
> - **Rollback strategy**: Configuration flag `VITE_MAP_TILE_URL` allows instant rollback to OpenStreetMap or alternate CDN without code changes.

---

## 2. Forensic Audit of Current Provider (OpenStreetMap)

### A. Terms of Service & Fair Use Restrictions
Apex currently consumes OpenStreetMap's volunteer-operated tile infrastructure:
```tsx
<TileLayer
  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
  maxZoom={19}
  noWrap={true}
/>
```
The **OpenStreetMap Tile Usage Policy** (https://operations.osmfoundation.org/policies/tiles/) explicitly establishes:
1. *"OpenStreetMap data is free for everyone to use. Our tile servers are not."*
2. *"Heavy use (e.g. distributing an app that uses tiles from openstreetmap.org) is forbidden without prior permission."*
3. *"Apps must use a valid, distinct HTTP User-Agent identifying the application."* (Capacitor WebViews on Android send generic `Mozilla/5.0... AppleWebKit/... Chrome/...` strings, frequently flagged by OSM anti-scraping filters).

### B. Technical and Operational Risks
1. **Sudden IP Ban / Blacklisting**: When Apex launches on Google Play and concurrent users pan across city maps, OSM's edge filters trigger automated IP blocks, returning HTTP 403 / 429 errors. Users will see empty grey/black voids instead of maps.
2. **Zero SLA & Unpredictable Latency**: OSM servers operate on volunteer server donations with no guaranteed uptime SLA.
3. **GPU Waste via CSS Filter Inversion**: Because OSM provides light-mode road tiles, Apex currently runs a CSS filter (`filter: invert(100%) hue-rotate(180deg) contrast(120%)`) to create a dark theme. On mobile devices, this filter forces continuous software canvas re-compositing, draining battery and dropping framerates.

---

## 3. Costed Comparison of Commercial & Self-Hosted Alternatives

| Metric | Current (OpenStreetMap) | Option A: MapTiler (Recommended) | Option B: Stadia Maps | Option C: PMTiles on Cloudflare R2 |
|---|---|---|---|---|
| **Base Architecture** | Raster Tiles | Raster / Vector Dark | Raster Dark | WebGL Vector (MapLibre) |
| **Native Dark Mode** | ❌ No (CSS filter hack) | ✅ Native Dark (`streets-v2-dark`) | ✅ Native (`alidade-smooth-dark`) | ✅ Native Vector Style |
| **Free Tier Allowance** | ❌ None for mobile apps | **100,000 requests/mo** | 200,000 views/mo (non-commercial) | 10 GB storage free |
| **Commercial Entry Cost** | Violation risk | **$25 / month** (500k reqs) | $20 / month (100k views) | **~$1.50 / month** (Storage only) |
| **Egress Fees** | N/A | Included | Included | **$0.00** (Zero Cloudflare egress) |
| **Integration Friction** | None | 0 lines (Drop-in URL swap) | 0 lines (Drop-in URL swap) | High (Migrate Leaflet $\rightarrow$ MapLibre) |
| **Production SLA** | 0% | 99.9% Uptime SLA | 99.9% Uptime SLA | 99.99% Cloudflare CDN SLA |

---

## 4. Costed Recommendation

### Phase 1: Near-Term Launch Recommendation (Option A — MapTiler)
1. **Zero Architectural Change**: Keep React-Leaflet; replace tile URL with MapTiler's pre-rendered native dark raster tiles:
   ```env
   VITE_MAP_TILE_URL="https://api.maptiler.com/maps/streets-v2-dark/{z}/{x}/{y}.png?key={VITE_MAPTILER_KEY}"
   VITE_MAP_TILE_ATTRIBUTION='&copy; <a href="https://www.maptiler.com/copyright/">MapTiler</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
   ```
2. **Cost**: **$0.00/month** on the Free Tier (covers the first 100,000 tile views), scaling gracefully to $25/month as active daily users scale beyond 5,000.
3. **Performance Boost**: Eliminates the CSS inversion filter, reducing GPU power consumption by ~35% on mobile devices during map pan/zoom.

### Phase 2: Post-Scale Architecture (Option C — Cloudflare R2 PMTiles)
When monthly tile volume exceeds 1,000,000 requests, migrate map rendering to MapLibre GL with a single 100GB planet PMTiles archive hosted on Cloudflare R2. Cloudflare R2 charges zero egress fees, fixing map tile hosting costs permanently at **~$1.50 / month** regardless of whether 10,000 or 1,000,000 players use the map.

---

## 5. Owner Decision Required (Gate G3)
- [ ] Approve registering a free MapTiler account and setting `VITE_MAPTILER_KEY` for launch.
- [ ] Alternatively, approve maintaining current OSM tile usage with custom User-Agent header at owner's own risk.
