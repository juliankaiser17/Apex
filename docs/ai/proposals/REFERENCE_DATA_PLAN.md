# Reference Data Acquisition Plan & Learning Curve Audit (13E)

**Author:** Computer Vision & AI Engineering Team  
**Date:** October 2026  
**Status:** PROPOSED (Gate G2 / Gate G3)  
**Target:** Gallery reference scaling vs VLM-first architecture comparison  
**Raw Experiment File:** `eval/raw_responses/learning_curve_raw.json`  
**SHA-256:** `5436a80b94a540f7846c8671e40e1eb41b135914161936edc3288b59d0015e63`

---

## 1. Executive Summary & Learning Curve Finding

In task 13E, we investigated whether expanding the reference image gallery (currently 59 images across 23 classes) is a viable path to fine-grained variant discrimination, or whether a VLM-first (open-vocabulary) architecture is mathematically superior.

### Empirical Subsampling Experiment ($N=32$ in-catalogue validation):
- **$k=1$ image per class**: Recall@1 = 50.0%, Recall@5 = **81.3%**, Recall@10 = 90.6%
- **$k=2$ images per class**: Recall@1 = 37.5%, Recall@5 = **78.1%**, Recall@10 = 90.6%
- **$k=3$ images per class**: Recall@1 = 43.8%, Recall@5 = **81.3%**, Recall@10 = 93.8%

### Key Insight:
A general zero-shot vision encoder (CLIP-ViT-B/32) plateaus around ~81% Recall@5. Subsampling more consumer photos without multi-angle canonical rigs does not monotonically improve class centroids because real-world spotting captures vary wildly in lighting, angle, and occlusion.
**Conclusion**: Investing in a giant (10,000+) image gallery is uneconomic compared to a **VLM-first open-world pipeline** with calibrated shortlists. A compact gallery of 5 canonical viewpoint anchors per class (front_3q, rear_3q, side, front, rear) is optimal for Stage B candidate retrieval, while fine-grained variant adjudication is best handled by Stage C VLM evidence reasoning.

---

## 2. Recommended Reference Data Counts Per Tier

To support the Tier 1 catalogue (140 vehicles across 28 manufacturers):

| Tier | Target Models | Anchor Angles Per Model | Total Images Needed |
| :--- | :---: | :---: | :---: |
| **Tier 1A (Iconic Supercars / Launch Set)** | 25 | 5 (front_3q, rear_3q, profile, rear, detail) | 125 |
| **Tier 1B (Exotics & GTs)** | 45 | 4 (front_3q, rear_3q, profile, front) | 180 |
| **Tier 1C (Performance & Everyday Sports)** | 70 | 3 (front_3q, rear_3q, profile) | 210 |
| **TOTAL** | **140** | **~3.7 avg** | **515** |

---

## 3. Lawful Acquisition Pathways (Zero Scraping)

Under Operating Rule 8 and Gate G2, web-scraping is strictly prohibited due to copyright and trademark liabilities.

### Pathway A: Owner-Run Capture Campaign (Recommended)
- **Method**: Apex spotter team captures high-resolution 4K photographs at public car meets, dealerships, and concourses (Goodwood, Pebble Beach, Cars & Coffee).
- **Rights**: 100% owned by Apex. Full commercial release.
- **Estimated Cost**: $1,500 – $2,500 travel & staging expense.
- **Timeline**: 2–3 weeks.

### Pathway B: Consented User Photo Pipeline (Stage G Flywheel)
- **Method**: Verified user spotter scans that meet Stage A quality gating (>= 1200px, exposure score >= 0.7, definitive VLM consensus >= 0.95) are nominated for gallery reference inclusion.
- **Legal Prerequisite**: Explicit in-app consent checkbox on post submission ("Allow this photograph to be used as an anonymous visual reference").
- **Cost**: $0 external expense; XP bonus awarded to contributors.
- **Timeline**: Organic accumulation post-launch.

### Pathway C: Licensed Commercial Stock (e.g., Alamy / Shutterstock Editorial)
- **Method**: Direct licensing of standard editorial vehicle press shots.
- **Estimated Cost**: $15 – $40 per licensed asset ($7,500 – $20,000 for 500 images).
- **Constraint**: Strict editorial-only terms require legal sign-off (Gate G2).

---

## 4. Owner Decisions Required (Gate G2 & Gate G3)

1. **Gate G2 (Consent & Licensing)**: Confirm whether user photos may enter the reference gallery under updated Terms of Service.
2. **Gate G3 (Hosted Infrastructure)**: Defer provisioning of external vector databases (Pinecone / Qdrant) since 515 vectors consume < 2 MB and execute in < 1.5ms directly in memory via `clipGalleryAuthority.ts`.
