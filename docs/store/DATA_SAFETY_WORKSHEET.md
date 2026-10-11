# Google Play Console: Data Safety Form Worksheet

**Application**: Apex: Supercar Spotter  
**Package Name**: `com.apex.spotter`  
**Last Verified**: October 11, 2026  
**Status**: Aligned with Technical Audit (`DATA_FLOW_AUDIT.md`) and Privacy Policy (`PRIVACY_POLICY_DRAFT.md`)

---

## 1. High-Level Summary Questions

| Question | Answer | Rationale |
|---|---|---|
| **Does your app collect or share any of the required user data types?** | **Yes** | Collects user email, location, photos, and user identifiers. |
| **Is all user data collected by your app encrypted in transit?** | **Yes** | All network communications use TLS 1.3 / HTTPS. Zero cleartext traffic. |
| **Do you provide a way for users to request that their data be deleted?** | **Yes** | In-app deletion button (`ProfileSettingsModal.tsx`) and public URL (`/account-deletion`). |
| **Does your app collect data from children under 13?** | **No** | Target audience is Teen & Adult (13+). |
| **Has your app committed to follow the Play Families Policy?** | **No** | App is not designed for children under 13. |

---

## 2. Data Types Detailed Declaration

### A. Location

| Data Subtype | Collected? | Shared? | Purpose | Optional / Required | Encrypted in Transit? | Deletable? |
|---|---|---|---|---|---|---|
| **Approximate Location** | Yes | Yes (with user consent) | App functionality, Personalization (Local Rarity) | Optional (can use manual city) | Yes | Yes |
| **Precise Location** | Yes | Yes (if user selects 15m delay tier) | App functionality (vehicle spot coordinates) | Optional | Yes | Yes |

*Note on sharing*: Shared only with other app users if the user explicitly posts the card with public visibility; never shared with third-party advertisers or data brokers.

---

### B. Personal Info

| Data Subtype | Collected? | Shared? | Purpose | Optional / Required | Encrypted in Transit? | Deletable? |
|---|---|---|---|---|---|---|
| **Name / Username** | Yes | Yes (on public posts & leaderboards) | Account management, App functionality | Required (username) | Yes | Yes |
| **Email Address** | Yes | No (never shared) | Account management (Auth via Google/OTP) | Required | Yes | Yes |
| **User IDs** | Yes | No (internal UUIDs) | Account management, Database indexing | Required | Yes | Yes |

---

### C. Photos and Videos

| Data Subtype | Collected? | Shared? | Purpose | Optional / Required | Encrypted in Transit? | Deletable? |
|---|---|---|---|---|---|---|
| **Photos** | Yes | Yes (if posted to community feed) | App functionality (Car recognition & garage collection) | Optional (required to scan cars) | Yes | Yes |

*Note*: Photos are processed by Google Gemini and Cloudflare for inference under terms where customer data is **not retained for model training**.

---

### D. Messages

| Data Subtype | Collected? | Shared? | Purpose | Optional / Required | Encrypted in Transit? | Deletable? |
|---|---|---|---|---|---|---|
| **Emails** | No | No | N/A | N/A | N/A | N/A |
| **SMS/MMS** | No | No | N/A | N/A | N/A | N/A |
| **Other In-App Messages** | Yes | Yes (sent to peer friend) | App functionality (Direct messages between friends) | Optional | Yes | Yes |

---

### E. Actions & UGC

| Data Subtype | Collected? | Shared? | Purpose | Optional / Required | Encrypted in Transit? | Deletable? |
|---|---|---|---|---|---|---|
| **User-generated content** | Yes | Yes | Feed post captions, comments on sightings | Optional | Yes | Yes |

---

### F. Device & App Performance (Diagnostics)

| Data Subtype | Collected? | Shared? | Purpose | Optional / Required | Encrypted in Transit? | Deletable? |
|---|---|---|---|---|---|---|
| **Crash Logs** | Yes | No | Analytics / Diagnostics (neutral local reporter) | Optional | Yes | Yes |
| **Performance Diagnostics** | Yes | No | App functionality (Camera frame latency) | Optional | Yes | Yes |
| **Device or other IDs** | No | No | **None collected** (No advertising ID, IMEI, or hardware serials) | N/A | N/A | N/A |

---

## 3. Play Store Questionnaire Direct Copy-Paste Guide

When completing the Google Play Console form:
1. Under **Location**, check:
   - "Approximate location" $\rightarrow$ Collected, Shared (app users), Ephemeral: No, Optional: Yes.
   - "Precise location" $\rightarrow$ Collected, Shared (app users), Ephemeral: No, Optional: Yes.
2. Under **Personal info**, check:
   - "Name" $\rightarrow$ Collected, Shared (public leaderboard), Optional: No.
   - "Email address" $\rightarrow$ Collected, NOT shared, Optional: No.
   - "User IDs" $\rightarrow$ Collected, NOT shared, Optional: No.
3. Under **Photos and videos**, check:
   - "Photos" $\rightarrow$ Collected, Shared (if user publishes to feed), Optional: Yes.
4. Under **Messages**, check:
   - "Other in-app messages" $\rightarrow$ Collected, Shared (transferred between sender and recipient), Optional: Yes.
5. Under **App info and performance**, check:
   - "Crash logs" $\rightarrow$ Collected, NOT shared, Optional: Yes.
