import React from 'react';

export interface StatChipProps {
  icon?: React.ReactNode;
  value: string | number;
  unit?: string;
  label?: string;
  className?: string;
}

export const StatChip: React.FC<StatChipProps> = ({
  icon,
  value,
  unit,
  label,
  className = '',
}) => {
  return (
    <div
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[var(--radius-chip)] border border-[var(--color-line)] bg-[var(--color-panel-2)]/90 backdrop-blur-sm ${className}`}
    >
      {icon && <span className="text-[var(--color-text-2)] shrink-0">{icon}</span>}
      {label && <span className="text-caption text-[var(--color-text-3)] mr-0.5">{label}</span>}
      <span className="font-mono text-secondary font-semibold tabular-nums text-[var(--color-text)]">
        {value}
      </span>
      {unit && (
        <span className="font-mono text-[11px] text-[var(--color-text-3)] font-normal">
          {unit}
        </span>
      )}
    </div>
  );
};

StatChip.displayName = 'StatChip';
