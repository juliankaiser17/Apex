# Apex AI Identification Engineering Progress Log

This document tracks autonomous progress across all phases from Phase 4 through release readiness.

---

## Active Status Summary
- **Current Branch**: `ai/identification`
- **Baseline Commit**: `80a25a320ffeff605c9d2528e29e102ce328e01c`
- **Overall Pipeline State**: Phase 3.5 Complete -> Phase 4 In Progress

---

## Phase Execution Roadmap

| Phase | Description | Status | Gate Dependencies | Notes |
|---|---|---|---|---|
| **Phase 4A** | Provenance Integrity & Licensing (1,001 items) | Completed | Gate G1 | Live Commons metadata verified, `licenses.csv`, `ATTRIBUTION.md` generated |
| **Phase 4B** | Near-Duplicate & Leakage Guard (pHash, dHash, disjointness) | Completed | None | CI checks `check_leakage.mjs`, `check_gallery_test_disjoint.mjs` PASSED |
| **Phase 4C** | Retrieval Diagnostics on Validation | Completed | None | Recall @ 1,3,5,10 with Wilson CIs, hard pairs, `retrieval_report.md` |
| **Phase 4D** | Provider Resilience & Circuit Breaker | Completed | None | Circuit breaker + fallback provider chain implemented, daily canary active |
| **Phase 5** | Retrieval v2 Implementation | Completed | Gate G3 (hosted infra) | In-memory vector store, color-robust 64D index, open-set detection |
| **Phase 6** | Adjudication v2 Benchmarking | Completed | None | `gemini-3.5-flash` primary & `gemini-3.1-flash-lite` fallback chosen |
| **Phase 7** | Fusion, Calibration & Decision Policy v2 | Completed | None | Temperature scaling, multi-photo session fusion, contract tests passed |
| **Phase 8** | Registry & Verified Specs (Stage F) | Completed | None | 150 variants compiled, 100% verified, validated by script & coverage table |
| **Phase 9** | Flywheel Design (Stage G Proposals) | Completed | Gate G2, G3 | `STAGE_G_FLYWHEEL_DESIGN.md` & `20261010_stage_g_flywheel_schema.sql` |
| **Phase 10** | Rollout & Observability | Completed | None | `telemetry.ts`, shadow mode, circuit breaker, verified in `test_shadow_mode.mjs`, `ROLLOUT_PLAN.md` |
| **Phase 11** | Field Slice Protocol & Test Runner Preparation | Completed | Gate G4, G5 | Protocol written (`FIELD_PHOTO_COLLECTION_PROTOCOL.md`), runner pre-staged (`run_final_test_benchmark.mjs` with Gate G5 lock), report template ready |
| **Phase 12** | Evidence Audit & Release-Grade Validation | Completed | Gate G5 | Validation funnel audit (255→32), Cloudflare v1 health verified (9.4s latency / 10k neuron cap), learned embeddings benchmark (CLIP & DINOv2 vs handbuilt), full validation run ($N \ge 300$, 123 classes), 0.00% registry error rate, Gate G5 held closed |

---

## Active Status Summary
Phase 12 (Evidence Audit & Release-Grade Validation) is complete. 
- **12A (Audit)**: Validation attrition funnel documented in `docs/ai/EVIDENCE_AUDIT.md`. Cumulative spend reconciled ($0.0260 USD = 90 Phase 6 + 64 Phase 12A raw provider responses stored in `eval/raw_responses/adjudication_v2_validation_raw.json`). Held-out group-disjoint ECE is 13.76% (vs overfit in-sample 4.2%).
- **12B (v1 Health)**: Cloudflare Llama 3.2 11B Vision is operational (HTTP 200, Meta license active, 5/5 real vehicle pass). Failure root cause identified: P50 latency is 9,372 ms and daily free limit is 10,000 neurons (~60 scans/day), triggering HTTP 429 and fail-closed `uncertain` without offline fallback. Documented in `docs/ai/V1_HEALTH.md`.
- **12C (Learned Embeddings)**: Implemented DINOv2-small (Apache-2.0, 384D) and CLIP-ViT-B/32 (MIT, 512D) via ONNX. Both outperform handbuilt features by > 4x on Recall@5 (62.5% vs 15.6%). DINOv2 achieves 0.958+ color invariance across grayscale and hue rotation. Microservice proposal documented in `docs/ai/proposals/LEARNED_EMBEDDING_SERVICE_PROPOSAL.md`. Recorded in `docs/ai/DECISIONS.md`.
- **12D (Release Validation)**: Evaluated full pipeline on $N \ge 300$ validation pool across 123 classes. Metrics reported with Wilson 95% CIs and held-out calibration.
- **12E (Registry Spot-Check)**: Audited 35 randomly sampled Tier 1 variants (280 technical specs) against primary manufacturer archives and Wikidata; 0.00% error rate (target $\le 2.0\%$). Documented in `docs/ai/REGISTRY_SPOTCHECK_AUDIT.md`.
- **12F (Licensing & Architecture)**: Shipped gallery location clarified (server-side only, 0 gallery images in client bundle). License census: 88.1% CC-BY-SA, recommended for server-side evaluation only. Retrieval decisive path confirmed disabled by default. Gemini model IDs decoupled from deprecated 2.5-flash. Documented in `docs/ai/LICENSING_AND_ARCHITECTURE.md`.
- **Gate G5**: Remains strictly closed until learned embedding microservice is deployed and all release targets are met on the validation pool.


