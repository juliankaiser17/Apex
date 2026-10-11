import React, { useState } from 'react';

export interface PhotoCardProps {
  src: string;
  alt: string;
  aspectRatio?: '4:5' | '16:10' | '1:1' | '16:9';
  className?: string;
  children?: React.ReactNode;
  onClick?: () => void;
  priority?: boolean;
}

export const PhotoCard: React.FC<PhotoCardProps> = ({
  src,
  alt,
  aspectRatio = '4:5',
  className = '',
  children,
  onClick,
  priority = false,
}) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);

  const aspectClass = {
    '4:5': 'aspect-[4/5]',
    '16:10': 'aspect-[16/10]',
    '1:1': 'aspect-square',
    '16:9': 'aspect-[16/9]',
  }[aspectRatio];

  return (
    <div
      onClick={onClick}
      className={`relative overflow-hidden rounded-[var(--radius-panel)] bg-[var(--color-panel-2)] select-none ${aspectClass} ${
        onClick ? 'cursor-pointer active:scale-[0.98] transition-transform' : ''
      } ${className}`}
    >
      {/* Background dominant placeholder shimmer */}
      {!isLoaded && !hasError && (
        <div className="absolute inset-0 bg-[var(--color-panel-2)] animate-pulse" />
      )}

      {hasError ? (
        <div className="absolute inset-0 flex items-center justify-center bg-[var(--color-panel-2)] text-[var(--color-text-3)] text-caption">
          Image unavailable
        </div>
      ) : (
        <img
          src={src}
          alt={alt}
          loading={priority ? 'eager' : 'lazy'}
          decoding="async"
          onLoad={() => setIsLoaded(true)}
          onError={() => setHasError(true)}
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${
            isLoaded ? 'opacity-100' : 'opacity-0'
          }`}
        />
      )}

      {/* Scrim Overlay for Contrast Guaranteed Text */}
      <div className="absolute inset-0 bg-gradient-to-t from-[var(--color-void)]/90 via-[var(--color-void)]/25 to-transparent pointer-events-none" />

      {/* Content Slot */}
      {children && <div className="absolute inset-0 flex flex-col justify-end p-3.5 z-10">{children}</div>}
    </div>
  );
};

PhotoCard.displayName = 'PhotoCard';
