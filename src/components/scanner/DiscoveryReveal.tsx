import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Share2, ArrowRight, CheckCircle2 } from 'lucide-react';
import type { CarCard } from '../../types/apex';
import { RARITY_CONFIG } from '../../utils/rarity';
import { ApexCollectibleCard } from '../card/ApexCollectibleCard';
import { PostComposer } from './PostComposer';
import { sounds } from '../../utils/audio';
import confetti from 'canvas-confetti';
import { useApexStore } from '../../store/useApexStore';

interface DiscoveryRevealProps {
  card: CarCard;
  isDuplicate?: boolean;
  onContinueHunt: () => void;
  onClose: () => void;
}

export const DiscoveryReveal: React.FC<DiscoveryRevealProps> = ({
  card,
  isDuplicate = false,
  onContinueHunt,
  onClose,
}) => {
  const { dailyQuests, addCardToGarage } = useApexStore();
  const [revealStep, setRevealStep] = useState<number>(0); // 0: Match, 1: Make, 2: Model, 3: Specs, 4: Card
  const [showPostComposer, setShowPostComposer] = useState(false);
  const [isSavedToGarage, setIsSavedToGarage] = useState(false);

  const rarityConf = RARITY_CONFIG[card.rarity];
  const isMythic = card.rarity === 'mythic';
  const isLegendary = card.rarity === 'legendary';

  // Fast, satisfying identity assembly (~800ms total)
  useEffect(() => {
    const t1 = setTimeout(() => setRevealStep(1), 150); // Make
    const t2 = setTimeout(() => setRevealStep(2), 350); // Model
    const t3 = setTimeout(() => setRevealStep(3), 550); // Specs
    const t4 = setTimeout(() => {
      setRevealStep(4); // Full Card
      sounds.playRarityReveal(card.rarity);
      try {
        confetti({
          particleCount: isMythic ? 80 : isLegendary ? 50 : 30,
          spread: 70,
          origin: { y: 0.6 },
          colors: isMythic
            ? ['#FF2200', '#FFA500', '#C85000', '#E8A020']
            : [rarityConf.color, '#F0EBE3', '#FF4500']
        });
      } catch (e) {}
    }, 800);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
    };
  }, [card, isMythic, isLegendary, rarityConf]);

  const handleSaveToGarage = async () => {
    if (!isSavedToGarage) {
      sounds.playXpPop();
      await addCardToGarage(card);
      setIsSavedToGarage(true);
    }
  };

  return (
    <div className="relative flex-1 flex flex-col justify-between items-center p-6 text-center overflow-y-auto select-none bg-[#080808]">
      {/* Background ambient lighting */}
      <div
        className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full blur-3xl pointer-events-none opacity-30"
        style={{ background: rarityConf.color }}
      />

      {/* 1. Header Banner & Discovery Status */}
      <div className="relative z-10 pt-4 space-y-1 w-full max-w-sm">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-center gap-2"
        >
          <Sparkles className="w-4 h-4 text-[#FF4500]" />
          <span className="text-xs font-data font-bold tracking-[0.25em] text-[#FF4500] uppercase">
            {isDuplicate ? 'REPEAT OBSERVATION (+50 XP)' : 'NEW DISCOVERY CONFIRMED'}
          </span>
        </motion.div>

        {/* Progressive Identity Assembly Header */}
        <AnimatePresence mode="wait">
          {revealStep < 4 ? (
            <motion.div
              key="progressive-header"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="py-12 space-y-3"
            >
              {revealStep >= 1 && (
                <motion.span
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="font-data text-xl text-[#9A9088] uppercase tracking-widest block"
                >
                  {card.make} • {card.originCountry}
                </motion.span>
              )}

              {revealStep >= 2 && (
                <motion.h1
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="font-serif italic text-5xl text-white font-normal leading-none tracking-tight"
                >
                  {card.model}
                </motion.h1>
              )}

              {revealStep >= 3 && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center justify-center gap-4 text-xs font-data text-[#F0EBE3] pt-2"
                >
                  <span>{card.horsepower} HP</span>
                  <span>•</span>
                  <span>{card.topSpeedKmH} KM/H</span>
                  <span>•</span>
                  <span>{card.zeroToHundredSec}s 0-100</span>
                </motion.div>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="card-ready-header"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="pt-2"
            >
              <div className="flex items-center justify-center gap-2">
                <span className={`text-[10px] font-data font-bold px-2.5 py-0.5 rounded border uppercase ${rarityConf.badgeBg}`}>
                  {rarityConf.label} RARITY
                </span>
                <span className="text-[10px] font-data font-bold px-2 py-0.5 rounded bg-[#1A1A1A] text-[#9A9088] border border-white/10">
                  {card.cardNumber || '#APX-001'}
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* 2. 3D Collectible Card Stage */}
      {revealStep >= 4 && (
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ type: 'spring', stiffness: 260, damping: 20 }}
          className="relative z-10 my-4 flex justify-center w-full"
        >
          <ApexCollectibleCard card={card} showHolo={true} />
        </motion.div>
      )}

      {/* 3. Post-Discovery Hunter Objectives & Continuous Hunting Controls */}
      <div className="relative z-10 w-full max-w-sm space-y-3 pt-2 pb-6">
        
        {/* Active Hunter Objective Micro-Card */}
        {dailyQuests.length > 0 && (
          <div className="p-3 rounded-xl bg-[#111111]/90 border border-white/10 flex items-center justify-between text-left backdrop-blur-md">
            <div>
              <span className="text-[9px] font-data font-bold text-[#FF4500] uppercase tracking-wider block">
                ACTIVE HUNT OBJECTIVE
              </span>
              <span className="text-xs font-data text-[#F0EBE3] font-semibold block">
                {dailyQuests[0].title}
              </span>
            </div>
            <span className="text-xs font-data font-bold text-[#2ECC71] bg-[#2ECC71]/10 px-2 py-1 rounded border border-[#2ECC71]/30">
              {dailyQuests[0].currentCount} / {dailyQuests[0].targetCount} FOUND
            </span>
          </div>
        )}

        {/* Primary Action Button 1: CONTINUE HUNT (Immediate Camera Return) */}
        <motion.button
          onClick={async () => {
            await handleSaveToGarage();
            onContinueHunt();
          }}
          whileTap={{ scale: 0.97 }}
          className="w-full h-14 rounded-2xl bg-[#FF4500] text-white font-display text-2xl tracking-wider shadow-[0_4px_24px_rgba(255,69,0,0.4)] hover:bg-[#FF5500] transition-all flex items-center justify-center gap-2"
        >
          <span>CONTINUE HUNT</span>
          <ArrowRight className="w-5 h-5" />
        </motion.button>

        {/* Secondary Action Row: Share / Post to Feed */}
        <div className="flex gap-2.5">
          <button
            onClick={() => setShowPostComposer(true)}
            className="flex-1 h-11 rounded-xl bg-[#141414] border border-[#2C2C2C] text-[#F0EBE3] font-data text-xs font-bold tracking-wider hover:border-[#FF4500] transition-colors flex items-center justify-center gap-1.5"
          >
            <Share2 className="w-4 h-4 text-[#FF4500]" />
            <span>POST TO FEED</span>
          </button>

          <button
            onClick={async () => {
              await handleSaveToGarage();
              onClose();
            }}
            className="flex-1 h-11 rounded-xl bg-[#141414] border border-[#2C2C2C] text-[#F0EBE3] font-data text-xs font-bold tracking-wider hover:border-white/40 transition-colors flex items-center justify-center gap-1.5"
          >
            <CheckCircle2 className="w-4 h-4 text-[#2ECC71]" />
            <span>VIEW IN GARAGE</span>
          </button>
        </div>
      </div>

      {/* Post Composer Modal */}
      {showPostComposer && (
        <div className="fixed inset-0 z-50 bg-[#080808]">
          <PostComposer
            card={card}
            onBack={() => setShowPostComposer(false)}
            onPostComplete={() => {
              setShowPostComposer(false);
              onContinueHunt();
            }}
          />
        </div>
      )}
    </div>
  );
};
