# APEX Offline Recognition Architecture Specification
**Document ID:** `APEX-SPEC-OFFLINE-01`  
**Revision:** `3.2.0-PROD`

---

## 1. System Overview

APEX provides deep, offline-capable vehicle recognition for field exploration without requiring persistent cellular network connectivity. The offline recognition architecture operates in layers:

```
  ┌─────────────────────────────────────────────────────────────┐
  │            OFFLINE RECOGNITION ARCHITECTURE                 │
  │                                                             │
  │   [Camera Hardware Sensor Stream @ 30 FPS]                  │
  │                 ↓                                           │
  │   1. REAL-TIME OPTICAL VEHICLE DETECTOR                     │
  │      • High-pass edge gradient analysis                     │
  │      • Bounding contour aspect ratio [1.1 : 1 to 2.8 : 1]   │
  │      • Luminance variance & bilateral symmetry check        │
  │                 ↓                                           │
  │   2. TEMPORAL STABILITY GATE                                │
  │      • Requires persistence across $\ge 3$ consecutive frames│
  │      • Centroid motion delta $< 0.12$ in normalized space   │
  │                 ↓                                           │
  │   3. VISUAL FEATURE EXTRACTION                              │
  │      • Aspect silhouette index                              │
  │      • Optical edge density vector                          │
  │      • Dominant chromatic cluster                           │
  │                 ↓                                           │
  │   4. LOCAL NORMALIZED CATALOG CLASSIFIER                    │
  │      • Scalable database of 60+ curated automotive models   │
  │      • Cosine similarity ranking over feature descriptors   │
  │                 ↓                                           │
  │   5. CONFIDENCE HIERARCHY RESOLVER                          │
  │      • Manufacturer $\ge 0.90 \rightarrow$ Model $\ge 0.80$  │
  │        $\rightarrow$ Generation $\ge 0.70 \rightarrow$ Trim  │
  │                 ↓                                           │
  │   6. LOCAL VEHICLE SPECIFICATION BINDING                    │
  │      • Engine, HP, top speed, 0-100, origin country         │
  │                 ↓                                           │
  │   7. ASYNC SERVER AUTHORITATIVE COMMIT (When Online)        │
  │      • Cryptographic digest verification via /api/analyze   │
  │      • Atomic Supabase database card minting                │
  └─────────────────────────────────────────────────────────────┘
```

---

## 2. Confidence Hierarchy & Non-Hallucination Axiom

**Axiom:** `MAKE ≠ MODEL ≠ GENERATION ≠ TRIM`.  
The recognition engine will never hallucinate a sub-trim or special edition unless distinct aero/badging features pass the corresponding confidence gate:

$$\text{Resolved Identity} = \begin{cases}
\text{Make} + \text{Model} + \text{Generation} + \text{Trim} & \text{if } C_{\text{trim}} \ge 0.85 \\
\text{Make} + \text{Model} + \text{Generation} & \text{if } C_{\text{gen}} \ge 0.75 \\
\text{Make} + \text{Model} & \text{if } C_{\text{model}} \ge 0.65 \\
\text{Manufacturer Only} & \text{if } C_{\text{make}} \ge 0.55 \\
\text{Unidentified Automobile} & \text{if } C_{\text{make}} < 0.55
\end{cases}$$

---

## 3. Offline vs. Server Authority Separation

* **Client / Offline Model:** Resolves optical recognition, displays instant technical specifications, powers UI discovery animation.
* **Server Authority:** Computes regional rarity index, awards XP/level progression, mints the official unique card serial `#APX-XXXXXX`, and stores persistent garage records.
