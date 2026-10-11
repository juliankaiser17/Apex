import React, { useRef, useEffect, useState } from 'react';
import { RarityBadge, type RarityTier } from './RarityBadge';
import { StatGauge } from './StatGauge';

export interface SlabStats {
  hp?: number;
  topSpeed?: number;
  zeroToHundred?: number;
  weight?: number;
  torque?: number;
}

export interface SlabProps {
  rarity: RarityTier;
  serial?: string;
  imageUrl: string;
  carName: string;
  make?: string;
  stats?: SlabStats;
  city?: string;
  isHero?: boolean;
  onClick?: () => void;
  className?: string;
  children?: React.ReactNode;
}

export const Slab: React.FC<SlabProps> = ({
  rarity,
  serial = 'APX-0000',
  imageUrl,
  carName,
  make,
  stats,
  city,
  isHero = false,
  onClick,
  className = '',
  children,
}) => {
  const normRarity = (rarity?.toLowerCase() || 'common') as RarityTier;
  const isMythic = normRarity === 'mythic';
  const isLegendary = normRarity === 'legendary';

  const slabRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(true);

  // IntersectionObserver to pause infinite foil / prismatic animations when offscreen
  useEffect(() => {
    if (!slabRef.current || (!isMythic && !isLegendary)) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsVisible(entry.isIntersecting);
      },
      { threshold: 0.1 }
    );

    observer.observe(slabRef.current);
    return () => observer.disconnect();
  }, [isMythic, isLegendary]);

  return (
    <div
      ref={slabRef}
      onClick={onClick}
      data-rarity={normRarity}
      className={`relative rounded-[var(--radius-slab)] bg-[var(--color-panel)] border border-[var(--r)]/40 overflow-hidden flex flex-col transition-all duration-200 select-none ${
        onClick ? 'cursor-pointer hover:border-[var(--r)] active:scale-[0.98]' : ''
      } ${isMythic ? 'prismatic-border' : ''} ${
        isLegendary && isVisible ? 'foil-sweep' : ''
      } ${className}`}
    >
      {/* Slab Header: Serial & Rarity Badge */}
      <div className="flex items-center justify-between px-3 pt-2.5 pb-2 bg-[var(--color-panel-2)]/80 border-b border-[var(--color-line)] z-10">
        <span className="font-mono text-caption text-[var(--color-text-2)] font-semibold tracking-wider">
          {serial}
        </span>
        <RarityBadge rarity={normRarity} size="sm" />
      </div>

      {/* 4:5 or 16:10 Specimen Window */}
      <div
        className={`relative w-full overflow-hidden bg-[var(--color-void)] ${
          isHero ? 'aspect-[16/10]' : 'aspect-[4/5]'
        }`}
      >
        <img
          src={imageUrl}
          alt={carName}
          loading="lazy"
          decoding="async"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[var(--color-panel)] via-transparent to-transparent pointer-events-none" />

        {city && (
          <span className="absolute bottom-2 left-2.5 font-mono text-[11px] px-2 py-0.5 rounded-[var(--radius-chip)] bg-[var(--color-void)]/85 text-[var(--color-text-2)] border border-[var(--color-line)]">
            {city}
          </span>
        )}
      </div>

      {/* Car Title & Metadata */}
      <div className="p-3 bg-[var(--color-panel)] flex-1 flex flex-col justify-between space-y-2 z-10">
        <div>
          {make && (
            <p className="text-secondary text-[var(--color-text-3)] font-medium">
              {make}
            </p>
          )}
          <h3 className="font-display text-display-m text-[var(--color-text)] tracking-tight leading-none truncate">
            {carName}
          </h3>
        </div>

        {/* 5-Segment Telemetry Gauge Row */}
        {stats && (
          <div className="grid grid-cols-2 gap-2 pt-1 border-t border-[var(--color-line)]">
            {stats.hp !== undefined && (
              <StatGauge
                label="Power"
                value={stats.hp}
                unit="HP"
                percentage={(stats.hp / 1000) * 100}
                rarity={normRarity}
              />
            )}
            {stats.topSpeed !== undefined && (
              <StatGauge
                label="Speed"
                value={stats.topSpeed}
                unit="km/h"
                percentage={(stats.topSpeed / 400) * 100}
                rarity={normRarity}
              />
            )}
            {stats.zeroToHundred !== undefined && (
              <StatGauge
                label="0-100"
                value={stats.zeroToHundred}
                unit="s"
                percentage={Math.max(0, 100 - (stats.zeroToHundred / 6) * 100)}
                rarity={normRarity}
              />
            )}
            {stats.weight !== undefined && (
              <StatGauge
                label="Weight"
                value={stats.weight}
                unit="kg"
                percentage={(stats.weight / 2500) * 100}
                rarity={normRarity}
              />
            )}
          </div>
        )}

        {children}
      </div>
    </div>
  );
};

Slab.displayName = 'Slab';
