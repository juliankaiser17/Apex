import React, { useState } from 'react';
import type { CarCard } from '../../types/apex';
import { RARITY_CONFIG } from '../../utils/rarity';

interface ApexCollectibleCardProps {
  card: CarCard;
  className?: string;
  onClick?: () => void;
  showHolo?: boolean;
}

export const ApexCollectibleCard: React.FC<ApexCollectibleCardProps> = ({
  card,
  className = '',
  onClick,
  showHolo = true
}) => {
  const rarityConf = RARITY_CONFIG[card.rarity];
  const isMythic = card.rarity === 'mythic';
  const isLegendary = card.rarity === 'legendary';
  const isEpic = card.rarity === 'epic';

  // 3D Tilt State on Hover
  const [tilt, setTilt] = useState<{ x: number; y: number; sheenX: number; sheenY: number }>({
    x: 0,
    y: 0,
    sheenX: 50,
    sheenY: 50
  });
  const [isHovered, setIsHovered] = useState(false);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    const rotateX = -((y - centerY) / centerY) * 12;
    const rotateY = ((x - centerX) / centerX) * 12;

    setTilt({
      x: rotateX,
      y: rotateY,
      sheenX: (x / rect.width) * 100,
      sheenY: (y / rect.height) * 100
    });
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    setTilt({ x: 0, y: 0, sheenX: 50, sheenY: 50 });
  };

  // Calculate OVR Score (Overall Power Rating)
  const topSpeedNum = card.topSpeedKmH || 250;
  const hpNum = card.horsepower || 400;
  const accelNum = card.zeroToHundredSec || 4.5;
  const rarityMultiplier = isMythic ? 1.25 : isLegendary ? 1.15 : isEpic ? 1.08 : 1.0;
  const rawOvr = Math.round(((topSpeedNum / 420) * 35 + (hpNum / 1500) * 45 + ((6 - accelNum) / 4) * 20) * rarityMultiplier);
  const ovrScore = Math.min(99, Math.max(65, rawOvr));

  // Specs text
  const topSpeedStr = card.topSpeedKmH ? `${card.topSpeedKmH}` : '250';
  const hpStr = card.horsepower ? `${card.horsepower}` : '400';
  const zeroToHundredStr = card.zeroToHundredSec ? `${card.zeroToHundredSec.toFixed(1)}s` : '4.2s';

  const serialStr = card.cardNumber || `#APX-001`;
  const formattedSerial = serialStr.startsWith('#') ? serialStr : `#${serialStr}`;
  const cityStr = card.city || 'Hong Kong';

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{
        transform: isHovered
          ? `perspective(1000px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg) scale(1.02)`
          : 'perspective(1000px) rotateX(0deg) rotateY(0deg) scale(1)',
        transition: isHovered ? 'transform 0.08s ease-out' : 'transform 0.5s ease-out',
        boxShadow: isMythic
          ? '0 12px 40px rgba(255, 34, 0, 0.55), 0 0 20px rgba(255, 69, 0, 0.3)'
          : isLegendary
          ? '0 12px 36px rgba(255, 165, 0, 0.45), 0 0 16px rgba(255, 215, 0, 0.25)'
          : '0 10px 30px rgba(0, 0, 0, 0.85)'
      }}
      className={`relative w-[320px] h-[456px] rounded-2xl overflow-hidden bg-[#0D0D0D] select-none flex flex-col cursor-pointer border-2 transition-all group ${
        isMythic
          ? 'border-[#FF2200] animate-gradient-border'
          : isLegendary
          ? 'border-[#FFA500]'
          : isEpic
          ? 'border-[#C85000]'
          : 'border-[#2C2C2C] hover:border-[#FF4500]/60'
      } ${className}`}
    >
      {/* Dynamic Interactive Foil Refraction Overlay */}
      {showHolo && (
        <div
          className="absolute inset-0 pointer-events-none z-30 transition-opacity duration-300"
          style={{
            opacity: isHovered ? (isMythic || isLegendary ? 0.7 : 0.35) : isMythic ? 0.4 : 0,
            background: `radial-gradient(circle at ${tilt.sheenX}% ${tilt.sheenY}%, rgba(255, 255, 255, 0.35) 0%, rgba(255, 0, 128, 0.15) 25%, rgba(0, 255, 200, 0.15) 50%, transparent 75%)`
          }}
        />
      )}

      {/* TOP METALLIC HEADER STRIP */}
      <div className="relative z-20 px-3.5 pt-3 pb-1.5 flex items-center justify-between bg-gradient-to-b from-[#181818] to-transparent">
        {/* Rarity Pill Badge */}
        <div className="flex items-center gap-1.5">
          <span
            style={{
              backgroundColor: rarityConf.color,
              boxShadow: `0 0 14px ${rarityConf.color}AA`
            }}
            className="px-2.5 py-0.5 rounded-full font-display text-[12px] tracking-wider text-[#F0EBE3] uppercase font-bold border border-white/30"
          >
            {rarityConf.label}
          </span>

          <span className="text-[10px] font-data text-[#9A9088] uppercase tracking-wider">
            {cityStr}
          </span>
        </div>

        {/* TOP-RIGHT: OVR POWER RATING BADGE */}
        <div
          style={{
            borderColor: rarityConf.color,
            boxShadow: `0 0 12px ${rarityConf.color}66`
          }}
          className="px-2 py-0.5 rounded-lg bg-[#080808]/90 border flex items-center gap-1 font-data font-bold text-xs"
        >
          <span className="text-[#FF4500]">⚡</span>
          <span className="font-display text-sm text-[#F0EBE3] tracking-tight">{ovrScore}</span>
          <span className="text-[9px] text-[#9A9088] font-semibold">OVR</span>
        </div>
      </div>

      {/* UPPER HERO PHOTO AREA */}
      <div className="relative w-full h-[54%] overflow-hidden bg-[#050505]">
        <img
          src={card.imageUrl}
          alt={`${card.make} ${card.model}`}
          className="w-full h-full object-cover group-hover:scale-108 transition-transform duration-700 ease-out"
        />

        {/* Holographic Watermark Pattern */}
        <div className="absolute inset-0 pointer-events-none opacity-20 bg-[radial-gradient(#FF4500_1px,transparent_1px)] [background-size:12px_12px]" />

        {/* Top/Bottom Subtle Gradient Fades */}
        <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-[#0D0D0D]/40 via-transparent to-[#0D0D0D]" />

        {/* Watermark APEX Serial Badge */}
        <div className="absolute bottom-2 left-3 z-10">
          <span className="font-data text-[10px] text-[#F0EBE3]/90 bg-[#080808]/80 backdrop-blur-md px-2 py-0.5 rounded border border-[#2C2C2C]">
            {formattedSerial}
          </span>
        </div>
      </div>

      {/* LOWER SPECIFICATIONS & STATS PANEL */}
      <div className="relative flex-1 z-20 px-3.5 pt-1.5 pb-3 flex flex-col justify-between bg-[#0D0D0D] border-t border-[#2C2C2C]">
        {/* Car Name & Subtitle */}
        <div>
          <div className="flex items-baseline justify-between">
            <h3 className="font-display text-[23px] text-[#F0EBE3] leading-none tracking-wide uppercase truncate">
              {card.make} {card.model}
            </h3>
          </div>
          <p className="text-[11px] font-medium text-[#9A9088] truncate mt-0.5 font-data">
            {card.generation ? `${card.generation} · ` : ''}{card.bodyStyle || 'Supercar'} · {card.originCountry || 'Germany'}
          </p>
        </div>

        {/* 3 PERFORMANCE HIGHLIGHT CHIPS */}
        <div className="grid grid-cols-3 gap-1.5 my-1.5">
          {/* Top Speed */}
          <div className="p-1.5 rounded-lg bg-[#141414] border border-[#2C2C2C] text-center group-hover:border-[#FF4500]/40 transition-colors">
            <span className="block text-[8px] font-semibold text-[#9A9088] uppercase tracking-wider">TOP SPEED</span>
            <span className="font-data text-[15px] font-bold text-[#F0EBE3] leading-tight block">
              {topSpeedStr} <span className="text-[9px] font-normal text-[#9A9088]">KM/H</span>
            </span>
          </div>

          {/* Horsepower */}
          <div className="p-1.5 rounded-lg bg-[#141414] border border-[#2C2C2C] text-center group-hover:border-[#FF4500]/40 transition-colors">
            <span className="block text-[8px] font-semibold text-[#9A9088] uppercase tracking-wider">POWER</span>
            <span className="font-data text-[15px] font-bold text-[#FFA500] leading-tight block">
              {hpStr} <span className="text-[9px] font-normal text-[#9A9088]">HP</span>
            </span>
          </div>

          {/* 0-100 km/h */}
          <div className="p-1.5 rounded-lg bg-[#141414] border border-[#2C2C2C] text-center group-hover:border-[#FF4500]/40 transition-colors">
            <span className="block text-[8px] font-semibold text-[#9A9088] uppercase tracking-wider">0-100</span>
            <span className="font-data text-[15px] font-bold text-[#F0EBE3] leading-tight block">
              {zeroToHundredStr}
            </span>
          </div>
        </div>

        {/* BOTTOM METALLIC STAMP PLATE */}
        <div className="pt-1.5 border-t border-[#2C2C2C] flex items-center justify-between text-[10px] font-data text-[#9A9088]">
          <div className="flex items-center gap-1">
            <span className="text-[#FF4500]">📍</span>
            <span className="truncate max-w-[170px] text-[#F0EBE3]/90 font-medium">{cityStr}</span>
          </div>

          <div className="flex items-center gap-1 text-[9px] bg-[#171717] px-2 py-0.5 rounded border border-[#2C2C2C]">
            <span className="text-[#FF4500]">🔄</span>
            <span className="text-[#F0EBE3] font-semibold">FLIP SPECS</span>
          </div>
        </div>
      </div>
    </div>
  );
};
