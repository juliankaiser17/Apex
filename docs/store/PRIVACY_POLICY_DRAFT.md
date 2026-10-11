# Privacy Policy for Apex

**Effective Date**: October 11, 2026  
**Last Updated**: October 11, 2026  
**Application**: Apex: Supercar Spotter  
**Legal Entity**: `TODO(owner: Insert Legal Entity Name or Independent Developer Name)`  
**Contact**: `privacy@apexspotter.app` (`TODO(owner)`)  

---

## 1. Introduction

Apex ("we," "our," or "us") provides the Apex: Supercar Spotter mobile application. This Privacy Policy describes how we collect, use, disclose, and protect personal information when you use our mobile application and related online services.

We design Apex to help enthusiasts celebrate supercars while maintaining strict control over personal location privacy and media.

---

## 2. Information We Collect

### A. Information You Provide
- **Account Credentials**: When registering or signing in via Google Sign-In or email, we collect your email address, unique account identifier, display name, and avatar image.
- **User-Generated Content**: Vehicle photos captured with your device camera, captions, comments, and direct messages sent to friends.

### B. Information Collected Automatically
- **Location Information**: When you scan a vehicle or view the map, we collect geographic coordinates (latitude and longitude) with your permission. You have granular control over how location is displayed using our Three-Tier Location Privacy Settings.
- **Device & Connection Diagnostics**: Technical telemetry necessary for operational reliability, including device model, operating system version, and anonymous crash stack traces.
- **Play Integrity Data**: Ephemeral tokens provided by Google Play Integrity to verify app authenticity and prevent bot abuse.

---

## 3. How We Use Your Information

We use the information collected solely for the following purposes:
1. **Vehicle Identification & Card Minting**: Processing captured vehicle photos through our AI vision engine to recognize make, model, trim, and engineering specs.
2. **Local Rarity Engine**: Computing aggregate sighting prevalence within geographical regions so rarity reflects real local sightings.
3. **Community & Social Interaction**: Displaying your public cards on the community feed, leaderboards, and facilitating 5-minute timed hunts.
4. **Account & Service Security**: Authenticating sessions, preventing unauthorized access, and enforcing terms of service.

---

## 4. Location Privacy: You Decide What Others See

We recognize that automotive location data can be sensitive. Apex provides three user-controlled location settings for every post:
- **Public with 15-Minute Delay**: Shows the spot location on the community map only after a 15-minute delay (ensuring the vehicle has departed).
- **Approximate / Coarse (Default)**: Obfuscates coordinates to a general ~1.5 km neighborhood area or city name.
- **Hidden / Private**: Omits location entirely from community maps; visible only in your private garage.

We do NOT request or collect background location data. Location is accessed only while the application is active on screen.

---

## 5. Photo Privacy, Faces & License Plates

When photographing supercars in public spaces, photos may incidentally capture license plates or bystanders.
- **Public Posts**: We encourage users to photograph vehicles without capturing faces or personal identifiers. We are working toward automated client-side blurring of license plates and human faces.
- **Private Garage**: Photos stored in your private garage remain accessible only by your account.
- **AI Processing**: Photos submitted for vehicle recognition are processed by our vision service providers (Google Gemini and Cloudflare) under strict enterprise data protection terms. Customer inference images are **not used to train AI models**.

---

## 6. How Information is Shared

We do not sell, rent, or monetize your personal information to third-party data brokers or advertisers. We share information only with trusted service providers:
- **Database & Storage**: Supabase (AWS infrastructure) for secure database and encrypted image storage.
- **Vision Inference**: Google Cloud (Vertex AI / Gemini) and Cloudflare Workers AI for automated vehicle identification.
- **Hosting & CDN**: Vercel and Cloudflare for global content delivery.
- **Legal Compliance**: Where required by law, subpoena, or urgent safety request.

---

## 7. Data Retention and Account Deletion

- **Retention**: We retain personal account data for as long as your account is active.
- **Soft Deletion Holding Period**: Cards deleted from your garage are held in a 3-day recovery holding state before being permanently erased.
- **Full Account Deletion**: You can permanently delete your account at any time:
  - **In-App**: Go to Profile $\rightarrow$ Settings $\rightarrow$ "Delete Account".
  - **Web**: Submit a request via our public deletion page: `https://apexspotter.app/account-deletion` (`TODO(owner)`).
  - Upon deletion, your profile, authentication records, photos, comments, and garage cards are permanently purged from our databases and storage buckets within 30 days.

---

## 8. Children's Privacy

Apex is not directed to children under 13 years of age (or under 16 in the European Economic Area). We do not knowingly collect personal information from children under these ages. If we discover that a child has provided us with personal information, we will delete it immediately.

---

## 9. Your Rights (GDPR & CCPA/CPRA)

Depending on your jurisdiction, you have the right to:
- Access, review, and receive a portable copy of your personal data.
- Correct inaccurate or outdated information.
- Request erasure of your personal data ("Right to be Forgotten").
- Object to or restrict certain processing activities.

To exercise any of these rights, contact us at `privacy@apexspotter.app` (`TODO(owner)`).

---

## 10. Changes to This Policy

We may update this Privacy Policy from time to time. We will notify you of material changes by posting the new policy in the app and updating the "Effective Date" at the top.

---

*Note: This draft has been prepared by technical engineering and must be reviewed by the owner and legal counsel before publication (Gate G8).*
