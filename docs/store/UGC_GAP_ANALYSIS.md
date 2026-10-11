# User-Generated Content (UGC) Readiness & Moderation Gap Analysis

**Application**: Apex: Supercar Spotter  
**Date**: October 11, 2026  
**Audited Against**: Google Play UGC Policy, COPPA, IARC Guidelines  

---

## 1. Moderation Architecture Gap Analysis

| Requirement (Google Play UGC Policy) | Shipped Implementation (Lane 1) | Lane 2 Backend State | Gap Status | Action Required |
|---|---|---|---|---|
| **In-app reporting mechanism for posts** | `PaperThrowFeed.tsx` flag icon opens `ModerationModal.tsx` | Stored in client `localStorage` | ⚠️ Partially Complete | Apply Lane 2 proposal `content_reports` table migration |
| **In-app reporting mechanism for comments** | `CommentsModal.tsx` flag button | Stored in client `localStorage` | ⚠️ Partially Complete | Apply Lane 2 proposal `content_reports` table migration |
| **In-app user blocking** | `ModerationModal.tsx` block button; purges posts immediately from feed | Ephemeral in Zustand store memory | ⚠️ Partially Complete | Apply Lane 2 proposal `user_blocks` table migration |
| **Clear Terms of Use regarding abusive UGC** | Drafted in Section 2 below | Ready for public hosting | ✅ Resolved | Host Terms on public website (`apexspotter.app/terms`) |
| **24-hour review / takedown SLA** | Client report storage | Pending admin dashboard | ⚠️ Operational Gap | Owner must configure admin email hook or Supabase Studio alert |
| **Automated profanity / offensive filter** | Regex client filter on captions | Pending PostgreSQL text filter | ✅ Compliant for Launch | Enhance with server-side check |

---

## 2. Draft Terms of Use: User-Generated Content Clause

```text
TERMS OF SERVICE — USER-GENERATED CONTENT (UGC)

1. Scope of User Content
Apex allows users to upload vehicle photographs, write captions, post comments, and initiate timed sighting hunts ("User Content"). By submitting User Content to Apex, you represent and warrant that you hold all necessary rights or permissions to publish such material.

2. Zero-Tolerance Policy for Objectionable Content
Apex maintains a strict zero-tolerance policy against abusive, harmful, or objectionable content. You agree not to upload, broadcast, or share any User Content that:
- Contains sexually explicit, obscene, or pornographic material.
- Promotes violence, harassment, hate speech, defamation, or discrimination.
- Depicts illegal street racing, reckless endangerment, or criminal acts.
- Infringes copyright, trademark, or intellectual property rights.
- Promotes doxxing, stalking, or private residential property trespassing.

3. Reporting and Enforcement
Users may report any objectionable post or comment using the in-app "Report" flag button. Apex reserves the right, in its sole discretion, to remove any User Content, restrict features, or permanently terminate accounts that violate these terms within 24 hours of notification.

4. User Blocking
You may block any user at any time using the "Block User" option. Blocking immediately hides their posts, comments, and profile from your account.

5. Content License
You retain ownership of your photos. By posting content publicly on Apex, you grant Apex a non-exclusive, worldwide, royalty-free license to display, optimize, and distribute your post within the app feed, leaderboards, and promotional social channels.
```

---

## 3. IARC / Google Play Content Rating Questionnaire Draft Answers

When completing the Google Play IARC questionnaire for Apex:

| Questionnaire Category | Question | Proposed Answer | Justification |
|---|---|---|---|
| **Category** | App Type | **Social / Utility / Automotive** | Enthusiast vehicle spotter with community feed. |
| **Violence** | Does the app contain violent material? | **No** | Spotting cars contains zero violence. |
| **Sexuality** | Does the app depict nudity or sexual content? | **No** | Zero adult content permitted. |
| **Language** | Does the app contain profanity or crude humor? | **No** | Client text filters restrict profanity. |
| **Controlled Substances**| Does the app reference alcohol, tobacco, or drugs? | **No** | Strictly focused on vehicle mechanics & styling. |
| **User Interaction** | Does the app allow users to interact or exchange content? | **Yes** | Users can share car photos, comment, and direct message friends. |
| **Location Sharing** | Does the app share the user's physical location with other users? | **Yes** | Disclosed: Users can share vehicle spot locations with 15-minute delay or coarse neighborhood area. |
| **Digital Purchases** | Does the app allow users to purchase digital goods? | **No** | Zero in-app purchases in current launch build. |
| **Expected IARC Rating** | Global Result | **Teen (US) / PEGI 12 (Europe) / 12+** | Driven by user interactions and optional location sharing. |
