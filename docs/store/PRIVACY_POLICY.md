# Apex Privacy Policy

**Last updated:** 24 October 2026  
**Applies to:** Apex, including the Android app, its backend, maps, vehicle-scanning features, social feed, and hunts (together, the “Service”).

Apex helps people identify vehicles, record sightings, explore maps, and take part in community hunts. This policy explains, in plain language, what information the Service handles, why it handles it, when information may be visible to other users, and the choices available to you.

> **Publisher details:** Apex is operated by **Rainz Group** (“Apex”, “we”, “us”). Privacy contact: **group.rainz@gmail.com**. Business/contact address: **Lucknow, Uttar Pradesh, 226020, India**. Account-deletion instructions: **https://apex-spotter.vercel.app/account-deletion.html**.

## 1. The short version

- When you scan a car, the image and information needed to process the scan are sent to Apex’s backend and its configured vehicle-recognition provider(s). A scan is not the same as a private on-device-only analysis.
- If you grant location permission, Apex can use your device location for location-dependent features such as centring the map, finding nearby activity, and attaching a location to a sighting or hunt where you choose to do so.
- Information you choose to publish—such as a profile, post, vehicle photo, caption, or hunt—may be visible to other Apex users according to the feature’s visibility. Do not assume shared content is private.
- We use infrastructure and service providers to operate the Service. Depending on the production configuration, these include Supabase, Vercel, Cloudflare, and Google’s Gemini API. These providers may process information on our behalf or under their own terms.
- You can ask for access, correction, or deletion of your information through **group.rainz@gmail.com** and request account deletion at **https://apex-spotter.vercel.app/account-deletion.html**. The in-app deletion route is also available under Profile Settings.

## 2. Information we collect or receive

The exact information involved depends on the features you use, the permissions you grant, and the production services enabled in the version of Apex you use.

### 2.1 Account and profile information

If you create or sign in to an account, we may process an internal account identifier, username, display name, email address, profile image, authentication-provider identifier, and account settings. If you use Google sign-in, Google and the authentication service may provide the information needed to authenticate you, subject to the sign-in screen and the permissions you approve. We do not receive your Google password through a normal Google sign-in flow.

Some basic features may be available without an account. Information generated in guest mode may be stored on your device or sent to the Service when needed for the feature. Do not assume guest activity is anonymous if it results in a server request, a published post, or a scan.

### 2.2 Vehicle scans and images

When you deliberately submit a photo for vehicle identification, the image, the scan request, and relevant technical instructions are sent through Apex’s backend to the vehicle-recognition provider configured for that request. The Service receives an estimated vehicle identification and may also process information such as the scan time, result, confidence or diagnostic status, and optional location associated with the scan.

A photo can contain more than a car. It may also show faces, licence plates, bystanders, house numbers, private property, or other information. Please frame scans carefully and avoid submitting sensitive personal information. Do not submit an image of someone else in a way that violates their privacy or rights.

Apex does not claim that every scan is correct. The image and result may be processed by third-party AI infrastructure, as described in Section 5.

### 2.3 Location information

If you grant device-location permission, Apex may receive approximate or precise location data from your device. Location may be used to:

- centre or update a map;
- show local sightings, nearby activity, or hunt-related information;
- associate a scan, post, or hunt with a place when that feature is used; and
- support location-related functions you request.

Location permission is controlled through your device settings. If you deny it, some map or local features may be limited. A location you attach to content that you publish may be visible to other users. Before publishing a hunt or location-tagged post, review what its map pin or other location information reveals.

Apex is intended to use device location for user-facing features while the app is in use, not to continuously track people in the background. Apex does not request background location permissions (`ACCESS_BACKGROUND_LOCATION`).

### 2.4 Content you create or share

Depending on the features enabled, we may process the username and profile information associated with your account, posts, captions, photos, vehicle sightings, hunt details, map pins, records, leaderboard entries, and related interactions. Content you submit to a public or community feature may be shown to other users. We use this information to display and operate those features, prevent abuse, resolve reports, and enforce the Terms of Use.

### 2.5 Technical and diagnostic information

When the app connects to our backend or a provider, the request may generate technical records such as an IP address, request timestamp, app version, operating-system or device information, response status, error details, and service-usage metadata. These records help deliver requests, secure the Service, investigate failures, prevent abuse, and manage reliability and cost.

### 2.6 Information we do not ask you to provide

Apex is not designed to ask for your contacts, call history, text messages, financial account credentials, or government identity documents for ordinary vehicle-spotting features. If a future version introduces a feature that needs additional categories of personal information, this policy and any required in-app disclosure will be updated before that feature is enabled.

## 3. Why we use information

We use information only for purposes connected to operating, protecting, and improving the Service, including:

- authenticating accounts and maintaining profile settings;
- analysing a user-submitted vehicle photo and returning an identification estimate;
- showing maps, local sightings, and hunts when requested;
- displaying posts, profiles, sightings, leaderboards, and other community features;
- saving a user's requested records or preferences;
- maintaining reliability, diagnosing failures, preventing fraud and abuse, and protecting the Service;
- responding to support, privacy, safety, and legal requests; and
- complying with applicable law and enforcing the Terms of Use.

We do not use precise GPS location to create advertising profiles. Apex does not include third-party advertising networks or tracking SDKs.

## 4. When information is shared

We do not sell personal information for money. We share information only as needed for the purposes described below, subject to applicable law and the settings of the feature you use.

### 4.1 With other Apex users

Information you place in a public or community feature—such as a profile name, post, photo, vehicle sighting, leaderboard entry, or hunt—may be visible to other Apex users. The exact audience depends on the feature and its current settings. A recipient may take screenshots or make a copy of content. Deleting a post from Apex cannot erase copies another person has already made.

### 4.2 With service providers

The current known technical stack includes the following providers:

| Provider | Why it may receive information |
|---|---|
| **Supabase** | Account authentication and PostgreSQL database storage for Apex. It processes account identifiers, profile information, posts, hunts, scan records, and user preferences. |
| **Vercel** | Hosting Apex’s serverless backend API. Requests generate IP-address, timestamp, diagnostic, and service logs. |
| **Cloudflare** | DNS, proxy, API protection, and network security for API endpoints. Processes request metadata and protects against DDoS attacks. |
| **Google Gemini API** | Server-side vehicle-image analysis for scan requests routed to Gemini. Under Google Cloud enterprise terms, customer data submitted via the API is not used to train foundation models. |
| **Google Sign-In** | Authenticates users who choose Google authentication. Receives authentication tokens under Google's applicable terms. |
| **OpenStreetMap** | Displays map tiles for local vehicle sightings and hunts. The map tile servers receive IP addresses and requested map tile coordinates. |

### 4.3 For legal, safety, or business reasons

We may disclose information when reasonably necessary to comply with law, a valid legal process, protect users or the public, investigate abuse, enforce our terms, or protect the rights and security of Apex and others. If Apex is reorganised, acquired, or transferred, relevant information may be transferred as part of that transaction, subject to applicable law and appropriate safeguards.

## 5. International processing

Our service providers may process information in countries other than the country where you live (including the United States and the European Union). Those countries may have different data-protection laws. We select established enterprise providers (Google Cloud, Supabase, Vercel, Cloudflare) that enforce standard contractual clauses and TLS encryption to safeguard data in transit and at rest.

## 6. How long we keep information

We keep information only for as long as reasonably needed for the purpose for which it was collected, including to operate features, maintain account records, address disputes, protect the Service, and comply with law:

- **Account and profile data:** while the account is active, until the user requests deletion via the app or web portal.
- **Posts, hunts, and other shared content:** while it remains available in the Service or until deleted or removed under the Terms of Use.
- **Scan images and results:** temporary ephemeral processing to return the vehicle card; scan cards saved by the user are stored in their personal garage until deleted.
- **Security and diagnostic logs:** maintained in provider infrastructure (Vercel/Cloudflare) for standard diagnostic retention windows (typically 7–30 days) solely for operational stability and abuse prevention.
- **Privacy or support correspondence:** retained as needed to address and resolve the request.

When account deletion is requested, personal data associated with the account is purged within 30 days.

## 7. Your choices and rights

Depending on where you live and the law that applies, you may be able to request access to, correction of, or deletion of personal information, withdraw a permission or consent, or raise a complaint with a relevant authority.

You can:

- manage device-location permission in Android settings;
- choose whether to submit an image for a scan;
- decide what content or location you publish in community features;
- request correction or deletion by contacting **group.rainz@gmail.com**; and
- request account deletion at **https://apex-spotter.vercel.app/account-deletion.html** or through the in-app option under *Profile &rarr; Settings*.

## 8. Security

We use reasonable technical and organisational safeguards, including HTTPS/TLS 1.3 encryption in transit, server-side API key isolation (keys are never bundled in the Android client APK), and PostgreSQL Row-Level Security (RLS) on our database.

No app, network, or storage system can be guaranteed completely secure. If a security incident affects personal information, we will take steps required by applicable law and the circumstances of the incident.

## 9. Children and age restrictions

Apex is intended for users aged 13 and older (Teen / Adult). We do not knowingly collect personal information from children under 13.

If you believe a child under 13 has submitted personal information contrary to Apex’s eligibility rules, contact **group.rainz@gmail.com**. We will assess and promptly delete such information.

## 10. Third-party services and links

Apex relies on sign-in, map, hosting, database, AI, and app-distribution services operated by others. Those services have their own terms and privacy policies. This policy explains Apex’s handling of information; it does not replace a provider’s terms.

## 11. Changes to this policy

We may update this policy when the Service, providers, law, or our data practices change. We will update the “Last updated” date and provide notice in the app when a material change takes effect.

## 12. Contact and complaints

For privacy questions, access/correction/deletion requests, or complaints, contact:

**Apex Privacy Contact**  
Operator: **Rainz Group**  
Email: **group.rainz@gmail.com**  
Address: **Lucknow, Uttar Pradesh, 226020, India**  
External account-deletion route: **https://apex-spotter.vercel.app/account-deletion.html**
