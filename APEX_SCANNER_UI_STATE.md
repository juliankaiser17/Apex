# APEX Scanner UI State & Visibility Matrix
**Document ID:** `APEX-SPEC-UI-03`  
**Revision:** `3.2.0-PROD`

---

## 1. Scanner UI Visibility Matrix

The scanner UI is strictly driven by the FSM state. Components are unmounted or rendered with zero opacity when not applicable:

| UI Component | `NO_CAR` (Clean Camera) | `CAR_DETECTED` (Transient) | `POTENTIAL_DISCOVERY` (Stable) | `ANALYZING` (Pipeline) | `LOCKED` (Target Lock) | `DISCOVERED` (Reveal) |
|---|---|---|---|---|---|---|
| **Live Camera Feed** | **Active (100%)** | **Active (100%)** | **Active (100%)** | **Active (80% Vis)** | **Active (65% Vis)** | Background Blur |
| **Top Hunter Mode Tag** | Visible | Visible | Visible | Visible | Visible | Hidden |
| **Shutter Button** | Visible | Visible | Visible | Processing | Locked | Hidden |
| **Gallery Upload Button** | Visible | Visible | Visible | Hidden | Hidden | Hidden |
| **Target Diamond Reticle** | **HIDDEN** | Visible (Dim) | Visible (Solid) | Visible (Solid) | Contracted | Hidden |
| **"Potential Discovery" Tag** | **HIDDEN** | **HIDDEN** | **VISIBLE** | **HIDDEN** | **HIDDEN** | Hidden |
| **Transparent Pipeline Panel** | **HIDDEN** | **HIDDEN** | **HIDDEN** | **VISIBLE (Glass)** | **VISIBLE (Glass)** | Hidden |
| **Approach Guidance Bar** | Contextual | Contextual | Contextual | Hidden | Hidden | Hidden |
| **3D Collectible Card** | Hidden | Hidden | Hidden | Hidden | Hidden | **VISIBLE** |

---

## 2. Invariant Rules
1. **Clean Screen Axiom:** When no car is detected, no bounding boxes, no fake discovery labels, and no pipeline progress bars may appear on the viewport.
2. **Transparent Overlay Axiom:** The Recognition Pipeline panel must occupy $\le 28\%$ of viewport area, with glassmorphic transparency (`backdrop-filter: blur(12px)`, background opacity $\le 0.85$) ensuring $70–90\%$ of the live camera remains unobstructed.
3. **Grace Period Recovery:** When a detected car exits the camera frame, the UI enters a 1,500ms `TARGET_LOST` grace period before smoothly fading back to clean camera view.
