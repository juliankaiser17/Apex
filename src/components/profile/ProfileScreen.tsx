import React, { useState } from 'react';
import { 
  Award, 
  Sparkles, 
  Settings as SettingsIcon, 
  ChevronRight
} from 'lucide-react';
import { useApexStore } from '../../store/useApexStore';
import { sounds } from '../../utils/audio';
import { hapticTap } from '../../utils/haptics';
import { getProgressToNextLevel } from '../../utils/mastery';
import { computeAuthoritativeStats } from '../../utils/userStats';
import { ProfileCustomizationModal } from './ProfileCustomizationModal';
import { BadgesModal } from './BadgesModal';
import { Button } from '../ui/Button';

interface ProfileScreenProps {
  onOpenSettings?: () => void;
}

export const ProfileScreen: React.FC<ProfileScreenProps> = ({ onOpenSettings }) => {
  const user = useApexStore(s => s.user);
  const garage = useApexStore(s => s.garage);
  const badges = useApexStore(s => s.badges);
  const setSettingsModalOpen = useApexStore(s => s.setSettingsModalOpen);

  const [isCustomizationOpen, setIsCustomizationOpen] = useState(false);
  const [isBadgesModalOpen, setIsBadgesModalOpen] = useState(false);

  const mastery = getProgressToNextLevel(user.level, user.xp);
  const authStats = computeAuthoritativeStats(garage, badges, user);
  const unlockedBadges = badges.filter(b => b.isUnlocked);
  const previewBadges = unlockedBadges.length > 0 ? unlockedBadges.slice(0, 6) : badges.slice(0, 6);

  // SVG ring math for 88px avatar (radius = 48, circumference = 2 * PI * 48 = 301.6)
  const radius = 48;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (mastery.percentage / 100) * circumference;

  return (
    <div className="flex-1 w-full pb-36 px-4 pt-2 space-y-5 font-sans bg-[var(--color-void)] max-w-lg mx-auto select-none">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <h2 className="font-display text-display-l text-[var(--color-text)] uppercase leading-none">
          Spotter Profile
        </h2>
        <button
          onClick={() => {
            hapticTap();
            sounds.playTargetLock();
            if (onOpenSettings) {
              onOpenSettings();
            } else {
              setSettingsModalOpen(true);
            }
          }}
          aria-label="Settings"
          className="w-9 h-9 rounded-full bg-[var(--color-panel-2)] border border-[var(--color-line)] flex items-center justify-center text-[var(--color-text-2)] hover:text-[var(--color-text)] active:scale-95 transition-all cursor-pointer"
        >
          <SettingsIcon size={18} />
        </button>
      </div>

      {/* Main Profile Slab */}
      <div className="rounded-[var(--radius-panel)] border border-[var(--color-line)] bg-[var(--color-panel)] p-6 text-center space-y-4 shadow-[0_8px_32px_rgba(0,0,0,0.5)]">
        {/* 88px Avatar with Circular Progress Ring */}
        <div className="relative inline-block mx-auto">
          <svg className="w-[108px] h-[108px] -rotate-90">
            {/* Background Track */}
            <circle
              cx="54"
              cy="54"
              r={radius}
              stroke="var(--color-panel-2)"
              strokeWidth="4"
              fill="transparent"
            />
            {/* Progress Arc */}
            <circle
              cx="54"
              cy="54"
              r={radius}
              stroke="var(--color-xp)"
              strokeWidth="4"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              fill="transparent"
              className="transition-all duration-700 ease-out"
            />
          </svg>

          {/* 88px Avatar Image */}
          <div className="absolute inset-0 flex items-center justify-center">
            <img
              src={user.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=400'}
              alt={user.username}
              className="w-[88px] h-[88px] rounded-full object-cover border-2 border-[var(--color-void)] shadow-xl"
            />
          </div>

          {/* Level Pill */}
          <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 font-mono text-[10px] font-bold px-2 py-0.5 rounded-[var(--radius-chip)] bg-[var(--color-void)] border border-[var(--color-line)] text-[var(--color-xp)] shadow-md tabular-nums uppercase">
            Lvl {mastery.level}
          </span>
        </div>

        {/* Identity Details */}
        <div className="space-y-1">
          <div className="flex items-center justify-center gap-2">
            <h3 className="font-display text-display-m text-[var(--color-text)]">
              {user.displayName || 'Apex Member'}
            </h3>
            {user.driverTitle && (
              <span className="font-mono text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-[var(--radius-chip)] bg-[var(--color-xp)]/10 border border-[var(--color-xp)]/30 text-[var(--color-xp)]">
                {user.driverTitle}
              </span>
            )}
          </div>

          <p className="font-mono text-caption text-[var(--color-text-3)]">
            @{user.username || 'driver'} · {user.city || 'Global'}
          </p>

          {user.bio && (
            <p className="text-secondary text-[var(--color-text-2)] italic max-w-sm mx-auto pt-1">
              "{user.bio}"
            </p>
          )}

          {(user.favoriteCar || user.favoriteBrand) && (
            <div className="flex items-center justify-center pt-2">
              <span className="font-mono text-caption text-[var(--color-text-3)] px-3 py-1 rounded-[var(--radius-chip)] bg-[var(--color-panel-2)] border border-[var(--color-line)]">
                Dream: {[user.favoriteBrand, user.favoriteCar].filter(Boolean).join(' ')}
              </span>
            </div>
          )}
        </div>

        {/* Customize Button */}
        <div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              hapticTap();
              sounds.playTargetLock();
              setIsCustomizationOpen(true);
            }}
          >
            <Sparkles size={14} />
            <span>Customize Profile</span>
          </Button>
        </div>
      </div>

      {/* Level Mastery Progression Card */}
      <div className="rounded-[var(--radius-panel)] border border-[var(--color-line)] bg-[var(--color-panel)] p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <span className="font-mono text-[10px] font-bold text-[var(--color-text-3)] uppercase tracking-wider block">
              Spotter Mastery
            </span>
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className="font-display text-display-m text-[var(--color-text)]">
                Level {mastery.level}
              </span>
              <span className="font-mono text-[10px] font-bold text-[var(--color-xp)] uppercase">
                {mastery.tierConfig.label}
              </span>
            </div>
          </div>

          <div className="text-right">
            <span className="font-mono text-secondary font-bold text-[var(--color-xp)] tabular-nums">
              {mastery.isMaxLevel ? 'MAX' : `${mastery.percentage}%`}
            </span>
            <span className="font-mono text-[10px] text-[var(--color-text-3)] block tabular-nums">
              {mastery.currentXp.toLocaleString()} / {mastery.requiredXp.toLocaleString()} XP
            </span>
          </div>
        </div>

        {/* Hairline Progress Bar */}
        <div className="w-full h-1.5 bg-[var(--color-panel-2)] rounded-full overflow-hidden">
          <div
            className="h-full bg-[var(--color-xp)] rounded-full transition-all duration-500"
            style={{ width: `${mastery.percentage}%` }}
          />
        </div>
      </div>

      {/* 2x3 Hairline Discovery Stats Grid */}
      <div className="space-y-2">
        <h4 className="font-mono text-caption font-bold text-[var(--color-text-3)] uppercase tracking-wider px-1">
          Spotting Telemetry
        </h4>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
          <div className="p-3.5 rounded-[var(--radius-panel)] bg-[var(--color-panel)] border border-[var(--color-line)] space-y-1">
            <span className="font-mono text-[10px] text-[var(--color-text-3)] uppercase block font-medium">
              Cars Spotted
            </span>
            <span className="font-mono text-display-m font-bold text-[var(--color-text)] tabular-nums">
              {authStats.totalCarsSpotted}
            </span>
          </div>

          <div className="p-3.5 rounded-[var(--radius-panel)] bg-[var(--color-panel)] border border-[var(--color-line)] space-y-1">
            <span className="font-mono text-[10px] text-[var(--color-text-3)] uppercase block font-medium">
              Unique Finds
            </span>
            <span className="font-mono text-display-m font-bold text-[var(--color-xp)] tabular-nums">
              {authStats.uniqueFindsCount}
            </span>
          </div>

          <div className="p-3.5 rounded-[var(--radius-panel)] bg-[var(--color-panel)] border border-[var(--color-line)] space-y-1">
            <span className="font-mono text-[10px] text-[var(--color-text-3)] uppercase block font-medium">
              Rare Finds
            </span>
            <span className="font-mono text-display-m font-bold text-sky-400 tabular-nums">
              {authStats.rareCount}
            </span>
          </div>

          <div className="p-3.5 rounded-[var(--radius-panel)] bg-[var(--color-panel)] border border-[var(--color-line)] space-y-1">
            <span className="font-mono text-[10px] text-[var(--color-text-3)] uppercase block font-medium">
              Epic Finds
            </span>
            <span className="font-mono text-display-m font-bold text-purple-400 tabular-nums">
              {authStats.epicCount}
            </span>
          </div>

          <div className="p-3.5 rounded-[var(--radius-panel)] bg-[var(--color-panel)] border border-[var(--color-line)] space-y-1">
            <span className="font-mono text-[10px] text-[var(--color-text-3)] uppercase block font-medium">
              Legendary Finds
            </span>
            <span className="font-mono text-display-m font-bold text-amber-400 tabular-nums">
              {authStats.legendaryCount}
            </span>
          </div>

          <div className="p-3.5 rounded-[var(--radius-panel)] bg-[var(--color-panel)] border border-[var(--color-line)] space-y-1">
            <span className="font-mono text-[10px] text-[var(--color-text-3)] uppercase block font-medium">
              Badges
            </span>
            <span className="font-mono text-display-m font-bold text-[var(--color-ok)] tabular-nums">
              {authStats.badgesUnlockedCount}
            </span>
          </div>
        </div>
      </div>

      {/* Badges Showcase Section */}
      <div className="rounded-[var(--radius-panel)] border border-[var(--color-line)] bg-[var(--color-panel)] p-4 space-y-3">
        <div className="flex items-center justify-between pb-1 border-b border-[var(--color-line)]">
          <div className="flex items-center gap-2">
            <Award size={16} className="text-[var(--color-xp)]" />
            <h4 className="font-display text-display-m text-[var(--color-text)] uppercase">
              Badges ({authStats.badgesUnlockedCount} / {badges.length})
            </h4>
          </div>
          <button
            onClick={() => {
              hapticTap();
              sounds.playTargetLock();
              setIsBadgesModalOpen(true);
            }}
            className="text-secondary text-[var(--color-text-3)] hover:text-[var(--color-text)] flex items-center gap-1 transition-colors cursor-pointer"
          >
            <span>View all</span>
            <ChevronRight size={14} />
          </button>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {previewBadges.map((badge) => (
            <div
              key={badge.id}
              onClick={() => {
                hapticTap();
                sounds.playTargetLock();
                setIsBadgesModalOpen(true);
              }}
              className={`p-3 rounded-[var(--radius-panel)] border flex flex-col items-center text-center space-y-1 transition-all cursor-pointer active:scale-95 ${
                badge.isUnlocked
                  ? 'bg-[var(--color-panel-2)] border-[var(--color-line)]'
                  : 'bg-[var(--color-panel-2)]/30 border-dashed border-[var(--color-line)] opacity-40'
              }`}
            >
              <Award size={20} className={badge.isUnlocked ? 'text-[var(--color-xp)]' : 'text-[var(--color-text-3)]'} />
              <span className="font-semibold text-[11px] text-[var(--color-text)] truncate max-w-full">
                {badge.name}
              </span>
              <span className="font-mono text-[9px] text-[var(--color-text-3)] uppercase">
                {badge.rarity || 'Common'}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Modals */}
      <ProfileCustomizationModal
        isOpen={isCustomizationOpen}
        onClose={() => setIsCustomizationOpen(false)}
      />

      <BadgesModal
        isOpen={isBadgesModalOpen}
        onClose={() => setIsBadgesModalOpen(false)}
      />
    </div>
  );
};

ProfileScreen.displayName = 'ProfileScreen';
