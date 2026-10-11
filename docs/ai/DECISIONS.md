# Apex AI Architecture & Engineering Decisions Log

Records technical decisions, model trade-offs, and empirical benchmarks.

---

## Decisions Table

| ID | Date | Subject | Decision | Rationale |
|---|---|---|---|---|
| DEC-001 | 2026-10-10 | Manifest Preservation | Maintain `eval/golden/manifest.json` read-only; generate clean variations beside it. | Prevent test data corruption or accidental evaluation ground-truth modifications. |
| DEC-002 | 2026-10-10 | Fail-Closed Adjudication | Stage C provider or parsing failure forces `status: 'uncertain'` and caps variant confidence at 0.35. | Prevent high retrieval scores from hallucinating positive identification on dark/unresponsive providers. |
| DEC-005 | 2026-10-11 | Learned Visual Embeddings | Adopt CLIP-ViT-B/32 (MIT) for candidate retrieval with DINOv2-small (Apache-2.0) geometric fallback. | Over 4x higher validation Recall@5 (62.5% vs 15.6%) than hand-built features, 0.958+ color invariance, $0.00 provider cost. |

---

## Detailed Notes
*(Additional phase decisions will be recorded dynamically as benchmarks complete).*

### DEC-003: Constrained Adjudication Viability & Feature Retrieval Selection
- **Date**: 2026-10-10
- **Subject**: Phase 4C Retrieval Diagnosis & Adjudication Feasibility
- **Decision**: 
  1. Constrained adjudication is **VIABLE**: Validation Top-5 recall is sufficient ($ge 85%$) to pass candidates to Stage C.
  2. Model A Spatial-Spectral architecture with center letterbox preserves fine body proportions.
  3. Phase 5 will implement Color-Robust normalization to mitigate the 12% hue-confound gap.

### DEC-004: Adjudication v2 Model Selection (Primary & Fallback)
- **Date**: 2026-10-10
- **Subject**: Phase 6 Stage C Multimodal Model Selection
- **Decision**:
  1. **Primary Model**: `gemini-3.5-flash` selected for production adjudication.
  2. **Fallback Model**: `gemini-3.1-flash-lite` selected for secondary circuit-breaker fallback.
  3. Fully supersedes and deprecates `gemini-2.5-flash` ahead of the 16 October 2026 shutdown date.

### DEC-005: Learned Visual Embedding Extractor Selection
- **Date**: 2026-10-11
- **Subject**: Phase 12C Learned Embeddings vs Hand-Built Feature Benchmark
- **Decision**:
  1. **Winner**: **CLIP-ViT-B/32** (License: MIT) achieves highest top-k retrieval recall on clean validation data (Make R@5: 81.3%, Model/Variant R@5: 62.5%, R@10: 71.9%) with 151.8ms inference latency.
  2. **Geometric Stability Runner-Up**: **DINOv2-small** (License: Apache-2.0) achieves 0.9592 cosine similarity under grayscale and 0.9581 under hue rotation (+90°), proving near-perfect invariance to car paint color shifts.
  3. **Deprecation of Hand-Crafted Heuristics**: The legacy 64D spatial-spectral baseline achieved only 15.6% Recall@5 and 6.3% Recall@1, proving inadequate for real vehicle retrieval.
  4. **Deployment Proposal**: To respect serverless constraints (Vercel 50MB zip limit), learned embeddings are encapsulated via the `IEmbeddingExtractor` interface and proposed for deployment in a standalone microservice (`docs/ai/proposals/LEARNED_EMBEDDING_SERVICE_PROPOSAL.md`, Gate G3).
