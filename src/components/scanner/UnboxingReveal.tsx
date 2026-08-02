import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { CarCard, RarityTier } from '../../types/apex';
import { RARITY_CONFIG } from '../../utils/rarity';
import { ApexCollectibleCard } from '../card/ApexCollectibleCard';
import { sounds } from '../../utils/audio';
import confetti from 'canvas-confetti';

interface UnboxingRevealProps {
  card: CarCard;
  onComplete?: () => void;
}

export const UnboxingReveal: React.FC<UnboxingRevealProps> = ({ card, onComplete }) => {
  // Stages:
  // 1. 'materializing': scale 0.4x -> 1.0x (900ms easeOutBack)
  // 2. 'dramatic_pause': idle float (1.2s pause)
  // 3. 'splitting': 600ms heavy vault door split + energy streaks fire
  // 4. 'flash': 150ms pure white flash
  // 5. 'revealed': face-up card + ribbons & fireworks trailing
  const [stage, setStage] = useState<'materializing' | 'dramatic_pause' | 'splitting' | 'flash' | 'revealed'>('materializing');
  const [showFireworks, setShowFireworks] = useState(false);
  const [fireworkParticles, setFireworkParticles] = useState<Array<{ id: number; x: number; y: number; size: number; color: string }>>([]);

  const rarityConf = RARITY_CONFIG[card.rarity];
  const isMythic = card.rarity === 'mythic';

  // Tier-specific energy streak specs
  const streakSpecs: Record<RarityTier, { color: string; reach: number; durationMs: number; ribbonSpeed: string }> = {
    common: { color: '#8B8B8B', reach: 100, durationMs: 1000, ribbonSpeed: '4s' },
    uncommon: { color: '#4CAF50', reach: 180, durationMs: 1200, ribbonSpeed: '3.2s' },
    rare: { color: '#2196F3', reach: 260, durationMs: 1400, ribbonSpeed: '2.5s' },
    epic: { color: '#9C27B0', reach: 320, durationMs: 1600, ribbonSpeed: '2s' },
    legendary: { color: '#FF9800', reach: 400, durationMs: 1800, ribbonSpeed: '1.8s' },
    mythic: { color: '#FF1744', reach: 500, durationMs: 2200, ribbonSpeed: '1.5s' }
  };

  const currentStreak = streakSpecs[card.rarity];

  // Automated Timeline Sequence
  useEffect(() => {
    // 0ms: Play low deep haptic thud for materialization
    sounds.playShutter();

    // 900ms: Materialization complete -> enter 1.2s dramatic pause
    const pauseTimer = setTimeout(() => {
      setStage('dramatic_pause');
    }, 900);

    // 2100ms (900ms + 1200ms pause): Automatic reveal starts -> heavy vault split (600ms) & energy burst
    const splitTimer = setTimeout(() => {
      sounds.playCardFlip();
      setStage('splitting');
      setShowFireworks(true);
    }, 2100);

    // 3200ms (1100ms after split start): Peak intensity -> Pure White Flash (150ms)
    const flashTimer = setTimeout(() => {
      sounds.playRarityReveal(card.rarity);
      setStage('flash');

      // Trigger celebratory burst
      confetti({
        particleCount: isMythic ? 140 : 80,
        spread: 90,
        origin: { y: 0.55 }
      });
    }, 3200);

    // 3350ms (after white flash): Reveal face-up collectible card automatically
    const revealTimer = setTimeout(() => {
      setStage('revealed');
    }, 3350);

    // Stop fireworks 2.5s after reveal
    const fireworkStopTimer = setTimeout(() => {
      setShowFireworks(false);
    }, 5850);

    return () => {
      clearTimeout(pauseTimer);
      clearTimeout(splitTimer);
      clearTimeout(flashTimer);
      clearTimeout(revealTimer);
      clearTimeout(fireworkStopTimer);
    };
  }, [card]);

  // Firework starburst generator loop
  useEffect(() => {
    if (!showFireworks) return;
    const interval = setInterval(() => {
      const newParticles = Array.from({ length: 8 }).map((_, i) => ({
        id: Date.now() + i,
        x: (Math.random() - 0.5) * 240,
        y: (Math.random() - 0.5) * 320,
        size: Math.random() * 6 + 3,
        color: isMythic
          ? ['#8B8B8B', '#4CAF50', '#2196F3', '#9C27B0', '#FF9800'][i % 5]
          : rarityConf.color
      }));
      setFireworkParticles(newParticles);
    }, 350);

    return () => clearInterval(interval);
  }, [showFireworks, isMythic, rarityConf]);

  return (
    <div className="fixed inset-0 z-50 bg-[#0A0A0A] flex flex-col items-center justify-center overflow-hidden select-none">
      {/* 1. PURE WHITE SCREEN FLASH (150ms bleaching flash, 250ms fade out) */}
      <AnimatePresence>
        {stage === 'flash' && (
          <motion.div
            initial={{ opacity: 1 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="fixed inset-0 z-50 bg-white"
          />
        )}
      </AnimatePresence>

      {/* 2. BACKWARD-FLOWING COLOR RIBBON AURORAS */}
      {(stage === 'splitting' || stage === 'revealed') && (
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center overflow-hidden">
          {/* Continuous looping auroras trailing behind card */}
          <div
            style={{
              animationDuration: currentStreak.ribbonSpeed,
              borderColor: rarityConf.color
            }}
            className="w-[480px] h-[480px] rounded-full border-2 border-dashed opacity-40 animate-[spin_linear_infinite] shadow-[0_0_80px_rgba(255,255,255,0.2)]"
          />

          {/* Mythic Prismatic Aurora overlay */}
          {isMythic && (
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,23,68,0.35)_0%,rgba(156,39,176,0.3)_30%,rgba(33,150,243,0.25)_60%,transparent_80%)] animate-[spin_3s_linear_infinite]" />
          )}
        </div>
      )}

      {/* 3. SURROUNDING STARBURST FIREWORKS (3-5 bursts/sec, 6-10 particles) */}
      {showFireworks && (
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
          {fireworkParticles.map((p) => (
            <motion.div
              key={p.id}
              initial={{ opacity: 1, scale: 0.3, x: 0, y: 0 }}
              animate={{
                opacity: 0,
                scale: 1.5,
                x: p.x,
                y: p.y - 40
              }}
              transition={{ duration: 0.7, ease: 'easeOut' }}
              style={{
                width: `${p.size}px`,
                height: `${p.size}px`,
                backgroundColor: p.color,
                boxShadow: `0 0 12px ${p.color}`
              }}
              className="absolute rounded-full"
            />
          ))}
        </div>
      )}

      {/* 4. RADIAL ENERGY STREAKS FIRING OUTWARD */}
      {stage === 'splitting' && (
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
          {Array.from({ length: 16 }).map((_, i) => {
            const angle = i * 22.5;
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, scale: 0.1 }}
                animate={{ opacity: [0, 1, 0.9, 0], scale: [0.2, 1.6, 2.0, 0.4] }}
                transition={{ duration: currentStreak.durationMs / 1000, ease: 'easeOut' }}
                style={{
                  transform: `rotate(${angle}deg)`,
                  width: `${currentStreak.reach}px`,
                  background: isMythic
                    ? `linear-gradient(90deg, #8b8b8b, #4caf50, #2196f3, #9c27b0, #ff9800, transparent)`
                    : `linear-gradient(90deg, ${currentStreak.color}, transparent)`
                }}
                className="h-2 rounded-full absolute shadow-[0_0_24px_rgba(255,255,255,0.9)]"
              />
            );
          })}
        </div>
      )}

      {/* 5. FACE-DOWN CARD vs REVEALED CARD STAGES */}
      {stage !== 'revealed' ? (
        <div className="relative perspective-1000 flex flex-col items-center justify-center">
          {/* FACE-DOWN CARBON-FIBER CARD */}
          <motion.div
            initial={{ scale: 0.4 }}
            animate={
              stage === 'materializing'
                ? { scale: 1.0, y: 0 }
                : stage === 'dramatic_pause'
                ? { y: [0, -8, 0], rotateY: 10, scale: 1.0 }
                : { y: 0, rotateY: 0, scale: 1.05 }
            }
            transition={
              stage === 'materializing'
                ? { duration: 0.9, ease: [0.175, 0.885, 0.32, 1.275] } // easeOutBack curve
                : stage === 'dramatic_pause'
                ? { y: { repeat: Infinity, duration: 3, ease: 'easeInOut' } }
                : { duration: 0.6 }
            }
            style={{
              boxShadow: `0 20px 50px ${rarityConf.color}44`
            }}
            className="relative w-[320px] h-[448px] rounded-[16px] overflow-hidden border-2 border-white/20 bg-carbon-dense shadow-2xl flex flex-col items-center justify-center p-6 text-center"
          >
            {/* Heavy Vault-Door Split (Top & Bottom halves hinging open over 600ms) */}
            {stage === 'splitting' ? (
              <div className="absolute inset-0 flex flex-col justify-between overflow-hidden">
                {/* Top Half Split (hinges upward -75deg over 600ms) */}
                <motion.div
                  initial={{ y: 0, rotateX: 0 }}
                  animate={{ y: -180, rotateX: -75, opacity: 0 }}
                  transition={{ duration: 0.6, ease: 'easeInOut' }}
                  className="w-full h-1/2 bg-carbon border-b-2 border-[#FF5500] flex items-end justify-center pb-3"
                >
                  <div className="w-16 h-16 rounded-2xl bg-[#FF5500]/20 border border-[#FF5500] flex items-center justify-center font-display text-4xl text-[#FF5500]">
                    A
                  </div>
                </motion.div>

                {/* Bottom Half Split (hinges downward 75deg over 600ms) */}
                <motion.div
                  initial={{ y: 0, rotateX: 0 }}
                  animate={{ y: 180, rotateX: 75, opacity: 0 }}
                  transition={{ duration: 0.6, ease: 'easeInOut' }}
                  className="w-full h-1/2 bg-carbon border-t-2 border-[#FF5500] flex items-start justify-center pt-3"
                >
                  <span className="font-display text-2xl tracking-widest text-slate-400">APEX</span>
                </motion.div>
              </div>
            ) : (
              /* Face-Down Carbon Fiber Back with Muted Silver APEX Emblem */
              <div className="space-y-4">
                <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-slate-700 via-slate-800 to-slate-900 border border-white/20 flex items-center justify-center font-display text-5xl text-slate-300 shadow-[0_0_30px_rgba(255,255,255,0.15)] mx-auto">
                  A
                </div>

                <div>
                  <h3 className="font-display text-4xl text-white tracking-widest">APEX</h3>
                  <p className="text-xs font-mono text-orange-400 tracking-wider mt-1 uppercase">
                    {rarityConf.label} COLLECTIBLE CARD
                  </p>
                </div>
              </div>
            )}
          </motion.div>
        </div>
      ) : (
        /* 6. REVEALED FACE-UP APEX COLLECTIBLE CARD */
        <motion.div
          initial={{ opacity: 0, scale: 0.8, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          className="flex flex-col items-center space-y-6 z-20"
        >
          {/* Main Portrait Card with 58% photo, 6-stat grid & location footer */}
          <ApexCollectibleCard card={card} showHolo={true} />

          {/* Add to Garage CTA */}
          <button
            onClick={() => {
              sounds.playTargetLock();
              if (onComplete) onComplete();
            }}
            className="py-3.5 px-10 rounded-2xl bg-gradient-to-r from-orange-600 via-[#FF5500] to-amber-500 text-white font-display text-2xl tracking-wider shadow-[0_0_30px_rgba(255,85,0,0.6)] hover:scale-105 active:scale-95 transition-all border border-orange-400/50"
          >
            ADD TO GARAGE
          </button>
        </motion.div>
      )}
    </div>
  );
};
