# Google Play Compliance: Account Deletion Specification

**Application**: Apex: Supercar Spotter  
**Package Name**: `com.apex.spotter`  
**Google Play Requirement**: As of 2024, apps that allow account creation must provide a public, web-accessible URL where users can request account and associated data deletion without reinstalling the app.  
**Public URL**: `https://apexspotter.app/account-deletion` (`TODO(owner)`)  
**Static HTML Template**: `public/account-deletion.html`

---

## 1. Compliance Requirements Checklist

- [x] **Web-Accessible URL**: Publicly hosted web page reachable from any desktop or mobile browser.
- [x] **No App Reinstallation Required**: Users who have already uninstalled the app must be able to submit their deletion request via web.
- [x] **Clear Data Scope**: Explains exactly what data is deleted immediately, what is permanently purged, and what is retained for legal/tax compliance.
- [x] **Retention Window**: Outlines the 30-day maximum processing window.
- [x] **In-App Parity**: Matches the in-app deletion behavior in `ProfileSettingsModal.tsx`.

---

## 2. In-App vs Web Deletion Mechanism

### In-App Deletion Flow (Self-Service)
1. User opens **Profile** tab $\rightarrow$ taps **Settings (Gear Icon)**.
2. Scrolls to danger zone $\rightarrow$ taps **Delete Account**.
3. Confirms prompt: *"Are you sure? This permanently deletes your garage, cards, XP, and rank."*
4. App executes `deleteAccount()`:
   - Calls backend `/api/account/delete` with active JWT bearer token.
   - Invokes PostgreSQL RPC `delete_user_account` which deletes the `auth.users` row, cascading to `profiles`, `garage`, `posts`, `comments`, `scan_receipts`, and deletes uploaded images from Supabase Storage.
   - Purges all local storage keys (`apex_user`, `apex_user_garage`, `apex_daily_quests`).
   - Signs out session and returns user to fresh onboarding splash.

### Web Deletion Flow (Web-Accessible)
1. User visits `https://apexspotter.app/account-deletion`.
2. User provides their registered email address (or authenticates via Google OAuth).
3. The server dispatches a one-time verification link / confirmation email.
4. Upon clicking the confirmation link, the backend schedules the user UUID for deletion.
5. All associated database records and photo blobs are purged.

---

## 3. Data Deletion Scope

### Data Permanently Deleted:
- **Authentication**: Email address, Google ID, hashed passwords, session refresh tokens.
- **Profile**: Username, display name, avatar, bio, total spots count, level, XP, badges.
- **Garage & Cards**: All minted vehicle cards, serial numbers, custom captions.
- **Media**: All raw photos stored in Supabase Storage (`car-photos` bucket).
- **Social**: Community feed posts, post likes, post comments, direct messages, friend connections.
- **Quests & Streaks**: Active streak counters, daily quest history.

### Data Retained (Lawful Exceptions):
- **Aggregated Anonymized Sightings**: High-level statistical observation counts (e.g., "A Porsche 911 was spotted in Zurich in 2026") stripped of user IDs, timestamps, and photos to preserve integrity of regional Bayesian rarity indexes.
- **Security Audit Logs**: Rate limit violation and abuse reports retained for 90 days for fraud prevention.
