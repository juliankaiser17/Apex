# Owner Decisions & Gate Tracker

This document tracks all decisions, sign-offs, and gates requiring project owner approval. Independent work proceeds on all unblocked components.

---

## Spending Cap & Budget
- **Allocated Budget**: $25.00 USD (Default)
- **Current Live Provider Spend**: $0.0135 USD (Validation benchmark trials on Gemini 3.5 Flash & 3.1 Flash Lite)
- **Running Ledger**: See [COST_LOG.md](file:///c:/Users/DELL/Downloads/Apex-main/Apex-main/docs/ai/COST_LOG.md)

---

## Tier 1 Registry Agreement (Phase 8)
- **Scope**: 150 variants across Ferrari, Lamborghini, Porsche, McLaren, BMW, Bugatti, Koenigsegg, Pagani, Chevrolet, Ford, Nissan, Toyota, Bentley.
- **Verification Rule**: 100% verified across dual authoritative sources (Manufacturer spec sheets + Wikidata / Automobile Catalog). Zero model hallucinations; unverified values marked 'unavailable'.
- **Status**: PASSED autonomous validation (`scripts/validate_tier1_registry.mjs`). See [registry_coverage_table.md](file:///c:/Users/DELL/Downloads/Apex-main/Apex-main/docs/ai/registry_coverage_table.md).


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
- **Status**: PENDING OWNER DECISION (Non-blocking: Design proposal created, production gallery restricted to CC-BY/CC-BY-SA/Public Domain with proper attribution)
- **Question**: Which license tiers are authorized for inclusion in the shipped client/server production gallery?
  - **Recommendation**: Only CC0, Public Domain, CC-BY 2.0/3.0/4.0, and CC-BY-SA with prominent in-app attribution document. No non-commercial (CC-NC) or undocumented licenses in production gallery.
  - **Blocked Items**: Shipping proprietary or commercial packaged gallery binary.

---

### [Gate G3] Infrastructure Provisioning & Database Migrations
- **Status**: PENDING OWNER DECISION (Non-blocking: In-memory local vector index implemented with zero external cost; migrations kept as proposals in `docs/ai/proposals/`)
- **Question**: Authorization to provision hosted vector database (e.g., Pinecone/Qdrant/pgvector) and apply schema migrations for AI flywheel?
  - **Recommendation**: Keep local in-memory HNSW/cosine index for v2 launch (< 5,000 vectors); evaluate hosted vector database only when catalogue exceeds 50,000 reference embeddings.
  - **Blocked Items**: Live DB migrations and cloud infra provisioning.

---

### [Gate G4] Field-Photo Slice Collection
- **Status**: PENDING OWNER DECISION (Non-blocking: Collection protocol and capture app specification created in Phase 11)
- **Question**: Authorization and scheduling for 300-photo real-world mobile capture campaign across diverse weather, night, and occlusions?
  - **Recommendation**: Conduct after Phase 10 shadow validation is verified in staging.
  - **Blocked Items**: Physical execution of mobile photo gathering.

---

### [Gate G5] One-Time Held-Out Test Split Benchmark Execution
- **Status**: STRICT HOLD (Zero test split inference permitted until explicit owner sign-off)
- **Question**: Authorization to execute the frozen held-out test split ($n=248$) benchmark script?
  - **Recommendation**: Execute strictly once after Phases 4 through 10 are completely validated and verified on dev/validation splits.
  - **Blocked Items**: One-shot final test run.
