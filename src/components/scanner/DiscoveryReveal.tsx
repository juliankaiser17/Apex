import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Share2, Check, Camera, AlertCircle } from 'lucide-react';
import type { CarCard } from '../../types/apex';
import { RARITY_CONFIG } from '../../utils/rarity';
import { ApexCollectibleCard } from '../card/ApexCollectibleCard';
import { PostComposer } from './PostComposer';
import { sounds } from '../../utils/audio';
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
}) => {
  const { addCardToGarage, setScannerOpen, setActiveTab } = useApexStore();
  const [revealStep, setRevealStep] = useState<number>(0);
  const [showPostComposer, setShowPostComposer] = useState(false);

  const rarityConf = RARITY_CONFIG[card.rarity] || RARITY_CONFIG.rare;
  const status = card.identificationStatus || 'identified';
  const isUncertain = status === 'uncertain';
  const isProbable = status === 'probable';

  useEffect(() => {
    const t1 = setTimeout(() => setRevealStep(1), 150);
    const t2 = setTimeout(() => setRevealStep(2), 350);
    const t3 = setTimeout(() => setRevealStep(3), 550);
    const t4 = setTimeout(() => {
      setRevealStep(4);
      sounds.playRarityReveal(card.rarity);
    }, 700);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
    };
  }, [card]);

  return (
    <div className="absolute inset-0 z-50 bg-black flex flex-col justify-between items-center pt-[calc(var(--sat,28px)+12px)] pb-[calc(var(--sab,16px)+16px)] px-4 text-center select-none font-sans overflow-y-auto">
      {/* Background Ambience */}
      <div className="absolute inset-0 bg-radial-vignette pointer-events-none opacity-40" />

      {/* Top Banner with Explicit Confidence State */}
      <div className="relative z-10 pt-2 space-y-1 w-full max-w-sm">
        <div className="flex items-center justify-center gap-1.5">
          {isUncertain ? (
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/25 text-amber-400 text-xs font-semibold uppercase tracking-wider">
              <AlertCircle className="w-3 h-3" />
              <span>UNCERTAIN • VARIANT UNCONFIRMED</span>
            </div>
          ) : isProbable ? (
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-sky-500/10 border border-sky-500/25 text-sky-400 text-xs font-semibold uppercase tracking-wider">
              <div className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-pulse" />
              <span>PROBABLE • LIKELY IDENTIFICATION</span>
            </div>
          ) : (
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 text-xs font-semibold uppercase tracking-wider">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span>IDENTIFIED • HIGH CONFIDENCE</span>
            </div>
          )}
        </div>

        {isDuplicate && (
          <div className="text-[11px] font-semibold tracking-wider text-[#E50914] uppercase pt-0.5">
            Repeat Spot (+50 XP)
          </div>
        )}

        {/* Progressive Header Assembly */}
        <AnimatePresence mode="wait">
          {revealStep < 4 ? (
            <motion.div
              key="progressive-header"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="py-10 space-y-2"
            >
              {revealStep >= 1 && (
                <span className="text-sm font-medium text-white/50 uppercase tracking-wider block">
                  {card.make} • {card.originCountry || 'Global'}
                </span>
              )}

              {revealStep >= 2 && (
                <h1 className="text-3xl font-bold text-white tracking-tight leading-tight">
                  {card.model}
                </h1>
              )}

              {revealStep >= 3 && (
                <div className="flex items-center justify-center gap-2 pt-2">
                  <span className={`text-xs font-semibold px-3 py-1 rounded-full border ${rarityConf.badgeBg}`}>
                    {rarityConf.label}
                  </span>
                  <span className="text-xs font-semibold text-white/80 bg-white/[0.06] px-3 py-1 rounded-full border border-white/[0.08]">
                    {card.horsepower ? `${card.horsepower} hp` : 'Verified Specs'}
                  </span>
                </div>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="final-header"
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-0.5 pt-1"
            >
              <h2 className="text-2xl font-bold text-white tracking-tight">
                {card.make} {card.model}
                {card.trim ? ` ${card.trim}` : ''}
              </h2>
              <p className="text-xs text-white/50 font-medium">
                {isUncertain ? (
                  <span className="text-amber-400/90 font-semibold">
                    {card.identificationReason || 'Specific trim unverified from visible angle'}
                  </span>
                ) : (
                  `${card.bodyStyle || 'Coupe'} • ${card.originCountry || 'Global'}`
                )}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* 2. Collectible Card Presentation */}
      <div className="relative z-10 my-4 flex items-center justify-center w-full max-w-sm">
        <AnimatePresence>
          {revealStep === 4 && (
            <motion.div
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', damping: 20, stiffness: 260 }}
              className="relative"
            >
              <ApexCollectibleCard
                card={card}
                size="md"
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* 3. Actions */}
      <AnimatePresence>
        {revealStep === 4 && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative z-10 w-full max-w-sm space-y-2 pb-6"
          >
            {isUncertain && (
              <button
                onClick={onContinueHunt}
                className="w-full py-3.5 px-6 rounded-2xl bg-amber-500 hover:bg-amber-600 text-black font-bold text-base tracking-tight flex items-center justify-center gap-2 transition-colors shadow-lg"
              >
                <Camera className="w-4 h-4 text-black" />
                <span>Try Another Angle for Exact Trim</span>
              </button>
            )}

            <button
              onClick={() => setShowPostComposer(true)}
              className={`w-full py-3.5 px-6 rounded-2xl ${
                isUncertain
                  ? 'bg-[#181818] hover:bg-[#222222] border border-white/10 text-white font-medium text-sm'
                  : 'bg-[#E50914] hover:bg-[#DC2626] text-white font-semibold text-base shadow-lg'
              } tracking-tight flex items-center justify-center gap-2 transition-colors`}
            >
              <Share2 className="w-4 h-4" />
              <span>Share to Community Feed</span>
            </button>

            <button
              onClick={() => {
                addCardToGarage(card);
                setScannerOpen(false);
                setActiveTab('garage');
              }}
              className="w-full py-3 px-6 rounded-2xl bg-[#181818] hover:bg-[#202020] border border-white/[0.1] text-white font-medium text-sm flex items-center justify-center gap-2 transition-colors"
            >
              <Check className="w-4 h-4 text-[#E50914]" />
              <span>Save to Garage</span>
            </button>

            {!isUncertain && (
              <button
                onClick={onContinueHunt}
                className="text-xs font-medium text-white/50 hover:text-white pt-1 transition-colors"
              >
                Continue Scanning →
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Post Composer Modal */}
      <AnimatePresence>
        {showPostComposer && (
          <PostComposer
            card={card}
            onClose={() => setShowPostComposer(false)}
            onPosted={() => {
              setShowPostComposer(false);
              setScannerOpen(false);
              setActiveTab('social');
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
};
