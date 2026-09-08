import React from 'react';

interface SkeletonProps {
  className?: string;
  style?: React.CSSProperties;
}

/**
 * High-performance, GPU-composited Skeleton primitive.
 * Pure CSS shimmer with zero JS animation loops.
 * Respects prefers-reduced-motion automatically.
 */
export const Skeleton: React.FC<SkeletonProps> = ({ className = '', style }) => {
  return <div className={`apex-skeleton ${className}`} style={style} aria-hidden="true" />;
};

/**
 * Comments Row Skeleton for instant modal feedback without generic spinners
 */
export const CommentRowSkeleton: React.FC = () => (
  <div className="flex items-start gap-3 py-2.5 animate-in fade-in duration-200">
    <Skeleton className="w-8 h-8 rounded-full shrink-0 bg-white/10" />
    <div className="flex-1 space-y-1.5 pt-0.5">
      <div className="flex items-center gap-2">
        <Skeleton className="w-24 h-3 rounded bg-white/10" />
        <Skeleton className="w-10 h-2.5 rounded bg-white/5" />
      </div>
      <Skeleton className="w-4/5 h-3 rounded bg-white/10" />
      <Skeleton className="w-2/3 h-2.5 rounded bg-white/5" />
    </div>
  </div>
);

/**
 * Direct Message Bubble Skeleton (alternating incoming and outgoing)
 */
export const MessageBubbleSkeleton: React.FC<{ isOutgoing?: boolean }> = ({ isOutgoing = false }) => (
  <div className={`flex flex-col ${isOutgoing ? 'items-end' : 'items-start'} py-1 animate-in fade-in duration-200`}>
    <Skeleton 
      className={`h-10 rounded-2xl ${
        isOutgoing 
          ? 'w-48 bg-[#E50914]/20 rounded-br-xs' 
          : 'w-56 bg-white/10 rounded-bl-xs'
      }`} 
    />
  </div>
);

/**
 * Public Profile Header & Collectibles Skeleton
 */
export const ProfileDossierSkeleton: React.FC = () => (
  <div className="space-y-5 animate-in fade-in duration-200">
    {/* Identity Bar */}
    <div className="flex items-center gap-4">
      <Skeleton className="w-18 h-18 rounded-2xl shrink-0 bg-white/10" />
      <div className="space-y-2 flex-1">
        <Skeleton className="w-36 h-5 rounded bg-white/15" />
        <Skeleton className="w-24 h-3.5 rounded bg-white/10" />
        <div className="flex gap-2 pt-1">
          <Skeleton className="w-16 h-4 rounded-full bg-white/5" />
          <Skeleton className="w-20 h-4 rounded-full bg-white/5" />
        </div>
      </div>
    </div>

    {/* Metric Cards Row */}
    <div className="grid grid-cols-3 gap-2.5">
      <Skeleton className="h-16 rounded-xl bg-white/10" />
      <Skeleton className="h-16 rounded-xl bg-white/10" />
      <Skeleton className="h-16 rounded-xl bg-white/10" />
    </div>

    {/* Action Buttons */}
    <div className="flex gap-2">
      <Skeleton className="h-10 flex-1 rounded-xl bg-white/10" />
      <Skeleton className="h-10 flex-1 rounded-xl bg-white/10" />
      <Skeleton className="h-10 w-12 rounded-xl bg-white/10" />
    </div>

    {/* Garage Collectibles Grid */}
    <div className="pt-2">
      <Skeleton className="w-28 h-4 rounded mb-3 bg-white/10" />
      <div className="grid grid-cols-2 gap-3">
        <Skeleton className="h-32 rounded-xl bg-white/10" />
        <Skeleton className="h-32 rounded-xl bg-white/10" />
      </div>
    </div>
  </div>
);
