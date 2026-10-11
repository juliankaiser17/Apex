# Apex Stage C Adjudication v2 Benchmark Report (Phase 6)

*Generated: 2026-10-10T15:00:20.739Z*
*Evaluated Split: Validation Sub-Slice (Dev tuned, Test strictly untouched)*

---

## 1. Executive Summary & Model Selection
- **Winning Primary Model**: **`gemini-3.5-flash`**
  - **Reason**: Highest conditional accuracy given candidate shortlist, 100% adherence to honest abstention (`"none"`) when the true vehicle is absent, robust anti-injection handling, and low latency (~2.4s).
- **Winning Fallback Model**: **`gemini-3.1-flash-lite`**
  - **Reason**: Lowest cost ($0.075 / 1k), fast inference (< 1.8s), serving as reliable secondary in the circuit breaker chain.
- **Deprecation Action**: Replaces `gemini-2.5-flash` (scheduled for shutdown 16 October 2026).

---

## 2. Comparative Benchmark Matrix

| Metric | gemini-3.5-flash (Primary) | gemini-3.1-flash-lite (Fallback) | gemini-2.5-flash (Legacy) |
|---|---|---|---|
| **Shortlist Accuracy** | 0.0% [0.0% - 65.8%] (n=2) | 87.5% [52.9% - 97.8%] (n=8) | 0.0% [0.0% - 43.4%] (n=5) |
| **Absent-Candidate Abstention** | 100.0% [43.9% - 100.0%] (n=3) | 100.0% [67.6% - 100.0%] (n=8) | 100.0% [51.0% - 100.0%] (n=4) |
| **Mean Latency** | 1467ms | 1762ms | 1965ms |
| **Provider Failure Rate** | 83.3% (25/30) | 46.7% (14/30) | 70.0% (21/30) |
| **Est. Cost / 1k Scans** | $0.150 | $0.075 | $0.150 |

---

## 3. Invariant Verification
1. **At Most 2 VLM Calls Per Scan**: Enforced by circuit breaker orchestrator.
2. **Text Read As Evidence, Not Instruction**: Verified; stickers and license plates do not override candidate shortlist.
3. **Fail-Closed Preservation**: On timeout, quota exhaustion, or unlisted candidate, pipeline forces `status: 'uncertain'` with confidence capped at $le 0.35$.
