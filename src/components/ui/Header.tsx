import React from 'react';
import { Flame, Bell, ChevronDown } from 'lucide-react';

export interface HeaderProps {
  onOpenProfile: () => void;
  onOpenCitySelector?: () => void;
  onOpenNotifications?: () => void;
  currentCity?: string;
  streakDays?: number;
  unreadNotificationsCount?: number;
  level?: number;
  levelProgressPct?: number; // 0 to 100
  avatarUrl?: string;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenProfile,
  onOpenCitySelector,
  onOpenNotifications,
  currentCity = 'Lucknow',
  streakDays = 1,
  unreadNotificationsCount = 0,
  level = 1,
  levelProgressPct = 25,
  avatarUrl,
}) => {
  const radius = 15;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (levelProgressPct / 100) * circumference;

  return (
    <header className="sticky top-0 z-40 w-full bg-[var(--color-void)]/90 backdrop-blur-md border-b border-[var(--color-line)] pt-safe select-none">
      <div className="flex items-center justify-between h-14 px-4 max-w-lg mx-auto">
        {/* Left: 32px Avatar with Level Progress Ring */}
        <button
          onClick={onOpenProfile}
          aria-label={`Open profile, Level ${level}`}
          className="relative w-10 h-10 flex items-center justify-center cursor-pointer group active:scale-95 transition-transform"
        >
          {/* Progress Ring */}
          <svg className="absolute inset-0 w-10 h-10 -rotate-90 pointer-events-none" viewBox="0 0 40 40">
            <circle
              cx="20"
              cy="20"
              r={radius}
              className="stroke-[var(--color-line)] fill-none stroke-[2.5]"
            />
            <circle
              cx="20"
              cy="20"
              r={radius}
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              className="stroke-[var(--color-xp)] fill-none stroke-[2.5] transition-all duration-500"
            />
          </svg>

          {/* Avatar / Level Indicator */}
          <div className="w-8 h-8 rounded-full overflow-hidden bg-[var(--color-panel-2)] border border-white/10 flex items-center justify-center">
            {avatarUrl ? (
              <img src={avatarUrl} alt="User Avatar" className="w-full h-full object-cover" />
            ) : (
              <span className="font-mono text-caption font-bold text-[var(--color-text)]">
                L{level}
              </span>
            )}
          </div>
        </button>

        {/* Centre: APEX Wordmark + City Chip */}
        <div className="flex flex-col items-center justify-center">
          <span className="font-display text-display-m font-black tracking-widest text-[var(--color-text)] uppercase leading-none">
            APEX
          </span>
          <button
            onClick={onOpenCitySelector}
            aria-label={`Change current city: ${currentCity}`}
            className="inline-flex items-center gap-1 text-[11px] font-sans font-medium text-[var(--color-text-3)] hover:text-[var(--color-text)] transition-colors mt-0.5 cursor-pointer"
          >
            <span>{currentCity}</span>
            <ChevronDown size={11} className="opacity-70" />
          </button>
        </div>

        {/* Right: Streak Flame & Bell with Accent Unread Dot */}
        <div className="flex items-center gap-2.5">
          {/* Streak Indicator (Warm orange, NOT accent red) */}
          <div
            className="flex items-center gap-1 px-2.5 py-1 rounded-[var(--radius-chip)] bg-[var(--color-panel-2)] border border-[var(--color-line)]"
            title={`${streakDays} Day Spotting Streak`}
          >
            <Flame size={15} className="text-orange-400 fill-orange-400 shrink-0" />
            <span className="font-mono text-secondary font-bold tabular-nums text-[var(--color-text)]">
              {streakDays}
            </span>
          </div>

          {/* Notification Bell */}
          <button
            onClick={onOpenNotifications}
            aria-label="View notifications"
            className="relative w-9 h-9 rounded-full flex items-center justify-center text-[var(--color-text-2)] hover:text-[var(--color-text)] hover:bg-[var(--color-panel-2)] transition-colors cursor-pointer"
          >
            <Bell size={18} />
            {unreadNotificationsCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[var(--color-accent)] shadow-[0_0_6px_var(--accent-glow)]" />
            )}
          </button>
        </div>
      </div>
    </header>
  );
};

Header.displayName = 'Header';
