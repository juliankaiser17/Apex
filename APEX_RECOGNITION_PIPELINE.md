# APEX Recognition Pipeline Specification
**Document ID:** `APEX-SPEC-RECOG-04`  
**Revision:** `3.0.0-PROD`

---

## 1. Temporal Evidence Aggregation Pipeline

APEX rejects single-frame classification guesses. The engine combines real-time optical frame buffers, temporal tracking stability, geometric silhouette features, and server-side vision AI to verify vehicles:

```
  ┌─────────────────────────────────────────────────────────────┐
  │              TEMPORAL RECOGNITION PIPELINE                  │
  │                                                             │
  │   [Camera Frame Buffer N-2, N-1, N]                         │
  │                 ↓                                           │
  │   1. EDGE FEATURE EXTRACTION & TRACKING STABILITY           │
  │      • Centroid motion delta < 5px/frame                    │
  │      • Aspect ratio stability > 95%                         │
  │                 ↓                                           │
  │   2. HIGH-RES TARGET CROP & NORMALIZATION                   │
  │      • Dynamic crop to vehicle bounding box                 │
  │      • Exposure & contrast equalization                     │
  │                 ↓                                           │
  │   3. SECURE SERVERLESS ROUTING (/api/analyze)               │
  │      • Authenticated Bearer JWT verification                │
  │      • Multimodal Vision AI Inference (Gemini / GPT-4o)     │
  │                 ↓                                           │
  │   4. CONFIDENCE HIERARCHY EVALUATION                        │
  │      • High (>0.90) $\rightarrow$ Full Trim & Generation    │
  │      • Medium (0.75-0.89) $\rightarrow$ Exact Model Base    │
  │      • Low (0.60-0.74) $\rightarrow$ Vehicle Family         │
  │      • Insufficient (<0.60) $\rightarrow$ Approach Guidance │
  │                 ↓                                           │
  │   5. REGIONAL RARITY & AUTHENTICATION ENGINE                │
  │      • Spatial privacy offset calculation                   │
  │      • Local geographic scarcity index                      │
  │      • Supabase DB atomic card minting                      │
  └─────────────────────────────────────────────────────────────┘
```

---

## 2. Confidence Hierarchy & Fallback Protection

APEX never fabricates nonexistent trims or fake model specifications when confidence is partial:

$$\text{Identification Output} = \begin{cases}
\text{Make} + \text{Model} + \text{Generation} + \text{Exact Trim} & \text{if } C \ge 0.90 \\
\text{Make} + \text{Model} + \text{Generation} & \text{if } 0.75 \le C < 0.90 \\
\text{Make} + \text{Model Family} & \text{if } 0.60 \le C < 0.75 \\
\text{Guidance Prompt (e.g. "Front view needed")} & \text{if } C < 0.60
\end{cases}$$

Example:
* **High Confidence ($C = 0.98$):** `Porsche 911 GT3 RS (992)`
* **Medium Confidence ($C = 0.82$):** `Porsche 911 (992)`
* **Low Confidence ($C = 0.65$):** `Porsche 911 Series`
* **Insufficient ($C = 0.45$):** Non-blocking retry: `"Try a 3/4 angle for trim confirmation."`

---

## 3. Real-Time Progressive Verification Stages (No Fake Bars)

During analysis, the UI renders the real-time stage progression as each asynchronous micro-task resolves:

1. **Stage 1: `OPTICAL FEATURES RESOLVED`** (Edge detection, contours, aspect geometry validated).
2. **Stage 2: `MANUFACTURER IDENTIFIED`** (Make match resolved, e.g. `Ferrari S.p.A.`).
3. **Stage 3: `MODEL SPECIFICATION COMPUTED`** (Horsepower, engine, top speed, zero-to-hundred calculated).
4. **Stage 4: `GENERATION & TRIM CONFIRMED`** (Aero parts, body generation, production years verified).
5. **Stage 5: `REGIONAL RARITY & DATABASE VERIFIED`** (Authoritative Supabase database validation and serial assignment `#APX-XXXXXX`).
