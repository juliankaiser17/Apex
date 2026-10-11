# APEX Google Play Store Asset Specifications & Creative Briefs

**Document Status**: Official Release Asset Specification (Track U Phase 10 / Track S S6)  
**Date**: October 11, 2026  
**Standards**: Google Play Console Asset Specifications & Material Design Iconography  

---

## 1. Funnel Order Screenshots (1080 × 2400 Portrait)

All 6 screenshots were captured directly from the live application running in local fixture mode (zero backend calls, zero external data leaks, 100% tokenized typography and surfaces).

Saved locations:
- `docs/store/screenshots/`
- `docs/ui-redesign/after/`

| Funnel Position | Asset Filename | Subject & Value Proposition | Visual Composition |
|---|---|---|---|
| **1 (Hero Hook)** | `1_legendary_card_reveal.png` | **Instant AI Recognition & Rarity** | Ferrari Daytona SP3 collectible card reveal with glowing Legendary Gold border, 840 HP verified specs, and "Save to Garage (Cloud Confirmed)" CTA. |
| **2 (Core Loop)** | `2_scanner_locked_on_car.png` | **Precision Neural Vision HUD** | Rangefinder brackets and circular aperture ring locked on a supercar in the wild. Real-time telemetry: `35MM // F2.8 // TARGET LOCK 14M`. |
| **3 (Innovation)** | `3_one_car_two_cities_rarity.png` | **Local Rarity Dynamic Engine** | Dual comparison showing Porsche 911 GT3 RS: Rare (1.00x) in Stuttgart vs. Legendary (+45% Local XP Bonus) in Mumbai based on real registry census. |
| **4 (Urgency)** | `4_hunt_alert_active.png` | **Real-Time Neighborhood Radar** | Sector Radar Alert for a McLaren P1 Longtail spotted nearby. Active 04:22 countdown timer and "Join Live Radar Hunt" CTA. |
| **5 (Progression)** | `5_populated_garage.png` | **Prestigious Vehicle Collection** | Redesigned 6-slot masonry collector garage: McLaren P1, Daytona SP3, GT3 RS, Chiron, Carrera S, Supra. Total horsepower and collector level strip. |
| **6 (Trust)** | `6_location_privacy_sheet.png` | **Uncompromising User Privacy** | High-contrast dark basemap with 3-option Privacy Sheet: Exact Pinpoint, 1km Blurred Zone (Active), and Ghost Mode. |

---

## 2. App Icon Specification & Creative Brief

### Technical Requirements
- **Dimensions**: 512 × 512 px (Play Store listing icon), 108 × 108 dp (Android Adaptive Icon).
- **Format**: 32-bit PNG with alpha channel.
- **Max File Size**: 1024 kB.
- **Color Profile**: sRGB.

### Adaptive Mask & Safe Zone Guidelines
- **Outer Canvas**: 512 × 512 px.
- **Safe Zone (Central 66%)**: 340 × 340 px circle centered on the canvas.
- **Critical Graphic Placement**: All key geometric lines and the primary mark MUST sit strictly within the inner 340 px circle to guarantee zero clipping across Google's adaptive icon masks (squircle, circle, rounded rectangle, teardrop).
- **Scale Legibility**: The icon mark must remain immediately distinct and identifiable when rendered down to **48 × 48 px** on low-density Android home screens.

### Design Elements & Palette
- **Mark**: A bold, razor-sharp geometric monogram representing the letter **"A"** merged with the apex curve of a race track.
- **Background Layer**: Cool Graphite `#0A0C10` (`--color-void`) with subtle diagonal hairline carbon-weave texture (opacity 0.08).
- **Foreground Mark**: Apex Red `#E50914` (`--color-accent`) with subtle specular bevel highlight along the upper leading edge (`rgba(255, 255, 255, 0.25)`).
- **No drop shadows or 3D extrusions** outside the mark: Google Play applies drop shadows programmatically on Android 12+.

---

## 3. Feature Graphic Specification & Creative Brief

### Technical Requirements
- **Dimensions**: 1024 × 500 px (Landscape).
- **Format**: JPEG or 24-bit PNG (no alpha).
- **Max File Size**: 15 MB.
- **Color Profile**: sRGB.

### Visual Composition & Framing
- **Subject**: A dramatic, low-angle perspective of an exotic supercar at night under slick wet asphalt reflections with atmospheric neon road lighting.
- **Branding**:
  - Top-Left: Clean minimalist wordmark `APEX` in **Big Shoulders Display** Bold (White `#F4F6F8`).
  - Below Wordmark: The authentic in-game **LEGENDARY** stamp in semantic gold (`#F2B33D`) with hairline border. **Do NOT use generic gold 5-star ratings or arcade stamps**.
  - Tagline: `EVERY STREET IS A TRACK` in JetBrains Mono (`#8A929E`, 11px uppercase).
- **Safe Zone & Central Clearance**:
  - The central horizontal band (30% to 70% width) must remain clear of critical copy or logos to accommodate Google Play promotional overlays, video play buttons, and localized text cutoffs.
  - No text within 40 px of any border.

---

## 4. Verification & Production Readiness
- [x] All 6 Play Store screenshots generated at native Android high-DPI resolution.
- [x] Local fixtures adhere to real, verified registry vehicle specs (zero placeholder lorem ipsum).
- [x] Adaptive icon brief enforces 66% central safe zone and 48px micro-legibility.
- [x] Feature graphic brief adheres to Google Play promotional cropping guidelines.
