import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { CarCard, RarityTier } from '../../types/apex';
import { RARITY_CONFIG } from '../../utils/rarity';
import { ApexCollectibleCard } from '../card/ApexCollectibleCard';
import { PostComposer } from './PostComposer';
import { sounds } from '../../utils/audio';
import confetti from 'canvas-confetti';

interface UnboxingRevealProps {
  card: CarCard;
  onComplete?: () => void;
}

// 11 Phases matching Section 8 of the APEX Specification
type RevealPhase =
  | 0 // Black out
  | 1 // Card materialises (face-down)
  | 2 // Rarity suspense ("SCANNING RARITY...", dots, border ring)
  | 3 // Rarity stamp ("LEGENDARY" / etc.)
  | 4 // Pre-crack shudder
  | 5 // Card splits horizontally
  | 6 // Energy streaks & ribbons
  | 9 // Pure white flash
  | 10 // Card flip to face-up + specular highlight
  | 11; // Face-up content + action buttons

export const UnboxingReveal: React.FC<UnboxingRevealProps> = ({ card, onComplete }) => {
  const [phase, setPhase] = useState<RevealPhase>(0);
  const [showPostComposer, setShowPostComposer] = useState(false);
  const [fireworkParticles, setFireworkParticles] = useState<Array<{ id: number; x: number; y: number; size: number; color: string }>>([]);
  const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const rarityConf = RARITY_CONFIG[card.rarity];
  const isMythic = card.rarity === 'mythic';
  const isLegendary = card.rarity === 'legendary';

  // Tier-specific streak counts & lengths
  const streakSpecs: Record<RarityTier, { count: number; color: string; reach: number; width: number }> = {
    common: { count: 14, color: '#787878', reach: 140, width: 1.5 },
    uncommon: { count: 20, color: '#3DAA6A', reach: 220, width: 2.0 },
    rare: { count: 26, color: '#E8A020', reach: 300, width: 2.5 },
    epic: { count: 32, color: '#C85000', reach: 380, width: 3.0 },
    legendary: { count: 38, color: '#FFA500', reach: 460, width: 3.5 },
    mythic: { count: 44, color: '#FF2200', reach: 520, width: 4.0 }
  };

  const currentStreak = streakSpecs[card.rarity];

  // Full suspenseful reveal sequence (~6.0s total)
  useEffect(() => {
    const safePlay = (fn: () => void) => {
      try { fn(); } catch (e) { console.warn('Audio play error:', e); }
    };

    const t1 = setTimeout(() => {
      safePlay(() => sounds.playShutter());
      setPhase(1);
    }, 300);

    const t2 = setTimeout(() => {
      setPhase(2);
    }, 1100);

    const t3 = setTimeout(() => {
      safePlay(() => sounds.playXpPop());
      setPhase(3);
    }, 2400);

    const t4 = setTimeout(() => {
      setPhase(4);
    }, 3400);

    const t5 = setTimeout(() => {
      safePlay(() => sounds.playTargetLock());
      setPhase(5);
    }, 3700);

    const t6 = setTimeout(() => {
      setPhase(6);
    }, 4100);

    const t7 = setTimeout(() => {
      setPhase(9);
    }, 4800);

    const t8 = setTimeout(() => {
      safePlay(() => sounds.playRarityReveal(card.rarity));
      setPhase(10);

      try {
        confetti({
          particleCount: isMythic ? 120 : isLegendary ? 80 : 50,
          spread: 80,
          origin: { y: 0.5 },
          colors: isMythic
            ? ['#FF2200', '#FFA500', '#C85000', '#E8A020', '#3DAA6A']
            : [rarityConf.color, '#F0EBE3', '#FF4500']
        });
      } catch (e) {
        console.warn('Confetti error:', e);
      }
    }, 4850);

    const t9 = setTimeout(() => {
      setPhase(11);
    }, 6000);

    timeoutsRef.current = [t1, t2, t3, t4, t5, t6, t7, t8, t9];

    return () => {
      timeoutsRef.current.forEach(clearTimeout);
    };
  }, [card, isMythic, isLegendary, rarityConf]);

  // Fireworks generator during Phases 6 to 11
  useEffect(() => {
    if (phase < 6) return;
    const interval = setInterval(() => {
      const newParticles = Array.from({ length: 8 }).map((_, i) => ({
        id: Date.now() + i,
        x: (Math.random() - 0.5) * 260,
        y: (Math.random() - 0.5) * 340,
        size: Math.random() * 5 + 3,
        color: isMythic
          ? ['#787878', '#3DAA6A', '#E8A020', '#C85000', '#FFA500', '#FF2200'][i % 6]
          : rarityConf.color
      }));
      setFireworkParticles(newParticles);
    }, 380);

    return () => clearInterval(interval);
  }, [phase, isMythic, rarityConf]);

  const handleSavePrivately = () => {
    sounds.playTargetLock();
    if (onComplete) onComplete();
  };

  return (
    <div
      onClick={() => {
        if (phase < 11 && !showPostComposer) {
          timeoutsRef.current.forEach(clearTimeout);
          setPhase(11);
          
          if (phase < 10) {
            try { sounds.playRarityReveal(card.rarity); } catch (e) {}
            try {
              confetti({
                particleCount: isMythic ? 120 : isLegendary ? 80 : 50,
                spread: 80,
                origin: { y: 0.5 },
                colors: isMythic
                  ? ['#FF2200', '#FFA500', '#C85000', '#E8A020', '#3DAA6A']
                  : [rarityConf.color, '#F0EBE3', '#FF4500']
              });
            } catch (e) {}
          }
        }
      }}
      className="fixed inset-0 z-50 bg-[#080808] flex flex-col items-center justify-center overflow-hidden select-none cursor-pointer"
      style={{ fontFamily: 'DM Sans' }}
    >
      
      {/* PHASE 9: PURE WHITE FLASH (55ms on, 100ms hold, 340ms fade) */}
      <AnimatePresence>
        {phase === 9 && (
          <motion.div
            initial={{ opacity: 1 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.34 }}
            className="fixed inset-0 z-50 bg-white"
          />
        )}
      </AnimatePresence>

      {/* POST COMPOSER SCREEN OVERLAY */}
      <AnimatePresence>
        {showPostComposer && (
          <PostComposer
            card={card}
            onBack={() => setShowPostComposer(false)}
            onPostComplete={() => {
              setShowPostComposer(false);
              if (onComplete) onComplete();
            }}
          />
        )}
      </AnimatePresence>

      {/* PHASE 6-11: RIBBON AURORAS TRAILING BEHIND CARD */}
      {phase >= 6 && !showPostComposer && (
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center overflow-hidden">
          <div
            style={{ borderColor: rarityConf.color }}
            className="w-[460px] h-[460px] rounded-full border-2 border-dashed opacity-35 animate-[spin_4s_linear_infinite] shadow-[0_0_60px_rgba(255,255,255,0.15)]"
          />
          {isMythic && (
            <div className="absolute inset-0 bg-[conic-gradient(from_0deg,transparent_0%,rgba(255,34,0,0.4)_30%,rgba(255,165,0,0.5)_50%,rgba(255,34,0,0.4)_70%,transparent_100%)] animate-[spin_2.5s_linear_infinite]" />
          )}
        </div>
      )}

      {/* PHASE 6-11: FIREWORKS SPARKLES */}
      {phase >= 6 && !showPostComposer && (
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
          {fireworkParticles.map((p) => (
            <motion.div
              key={p.id}
              initial={{ opacity: 1, scale: 0.3, x: 0, y: 0 }}
              animate={{ opacity: 0, scale: 1.4, x: p.x, y: p.y - 30 }}
              transition={{ duration: 0.7, ease: 'easeOut' }}
              style={{
                width: `${p.size}px`,
                height: `${p.size}px`,
                backgroundColor: p.color,
                boxShadow: `0 0 10px ${p.color}`
              }}
              className="absolute rounded-full"
            />
          ))}
        </div>
      )}

      {/* PHASE 6: RADIAL ENERGY STREAKS FIRING OUTWARD */}
      {phase === 6 && (
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
          {Array.from({ length: currentStreak.count }).map((_, i) => {
            const angle = (360 / currentStreak.count) * i;
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, scale: 0.1 }}
                animate={{ opacity: [0, 1, 0.8, 0], scale: [0.2, 1.5, 2.0, 0.4] }}
                transition={{ duration: 1.2, ease: 'easeOut' }}
                style={{
                  transform: `rotate(${angle}deg)`,
                  width: `${currentStreak.reach}px`,
                  background: isMythic
                    ? `linear-gradient(90deg, #787878, #3DAA6A, #E8A020, #C85000, #FFA500, #FF2200, transparent)`
                    : `linear-gradient(90deg, ${currentStreak.color}, transparent)`
                }}
                className="h-[2px] rounded-full absolute shadow-[0_0_20px_rgba(255,255,255,0.9)]"
              />
            );
          })}
        </div>
      )}

      {/* MAIN CARD CONTAINER */}
      {!showPostComposer && (
        <div className="relative flex flex-col items-center justify-center" style={{ perspective: '1000px' }}>
          
          {/* PHASE 2 & 3: RARITY SUSPENSE / RARITY STAMP HEADLINE */}
          {phase >= 2 && phase < 9 && (
            <div className="absolute -top-20 inset-x-0 flex flex-col items-center z-30">
              {phase === 2 && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: [0.4, 0.9, 0.4] }} transition={{ duration: 0.9, repeat: Infinity }} className="flex flex-col items-center gap-2">
                  <span className="text-[11px] font-medium tracking-[3px] text-[#9A9088]">
                    SCANNING RARITY...
                  </span>
                  <div className="flex gap-2">
                    {[0, 1, 2].map((dot) => (
                      <motion.div
                        key={dot}
                        animate={{ y: [0, -8, 0] }}
                        transition={{ duration: 0.6, repeat: Infinity, delay: dot * 0.18 }}
                        className="w-2 h-2 rounded-full bg-[#9A9088]"
                      />
                    ))}
                  </div>
                </motion.div>
              )}

              {phase >= 3 && (
                <motion.h2
                  initial={{ scale: 2.8, opacity: 0 }}
                  animate={{ scale: 1.0, opacity: 1 }}
                  transition={{ type: 'spring', damping: 16, stiffness: 100 }}
                  style={{ color: rarityConf.color, textShadow: `0 0 30px ${rarityConf.color}` }}
                  className="font-display text-[52px] leading-none tracking-widest uppercase"
                >
                  {rarityConf.label}
                </motion.h2>
              )}
            </div>
          )}

          {/* FACE-DOWN TRADING CARD (Phases 1 through 5) */}
          {phase < 9 ? (
            <motion.div
              initial={{ scale: 0.55, opacity: 0, y: 100 }}
              animate={
                phase === 1
                  ? { scale: 1.0, opacity: 1, y: 0 }
                  : phase === 4
                  ? { x: [6, -6, 4, -4, 2, 0], scale: 1.0, opacity: 1, y: 0 }
                  : { scale: 1.0, opacity: 1, y: 0 }
              }
              transition={
                phase === 1
                  ? { type: 'spring', damping: 18, stiffness: 90, mass: 1.4 }
                  : phase === 4
                  ? { duration: 0.27 }
                  : { duration: 0.4 }
              }
              style={{
                boxShadow: phase >= 3 ? `0 20px 60px ${rarityConf.color}66` : '0 20px 60px rgba(0,0,0,0.8)'
              }}
              className={`relative w-[320px] h-[448px] rounded-[16px] overflow-hidden flex flex-col items-center justify-center p-6 text-center select-none ${
                phase >= 5 ? 'bg-transparent border-none' : 'bg-[#111111] border border-[#2C2C2C]'
              }`}
            >
              {/* Rarity Ring overlay (Phase 2+) */}
              {phase >= 2 && (
                <motion.div
                  initial={{ scale: 1.6, opacity: 0 }}
                  animate={{ scale: 1.0, opacity: 1 }}
                  transition={{ type: 'spring', damping: 10, stiffness: 280 }}
                  style={{ borderColor: rarityConf.color }}
                  className="absolute inset-0 border-2 rounded-[16px] pointer-events-none"
                />
              )}

              {/* Phase 5: Card Split animation */}
              {phase >= 5 ? (
                <div className="absolute inset-0 flex flex-col justify-between overflow-hidden">
                  {/* Top half split */}
                  <motion.div
                    initial={{ rotateX: 0 }}
                    animate={{ rotateX: -90, y: -60, opacity: 0 }}
                    transition={{ duration: 0.8, ease: [0.4, 0, 0, 1] }}
                    style={{ transformOrigin: 'bottom center' }}
                    className="w-full h-1/2 bg-[#111111] border-b border-white flex items-end justify-center pb-4"
                  >
                    <span className="font-display text-4xl text-[#9A9088]">APEX</span>
                  </motion.div>

                  {/* Bottom half split */}
                  <motion.div
                    initial={{ rotateX: 0 }}
                    animate={{ rotateX: 90, y: 60, opacity: 0 }}
                    transition={{ duration: 0.8, ease: [0.4, 0, 0, 1] }}
                    style={{ transformOrigin: 'top center' }}
                    className="w-full h-1/2 bg-[#111111] border-t border-white flex items-start justify-center pt-4"
                  >
                    <span className="font-display text-4xl text-[#9A9088]">APEX</span>
                  </motion.div>

                  {/* Center Crack Line */}
                  <div
                    style={{
                      boxShadow: `0 0 8px white, 0 0 30px ${rarityConf.color}, 0 0 80px ${rarityConf.color}`
                    }}
                    className="absolute top-1/2 inset-x-0 h-[2px] bg-white z-20"
                  />
                </div>
              ) : (
                /* Carbon Weave Face-Down Backing */
                <div className="space-y-4">
                  <div className="w-20 h-20 rounded-2xl bg-[#1A1A1A] border border-[#2C2C2C] flex items-center justify-center font-display text-5xl text-[#F0EBE3] shadow-lg mx-auto">
                    A
                  </div>
                  <div>
                    <h3 className="font-display text-4xl text-[#F0EBE3] tracking-widest">APEX</h3>
                    <p className="text-[11px] font-data text-[#9A9088] uppercase tracking-wider mt-1">
                      COLLECTIBLE CARD
                    </p>
                  </div>
                </div>
              )}
            </motion.div>
          ) : (
            /* PHASES 10 & 11: REVEALED FACE-UP APEX COLLECTIBLE CARD */
            <motion.div
              initial={{ rotateY: 180 }}
              animate={{ rotateY: 0 }}
              transition={{ duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
              className="flex flex-col items-center space-y-6 z-20 relative"
            >
              {/* Specular Highlight Sweep (Phase 10 light bounce) */}
              <motion.div
                initial={{ x: '100%', opacity: 0 }}
                animate={{ x: '-100%', opacity: [0, 0.65, 0] }}
                transition={{ duration: 0.6 }}
                className="absolute inset-0 pointer-events-none rounded-2xl bg-gradient-to-r from-transparent via-white/40 to-transparent z-30"
              />

              {/* Main Collectible Card */}
              <ApexCollectibleCard card={card} showHolo={true} />

              {/* PHASE 11: ACTION BUTTONS ("SAVE PRIVATELY" and "POST TO APEX →") */}
              {phase >= 11 && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                  className="flex items-center gap-3 w-full max-w-[320px]"
                >
                  {/* Save Privately Ghost Button */}
                  <button
                    onClick={handleSavePrivately}
                    className="flex-1 h-13 rounded-xl border border-[#2C2C2C] bg-[#111111] hover:bg-[#1A1A1A] text-[#F0EBE3] font-display text-lg tracking-wider transition-all"
                  >
                    SAVE PRIVATELY
                  </button>

                  {/* Post to Apex Ignition CTA */}
                  <button
                    onClick={() => {
                      sounds.playTargetLock();
                      setShowPostComposer(true);
                    }}
                    className="flex-1 h-13 rounded-xl bg-[#FF4500] hover:bg-[#FF6A00] text-[#F0EBE3] font-display text-lg tracking-wider glow-orange transition-all flex items-center justify-center gap-1"
                  >
                    POST TO APEX →
                  </button>
                </motion.div>
              )}
            </motion.div>
          )}

        </div>
      )}

    </div>
  );
};
