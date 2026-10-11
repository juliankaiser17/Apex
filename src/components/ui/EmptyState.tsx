import React from 'react';
import { Button } from './Button';

export interface EmptyStateProps {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
  ghostSlot?: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  actionLabel,
  onAction,
  secondaryActionLabel,
  onSecondaryAction,
  ghostSlot,
  icon,
  className = '',
}) => {
  return (
    <div
      className={`flex flex-col items-center justify-center text-center p-6 space-y-4 rounded-[var(--radius-panel)] border border-[var(--color-line)] bg-[var(--color-panel)]/50 ${className}`}
    >
      {/* Ghost slot (e.g. 6-slot collectible outlines) or icon */}
      {ghostSlot ? (
        <div className="w-full mb-2">{ghostSlot}</div>
      ) : icon ? (
        <div className="w-14 h-14 rounded-full flex items-center justify-center bg-[var(--color-panel-2)] text-[var(--color-text-2)] border border-[var(--color-line)] mb-1">
          {icon}
        </div>
      ) : null}

      <div className="space-y-1.5 max-w-sm">
        <h3 className="font-display text-display-m text-[var(--color-text)] tracking-tight">
          {title}
        </h3>
        <p className="text-secondary text-[var(--color-text-3)] leading-relaxed">
          {description}
        </p>
      </div>

      <div className="flex flex-col sm:flex-row items-center gap-3 pt-2 w-full max-w-xs">
        {actionLabel && onAction && (
          <Button variant="primary" onClick={onAction} className="w-full">
            {actionLabel}
          </Button>
        )}
        {secondaryActionLabel && onSecondaryAction && (
          <Button variant="ghost" onClick={onSecondaryAction} className="w-full">
            {secondaryActionLabel}
          </Button>
        )}
      </div>
    </div>
  );
};

EmptyState.displayName = 'EmptyState';
