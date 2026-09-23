# APEX — POSTPONED ISSUES

Scope lock log for the exact-model recognition fix. Items here were discovered during forensics
but deliberately **not** implemented, because they fall outside the exact-model recognition bug,
are pre-existing, or require hardware/production access that this environment does not have.

---

## 1. Pre-existing test failures (7 assertions, NOT caused by this fix)

Two suites were already failing before this change set. Attribution evidence is given so it can be
re-checked rather than trusted.

### 1a. `scripts/test_real_world_forensics_regression.ts` — **25/25 (FIXED)**
The Hong Kong taxi-livery "severe contradiction deadlock" test had regressed to returning
`Toyota Camry (XV70)` instead of abstaining.

* **Original attribution:** the committed baseline (`git show HEAD:...hierarchicalClassifier.ts`)
  contained a rule at line 190 —
  `const hasToyotaCues = (/\b(toyota|gr\s+supra|gr\s+badge)\b/i.test(evidenceText)) || isTaxiLivery;`
  which invalidated every non-Toyota candidate and produced the deadlock. That rule is **absent from
  the working tree**, removed by the pre-existing uncommitted work rather than by this change set.
* **Actual mechanism:** removing that rule was not the whole story. The real leak was that the
  discriminator's peer expansion *fabricated* a `Toyota Camry` candidate (it carried no supporting
  observation of its own) inside a service/livery scene, and the Camry then won because nothing
  disqualified it. The old rule had been papering over that.
* **Generalized fix:** a hoisted `isServiceLiveryScene` detector now requires that, in a commercial
  service/livery scene, only a **documented service/livery vehicle** may survive — every other
  candidate is disqualified, and peer-expansion candidates are not admitted either. If nothing
  survives, the existing deadlock path abstains at make level. No brand-specific or model-specific
  special case was added, and the legacy exotic-candidate contradiction wording is preserved
  verbatim for `scripts/test_m4_csl_collapse_prevention.ts`.

### 1b. `scripts/test_vision_reconstruction_regression.ts` — 28/31 (3 failing)
* `Unregistered exotic must have isVerifiedUnregistered = true` → got `false`
* `Canonical identity registryStatus must be VERIFIED_UNREGISTERED` → got `REGISTERED`
* `Model must preserve input Chiron without sideways mutation` → got `Chiron Super Sport`

* **Evidence of pre-existing attribution:** `git diff HEAD -- src/ai-engine/canonical/canonicalVehicleRegistry.ts`
  contains **no** `chiron`/`Chiron`/`VERIFIED_UNREGISTERED` lines, so this change set did not alter
  these paths. The vehicle database record is `bugatti-chiron-super-sport` (id), so a bare `Chiron`
  query resolves to the registered `Chiron Super Sport` instead of staying unregistered.

---

## 2. Candidate / fingerprint coverage gap — prioritised backlog

`scripts/audit_fingerprint_coverage_priority.ts` (new) ranks unfingerprinted vehicles by
**reachability in the active candidate universe** rather than boilerplate-creating one for every
record. Current: **31 fingerprints / 63 canonical vehicles**; 32 unfingerprinted, of which **29 are
reachable** and 3 are unreachable by any active path.

Top of the backlog (reachability score in brackets):

| # | Model | Why it matters |
|---|---|---|
| 1 | Porsche 911 Carrera (992) `[10]` | in authentic corpus; base 992 has **no** fingerprint and no reachable alias (`registerAliases('porsche-911-gt3-992')` is a dead no-op), so real 992 photos resolve to a sibling |
| 2 | Ferrari 296 GTB `[10]` | in authentic corpus; already the live raw-provider guess for the SF90 image |
| 3 | BMW M3 Competition `[10]` | in authentic corpus; BMW only has `bmw-m4-csl-g82` fingerprinted |
| 4 | Ferrari 812 Superfast / LaFerrari `[10]` | in authentic corpus |
| 5 | Koenigsegg Jesko `[10]` | in authentic corpus |
| 6 | Lamborghini Revuelto `[10]` | in authentic corpus |
| 7 | Nissan GT-R Nismo `[10]` | in authentic corpus |
| 8 | Porsche 718 Cayman GT4 RS `[10]` | in authentic corpus |
| 9 | Porsche Macan / Carrera GT `[10]` | in authentic corpus |
| 10 | Porsche 911 Turbo S `[5]` | alias fixed, but still no fingerprint, so it cannot be told apart from a 911 Turbo |
| 11 | Lamborghini Huracán STO `[5]` | confusion edge with `lamborghini-huracan-lp610-4` |
| 12 | Maserati GranTurismo `[5]` | same-brand candidate universe |
| 13 | Toyota Crown Comfort `[5]` | the service/livery vehicle used by the taxi abstention paths |

Run `npx tsx scripts/audit_fingerprint_coverage_priority.ts` to regenerate; set `SHOW_ALL=1` for the
full list. Building these fingerprints is a coverage expansion requiring the same
"differentiating traits only" discipline, so it is deliberately not done under this scope lock.

### 2b. Pre-existing test-suite baseline (unfingerprinted coverage consequences)

`scripts/test_m4_csl_collapse_prevention.ts`: **46 / 52**. One failure was introduced by this round
and fixed; the remaining 6 are pre-existing and fall into two groups:
* Test-expectation string strictness — the test expects a shorter model token than the canonical
  record provides: `R8` vs `R8 V10 Performance`, `Huracán` vs `Huracán LP 610-4`,
  `Skyline` vs `Skyline GT-R`.
* Genuine coverage gaps — `Chevrolet Corvette C8 Stingray → Maserati MC20` (Chevrolet has no
  fingerprint and is absent from the manufacturer lock table, so no Chevrolet candidates can ever be
  constructed) and `Honda NSX (NC1) → Integra Type R` (Honda's only fingerprint is the Integra, so it
  wins by being the sole eligible Honda candidate).

---

## 3. No canonical or vehicle-database record for the base Porsche 992 GT3

`canonicalVehicleRegistry.registerAliases('porsche-911-gt3-992', ...)` in the committed baseline is a
**silent no-op**: `registerAliases()` returns early when the `vehicleId` is unknown, and no
`porsche-911-gt3-992` record exists. Consequences:
* `"992 GT3"`, `"porsche 992 gt3"`, `"911 gt3 touring"` resolve to nothing.
* The authentic corpus image `REAL_BLIND_000277` (ground truth *Porsche 992 GT3*) can therefore only
  resolve to the nearest registered sibling (`porsche-911-gt3-rs`) rather than the correct base GT3.

The dead registration is now annotated in place. Adding the base GT3 record requires new vehicle
data + specs, which is outside "minimum supporting registry" for this fix.

---

## 4. Field-conflation: rear evidence satisfying a front trait — **FIXED**

Fixed via semantic/front-rear evidence routing in `fineGrainedModelDiscriminator.ts`
(`buildZonedEvidence` + `CATEGORY_EXCLUDED_ZONES`). A trait may not be satisfied by text describing
the **opposite end** of the car; ambiguous clauses stay eligible everywhere. Guarded permanently by
INVARIANT E in `scripts/test_registry_and_prompt_invariants.ts` using the verbatim payload captured
from the live provider on `REAL_BLIND_000410`.

### 4b. NEW remaining blocker — generic lighting vocabulary in fingerprints

With routing fixed, the SF90 photograph no longer matches the 458's **front** trait, but it now
matches the **Amalfi's** front trait instead. Live trace on `REAL_BLIND_000410`:

```
Ferrari Amalfi (F169M)  score=0.8  spec=1
   + Observed headlight shape matches Amalfi signature (horizontal_slender_led_strip_with_drl_blade)
```

The evidence was `"Front: Two horizontal LED strips on either side of the grille"`. The Amalfi's
`headlight_shape` positive list contains generic modern-LED vocabulary — `'slender led'`,
`'horizontal led strip'`, `'horizontal headlight'`, `'fine led strip'`, `'slim horizontal headlight'`
— none of which is exclusive to an Amalfi. The same applies to the 458's `'vertical led strip'`.

**Consequence:** generic lamp-description wording can promote any Ferrari of that era. Fixing this
means replacing generic lighting vocabulary in the Ferrari fingerprints with genuinely
discriminating geometry (lamp outline shape, DRL blade path, housing cut). Not done — it is
fingerprint ontology work, and the brief said not to invent fingerprints blindly.

### 4c. NEW remaining blocker — final identity can fall back to the raw provider guess

In the same live trace the classifier resolved **Amalfi** (`reason: "Generation confirmed (F169M) for
Ferrari Amalfi."`) while the returned card was **Ferrari 296 GTB Assetto Fiorano** with 296 GTB specs
(819 hp hybrid V6). So the discriminator's winner was discarded downstream and the raw provider's
model was used for the canonical identity/specs. This violates the "specs must come exclusively from
the final canonical ID's winner" invariant and is the same *raw-guess-wins* class as the original
same-manufacturer defect, now at the provider resolution layer. Not fixed — outside the three
requested items, but it is the highest-value blocker remaining.

---

## 5. Vehicle-database data inconsistencies

* `ferrari-458-spider` has `model: '458 Spider'` **and** `trim: 'Spider'`, which rendered as
  "Ferrari 458 Spider Spider (F142)". The *display builder* is now de-duplicating redundant trims
  (generalized), but the underlying data is still redundant.
* The same audit lists `Ford Ford GT` (manufacturer duplicated in model) and
  `Mercedes-AMG AMG GT` / `AMG ONE` (brand token repeated in model).

---

## 6. Physical acceptance gate (brief §21) — NOT PERFORMED

No Samsung A54 and no Android build/install toolchain was used in this session. The six physical
acceptance cases (GT3 RS, 911 Turbo, Amalfi, Daytona SP3, MC20, 650S) were **not** verified
on-device.

Additionally, **only 1 of the 6** acceptance vehicles exists in the authentic image corpus
(`benchmark/real_world_1000`): Ferrari Daytona SP3. The corpus contains no 911 Turbo, no Amalfi,
no MC20 and no 650S, so those four cannot be validated against real repo imagery at all — the
acceptance set needs real photographs supplied.

---

## 7. Live acceptance pass — raw-hypothesis dependency at family level (measured, postponed)

Across the 20 corpus images of the four Ferrari acceptance models (no Amalfi images exist in the
repo), the engine is internally consistent: **whenever model-specific evidence separates
candidates, the final identity is evidence-driven and correct** (000418 Daytona SP3
`identified` + verified specs; all evidence-bearing 296 GTB front views resolve to
`ferrari-296-gtb`). Three genuine generalized defects found in live imagery were fixed this pass
(bare family tokens manufacturing specific evidence):

- `horizontal slats` → Daytona SP3 strakes trait (000407: a 296 GTB photo was confidently
  misidentified as Daytona SP3 and the real car was *contradicted* by its own grille wording)
- `long hood` / `sweeping hood` → Amalfi ventless-hood trait (000422: P80/C photo → fabricated
  Amalfi at +0.3)
- `buttresses` / bare `spider` on closed cars → 458/650S Spider open-top traits (earlier pass)

The remaining live mismatches are all the **permitted abstention class**: the VLM's own raw
hypothesis is wrong for the photographed angle (Icona/limited models are systematically
misnamed from rear or profile views), no model-specific evidence exists in the observation to
overturn it, so the raw hypothesis survives at family level with status `probable`/`uncertain`
— never claiming a validated exact model. Improving these requires a corpus of Icona-specific
morphology from adverse viewpoints, which the current 21-image Ferrari corpus does not contain.

---

## 8. Production deployment (brief §20 steps 7–9) — NOT PERFORMED

The API bundle was rebuilt (`npm run build:api`, `api/analyze.js`, 399 kb) and the analysis pipeline
version was bumped, but **nothing was committed, pushed, or deployed**. Deployment of a production
backend and a publicly reachable endpoint change is a consequential, externally visible action, so
it is left for explicit go-ahead.
