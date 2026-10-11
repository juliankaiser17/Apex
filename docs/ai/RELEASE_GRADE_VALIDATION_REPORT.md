# Apex AI Identification: Release-Grade Validation Report (Phase 12D)

**Author:** Apex AI Engineering Team  
**Date:** 2026-10-11  
**Status:** COMPLETE (EMPIRICAL RUN ON $N = 316$ CLEAN VALIDATION POOL)  
**Evaluated Split:** Clean Dev + Val Group-Disjoint Pool ($N = 316$ vehicles, $123$ distinct classes, $102$ session groups)  
**Held-Out Test Split ($n=248$):** STRICTLY UNTOUCHED & FROZEN (Gate G5 CLOSED)  
**Underlying Artifacts:**  
- Summary: [`eval/release_validation_report.json`](file:///c:/Users/DELL/Downloads/Apex-main/Apex-main/eval/release_validation_report.json)  
- Full Predictions Ledger: [`eval/release_validation_predictions.json`](file:///c:/Users/DELL/Downloads/Apex-main/Apex-main/eval/release_validation_predictions.json)  
- Pool Manifest: [`eval/release_validation_pool.json`](file:///c:/Users/DELL/Downloads/Apex-main/Apex-main/eval/release_validation_pool.json)

---

## 1. Validation Pool Construction & Class Coverage

Per Phase 12D mandates, we constructed a large, group-disjoint validation pool exclusively from clean development and validation data (zero test split items):
- **Total Validated Vehicle Images:** **$N = 316$** (Target: $\ge 300$).
- **Total Distinct Vehicle Classes:** **$123$** (Target: $\ge 100$).
- **Session Groups Covered:** **$102$** disjoint session groups partitioned by photographer / event key.
- **Shortfall Analysis:** **0 shortfall.** The available clean dev+val data permitted an expansive pool with 123 distinct make+model classes spanning exotics, sports cars, and uncatalogued everyday consumer vehicles.

---

## 2. End-to-End Pipeline Evaluation vs Release Targets

The full Apex v2 identification pipeline (Stage A $\to$ Stage B $\to$ Stage C $\to$ Stage D $\to$ Stage E $\to$ Stage F) was executed end-to-end with real live provider calls across all 316 items.

### Primary Metrics & Wilson 95% Confidence Intervals:

| Metric | Sample Size ($n$) | Achieved Value (Wilson 95% CI) | Release Target | Verdict |
|---|---|---|---|---|
| **Make Accuracy** | 316 | **21.8% [17.6% - 26.7%]** (69/316) | $\ge 98.0\%$ | ❌ **NOT MET** |
| **Model Accuracy** | 316 | **14.2% [10.8% - 18.5%]** (45/316) | $\ge 92.0\%$ | ❌ **NOT MET** |
| **Generation Accuracy** | 316 | **14.2% [10.8% - 18.5%]** (45/316) | Baseline tracking | Tracking |
| **Variant Accuracy** | 316 | **13.9% [10.5% - 18.2%]** (44/316) | $\ge 80.0\%$ | ❌ **NOT MET** |
| **Wrong-but-Confident Rate** | 316 | **72.5% [67.3% - 77.1%]** (229/316) | $< 2.0\%$ | ❌ **NOT MET** |
| **Make-Only Rate** | 316 | **0.0% [0.0% - 1.2%]** (0/316) | $< 5.0\%$ | ✅ **MET** |
| **`identified_model` Rate** | 316 | **8.5% [5.9% - 12.1%]** (27/316) | Informational | Tracking |
| **`needs_more_views` Rate** | 316 | **0.0% [0.0% - 1.2%]** (0/316) | Informational | Tracking |
| **`uncertain` Rate** | 316 | **8.2% [5.7% - 11.8%]** (26/316) | Informational | Tracking |
| **`not_in_catalogue` Rate** | 316 | **2.5% [1.3% - 4.9%]** (8/316) | Open-set tracking | ⚠️ **Under-rejecting** |
| **Provider Failure Rate** | 316 | **0.0% [0.0% - 1.2%]** (0/316) | $< 1.0\%$ | ✅ **MET** |
| **Mean Latency per Scan** | 316 | **2,897 ms** (P50: 2,820 ms) | $< 6,000$ ms SLA | ✅ **MET** |
| **Mean Cost per Scan** | 316 | **$0.00156 USD** | $< $0.0050 USD | ✅ **MET** |
| **Held-Out Calibration ECE** | 316 | **0.7411 (74.1%)** | $\le 0.100$ | ❌ **OVERCONFIDENT** |

---

## 3. Forensic Root-Cause Analysis: Why Targets Were Not Met

This rigorous empirical test explains why previous self-reported numbers were not release-grade and reveals the fundamental architectural bottleneck:

### 1. The Open-Set "Sedan Collapse" Failure Mode
- The 316-item pool contains 249 uncatalogued everyday vehicles (Civic, Golf, Corolla, Altima, Elantra, etc.) alongside 67 in-catalogue exotics.
- **Hand-Built Feature Deficiency:** The legacy 64D spatial-spectral extractor has weak semantic discrimination. It assigned moderate cosine similarities between uncatalogued family sedans and the launch catalogue gallery (particularly `Toyota Camry` and exotic coupes).
- **Open-Set Leakage:** Because `openSetSimilarityFloor = 0.45`, Stage B failed to reject uncatalogued cars, outputting `not_in_catalogue` on only **2.5%** of items.
- **Forced Multimodal Hallucination:** Stage C (Gemini 3.5 Flash) was fed a candidate shortlist containing only supercars or Camry. When asked to adjudicate, the generative VLM attempted to pick the "least bad" candidate (mapping Golf, Civic, Altima, Corolla, and Malibu directly to Toyota Camry, or compacts to Ferrari/McLaren).
- Generative models emit high verbalized confidence ($\bar{c} = 0.954$) even on out-of-distribution forced choices, causing a catastrophic **72.5% wrong-but-confident rate**.

### 2. The Solution Proven in Phase 12C
- Phase 12C demonstrated that **learned embeddings (CLIP-ViT-B/32 & DINOv2-small)** provide $>4\times$ higher in-catalogue Recall@5 (62.5% vs 15.6%) and sharp geometric boundaries ($0.958+$ color invariance).
- More critically, learned embeddings project out-of-catalogue consumer vehicles to low similarity scores ($< 0.25$), allowing Stage B to cleanly reject them before Stage C is ever invoked.

---

## 4. Top 10 Confusion Pairs

The ten most common classification errors demonstrate the forced-choice sedan collapse:

| Rank | Ground-Truth Vehicle | Predicted Vehicle | Confusion Count | Primary Failure Mechanism |
|---|---|---|---|---|
| **1** | Volkswagen Golf | Toyota Camry | 6 | Open-set hatchback forced onto only mainstream sedan candidate |
| **2** | Honda Civic | Toyota Camry | 6 | Open-set compact forced onto Camry candidate |
| **3** | Nissan Altima | Toyota Camry | 5 | Mid-size sedan silhouette collision |
| **4** | Subaru Impreza | Ferrari 296 GTB | 4 | Hand-built color/spectral misattribution to red sports car |
| **5** | Chevrolet Malibu | Toyota Camry | 4 | Open-set sedan forced onto Camry candidate |
| **6** | Toyota Corolla | Toyota Camry | 4 | Intra-brand model confusion (same make badge detected) |
| **7** | Nissan Skyline GT-R | Porsche Carrera GT | 3 | Japanese sports coupe mapped to European supercar |
| **8** | Honda Accord | Toyota Camry | 3 | Japanese mid-size sedan collision |
| **9** | Honda Civic | Ferrari 488 | 3 | Compact rear wing misattributed to exotic aero |
| **10** | Hyundai Elantra | Ferrari F8 Tributo | 3 | Aggressive front grille creases misattributed to exotic |

---

## 5. Performance by Viewpoint and Condition

### Viewpoint Accuracy Breakdown:
- **Front (`front`):** 35.1% [24.0% - 48.1%] (20 of 57) — Front grille and headlights provide strongest distinctive cues.
- **Side (`side`):** 16.7% [3.0% - 56.4%] (1 of 6) — Profile silhouette vulnerable to general body style collapse.
- **Rear (`rear`):** 11.1% [6.0% - 19.8%] (9 of 81) — Tail lights alone insufficient without badging.
- **Front 3/4 (`front_three_quarter`):** 8.7% [5.4% - 13.9%] (15 of 172) — Dominated by out-of-catalogue consumer vehicles.

### Photo Condition Breakdown:
- **Day Clear (`day_clear`):** 14.5% [11.0% - 18.8%] (45 of 311)
- **Day Rain / Wet Surface (`day_rain`):** 0.0% [0.0% - 43.4%] (0 of 5) — Reflections confuse hand-built edge detectors.

---

## 6. Held-Out Calibration Curve & Expected Calibration Error

Predictions binned by calibrated confidence score:

| Confidence Bin | Prediction Count ($n$) | Mean Confidence | Empirical Accuracy | Calibration Gap |
|---|---|---|---|---|
| **[0.3 - 0.4)** | 4 | 0.357 | 0.0% | 0.357 |
| **[0.4 - 0.5)** | 4 | 0.440 | 0.0% | 0.440 |
| **[0.6 - 0.7)** | 34 | 0.649 | 0.0% | 0.649 |
| **[0.7 - 0.8)** | 15 | 0.769 | 6.7% | 0.702 |
| **[0.8 - 0.9)** | 49 | 0.857 | 2.0% | 0.836 |
| **[0.9 - 1.0)** | 210 | 0.954 | 20.5% | 0.750 |

**Held-Out ECE:** **`0.7411 (74.1%)`**  
The generative VLM is severely overconfident when forced to choose among distant candidates. Proper open-set calibration requires temperature scaling fit with negative samples and learned embedding gating.

---

## 7. Final Verdict on Gate G5

### Recommendation: **GATE G5 REMAINS STRICTLY CLOSED.**
- **Release Targets Status:** 1 of 5 targets met (Make-only rate $\le 5\%$). Make accuracy (21.8%), model accuracy (14.2%), variant accuracy (13.9%), and wrong-confident rate (72.5%) do not meet release criteria.
- **Opening Pre-condition:** Gate G5 (the 248 frozen held-out test records) must **NOT** be executed until:
  1. The dedicated learned embedding service (`docs/ai/proposals/LEARNED_EMBEDDING_SERVICE_PROPOSAL.md`, Gate G3) is provisioned and deployed.
  2. Open-set anomaly detection floor is calibrated to reject out-of-catalogue consumer vehicles at $\ge 90\%$ precision.
  3. All release targets (Make 98%, Model 92%, Variant 80%, Wrong-Confident $< 2\%$) are empirically demonstrated on this 316-item validation pool.
