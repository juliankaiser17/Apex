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
  Clock,
  Circle,
  ChevronUp,
  Diamond,
  Hexagon,
  Star,
  Sparkles
} from 'lucide-react';

// ─── LOCAL INLINE BADGE & CHIP UTILITIES ───
type RarityTier = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'mythic';

const RarityBadge: React.FC<{ rarity: RarityTier; size?: 'sm' | 'md'; showIcon?: boolean }> = ({
  rarity,
  size = 'md',
  showIcon = true,
}) => {
  const norm = (rarity?.toLowerCase() || 'common') as RarityTier;
  const isMythic = norm === 'mythic';
  const isLegendary = norm === 'legendary';

  const sizeClasses = size === 'sm' ? 'text-[10px] px-2 py-0.5 gap-1' : 'text-xs px-2.5 py-1 gap-1.5';
  const iconSize = size === 'sm' ? 10 : 12;

  const renderIcon = () => {
    switch (norm) {
      case 'uncommon': return <ChevronUp size={iconSize} className="stroke-[3]" />;
      case 'rare': return <Diamond size={iconSize} className="fill-current" />;
      case 'epic': return <Hexagon size={iconSize} className="fill-current" />;
      case 'legendary': return <Star size={iconSize} className="fill-current" />;
      case 'mythic': return <Sparkles size={iconSize} className="animate-pulse" />;
      default: return <Circle size={iconSize} className="fill-current" />;
    }
  };

  return (
    <span
      className={`inline-flex items-center rounded-full font-mono uppercase tracking-wider font-bold select-none ${sizeClasses} ${
        isMythic
          ? 'bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500 text-white shadow-[0_0_12px_rgba(255,79,216,0.5)]'
          : isLegendary
          ? 'bg-[#E8A838] text-black font-black shadow-[0_0_12px_rgba(232,168,56,0.4)]'
          : 'bg-[#2563EB] text-white shadow-[0_0_8px_rgba(37,99,235,0.4)]'
      }`}
    >
      {showIcon && renderIcon()}
      <span>{norm}</span>
    </span>
  );
};

const StatChip: React.FC<{ label?: string; value: string | number }> = ({ label, value }) => (
  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-white/10 bg-black/80 backdrop-blur-sm">
    {label && <span className="text-[10px] font-mono text-zinc-400 uppercase">{label}</span>}
    <span className="font-mono text-xs font-bold text-white">{value}</span>
  </div>
);

const Button: React.FC<{ children: React.ReactNode; variant?: 'primary' | 'secondary'; size?: 'md' | 'lg'; className?: string }> = ({
  children,
  variant = 'secondary',
  size = 'md',
  className = '',
}) => {
  const sizeClass = size === 'lg' ? 'min-h-[50px] px-6 py-3 text-sm font-bold' : 'min-h-[44px] px-4 py-2 text-xs font-semibold';
  const variantClass = variant === 'primary'
    ? 'bg-[#E50914] text-white shadow-[0_4px_20px_rgba(229,9,20,0.5)] border border-white/20 hover:brightness-110'
    : 'bg-zinc-800/90 text-white border border-white/10 hover:border-white/30';

  return (
    <button className={`inline-flex items-center justify-center rounded-xl transition-all select-none cursor-pointer ${sizeClass} ${variantClass} ${className}`}>
      {children}
    </button>
  );
};

// Precision Scanning Reticle HUD for Shot 2
const ScanningReticleHUD: React.FC<{ makeName: string }> = ({ makeName }) => {
  return (
    <div className="relative my-auto w-[320px] max-w-[85vw] h-[260px] mx-auto pointer-events-none flex flex-col justify-between select-none">
      {/* 1. Rangefinder Telemetry Strip */}
      <div className="flex justify-between items-center px-1 text-[9px] font-mono tracking-widest text-zinc-400 drop-shadow-[0_1px_3px_rgba(0,0,0,0.95)]">
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-[#E50914] animate-pulse" />
          <span className="uppercase text-white font-bold">TARGET LOCK</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-white font-bold tracking-wider uppercase">{makeName}</span>
          <span>35MM // F2.8</span>
        </div>
      </div>

      {/* 2. Rangefinder Corner Brackets */}
      <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
        <div className="flex justify-between items-start">
          <div className="w-9 h-9 border-t-[2.5px] border-l-[2.5px] border-[#E50914] rounded-tl-lg drop-shadow-[0_1px_4px_rgba(0,0,0,0.95)]" />
          <div className="w-9 h-9 border-t-[2.5px] border-r-[2.5px] border-[#E50914] rounded-tr-lg drop-shadow-[0_1px_4px_rgba(0,0,0,0.95)]" />
        </div>
        <div className="flex justify-between items-end">
          <div className="w-9 h-9 border-b-[2.5px] border-l-[2.5px] border-[#E50914] rounded-bl-lg drop-shadow-[0_1px_4px_rgba(0,0,0,0.95)]" />
          <div className="w-9 h-9 border-b-[2.5px] border-r-[2.5px] border-[#E50914] rounded-br-lg drop-shadow-[0_1px_4px_rgba(0,0,0,0.95)]" />
        </div>
      </div>

      {/* 3. Central Aperture & Reticle */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none flex items-center justify-center">
        <div className="w-20 h-20 rounded-full border border-dashed border-[#E50914]/40" />
        <div className="absolute w-12 h-12 rounded-full border border-[#E50914]/60" />
        <div className="absolute w-2 h-2 rounded-full bg-[#E50914] drop-shadow-[0_0_4px_#E50914]" />
        <div className="absolute left-[-16px] w-3 h-[1px] bg-[#E50914]/60" />
        <div className="absolute right-[-16px] w-3 h-[1px] bg-[#E50914]/60" />
      </div>

      {/* 4. Laser Sweep */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/3 left-2 right-2 h-[2px] bg-gradient-to-r from-transparent via-[#E50914] to-transparent shadow-[0_0_10px_#E50914]" />
        <div className="absolute top-1/3 left-2 right-2 h-10 bg-gradient-to-b from-[#E50914]/20 to-transparent" />
      </div>

      {/* 5. Rangefinder Status Footer */}
      <div className="flex justify-between items-center px-1 text-[9px] font-mono tracking-widest text-zinc-400 drop-shadow-[0_1px_3px_rgba(0,0,0,0.95)]">
        <span>ISO AUTO // 1/500</span>
        <div className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-sm bg-white/40" />
          <span className="uppercase text-white font-semibold">NEURAL VISION ACTIVE</span>
        </div>
      </div>
    </div>
  );
};

// ─── EXACT VEHICLE FIXTURES (CORRECTED AUTOMOTIVE TAXONOMY) ───
const FIXTURE_FERRARI = {
  id: 'fixture-ferrari-458-spider',
  make: 'Ferrari',
  model: '458 Spider',
  trim: '4.5L V8 Naturally Aspirated',
  originCountry: 'Italy',
  originSeries: 'MID-REAR V8',
  year: 2014,
  rarity: 'legendary' as const,
  horsepower: 562,
  topSpeed: '320 km/h',
  zeroToHundred: '3.4s',
  engine: 'V8 N/A',
  imageUrl: '/spot_ferrari458.jpg',
  confidence: 0.98,
};

const FIXTURE_GARAGE_CARS = [
  { id: 'g-1', make: 'McLaren', model: '650S', rarity: 'mythic' as const, hp: 641, speed: '333 km/h', image: '/spot_mclaren.jpg' },
  { id: 'g-2', make: 'Ferrari', model: '458 Spider', rarity: 'legendary' as const, hp: 562, speed: '320 km/h', image: '/spot_ferrari458.jpg' },
  { id: 'g-3', make: 'Porsche', model: '911 (997 Generation)', rarity: 'legendary' as const, hp: 355, speed: '293 km/h', image: '/spot_porsche997.jpg' },
  { id: 'g-4', make: 'Bugatti', model: 'Chiron Super Sport', rarity: 'mythic' as const, hp: 1578, speed: '440 km/h', image: '/bugatti-chiron.png' },
  { id: 'g-5', make: 'Porsche', model: '911 Cabriolet (996)', rarity: 'rare' as const, hp: 296, speed: '280 km/h', image: '/spot_porsche996.jpg' },
  { id: 'g-6', make: 'Toyota', model: 'GR Supra 3.0', rarity: 'uncommon' as const, hp: 382, speed: '250 km/h', image: '/spot_supra.jpg' },
];

export const StoreScreenshotFixtures: React.FC = () => {
  const getInitialShot = () => {
    if (typeof window === 'undefined') return 1;
    const p = new URLSearchParams(window.location.search);
    const s = parseInt(p.get('shot') || '1', 10);
    return s >= 1 && s <= 6 ? s : 1;
  };

  const [activeShot, setActiveShot] = useState<number>(getInitialShot);

  return (
    <div className="relative min-h-[100dvh] bg-[#080808] text-[#F0EBE3] select-none font-sans overflow-x-hidden">
      {/* ─── DEV QUICK SWITCHER BAR ─── */}
      <div className="fixed top-2 left-2 right-2 z-50 flex items-center justify-between p-2 rounded-2xl bg-zinc-900/95 backdrop-blur-md border border-white/10 shadow-2xl max-w-md mx-auto pointer-events-auto">
        <span className="text-[10px] font-mono font-bold tracking-wider text-zinc-400 uppercase px-1">
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
                  ? 'bg-[#E50914] text-white shadow-md'
                  : 'bg-zinc-800 text-zinc-400 hover:text-white'
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
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-mono font-semibold uppercase tracking-wider">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span>IDENTIFIED • HIGH CONFIDENCE (98%)</span>
            </div>

            {/* Title Header */}
            <div>
              <span className="text-xs font-mono tracking-widest text-zinc-400 uppercase block">
                {FIXTURE_FERRARI.originCountry} // {FIXTURE_FERRARI.originSeries}
              </span>
              <h1 className="font-display text-3xl font-black text-white leading-tight mt-0.5 tracking-tight">
                {FIXTURE_FERRARI.make} {FIXTURE_FERRARI.model}
              </h1>
              <p className="text-xs text-zinc-400 font-mono mt-0.5">
                {FIXTURE_FERRARI.trim}
              </p>
            </div>

            {/* Collectible Card Showcase */}
            <div className="relative rounded-2xl p-3 bg-zinc-900 border-2 border-[#E8A838] shadow-[0_12px_40px_rgba(232,168,56,0.25)] space-y-3">
              <div className="relative aspect-[16/10] rounded-xl overflow-hidden bg-black">
                <img
                  src={FIXTURE_FERRARI.imageUrl}
                  alt={FIXTURE_FERRARI.model}
                  className="w-full h-full object-cover"
                />
                <div className="absolute top-2.5 left-2.5">
                  <RarityBadge rarity="legendary" size="md" />
                </div>
                <div className="absolute top-2.5 right-2.5">
                  <StatChip label="POWER" value={`${FIXTURE_FERRARI.horsepower} HP`} />
                </div>
              </div>

              {/* Verified Specs Hairline Cluster */}
              <div className="grid grid-cols-3 gap-2 pt-1 border-t border-white/10">
                <div className="text-center p-1.5 rounded-lg bg-zinc-800">
                  <span className="text-[9px] font-mono text-zinc-400 block uppercase">0-100 KM/H</span>
                  <span className="font-mono text-sm font-bold text-white">{FIXTURE_FERRARI.zeroToHundred}</span>
                </div>
                <div className="text-center p-1.5 rounded-lg bg-zinc-800">
                  <span className="text-[9px] font-mono text-zinc-400 block uppercase">TOP SPEED</span>
                  <span className="font-mono text-sm font-bold text-white">{FIXTURE_FERRARI.topSpeed}</span>
                </div>
                <div className="text-center p-1.5 rounded-lg bg-zinc-800">
                  <span className="text-[9px] font-mono text-zinc-400 block uppercase">ENGINE</span>
                  <span className="font-mono text-xs font-bold text-[#E8A838]">{FIXTURE_FERRARI.engine}</span>
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
            <div className="relative z-10 flex items-center justify-between p-3 rounded-2xl bg-zinc-900/80 backdrop-blur-md border border-white/10 max-w-sm mx-auto w-full">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-xs font-mono font-bold tracking-wider text-white uppercase">
                  TARGET LOCK // 14M
                </span>
              </div>
              <span className="text-xs font-mono text-[#E8A838] font-bold">
                PROBABLE FERRARI
              </span>
            </div>

            {/* Central Scanning Reticle HUD */}
            <div className="relative z-10 my-auto">
              <ScanningReticleHUD makeName="FERRARI 458 SPIDER" />
            </div>

            {/* Shutter Shutter Trigger Bar */}
            <div className="relative z-10 flex items-center justify-center pb-8">
              <div className="w-20 h-20 rounded-full border-4 border-[#E50914] p-1 flex items-center justify-center shadow-[0_0_30px_#E50914]">
                <div className="w-full h-full rounded-full bg-[#E50914] flex items-center justify-center text-white">
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
              <span className="text-[10px] font-mono tracking-widest text-[#E50914] font-bold uppercase block">
                LOCAL RARITY ENGINE
              </span>
              <h2 className="font-display text-2xl font-black text-white">
                Dynamic Territory Multipliers
              </h2>
              <p className="text-zinc-400 text-xs">
                A car's rarity reflects real local census distribution.
              </p>
            </div>

            {/* City 1: Stuttgart (Baseline Common/Rare) */}
            <div className="rounded-2xl p-4 bg-zinc-900 border border-white/10 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-mono font-bold text-white">
                  <MapPin className="w-4 h-4 text-zinc-400" />
                  <span>STUTTGART, GERMANY</span>
                </div>
                <RarityBadge rarity="rare" size="sm" />
              </div>
              <div className="flex items-center gap-3">
                <img src="/spot_porsche997.jpg" alt="Porsche Stuttgart" className="w-16 h-16 rounded-lg object-cover border border-white/10" />
                <div className="flex-1">
                  <h3 className="font-display text-lg font-bold text-white leading-none">Porsche 911 (997 Generation)</h3>
                  <span className="text-xs font-mono text-zinc-400 block mt-1">Universal Baseline Rarity</span>
                  <span className="text-[11px] font-mono font-bold text-zinc-300">1.00x Base XP</span>
                </div>
              </div>
              <p className="text-[11px] text-zinc-400 border-t border-white/10 pt-2 leading-tight">
                High regional production volume in the Baden-Württemberg sector. Standard XP curve.
              </p>
            </div>

            {/* City 2: Mumbai (Dynamic Legendary with Area Bonus) */}
            <div className="rounded-2xl p-4 bg-zinc-900 border-2 border-[#E8A838] shadow-[0_8px_32px_rgba(232,168,56,0.2)] space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-mono font-bold text-[#E8A838]">
                  <Globe className="w-4 h-4 text-[#E8A838]" />
                  <span>MUMBAI, INDIA</span>
                </div>
                <RarityBadge rarity="legendary" size="sm" />
              </div>
              <div className="flex items-center gap-3">
                <img src="/spot_porsche997.jpg" alt="Porsche Mumbai" className="w-16 h-16 rounded-lg object-cover border border-[#E8A838]" />
                <div className="flex-1">
                  <h3 className="font-display text-lg font-bold text-white leading-none">Porsche 911 (997 Generation)</h3>
                  <span className="text-xs font-mono text-[#E8A838] font-semibold block mt-1">+45% Territory Bonus</span>
                  <span className="text-[11px] font-mono font-bold text-emerald-400">1.45x Local XP Modifier</span>
                </div>
              </div>
              <p className="text-[11px] text-zinc-300 border-t border-white/10 pt-2 leading-tight">
                Extreme rarity in South Asia sector. 1 of only 4 verified registry sightings across the subcontinent.
              </p>
            </div>
          </div>
        )}

        {/* SHOT 4: THE HUNT ALERT */}
        {activeShot === 4 && (
          <div className="w-full max-w-sm mx-auto px-4 py-6 space-y-4">
            <div className="rounded-2xl p-5 bg-zinc-900 border-2 border-[#E50914] shadow-[0_12px_44px_rgba(229,9,20,0.3)] space-y-4">
              {/* Header Badge */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-black text-[#E50914] border border-[#E50914]/40 animate-pulse">
                    <ShieldAlert className="w-6 h-6" />
                  </div>
                  <div>
                    <span className="text-[10px] font-mono font-bold tracking-widest text-[#E50914] uppercase block">
                      SECTOR RADAR ALERT
                    </span>
                    <h3 className="font-display text-2xl font-black text-white leading-none">
                      ACTIVE HUNT ZONE
                    </h3>
                  </div>
                </div>
                <div className="flex items-center gap-1 font-mono text-xs font-bold text-[#E8A838] bg-zinc-800 px-2.5 py-1 rounded-full border border-white/10">
                  <Clock className="w-3.5 h-3.5" />
                  <span>04:22</span>
                </div>
              </div>

              {/* Target Image & Details */}
              <div className="relative aspect-[16/9] rounded-xl overflow-hidden bg-black border border-white/10">
                <img
                  src="/spot_mclaren.jpg"
                  alt="Hunt Target"
                  className="w-full h-full object-cover"
                />
                <div className="absolute bottom-2 left-2 right-2 p-2 rounded-lg bg-black/90 backdrop-blur-md flex items-center justify-between">
                  <div>
                    <h4 className="font-display text-lg font-bold text-white leading-none">McLaren 650S Spider</h4>
                    <span className="text-[10px] font-mono text-zinc-400">Sector 4 · 0.8 km away</span>
                  </div>
                  <RarityBadge rarity="mythic" size="sm" />
                </div>
              </div>

              {/* Reward Chips */}
              <div className="grid grid-cols-2 gap-2 text-center">
                <div className="p-2 rounded-lg bg-zinc-800 border border-white/10">
                  <span className="text-[9px] font-mono text-zinc-400 uppercase block">FIRST DISCOVERY</span>
                  <span className="font-mono text-sm font-bold text-[#E8A838]">+1,500 XP</span>
                </div>
                <div className="p-2 rounded-lg bg-zinc-800 border border-white/10">
                  <span className="text-[9px] font-mono text-zinc-400 uppercase block">COLLECTOR TROPHY</span>
                  <span className="font-mono text-sm font-bold text-emerald-400">MYTHIC BADGE</span>
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
                <h1 className="font-display text-3xl font-black text-white">COLLECTION</h1>
                <span className="text-xs font-mono font-bold text-[#E8A838] bg-zinc-900 px-3 py-1 rounded-full border border-white/10">
                  LEVEL 5 SPOTTER
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 p-2.5 rounded-2xl bg-zinc-900 border border-white/10 text-center">
                <div>
                  <span className="text-[9px] font-mono text-zinc-400 uppercase block">SLOTS</span>
                  <span className="font-mono text-sm font-bold text-white">6 / 6 FULL</span>
                </div>
                <div>
                  <span className="text-[9px] font-mono text-zinc-400 uppercase block">TOTAL POWER</span>
                  <span className="font-mono text-sm font-bold text-white">3,814 HP</span>
                </div>
                <div>
                  <span className="text-[9px] font-mono text-zinc-400 uppercase block">RAREST TIER</span>
                  <span className="font-mono text-sm font-bold text-pink-500">MYTHIC</span>
                </div>
              </div>
            </div>

            {/* Masonry Slabs Grid */}
            <div className="grid grid-cols-2 gap-2.5 max-h-[68vh] overflow-y-auto no-scrollbar pb-6">
              {FIXTURE_GARAGE_CARS.map(car => (
                <div
                  key={car.id}
                  className="rounded-2xl p-2.5 bg-zinc-900 border border-white/10 hover:border-[#E50914] transition-all space-y-2"
                >
                  <div className="relative aspect-[4/3] rounded-xl overflow-hidden bg-black">
                    <img src={car.image} alt={car.model} className="w-full h-full object-cover" />
                    <div className="absolute top-1.5 left-1.5">
                      <RarityBadge rarity={car.rarity} size="sm" />
                    </div>
                  </div>
                  <div>
                    <span className="text-[10px] font-mono text-zinc-400 uppercase block">{car.make}</span>
                    <h4 className="font-display text-sm font-bold text-white leading-tight truncate">{car.model}</h4>
                    <div className="flex items-center justify-between text-[10px] font-mono text-zinc-400 mt-1 pt-1 border-t border-white/10">
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
              <div className="w-full h-full bg-black relative">
                <div className="absolute inset-0 opacity-20" style={{
                  backgroundImage: 'radial-gradient(#334155 1px, transparent 1px)',
                  backgroundSize: '24px 24px'
                }} />
                <div className="absolute top-1/4 left-1/2 -translate-x-1/2 flex items-center justify-center">
                  <div className="w-24 h-24 rounded-full border-2 border-dashed border-[#E8A838] bg-[#E8A838]/10 animate-pulse" />
                  <div className="absolute w-3 h-3 rounded-full bg-white shadow-[0_0_12px_white]" />
                </div>
              </div>
            </div>

            {/* Bottom Sheet Presentation */}
            <div className="relative z-10 w-full max-w-md mx-auto p-5 rounded-t-[24px] bg-zinc-900 border-t border-white/10 shadow-[0_-16px_50px_rgba(0,0,0,0.8)] space-y-4">
              <div className="w-12 h-1 bg-white/20 rounded-full mx-auto" />
              
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <h3 className="font-display text-xl font-bold text-white">
                  Location Privacy
                </h3>
                <span className="text-[10px] font-mono text-[#E8A838] bg-[#E8A838]/10 px-2 py-0.5 rounded border border-[#E8A838]/30">
                  PROTECTED
                </span>
              </div>

              <div className="space-y-2">
                <div className="p-3 rounded-xl border border-white/10 bg-black flex items-start gap-3 opacity-60">
                  <div className="p-2 rounded-lg bg-zinc-800 text-zinc-400">
                    <Crosshair className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="font-display text-sm font-bold text-white">Exact Pinpoint</h4>
                    <p className="text-[11px] text-zinc-400">Real-time GPS coordinates. Best for active track meets.</p>
                  </div>
                </div>

                <div className="p-3 rounded-xl border-2 border-[#E8A838] bg-zinc-800 flex items-start gap-3 shadow-lg">
                  <div className="p-2 rounded-lg bg-[#E8A838]/15 text-[#E8A838]">
                    <Shield className="w-4 h-4" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <h4 className="font-display text-sm font-bold text-white">1km Blurred Zone</h4>
                      <span className="text-[9px] font-mono uppercase px-2 py-0.5 rounded-full bg-[#E8A838]/20 text-[#E8A838] font-bold">
                        ACTIVE
                      </span>
                    </div>
                    <p className="text-[11px] text-zinc-300 mt-0.5">
                      Masks exact address with a 1km approximate perimeter circle. Protects home and workplace privacy.
                    </p>
                  </div>
                </div>

                <div className="p-3 rounded-xl border border-white/10 bg-black flex items-start gap-3 opacity-60">
                  <div className="p-2 rounded-lg bg-zinc-800 text-zinc-400">
                    <EyeOff className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="font-display text-sm font-bold text-white">Ghost Mode</h4>
                    <p className="text-[11px] text-zinc-400">Completely invisible on local radars. Browse in private.</p>
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
