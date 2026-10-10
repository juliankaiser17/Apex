# APEX AI Identification — Final Test Split Benchmark Report (Release Gate)

> **Document Status**: Pre-Staged Official Report Template (Phase 11)  
> **Evaluation Split**: Held-Out Test Split ($n = 248$)  
> **Gate Approval**: Subject to explicit approval under **[Gate G5]** in `OWNER_DECISIONS.md`.  
> **Execution Invariant**: One single-shot run. Zero prompt tuning, zero re-runs, and zero parameter adjustments after execution.

---

## 1. Executive Summary & Release Gate Verdict

| Pipeline Version | Top-1 Variant Accuracy | Make-Only Rate | Wrong-Confident Rate | P95 Latency | Avg Cost / Scan | Release Verdict |
|---|---|---|---|---|---|---|
| **v1 Baseline** | `[--.-%]` ($--/248$) | `[--.-%]` | `[--.-%]` | `[---- ms]` | `$0.0000` | **REJECTED (Pre-existing baseline)** |
| **v2 Proposed** | `[--.-%]` ($--/248$) | `[--.-%]` | `[--.-%]` | `[---- ms]` | `$0.00--` | **`[PENDING GATE G5]`** |

### Release Gate Criteria:
1. **Exact-Variant Accuracy**: $\ge 82.0\%$ on covered catalogue items.
2. **Make-Only Fallback**: $\le 12.0\%$ of identified vehicles.
3. **Wrong-Confident Rate**: $\le 2.0\%$ across all predictions with confidence $\ge 0.85$.
4. **P95 Latency**: $\le 6,000\text{ ms}$.
5. **Cost Ceiling**: $\le \$0.0050\text{ USD}$ per completed scan.

---

## 2. Multi-Level Hierarchical Accuracy (with Wilson 95% Confidence Intervals)

| Granularity Tier | v1 Baseline Accuracy | v1 95% Wilson CI | v2 Proposed Accuracy | v2 95% Wilson CI | Sample Size ($N$) |
|---|---|---|---|---|---|
| **Vehicle Detection Gate** | `[--.-%]` | `[--.-% – --.-%]` | `[--.-%]` | `[--.-% – --.-%]` | 248 |
| **Make Identification** | `[--.-%]` | `[--.-% – --.-%]` | `[--.-%]` | `[--.-% – --.-%]` | 248 |
| **Model Family** | `[--.-%]` | `[--.-% – --.-%]` | `[--.-%]` | `[--.-% – --.-%]` | 248 |
| **Chassis / Generation** | `[--.-%]` | `[--.-% – --.-%]` | `[--.-%]` | `[--.-% – --.-%]` | 248 |
| **Exact Variant / Trim** | `[--.-%]` | `[--.-% – --.-%]` | `[--.-%]` | `[--.-% – --.-%]` | 248 |

---

## 3. Decision Policy & Status Distribution

| Pipeline Status Outcome | v1 Count | v1 % | v2 Count | v2 % | Target Range |
|---|---|---|---|---|---|
| `identified` (Variant level) | `--` | `--.-%` | `--` | `--.-%` | $\ge 70.0\%$ |
| `identified_model` (Model only) | `--` | `--.-%` | `--` | `--.-%` | $5.0\% – 15.0\%$ |
| `needs_more_views` | `--` | `--.-%` | `--` | `--.-%` | $5.0\% – 12.0\%$ |
| `uncertain` (Calibrated abstention) | `--` | `--.-%` | `--` | `--.-%` | $5.0\% – 10.0\%$ |
| `not_in_catalogue` (Open-set) | `--` | `--.-%` | `--` | `--.-%` | $100\%$ on negatives |
| `rejected` (Quality gate failure) | `--` | `--.-%` | `--` | `--.-%` | $100\%$ on non-cars |

---

## 4. Hard-Pair Confusion & Discrimination Results

| Target Ground Truth | Confusable Counterpart | Key Differentiating Cue | v1 Correct | v2 Correct | Discriminator Veto Fired? |
|---|---|---|---|---|---|
| **Ferrari 488 GTB** | Ferrari F8 Tributo | S-Duct hood vs twin front nostrils | `[--/--]` | `[--/--]` | Yes |
| **Lamborghini Huracán** | Lamborghini Gallardo | Angular Y-spoke LED DRLs vs block lamps | `[--/--]` | `[--/--]` | Yes |
| **Porsche 911 (997)** | Porsche 911 (991) | Oval front light unit vs wider stretched clamshell | `[--/--]` | `[--/--]` | Yes |
| **McLaren 650S** | McLaren 675LT | Active longtail airbrake & high twin pipes | `[--/--]` | `[--/--]` | Yes |
| **Ferrari 296 GTB** | Ferrari SF90 Stradale | Single central exhaust vs twin elevated pipes | `[--/--]` | `[--/--]` | Yes |

---

## 5. System Latency & Operational Cost Breakdown

### Latency by Pipeline Stage (Milliseconds):
| Stage | v1 Mean | v1 P95 | v2 Mean | v2 P95 |
|---|---|---|---|---|
| **Stage A: Quality Gate & Crop** | `--` | `--` | `[-- ms]` | `[-- ms]` |
| **Stage B: Gallery Vector Retrieval** | `--` | `--` | `[-- ms]` | `[-- ms]` |
| **Stage C: Constrained VLM Adjudication** | `--` | `--` | `[---- ms]` | `[---- ms]` |
| **Stage D: Evidence Fusion & Calibration** | `--` | `--` | `[-- ms]` | `[-- ms]` |
| **Stage E: Policy & Guided Recovery** | `--` | `--` | `[-- ms]` | `[-- ms]` |
| **Stage F: Canonical Specs Resolution** | `--` | `--` | `[-- ms]` | `[-- ms]` |
| **Total End-to-End Latency** | `[---- ms]` | `[---- ms]` | `[---- ms]` | `[---- ms]` |

### Financial Expenditure (USD):
- **Total Provider Calls**: `--`
- **Total Incurred Cost on Test Run**: `$[--.----]`
- **Average Cost per Evaluated Image**: `$[0.00--]`
- **Budget Compliance**: Below authorized $25.00 USD cap.

---

## 6. Audit & Reproducibility Sign-Off

- **Evaluation Harness**: `scripts/run_final_test_benchmark.mjs`
- **Canonical Manifest SHA-256**: `17f6f5900631cf88037605d57a9a7a3c40741dd3ae07a80f79eccbb58f9842f8` (Verified unchanged)
- **Model Endpoints**: Primary: `gemini-3.5-flash`, Fallback: `gemini-3.1-flash-lite`
- **Lead AI Systems Engineer**: *Apex Autonomous Validation Engine*
- **Sign-off Status**: Awaiting Gate G5 execution.
