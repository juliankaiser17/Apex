# Apex AI Identification — UI & Client Contract Requirements

*Version: 2.0.0*  
*Target: Web Client & Capacitor Mobile App*

---

## 1. Overview & Core Philosophy
The v2 vehicle identification pipeline enforces strict calibration, honest abstention, and zero make-only success returns. When a scan result is returned, the client UI must clearly communicate the system's exact confidence tier and provide actionable recovery guidance.

---

## 2. Scan Status Taxonomy & User Experience

| Pipeline Status (`status`) | Client UX Treatment | Primary Action | Secondary Action |
|---|---|---|---|
| `identified` | Full celebration modal; display verified variant name (e.g. *Ferrari 458 Spider*), year range, and full spec sheet. | Add to Garage | View Verified Specs |
| `identified_model` | Model family confirmed, but specific trim/variant ambiguous. Shows top 2-3 candidate trims with visual cue highlights. | Select Trim / Add | Take Another Angle |
| `needs_more_views` | Vehicle recognized, but critical distinguishing cues (e.g. active spoiler, rear exhaust tips) require additional angle. | Capture Suggested Angle | Add as Tentative |
| `uncertain` | Adjudication could not reach 90% calibrated confidence floor. (See Section 3 for distinct recovery sub-causes). | Retry / Retake | View Photo Tips |
| `rejected` | Image failed physical quality gates (sub-resolution, severe blur, corrupt bytes, non-vehicle). | Retake Photo | Dismiss |
| `not_in_catalogue` | Recognized as a vehicle, but make/model is not supported in the Apex Tier 1 Registry. | View Supported Cars | Dismiss |

---

## 3. Disambiguating the Causes of `status: 'uncertain'`

The client MUST distinguish between backend infrastructure degradation and photographic ambiguity:

### Sub-Case A: Provider / Infrastructure Degradation (`provider_failure`)
- **Trigger**: Upstream vision provider timeout, HTTP 429 quota exhaustion, or circuit breaker tripped.
- **Client Banner**: `"Identification servers are temporarily busy or unreachable. Your photo has been safely saved."`
- **Telemetry Key**: `PROVIDER_FAILURE_RECOVERY`
- **UI Element**: Shows a prominent **"Retry Scan"** button (does NOT require the user to walk back and retake the photo).
- **Client Behavior**: Keeps original image buffer in memory; retries against server-side fallback endpoints with 1.5s jitter.

### Sub-Case B: Photographic / Viewpoint Ambiguity (`valid_abstention`)
- **Trigger**: Image is valid and processed, but physical aerodynamic cues or badges cannot distinguish sibling variants.
- **Client Banner**: `"We couldn't clearly confirm the exact variant from this angle. For example, Ferrari 488 GTB and F8 Tributo share similar front profiles."`
- **Telemetry Key**: `PHOTO_QUALITY_RECOVERY`
- **UI Element**: Shows **"Retake with Angle Guide"** and highlights needed viewpoint (e.g., *"Capture rear badge & exhaust tips"*).

### Sub-Case C: Low Lighting / High Occlusion (`input_quality_gate`)
- **Trigger**: Brightness $< 0.15$ or $> 0.95$, heavy vehicle occlusion ($> 50\%$).
- **Client Banner**: `"Lighting is too dark or the vehicle is heavily obscured."`
- **Telemetry Key**: `LIGHTING_RECOVERY`
- **UI Element**: Shows camera view with flash toggle and framing guides.

---

## 4. Multi-Photo Session Fusion UI (Up to 3 Photos)

When `needs_more_views` or multiple photos are captured in a single spotting session:
1. **Multi-Thumb Ribbon**: Displays thumbnail carousel of up to 3 captured angles (`[Front 3/4]`, `[Rear]`, `[Badge Detail]`).
2. **Session Score Progression**: Shows dynamic confidence bar updating in real time as complementary angles resolve ambiguity.
3. **Automatic Conflict Resolution**: Conflicting badges or aerodynamic vetoes are highlighted with clear explanations (e.g., *"Rear diffuser confirms GT3, not Carrera"*).

---

## 5. Backward Compatibility Guarantee
All v2 API responses maintain full backward compatibility with the v1 schema:
- `car_name`: Continues to return the full vehicle display string.
- `make`, `model`: Always populated with canonical make and model names.
- New fields (`canonicalId`, `generation`, `variant`, `adjudicationOutcome`, `guidedRecovery`, `verifiedSpecs`) are additive.
