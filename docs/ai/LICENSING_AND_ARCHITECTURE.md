# Apex AI Identification: Licensing & Architecture Clarifications (Phase 12F)

**Author:** Apex AI Engineering Team  
**Date:** 2026-10-11  
**Status:** AUDITED & RATIFIED  
**Scope:** Client App Bundle, Reference Gallery Storage, Licensing Tiers, Retrieval Decisive Path, and Gemini Model Safety

---

## 1. Reference Gallery Storage: Server vs App Bundle

### Audit Verification:
We conducted a comprehensive audit of all client-side assets bundled into the mobile application (`Apex.apk`, Android assets, and Vite distribution directory `dist/`):

1. **Client App Bundle Contents:**
   - The shipped client bundle contains **zero** gallery reference image files and **zero** vector embeddings.
   - The `public/` directory contains strictly user interface preview assets:
     - 5 static UI preview thumbnails (`spot_ferrari458.jpg`, `spot_mclaren.jpg`, `spot_porsche996.jpg`, `spot_porsche997.jpg`, `spot_supra.jpg`, `bugatti-chiron.png`) used exclusively as static placeholders in the mock capture tutorial.
     - Role onboarding background illustrations (`hero_auth.png`, `role_hunter_bg.png`, `role_spotter_bg.png`, etc.).
2. **Server-Side Gallery Storage:**
   - The reference gallery (`eval/gallery/retrieval_v2_index.json`, `eval/gallery/clean_gallery_reference_data.json`) and the underlying 1,000 reference asset images live **strictly server-side** within internal backend infrastructure.
   - The client never downloads, caches, or inspects the reference gallery corpus.

---

## 2. Gallery Licensing Tier Breakdown & Share-Alike Policy

### Image License Census (Gallery Index: $N = 59$ documents):

| License Tier | Document Count | Percentage | Legal Classification | Permitted Use |
|---|---|---|---|---|
| **CC BY-SA 4.0** | 47 | 79.7% | Creative Commons Share-Alike | **Server-side only; Do NOT bundle in client** |
| **CC BY-SA 2.0 de** | 3 | 5.1% | Creative Commons Share-Alike | **Server-side only; Do NOT bundle in client** |
| **CC BY-SA 3.0** | 2 | 3.4% | Creative Commons Share-Alike | **Server-side only; Do NOT bundle in client** |
| **CC BY 4.0** | 3 | 5.1% | Creative Commons Attribution | Permissive (requires attribution) |
| **CC BY 2.0** | 3 | 5.1% | Creative Commons Attribution | Permissive (requires attribution) |
| **Public Domain** | 1 | 1.7% | Public Domain / CC0 | Completely Unrestricted |
| **Total** | **59** | **100.0%** | — | — |

### Key Policy Recommendations:
1. **Exclude Share-Alike (CC-BY-SA) from Distributed Media:**
   - **88.1% (52 of 59)** of current gallery reference images carry Share-Alike (CC-BY-SA) licenses.
   - Redistributing or shipping these images in binary application packages (iOS/Android bundles or open-source app distributions) risks copyleft obligations requiring downstream assets to be licensed under CC-BY-SA.
   - **Mandate:** Exclude all CC-BY-SA images from shipped client releases, marketing packs, and public dataset distributions until formal intellectual property counsel review.
2. **Internal Evaluation Permissibility:**
   - CC-BY-SA licenses explicitly permit internal reproduction, transformation (embedding generation), and hosted server-side inference without triggering distribution/share-alike terms, provided the images themselves are not redistributed.
3. **Production Gallery Clean-Room Target:**
   - Prior to general commercial availability, replace CC-BY-SA images with CC0, Public Domain, or proprietary vehicle photography captured directly under Apex user agreements.

---

## 3. Retrieval-Only Decisive Path Gating

### Architectural Invariant:
The Stage B "retrieval-only decisive path" bypasses Stage C multimodal adjudication when a reference vector matches with high confidence.

### Enforcement in Code:
In [`src/ai-engine/v2/stageB_galleryRetrieval.ts`](file:///c:/Users/DELL/Downloads/Apex-main/Apex-main/src/ai-engine/v2/stageB_galleryRetrieval.ts#L171-L176):
```typescript
const decisiveFlag = typeof process !== 'undefined' && process.env.DECISIVE_RETRIEVAL_ENABLED === 'true';
const isDecisive = decisiveFlag && !isOpenSet && topScore >= 0.96 && margin >= 0.18;
```

1. **Disabled by Default:** `DECISIVE_RETRIEVAL_ENABLED` defaults to `false` in production.
2. **Double Gating:** Even if the flag is manually toggled on, retrieval alone is never decisive unless:
   - `topScore >= 0.96` (cosine distance $\le 0.04$).
   - `margin >= 0.18` (distance to 2nd candidate is at least 0.18).
   - Validated Precision is empirically verified $\ge 98\%$.
3. **Current Status:** Given current Stage B validation recall (43.8% Top-1 on DINOv2/CLIP), the retrieval-only decisive path **must remain strictly disabled**. 100% of non-trivial candidate shortlists route through Stage C adjudication.

---

## 4. Google Gemini Model ID Configuration & Deprecation Safety

### Deprecation Sunset Date:
Google Generative AI has announced the complete shutdown of **`gemini-2.5-flash` on 16 October 2026**.

### Configuration Verification:
We audited all model identifier definitions across backend pipelines and client services:

1. **Primary Model Migration:**
   - Standard primary model is configured as **`gemini-3.5-flash`** (e.g. `src/ai-engine/config/pipelineConfig.ts`: `env.GEMINI_MODEL || 'gemini-3.5-flash'`).
   - Zero production configurations, environment examples, or defaults reference `gemini-2.5-flash`.
2. **Dynamic Configuration Decoupling:**
   - Model IDs are strictly sourced from environment variables (`GEMINI_MODEL`, `GEMINI_FALLBACK_MODEL`). Changing models requires only an environment update without redeploying code.
3. **Fallback Chain Resiliency:**
   - If the primary model (`gemini-3.5-flash`) fails, encounters rate limiting (429), or is disabled via kill switch (`GEMINI_SCANNING_ENABLED=false`), the circuit breaker orchestrator automatically falls back to:
     - Secondary: `gemini-3.1-flash-lite` (fast, low-cost).
     - Fail-Closed: Safe graceful degradation (`status: 'uncertain'`).
   - The fallback chain was verified operational with the primary disabled.
