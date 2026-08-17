import React from 'react';
import { motion } from 'framer-motion';
import { Flame, Zap, Settings } from 'lucide-react';
import { useApexStore } from '../../store/useApexStore';
import { getLevelFromXp } from '../../utils/rarity';
import { sounds } from '../../utils/audio';

export const HeaderBar: React.FC = () => {
  const { user, setActiveTab, setSettingsModalOpen } = useApexStore();
  const { level, progressPercent } = getLevelFromXp(user.xp);

  return (
    <>
      {/* Top HUD Bar — Luxury obsidian with subtle titanium line */}
      <header className="sticky top-0 z-30 w-full pt-safe border-b border-white/10 backdrop-blur-xl bg-[#080808]/90 select-none">
        <div className="px-4 py-2.5">
          <div className="flex items-center justify-between">
            {/* Left: APEX wordmark with glowing red dot */}
            <div 
              onClick={() => {
                sounds.playTargetLock();
                setActiveTab('home');
              }} 
              className="cursor-pointer flex items-center gap-2 group"
            >
              <div className="w-2.5 h-2.5 rounded-full bg-[#FF4500] shadow-[0_0_10px_#FF4500] group-hover:scale-125 transition-transform" />
              <span className="font-display text-[26px] tracking-[4px] text-[#F0EBE3] group-hover:text-[#FF4500] transition-colors leading-none">
                APEX
              </span>
              <span className="text-[9px] font-data font-semibold uppercase px-1.5 py-0.5 rounded bg-white/5 text-[#9A9088] border border-white/10 ml-1">
                {user.city || 'RADAR'}
              </span>
            </div>

            {/* Center: Streak (if active) */}
            {user.streakDays > 0 && (
              <motion.div 
                animate={{ scale: [1, 1.05, 1] }} 
                transition={{ duration: 2, repeat: Infinity }}
                className="flex items-center gap-1 bg-[#FF4500]/10 border border-[#FF4500]/30 px-2.5 py-1 rounded-full shadow-[0_0_12px_rgba(255,69,0,0.2)]"
              >
                <Flame className="w-4 h-4 text-[#FF4500]" />
                <span className="font-data text-xs font-bold text-[#F0EBE3]">
                  {user.streakDays}D STREAK
                </span>
              </motion.div>
            )}

            {/* Right: Level, XP Counter & Settings Gear */}
            <div className="flex items-center gap-2.5">
              {/* Level Badge */}
              <div className="flex items-center gap-1.5 bg-[#141414] border border-white/10 px-2.5 py-1 rounded-xl shadow-inner">
                <span className="text-[10px] font-data font-bold text-[#9A9088]">LVL</span>
                <span className="font-display text-sm text-[#F0EBE3] leading-none">{level}</span>
                <div className="w-1 h-3 bg-white/10 rounded-full mx-0.5" />
                <Zap className="w-3.5 h-3.5 text-[#FFA500]" />
                <span className="font-data text-xs font-semibold text-[#FFA500] leading-none">
                  {user.xp.toLocaleString()}
                </span>
              </div>

              {/* Profile Settings Gear Icon */}
              <motion.button
                whileTap={{ scale: 0.9, rotate: 45 }}
                onClick={() => {
                  sounds.playTargetLock();
                  setSettingsModalOpen(true);
                }}
                className="w-9 h-9 rounded-xl bg-[#141414] hover:bg-[#1F1F1F] flex items-center justify-center text-[#9A9088] hover:text-[#FF4500] transition-colors border border-white/10 shadow-sm"
                title="Settings & Profile"
              >
                <Settings className="w-4 h-4" />
              </motion.button>
            </div>
          </div>
        </div>
      </header>

      {/* XP Level Progress Bar */}
      <div className="sticky z-30 w-full" style={{ top: 'calc(var(--sat, 28px) + 52px)' }}>
        <div className="relative">
          <div className="h-[2px] w-full bg-white/5">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${progressPercent}%` }}
              transition={{ duration: 1, ease: 'easeOut' }}
              className="h-full relative bg-gradient-to-r from-[#FF4500] to-[#FFA500] shadow-[0_0_8px_#FF4500]"
            >
              <div className="absolute right-0 top-0 bottom-0 w-2 bg-white/90 shadow-[0_0_6px_#fff]" />
            </motion.div>
          </div>
        </div>
      </div>
    </>
  );
};
