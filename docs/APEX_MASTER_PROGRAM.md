# APEX MASTER PROGRAM: stabilise, redesign, finish the AI, fix everything, and get ready to ship

Save this file as `docs/APEX_MASTER_PROGRAM.md` and read all of it before doing anything. It is the single source of truth. Sections 1 to 8 are the program. The appendices are the detailed specifications for each track. If an appendix conflicts with sections 1 to 8, sections 1 to 8 win.

Your first action is to write `docs/program/PLAN.md`: the tracks, the order you will do them in, how you will parallelise, and the risks you see. Then start.

---

## 1. Definition of done (release candidate)

All of these must be true, and each one must be backed by evidence (a test log, a screenshot, a logcat capture or a script output), not by an assertion:

1. The app opens reliably from a cold start on the worst and best devices in the test matrix, on Android and mobile web. No black or blank screen under any failure; failures show a readable recovery screen.
2. The client bundle contains no server-only code and no admin or developer tools. This is enforced by an automated check in CI.
3. The UI redesign in Appendix A is implemented.
4. The AI identification work in Appendix B is complete up to the owner gates, with every reported number traceable to a stored raw file, and the production stopgap in place behind a flag.
5. The functional audit in Appendix C passes. Every module does what it is for, not merely renders.
6. The store-readiness package in section 6 exists: release build instructions, listing text, privacy policy draft, data-safety worksheet, account-deletion page, content-policy gap list, and real screenshots from the final app.
7. A final report states what is done, what is partly done, what is blocked on an owner gate, and what could not be verified and why.

## 2. Known issues the program must resolve (priority order)

**P0 (blocks launch)**
- The black screen on launch. Root cause found: the server-only `sharp` module leaked into the client bundle (HeaderBar imported the admin AI Control Center modal, which imported the AI engine, and `vite.config.ts` had marked `sharp` as external, so a bare `import "sharp"` stayed in the bundle). A first fix is already in: browser stubs for `sharp` and `crypto`, a lazy-loaded modal, a boot splash and error screen in `index.html`, a 7 second watchdog, an 800 ms bound on `preloadAuthStorage()` in `main.tsx`, and a root error boundary. The fix needs review and hardening (Track R).
- The admin AI Control Center, the AI engine and developer tools such as "Reset development state" must not ship to users.
- Production scanning fails in practice: the Cloudflare free-tier quota (about 60 scans a day), about 9.4 seconds of median latency against a 10 second serverless limit, and an offline fallback that only runs when the device is offline. The stopgap is in Appendix B (13F).
- The pipeline confidently mislabels cars outside its catalogue (for example everyday cars called Camry). Appendix B (13A to 13D).

**P1**
- Quests showed progress while the Garage showed 0 vehicles and Profile showed 0 cars with 55 XP.
- XP rewards look inflated against level thresholds (Level 3 at 382 XP, single quests paying 1,500 to 1,800 XP).
- Seeded or invented content may appear in production ("Nearby Discoveries" showing Tokyo, Milan and LA to a user in Lucknow; invented feed posts).
- The report flow and the block-user feature may be missing or incomplete.
- The map may be using public OpenStreetMap tiles, which do not allow heavy production traffic.
- The only APK so far is a debug build. There is no signed release build.
- No crash reporting.
- Tier 1 registry specs need evidence-backed verification (Appendix B, 13G).

**P2**
- The UI redesign (Appendix A) and the copy, accessibility and performance work inside it.
- The boot splash and error screens still use the old red styling and must follow the new design tokens.

**P3**
- Store assets and the Play listing.

## 3. Operating rules (apply to every track)

1. **Read before you write.** Never restyle or fix from memory. Read the code first. Where this program describes what a recording or a report showed, verify it in the code.
2. **No destructive git.** No `git clean`, `git reset --hard`, forced checkout or force push. One commit per task group with a message that says what changed and why. Never overwrite `eval/golden/manifest.json`. Never open the test split (Gate G5).
3. **Progress file.** After every task, update `docs/program/PROGRESS.md`: done, running, blocked and why, next. This lets you resume after a context reset. Put every question for the owner in `OWNER_DECISIONS.md` with your recommendation and what it blocks, then keep working on everything that is not blocked.
4. **Evidence and honesty.** For every fix, record the reproduction (a failing test or exact steps), a short description of the change, and the verification output. Label every verification as one of: verified on a physical device, verified on an emulator, verified by automated tests only, or not verified. Never write "verified" for something you did not run. If you cannot test something (no device, no network access, no credentials), say so.
5. **Reporting integrity.** Every number in a report comes from a script reading stored raw files, with the file path and SHA-256 next to it. Estimates and projections are labelled as such. Never write a result by hand.
6. **Never hide a problem.** Do not stub, alias or externalise a module to make a build pass. A client file that imports server-only code must fail the build, and the fix is to remove the import.
7. **Change lanes.** Every change falls into one lane:
   - **Lane 1, client presentation and client-only logic:** fix it, with tests.
   - **Lane 2, authentication, backend (`api/**`, `supabase/**`), database and RLS, the economy ledger, XP and level math, server-side privacy logic, paid plans and production environment variables:** do not change. Write a proposal in `docs/proposals/` with the diff, tests and risk, and wait for the owner.
   - **Lane 3, the AI pipeline (`src/ai-engine/**` and AI-related API code):** change only inside Track A and under its rules.
8. **Secrets.** Never commit secrets. Scan the repository and the built bundle for secret patterns and report findings.
9. **Smoke tests after every merge:** authentication (Google sign-in, email OTP, session restore after an app restart, sign-out, sign back in) and scanning (a real car photo is sent, a result comes back, the card is saved, XP is awarded exactly once). Run on a physical device when one is available, otherwise on an emulator, and say which.
10. **Spend cap.** Keep AI provider spend under the cap in `OWNER_DECISIONS.md` (default 25 USD in total) and keep `docs/ai/COST_LOG.md` current. Ask before exceeding it.
11. **Do not stop between tasks.** Stop only at the gates in section 8, and even then keep working on everything unblocked.

## 4. Tracks, branches and order

| Track | Branch | Scope | May change | Must not change |
|---|---|---|---|---|
| R: stability and release engineering | `fix/stability` | Appendix none, section 5 | build config, boot code, bundle hygiene, CI, Android project config, docs | auth logic, backend, AI pipeline, game logic |
| A: AI identification | `ai/identification` | Appendix B | `src/ai-engine/**`, AI API code, eval, registry data | UI, auth, economy, database, privacy pipeline |
| U: UI redesign | `ui/redesign` | Appendix A | components, styles, tokens, copy, navigation structure | backend, AI pipeline, auth, store state shape |
| F: functional audit and bug-fix lane | `fix/functional` | Appendix C, section 6 | client-only bugs (Lane 1) | Lane 2 and Lane 3 areas |
| S: store readiness | `release/store-readiness` | section 7 | docs, store assets, static pages, Android release config | app behaviour |

Order: **R first** (everything else depends on a build that opens and a bundle that is clean). Then **A, U and F in parallel** using git worktrees (`git worktree add ../apex-<track> <branch>`), one sub-agent per track if sub-agents are available, otherwise one after another in the order A (analysis and experiments run long), U, F. Then **S**. Then integration (section 8b).

Each track keeps its own frozen-path list as `scripts/frozen-paths.<track>.txt` and its own `scripts/check-frozen.sh` run. Where an appendix mentions `scripts/frozen-paths.txt`, use the per-track file. Track U's frozen list includes the AI engine, the backend and the authentication code; Track A's includes the UI.

Shared files (tokens, global CSS, `index.html`, `vite.config.ts`, `main.tsx`) are touched by R first and by U afterwards. Merge R before U starts editing them, and resolve conflicts by hand.

## 5. Track R: stability and release engineering

**R1. Client bundle hygiene (the root cause, done properly)**
1. Remove the `sharp` and `crypto` alias stubs and any `rollupOptions.external` entry for server-only modules. Make the build fail loudly instead.
2. Fix the real import graph: client code must not import `src/ai-engine/**` server parts, `api/**`, or Node-only packages. Split shared types into a client-safe module.
3. The admin AI Control Center, the AI engine bindings, the load simulator and "Reset development state" must not be in production bundles at all. Gate them with a compile-time constant (for example `import.meta.env.VITE_ENABLE_ADMIN`) so the bundler removes them, then confirm by scanning `dist/` and `android/app/src/main/assets/public/` for the strings `AiControlCenter`, `sharp`, `workerPool`, `v2Pipeline` and `Reset development state`. A lazy chunk that still ships is not removal. If the owner needs admin tools in production, move them behind a server-verified role on a separate surface.
4. Write `scripts/check-client-bundle.mjs`, run it as part of `npm run build` and in CI. It fails on bare module specifiers in built JS, `require(` calls, `node:` imports, server-only package names, and secret patterns (`GEMINI_API_KEY`, `CLOUDFLARE`, service-role keys, and similar).
5. Add an ESLint boundary rule so client code cannot import server-only paths.
6. Check every client use of `crypto`. The earlier fix aliased `crypto` to a stub. If any client code relied on Node `crypto`, or on hashing and UUID generation for the image hash and the idempotency key, the stub can fail silently. Make sure those use Web Crypto (`crypto.subtle`, `crypto.randomUUID`) and prove it with a test and a real scan on a device.

**R2. Boot reliability (keep the safety net, fix its rough edges)**
1. Keep the instant boot splash, the pre-mount error interceptor, the root error boundary and the "ready" signal.
2. The 7 second watchdog is too eager for a cold start on a low-end phone. Make it staged: a calm "still starting" message first with no destructive options, and recovery actions only after about 20 seconds.
3. "Clear cache and restart" must not log the user out silently. It should ask for confirmation, say that it signs the user out, and keep auth data unless the user explicitly chooses otherwise.
4. Add a WebView compatibility check at startup. Tailwind v4 targets Chrome 111 and newer. If the WebView is older, show a friendly "Update Android System WebView" screen with the steps, instead of a broken page.
5. Record boot failures locally (no personal data) so a support request can include them.
6. Track U restyles the boot and error screens with the design tokens later; keep the logic and structure so it is only a styling change.

**R3. Audit the auth-adjacent changes**
1. `main.tsx` now bounds `preloadAuthStorage()` at 800 ms. On a slow device the preload can finish after the timeout, the auth client would start with empty storage, and a logged-in user would look logged out. Prove or disprove it with a test that delays native storage by 3 seconds and checks that a logged-in user stays logged in with no flash to a guest screen. If it can lose the session, change the boot sequence so React mounts the splash immediately and auth stays in its loading state until the preload actually completes, with a visible "taking longer than usual" message and a retry, and never proceeding with empty storage. This is boot structure in `main.tsx` (Lane 1) and must not change the auth listener.
2. A proposed `App.tsx` change forces `setIsAuthReady(true)` after 3.5 seconds while an OAuth callback is pending. Do not apply it. Marking auth ready mid-exchange can route a signing-in user as a guest and cause flicker or a wrong screen. Write a proposal (Lane 2, Gate G7) that shows "Finishing sign-in" with a retry after the timeout instead.

**R4. Android release engineering**
1. The only APK so far is `app-debug.apk`. Document and script a signed release build (AAB for Play, APK for sideload testing). The upload keystore is created and backed up by the owner and is never committed; the signing config reads from environment variables or untracked Gradle properties.
2. Release build settings: `versionCode` and `versionName` scheme, minification with the keep rules Capacitor and the plugins need, WebView debugging off, `usesCleartextTraffic` off with a network security config, `allowBackup` and data-extraction rules decided deliberately, no leftover debug logging.
3. Check Google Play's current target API level requirement and set `targetSdk` accordingly; the project currently names SDK 34 and 35, which may not be enough for new submissions.
4. Audit `AndroidManifest.xml`: remove unused permissions, review exported components, confirm no background-location permission is requested unless a feature truly needs it.
5. Confirm `capacitor.config.ts` has no `server.url` and that the splash configuration cannot hang.

**R5. CI and test gates**
Create a CI workflow (GitHub Actions or the equivalent) that runs install, typecheck, lint, unit tests, production build, `scripts/check-client-bundle.mjs`, the leakage checks, and the frozen-path check for the branch. Add a browser smoke test against the preview build (boots, mounts, no console errors) and an Android emulator boot test that launches the app and checks that the root marked itself as mounted.

**R6. Crash and error reporting**
Write a vendor-neutral error reporting interface used by the error boundary and the boot screens. Propose Sentry or Firebase Crashlytics in `docs/proposals/` with the privacy and Data Safety impact; do not add a vendor without the owner's choice (Gate G9). Document exactly what would be collected.

**R7. Performance baseline**
Measure and report (from scripts, with raw files): cold-start time to first paint on a low-end emulator profile and a physical device, the production bundle size by chunk, and the startup chunk. Lazy-load heavy modules that are not needed at startup (map, image cropping, canvas export, animation features). Preload only the display font. Set budgets and make CI fail if the startup bundle grows past them.

**R8. Security and privacy hardening (read-only where it touches Lane 2)**
Scan for secrets. Add a restrictive Content Security Policy that still works in the WebView. Write a read-only RLS test script that uses two test users and tries cross-user reads and writes on `garage`, `profiles`, `economy_ledger`, `posts` and `direct_messages`; report the results. Any needed policy change is a Lane 2 proposal.

**R9. Runbook**
Write `docs/program/RUNBOOK.md`: how to build, sync (`npx cap sync android`) and install; how to capture a launch error (a mobile-browser comparison with `npm run preview -- --host`, `adb logcat | Select-String "Capacitor|chromium|AndroidRuntime|Uncaught"`, and `chrome://inspect`); the checklist of common black-screen causes (missing environment variables in the build, a missing `cap sync`, a leftover `server.url`, a startup gate that renders nothing, an old WebView, a bare module import in the bundle).

## 6. Track F: functional audit and the bug-fix lane

Run Appendix C completely. Then handle these specific findings, each with a reproduction and the lane rules from section 3:

1. **Quest and garage mismatch.** Find the root cause. Client display or client state bug: fix (Lane 1). Ledger, backend or scan-saving logic: proposal (Lane 2) with the evidence. Either way, explain whether a scan can award XP and quest progress without saving a card.
2. **XP inflation.** Do not change values. Write a script that simulates the level curve against base XP per rarity tier and quest rewards, and produce a rebalancing proposal (Lane 2) with the numbers.
3. **Seeded and invented content.** Remove any client-side seed data from production builds behind a dev-only flag verified off in release. If the content comes from backend rows, report it.
4. **Report and block.** Verify the report flow end to end. Block user needs backend work: write the proposal and a draft migration, do not apply it.
5. **Quest list blank region.** Find and fix the cause (Lane 1).
6. **Map tiles.** Identify the provider; report terms, risks and a costed recommendation. Do not switch without the owner.
7. **Dev and admin tools.** Coordinate with R1 so none ship in release builds.
8. **Verified specs only.** Make sure every spec shown on a card comes from the registry and never from a model's output; show "unavailable" for unverified values.

## 7. Track S: store readiness

All store text must describe only what the shipped build really does. Verify each claim against the code and remove or soften anything untrue.

**S1. Listing package** (`docs/store/LISTING.md`). Title `Apex: Supercar Spotter` (22 of 30 characters). Short description, keep the owner's preferred one: `Spot supercars. Hunt rare finds. Build your collection.` (alternative: `Scan supercars you spot in the wild. Rarity changes from city to city.`). Full description (1,554 of 4,000 characters), to be checked against the build:

```
Saw a McLaren on your way to work and had nobody to tell? Apex is for that.

Point your camera at a car and scan it. Apex works out what it is and adds it to your garage as a collectible card with your photo, a serial number, a rarity tier and the car's specs: power, top speed, 0-100 and weight. If the angle isn't good enough to tell the regular model from the track version, it says so instead of guessing.

RARITY DEPENDS ON WHERE YOU ARE
A Porsche 911 is everywhere in Stuttgart and a rare sight in plenty of other places. Apex looks at what people near you have actually been spotting, so the same car can be Common in one city and Legendary in another. Cards go from Common up to Mythic, and the rarer the find, the more XP you get.

HUNTS
Found something Uncommon or better? Start a five-minute hunt. Players nearby get an alert, and whoever gets there first and scans the car themselves wins bonus XP.

YOU DECIDE WHAT PEOPLE SEE
Every post has its own location setting. Show the exact spot with a 15 minute delay (so the car has usually left), show a rough area, or hide it completely.

ALSO IN THERE
Leaderboards for your city, your country, your friends and the whole world
Daily quests and streaks
A map of recent sightings near you
A feed for your best finds, with comments and direct messages
Share any card as a story image

Apex is an independent fan project. It isn't affiliated with or endorsed by any car manufacturer, and brand names are used only to identify vehicles.

Questions, bugs, or a car it got wrong: support@yourdomain.com
```

Note: the "says so instead of guessing" line and the rarity claims must be true of the build you ship; Appendix B decides what identification can honestly promise. Use a placeholder for the support email and the policy URLs.

**S2. Data-flow audit and privacy policy draft.** Read the code and write `docs/store/DATA_FLOW_AUDIT.md` covering every permission (camera, precise and approximate location, notifications), account data (Google sign-in, email), photos (stored in Supabase Storage and sent to the AI provider or providers), the three location privacy tiers, hunt broadcasts, direct messages, friends, any analytics or crash SDK (none unless added), Play Integrity, device identifiers, retention (the 3-day soft delete and the deletion endpoint), minimum age, and every processor (Supabase, Vercel, Google, Cloudflare). Then write `docs/store/PRIVACY_POLICY_DRAFT.md` from it. Mark every unknown as `TODO(owner)`. Do not invent practices. The owner and counsel review it before publishing (Gate G8). Also say how license plates and faces in photos are handled, and recommend automatic blurring on public posts.

**S3. Data Safety worksheet** (`docs/store/DATA_SAFETY_WORKSHEET.md`). One row per data type: collected or shared, purpose, optional or required, encrypted in transit, deletable. It must match the policy exactly.

**S4. Account deletion.** Test the in-app deletion end to end, including storage purge. Write the specification for the public web page where users can request deletion (`docs/store/ACCOUNT_DELETION_PAGE.md`) and a static page template.

**S5. User-generated content readiness.** Write the gap list for report, block and moderation (what exists, what is missing, what Lane 2 work is needed), a draft of terms of use covering user content, and draft answers for the content rating questionnaire.

**S6. Store assets.** Using the UI program's screenshot mode (no backend calls, local fixtures, absent from release builds), capture the six screenshots in the funnel order: a Legendary card reveal, the scanner locked on a car, one car in two cities showing rarity, the hunt alert, a populated Garage, the location privacy sheet. Write the specifications and briefs for the icon (a geometric "A" mark that stays recognisable at 48 px, kept inside the central two-thirds for the adaptive mask) and the feature graphic (one dramatic car at night, the real LEGENDARY stamp rather than stars, minimal text, central area clear). Do not use images you do not have rights to; leave clearly marked placeholders.

**S7. Release checklist.** Write `docs/store/RELEASE_CHECKLIST.md`: signed AAB, Play App Signing, internal testing, then closed testing. Check Play Console's current requirements for new developer accounts, such as a closed-test period with a minimum number of testers before production access, and list the lead time. Include the Data Safety form, content rating, target audience, the privacy policy and deletion URLs, and the app access instructions for reviewers.

## 8. Gates, owner-only actions and integration

**8a. Gates.** Stop only for the item named and keep working on everything else.
- **G1:** promote the proposed clean manifest as a new versioned file (`manifest_v2.json`) beside the canonical one.
- **G2:** use of user photos, consent flow, terms or privacy changes, and which licensed images may enter a shipped gallery.
- **G3:** provisioning infrastructure or a new paid service, and applying any database migration.
- **G4:** the field-photo collection campaign.
- **G5:** the single test-split evaluation. Stays closed until the targets are met on validation.
- **G6:** paid plans, production environment variables, and changes to the client AI bridge (`aiVisionService.ts`).
- **G7:** any authentication change, including the `App.tsx` proposal in R3.
- **G8:** Play Console actions and legal review (owner only).
- **G9:** the choice of a crash-reporting vendor.

**8b. Integration.** Merge in this order: R, A (behind its flag), U, F, S. After each merge run the full test suite, the bundle check, the authentication smoke test, the scan smoke test, the boot test on an emulator and a physical device, a test on an old WebView, and the per-track frozen-path checks. Fix regressions before merging the next branch.

**8c. Final report** (`docs/program/FINAL_REPORT.md`): what is done, what is partly done, what is blocked on a gate, what could not be verified and why, every number with its source file and hash, the open owner decisions grouped by gate, the owner-only checklist (keystore, Play Console, legal review, field photos, paid plans), and the list of builds produced with how each was verified.

---

# APPENDICES

The three appendices below are the detailed specifications. Appendix A is Track U, Appendix B is Track A, Appendix C is Track F. Notes on how they fit this program:

- Appendix A's "Hard boundaries" apply while working on Track U. Its phase numbers are track-local.
- Appendix B is the remaining AI work. Phases 4 to 12 are already complete on `ai/identification` and their reports are in `docs/ai/`; do Phase 13 and keep the reporting integrity rules.
- Appendix C's AI deep dive and AI telemetry sections were removed because Track A supersedes them. Ignore its stale description of the AI stack.
- Where Appendix A says "report only" for a client-only bug, the Lane 1 rule in section 3 applies and you fix it.
