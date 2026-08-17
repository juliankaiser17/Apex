# APEX Hunter Mode Engine Specification
**Document ID:** `APEX-SPEC-HUNT-02`  
**Revision:** `3.0.0-PROD`

---

## 1. Hunter Mode Concept

HUNTER MODE is not an alternate camera filter—it is an **active intelligence layer** that continuously sweeps the real-world environment for high-value discoveries, rare coachwork, unusual body styles, and active hunt objectives.

### 1.1 The Hunter Loop
```
  ┌────────────────────────────────────────────────────────┐
  │                   THE HUNTER LOOP                      │
  │                                                        │
  │     SEARCHING                                          │
  │         ↓                                              │
  │     TARGET DETECTED                                    │
  │         ↓                                              │
  │     TARGET TRACKING                                    │
  │         ↓                                              │
  │     TARGET INTEREST (Recommendation / Scoring)         │
  │         ↓                                              │
  │     TARGET LOCK (Signature Haptic & Optical Resonance) │
  │         ↓                                              │
  │     REAL PROGRESSIVE ANALYSIS                          │
  │         ↓                                              │
  │     MATCH VERIFIED                                     │
  │         ↓                                              │
  │     DISCOVERY & CARD COLLECTED                         │
  │         ↓                                              │
  │     OBJECTIVE PROGRESSION UPDATED                      │
  │         ↓                                              │
  │     AUTO-RETURN TO SEARCHING (Next Target)             │
  └────────────────────────────────────────────────────────┘
```

---

## 2. Dynamic Target Ranking Matrix

When multiple vehicles are present in the viewfinder, Hunter Mode scores each candidate $T_i$ using a multi-factor heuristics equation:

$$S(T_i) = w_1 \cdot C_{\text{detect}} + w_2 \cdot A_{\text{vis}} + w_3 \cdot Q_{\text{clarity}} + w_4 \cdot (1 - O_{\text{occlusion}}) + w_5 \cdot U_{\text{novelty}} + w_6 \cdot H_{\text{objective}}$$

Where:
* $C_{\text{detect}}$: Optical detection confidence $[0, 1]$.
* $A_{\text{vis}}$: Normalized visible vehicle area relative to frame.
* $Q_{\text{clarity}}$: Frame sharpness and edge contrast index.
* $O_{\text{occlusion}}$: Estimated foreground obstruction ratio.
* $U_{\text{novelty}}$: Provisional novelty signal (e.g. uncollected make/model in user garage).
* $H_{\text{objective}}$: Relevance multiplier for active player Daily Quests & Event Missions.

The candidate with the highest composite score $S(T_i)$ is awarded the **`RECOMMENDED TARGET`** badge on HUD.

---

## 3. Real-Time Dynamic Approach Guidance

When visual confidence is insufficient for authoritative server matching, the Approach Guidance System provides **exactly one** real-time contextual micro-instruction:

| Condition Detected | HUD Guidance Prompt | Technical Trigger |
|---|---|---|
| Target is too small in frame ($A_{\text{vis}} < 0.15$) | `"MOVE CLOSER TO VEHICLE"` | Bounding box width < 30% viewport width |
| Camera velocity or gyro acceleration is high | `"HOLD STEADY"` | High frame-to-frame pixel delta / IMU jitter |
| Severe perspective distortion / flat front | `"TRY A 3/4 ANGLE"` | Aspect ratio < 0.95 with front-face symmetry |
| Foreground obstruction $> 30\%$ | `"VEHICLE PARTIALLY BLOCKED"` | Grid occlusion heuristic > 0.30 |
| Ambient luminance $< 20$ lux | `"LOW LIGHTING — MOVE CLOSER"` | Histogram luminance mean < 35 |
| Fast lateral panning | `"REDUCE MOTION"` | Optical flow horizontal vector > threshold |

---

## 4. Contextual Objectives & Progression Feedback

Hunter Mode interfaces with user progression without breaking the hunt immersion:
* Active Hunter Objectives are displayed in a clean floating micro-pill (e.g. `ITALIAN EXOTICS: 2/5 FOUND` or `3 VINTAGE VEHICLES: 1/3`).
* Upon completing a discovery, the HUD displays immediate mission delta:
  $$\text{Objective Updated} \longrightarrow +150\text{ XP} \longrightarrow \text{Hunter Streak Extended}$$
* The **`CONTINUE HUNT`** action immediately restores the minimal live viewfinder in $< 300\text{ms}$.
