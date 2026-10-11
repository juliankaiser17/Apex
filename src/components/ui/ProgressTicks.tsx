import React from 'react';

export interface ProgressTicksProps {
  current: number;
  total: number;
  label?: string;
  className?: string;
}

export const ProgressTicks: React.FC<ProgressTicksProps> = ({
  current,
  total,
  label = 'Progress',
  className = '',
}) => {
  const safeTotal = Math.max(1, total);
  const clampedCurrent = Math.max(0, Math.min(safeTotal, current));
  const isComplete = clampedCurrent >= safeTotal;

  return (
    <div className={`space-y-1.5 ${className}`}>
      <div className="flex items-center justify-between text-caption font-sans">
        <span className="text-[var(--color-text-3)] font-medium text-[11px]">
          {label}
        </span>
        <span className="font-mono tabular-nums text-caption font-semibold text-[var(--color-text)]">
          {clampedCurrent} of {safeTotal}
        </span>
      </div>

      {/* Segmented Progress Ticks */}
      <div className="flex items-center gap-1.5 h-1.5 w-full">
        {Array.from({ length: safeTotal }).map((_, idx) => {
          const isFilled = idx < clampedCurrent;
          return (
            <div
              key={idx}
              className={`h-full flex-1 rounded-full transition-all duration-300 ${
                isFilled
                  ? isComplete
                    ? 'bg-[var(--color-ok)] shadow-[0_0_6px_rgba(63,167,150,0.4)]'
                    : 'bg-[var(--color-xp)] shadow-[0_0_6px_rgba(242,179,61,0.4)]'
                  : 'bg-[var(--color-line)]'
              }`}
            />
          );
        })}
      </div>
    </div>
  );
};

ProgressTicks.displayName = 'ProgressTicks';
