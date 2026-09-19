import React, { useMemo } from 'react';
import type { CarCard } from '../../types/apex';
import { getEstimatedMarketValue } from '../../utils/marketValuation';

interface ApexVehicleSpecsSectionProps {
  card: CarCard;
  className?: string;
}

export const ApexVehicleSpecsSection: React.FC<ApexVehicleSpecsSectionProps> = React.memo(({
  card,
  className = ''
}) => {
  // Spec Values
  const topSpeedNum = card.topSpeedKmH || 0;
  const hpNum = card.horsepower || 0;
  const zeroToHundredNum = card.zeroToHundredSec || 0;
  const torqueNum = card.torqueNm || 0;
  const weightNum = card.kerbWeightKg || 0;

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

  // Normalized percentages (Cached calculations)
  const { speedPct, hpPct, accelPct, torquePct, weightPct } = useMemo(() => ({
    speedPct: topSpeedNum > 0 ? Math.min(100, Math.max(12, (topSpeedNum / 440) * 100)) : 0,
    hpPct: hpNum > 0 ? Math.min(100, Math.max(12, (hpNum / 1500) * 100)) : 0,
    accelPct: zeroToHundredNum > 0 ? Math.min(100, Math.max(12, ((6.0 - Math.min(6.0, zeroToHundredNum)) / 4.0) * 100)) : 0,
    torquePct: torqueNum > 0 ? Math.min(100, Math.max(12, (torqueNum / 1200) * 100)) : 0,
    weightPct: weightNum > 0 ? Math.min(100, Math.max(12, ((2200 - Math.min(2200, weightNum)) / 1400) * 100)) : 0,
  }), [topSpeedNum, hpNum, zeroToHundredNum, torqueNum, weightNum]);

  return (
    <div className={`w-full rounded-2xl bg-[#121212] border border-white/[0.08] p-4 text-left select-none space-y-2.5 transition-all shadow-md ${className}`}>
      {/* 5 Minimalist Progress Stat Rows */}
      <div className="space-y-2">
        {/* Top Speed */}
        <div className="flex items-center justify-between text-xs h-6">
          <span className="w-18 text-white/50 font-medium text-left">Top Speed</span>
          <div className="flex-1 mx-3 h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
            {speedPct > 0 ? (
              <div 
                style={{ width: `${speedPct}%` }}
                className="h-full bg-white/90 rounded-full transition-all duration-500"
              />
            ) : (
              <div className="h-full w-full bg-white/[0.03]" />
            )}
          </div>
          <span className="w-16 text-right font-data font-semibold text-white">
            {topSpeedNum > 0 ? (
              <>{topSpeedNum} <span className="text-[10px] text-white/40 font-normal">km/h</span></>
            ) : (
              <span className="text-white/30 text-[11px]">N/A</span>
            )}
          </span>
        </div>

        {/* Horsepower */}
        <div className="flex items-center justify-between text-xs h-6">
          <span className="w-18 text-white/50 font-medium text-left">Power</span>
          <div className="flex-1 mx-3 h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
            {hpPct > 0 ? (
              <div 
                style={{ width: `${hpPct}%` }}
                className="h-full bg-[#E50914] rounded-full transition-all duration-500"
              />
            ) : (
              <div className="h-full w-full bg-white/[0.03]" />
            )}
          </div>
          <span className="w-16 text-right font-data font-semibold text-white">
            {hpNum > 0 ? (
              <>{hpNum} <span className="text-[10px] text-white/40 font-normal">hp</span></>
            ) : (
              <span className="text-white/30 text-[11px]">N/A</span>
            )}
          </span>
        </div>

        {/* Acceleration 0-100 */}
        <div className="flex items-center justify-between text-xs h-6">
          <span className="w-18 text-white/50 font-medium text-left">0–100</span>
          <div className="flex-1 mx-3 h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
            {accelPct > 0 ? (
              <div 
                style={{ width: `${accelPct}%` }}
                className="h-full bg-emerald-500 rounded-full transition-all duration-500"
              />
            ) : (
              <div className="h-full w-full bg-white/[0.03]" />
            )}
          </div>
          <span className="w-16 text-right font-data font-semibold text-white">
            {zeroToHundredNum > 0 ? (
              <>{zeroToHundredNum.toFixed(1)} <span className="text-[10px] text-white/40 font-normal">s</span></>
            ) : (
              <span className="text-white/30 text-[11px]">N/A</span>
            )}
          </span>
        </div>

        {/* Torque */}
        <div className="flex items-center justify-between text-xs h-6">
          <span className="w-18 text-white/50 font-medium text-left">Torque</span>
          <div className="flex-1 mx-3 h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
            {torquePct > 0 ? (
              <div 
                style={{ width: `${torquePct}%` }}
                className="h-full bg-amber-500 rounded-full transition-all duration-500"
              />
            ) : (
              <div className="h-full w-full bg-white/[0.03]" />
            )}
          </div>
          <span className="w-16 text-right font-data font-semibold text-white">
            {torqueNum > 0 ? (
              <>{torqueNum} <span className="text-[10px] text-white/40 font-normal">Nm</span></>
            ) : (
              <span className="text-white/30 text-[11px]">N/A</span>
            )}
          </span>
        </div>

        {/* Weight */}
        <div className="flex items-center justify-between text-xs h-6">
          <span className="w-18 text-white/50 font-medium text-left">Weight</span>
          <div className="flex-1 mx-3 h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
            {weightPct > 0 ? (
              <div 
                style={{ width: `${weightPct}%` }}
                className="h-full bg-sky-500 rounded-full transition-all duration-500"
              />
            ) : (
              <div className="h-full w-full bg-white/[0.03]" />
            )}
          </div>
          <span className="w-16 text-right font-data font-semibold text-white">
            {weightNum > 0 ? (
              <>{weightNum} <span className="text-[10px] text-white/40 font-normal">kg</span></>
            ) : (
              <span className="text-white/30 text-[11px]">N/A</span>
            )}
          </span>
        </div>
      </div>

      {/* Market Value Range Bar */}
      <div className="pt-2.5 border-t border-white/[0.06] flex items-center justify-between text-xs">
        <span className="text-white/50 text-[11px]">Est. Market Value</span>
        <span className="font-data font-bold text-white tracking-wide">
          {valuation.formattedRange}
        </span>
      </div>
    </div>
  );
});

ApexVehicleSpecsSection.displayName = 'ApexVehicleSpecsSection';
