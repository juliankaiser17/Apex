# APEX Motion System Specification
**Document ID:** `APEX-SPEC-MOTION-06`  
**Revision:** `3.0.0-PROD`

---

## 1. Motion Philosophy

APEX rejects cartoonish bounce, random particle spam, and noisy HUD jitter. The motion language reflects **precision automotive engineering, high-performance optical telemetry, and restrained luxury**.

### 1.1 Core Motion Rules
1. **Fast for Confirmation ($< 150\text{ms}$):** Target acquisition, taps, and lock transitions are instant and responsive.
2. **Slow & Reverent for Mythic Discoveries ($1.2\text{s} - 2.5\text{s}$):** High-tier discoveries unfold with cinematic weight and spatial depth.
3. **Purpose-Driven Elasticity:** Springs are damped with high tension to feel like mechanical carbon-fiber calipers rather than jelly.

---

## 2. Spring & Easing Token Constants

```typescript
export const APEX_SPRINGS = {
  // Mechanical Lock: Snaps tight with zero overshoot
  LOCK_SNAP: { type: 'spring', stiffness: 480, damping: 36, mass: 0.8 },

  // Card Parallax Tilt: Smooth, weighted return to resting angle
  CARD_TILT: { type: 'spring', stiffness: 220, damping: 24, mass: 1.0 },

  // Silhouette Assembly: Controlled reveal of vehicle lines
  SILHOUETTE_RESOLVE: { duration: 0.75, ease: [0.16, 1, 0.3, 1] },

  // Specular Reflection Sweep: 45-degree holographic sheen across card
  SHEEN_SWEEP: { duration: 1.4, ease: [0.25, 0.1, 0.25, 1] },

  // Environment Dimming Vignette: Gentle ambient reduction
  VIGNETTE_FADE: { duration: 0.35, ease: 'easeOut' },

  // Rarity Badge Impact: Heavy mechanical stamp with micro-shudder
  BADGE_STAMP: { type: 'spring', stiffness: 600, damping: 28, mass: 0.5 }
};
```

---

## 3. The Signature "Target Lock" Choreography

When Hunter Mode transitions from `TRACKING` $\rightarrow$ `LOCKED`:

```
Timeline:
t = 0ms     [Background Vignette]  Ambient camera feed dims by 35% with 12px blur
t = 40ms    [Target Diamond]       Reticle geometry tightens from 220px to 140px
t = 120ms   [Frequency Glide]      Audio ascends from 440Hz to 880Hz resonance
t = 180ms   [Solid Orange Lock]    Geometry turns solid #FF4500 with corner calipers
t = 220ms   [Heavy Haptic]         Dual-impulse mechanical haptic trigger
t = 300ms   [Pipeline Activation]  Pipeline stages illuminate progressively
```

---

## 4. 3D Collectible Card Physics & Parallax

The APEX Collectible Card features interactive 3D physics:
* **Gyroscope & Touch Vector Mapping:**
  $$\theta_x = -14^\circ \cdot \left(\frac{y - y_0}{h/2}\right), \quad \theta_y = 14^\circ \cdot \left(\frac{x - x_0}{w/2}\right)$$
* **Specular Sheen Light Angle:**
  The reflective highlight coordinates $(S_x, S_y)$ follow the inverse light vector, illuminating the carbon-fiber / tarmac texture under the vehicle photograph.
* **Depth Separation:**
  The vehicle image floats at `translateZ(24px)`, the rarity badge at `translateZ(36px)`, and the metadata telemetry at `translateZ(12px)`.
