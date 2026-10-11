# Proposal: Dedicated Learned Visual Embedding Microservice (Phase 12C)

**Status:** PROPOSAL / GATE G3 REVIEW ONLY (Do Not Provision)  
**Date:** 2026-10-11  
**Authors:** Apex AI Architecture Team  
**Review Gate:** Gate G3 (Infrastructure Provisioning)

---

## 1. Problem Statement & Serverless Constraints

Stage B visual retrieval requires extracting high-dimensional dense semantic embeddings from vehicle photos to search against the reference gallery. 

While the initial prototype relied on hand-crafted 64-dimensional spatial-spectral heuristics (HSV color slices + Sobel gradients), evaluation on validation data proved that hand-built features achieve only **28.1% Recall@5**, confounding downstream adjudication.

However, deploying learned foundation vision models (such as **DINOv2-small** or **CLIP-ViT-B/32**) inside standard serverless functions (Vercel Serverless / AWS Lambda) encounters strict constraints:

| Constraint | Vercel Serverless / AWS Lambda Limit | DINOv2-small Impact | CLIP-ViT-B/32 Impact |
|---|---|---|---|
| **Uncompressed Bundle Size** | 250 MB | ~115 MB (ONNX weights + ORT wasm) | ~340 MB (**EXCEEDS LIMIT**) |
| **Zipped Deployment Size** | 50 MB | ~65 MB (**EXCEEDS LIMIT**) | ~180 MB (**EXCEEDS LIMIT**) |
| **Cold Start Latency** | $\le 1,500$ ms SLA | 2,200 – 3,500 ms initialization | 4,500 – 6,000 ms initialization |
| **Memory Footprint** | 1,024 MB (Standard Hobby/Pro) | ~450 MB working set | ~850 MB working set |
| **Concurrency Scaling Cost** | High memory per container | Memory spikes under concurrent scans | OOM risk under burst traffic |

**Conclusion:** Hosting learned vision transformer models directly inside the Next.js / Vercel API bundle introduces bundle bloating, cold start violations, and OOM instability.

---

## 2. Proposed Architecture: Standalone Embedding Microservice

We propose separating visual embedding extraction into a dedicated, low-cost microservice (`apex-embed-service`):

```mermaid
graph LR
    Client[Mobile / Web Client] -->|POST /api/analyze| VercelAPI[Vercel Serverless API]
    VercelAPI -->|Stage A: Quality Gate & Crop| Sharp[Sharp in Serverless]
    VercelAPI -->|POST /v1/embed (224x224 crop)| EmbedService[Apex Embed Service (Cloud Run / Fly.io)]
    EmbedService -->|384D / 512D Vector| VercelAPI
    VercelAPI -->|Stage B: Local Cosine Search| HNSW[In-Memory Gallery Index]
    VercelAPI -->|Stage C: VLM Adjudication| Gemini[Google Gemini 3.5 Flash]
```

### Key Technical Specifications:
1. **Model Choices & Licensing:**
   - **Primary: DINOv2-small (`dinov2_vits14`)**
     - **License:** Apache-2.0 (Permissive commercial use without copyleft).
     - **Dimension:** 384 dimensions (L2-normalized).
     - **Strengths:** Self-supervised geometric and part-level attention; invariant to paint color shifts; high fine-grained discrimination between vehicle trims.
   - **Alternative: CLIP-ViT-B/32**
     - **License:** MIT (Permissive commercial use).
     - **Dimension:** 512 dimensions (L2-normalized).
     - **Strengths:** Strong semantic classification; multi-modal alignment.
2. **Runtime Environment:**
   - Lightweight Python (FastAPI + ONNX Runtime CPU) or Node.js Docker container.
   - Fixed pre-warmed instance (e.g. Google Cloud Run min-instances=1 or Fly.io `shared-cpu-1x` with 1GB RAM).
   - Keeps model weights memory-mapped in RAM, eliminating all cold starts.
3. **Latency Profile:**
   - Intra-region network transfer (Vercel us-east to Cloud Run us-east): ~15 ms.
   - ONNX CPU inference (224×224 image, batch size 1): ~28 ms.
   - Total P50 Latency: **~45 ms** (well within the sub-100ms budget for Stage B).

---

## 3. Cost & Blast-Radius Transparency Statement

> **"One user scan action causes at most 1 embedding extraction call."**
> - **Expected operation count:** 1 call per vehicle scan.
> - **Worst-case operation count:** 1 call (never retried on inference failure; Stage B fails closed to safe fallback).
> - **Failure behavior:** If the embed service is unreachable or times out (> 1500ms), Stage B falls back to the local lightweight spatial-spectral extractor or marks the candidate set as `uncertain`.
> - **Monthly Cost Estimate:**
>   - Google Cloud Run (1 instance, 1 vCPU, 1GB RAM, min-instances=0 with 1s idle timeout): ~$3.00 - $6.00 / month.
>   - Fly.io (shared-cpu-1x, 1GB RAM): ~$4.50 / month.
> - **Emergency Kill Switch:** `LEARNED_EMBEDDING_ENABLED=false` immediately bypasses the microservice and reverts to in-process feature extraction.

---

## 4. Rollback & Migration Plan

1. The Stage B retriever implements an `IEmbeddingExtractor` interface.
2. If `LEARNED_EMBEDDING_URL` is unset or `LEARNED_EMBEDDING_ENABLED=false`, the system uses local hand-built extraction seamlessly.
3. **No infrastructure will be provisioned without explicit Gate G3 owner sign-off.**
