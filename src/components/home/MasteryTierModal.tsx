import React, { useEffect } from 'react';
import { X, Trophy, Sparkles, CheckCircle2, Lock, Shield, Zap, Target, Award } from 'lucide-react';
import { useApexStore } from '../../store/useApexStore';
import { getProgressToNextLevel, MASTERY_TIERS, type MasteryTier } from '../../utils/mastery';
import { sounds } from '../../utils/audio';
import { hapticTap } from '../../utils/haptics';

interface MasteryTierModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface TierPerkItem {
  tier: MasteryTier;
  title: string;
  levelRange: string;
  minLevel: number;
  perks: string[];
  icon: typeof Trophy;
  accentColor: string;
  borderColor: string;
  badgeBg: string;
}

const TIER_ROADMAP: TierPerkItem[] = [
  {
    tier: 'BEGINNER',
    title: 'Beginner Spotter',
    levelRange: 'Level 1 – 10',
    minLevel: 1,
    icon: Target,
    accentColor: '#9CA3AF',
    borderColor: 'border-zinc-700/60',
    badgeBg: 'bg-zinc-800/80 text-zinc-300',
    perks: [
      'Access to AI Instant Camera Scanner',
      'Local Daikoku radar spotting (1km radius)',
      'Basic Garage Vault storage (up to 20 spots)'
    ]
  },
  {
    tier: 'INTERMEDIATE',
    title: 'Street Scout',
    levelRange: 'Level 11 – 30',
    minLevel: 11,
    icon: Zap,
    accentColor: '#60A5FA',
    borderColor: 'border-blue-500/40',
    badgeBg: 'bg-blue-950/60 text-blue-400',
    perks: [
      '1.25x Discovery XP multiplier on Rare vehicles',
      'Extended Radar range (up to 5km)',
      'Unlocked custom Garage Badges & Titles'
    ]
  },
  {
    tier: 'ADVANCED',
    title: 'Apex Hunter',
    levelRange: 'Level 31 – 60',
    minLevel: 31,
    icon: Award,
    accentColor: '#F59E0B',
    borderColor: 'border-amber-500/40',
    badgeBg: 'bg-amber-950/60 text-amber-400',
    perks: [
      '1.5x Discovery XP multiplier on Epic & Legendary finds',
      'Holo-Foil collectible card finish unlock',
      'High-speed global spotter leaderboards participation'
    ]
  },
  {
    tier: 'EXPERT',
    title: 'Track Master',
    levelRange: 'Level 61 – 100',
    minLevel: 61,
    icon: Trophy,
    accentColor: '#EF4444',
    borderColor: 'border-red-500/50',
    badgeBg: 'bg-red-950/60 text-red-400',
    perks: [
      '2.0x Double XP multiplier on Mythic Hypercars',
      'Prestige Apex Crown profile badge & insignia',
      'Unlimited Garage Vault capacity & VIP status'
    ]
  }
];

export const MasteryTierModal: React.FC<MasteryTierModalProps> = ({ isOpen, onClose }) => {
  const userLevel = useApexStore(s => s.user.level);
  const userXp = useApexStore(s => s.user.xp);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const { level, tier, currentXp, requiredXp, percentage, isMaxLevel } = getProgressToNextLevel(userLevel, userXp);
  const xpRemaining = Math.max(0, requiredXp - currentXp);

  return (
    <div 
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 select-none font-sans"
      onClick={onClose}
    >
      {/* Frosted Backdrop */}
      <div className="fixed inset-0 bg-black/75 backdrop-blur-md transition-opacity animate-fadeIn" />

      {/* Apple-grade Bottom Sheet Card */}
      <div 
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-lg max-h-[88vh] bg-[#121216]/95 border border-white/[0.14] rounded-t-[32px] sm:rounded-[32px] p-5 shadow-2xl flex flex-col overflow-hidden animate-slideUp"
        style={{
          boxShadow: '0 -10px 40px rgba(0, 0, 0, 0.7), inset 0 1px 0 rgba(255, 255, 255, 0.12)'
        }}
      >
        {/* Grab Handle for Mobile Ergonomics */}
        <div className="w-12 h-1 bg-white/20 rounded-full mx-auto mb-3.5 shrink-0" />

        {/* Header Bar */}
        <div className="flex items-center justify-between pb-3 border-b border-white/[0.08] shrink-0">
          <div className="flex items-center gap-2.5">
            <div 
              className="w-8 h-8 rounded-xl flex items-center justify-center text-white"
              style={{ backgroundColor: 'var(--accent-color)' }}
            >
              <Shield className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">
                Driver Mastery & Tiers
              </h2>
              <p className="text-[11px] text-white/50">
                Unlock higher XP multipliers and exclusive spotter privileges
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              hapticTap();
              sounds.playTargetLock();
              onClose();
            }}
            className="w-8 h-8 rounded-full bg-white/[0.08] hover:bg-white/[0.15] active:scale-90 flex items-center justify-center text-white/70 hover:text-white transition-all cursor-pointer"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto space-y-4 pt-3.5 pr-0.5 no-scrollbar">
          {/* Active Status Cockpit Box */}
          <div className="rounded-2xl p-4 border border-white/[0.12] bg-gradient-to-br from-white/[0.06] via-white/[0.02] to-transparent space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div 
                  className="w-12 h-12 rounded-2xl flex items-center justify-center font-black text-lg text-white shadow-lg border border-white/20"
                  style={{
                    background: 'linear-gradient(135deg, var(--accent-color) 0%, #111111 100%)'
                  }}
                >
                  L{level}
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-bold uppercase tracking-wider text-white">
                      {MASTERY_TIERS[tier]?.label || 'Beginner'}
                    </span>
                    <Sparkles className="w-3.5 h-3.5 text-yellow-400" />
                  </div>
                  <p className="text-xs text-white/60 font-data">
                    {userXp.toLocaleString()} Total XP
                  </p>
                </div>
              </div>

              <div className="text-right">
                <span className="text-[11px] font-semibold text-white/50 block">NEXT LEVEL</span>
                <span className="text-xs font-bold text-white font-data">
                  {isMaxLevel ? 'MAX LEVEL' : `${xpRemaining.toLocaleString()} XP to L${level + 1}`}
                </span>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-[11px] font-data text-white/50">
                <span>TIER COMPLETION</span>
                <span className="text-white/80 font-bold">{Math.round(percentage)}%</span>
              </div>
              <div className="h-2 bg-white/[0.08] rounded-full overflow-hidden">
                <div 
                  style={{ 
                    width: `${Math.min(100, percentage)}%`,
                    backgroundColor: 'var(--accent-color)',
                    boxShadow: '0 0 10px var(--accent-color)'
                  }}
                  className="h-full rounded-full transition-all duration-500"
                />
              </div>
            </div>
          </div>

          {/* Tier Progression Roadmap */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-white/50 px-1">
              Mastery Roadmap & Perks
            </h3>

            {TIER_ROADMAP.map((item) => {
              const Icon = item.icon;
              const isCurrent = tier === item.tier;
              const isUnlocked = level >= item.minLevel;

              return (
                <div
                  key={item.tier}
                  className={`rounded-2xl p-3.5 border transition-all ${
                    isCurrent
                      ? 'border-white/30 bg-white/[0.08] shadow-lg'
                      : isUnlocked
                      ? 'border-white/10 bg-white/[0.03]'
                      : 'border-white/[0.06] bg-black/40 opacity-70'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-7 h-7 rounded-lg flex items-center justify-center"
                        style={{ backgroundColor: `${item.accentColor}22`, color: item.accentColor }}
                      >
                        <Icon className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-white leading-tight">
                          {item.title}
                        </h4>
                        <span className="text-[10px] text-white/50 font-data">
                          {item.levelRange}
                        </span>
                      </div>
                    </div>

                    {isCurrent ? (
                      <span 
                        className="text-[9px] font-extrabold px-2 py-0.5 rounded-full text-white uppercase tracking-wider shadow"
                        style={{ backgroundColor: 'var(--accent-color)' }}
                      >
                        ACTIVE TIER
                      </span>
                    ) : isUnlocked ? (
                      <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                        <CheckCircle2 className="w-2.5 h-2.5" /> UNLOCKED
                      </span>
                    ) : (
                      <span className="text-[9px] font-semibold px-2 py-0.5 rounded-full bg-white/[0.06] text-white/40 border border-white/[0.08] flex items-center gap-1">
                        <Lock className="w-2.5 h-2.5" /> LVL {item.minLevel}
                      </span>
                    )}
                  </div>

                  {/* Perks list */}
                  <ul className="space-y-1 pl-9">
                    {item.perks.map((perk, idx) => (
                      <li key={idx} className="text-[11px] text-white/70 flex items-start gap-1.5 leading-relaxed">
                        <span className="text-white/40 shrink-0">•</span>
                        <span>{perk}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer Dismiss Button */}
        <div className="pt-3 border-t border-white/[0.08] mt-2 shrink-0">
          <button
            onClick={() => {
              hapticTap();
              sounds.playTargetLock();
              onClose();
            }}
            className="w-full py-3 rounded-2xl bg-white/[0.08] hover:bg-white/[0.14] active:scale-98 text-white font-semibold text-xs tracking-wider uppercase transition-all cursor-pointer border border-white/10"
          >
            Close Roadmap
          </button>
        </div>
      </div>
    </div>
  );
};
