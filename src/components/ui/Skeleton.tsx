import React from 'react';

export interface SkeletonProps {
  variant?: 'card' | 'row' | 'avatar' | 'stat' | 'rect';
  className?: string;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  variant = 'rect',
  className = '',
}) => {
  const variantClass = {
    card: 'aspect-[4/5] rounded-[var(--radius-panel)] w-full',
    row: 'h-14 rounded-[var(--radius-panel)] w-full',
    avatar: 'w-10 h-10 rounded-full shrink-0',
    stat: 'h-16 rounded-[var(--radius-panel)] w-full',
    rect: 'h-6 rounded-[var(--radius-chip)] w-full',
  }[variant];

  return (
    <div
      role="progressbar"
      aria-label="Loading content"
      className={`relative overflow-hidden bg-[var(--color-panel-2)]/80 ${variantClass} ${className}`}
    >
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent animate-[apexShimmer_1.6s_infinite]" />
    </div>
  );
};

Skeleton.displayName = 'Skeleton';
