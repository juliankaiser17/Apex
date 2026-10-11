# Apex AI Cost & Spending Log

Tracks live model inference expenditures, token consumption, and budget ceilings.

---

## Spending Limit
- **Approved Budget Cap**: $25.00 USD
- **Current Spend**: $0.5188 USD
- **Remaining Cap**: $24.4812 USD

---

## Logged Runs

| Timestamp | Run Type | Target Split | Sample Count | Estimated Cost | Actual Cost | Running Total | Notes |
|---|---|---|---|---|---|---|---|
| 2026-10-10 | Pre-flight Setup | N/A | 0 | $0.00 | $0.00 | $0.00 | Baseline cost tracking initialized |
| 2026-10-10 | Phase 6 VLM Benchmark | Validation Sub-Slice | 90 | $0.0135 | $0.0135 | $0.0135 | Live comparative evaluation of gemini-3.5-flash vs 3.1-flash-lite vs 2.5-flash |
| 2026-10-11 | Phase 12A Raw Response Audit | Clean Validation (N=32) | 64 | $0.0125 | $0.0125 | $0.0260 | Live Gemini 3.5 Flash calls on candidate present/absent conditions; raw responses stored |
| 2026-10-11 | Phase 12D Release Validation | Validation Pool (N=316) | 316 | $0.4928 | $0.4928 | $0.5188 | Live full v2 pipeline end-to-end evaluation across 123 distinct classes |

---

## Cost Invariants
1. Single scan inference bound: $\le 2$ external provider requests.
2. 429 quota exhaustion is fatal (0 retries).
3. Max 1 retry on 5xx or JSON parse failure.
4. Test split runs strictly forbidden without Gate G5 signoff.
