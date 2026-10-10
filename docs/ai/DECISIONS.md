# Apex AI Architecture & Engineering Decisions Log

Records technical decisions, model trade-offs, and empirical benchmarks.

---

## Decisions Table

| ID | Date | Subject | Decision | Rationale |
|---|---|---|---|---|
| DEC-001 | 2026-10-10 | Manifest Preservation | Maintain `eval/golden/manifest.json` read-only; generate clean variations beside it. | Prevent test data corruption or accidental evaluation ground-truth modifications. |
| DEC-002 | 2026-10-10 | Fail-Closed Adjudication | Stage C provider or parsing failure forces `status: 'uncertain'` and caps variant confidence at 0.35. | Prevent high retrieval scores from hallucinating positive identification on dark/unresponsive providers. |

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
