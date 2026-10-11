import React from 'react';
import { Circle, ChevronUp, Diamond, Hexagon, Star, Sparkles } from 'lucide-react';

export type RarityTier = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'mythic';

export interface RarityBadgeProps {
  rarity: RarityTier;
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
  className?: string;
}

export const RarityBadge: React.FC<RarityBadgeProps> = ({
  rarity,
  size = 'md',
  showIcon = true,
  className = '',
}) => {
  const normRarity = (rarity?.toLowerCase() || 'common') as RarityTier;

  const sizeClasses = {
    sm: 'text-[10px] px-2 py-0.5 gap-1',
    md: 'text-caption px-2.5 py-1 gap-1.5',
    lg: 'text-secondary px-3 py-1.5 gap-2 font-bold',
  }[size];

  const iconSize = {
    sm: 10,
    md: 12,
    lg: 14,
  }[size];

  const renderTierIcon = () => {
    switch (normRarity) {
      case 'common':
        return <Circle size={iconSize} className="fill-current shrink-0" />;
      case 'uncommon':
        return <ChevronUp size={iconSize} className="stroke-[3] shrink-0" />;
      case 'rare':
        return <Diamond size={iconSize} className="fill-current shrink-0" />;
      case 'epic':
        return <Hexagon size={iconSize} className="fill-current shrink-0" />;
      case 'legendary':
        return <Star size={iconSize} className="fill-current shrink-0" />;
      case 'mythic':
        return <Sparkles size={iconSize} className="shrink-0 animate-pulse" />;
      default:
        return <Circle size={iconSize} className="fill-current shrink-0" />;
    }
  };

  const isLegendary = normRarity === 'legendary';
  const isMythic = normRarity === 'mythic';

  return (
    <span
      data-rarity={normRarity}
      role="status"
      aria-label={`Rarity: ${normRarity}`}
      className={`inline-flex items-center rounded-[var(--radius-chip)] font-sans uppercase tracking-wider font-bold select-none ${sizeClasses} ${
        isMythic
          ? 'bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500 text-white shadow-[0_0_12px_rgba(255,79,216,0.5)]'
          : isLegendary
          ? 'bg-[var(--color-legendary)] text-[var(--color-void)] font-black shadow-[0_0_12px_rgba(232,168,56,0.4)]'
          : 'bg-[var(--r)] text-[var(--r-text)] shadow-[0_0_8px_var(--r-glow)]'
      } ${className}`}
    >
      {showIcon && renderTierIcon()}
      <span>{normRarity}</span>
    </span>
  );
};

RarityBadge.displayName = 'RarityBadge';
