import React from 'react';
import type { RarityTier } from './RarityBadge';

export interface StatGaugeProps {
  label: string;
  value: number | string;
  unit?: string;
  percentage?: number; // 0 to 100
  rarity?: RarityTier;
  className?: string;
}

export const StatGauge: React.FC<StatGaugeProps> = ({
  label,
  value,
  unit,
  percentage = 50,
  rarity = 'common',
  className = '',
}) => {
  const TOTAL_TICKS = 14;
  const clampedPct = Math.max(0, Math.min(100, percentage));
  const activeTicksCount = Math.round((clampedPct / 100) * TOTAL_TICKS);

  return (
    <div className={`space-y-1.5 ${className}`} data-rarity={rarity}>
      <div className="flex items-center justify-between text-caption">
        <span className="text-[var(--color-text-3)] font-medium uppercase tracking-wider text-[11px]">
          {label}
        </span>
        <div className="font-mono tabular-nums font-semibold text-[var(--color-text)]">
          <span>{value}</span>
          {unit && <span className="text-[var(--color-text-3)] ml-1 font-normal text-[11px]">{unit}</span>}
        </div>
      </div>

      {/* 14-Tick Instrument Gauge */}
      <div className="flex items-end gap-1 h-3.5 px-0.5">
        {Array.from({ length: TOTAL_TICKS }).map((_, idx) => {
          const isActive = idx < activeTicksCount;
          const isEveryThird = (idx + 1) % 3 === 0;
          return (
            <div
              key={idx}
              className={`flex-1 rounded-[1px] transition-all duration-300 ${
                isEveryThird ? 'h-3' : 'h-2'
              } ${
                isActive
                  ? 'bg-[var(--r)] shadow-[0_0_4px_var(--r-glow)]'
                  : 'bg-[var(--color-line)]'
              }`}
            />
          );
        })}
      </div>
    </div>
  );
};

StatGauge.displayName = 'StatGauge';
