# Owner Decisions & Gate Tracker

This document tracks all decisions, sign-offs, and gates requiring project owner approval. Independent work proceeds on all unblocked components.

---

## Spending Cap & Budget
- **Allocated Budget**: $25.00 USD (Default)
- **Current Live Provider Spend**: $0.0308 USD (Validation raw audits & benchmark trials on Gemini 3.5 Flash & 3.1 Flash Lite)
- **Running Ledger**: See [COST_LOG.md](file:///c:/Users/DELL/Downloads/Apex-main/Apex-main/docs/ai/COST_LOG.md)

---

## Tier 1 Registry Agreement (Phase 8 & 12E)
- **Scope**: 150 variants across Ferrari, Lamborghini, Porsche, McLaren, BMW, Bugatti, Koenigsegg, Pagani, Chevrolet, Ford, Nissan, Toyota, Bentley.
- **Verification Rule**: 100% verified across dual authoritative sources (Manufacturer spec sheets + Wikidata / Automobile Catalog). Zero model hallucinations; unverified values marked 'unavailable'.
- **Status**: PASSED autonomous validation (`scripts/validate_tier1_registry.mjs`).
- **Phase 12E Spot-Check Audit**: PASSED with 0.00% error rate across 35 randomly sampled variants (280 individual specifications checked with snapshot hashes). See [REGISTRY_SPOTCHECK_AUDIT.md](file:///c:/Users/DELL/Downloads/Apex-main/Apex-main/docs/ai/REGISTRY_SPOTCHECK_AUDIT.md).

---

## Gate Registry & Action Items

### [Gate G1] Manifest Promotion & Ambiguous Sample Adjudication
- **Status**: PENDING OWNER DECISION (Non-blocking: Proposed clean manifest created beside canonical)
- **Question 1**: Shall `eval/golden/manifest.json` be promoted/replaced by `eval/golden/proposed_clean_manifest.json`?
  - **Recommendation**: Yes. The proposed manifest eliminates 78 contaminated/duplicate/unverified samples while preserving all 248 test split samples untouched.
  - **Blocked Items**: Formal canonical overwriting of `eval/golden/manifest.json`. (Independent work proceeds using `proposed_clean_manifest.json` beside it).
- **Question 2**: Disposition of `REAL_BLIND_000127` (Ford Explorer IAA 2019, frame 0603 by M 93 vs test frame 0424)?
  - **Recommendation**: Maintain quarantine (`flagged_for_review`). The camera viewpoint is similar and taken at the same auto show stand on the same day.
  - **Blocked Items**: None (quarantine protects test split).
- **Question 3**: Disposition of Porsche 992 group (`REAL_BLIND_000284`, `000285`, `000286`, `000287`)?
  - **Recommendation**: Option A (maintain `000284`, `000285`, `000286` in quarantine as test leak protectors because `000287` is frozen in test).
  - **Blocked Items**: None.

---

### [Gate G2] Shipped Gallery Licensing & User Consent Policies
- **Status**: PENDING OWNER DECISION (Clarified in Phase 12F)
- **Question**: Which license tiers are authorized for inclusion in shipped client/server production materials?
  - **Finding**: 88.1% (52/59) of reference gallery images carry Share-Alike (CC-BY-SA) licenses.
  - **Recommendation**: The reference gallery must remain strictly server-side. Exclude all Share-Alike (CC-BY-SA) images from shipped client binary or public distributions until legal counsel reviews. Retain for server-side evaluation only. See [LICENSING_AND_ARCHITECTURE.md](file:///c:/Users/DELL/Downloads/Apex-main/Apex-main/docs/ai/LICENSING_AND_ARCHITECTURE.md).
  - **Blocked Items**: Shipping packaged client gallery binary containing CC-BY-SA media.

---

### [Gate G3] Infrastructure Provisioning & Database Migrations
- **Status**: PENDING OWNER DECISION (Proposal submitted in Phase 12C)
- **Question 1**: Authorization to provision a dedicated Learned Visual Embedding Microservice (Cloud Run / Fly.io, ~$4.50/mo)?
  - **Recommendation**: Authorize when moving to production staging. Learned embeddings (CLIP-ViT-B/32 & DINOv2-small) achieve 62.5% Recall@5 vs 15.6% for hand-built features, but exceed Vercel serverless package limits (50MB zip). Standalone microservice proposal documented in `docs/ai/proposals/LEARNED_EMBEDDING_SERVICE_PROPOSAL.md`.
  - **Blocked Items**: Cloud Run / Fly.io provisioning.
- **Question 2**: Hosted vector database authorization?
  - **Recommendation**: Keep local in-memory HNSW index for v2 launch (< 5,000 vectors).

---

### [Gate G4] Field-Photo Slice Collection
- **Status**: PENDING OWNER DECISION (Non-blocking: Protocol defined in Phase 11)
- **Question**: Authorization and scheduling for 300-photo real-world mobile capture campaign?
  - **Recommendation**: Conduct after Phase 10 staging validation.
  - **Blocked Items**: Physical mobile photo gathering.

---

### [Gate G5] One-Time Held-Out Test Split Benchmark Execution
- **Status**: STRICT HOLD (CLOSED — Zero test split inference permitted)
- **Question**: Authorization to execute the frozen held-out test split ($n=248$) benchmark script?
  - **Phase 12 Verdict**: **KEEP G5 CLOSED.**
  - **Reason**: Although make accuracy is high, validation benchmarking on $N \ge 300$ vehicles demonstrates that hand-crafted Stage B features produce high candidate confusion and low variant accuracy (under the 80% release target). Opening Gate G5 is recommended ONLY when the learned visual embedding service is deployed and all release targets are met on the validation pool.
  - **Blocked Items**: One-shot final test run.
