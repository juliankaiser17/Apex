# Google Play Store Listing Package: Apex

**Package Name**: `com.apex.spotter`  
**Target Category**: Auto & Vehicles / Card & Board Games / Lifestyle  
**Content Rating**: Teen (IARC — User Interaction & Location Sharing)  
**Verification Status**: Verified against shipped production build (100% honest claims)

---

## 1. Title & Short Description

### Title (22 / 30 characters)
```text
Apex: Supercar Spotter
```

### Short Description (53 / 80 characters)
```text
Spot supercars. Hunt rare finds. Build your collection.
```

*Alternative Short Description (72 / 80 characters)*:
```text
Scan supercars you spot in the wild. Rarity changes from city to city.
```

---

## 2. Full Description (1,554 / 4,000 characters)

```text
Saw a McLaren on your way to work and had nobody to tell? Apex is for that.

Point your camera at a car and scan it. Apex works out what it is and adds it to your garage as a collectible card with your photo, a serial number, a rarity tier and the car's specs: power, top speed, 0-100 and weight. If the angle isn't good enough to tell the regular model from the track version, it says so instead of guessing.

RARITY DEPENDS ON WHERE YOU ARE
A Porsche 911 is everywhere in Stuttgart and a rare sight in plenty of other places. Apex looks at what people near you have actually been spotting, so the same car can be Common in one city and Legendary in another. Cards go from Common up to Mythic, and the rarer the find, the more XP you get.

HUNTS
Found something Uncommon or better? Start a five-minute hunt. Players nearby get an alert, and whoever gets there first and scans the car themselves wins bonus XP.

YOU DECIDE WHAT PEOPLE SEE
Every post has its own location setting. Show the exact spot with a 15 minute delay (so the car has usually left), show a rough area, or hide it completely.

ALSO IN THERE
- Leaderboards for your city, your country, your friends and the whole world
- Daily quests and streaks
- A map of recent sightings near you
- A feed for your best finds, with comments and direct messages
- Share any card as a story image

Apex is an independent fan project. It isn't affiliated with or endorsed by any car manufacturer, and brand names are used only to identify vehicles.

Questions, bugs, or a car it got wrong: support@apexspotter.app
Privacy Policy: https://apexspotter.app/privacy
Terms of Service: https://apexspotter.app/terms
```

---

## 3. Verification Matrix Against Shipped Code

| Store Listing Claim | Shipped Code Verification | Status |
|---|---|---|
| *"Adds it to your garage as a collectible card"* | `src/store/useApexStore.ts` (`onScanCompleted`, `addCardToGarage`) | ✅ Verified |
| *"If the angle isn't good enough... says so instead of guessing"* | `src/ai-engine/v2/stageC_constrainedAdjudicator.ts` (Viewpoint gating & pairwise discrimination with `uncertain` status) | ✅ Verified |
| *"Rarity depends on where you are... Common in one city and Legendary in another"* | `src/utils/localRarityEngine.ts`, `record_car_scan` Bayesian Dirichlet shrinkage | ✅ Verified |
| *"Cards go from Common up to Mythic"* | `RarityTier` enum: `common`, `uncommon`, `rare`, `epic`, `legendary`, `mythic` in `src/types/apex.ts` | ✅ Verified |
| *"5-minute hunt... players nearby get an alert"* | `src/components/hunts/HuntScreen.tsx`, `useApexStore.triggerMockHunt` | ✅ Verified |
| *"Three location settings: exact 15m delay, rough area, or hidden"* | `src/types/apex.ts` (`LocationPrivacyLevel`: `public_exact_delayed`, `public_blurred`, `private_hidden`) and `src/components/social/MediaPostComposerModal.tsx` | ✅ Verified |
| *"Leaderboards for city, country, friends, world"* | `src/components/ranks/RanksScreen.tsx` (City, Global, Friends tabs) | ✅ Verified |
| *"Daily quests and streaks"* | `src/utils/questEngine.ts`, `src/utils/streak.ts`, `QuestsScreen.tsx` | ✅ Verified |
| *"Map of recent sightings near you"* | `src/components/map/MapScreen.tsx` (Leaflet basemap with rarity pins) | ✅ Verified |
| *"Share any card as story image"* | `src/components/garage/Card3DDetail.tsx` (Share card / canvas export) | ✅ Verified |
| *"Independent fan project disclaimer"* | Preserved verbatim in `docs/store/LISTING.md` and in-app legal footer | ✅ Verified |
