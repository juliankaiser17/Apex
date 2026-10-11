import React, { useState } from 'react';
import { 
  Camera, 
  MapPin, 
  Globe, 
  Flame, 
  ShieldAlert, 
  Check, 
  Share2, 
  Shield, 
  EyeOff, 
  Crosshair, 
  Clock 
} from 'lucide-react';
import { RarityBadge } from '../ui/RarityBadge';
import { StatChip } from '../ui/StatChip';
import { Button } from '../ui/Button';
import { ScanningReticle } from '../scanner/ScanningReticle';

// ─── LOCAL TEST FIXTURES (0 NETWORK CALLS) ───
const FIXTURE_DAYTONA = {
  id: 'fixture-daytona-sp3',
  make: 'Ferrari',
  model: 'Daytona SP3',
  trim: 'Icona Series Carbon Spec',
  year: 2023,
  rarity: 'legendary' as const,
  horsepower: 840,
  topSpeed: '340 km/h',
  zeroToHundred: '2.85s',
  engine: '6.5L Naturally Aspirated V12',
  bodyStyle: 'Targa Spider',
  originCountry: 'Italy',
  imageUrl: '/spot_ferrari458.jpg',
  city: 'Monaco',
  identificationStatus: 'identified' as const,
  confidence: 0.98,
  serverRecorded: true,
};

const FIXTURE_GARAGE_CARS = [
  { id: 'g-1', make: 'McLaren', model: 'P1', rarity: 'mythic' as const, hp: 903, speed: '350 km/h', image: '/spot_mclaren.jpg' },
  { id: 'g-2', make: 'Ferrari', model: 'Daytona SP3', rarity: 'legendary' as const, hp: 840, speed: '340 km/h', image: '/spot_ferrari458.jpg' },
  { id: 'g-3', make: 'Porsche', model: '911 GT3 RS', rarity: 'legendary' as const, hp: 518, speed: '296 km/h', image: '/spot_porsche997.jpg' },
  { id: 'g-4', make: 'Bugatti', model: 'Chiron Super Sport', rarity: 'mythic' as const, hp: 1578, speed: '440 km/h', image: '/bugatti-chiron.png' },
  { id: 'g-5', make: 'Porsche', model: '911 Carrera S', rarity: 'rare' as const, hp: 443, speed: '308 km/h', image: '/spot_porsche996.jpg' },
  { id: 'g-6', make: 'Toyota', model: 'GR Supra 3.0', rarity: 'uncommon' as const, hp: 382, speed: '250 km/h', image: '/spot_supra.jpg' },
];

export const StoreScreenshotFixtures: React.FC = () => {
  // Read current shot from URL query string ?shot=1..6
  const getInitialShot = () => {
    if (typeof window === 'undefined') return 1;
    const p = new URLSearchParams(window.location.search);
    const s = parseInt(p.get('shot') || '1', 10);
    return s >= 1 && s <= 6 ? s : 1;
  };

  const [activeShot, setActiveShot] = useState<number>(getInitialShot);

  return (
    <div className="relative min-h-[100dvh] bg-[var(--color-void)] text-[var(--color-text)] select-none font-sans overflow-x-hidden">
      {/* ─── DEV QUICK SWITCHER BAR ─── */}
      <div className="fixed top-2 left-2 right-2 z-50 flex items-center justify-between p-2 rounded-[var(--radius-panel)] bg-[var(--color-panel)]/95 backdrop-blur-md border border-[var(--color-line)] shadow-2xl max-w-md mx-auto pointer-events-auto">
        <span className="text-[10px] font-mono font-bold tracking-wider text-[var(--color-text-3)] uppercase px-1">
          SHOT {activeShot}/6
        </span>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5, 6].map(num => (
            <button
              key={num}
              onClick={() => {
                setActiveShot(num);
                const url = new URL(window.location.href);
                url.searchParams.set('shot', String(num));
                window.history.replaceState(null, '', url.toString());
              }}
              className={`w-7 h-7 rounded-lg font-mono text-xs font-bold transition-all ${
                activeShot === num
                  ? 'bg-[var(--color-accent)] text-white shadow-md'
                  : 'bg-[var(--color-panel-2)] text-[var(--color-text-3)] hover:text-white'
              }`}
            >
              {num}
            </button>
          ))}
        </div>
      </div>

      {/* ─── MAIN SHOT VIEWPORT ─── */}
      <div className="pt-14 pb-safe min-h-[100dvh] flex flex-col justify-center">
        {/* SHOT 1: LEGENDARY CARD REVEAL */}
        {activeShot === 1 && (
          <div className="w-full max-w-sm mx-auto px-4 py-6 space-y-4 text-center">
            {/* Status Pill */}
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[var(--color-ok)]/10 border border-[var(--color-ok)]/30 text-[var(--color-ok)] text-xs font-mono font-semibold uppercase tracking-wider">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-ok)]" />
              <span>IDENTIFIED • HIGH CONFIDENCE (98%)</span>
            </div>

            {/* Title Header */}
            <div>
              <span className="text-xs font-mono tracking-widest text-[var(--color-text-3)] uppercase block">
                {FIXTURE_DAYTONA.originCountry} // ICONA SERIES
              </span>
              <h1 className="font-display text-display-l text-[var(--color-text)] leading-tight mt-0.5">
                {FIXTURE_DAYTONA.make} {FIXTURE_DAYTONA.model}
              </h1>
              <p className="text-caption text-[var(--color-text-2)] font-mono mt-0.5">
                {FIXTURE_DAYTONA.trim}
              </p>
            </div>

            {/* Collectible Card Showcase */}
            <div className="relative rounded-[var(--radius-panel)] p-3 bg-[var(--color-panel)] border-2 border-[var(--color-legendary)] shadow-[0_12px_40px_rgba(232,168,56,0.25)] space-y-3">
              <div className="relative aspect-[16/10] rounded-[var(--radius-slab)] overflow-hidden bg-[var(--color-void)]">
                <img
                  src={FIXTURE_DAYTONA.imageUrl}
                  alt={FIXTURE_DAYTONA.model}
                  className="w-full h-full object-cover"
                />
                <div className="absolute top-2.5 left-2.5">
                  <RarityBadge rarity="legendary" size="md" />
                </div>
                <div className="absolute top-2.5 right-2.5">
                  <StatChip label="POWER" value={`${FIXTURE_DAYTONA.horsepower} HP`} />
                </div>
              </div>

              {/* Verified Specs Hairline Cluster */}
              <div className="grid grid-cols-3 gap-2 pt-1 border-t border-[var(--color-line)]">
                <div className="text-center p-1.5 rounded-lg bg-[var(--color-panel-2)]">
                  <span className="text-[9px] font-mono text-[var(--color-text-3)] block uppercase">0-100 KM/H</span>
                  <span className="font-mono text-sm font-bold text-[var(--color-text)]">{FIXTURE_DAYTONA.zeroToHundred}</span>
                </div>
                <div className="text-center p-1.5 rounded-lg bg-[var(--color-panel-2)]">
                  <span className="text-[9px] font-mono text-[var(--color-text-3)] block uppercase">TOP SPEED</span>
                  <span className="font-mono text-sm font-bold text-[var(--color-text)]">{FIXTURE_DAYTONA.topSpeed}</span>
                </div>
                <div className="text-center p-1.5 rounded-lg bg-[var(--color-panel-2)]">
                  <span className="text-[9px] font-mono text-[var(--color-text-3)] block uppercase">ENGINE</span>
                  <span className="font-mono text-xs font-bold text-[var(--color-xp)]">V12 N/A</span>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-2 pt-2">
              <Button variant="primary" size="lg" className="w-full">
                <Check className="w-5 h-5 mr-2" />
                Save to Garage (Cloud Confirmed)
              </Button>
              <Button variant="secondary" size="md" className="w-full">
                <Share2 className="w-4 h-4 mr-2" />
                Share to Community Feed
              </Button>
            </div>
          </div>
        )}

        {/* SHOT 2: SCANNER LOCKED ON A CAR */}
        {activeShot === 2 && (
          <div className="relative w-full h-[calc(100dvh-56px)] flex flex-col justify-between p-4 overflow-hidden">
            {/* Viewfinder Background Simulation */}
            <div className="absolute inset-0 z-0">
              <img
                src="/spot_ferrari458.jpg"
                alt="Scanner preview"
                className="w-full h-full object-cover filter brightness-75 contrast-125"
              />
              <div className="absolute inset-0 bg-black/30" />
            </div>

            {/* Top HUD Strip */}
            <div className="relative z-10 flex items-center justify-between p-3 rounded-[var(--radius-panel)] bg-[var(--color-panel)]/80 backdrop-blur-md border border-[var(--color-line)] max-w-sm mx-auto w-full">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[var(--color-ok)] animate-pulse" />
                <span className="text-xs font-mono font-bold tracking-wider text-[var(--color-text)] uppercase">
                  TARGET LOCK // 14M
                </span>
              </div>
              <span className="text-xs font-mono text-[var(--color-xp)] font-bold">
                PROBABLE FERRARI
              </span>
            </div>

            {/* Central Scanning Reticle HUD */}
            <div className="relative z-10 my-auto">
              <ScanningReticle isScanning={true} status="locking" makeName="FERRARI 296 GTB" />
            </div>

            {/* Shutter Shutter Trigger Bar */}
            <div className="relative z-10 flex items-center justify-center pb-8">
              <div className="w-20 h-20 rounded-full border-4 border-[var(--color-accent)] p-1 flex items-center justify-center shadow-[0_0_30px_var(--color-accent)]">
                <div className="w-full h-full rounded-full bg-[var(--color-accent)] flex items-center justify-center text-white">
                  <Camera className="w-8 h-8" />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* SHOT 3: ONE CAR IN TWO CITIES SHOWING RARITY */}
        {activeShot === 3 && (
          <div className="w-full max-w-sm mx-auto px-4 py-4 space-y-4">
            <div className="text-center space-y-1">
              <span className="text-[10px] font-mono tracking-widest text-[var(--color-accent)] font-bold uppercase block">
                LOCAL RARITY ENGINE
              </span>
              <h2 className="font-display text-display-m text-[var(--color-text)]">
                Dynamic Territory Multipliers
              </h2>
              <p className="text-secondary text-[var(--color-text-3)] text-xs">
                A car's rarity reflects real local census distribution.
              </p>
            </div>

            {/* City 1: Stuttgart (Baseline Common/Rare) */}
            <div className="rounded-[var(--radius-panel)] p-4 bg-[var(--color-panel)] border border-[var(--color-line)] space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-mono font-bold text-[var(--color-text)]">
                  <MapPin className="w-4 h-4 text-[var(--color-text-3)]" />
                  <span>STUTTGART, GERMANY</span>
                </div>
                <RarityBadge rarity="rare" size="sm" />
              </div>
              <div className="flex items-center gap-3">
                <img src="/spot_porsche997.jpg" alt="Porsche Stuttgart" className="w-16 h-16 rounded-lg object-cover border border-[var(--color-line)]" />
                <div className="flex-1">
                  <h3 className="font-display text-lg text-[var(--color-text)] leading-none">Porsche 911 GT3 RS</h3>
                  <span className="text-xs font-mono text-[var(--color-text-3)] block mt-1">Universal Baseline Rarity</span>
                  <span className="text-[11px] font-mono font-bold text-[var(--color-text-2)]">1.00x Base XP</span>
                </div>
              </div>
              <p className="text-[11px] text-[var(--color-text-3)] border-t border-[var(--color-line)] pt-2 leading-tight">
                High regional production volume in the Baden-Württemberg sector. Standard XP curve.
              </p>
            </div>

            {/* City 2: Mumbai (Dynamic Legendary with Area Bonus) */}
            <div className="rounded-[var(--radius-panel)] p-4 bg-[var(--color-panel)] border-2 border-[var(--color-legendary)] shadow-[0_8px_32px_rgba(232,168,56,0.2)] space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-mono font-bold text-[var(--color-xp)]">
                  <Globe className="w-4 h-4 text-[var(--color-xp)]" />
                  <span>MUMBAI, INDIA</span>
                </div>
                <RarityBadge rarity="legendary" size="sm" />
              </div>
              <div className="flex items-center gap-3">
                <img src="/spot_porsche997.jpg" alt="Porsche Mumbai" className="w-16 h-16 rounded-lg object-cover border border-[var(--color-legendary)]" />
                <div className="flex-1">
                  <h3 className="font-display text-lg text-[var(--color-text)] leading-none">Porsche 911 GT3 RS</h3>
                  <span className="text-xs font-mono text-[var(--color-xp)] font-semibold block mt-1">+45% Territory Bonus</span>
                  <span className="text-[11px] font-mono font-bold text-[var(--color-ok)]">1.45x Local XP Modifier</span>
                </div>
              </div>
              <p className="text-[11px] text-[var(--color-text-2)] border-t border-[var(--color-line)] pt-2 leading-tight">
                Extreme rarity in South Asia sector. 1 of only 4 verified registry sightings across the subcontinent.
              </p>
            </div>
          </div>
        )}

        {/* SHOT 4: THE HUNT ALERT */}
        {activeShot === 4 && (
          <div className="w-full max-w-sm mx-auto px-4 py-6 space-y-4">
            <div className="rounded-[var(--radius-panel)] p-5 bg-[var(--color-panel)] border-2 border-[var(--color-accent)] shadow-[0_12px_44px_var(--accent-glow-strong)] space-y-4">
              {/* Header Badge */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-[var(--color-void)] text-[var(--color-accent)] border border-[var(--color-accent)]/40 animate-pulse">
                    <ShieldAlert className="w-6 h-6" />
                  </div>
                  <div>
                    <span className="text-[10px] font-mono font-bold tracking-widest text-[var(--color-accent)] uppercase block">
                      SECTOR RADAR ALERT
                    </span>
                    <h3 className="font-display text-display-m text-[var(--color-text)] leading-none">
                      ACTIVE HUNT ZONE
                    </h3>
                  </div>
                </div>
                <div className="flex items-center gap-1 font-mono text-xs font-bold text-[var(--color-xp)] bg-[var(--color-panel-2)] px-2.5 py-1 rounded-full border border-[var(--color-line)]">
                  <Clock className="w-3.5 h-3.5" />
                  <span>04:22</span>
                </div>
              </div>

              {/* Target Image & Details */}
              <div className="relative aspect-[16/9] rounded-[var(--radius-slab)] overflow-hidden bg-[var(--color-void)] border border-[var(--color-line)]">
                <img
                  src="/spot_mclaren.jpg"
                  alt="Hunt Target"
                  className="w-full h-full object-cover"
                />
                <div className="absolute bottom-2 left-2 right-2 p-2 rounded-lg bg-[var(--color-void)]/90 backdrop-blur-md flex items-center justify-between">
                  <div>
                    <h4 className="font-display text-lg text-[var(--color-text)] leading-none">McLaren P1 Longtail</h4>
                    <span className="text-[10px] font-mono text-[var(--color-text-3)]">Sector 4 · 0.8 km away</span>
                  </div>
                  <RarityBadge rarity="mythic" size="sm" />
                </div>
              </div>

              {/* Reward Chips */}
              <div className="grid grid-cols-2 gap-2 text-center">
                <div className="p-2 rounded-lg bg-[var(--color-panel-2)] border border-[var(--color-line)]">
                  <span className="text-[9px] font-mono text-[var(--color-text-3)] uppercase block">FIRST DISCOVERY</span>
                  <span className="font-mono text-sm font-bold text-[var(--color-xp)]">+1,500 XP</span>
                </div>
                <div className="p-2 rounded-lg bg-[var(--color-panel-2)] border border-[var(--color-line)]">
                  <span className="text-[9px] font-mono text-[var(--color-text-3)] uppercase block">COLLECTOR TROPHY</span>
                  <span className="font-mono text-sm font-bold text-[var(--color-ok)]">MYTHIC BADGE</span>
                </div>
              </div>

              {/* CTA Button */}
              <Button variant="primary" size="lg" className="w-full">
                <Flame className="w-5 h-5 mr-2" />
                Join Live Radar Hunt
              </Button>
            </div>
          </div>
        )}

        {/* SHOT 5: POPULATED GARAGE */}
        {activeShot === 5 && (
          <div className="w-full max-w-md mx-auto px-4 py-4 space-y-3.5">
            {/* Header & Stats Strip */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h1 className="font-display text-display-l text-[var(--color-text)]">COLLECTION</h1>
                <span className="text-xs font-mono font-bold text-[var(--color-xp)] bg-[var(--color-panel)] px-3 py-1 rounded-full border border-[var(--color-line)]">
                  LEVEL 5 SPOTTER
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 p-2.5 rounded-[var(--radius-panel)] bg-[var(--color-panel)] border border-[var(--color-line)] text-center">
                <div>
                  <span className="text-[9px] font-mono text-[var(--color-text-3)] uppercase block">SLOTS</span>
                  <span className="font-mono text-sm font-bold text-[var(--color-text)]">6 / 6 FULL</span>
                </div>
                <div>
                  <span className="text-[9px] font-mono text-[var(--color-text-3)] uppercase block">TOTAL POWER</span>
                  <span className="font-mono text-sm font-bold text-[var(--color-text)]">5,185 HP</span>
                </div>
                <div>
                  <span className="text-[9px] font-mono text-[var(--color-text-3)] uppercase block">RAREST TIER</span>
                  <span className="font-mono text-sm font-bold text-[var(--color-accent)]">MYTHIC</span>
                </div>
              </div>
            </div>

            {/* Masonry Slabs Grid */}
            <div className="grid grid-cols-2 gap-2.5 max-h-[68vh] overflow-y-auto no-scrollbar pb-6">
              {FIXTURE_GARAGE_CARS.map(car => (
                <div
                  key={car.id}
                  className="rounded-[var(--radius-panel)] p-2.5 bg-[var(--color-panel)] border border-[var(--color-line)] hover:border-[var(--color-accent)] transition-all space-y-2"
                >
                  <div className="relative aspect-[4/3] rounded-[var(--radius-slab)] overflow-hidden bg-[var(--color-void)]">
                    <img src={car.image} alt={car.model} className="w-full h-full object-cover" />
                    <div className="absolute top-1.5 left-1.5">
                      <RarityBadge rarity={car.rarity} size="sm" />
                    </div>
                  </div>
                  <div>
                    <span className="text-[10px] font-mono text-[var(--color-text-3)] uppercase block">{car.make}</span>
                    <h4 className="font-display text-base text-[var(--color-text)] leading-tight truncate">{car.model}</h4>
                    <div className="flex items-center justify-between text-[10px] font-mono text-[var(--color-text-2)] mt-1 pt-1 border-t border-[var(--color-line)]">
                      <span>{car.hp} HP</span>
                      <span>{car.speed}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* SHOT 6: LOCATION PRIVACY SHEET */}
        {activeShot === 6 && (
          <div className="relative w-full h-[calc(100dvh-56px)] flex flex-col justify-end overflow-hidden">
            {/* Background Map Simulation */}
            <div className="absolute inset-0 z-0">
              <div className="w-full h-full bg-[var(--color-void)] relative">
                {/* Simulated Grid Road Map */}
                <div className="absolute inset-0 opacity-20" style={{
                  backgroundImage: 'radial-gradient(var(--color-line) 1px, transparent 1px)',
                  backgroundSize: '24px 24px'
                }} />
                {/* Pinpoint Location Marker */}
                <div className="absolute top-1/4 left-1/2 -translate-x-1/2 flex items-center justify-center">
                  <div className="w-24 h-24 rounded-full border-2 border-dashed border-[var(--color-xp)] bg-[var(--color-xp)]/10 animate-pulse" />
                  <div className="absolute w-3 h-3 rounded-full bg-white shadow-[0_0_12px_white]" />
                </div>
              </div>
            </div>

            {/* Bottom Sheet Presentation */}
            <div className="relative z-10 w-full max-w-md mx-auto p-5 rounded-t-[24px] bg-[var(--color-panel)] border-t border-[var(--color-line)] shadow-[0_-16px_50px_rgba(0,0,0,0.8)] space-y-4">
              <div className="w-12 h-1 bg-[var(--color-line)] rounded-full mx-auto" />
              
              <div className="flex items-center justify-between border-b border-[var(--color-line)] pb-3">
                <h3 className="font-display text-display-m text-[var(--color-text)]">
                  Location Privacy
                </h3>
                <span className="text-[10px] font-mono text-[var(--color-xp)] bg-[var(--color-xp)]/10 px-2 py-0.5 rounded border border-[var(--color-xp)]/30">
                  PROTECTED
                </span>
              </div>

              <div className="space-y-2">
                {/* Option 1: Exact Pin */}
                <div className="p-3 rounded-[var(--radius-panel)] border border-[var(--color-line)] bg-[var(--color-void)] flex items-start gap-3 opacity-60">
                  <div className="p-2 rounded-lg bg-[var(--color-panel-2)] text-[var(--color-text-3)]">
                    <Crosshair className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="font-display text-base text-[var(--color-text)]">Exact Pinpoint</h4>
                    <p className="text-[11px] text-[var(--color-text-3)]">Real-time GPS coordinates. Best for active track meets.</p>
                  </div>
                </div>

                {/* Option 2: 1km Blurred Zone (Active) */}
                <div className="p-3 rounded-[var(--radius-panel)] border-2 border-[var(--color-xp)] bg-[var(--color-panel-2)] flex items-start gap-3 shadow-lg">
                  <div className="p-2 rounded-lg bg-[var(--color-xp)]/15 text-[var(--color-xp)]">
                    <Shield className="w-4 h-4" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <h4 className="font-display text-base text-[var(--color-text)]">1km Blurred Zone</h4>
                      <span className="text-[9px] font-mono uppercase px-2 py-0.5 rounded-full bg-[var(--color-xp)]/20 text-[var(--color-xp)] font-bold">
                        ACTIVE
                      </span>
                    </div>
                    <p className="text-[11px] text-[var(--color-text-2)] mt-0.5">
                      Masks exact address with a 1km approximate perimeter circle. Protects home and workplace privacy.
                    </p>
                  </div>
                </div>

                {/* Option 3: Ghost Mode */}
                <div className="p-3 rounded-[var(--radius-panel)] border border-[var(--color-line)] bg-[var(--color-void)] flex items-start gap-3 opacity-60">
                  <div className="p-2 rounded-lg bg-[var(--color-panel-2)] text-[var(--color-text-3)]">
                    <EyeOff className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="font-display text-base text-[var(--color-text)]">Ghost Mode</h4>
                    <p className="text-[11px] text-[var(--color-text-3)]">Completely invisible on local radars. Browse in private.</p>
                  </div>
                </div>
              </div>

              <Button variant="primary" size="lg" className="w-full">
                Save Privacy Preference
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
