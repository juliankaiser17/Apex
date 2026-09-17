import React, { useEffect, useRef } from 'react';
import { Zap, Trophy } from 'lucide-react';
import { useApexStore } from '../../store/useApexStore';
import { GLOW_ORANGE } from '../../utils/animationConfig';
import { sounds } from '../../utils/audio';
import { hapticImpact } from '../../utils/haptics';
import { ConfettiCelebration, type ConfettiCelebrationRef } from './ConfettiCelebration';

export const LevelUpModal: React.FC = () => {
  const levelUpLevel = useApexStore(s => s.levelUpLevel);
  const dismissLevelUp = useApexStore(s => s.dismissLevelUp);
  const confettiRef = useRef<ConfettiCelebrationRef | null>(null);

  useEffect(() => {
    if (levelUpLevel) {
      hapticImpact('heavy');
      sounds.playXpPop();
      confettiRef.current?.trigger();
    }
  }, [levelUpLevel]);

  if (!levelUpLevel) return null;

  return (
    <div
      className="fixed inset-0 z-[999] bg-[#080808]/95 flex flex-col items-center justify-center p-6 text-center select-none animate-fadeIn"
      style={{ fontFamily: 'DM Sans', contain: 'content', willChange: 'opacity' }}
    >
      {/* Ambient Orange Underglow (Clean gradient, zero blur overhead) */}
      <div 
        className="absolute w-72 h-72 rounded-full pointer-events-none opacity-40"
        style={{
          background: 'radial-gradient(circle, rgba(255,69,0,0.2) 0%, transparent 70%)',
        }}
      />

      {/* Level Up Headline */}
      <h1 className="font-display text-[64px] text-[#F0EBE3] tracking-[6px] leading-none drop-shadow-2xl animate-slideDown">
        LEVEL UP!
      </h1>

      {/* Giant Level Indicator */}
      <div className="my-6 relative animate-scalePop">
        <div 
          className="w-32 h-32 rounded-full bg-[#111111] border-2 border-[#FF4500] flex flex-col items-center justify-center relative z-10"
          style={{ boxShadow: GLOW_ORANGE }}
        >
          <span className="text-[10px] font-data font-semibold text-[#FF4500] tracking-widest uppercase">
            LEVEL
          </span>
          <span className="font-display text-[58px] text-[#F0EBE3] leading-none">
            {levelUpLevel}
          </span>
        </div>
        <div className="absolute -inset-1 rounded-full border border-[#FF4500]/30 pointer-events-none" />
      </div>

      {/* Milestone Unlocks */}
      <div className="space-y-2 max-w-xs w-full mb-8 animate-slideUp">
        <div className="flex items-center gap-3 p-3 rounded-2xl bg-[#161616] border border-white/10 text-left">
          <div className="w-8 h-8 rounded-xl bg-[#FF4500]/20 flex items-center justify-center text-[#FF4500] shrink-0">
            <Zap className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[13px] font-semibold text-[#F0EBE3]">Hunter Rank Promoted</div>
            <div className="text-[11px] text-[#9A9088] font-data">Higher discovery multiplier</div>
          </div>
        </div>

        <div className="flex items-center gap-3 p-3 rounded-2xl bg-[#161616] border border-white/10 text-left">
          <div className="w-8 h-8 rounded-xl bg-[#FFA500]/20 flex items-center justify-center text-[#FFA500] shrink-0">
            <Trophy className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[13px] font-semibold text-[#F0EBE3]">+100 Coin Reward</div>
            <div className="text-[11px] text-[#9A9088] font-data">Added directly to your balance</div>
          </div>
        </div>
      </div>

      {/* Continue Button */}
      <button
        onClick={() => {
          sounds.playTargetLock();
          dismissLevelUp();
        }}
        className="w-full max-w-xs h-13 py-3 rounded-2xl bg-[#FF4500] font-display text-[20px] tracking-wider text-[#F0EBE3] active:scale-95 transition-transform animate-slideUp cursor-pointer shadow-xl"
        style={{ boxShadow: GLOW_ORANGE }}
      >
        CONTINUE HUNTING →
      </button>

      {/* Isolated high-performance canvas celebration */}
      <ConfettiCelebration ref={confettiRef} />
    </div>
  );
};
