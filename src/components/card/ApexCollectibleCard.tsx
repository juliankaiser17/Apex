import React, { useMemo } from 'react';
import type { CarCard } from '../../types/apex';
import { RARITY_CONFIG } from '../../utils/rarity';
import { getOptimizedImageUrl } from '../../utils/imageUrl';
import { getEstimatedMarketValue } from '../../utils/marketValuation';

interface ApexCollectibleCardProps {
  card: CarCard;
  className?: string;
  onClick?: () => void;
  showHolo?: boolean;
  size?: 'sm' | 'md' | 'lg';
  interactive3D?: boolean;
  showSpecs?: boolean;
  showHolographic?: boolean;
}

/**
 * Deterministic hash-based serial generator (Eliminates Math.random() render-time churn)
 */
function getDeterministicSerial(id: string | undefined): string {
  if (!id) return '#APX-1001';
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = ((hash << 5) - hash) + id.charCodeAt(i);
    hash |= 0;
  }
  const num = Math.abs(hash) % 9000 + 1000;
  return `#APX-${num}`;
}

export const ApexCollectibleCard: React.FC<ApexCollectibleCardProps> = React.memo(({
  card,
  className = '',
  onClick,
  size = 'md',
}) => {
  const rarityConf = RARITY_CONFIG[card.rarity] || RARITY_CONFIG.rare;

  // Spec Values
  const topSpeedNum = card.topSpeedKmH || 296;
  const hpNum = card.horsepower || 525;
  const zeroToHundredNum = card.zeroToHundredSec || 3.2;
  const torqueNum = card.torqueNm || 465;
  const weightNum = card.kerbWeightKg || 1450;
  
  // Grounded Market Value
  const valuation = useMemo(() => {
    return getEstimatedMarketValue({
      make: card.make,
      model: card.model,
      rarity: card.rarity,
      marketValueLowUsd: card.marketValueLowUsd,
      marketValueHighUsd: card.marketValueHighUsd
    });
  }, [card.make, card.model, card.rarity, card.marketValueLowUsd, card.marketValueHighUsd]);

  const formattedSerial = useMemo(() => {
    const raw = card.cardNumber || getDeterministicSerial(card.id);
    return raw.startsWith('#') ? raw : `#${raw}`;
  }, [card.cardNumber, card.id]);

  // Normalized percentages (Cached calculations)
  const { speedPct, hpPct, accelPct, torquePct, weightPct } = useMemo(() => ({
    speedPct: Math.min(100, Math.max(15, (topSpeedNum / 440) * 100)),
    hpPct: Math.min(100, Math.max(15, (hpNum / 1500) * 100)),
    accelPct: Math.min(100, Math.max(15, ((6.0 - Math.min(6.0, zeroToHundredNum)) / 4.0) * 100)),
    torquePct: Math.min(100, Math.max(15, (torqueNum / 1200) * 100)),
    weightPct: Math.min(100, Math.max(15, ((2200 - Math.min(2200, weightNum)) / 1400) * 100)),
  }), [topSpeedNum, hpNum, zeroToHundredNum, torqueNum, weightNum]);

  const widthClass = size === 'sm' ? 'w-[280px]' : size === 'lg' ? 'w-[360px]' : 'w-[325px]';
  const optimizedUrl = getOptimizedImageUrl(card.imageUrl, 'card');
  const isCustomFoil = Boolean(card.customFoil);

  return (
    <div
      onClick={onClick}
      className={`relative ${widthClass} rounded-2xl overflow-hidden bg-[#121212] select-none flex flex-col cursor-pointer border ${
        isCustomFoil
          ? 'border-amber-400/40 ring-1 ring-amber-400/30 shadow-[0_0_24px_rgba(245,158,11,0.2)]'
          : 'border-white/[0.08] hover:border-white/[0.18]'
      } transition-all group ${className}`}
    >
      {/* 1. TOP HEADER: Make, Model & Serial */}
      <div className="px-4 py-3 flex items-center justify-between bg-[#141414] border-b border-white/[0.06]">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-white/50">
            {card.make}
          </span>
          <div className="w-1 h-1 rounded-full bg-white/20" />
          <span className="text-xs font-medium text-white/40">
            {formattedSerial}
          </span>
        </div>

        {/* Sleek Rarity Pill & Badges */}
        <div className="flex items-center gap-1.5">
          {isCustomFoil && (
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-gradient-to-r from-amber-500/20 via-pink-500/20 to-indigo-500/20 border border-amber-400/40 text-amber-300">
              ✨ FOIL
            </span>
          )}
          {card.localRarity?.confidenceState === 'LOCAL_UNKNOWN' && (
            <span className="text-[8px] font-bold px-1.5 py-0.5 rounded-md bg-sky-500/10 border border-sky-500/20 text-sky-300 uppercase">
              CENSUS
            </span>
          )}
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${rarityConf.badgeBg}`}>
            {rarityConf.label}
          </span>
        </div>
      </div>

      {/* 2. HERO VEHICLE PHOTOGRAPH CONTAINER */}
      <div className="relative w-full aspect-[16/10] overflow-hidden bg-black">
        <img
          src={optimizedUrl}
          alt={`${card.make} ${card.model}`}
          loading="lazy"
          decoding="async"
          className="w-full h-full object-cover group-hover:scale-104 transition-transform duration-500 ease-out"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#121212] via-transparent to-transparent opacity-80" />

        {/* Floating Title on Photo Overlay */}
        <div className="absolute bottom-3 left-4 right-4">
          <h3 className="text-xl font-bold text-white tracking-tight leading-tight">
            {card.model}
          </h3>
          <p className="text-xs text-white/60 font-medium">
            {card.productionYears || card.yearEstimate || '2023'} • {card.originCountry || 'Germany'}
          </p>
        </div>
      </div>

      {/* 3. LOWER SPECIFICATIONS & TELEMETRY SECTION */}
      <div className="p-4 bg-[#121212] flex flex-col space-y-2.5">
        {/* 5 Minimalist Progress Stat Rows */}
        <div className="space-y-2 pt-1">
          {/* Top Speed */}
          <div className="flex items-center justify-between text-xs">
            <span className="w-16 text-white/50 font-medium">Top Speed</span>
            <div className="flex-1 mx-3 h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
              <div 
                style={{ width: `${speedPct}%` }}
                className="h-full bg-white/90 rounded-full transition-all duration-500"
              />
            </div>
            <span className="w-14 text-right font-data font-semibold text-white">
              {topSpeedNum} <span className="text-[10px] text-white/50 font-normal">km/h</span>
            </span>
          </div>

          {/* Horsepower */}
          <div className="flex items-center justify-between text-xs">
            <span className="w-16 text-white/50 font-medium">Power</span>
            <div className="flex-1 mx-3 h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
              <div 
                style={{ width: `${hpPct}%` }}
                className="h-full bg-[#E50914] rounded-full transition-all duration-500"
              />
            </div>
            <span className="w-14 text-right font-data font-semibold text-white">
              {hpNum} <span className="text-[10px] text-white/50 font-normal">hp</span>
            </span>
          </div>

          {/* Acceleration 0-100 */}
          <div className="flex items-center justify-between text-xs">
            <span className="w-16 text-white/50 font-medium">0–100</span>
            <div className="flex-1 mx-3 h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
              <div 
                style={{ width: `${accelPct}%` }}
                className="h-full bg-emerald-500 rounded-full transition-all duration-500"
              />
            </div>
            <span className="w-14 text-right font-data font-semibold text-white">
              {zeroToHundredNum.toFixed(1)} <span className="text-[10px] text-white/50 font-normal">s</span>
            </span>
          </div>

          {/* Torque */}
          <div className="flex items-center justify-between text-xs">
            <span className="w-16 text-white/50 font-medium">Torque</span>
            <div className="flex-1 mx-3 h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
              <div 
                style={{ width: `${torquePct}%` }}
                className="h-full bg-amber-500 rounded-full transition-all duration-500"
              />
            </div>
            <span className="w-14 text-right font-data font-semibold text-white">
              {torqueNum} <span className="text-[10px] text-white/50 font-normal">Nm</span>
            </span>
          </div>

          {/* Weight */}
          <div className="flex items-center justify-between text-xs">
            <span className="w-16 text-white/50 font-medium">Weight</span>
            <div className="flex-1 mx-3 h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
              <div 
                style={{ width: `${weightPct}%` }}
                className="h-full bg-sky-500 rounded-full transition-all duration-500"
              />
            </div>
            <span className="w-14 text-right font-data font-semibold text-white">
              {weightNum} <span className="text-[10px] text-white/50 font-normal">kg</span>
            </span>
          </div>
        </div>

        {/* Market Value Range Bar */}
        <div className="pt-2 border-t border-white/[0.06] flex items-center justify-between text-xs">
          <span className="text-white/50 text-[11px]">Est. Market Value</span>
          <span className="font-data font-bold text-white tracking-wide">
            {valuation.formattedRange}
          </span>
        </div>
      </div>
    </div>
  );
});

ApexCollectibleCard.displayName = 'ApexCollectibleCard';
