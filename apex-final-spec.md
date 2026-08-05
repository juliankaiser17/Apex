# APEX — FINAL DEFINITIVE SPECIFICATION
### Design Philosophy: IMMACULATE
### Rule: If it isn't real, it doesn't exist on screen.
### Built for Gemini — zero ambiguity, every value explicit.

---

## THE IMMACULATE PRINCIPLE

Immaculate means: pristine, honest, purposeful.

Every screen in Apex follows three rules:
1. **If data doesn't exist, the screen is empty.** Not filled with fakes.
2. **If it's on screen, it earns its place.** No decoration for decoration's sake.
3. **Emptiness is a design choice, not a failure.** A new app with zero posts
   should look like a luxury showroom with empty stands — exclusive, not broken.

What this removes from every previous spec version:
- ❌ Fake "Nearby Discoveries" with placeholder cars
- ❌ Simulated hunt zones that don't exist
- ❌ Fake community feed posts
- ❌ Blurred fake locations
- ❌ Hardcoded/demo data of any kind
- ❌ Any UI element that only appears when there's fake data behind it

What replaces them:
- ✅ Honest empty states that are so beautiful they motivate the first post
- ✅ Real GPS from the device (user controls sharing, but the data is always real)
- ✅ Hunts only when a real user triggers one
- ✅ Feed shows what exists — nothing when no one has posted

---

## SECTION 1 — DESIGN SYSTEM (FINAL)

### Palette — ASPHALT (Unchanged, Locked)
```
BACKGROUNDS
--void:     #080808    App background. Warm near-black.
--carbon:   #111111    Cards, sheets, surfaces.
--tarmac:   #1A1A1A    Elevated elements inside cards.
--gridline: #2C2C2C    Borders, dividers, separators.
--smoke:    #383838    Disabled, inactive.

BRAND (TWO COLOURS ONLY — NO OTHERS)
--ignition: #FF4500    Primary orange. CTAs, active states, XP, rarity glows.
--heat:     #FF6A00    Lighter orange. Glow, hover, fire effects.

ACHIEVEMENTS
--gold:     #FFA500    Legendary tier only. Achievement gold.
--fire:     #FF2200    Mythic tier only.

TEXT
--chalk:    #F0EBE3    Primary. Warm white, not cold.
--dust:     #9A9088    Secondary.
--void-txt: #5A5550    Tertiary, disabled, placeholder.

RARITY (Locked — do not change)
--r-common:   #787878  Greyed tarmac
--r-uncommon: #3DAA6A  Racing green
--r-rare:     #E8A020  Warm amber
--r-epic:     #C85000  Burnt deep orange
--r-legendary:#FFA500  Gold
--r-mythic:   #FF2200  Fire red + animated gold

SYSTEM
--success:  #2ECC71
--danger:   #FF3B30
--warning:  #FFA500

RULE: No purple. No blue. No teal. No pink. These do not exist in Apex.
```

### Typography (Locked)
```
DISPLAY:  Bebas Neue          — Car names, XP, levels, celebration screens
BODY:     DM Sans             — All readable text, captions, body copy
DATA:     Barlow Condensed    — Stats, specs, timers, numbers

Import via Google Fonts. No system fonts.

Scale:
--t-micro:   10px  DM Sans 500     — Labels, pills, chips
--t-caption: 12px  DM Sans 400     — Supporting text
--t-body:    15px  DM Sans 400     — Body copy
--t-ui:      15px  DM Sans 600     — Buttons, nav labels
--t-title:   18px  DM Sans 600     — Section headers
--t-stat:    22px  Barlow Condensed 600 — Card stats
--t-card:    24px  Bebas Neue      — Car names on cards
--t-screen:  36px  Bebas Neue      — Screen headlines
--t-hero:    56px  Bebas Neue      — Quest names, celebration
--t-mega:    80px  Bebas Neue      — Level number, XP milestones
```

### Spacing (Locked)
```
4px base unit. All spacing is multiples of 4.
xs:  4px   sm: 8px   md: 12px  base: 16px
lg:  20px  xl: 24px  2xl: 32px 3xl: 40px
4xl: 48px  5xl: 64px 6xl: 80px

Margins: screens use 20px horizontal padding unless specified.
```

### Border Radius (Locked)
```
--r-sharp: 4px      — Stat chips, data pills (angular = technical)
--r-card:  12px     — All cards
--r-sheet: 20px     — Bottom sheets (top corners only)
--r-pill:  9999px   — Buttons, badges, circular elements

RULE: Nothing exceeds 20px radius except perfect circles.
Generous radius = friendly startup app. Apex is a tool. Keep edges.
```

### Animation Spring Configs (Locked — for react-native-reanimated withSpring)
```javascript
SPRING_HEAVY  = { damping: 18, stiffness: 90,  mass: 1.4 }  // Cards materialising
SPRING_POP    = { damping: 10, stiffness: 280, mass: 0.8 }  // Badges, XP pop
SPRING_SETTLE = { damping: 22, stiffness: 200, mass: 1.0 }  // Sheets, drawers
SPRING_JELLY  = { damping: 7,  stiffness: 350, mass: 0.7 }  // Streak, missions

EASE_OUT_EXPO = Easing.out(Easing.exp)   // Fast launch, graceful settle
```

---

## SECTION 2 — REAL LOCATION (No Fakes, Ever)

### How Location Works in Apex

```javascript
// REQUEST:
import * as Location from 'expo-location'

const { status } = await Location.requestForegroundPermissionsAsync()
if (status !== 'granted') {
  // Show permission denied state — no fallback fake location
  return
}

// GET REAL POSITION:
const location = await Location.getCurrentPositionAsync({
  accuracy: Location.Accuracy.Balanced  // Battery-friendly, still accurate
})

// location.coords.latitude  — real number
// location.coords.longitude — real number
// location.coords.accuracy  — in metres

// WATCH FOR HUNT NAVIGATION:
const subscription = await Location.watchPositionAsync(
  { accuracy: Location.Accuracy.High, timeInterval: 3000, distanceInterval: 10 },
  (newLocation) => {
    updateUserPosition(newLocation.coords)
  }
)
```

### What "Real Location" Means for Each Feature

**On the Map:**
User's dot is their ACTUAL GPS position. No hardcoding. No simulation.
If GPS unavailable: dot is hidden, no fake fallback position shown.

**On Car Cards:**
When user posts, their real city + state is reverse-geocoded:
```javascript
const [place] = await Location.reverseGeocodeAsync({
  latitude: location.coords.latitude,
  longitude: location.coords.longitude
})
const displayLocation = `${place.city}, ${place.region}`
// Stored in DB as: city, region, country — NOT raw lat/lng (privacy)
// Displayed on card as: "📍 Kanpur, Uttar Pradesh"
```

**Privacy — what the USER controls:**
The location stored is always city+state (reverse geocoded, not raw GPS).
The user can toggle:
- Show Location ON (default): card shows "📍 [City], [State]"
- Show Location OFF: card shows "📍 Location hidden"

The raw GPS lat/lng is NEVER stored in the database. Ever.
Only city+state from reverse geocoding.

**On Hunt Notifications:**
Hunt broadcast uses the REAL city where the car was spotted.
Notification says: "🔥 Rare car spotted in [City]" — real city name.
Map shows the REAL general area (city district level, not street level).

---

## SECTION 3 — ONBOARDING (Immaculate Edition)

### Philosophy
The onboarding must feel like being let into an exclusive club.
Not a setup wizard. Not a tutorial. A door opening.
Confidence through restraint — if a screen can say it in 4 words, use 4 words.

---

### SCREEN 1 — AUTH GATE

**Background:**
Single real automotive photograph. Criteria:
- A solitary car on an empty road at night
- Shot from low angle, ground-level perspective
- Only light source: the car's headlights cutting toward camera
- Warm orange/amber headlight glow on wet asphalt
- 85% of frame is dark — the car and its light are the only subjects
- Photo MUST feel cinematic, not editorial/stock

**Layout (absolute positioned over the photo):**

```
[Photo fills 100% of screen]

Top 70%: Photo, no UI overlays except:
  Vertical gradient at very top 80px: --void → transparent
  (Prevents status bar content clashing with photo)

Center 30%: 
  The APEX wordmark — Bebas Neue 84px, --chalk
  Letter-spacing: 10px
  
  Entry animation:
    Start: translateY -60px, opacity 0
    End: translateY 0, opacity 1
    Duration: 800ms, EASE_OUT_EXPO
    On settle: ImpactFeedbackStyle.Heavy haptic
    
  After wordmark settles (500ms delay):
    "Every street. Every find." fades in
    DM Sans 400, 14px, --chalk at 55% opacity
    Letter-spacing: 2px
    Animation: opacity 0 → 1, 500ms, ease-in

Bottom 30%:
  Solid --void background (no gradient — clean hard edge where photo ends)
  paddingHorizontal: 20px, paddingBottom: safe-area-bottom + 24px
  
  [GOOGLE BUTTON]
  Height: 56px, width: 100%, border-radius: 12px
  Background: --chalk (#F0EBE3)
  Content: [Google G SVG 20px] + "Sign in with Google" [DM Sans 600 15px #1A1A1A]
  Icon-text gap: 12px, both centered
  
  Press: scale 1.0 → 0.97 (80ms) → 1.0 (200ms SPRING_POP)
  Haptic: ImpactFeedbackStyle.Light
  
  [12px gap]
  
  [EMAIL BUTTON]  
  Height: 56px, width: 100%, border-radius: 12px
  Background: transparent
  Border: 1.5px solid --gridline
  Content: [mail icon 20px --chalk at 60%] + "Continue with Email" [DM Sans 500 15px --chalk at 75%]
  
  [20px gap]
  
  Legal text: centered
  "By continuing you agree to our Terms & Privacy Policy"
  DM Sans 400, 11px, --void-txt
  "Terms" and "Privacy Policy" are --ignition tappable links
```

---

### SCREEN 2 — EMAIL FLOW (if email selected)

Two steps:

**Step A — Email Entry:**
```
Full --void background. No photo. Clean.

Centered card (90% screen width):
  Background: --carbon
  Border: 1px solid --gridline
  Border-radius: 16px
  Padding: 28px

  "ENTER YOUR EMAIL"
  Bebas Neue 32px --chalk, centered
  
  [16px gap]
  
  Input field:
    Height: 52px
    Background: --tarmac
    Border: 1.5px solid --gridline (focus: 1.5px --ignition)
    Border-radius: 8px
    Padding: 0 16px
    Font: DM Sans 400 16px --chalk
    Placeholder: "you@example.com" — DM Sans 400 16px --void-txt
    Keyboard: email-address, autocapitalization: none
    
  [20px gap]
  
  "SEND CODE" button:
    Full width of card
    Height: 52px, border-radius: 8px
    Background: --ignition
    Text: "SEND CODE" Bebas Neue 20px --chalk letter-spacing 2px
    Disabled (no email): opacity 0.35
    Enabled: opacity 1, box-shadow: 0 4px 20px rgba(255,69,0,0.3)
```

**Step B — OTP:**
```
Same card.

"CHECK YOUR EMAIL"
Bebas Neue 32px --chalk, centered

"Sent to [email]"
DM Sans 400 13px --dust, centered

[24px gap]

Six OTP boxes in a row, gap 8px:
  Each: 44px × 56px
  Background: --tarmac
  Border: 1.5px solid --gridline (active box: --ignition)
  Border-radius: 8px
  Text: Bebas Neue 28px --chalk, centered
  Auto-advance focus on digit entry
  Auto-submit when all 6 filled
  Paste detection: fills all 6 automatically

[16px gap]

"Resend in 0:45" — DM Sans 400 13px --dust, centered
Counts down. When 0: becomes "Resend code" --ignition tappable text.
```

---

### SCREEN 3 — ROLE SELECTION

**The one screen that must feel like a moment.**

```
Full-screen horizontal paged scroll (pagingEnabled, decelerationRate: 'fast')
Three pages. Each is a WORLD.
No back button on this screen. No skip.
```

**Each Page Structure:**
```
[Full-bleed real automotive photograph, 100% × 100% screen]
[Dark gradient overlay: transparent 40% → rgba(8,8,8,0.92) bottom 50%]

Over the gradient (bottom-aligned content):
  paddingHorizontal: 28px, paddingBottom: 160px (leaves room for bottom controls)
  
  [ORANGE ACCENT BAR]
  Width: 32px, Height: 4px, Background: --ignition, border-radius: 2px
  Only visible on currently active page
  Entrance: scaleX 0 → 1 from left, 300ms, when page snaps
  
  [8px gap]
  
  Role name: Bebas Neue 72px --chalk, left-aligned
  Letter-spacing: 2px
  
  [12px gap]
  
  Role description: DM Sans 400 16px --chalk at 70% opacity, left-aligned
  Line-height: 1.65
  Max 3 lines
```

**Three Pages:**
```
PAGE 1 — THE HUNTER
Photo: Low angle, supercar alone in underground garage
       Only light = car headlights on concrete
Role name: "THE HUNTER"
Description: "You see what others walk past.
             Every lot. Every street.
             Every car is a target."

PAGE 2 — THE SPOTTER
Photo: Elevated city view, cars on street below, night
Role name: "THE SPOTTER"
Description: "Cities hide things in plain sight.
             You're the one who finds them.
             Discovery is your discipline."

PAGE 3 — FOR THE LOVE
Photo: Engine bay close-up, V8 or inline-6, beautiful mechanical detail
Role name: "FOR THE LOVE"
Description: "You don't need a reason.
             The machines are enough.
             You know. You feel it."
```

**Side page peeking (Tinder/horizontal carousel feel):**
```
Side pages peek 20px into current page at edges
Side pages: opacity 0.4, scale 0.96
Active page: opacity 1.0, scale 1.0
Transition between pages: 250ms ease-out for opacity/scale changes
```

**Fixed Bottom Overlay (above all pages, not part of scroll):**
```
Position: absolute, bottom: 0, left: 0, right: 0
Height: 140px
Background: transparent (pages visible behind this)
Pointer-events: box/button only (rest passes through to swipe)

PAGE DOTS (centered, 48px from bottom):
  3 dots, 8px diameter, gap 8px
  Active: --chalk colour, 28px width (animated pill expansion, 200ms ease-out)
  Inactive: --gridline
  
[24px gap]

CONTINUE BUTTON:
  Width: calc(100% - 40px), centered
  Height: 56px, border-radius: 12px
  Background: --ignition
  Text: "I'M A [ROLE]" — updates as page snaps
        Bebas Neue 22px --chalk letter-spacing 2px
  box-shadow: 0 4px 24px rgba(255,69,0,0.4)
  
  [Button is always visible — current snapped page = selection]
  [No tap-to-select needed — just swipe then press Continue]
```

**Continue press → transition:**
```
1. Button text instantly: "LET'S GO" (no animation, instant)
2. The current photo page: scale 1.0 → 1.06 (500ms EASE_OUT_EXPO)
   Simultaneously: photo fades to dark (overlay opacity → 0.97, 400ms)
3. A white horizontal stripe (3px, full width) sweeps left→right (250ms)
4. Behind the stripe, the next screen is already loading
5. Stripe clears, permissions screen appears
```

---

### SCREENS 4–6 — PERMISSIONS

**Design rule: One permission per screen. Minimal. Confident.**

**CAMERA:**
```
Background: --void, full screen
Safe area padding at top.

Content (vertically centered at 42% from top):

  Custom SVG aperture: 72×72px
    8 blades arranged as iris/aperture, --chalk at 70% stroke, strokeWidth 2px
    Animation on mount: blades rotate open from closed (1,200ms, ease-in-out, staggered 80ms per blade)
    When fully open: centre glows faintly orange (--ignition 12% opacity radial gradient, 20px radius)

  [32px gap]
  
  "POINT." pause "SCAN." pause "COLLECT."
  Bebas Neue 52px --chalk, centered
  Three words appear with 300ms stagger each:
    Each word: translateY 16px → 0, opacity 0 → 1, 250ms EASE_OUT_EXPO

  [20px gap]
  
  "Apex needs your camera to photograph real cars.
  Photos stay on your device until you post them."
  DM Sans 400 15px --dust, centered, max-width 280px, line-height 1.6
  Fade in 700ms after headline completes

Bottom area (pinned to bottom, paddingBottom safe-area + 32px):
  "ENABLE CAMERA"
  Same button style as Continue — full width ignition background Bebas Neue 22px

  If denied:
    Button label → "OPEN SETTINGS"
    Small text below: "Camera is required for Apex to work."
    DM Sans 400 12px --dust, centered
```

**LOCATION:**
```
Same layout as Camera screen.

SVG: GPS crosshair, 72×72px
  Circle with thin crosshair lines, --chalk at 70%
  Center: 6px dot, --ignition, fully opaque
  3 concentric rings animate outward from center: scale 1→2.5, opacity 0.6→0, 1.8s loop
  Each ring staggered 600ms

Headline: "WHERE YOU ARE
           CHANGES EVERYTHING."
Bebas Neue 46px, two lines, --chalk, centered

Body: "Rarity is calculated for your specific city.
       A Ferrari might be common in Dubai.
       In your city? It could be Legendary."
DM Sans 400 15px --dust, centered, max-width 300px

Primary button: "ENABLE LOCATION" — ignition, full width
Secondary: small text button "Approximate only" below, --dust colour, tappable
  (Uses Location.Accuracy.Reduced — city-level only, no precise GPS)
```

**NOTIFICATIONS:**
```
SVG: Bell outline 72×72px, --chalk at 70%
  Gentle swing: rotateZ -12deg → 12deg → 0, ease-in-out, 2.2s loop
  Small --ignition dot at top-right of bell, 8px, pulsing (scale 1→1.4→1, 1.5s loop)

Headline: "HUNTS HAPPEN FAST."
Bebas Neue 52px --chalk, centered

Body: "We only notify you when rare cars appear
       nearby or a hunt goes live. Nothing else."
DM Sans 400 15px --dust, centered, max-width 280px

Primary: "ENABLE NOTIFICATIONS"
Secondary: "Skip for now" — DM Sans 400 13px --dust, centered text button below
```

---

### SCREEN 7 — WELCOME CEREMONY (The Payoff)
```
Black screen. Everything timed exactly.

0ms:    Screen is pure #000000 black. Nothing.

200ms:  A single --ignition spark (4px circle) appears at exact screen center.

200–380ms: That spark expands as a filled circle to cover 100% of screen.
            color: --ignition, ease-out-expo fill animation.
            Screen is now fully orange.

380–660ms: The orange contracts back to center (reverse ease-in).
            Screen is black again.

660ms:  "WELCOME" drops from top.
          Bebas Neue 80px --chalk, centered
          translateY: -80px → 0, SPRING_HEAVY (damping:18, stiffness:90, mass:1.4)
          On settle: ImpactFeedbackStyle.Heavy

760ms:  Role title appears below:
          "HUNTER." or "SPOTTER." or "ENTHUSIAST."
          Bebas Neue 48px --ignition, centered
          scale: 0 → 1.15 → 1.0, SPRING_POP
          Haptic: ImpactFeedbackStyle.Medium

900ms:  20 particles burst left and right from the role title text:
          Color: --ignition
          Sizes: 3–6px random circles
          Direction: radial outward, mostly horizontal (±30° from horizontal)
          Travel: 100–180px, then fall with gravity (translateY +40px)
          Lifetime: 700ms, fade to transparent

1,400ms: Three stat chips appear (staggered 120ms each):
           [⚡ LEVEL 1]  [🔥 0 STREAK]  [🏆 UNRANKED]
           Background: --carbon, border: 1px solid --gridline
           Border-radius: --r-sharp (4px — intentionally angular, not bubbly)
           Text: DM Sans 500 13px --chalk, padding: 8px 14px
           Entry: translateY 20px → 0, opacity 0 → 1, 200ms EASE_OUT_EXPO

2,000ms: Large CTA button fades in:
           "ENTER APEX →"
           Full --ignition button, full width, Bebas Neue 22px
           A single shimmer sweep (bright 45° stripe) crosses it once, 400ms
           opacity: 0 → 1, 300ms

3,400ms: If user hasn't tapped: auto-advances to Home.
           Transition: black flash (60ms), then Home fades in (400ms).
```

---

## SECTION 4 — HOME SCREEN (Immaculate HUD)

### Architecture
```
Full-screen Mapbox dark map as background.
All UI elements are absolute-positioned HUD overlays.
No scrolling list. No fake card deck.
The map IS the home. Everything else is information on top of the world.
```

### Top HUD
```
Position: absolute, top: safe-area-top, left: 0, right: 0
Height: 56px
Background: linear-gradient(180deg, rgba(8,8,8,0.95) 0%, transparent 100%)

Left:  APEX wordmark, 22px height, --chalk
Right: Streak + XP display:
       [🔥 7]  [⚡ 4,820]
       (🔥 = Lottie flame animation, 22px loop)
       Numbers: Barlow Condensed 600 16px --chalk
       If streak is 0: do NOT show streak at all. Just [⚡ XP].

XP Progress bar:
  Immediately below top HUD (not inside it)
  Height: 2px (thin — this is information, not decoration)
  Background: --gridline
  Fill: --ignition
  Fill width: (currentXP / xpForNextLevel) × screenWidth
  
  When XP updates:
    Fill animates from old width to new width, 800ms ease-out
    Leading edge: 8px bright white highlight that travels ahead of fill
    After fill settles: leading edge fades (300ms)

Level label (right of progress bar):
  "LVL 12" DM Sans 500 10px --dust, positioned 8px from right edge
  Aligned to center of progress bar height
```

### Scanner Button (Heart of the App)
```
Position: absolute, bottom: tab-bar-height + 16px, centered horizontally

Outer glow ring: 76px diameter
  Background: transparent
  Border: 2px solid --ignition
  Border-radius: 38px (circle)
  Animated: box-shadow pulses
    0 0 0px rgba(255,69,0,0) → 0 0 20px rgba(255,69,0,0.5) → 0 0 0px
    Duration: 2.8s, ease-in-out, infinite repeat
    THIS is the only glowing element on the Home screen. Nothing else glows.

Inner button: 60px diameter
  Background: --ignition
  Border-radius: 30px
  Icon: camera.fill SF Symbol, 26px --chalk, centered
  Border: 2px solid rgba(255,255,255,0.15) (subtle inner ring)

Press animation:
  Step 1: Outer ring + inner button scale 1.0 → 0.88 (70ms, linear) — compression
  Step 2: Haptic: ImpactFeedbackStyle.Heavy
  Step 3: Both spring to 1.1 → 1.0 (SPRING_POP) — the release
  Step 4: Screen transition — scanner rises from bottom (translateY: 100% → 0, 350ms EASE_OUT_EXPO)
```

### Daily Quest Strip (When Quest Exists)
```
Position: absolute, top: safe-area-top + 76px, left: 20px, right: 20px

Card:
  Background: rgba(8,8,8,0.88)
  Border: 1px solid rgba(44,44,44,0.9)
  Border-left: 3px solid --ignition (accent)
  Border-radius: 12px
  Padding: 14px 16px

Content layout:
  Row 1: [Quest title, DM Sans 600 14px --chalk] + [time remaining DM Sans 400 12px --dust, right-aligned]
  Row 2: [progress text: "2 of 3 spotted" DM Sans 400 12px --dust]
  Row 3: [progress bar: 100% width, 3px height, --gridline background, --ignition fill, border-radius 2px]
         [XP reward right-aligned: "+500 XP" DM Sans 600 12px --ignition]

Tap → expands to full Quest Detail screen (push navigation)

IF NO QUEST TODAY: This card does not render. Nothing fills its space.
```

### Nearby Activity (When Real Posts Exist Within 3km)
```
Position: absolute, bottom: tab-bar-height + 90px, right: 16px

Shows maximum 3 cards in a vertical column.
Each card: 68×88px

Card design:
  Background: rgba(8,8,8,0.90)
  Border: 1px solid rgba(44,44,44,0.8) + 1.5px rarity-colour top border
  Border-radius: 10px
  
  Content:
    Top 64px: car photo thumbnail, object-fit cover, border-radius 8px 8px 0 0
    Bottom 24px: centered rarity text, Bebas Neue 11px, rarity colour
    e.g. "RARE" in --r-rare

  Tap: opens that specific post/card in a bottom sheet

WHEN NO NEARBY ACTIVITY:
  This entire section is hidden.
  No placeholder cards. No "be the first!" text in this spot.
  The space is just map. Which is fine.

"VIEW ALL" text: only appears if nearby cards are visible, below the column.
  DM Sans 500 11px --dust, right-aligned, tappable.
```

### Mission Completion Notification (When Mission Just Completed)
```
Appears ONLY at moment of completion, not always-visible.

An animated pill rises from bottom (above tab bar):
  translateY: 40px → -20px over 400ms (SPRING_JELLY)
  Background: #1A2A1A (dark green tint — clearly positive)
  Border: 1px solid rgba(61,170,106,0.4)
  Border-radius: 9999px
  Padding: 10px 20px
  Content: "✅ [Mission name] complete! +[XP] XP"
           DM Sans 500 14px --chalk

Stays visible 2.5 seconds, then:
  translateY: -20px → -60px, opacity 1→0, 400ms ease-in
  
Haptic: NotificationFeedbackType.Success when pill appears.
Green particle burst from pill center (8 particles, 3–5px, --success colour, radial 40px travel)
```

---

## SECTION 5 — SCANNER (Real Camera, No Simulation)

### Camera Implementation
```javascript
// react-native-vision-camera v4 implementation

import { Camera, useCameraDevice, useCameraPermission } from 'react-native-vision-camera'

const device = useCameraDevice('back', {
  physicalDevices: ['wide-angle-camera']
  // wide-angle only — ultra-wide distorts car proportions
})

// Photo capture:
const photo = await camera.current.takePhoto({
  qualityPrioritization: 'quality',    // Best image quality
  flash: flashMode,                     // 'off' | 'on' | 'auto' — user controlled
  enableShutterSound: true,
  enableAutoStabilization: true
})

// photo.path = real file path on device
// photo.metadata.Exif = full EXIF data including timestamp and GPS
// photo.width, photo.height = actual resolution
```

### Camera UI
```
Full screen. 100% × 100%.
Status bar hidden during camera use.
Background: #000000 (camera feed, not void — true black for camera)

VIEWFINDER:
NOT four corners. A targeting RETICLE:

Outer circle: 220px diameter, stroke 1.5px --chalk at 15% opacity
  Four gaps at 12/3/6/9 o'clock positions (20px gap each)
  
Inner circle: 120px diameter, stroke 1.5px --chalk at 25% opacity

Crosshair lines: 
  Extend 24px outward from center
  Stop 10px before inner circle edge
  Stroke 1.5px --chalk at 30% opacity

Center dot: 4px --ignition, fully opaque

IDLE ROTATION: entire reticle rotates 0.3deg/second clockwise via Reanimated
  (Very subtle — feels alive, not distracting)

BOTTOM BAR (60px, rgba(0,0,0,0.7) background, blur):
  Left: Flash toggle (40px circle, --carbon background, bolt icon)
  Center: Shutter button (72px outer ring, 60px inner chalk circle)
  Right: Close X button (40px circle, --carbon background)

SHUTTER PRESS:
  Inner circle: scale 1.0 → 0.80 (75ms linear) — compress
  Haptic: ImpactFeedbackStyle.Heavy
  White screen flash: opacity 0 → 0.75 → 0 (75ms on, 220ms off)
  Camera freezes on captured image
  Inner circle: scale 0.80 → 1.15 → 1.0 (SPRING_POP) — release

NO gallery picker. NO upload button. Rear camera only.
```

### CAR DETECTION STATE (on-device pre-detection)
```
When react-native-vision-camera's frame processor detects
a vehicle-like object in frame:

  Reticle circles: colour transitions --chalk at 15% → --ignition (300ms)
  Center dot: brightens and scale 1.0 → 1.4 → 1.0 (SPRING_JELLY)
  Haptic: ImpactFeedbackStyle.Light (single gentle ping)
  Bottom hint: "Car detected — tap to scan" fades in
               DM Sans 400 13px --chalk, centered above shutter
               
Reverts to idle state if car leaves frame (300ms reverse transition)
```

### SCAN PROCESSING (after capture)
```
Frozen photo fills screen (the actual captured image)
Dark overlay on top: rgba(8,8,8,0.75)

Center:
  A radar sweep animation:
    Circle: 160px diameter, stroke 1.5px --chalk at 20%
    Sweep: angular segment (like a clock hand), fills 90° arc
    Color: --ignition at 60%
    Rotation: 0 → 360deg, 1,400ms per revolution, infinite until result
    Trailing fade: the 90° arc has opacity gradient from 60% (leading) to 0% (trailing)
    
  Text below radar, cycles every 1,400ms:
    "Identifying make & model..."
    "Checking regional rarity..."
    "Detecting modifications..."
    "Almost there..."
    DM Sans 400 13px --dust, centered

  Progress bar (bottom of screen):
    2px height, full width, --ignition fill
    Animated: 0% → 88% over 8s (never completes — API result triggers screen change)
    This is "perceived progress" only — doesn't map to real API state
    
  IF TAKES LONGER THAN 10 SECONDS:
    Text changes to: "Taking a bit longer than usual..." --dust
    Sub-text: "Poor lighting may slow identification" --void-txt 12px
```

---

## SECTION 6 — AI SCAN OUTPUT (What Gets Returned)

### API Call (Server-Side)
```javascript
// After EXIF validation passes, sent to GPT-4o Vision:

const systemPrompt = `
You are Apex's automotive intelligence system.
Analyse this real photograph of a car.
Return ONLY valid JSON — no markdown, no explanation, no extra text.
If a field cannot be determined with confidence, use null.

Required JSON structure:
{
  "identified": true | false,
  "confidence": 0.00 to 1.00,
  "needs_better_angle": true | false,
  "angle_instruction": "Describe exact angle needed" | null,
  
  "make": "Manufacturer name",
  "model": "Model name",
  "generation": "Chassis code or generation name and years e.g. F80, 2014-2018",
  "trim": "Trim level" | null,
  "year_estimate": "Year or range e.g. 2019 or 2018-2020",
  "color": "Manufacturer color name if known, else descriptive e.g. Pearl White",
  "body_style": "Sedan|Coupe|SUV|Hatchback|Convertible|Wagon|Pickup|Van|Supercar|Hypercar",
  "origin_country": "Country name",
  
  "engine": "Full description e.g. 3.0L Inline-6 Twin-Turbocharged",
  "horsepower_hp": 0,
  "torque_nm": 0,
  "kerb_weight_kg": 0,
  "top_speed_kmh": 0,
  "zero_to_hundred_seconds": 0.0,
  
  "production_start_year": 0,
  "production_end_year": 0 | null,
  "market_value_usd_low": 0,
  "market_value_usd_high": 0,
  
  "historical_information": "2-3 sentences of genuine factual model history",
  "interesting_facts": [
    "First interesting non-obvious fact",
    "Second interesting non-obvious fact"
  ],
  
  "aftermarket_parts_detected": [
    {
      "part": "Part name e.g. Aftermarket Exhaust",
      "brand_if_known": "Brand name" | null,
      "description": "Brief description of what you see",
      "confidence": 0.00 to 1.00
    }
  ]
}

Only include aftermarket_parts_detected items with confidence above 0.55.
If no mods detected, return empty array [].
`
```

### EXIF Validation (Server-Side, Before AI Call)
```javascript
// Checks before sending to AI:

const validation = {
  // 1. Timestamp check
  capturedWithin3Minutes: 
    (Date.now() - new Date(exif.DateTimeOriginal).getTime()) < 180000,
  
  // 2. Not a screenshot (software field check)
  notScreenshot: 
    !['Photoshop','GIMP','Screenshot','Snapseed','Lightroom','PicsArt',
      'Preview','Canva'].some(app => exif.Software?.includes(app)),
  
  // 3. Minimum resolution (real phone cameras are >1920px)
  sufficientResolution: exif.PixelXDimension >= 1920,
  
  // 4. Has device make (real cameras identify themselves)
  hasDeviceMake: !!exif.Make,
}

if (!validation.capturedWithin3Minutes) 
  return { rejected: true, reason: 'OLD_PHOTO' }
if (!validation.notScreenshot) 
  return { rejected: true, reason: 'SCREENSHOT' }
if (!validation.sufficientResolution)
  return { rejected: true, reason: 'LOW_RESOLUTION' }
```

### Claude Vision Authenticity Check
```javascript
// After EXIF passes, Claude claude-sonnet-4-6 checks the actual image:

const authenticityPrompt = `
Examine this image for authenticity. Return ONLY this JSON:
{
  "verdict": "APPROVE" | "REJECT",
  "is_screenshot": true | false,
  "is_ai_generated": true | false,
  "is_photographed_screen": true | false,
  "is_digitally_edited": true | false,
  "confidence": 0.00 to 1.00,
  "reason": "Explanation if rejecting" | null
}

Reject if: ANY flag is true AND confidence > 0.70.
Approve when genuinely uncertain — false positives hurt real users.
Look for: status bars, UI elements, pixel grid patterns (screenshot),
AI generation artefacts like impossible reflections or melting edges,
moiré patterns from photographing a screen, editing seams.
`

// APPROVE → proceed to car identification
// REJECT → return error to client with specific reason
```

### Rejection UI
```
When image is rejected, a bottom sheet slides up (SPRING_SETTLE, 400ms):

Background: --carbon
Border: 1px solid --gridline
Border-radius (top): 20px
Padding: 28px 24px

Top: 48px icon (circle with X, --danger colour)
     scale 0 → 1.15 → 1.0, SPRING_POP, 300ms after sheet appears
     
Headline: Bebas Neue 32px --chalk, centered
  'OLD_PHOTO':        "NOT TAKEN JUST NOW."
  'SCREENSHOT':       "THAT'S A SCREENSHOT."
  'LOW_RESOLUTION':   "TOO LOW QUALITY."
  'AI_GENERATED':     "AI MADE THIS. WE KNOW."
  'SCREEN_PHOTO':     "PHOTOGRAPH A REAL CAR."
  'EDITED':           "IMAGE HAS BEEN EDITED."

Body: DM Sans 400 15px --dust, centered
  'OLD_PHOTO':     "Open the scanner and take a fresh photo right now."
  'SCREENSHOT':    "Apex requires real photos taken in the moment."
  'AI_GENERATED':  "Find a real car and scan it for real."
  'SCREEN_PHOTO':  "Don't photograph a screen. Find the actual car."
  'EDITED':        "Apex requires unedited photos from your camera."

[24px gap]

"TRY AGAIN" button: full width, --ignition, Bebas Neue 20px
  Closes sheet, reopens live camera

No XP penalty on first two rejections.
Third rejection: "Third strike — 24 hour scan limit reached."
```

### Confidence Too Low — Request Better Angle
```
When confidence < 0.65:

Bottom sheet (same design as rejection but yellow-tinted):
Border-left: none. Border-top: 3px solid --r-rare (amber, not danger red)

Icon: 48px angle/camera icon (--r-rare colour)

Headline: "NEED A BETTER LOOK."
Bebas Neue 32px --chalk

Body (from angle_instruction in AI response):
  e.g. "Try the left side profile of the car — 
        full length visible, at ground level."
  DM Sans 400 15px --dust

"RETRY" button — same style, reopens camera
Small diagram illustration if possible: 
  SVG of car top-view showing where to stand + camera angle arrow
```

---

## SECTION 7 — POST COMPOSER (The Real Questions)

### When It Appears
After AI scan returns a successful identification AND card reveal animation completes,
the user sees the face-up card with two bottom buttons:
- "POST TO APEX →" (ignition, right)
- "SAVE PRIVATELY" (ghost, left)

Tapping "POST TO APEX →" pushes the Post Composer screen.

### Post Composer Full Spec
```
Full screen (not a sheet — a real pushed screen, back button visible)
Background: --void
Navigation: back arrow top-left + "POST →" text button top-right (ignition, disabled until valid)

HEADER (navigation bar):
  Left: ← back arrow, 24px, --chalk at 80%
  Center: "NEW SPOT" Bebas Neue 24px --chalk
  Right: "POST" DM Sans 600 15px --ignition (disabled: --smoke)
  Below: 1px --gridline divider

PHOTO PREVIEW:
  Full width, 200px height, no horizontal margins
  The user's ACTUAL taken photograph, object-fit: cover
  NOT stock, NOT AI-generated, NOT placeholder
  
  Overlaid bottom-left: Rarity badge pill
    "[RARITY]" Bebas Neue 11px --chalk, padding 5px 10px
    Background: rarity colour, border-radius: --r-sharp (4px — angular)
  
  Overlaid bottom-right: Car name pill
    "[MAKE] [MODEL]" DM Sans 600 12px --chalk
    Background: rgba(8,8,8,0.8), border-radius: --r-sharp, padding 5px 10px

CAPTION FIELD:
  marginTop: 0 (photo and field touch — no gap)
  Background: --carbon
  Border-top: 1px solid --gridline
  Padding: 14px 20px
  
  TextInput:
    Background: transparent
    Font: DM Sans 400 15px --chalk
    Placeholder: "Say something about this find..."
                  DM Sans 400 15px --void-txt (italic: false — no italic)
    Multiline: true
    MaxLength: 280
    ReturnKeyType: "done"
    blurOnSubmit: true
  
  Character counter (bottom-right of field area):
    Only visible when chars > 220
    "58" (remaining) DM Sans 400 11px
    220-260 remaining: --dust colour
    < 20 remaining: --danger colour

SECTION DIVIDER:
  "SETTINGS" DM Sans 500 10px --void-txt letter-spacing 3px
  paddingHorizontal 20px, paddingVertical 12px
  Full width 0.5px --gridline below

TOGGLE ROWS (3 rows):

Each row: 60px height, paddingHorizontal 20px
Border-bottom: 0.5px --gridline (except last row)

ROW LAYOUT (horizontal):
  Left: [Icon 20px] + [Text column] + [Toggle right-aligned]
  
  Icon: 20px, --ignition colour
  Text column:
    Label: DM Sans 600 15px --chalk
    Sub: DM Sans 400 12px --dust (below label, 2px gap)
  
  Toggle (custom — not iOS default):
    Track: 44px × 26px, border-radius 13px
    ON: --ignition background
    OFF: --gridline (#2C2C2C) background
    Thumb: 22px circle, --chalk, translateX 0px (off) | 18px (on)
    Transition: 220ms ease-in-out for both colour and thumb position
    Haptic on toggle: ImpactFeedbackStyle.Light

ROW 1 — SHOW LOCATION:
  Icon: location-pin.fill SF Symbol, --ignition
  Label: "Show Location"
  Sub: "Your city will appear on the post"
  Toggle default: ON

ROW 2 — ALLOW COMMENTS:
  Icon: bubble.left.fill SF Symbol, --ignition
  Label: "Allow Comments"
  Sub: "Let the community comment on your spot"
  Toggle default: ON

ROW 3 — START A HUNT:
  ONLY SHOWN if car rarity is Uncommon or higher.
  If rarity is Common: Row 3 is completely hidden. No empty space.
  
  Icon: Lottie flame animation 20px (micro-loop, only animates when toggle is ON)
       When toggle is OFF: static flame icon, --smoke colour
  Label: "Start a Hunt"
  Sub: "Nearby spotters race to find this car [RARITY] tier"
       Rarity word in rarity colour (e.g. "RARE" in --r-rare)
  Toggle default: ON for Rare+, OFF for Uncommon
  
  When toggled ON → row expands (height 60px → 100px, SPRING_SETTLE):
    Expansion reveals sub-card:
      Background: rgba(255,69,0,0.06)
      Border: 1px solid rgba(255,69,0,0.2)
      Border-radius: 8px
      Margin: 0 20px 12px 20px
      Padding: 10px 14px
      Text: "5-minute hunt starts when you post."
             DM Sans 400 12px --dust, line-height 1.5

INFO BANNER (when Show Location is ON):
  Appears below the toggle rows, paddingHorizontal 20px
  Background: rgba(255,165,0,0.07)
  Border-left: 3px solid --gold (#FFA500)
  Border-radius: 0 6px 6px 0
  Padding: 10px 12px
  Text: "📍 Location appears as city name only. Your exact GPS is never stored."
        DM Sans 400 12px --dust (#9A9088), line-height 1.5

POST BUTTON (pinned to bottom):
  Position: sticky bottom, paddingHorizontal 20px, paddingBottom safe-area + 16px
  Background: --void (above it creates contrast)
  
  Button itself:
    Full width, height 56px, border-radius 12px
    Background: --ignition
    Text: "POST SPOT" Bebas Neue 22px --chalk letter-spacing 2px
    box-shadow: 0 4px 20px rgba(255,69,0,0.35)
    
    Press animation:
      scale 1.0 → 0.97 (70ms linear) — slight press
      Haptic: ImpactFeedbackStyle.Medium
      scale 0.97 → 1.02 → 1.0 (SPRING_POP 200ms) — release
    
    UPLOADING STATE:
      Text hides (opacity 0, instant)
      A racing progress bar appears:
        A thin line (2px height, 60% button width, centered) that bounces left-right
        (not a spinner — a racing sweep that goes L→R then R→L on loop)
        Color: --chalk
      Cannot be tapped again during upload
      
    SUCCESS STATE:
      Background briefly flashes --success (200ms cross-fade)
      Checkmark icon: scale 0 → 1.2 → 1.0 (SPRING_POP, 300ms) --chalk
      Screen dismisses after 600ms (auto)
      Navigates to the new post in the feed, scrolled to top
```

---

## SECTION 8 — CARD REVEAL (FINAL DEFINITIVE ANIMATION)

### Trigger
Immediately after AI scan returns success.
Photo is captured. Validation passed. Car identified. Rarity calculated.

### Phase System (Total: ~5.5 seconds)

**PHASE 0 — Black out (0–200ms)**
```
Screen fades from frozen camera preview to #000000.
200ms, ease-in. Nothing else happens.
```

**PHASE 1 — Card materialises (200–900ms)**
```
A face-down trading card appears at screen center.
Size: 320×448px
Back face: --carbon background + carbon-weave texture tile repeated + APEX wordmark 40px --smoke centered

Entry:
  translateY: screenHeight/2 → 0 (from below screen center)
  scale: 0.55 → 1.0
  opacity: 0 → 1 (first 200ms only)
  Spring: SPRING_HEAVY (damping:18, stiffness:90, mass:1.4)
  
On settle: ImpactFeedbackStyle.Heavy
Immediately begins IDLE FLOAT (runs throughout entire reveal):
  translateY oscillates ±10px over 2.8s sine curve
  rotateY oscillates -6deg → 6deg over 3.5s sine curve (different period = organic feel)

Card shadow: box-shadow 0 20px 60px rgba(0,0,0,0.8) — always present
```

**PHASE 2 — Rarity Suspense (900ms–2,100ms — 1.2 second pause)**
```
Card floats. Rarity is being determined.

"SCANNING RARITY..." text pulses above card:
  DM Sans 400 11px letter-spacing 3px --void-txt
  opacity: 0.4 → 0.9 → 0.4, 900ms ease-in-out loop
  
Three dots bounce below card (typing indicator):
  3 × 7px circles, --dust colour
  Bounce: translateY 0 → -8px → 0, 600ms ease-in-out, staggered 180ms each
  
RARITY RING APPEARS at 1,800ms (300ms before reveal):
  A ring materialises at card border
  Color: rarity colour
  scale: 1.6 → 1.0, SPRING_POP (300ms) — snaps into place
  box-shadow: rarity glow (subtle at first)
  This gives the viewer a preview moment before the full reveal
```

**PHASE 3 — Rarity Reveal (2,100ms)**
```
Instant. Two things happen simultaneously:

1. "SCANNING RARITY..." disappears (opacity 0, 100ms)

2. Rarity name STAMPS above the card:
   e.g. "LEGENDARY" or "MYTHIC"
   Bebas Neue 52px, rarity colour
   scale: 2.8 → 1.0, SPRING_HEAVY (damping:16, stiffness:100)
   Feels like a rubber stamp hitting paper — fast, weighty, definitive
   Haptic: ImpactFeedbackStyle.Heavy at the moment of stamp
   
After stamp settles (300ms): card shudder begins.
```

**PHASE 4 — Pre-crack Shudder (2,400ms–2,680ms)**
```
translateX pattern (rapid):
  +6px (55ms) → -6px (55ms) → +4px (45ms) → -4px (45ms) → +2px (35ms) → 0 (35ms)
Total: 270ms
Amplitude decreases — like something struggling to contain pressure.

Haptics: 3 light impacts at 0ms, 110ms, 220ms of shudder.

Rarity glow behind card grows: box-shadow expands
  Common: none
  Uncommon: 0px → 20px spread, --r-uncommon 30% opacity
  Rare: 0px → 30px, --r-rare 35%
  Epic: 0px → 40px, --r-epic 40%
  Legendary: 0px → 60px, --gold 45%
  Mythic: 0px → 80px, --fire 50%
  Duration: 280ms ease-in
```

**PHASE 5 — Card Splits (2,680ms–3,480ms — 800ms)**
```
Card splits horizontally at y=50% of card height.

Top half: rotateX 0deg → -90deg
  Easing: cubic-bezier(0.4, 0.0, 0.0, 1.0) — slow start, fast end (weight then burst)
  transformOrigin: bottom center of top half
  perspective: 800px

Bottom half: rotateX 0deg → 90deg  
  Same easing, same duration
  transformOrigin: top center of bottom half

As halves separate:
  A CRACK LINE appears at y=50%:
    height: 2px, background: white
    box-shadow: 0 0 8px white, 0 0 30px [rarityColour], 0 0 80px [rarityColour at 40%]
    Breathing: opacity 0.7 → 1.3 → 0.7, 200ms ease-in-out loop until streaks fire
    
  Inner glow from crack: 
    As halves open, the gap between them reveals a white light source
    A blurred white ellipse (40px wide, 10px tall, 20px blur) emanates from crack center

Haptic: sustained medium rumble from 2,680ms → 3,200ms
```

**PHASE 6 — Energy Streaks (2,880ms–end, ~1,800ms duration)**
```
React Native Skia Canvas (full screen, pointerEvents: 'none'):

All streaks originate from the crack line center point.

COMMON (#787878):
  Count: 14 streaks
  Spread: ±70° from horizontal (concentrated around horizontal axis)
  Length: 80–140px (random per streak)
  Width: 1.5px, chalk at 55% at base, transparent at tip
  Bright tip: 12px white circle travels base→tip over 280ms per streak
  Stagger: each streak fires within random 0–100ms window
  Fade: each streak fades 300ms after tip reaches end
  Total visible window: 800ms

UNCOMMON (#3DAA6A):
  Count: 20, Length: 120–220px, Width: 2px
  Spread: ±90°
  Single fork at 60% length: branch at ±22°, 45% of parent length
  Tip: green-white bright circle
  Total: 1,000ms

RARE (#E8A020):
  Count: 26, Length: 160–300px, Width: 2.5px
  Spread: full 360° (truly radial)
  Sinusoidal path: streaks arc (amplitude ±8px, one wave per length)
  Double fork at 50% and 70%
  8px blur glow along streak length
  Total: 1,200ms

EPIC (#C85000):
  Count: 32, Length: 200–380px, Width: 3px
  Spread: full 360°
  Sinusoidal amplitude: ±14px
  Triple fork
  16px glow
  Screen vignette: --r-epic at 10% opacity radial from edges, 200ms pulse at peak
  Total: 1,400ms

LEGENDARY (#FFA500):
  Count: 38, Length: 260–460px
  Tapered shape: 5px width at base, 0 at tip (solar flare profile)
  Gold 20px blur bloom
  Secondary particles from each streak: 3–5 particles per streak,
    2–4px, scatter ±15° from streak, 30–50px travel, fade 400ms
  Screen background flare: rgba(255,165,0,0.07) 200ms at peak
  Total: 1,600ms

MYTHIC (ALL 5 RARITY COLOURS):
  5 waves, each 12 streaks, fires at 0/200/400/600/800ms
  Wave 1: --r-common, Wave 2: --r-uncommon, Wave 3: --r-rare, Wave 4: --r-epic, Wave 5: --gold
  Peak overlap: all 5 waves visible simultaneously at ~1,200ms
  Full screen: Skia rotating radial gradient of all 5 colours, opacity 0→0.22→0 over 2s
  Screen micro-shakes: ±4px random X+Y, 14 per second, 700ms duration
  Haptic: Maximum device vibration sustained pattern
  Total: 2,000ms
```

**PHASE 7 — Colour Ribbons Flow Behind Card (starts at 60% of streak duration)**
```
As streaks reach maximum length:
  Streak tips reverse direction
  Colour flows back toward card as continuous ribbons
  Ribbons wrap behind the card and orbit around it
  
Implemented via Skia animated Path:
  Each ribbon: bezier curve from streak endpoint → around card corner → behind card
  Behind card: ribbons pool into slow orbital swirl
  
Per rarity:
  Common:    1 ribbon, 1.5px, 45% opacity, 4.5s orbit
  Uncommon:  2 ribbons, 2px, 50%, 3.5s and 4.8s
  Rare:      2 ribbons, 2.5px, 8px Skia blur, 3s and 4s
  Epic:      3 ribbons, 3px, glowing, 2.5/3/3.8s
  Legendary: 4 ribbons, 3.5px, strong glow + particles shed off ribbon path every 1.5s
             (6 particles per shed, 2px, fall with gravity, 400ms lifetime)
  Mythic:    5 ribbons (one per rarity colour), 2.5–4px, speeds 1.5–2.5s
             Ribbons weave and cross — intersection points flash white briefly (60ms)

Ribbons continue THROUGHOUT the remainder of the reveal and persist until screen dismissed.
```

**PHASE 8 — Fireworks (starts 400ms after streaks begin, lasts 2,000ms)**
```
Skia particle system, full screen:

Each burst:
  Launch: random position within 150px radius of card center, minimum 80px from center
  Particles: 10–16 per burst
  Launch physics: radial from burst center, velocity 90–180px/s random
  Gravity: +140px/s²
  Lifetime: 500–900ms random per particle
  Shapes: 60% circles (2–5px), 40% sparks (1×7px oriented toward motion)
  Tail: 4 ghost copies, 15px intervals behind particle, each 18% opacity
  Fade: opacity 1.0 → 0 linear over lifetime
  
Burst rate:
  0–700ms: 5–7 bursts per second
  700–1,400ms: 3–4 bursts per second
  1,400–2,000ms: 1–2 per second (embers)
  
Micro-sparkles from card edges:
  50 tiny white (1–2px) particles from card's 4 edges
  Max travel 18px, lifetime 220ms, scatter randomly outward
```

**PHASE 9 — White Flash (at peak of fireworks, ~1,600ms after streaks began)**
```
Total time: ~4,400ms from start of reveal

White screen overlay:
  opacity 0 → 1.0 in 55ms (near-instant)
  Hold at 1.0 for 100ms
  opacity 1.0 → 0 in 340ms (EASE_OUT_EXPO)
  
During the 55ms darkness before the flash:
  Card halves snap back to face-DOWN position (imperceptible to viewer)
  
Haptic at flash moment: NotificationFeedbackType.Success (the "ding" moment)
```

**PHASE 10 — Card Flip to Face-Up (during flash fade, 4,455ms–5,055ms)**
```
rotateY: 180deg → 0deg
Duration: 600ms
Easing: cubic-bezier(0.25, 0.46, 0.45, 0.94) — fast start, dramatic slow settle
perspective: 900px
transformOrigin: center center

SPECULAR HIGHLIGHT (the premium detail):
  A white oval (100×36px, white 65% opacity, 18px blur)
  Sweeps from right edge to left edge of card as it rotates
  Enters right at 0ms, exits left at 600ms of flip
  Opacity: 0 → 65% → 0 arc over the sweep
  This simulates light bouncing off a physical card surface

At rotateY === 90° (card edge-on, momentarily invisible):
  Conditional render flips from back-face content to front-face content
  Front face = the real car card with user's photo
```

**PHASE 11 — Face-Up Content Reveals (5,055ms–6,100ms)**
```
Card face-up, content appears staggered:

5,055ms: Car photo appears (already on card — cross-fade from dark to full colour, 300ms)
5,155ms: Rarity badge: scale 0 → 1.3 → 1.0, SPRING_POP + rarity glow
5,255ms: Serial number: fade in, 200ms
5,355ms: Car name types on: one character per 28ms (e.g. "FERRARI 488 GTB" = 560ms)
5,560ms: Sub-line (body style · origin): fade in 150ms
5,660ms: Stat row 1 (Top Speed, HP): translateX -20px → 0 + opacity 0→1, 220ms
5,810ms: Stat row 2 (Engine, 0-100): same, 220ms
5,960ms: Stat row 3 (Torque, Weight): same, 220ms
6,060ms: Footer (Released / Spotted): fade in 150ms
6,110ms: Location pill: fade in 150ms

6,200ms: TWO XP PILLS float up:
  Pill 1: "+850 XP" 
    Background: --ignition, border-radius --r-pill
    Bebas Neue 16px --chalk, padding 6px 14px
    translateY +20px → -60px (floats upward), opacity 0→1→0, 1,400ms total
    
  Pill 2: "LEGENDARY FIND!" (if Legendary+)
    Same style, --gold background
    translateY +20px → -110px (higher than XP pill), starts 200ms after XP pill

  Both: odometer-style number flip as they appear (digits roll up into place)

6,400ms: Bottom action buttons slide up:
  Two buttons rise from below card (SPRING_SETTLE):
  Left: "SAVE ONLY" ghost button
  Right: "POST TO APEX →" --ignition button
  Stagger: 100ms between buttons
```

**PERSISTENT STATE (after all phases complete)**
```
Card floats (idle animation from Phase 1, continuous)
Ribbons orbit behind card
Rarity border glows:
  Common: subtle grey box-shadow 0 0 12px --r-common 20%
  Uncommon: green 0 0 16px --r-uncommon 30%
  Rare: amber 0 0 20px --r-rare 35%
  Epic: orange 0 0 24px --r-epic 40%
  Legendary: gold 0 0 32px --gold 45% + holographic foil sweep
             Foil: white diagonal stripe 80px wide, 15° angle, sweeps full card width, 5s loop
             opacity 0 → 7% → 0 as it sweeps
  Mythic: all of legendary + animated prismatic border
          Border: 2px stroke, gradient rotates 360° every 2.5s through all rarity colours
          + particles shed from all 4 corners continuously (3 particles/second per corner)
          + foil sweep changes colour as it moves (not white, spectral)
```

---

## SECTION 9 — FEED (Real Posts Only)

### Empty State (When No Posts Exist)
```
This is the default state for a new app with zero users.
Do NOT fill this with sample posts. Do NOT show placeholders.
Make the empty state so beautiful that the first user WANTS to break it.

Background: --void

Centered content (at 40% from top):

  A minimal car silhouette illustration:
    SVG, outline only (no fill), 120×80px, --gridline colour (dark, barely visible)
    Very thin strokes (1px)
    Sports car profile, elegant, minimal
    
  [28px gap]
  
  "NOTHING HERE YET."
  Bebas Neue 36px --chalk, centered
  
  [12px gap]
  
  "Be the first one to spot something."
  DM Sans 400 15px --dust, centered
  
  [32px gap]
  
  "SCAN A CAR →" button
    NOT full width — auto-width, centered
    Bebas Neue 18px --chalk, padding 14px 32px
    Background: --ignition
    Border-radius: --r-sharp (4px — intentionally angular)
    box-shadow: 0 4px 20px rgba(255,69,0,0.3)
    Taps: open scanner tab

Empty state rule: NO progress bars, NO loading spinners, NO suggestions.
If the feed is empty, it says so clearly and points to the one thing to do.
```

### Post Card (When Real Posts Exist)
```
Each post in the feed (infinite scroll, FlatList):

Container:
  Full width, no horizontal margins
  Background: --carbon
  Border-bottom: 1px solid --gridline
  marginBottom: 0 (no gap between posts — they're a continuous column)

HEADER (52px height):
  paddingHorizontal: 16px
  Vertically centered

  Left: Avatar (36px circle)
    Background: --tarmac (if no photo)
    If premium user: --ignition 2px border ring
    If no profile photo: user's initials, DM Sans 600 14px --chalk, centered
    
  Name column (left of avatar, gap 10px):
    "@username" DM Sans 600 15px --chalk
    "Hunter · Level 12" DM Sans 400 12px --dust
    
  Right: "Follow" pill (if not following this user)
    64px × 28px, border 1.5px --ignition, --ignition text "Follow"
    DM Sans 500 13px
    
    On tap: 
      Border transitions to --gridline
      Text transitions to "✓ Following" in --dust
      Background: ignition fills in left→right (clip-path animation, 300ms ease-out)
      Text: becomes --chalk "✓ Following"
      Haptic: ImpactFeedbackStyle.Light

CAR PHOTO (full width, 300px height):
  The actual photo the user took. object-fit: cover. 
  No filters. No overlays except:
  
  Bottom-left: Rarity badge
    "[RARITY]" Bebas Neue 11px --chalk
    Background: rarity colour, border-radius: 4px, padding 4px 10px
    8px from bottom and left edges
    
  Bottom-right: Distance (ONLY if user is within 5km and has location on)
    "0.4 km away" DM Sans 500 11px --chalk
    Background: rgba(8,8,8,0.7), border-radius: 4px, padding 4px 10px

CAPTION (if user wrote one):
  paddingHorizontal: 16px, paddingVertical: 10px
  DM Sans 400 15px --chalk, line-height 1.6
  Max 3 lines. If longer:
    "...more" tappable link in --ignition (reveals full caption inline, no new screen)
  
  If no caption: this section is hidden entirely (zero height, zero margin)

META ROW:
  paddingHorizontal: 16px, paddingVertical: 6px
  "📍 Kanpur · 2h ago" DM Sans 400 12px --dust
  [If show location was OFF: "📍 Location hidden · 2h ago"]

ACTION ROW:
  paddingHorizontal: 16px, paddingBottom: 16px, paddingTop: 4px
  
  Layout: [❤ 0] [💬 0] [↗] — all left-aligned, gap 20px between
  
  LIKE: heart icon 20px + count DM Sans 400 13px --dust
    ON TAP:
      1. Heart: scale 1.0 → 1.5 (100ms EASE_OUT_EXPO) + colour --void-txt → #FF4458
      2. 8 particles burst radially: 3–5px circles, #FF4458 and --ignition mixed
         Travel 20–30px, fade 380ms
      3. Count: slot-machine flip (+1, 150ms vertical slide)
         Old count slides up: translateY 0 → -14px, opacity 1→0, 120ms
         New count slides in: translateY 14px → 0, opacity 0→1, 120ms
      4. Scale returns: 1.5 → 1.0, SPRING_POP 200ms
      5. Haptic: ImpactFeedbackStyle.Light
    
    DOUBLE-TAP on photo: triggers same like animation + a floating heart (56px, red)
      rises from tap position: translateY 0 → -60px, scale 0 → 1.0 → 0.8
      opacity 1 → 0, 800ms total
    
  COMMENT: bubble icon 20px + count DM Sans 400 13px --dust
    Tap → Comments sheet

  SHARE: arrow.up.right.square icon 20px --dust
    Tap → native share sheet with a generated image card
    Generated card: 1080×1920px (stories format)
      Car photo full bleed + Apex logo bottom-right + rarity badge + car name + "Spotted on Apex"
```

---

## SECTION 10 — MAP SCREEN (Real, No Simulation)

### What the Map Shows (ONLY real data)
```
Real community car spots: YES (only spots that actually exist in DB)
User's real GPS position: YES (if permission granted)
Active hunts: YES (only if a real hunt is currently live)
Fake pins/fake hunts/demo data: NEVER

If there are zero spots and zero hunts:
  Map renders with user's position dot only.
  An honest, beautiful empty map.
  Nothing more.
  
  Empty map overlay (bottom-sheet, 80px, always visible):
    Background: rgba(8,8,8,0.88)
    "No spots nearby yet. Scan a car and be the first."
    DM Sans 400 14px --dust, centered
    [SCAN NOW] small text button --ignition, centered
    
    This overlay is NOT a bottom sheet that obscures the map.
    It's a small pill that sits above the tab bar.
```

### Map Config
```javascript
// Mapbox dark map:
import MapView from 'react-native-maps'

<MapView
  style={{ flex: 1 }}
  customMapStyle={APEX_MAP_STYLE}   // dark JSON style defined below
  showsUserLocation={false}          // We render custom user dot
  showsMyLocationButton={false}
  toolbarEnabled={false}
  moveOnMarkerPress={false}
  initialRegion={{
    latitude: userLocation.latitude,       // REAL GPS
    longitude: userLocation.longitude,     // REAL GPS
    latitudeDelta: 0.04,
    longitudeDelta: 0.04,
  }}
/>

// Map style:
const APEX_MAP_STYLE = [
  {"elementType":"geometry","stylers":[{"color":"#0A0A0A"}]},
  {"elementType":"labels.text.fill","stylers":[{"color":"#555555"}]},
  {"elementType":"labels.text.stroke","stylers":[{"color":"#0A0A0A"}]},
  {"featureType":"road","elementType":"geometry","stylers":[{"color":"#1C1C1C"}]},
  {"featureType":"road.highway","elementType":"geometry","stylers":[{"color":"#252525"}]},
  {"featureType":"road.highway","elementType":"geometry.stroke",
   "stylers":[{"color":"#1A0A00"}]},
  {"featureType":"water","elementType":"geometry","stylers":[{"color":"#050D12"}]},
  {"featureType":"poi","stylers":[{"visibility":"off"}]},
  {"featureType":"transit","stylers":[{"visibility":"off"}]},
  {"featureType":"administrative.locality","elementType":"labels.text.fill",
   "stylers":[{"color":"#444444"}]},
  {"featureType":"landscape","elementType":"geometry",
   "stylers":[{"color":"#0D0D0D"}]}
]
```

### User Location Marker
```javascript
// Custom Animated component as <Marker>:
// NOT the default blue dot. Never.

// Three rings (all using Reanimated):
// Core: 10px circle, --ignition fill, white 2px border
// Ring 1: 26px, --ignition border 2px at 70%, scale 1→1.6, opacity 0.8→0, 2s loop
// Ring 2: same, 650ms phase offset
// Ring 3: same, 1,300ms phase offset
// Accuracy circle: only shown if GPS accuracy > 25m
//   Large translucent circle, radius = accuracy in map units
//   --ignition at 5% fill, 1px stroke at 20%
```

### Community Pin Design
```javascript
// Custom <Marker> component (52×64px):

// Shape: rounded-rect main body (52×48px) + downward triangle point (12×16px)
// Background: --carbon
// Border: 2px solid [rarityColour]
// Inside: car thumbnail (44×36px, rounded 7px) + 4px rarity colour strip at bottom

// RARITY ADDITIONS:
// Rare: border glows softly, no animation
// Epic: border breathing glow (opacity 0.5→1.0, 2.5s loop)
// Legendary+: slow gold halo ring orbiting outside pin (12px, 1.5px stroke, 3.5s rotation)
// Mythic: animated prismatic border + 2 particles/second shed from pin top

// ENTRY ANIMATION (when pin first appears via realtime):
// 1. Circular shockwave from pin location: scale 0→2.5, opacity 0.8→0, 500ms, rarity colour
// 2. Pin: scale 0→1.2→1.0, SPRING_POP (damping:8, stiffness:180)
// 3. Brief bounce: translateY 0→-10px→0, SPRING_JELLY 350ms
```

### Hunt Zone (Only Renders When Real Hunt Exists)
```javascript
// If no active hunts: this renders NOTHING. No demo zone.

// When real hunt is live:
// Layer 1: MapView.Circle, fillColor: rgba(255,69,0,0.06), strokeWidth 0
// Layer 2: Animated ring, strokeWidth 2, --ignition at 60%, scale 1→1.07→1, 2.5s loop
// Layer 3: Same ring, 830ms offset
// Layer 4: Same ring, 1,660ms offset
// Layer 5: Spinning dashed ring, strokeWidth 2, --ignition at 85%
//           lineDashPattern: [10, 7]
//           Animated dashOffset: increases 2 units every 80ms → appears to spin clockwise

// GPS-based navigation to hunt zone:
// A Polyline from userLocation to nearest point on hunt radius circle
// strokeColor: --ignition, strokeWidth 3, lineDashPattern: [7, 5]
// 5–7 chevron markers along the line, sequentially pulsing opacity (0.3→1.0→0.3)
// Creates "flowing arrows" direction indicator toward hunt zone
```

---

## SECTION 11 — HUNT SYSTEM (Real Only)

### What a Hunt Is
```
A hunt only exists when a real user scanned a real Uncommon+ car
and toggled "Start a Hunt" ON in the post composer.

There are no automated hunts.
There are no "demo hunts" for onboarding.
There are no scheduled hunts.
If no user has triggered a hunt, there are no hunts.
```

### Hunt Screen (When User Taps Hunt Notification)
```
User receives push notification:
  Title: "🔥 Rare car spotted in [Real City]"
  Body: "A [RARITY] was spotted nearby. Hunt ends in 5:00."
  DeepLink: opens HuntScreen with hunt_id parameter

HuntScreen:
  Full screen map (same dark style as Map tab)
  
  Hunt zone displayed (real approximate location — city district level, not street)
  
  TOP BAR (absolute, top safe-area):
    Background: rgba(8,8,8,0.92)
    Left: "← BACK" DM Sans 600 14px --chalk
    Center: Countdown timer: "04:32" Barlow Condensed 600 32px
            Normal: --chalk
            < 60 seconds: --danger, scale 1.0→1.03→1.0 pulse every second
    Right: "👥 [count]" DM Sans 500 14px --chalk (real participant count from WebSocket)

  LIVE LEADERBOARD (bottom sheet, 26% height, above tab bar):
    Background: rgba(8,8,8,0.92)
    Top: 2px --ignition accent bar
    
    If no submissions yet:
      "No submissions yet. Hunt the car!" DM Sans 400 14px --dust, centered
      
    If submissions exist:
      Rows: [#rank] [avatar] [@username] [time] e.g. "#1 @driver_27 1m 12s"
      DM Sans 500 14px --chalk for rank, DM Sans 400 13px --dust for username+time
      
      NEW SUBMISSION ENTRY:
        Row slides in from RIGHT: translateX 100% → 0, SPRING_SETTLE 300ms
        Existing rows shift down: 60ms stagger
        Rank numbers: slot-machine flip (translateY slide, 150ms)
        If viewer submitted: their row has --ignition left border, 3px

  WHEN USER ENTERS ZONE (geofence trigger — real GPS):
    BlurView over MapView: blurAmount 0→28, 900ms ease-in-out, tint: 'dark'
    Map becomes unreadable.
    
    Center text fades in (600ms delay after blur starts):
      "YOU'RE IN" Bebas Neue 52px --chalk
      "THE ZONE." Bebas Neue 52px --ignition
      DM Sans 400 15px --dust: "Find the car. Scan it."
    
    Large SCAN button rises from bottom:
      Same as main scanner button (76px outer, 60px inner --ignition)
      "SCAN IT" DM Sans 600 14px --chalk, centered 12px below button
      SPRING_SETTLE entry animation, 400ms after blur completes
```

### Hunt End
```
When timer hits 0:00:
  Blur fades out: 600ms ease-out
  Hunt zone circle: colour fades to --smoke, then dissolves over 400ms
  
  Results bottom sheet slides up (SPRING_SETTLE):
    Height: 50% screen height
    Background: --carbon
    Border-radius top: 20px
    2px --ignition accent bar at top
    
    Content:
      "HUNT OVER" Bebas Neue 36px --chalk, centered
      
      IF USER WON:
        "+300 XP BONUS" Bebas Neue 28px --ignition, centered
        "You found it first." DM Sans 400 15px --dust, centered
        Confetti: 40 particles from sheet top, ignition+gold colours
        
      IF USER DIDN'T WIN:
        "+50 XP" small, --dust
        "Better luck next time, [their rank of N]" DM Sans 400 15px --dust
        
      Full leaderboard of this hunt (all participants, ranked by time)
      
    "CLOSE" button: ghost full-width, Bebas Neue 20px --chalk
```

---

## SECTION 12 — GARAGE SCREEN (Real Cards Only)

### Empty State (New User, Zero Scans)
```
Background: --void

Full height content (vertically centered at 45% from top):

  A garage floor illustration:
    SVG, 200×120px
    Two parallel lines (lane markings), --gridline stroke 1.5px
    An empty space between them — where a car should be
    Very subtle, very minimal
    
  [24px gap]
  
  "YOUR GARAGE IS EMPTY."
  Bebas Neue 40px --chalk, centered
  
  [12px gap]
  
  "Every car you scan becomes a card."
  DM Sans 400 15px --dust, centered
  
  [32px gap]
  
  "SCAN YOUR FIRST CAR →"
    Same angular button style (border-radius: 4px)
    --ignition background, Bebas Neue 18px --chalk
    Taps: opens scanner tab
```

### Garage Grid (When Cards Exist)
```
HEADER:
  "MY GARAGE" Bebas Neue 48px --chalk, paddingTop safe-area + 16px, paddingLeft 20px
  "[count] Cars" DM Sans 400 14px --dust, paddingLeft 20px, marginTop 4px
  
  Filter row: paddingHorizontal 20px, paddingTop 12px
    [Sort ▾] [Filter] [⊞ / ☰] — all DM Sans 500 13px --dust chips
    Active filter: --ignition border + text

GRID:
  2-column grid, paddingHorizontal 16px, gap 10px
  Each card: (screenWidth - 42px) / 2 wide × (card_width × 1.4) tall

CARD ENTRY (when garage first loads):
  Cards render with staggered spring entry:
    Each card: scale 0.90 → 1.0, opacity 0 → 1
    Spring: SPRING_JELLY (damping:7, stiffness:350, mass:0.7)
    Stagger: 60ms per card (nearest first)
  Feels like cards being laid down one by one

CARD DESIGN (in grid):
  Top 58% of card: user's REAL photo, object-fit cover
  Gradient overlay bottom 60px of photo: transparent → --carbon (seamless blend)
  
  Bottom 42% (stat panel):
    Background: --carbon
    Top border: 2px rarity colour
    Padding: 10px 12px
    
    Car name: Bebas Neue 16px --chalk, 1 line, ellipsis overflow
    Sub: DM Sans 400 10px --dust: [body style] · [country]
    
    2×3 stat grid (compact for card):
      Label: DM Sans 500 9px --void-txt letter-spacing 1px
      Value: Barlow Condensed 600 16px --chalk
      
      TOP SPEED    HORSEPOWER
      Engine       0-100
      TORQUE       WEIGHT
    
    Footer row:
      Left:  "RELEASED" 9px + year Barlow Condensed 600 15px
      Right: "SPOTTED" 9px + date Barlow Condensed 600 15px
    
    Location: "📍 [City], [State]" DM Sans 400 10px --void-txt, centered

  Rarity border: 1.5px rarity colour border around entire card
  
  LEGENDARY+: Holographic foil (diagonal white stripe sweep, 6s loop, opacity 0→6%→0)
  MYTHIC: Animated prismatic border (gradient rotates 360° every 2.5s) + corner particles

CARD LONG-PRESS (context menu, native):
  "View Full Card" — opens CardDetail
  "Share" — generates story card
  "Delete" — confirmation dialog, removes from garage

CARD PRESS → CardDetail:
  Shared element transition (react-native-shared-element):
    The card expands from grid position to fill screen
    Photo expands upward, stat panel pulls down to bottom sheet position
    350ms EASE_OUT_EXPO
  No slide transition — the card itself is the transition
```

---

## SECTION 13 — ALL EMPTY STATES (Master Reference)

```
Every screen has a beautiful empty state.
NONE of them have fake/sample data.
NONE of them are "loading forever."
NONE of them suggest the app is broken.

SCREEN → HEADLINE → BODY → CTA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Home (no quest)         → [Quest card hidden, nothing fills that space]

Feed (no posts)         → "NOTHING HERE YET."
                          "Be the first to spot something."
                          [SCAN A CAR →] button

Map (no nearby spots)   → Small bottom pill: 
                          "No spots nearby. Scan first."
                          [SCAN] text button

Garage (no cards)       → "YOUR GARAGE IS EMPTY."
                          "Every car you scan becomes a card."
                          [SCAN YOUR FIRST CAR →]

Hunts (no active hunts) → Full page: "NO HUNTS ACTIVE."
                          "When someone spots a rare car nearby,
                          a hunt goes live here."
                          [nothing more — no fake countdown]

Leaderboard (rank N/A)  → User's own row shows "UNRANKED"
                          "Scan cars to earn your rank."

Social/Friends (none)   → "NO FRIENDS YET."
                          "Share your Apex username to connect."
                          [COPY USERNAME] button

Notifications (none)    → "ALL CAUGHT UP."
                          [No CTA — this is a positive state]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Empty state design rules:
  - Always vertically centered at 40–45% from top
  - Icon/illustration: always SVG, never emoji at large size, --gridline colour
  - Headline: Bebas Neue 36–40px --chalk
  - Body: DM Sans 400 15px --dust, max-width 260px, centered
  - CTA: only if there's a clear action to take
  - CTA style: angular (border-radius 4px) --ignition button
  - Never suggest checking internet connection unless it's a network error
  - Never use spinners for empty states (spinner = still loading, empty = nothing to load)
```

---

## SECTION 14 — GEMINI IMPLEMENTATION GUIDE

### How to Use This Document

This spec is written for Gemini to implement Apex.
Every value is explicit. There are no assumed defaults.

**Order of implementation:**
```
1. Set up design system (Section 1): fonts, colours, spacing constants
2. Build onboarding screens (Section 3): auth → role → permissions → welcome
3. Build scanner (Section 5): real camera, EXIF check, AI call
4. Build card reveal animation (Section 8): all 11 phases in order
5. Build post composer (Section 7): real post flow with real questions
6. Build home screen (Section 4): HUD layout with real data or honest empty states
7. Build feed (Section 9): real posts or beautiful empty state
8. Build map (Section 10): real GPS, real pins, no fake data
9. Build garage (Section 12): real cards or empty state
10. Build hunt system (Section 11): real hunts only
```

**Rules Gemini must follow:**
```
1. Never add placeholder data. If an array is empty, render the empty state.
2. Never hardcode a latitude/longitude. Always use device GPS.
3. Never generate a car image. Always use the user's actual captured photo.
4. Never show a hunt zone that doesn't have a real hunt_id from the database.
5. Every animation must use react-native-reanimated, not Animated API.
6. All Skia rendering (particles, streaks, ribbons) uses @shopify/react-native-skia.
7. All spring animations use the exact SPRING_HEAVY / SPRING_POP / etc values above.
8. No border-radius exceeds 20px except perfect circles.
9. No purple, no blue, no teal in ANY element.
10. Empty state text in Bebas Neue headline + DM Sans body only.
```

**Package list (install these, no others for UI):**
```json
{
  "react-native-reanimated": "^3.x",
  "react-native-vision-camera": "^4.x",
  "@shopify/react-native-skia": "^1.x",
  "react-native-maps": "^1.x",
  "expo-location": "^17.x",
  "expo-blur": "^13.x",
  "expo-haptics": "^13.x",
  "lottie-react-native": "^6.x",
  "expo-auth-session": "^5.x",
  "@supabase/supabase-js": "^2.x"
}
```

---

*APEX FINAL SPECIFICATION*
*Design Language: IMMACULATE — pristine, real, earned*
*Everything is real. Nothing is simulated. Empty when empty.*
*Build-ready for Gemini. Zero ambiguity.*
