import React, { useState, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Flame, X, Check, Sparkles, Gift } from 'lucide-react';
import { useApexStore } from '../../store/useApexStore';
import { getAuthoritativeStreak, STREAK_REWARDS } from '../../utils/streak';
import { ConfettiCelebration, type ConfettiCelebrationRef } from './ConfettiCelebration';

export const STREAK_DAYS = STREAK_REWARDS;

export const DailyStreakModal: React.FC = () => {
  // Fine-grained selectors prevent full-app and cross-modal rerenders
  const streakModalOpen = useApexStore(s => s.streakModalOpen);
  const setStreakModalOpen = useApexStore(s => s.setStreakModalOpen);
  const claimDailyStreak = useApexStore(s => s.claimDailyStreak);
  const streakDays = useApexStore(s => s.user.streakDays || 0);
  const streakLastAt = useApexStore(s => s.user.streakLastAt);

  const [justClaimed, setJustClaimed] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const confettiRef = useRef<ConfettiCelebrationRef | null>(null);

  // Authoritative streak derivation
  const streakInfo = useMemo(() => {
    return getAuthoritativeStreak(streakDays, streakLastAt, new Date());
  }, [streakDays, streakLastAt]);

  const isClaimed = justClaimed || streakInfo.isClaimedToday;
  const currentStreak = Math.max(1, streakInfo.isClaimedToday ? streakInfo.currentStreak : streakInfo.targetStreak);
  const activeDayIndex = streakInfo.activeTrackIndex;
  const displayDayNumber = streakInfo.displayDayNumber;
  const currentDayReward = streakInfo.reward;

  const handleClaim = () => {
    if (isClaimed || isSubmitting) {
      setStreakModalOpen(false);
      return;
    }

    setIsSubmitting(true);
    const res = claimDailyStreak();
    if (!res.alreadyClaimed) {
      // Trigger lightweight, isolated canvas confetti (zero React renders per frame)
      confettiRef.current?.trigger();
    }
    setJustClaimed(true);
    setIsSubmitting(false);
  };

  return (
    <AnimatePresence>
      {streakModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 select-none">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={() => setStreakModalOpen(false)}
            className="absolute inset-0 bg-black/85"
            style={{ willChange: 'opacity' }}
          />

        {/* Modal Window */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="relative w-full max-w-sm rounded-3xl bg-[#121212] border border-white/[0.12] shadow-xl p-6 select-none font-sans text-center overflow-hidden"
          style={{ contain: 'content', willChange: 'transform, opacity' }}
        >
          {/* Subtle Ambient Radial Glow */}
          <div 
            className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-32 pointer-events-none rounded-full"
            style={{ background: 'radial-gradient(ellipse at top, var(--accent-subtle) 0%, transparent 70%)' }}
          />

          {/* Close Button */}
          <button
            onClick={() => setStreakModalOpen(false)}
            className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.08] flex items-center justify-center text-white/60 hover:text-white transition-colors z-10"
          >
            <X className="w-4 h-4" />
          </button>

          {/* Hero Flame Icon */}
          <div 
            className="relative mx-auto mt-2 mb-3 w-18 h-18 rounded-2xl flex items-center justify-center shadow-lg border"
            style={{ 
              backgroundColor: 'var(--accent-subtle)', 
              borderColor: 'var(--accent-border)'
            }}
          >
            <motion.div
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
            >
              <Flame 
                className="w-10 h-10" 
                style={{ color: 'var(--accent-color)', fill: 'var(--accent-subtle)' }}
              />
            </motion.div>
            <div 
              className="absolute -bottom-1.5 px-2 py-0.5 rounded-full text-white font-bold text-[10px] tracking-wider uppercase shadow-md"
              style={{ backgroundColor: 'var(--accent-color)' }}
            >
              {currentStreak} {currentStreak === 1 ? 'DAY' : 'DAYS'}
            </div>
          </div>

          <h3 className="text-2xl font-bold text-white tracking-tight mt-3">
            Daily Spotting Streak
          </h3>
          <p className="text-xs text-white/60 mt-1 max-w-xs mx-auto leading-relaxed">
            Spot cars daily to increase your XP streak multiplier and unlock mythic rewards.
          </p>

          {/* 7-Day Rewards Track */}
          <div className="grid grid-cols-4 gap-2 my-5">
            {STREAK_DAYS.map((item, idx) => {
              const isPast = idx < activeDayIndex;
              const isToday = idx === activeDayIndex;

              return (
                <div
                  key={item.day}
                  className={`relative p-2.5 rounded-xl border flex flex-col items-center justify-between min-h-[76px] transition-all ${
                    isToday
                      ? isClaimed
                        ? 'bg-emerald-500/10 border-emerald-500/40 ring-1 ring-emerald-500/30'
                        : 'border-2 shadow-md'
                      : isPast
                      ? 'bg-white/[0.02] border-white/[0.06] opacity-60'
                      : 'bg-[#181818] border-white/[0.06]'
                  } ${idx === 6 ? 'col-span-2 flex-row px-4 py-2 justify-between' : ''}`}
                  style={
                    isToday && !isClaimed ? {
                      backgroundColor: 'var(--accent-subtle)',
                      borderColor: 'var(--accent-color)',
                      boxShadow: '0 0 12px var(--accent-subtle)'
                    } : undefined
                  }
                >
                  {/* Day Label */}
                  <span className="text-[10px] font-semibold text-white/50 uppercase tracking-wider">
                    {item.label}
                  </span>

                  {/* Center Icon / Reward */}
                  <div className="my-1 flex items-center gap-1">
                    {isPast || (isToday && isClaimed) ? (
                      <div className="w-5 h-5 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                        <Check className="w-3 h-3" />
                      </div>
                    ) : item.isMystery ? (
                      <div className="flex items-center gap-2">
                        <Gift className="w-5 h-5" style={{ color: 'var(--accent-color)' }} />
                        <div className="text-left">
                          <span className="text-[11px] font-bold text-white block">Mythic Crate</span>
                          <span className="text-[9px]" style={{ color: 'var(--accent-color)' }}>+{item.xp} XP</span>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center">
                        <span className="text-xs font-bold text-white">+{item.xp}</span>
                        <span className="text-[9px] text-white/40">XP</span>
                      </div>
                    )}
                  </div>

                  {/* Status Indicator */}
                  {idx !== 6 && (
                    <span 
                      className="text-[9px] font-medium"
                      style={isToday ? { color: isClaimed ? '#34D399' : 'var(--accent-color)', fontWeight: 'bold' } : { color: 'rgba(255,255,255,0.4)' }}
                    >
                      {isToday ? (isClaimed ? 'Claimed' : 'Today') : isPast ? 'Done' : `+${item.coins}c`}
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Action Button */}
          <button
            onClick={isClaimed ? () => setStreakModalOpen(false) : handleClaim}
            className={`w-full py-3.5 rounded-2xl font-bold text-sm tracking-tight transition-all flex items-center justify-center gap-2 active:scale-98 ${
              isClaimed
                ? 'bg-white/[0.08] text-white/80 hover:bg-white/[0.14] border border-white/[0.1]'
                : 'text-white shadow-lg'
            }`}
            style={!isClaimed ? {
              backgroundColor: 'var(--accent-color)',
              boxShadow: '0 4px 20px var(--accent-glow)'
            } : undefined}
          >
            {isClaimed ? (
              <>
                <Check className="w-4 h-4 text-emerald-400" />
                <span>Streak Claimed For Today (Day {displayDayNumber})</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>Claim Day {displayDayNumber} Bonus (+{currentDayReward.xp} XP)</span>
              </>
            )}
          </button>
        </motion.div>

        {/* Isolated high-performance canvas celebration */}
        <ConfettiCelebration ref={confettiRef} />
      </div>
      )}
    </AnimatePresence>
  );
};
