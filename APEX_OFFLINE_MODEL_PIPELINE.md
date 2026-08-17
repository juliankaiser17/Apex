# APEX Offline Model Pipeline Specification
**Document ID:** `APEX-SPEC-MODEL-04`  
**Revision:** `3.2.0-PROD`

---

## 1. Optical Feature Extraction Pipeline

The offline classifier extracts lightweight visual descriptors from video/canvas frames without requiring external network calls:

```
  ┌─────────────────────────────────────────────────────────────┐
  │              OPTICAL FEATURE EXTRACTION                     │
  │                                                             │
  │   1. GEOMETRIC ASPECT RATIO                                 │
  │      $R = W / H$ where low-slung supercars $\approx 2.1 - 2.5$, │
  │      coupes $\approx 1.8 - 2.1$, SUVs $\approx 1.3 - 1.6$.  │
  │                                                             │
  │   2. HIGH-PASS EDGE GRADIENT DENSITY                        │
  │      Sobel filter gradient convolution on $64 \times 36$    │
  │      normalized bounding patch.                             │
  │                                                             │
  │   3. CHROMATIC COLOR CLUSTERING                             │
  │      RGB $\rightarrow$ HSL histogram binning to identify    │
  │      dominant bodywork finish.                              │
  │                                                             │
  │   4. BILATERAL SYMMETRY SCORE                               │
  │      Horizontal axis symmetry comparison for front/rear     │
  │      versus 3/4 perspective classification.                 │
  └─────────────────────────────────────────────────────────────┘
```

---

## 2. Multi-Frame Temporal Evidence Aggregator

Rather than predicting on a single noisy frame, the aggregator tracks the last $N = 5$ frames:

$$S_k = \frac{1}{N} \sum_{t=1}^{N} \cos\left(\vec{f}_t, \vec{v}_k\right) \cdot w_{\text{clarity}}(t)$$

Where $\vec{f}_t$ is the normalized frame feature vector, $\vec{v}_k$ is the canonical database vehicle vector, and $w_{\text{clarity}}(t)$ is the sharpness weight of frame $t$.

The top candidate satisfying $S_k \ge \theta_{\text{detect}}$ is promoted to primary match.
