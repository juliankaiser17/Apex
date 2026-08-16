import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap, Trophy } from 'lucide-react';
import { useApexStore } from '../../store/useApexStore';
import { SPRING_HEAVY, SPRING_POP, SPRING_SETTLE, GLOW_ORANGE } from '../../utils/animationConfig';
import { sounds } from '../../utils/audio';
import confetti from 'canvas-confetti';

export const LevelUpModal: React.FC = () => {
  const { levelUpLevel, dismissLevelUp } = useApexStore();

  useEffect(() => {
    if (levelUpLevel) {
      sounds.playXpPop();
      confetti({
        particleCount: 50,
        spread: 140,
        origin: { y: 0.45, x: 0.5 },
        colors: ['#FF4500', '#FFA500', '#F0EBE3', '#2ECC71'],
        disableForReducedMotion: true
      });
    }
  }, [levelUpLevel]);

  if (!levelUpLevel) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[999] bg-[#080808]/95 backdrop-blur-xl flex flex-col items-center justify-center p-6 text-center select-none"
        style={{ fontFamily: 'DM Sans' }}
      >
        {/* Ambient Orange Underglow */}
        <div 
          className="absolute w-72 h-72 rounded-full pointer-events-none"
          style={{
            background: 'radial-gradient(circle, rgba(255,69,0,0.25) 0%, transparent 70%)',
            filter: 'blur(30px)'
          }}
        />

        {/* Level Up Headline */}
        <motion.h1
          initial={{ y: -80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={SPRING_HEAVY}
          className="font-display text-[72px] text-[#F0EBE3] tracking-[6px] leading-none drop-shadow-2xl"
        >
          LEVEL UP!
        </motion.h1>

        {/* Giant Level Indicator */}
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.15, ...SPRING_POP }}
          className="my-6 relative"
        >
          <div 
            className="w-36 h-36 rounded-full bg-[#111111] border-2 border-[#FF4500] flex flex-col items-center justify-center relative z-10"
            style={{ boxShadow: GLOW_ORANGE }}
          >
            <span className="text-[11px] font-data font-semibold text-[#FF4500] tracking-widest uppercase">
              LEVEL
            </span>
            <span className="font-display text-[64px] text-[#F0EBE3] leading-none">
              {levelUpLevel}
            </span>
          </div>

          {/* Pulsing ring behind circle */}
          <motion.div
            animate={{ scale: [1, 1.3, 1], opacity: [0.6, 0, 0.6] }}
            transition={{ duration: 2.0, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute inset-0 rounded-full border border-[#FF4500]/60 pointer-events-none"
          />
        </motion.div>

        {/* Milestone Unlocks */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.35, ...SPRING_SETTLE }}
          className="space-y-2 max-w-xs w-full mb-8"
        >
          <div className="flex items-center gap-3 p-3 rounded-xl bg-[#1A1A1A] border border-[#2C2C2C] text-left">
            <div className="w-8 h-8 rounded-lg bg-[#FF4500]/20 flex items-center justify-center text-[#FF4500] shrink-0">
              <Zap className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[13px] font-semibold text-[#F0EBE3]">Hunter Rank Promoted</div>
              <div className="text-[11px] text-[#9A9088] font-data">Higher discovery multiplier</div>
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 rounded-xl bg-[#1A1A1A] border border-[#2C2C2C] text-left">
            <div className="w-8 h-8 rounded-lg bg-[#FFA500]/20 flex items-center justify-center text-[#FFA500] shrink-0">
              <Trophy className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[13px] font-semibold text-[#F0EBE3]">+100 Coin Reward</div>
              <div className="text-[11px] text-[#9A9088] font-data">Added directly to your balance</div>
            </div>
          </div>
        </motion.div>

        {/* Continue Button */}
        <motion.button
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.5, ...SPRING_SETTLE }}
          whileTap={{ scale: 0.96 }}
          onClick={() => {
            sounds.playTargetLock();
            dismissLevelUp();
          }}
          className="w-full max-w-xs h-14 rounded-xl bg-[#FF4500] font-display text-[22px] tracking-wider text-[#F0EBE3]"
          style={{ boxShadow: GLOW_ORANGE }}
        >
          CONTINUE HUNTING →
        </motion.button>
      </motion.div>
    </AnimatePresence>
  );
};
