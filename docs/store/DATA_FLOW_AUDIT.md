# Apex: Technical Data-Flow Audit

**Document Status**: Complete Codebase Audit  
**Author**: Antigravity Release Engineering  
**Date**: October 11, 2026  
**Audited Against**: Client Bundle, Android Config, Supabase Migrations, AI Engine  

---

## 1. Operating Permissions

| Permission | Android Manifest Identifier | Purpose in App | Optional or Required | When Requested |
|---|---|---|---|---|
| **Camera** | `android.permission.CAMERA` | Taking photos of vehicles for AI recognition and card minting. | Required for scanning; optional for browsing garage/feed. | On first tap of Scan Shutter Button. |
| **Precise Location** | `android.permission.ACCESS_FINE_LOCATION` | Geotagging spot city/country and local rarity calculations. | Optional (falls back to approximate or manual city). | When scanner is opened or map tab clicked. |
| **Approximate Location** | `android.permission.ACCESS_COARSE_LOCATION` | Regional city-level rarity calculation without precise coordinates. | Optional. | Handled jointly with Fine Location. |
| **Background Location** | *NONE* | **NOT REQUESTED**. Apex requests ZERO background location permissions. | N/A | Never requested. |
| **Notifications** | `android.permission.POST_NOTIFICATIONS` | Local hunt alerts, streak reminders, and quest resets. | Optional (user toggle in Android Settings). | Prompted after first successful scan. |

---

## 2. Account & Identity Data

- **Google Sign-In / OAuth**:
  - Collected: Google User ID (`sub`), Email address, Display Name, Profile picture URL.
  - Stored in: Supabase `auth.users` table.
  - Processors: Google Identity Services (OAuth exchange), Supabase (Auth management).
- **Email Sign-In (OTP)**:
  - Collected: Email address.
  - Used for: One-Time Password authentication token verification.
- **In-App Profile**:
  - Username (`profiles.username`), Persona/bio, Level, XP, Total spots count.
  - Publicly visible on community leaderboards and public post feeds.

---

## 3. Vehicle Photos & Media Pipeline

- **Client Capture**:
  - High-resolution frame captured via CameraX plugin or HTML5 canvas.
  - Converted to JPEG blob/data URI.
- **AI Processing (Inference)**:
  - Transmitted via HTTPS to AI backend (`/api/analyze` or Cloudflare Worker).
  - Providers:
    - **Google Gemini 3.5 Flash / 3.1 Flash-Lite** (Google Cloud Vertex AI / AI Studio): Image is passed for feature verification and bounding trim. Under Google Enterprise API terms, customer inference data is **not used to train models**.
    - **Cloudflare Workers AI**: Fallback embedding and visual feature extraction.
- **Storage**:
  - Retained in Supabase Storage bucket (`car-photos`).
  - Public read access via CDN URL if posted to Community Feed.
  - Private if card is kept in private garage without public sharing.
- **License Plate & Facial Privacy**:
  - Current status: User photos may capture background license plates or street pedestrians.
  - Recommendation: Implement client-side or edge automated bounding-box blurring on license plates and human faces before public feed publication.

---

## 4. Location Data & The 3 Privacy Tiers

Apex enforces three strict user-controlled location privacy tiers per post:

1. **Tier 1: Public with 15-Minute Delay (`public_exact_delayed`)**:
   - Exact latitude and longitude are recorded, but visibility is suppressed from live community feeds until 15 minutes post-sighting. This ensures the vehicle has departed the physical location before public broadcast.
2. **Tier 2: Coarse / Approximate (`public_blurred`)** *(Default)*:
   - Latitude and longitude are snapped to a random ~1.5 km centroid jitter or stripped to city/suburb name only. Exact coordinates are never transmitted to peer devices.
3. **Tier 3: Completely Private (`private_hidden`)**:
   - Coordinates are stripped entirely (`NULL` in database). Only displayed in the user's private Garage tab.

---

## 5. Social, Community & Hunt Features

- **Hunt Broadcasts (`activeHunts`)**:
  - Initiated when a user spots an Uncommon, Rare, Epic, Legendary, or Mythic car.
  - Broadcast contains vehicle model, rarity tier, and approximate 1km zone radius.
  - Expires automatically after 5 minutes.
- **Direct Messages & Comments**:
  - Stored in Supabase `comments` and `direct_messages` tables.
  - Restricted to authenticated peer participants via Row-Level Security (RLS).
- **Friends & Follows**:
  - Stored in `friends` table (bidirectional user relationships).

---

## 6. Telemetry, Analytics, Crash SDKs & Device Identifiers

- **Analytics SDKs**: **NONE**. Apex embeds zero third-party commercial analytics SDKs (no Google Analytics, Facebook SDK, AppsFlyer, or Adjust).
- **Crash Reporting**:
  - Shipped implementation: Neutral in-memory/local-storage crash boundary (`src/services/crashReporter.ts`).
  - Proposal (Gate G9): Vendor evaluation between Sentry and Firebase Crashlytics.
- **Device Identifiers**:
  - Android ID / IMEI: **NOT COLLECTED**.
  - Play Integrity: App check token passed during scan API verification to prevent headless bot abuse. Token is stateless and discarded post-verification.

---

## 7. Data Retention & Account Deletion

- **Card Soft Deletion**:
  - Deleted cards enter a 3-day recovery holding state in local cache, then permanently purged from `garage` and Supabase Storage.
- **Full Account Deletion**:
  - In-App: `ProfileSettingsModal.tsx` $\rightarrow$ "Delete Account".
  - Web: Public web deletion request page (`/account-deletion`).
  - Purge scope: Deletes user row from `auth.users`, cascades deletion across `profiles`, `garage`, `posts`, `comments`, `scan_receipts`, and invokes storage bucket deletion.

---

## 8. Third-Party Data Processors

| Processor | Role | Data Processed | Location / DPA |
|---|---|---|---|
| **Supabase Inc.** | Primary Database & Storage | Account data, garage cards, post photos, auth tokens | AWS US-East / EU (GDPR compliant) |
| **Google Cloud (Gemini)** | Vision Model Inference | Car photos (transient inference, zero training retention) | USA / Global PoPs |
| **Vercel Inc.** | Web & API Hosting | Ephemeral HTTP requests, edge API routing | Global Edge Network |
| **Cloudflare Inc.** | Image CDN & Workers AI | CDN cached photos, edge embeddings | Global Edge Network |
| **OpenStreetMap Foundation** | Map Basemap Tiles | IP address, tile request coordinates | UK / EU |

---

## 9. Regulatory & Age Ratings

- **Minimum Age**: 13 years old (COPPA / GDPR Article 8 compliance).
- **Parental Controls**: No in-app purchases or gambling mechanics currently enabled.
- **Owner Action Items (`TODO(owner)`)**:
  - `TODO(owner)`: Confirm corporate entity legal name and official contact address.
  - `TODO(owner)`: Select official DPO or privacy support email (`privacy@apexspotter.app`).
  - `TODO(owner)`: Review and approve Privacy Policy draft with qualified legal counsel (Gate G8).
