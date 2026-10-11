import React from 'react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'secondary',
  size = 'md',
  isLoading = false,
  leftIcon,
  rightIcon,
  disabled,
  className = '',
  ...props
}) => {
  // Height strictly >= 48px for touch target accessibility compliance
  const sizeClasses = {
    sm: 'min-h-[48px] px-4 py-2 text-secondary',
    md: 'min-h-[48px] px-5 py-3 text-body font-semibold',
    lg: 'min-h-[52px] px-6 py-3.5 text-body font-bold',
  }[size];

  const variantClasses = {
    primary:
      'bg-[var(--color-accent)] text-white shadow-[0_4px_20px_var(--accent-glow)] hover:brightness-110 active:scale-[0.97] border border-white/10',
    secondary:
      'bg-[var(--color-panel-2)] text-[var(--color-text)] border border-[var(--color-line)] hover:border-[var(--color-text-3)] active:scale-[0.97]',
    ghost:
      'bg-transparent text-[var(--color-text-2)] hover:text-[var(--color-text)] hover:bg-[var(--color-panel)] active:scale-[0.97]',
    danger:
      'bg-[var(--color-danger)] text-white hover:brightness-110 active:scale-[0.97] border border-white/10',
  }[variant];

  const isDisabled = disabled || isLoading;

  return (
    <button
      {...props}
      disabled={isDisabled}
      className={`relative inline-flex items-center justify-center gap-2.5 rounded-[var(--radius-button)] font-sans transition-all duration-200 cursor-pointer select-none ${sizeClasses} ${variantClasses} ${
        isDisabled ? 'opacity-40 cursor-not-allowed active:scale-100' : ''
      } ${className}`}
    >
      {isLoading && (
        <span className="absolute inset-0 flex items-center justify-center">
          <span className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
        </span>
      )}
      <span className={`inline-flex items-center gap-2 ${isLoading ? 'opacity-0' : 'opacity-100'}`}>
        {leftIcon && <span className="shrink-0">{leftIcon}</span>}
        <span>{children}</span>
        {rightIcon && <span className="shrink-0">{rightIcon}</span>}
      </span>
    </button>
  );
};

Button.displayName = 'Button';
