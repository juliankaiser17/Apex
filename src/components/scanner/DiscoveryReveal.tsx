import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Share2, Check, Camera, AlertCircle } from 'lucide-react';
import type { CarCard, RarityTier } from '../../types/apex';
import { RARITY_CONFIG } from '../../utils/rarity';
import { ApexCollectibleCard } from '../card/ApexCollectibleCard';
import { ApexVehicleSpecsSection } from '../card/ApexVehicleSpecsSection';
import { PostComposer } from './PostComposer';
import { sounds } from '../../utils/audio';
import { useApexStore } from '../../store/useApexStore';
import { featureFlags } from '../../utils/featureFlags';

export interface RevealTierTiming {
  totalDurationMs: number;
  step1Ms: number;
  step2Ms: number;
  step3Ms: number;
  step4Ms: number;
}

// Tier-scaled reveal timings mandated by Appendix A Decision 2
export const REVEAL_TIER_TIMINGS: Record<string, RevealTierTiming> = {
  common: { totalDurationMs: 1600, step1Ms: 150, step2Ms: 400, step3Ms: 800, step4Ms: 1600 },
  uncommon: { totalDurationMs: 2200, step1Ms: 200, step2Ms: 600, step3Ms: 1100, step4Ms: 2200 },
  rare: { totalDurationMs: 3000, step1Ms: 250, step2Ms: 800, step3Ms: 1500, step4Ms: 3000 },
  epic: { totalDurationMs: 3800, step1Ms: 300, step2Ms: 1000, step3Ms: 1900, step4Ms: 3800 },
  legendary: { totalDurationMs: 4800, step1Ms: 400, step2Ms: 1300, step3Ms: 2400, step4Ms: 4800 },
  mythic: { totalDurationMs: 6000, step1Ms: 500, step2Ms: 1600, step3Ms: 3000, step4Ms: 6000 },
};

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
  if (import.meta.env.DEV) {
    console.log('[Apex Diagnostic Log] UI Render:', {
      cardId: card.id,
      canonicalId: (card as any).canonicalVehicleId || `${card.make}-${card.model}`.toLowerCase(),
      imageAssetId: card.imageHash || (card.imageUrl?.startsWith('data:') ? card.imageUrl.slice(0, 32) + '...' : card.imageUrl),
      renderedCanonicalId: (card as any).canonicalVehicleId || `${card.make}-${card.model}`.toLowerCase()
    });
  }
  const { addCardToGarage, setScannerOpen, setActiveTab } = useApexStore();
  const [revealStep, setRevealStep] = useState<number>(0);
  const [showPostComposer, setShowPostComposer] = useState(false);
  const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const rarityConf = RARITY_CONFIG[card.rarity] || RARITY_CONFIG.rare;
  const status = card.identificationStatus || 'identified';
  const isUncertain = status === 'uncertain';
  const isProbable = status === 'probable';

  // Retrieve tier timing configuration based on vehicle rarity
  const normRarity = (card.rarity?.toLowerCase() || 'common') as RarityTier;
  const timings = REVEAL_TIER_TIMINGS[normRarity] || REVEAL_TIER_TIMINGS.rare;

  // Staged Choreography based on Rarity Tier
  useEffect(() => {
    timeoutsRef.current.forEach(t => clearTimeout(t));
    timeoutsRef.current = [];

    const t1 = setTimeout(() => setRevealStep(1), timings.step1Ms);
    const t2 = setTimeout(() => setRevealStep(2), timings.step2Ms);
    const t3 = setTimeout(() => setRevealStep(3), timings.step3Ms);
    const t4 = setTimeout(() => {
      setRevealStep(4);
      sounds.playRarityReveal(card.rarity);
    }, timings.step4Ms);

    timeoutsRef.current = [t1, t2, t3, t4];

    return () => {
      timeoutsRef.current.forEach(t => clearTimeout(t));
      timeoutsRef.current = [];
    };
  }, [card, timings]);

  // Tap-anywhere skip jumping directly to resting state
  const handleTapToSkip = () => {
    if (revealStep >= 4) return;
    timeoutsRef.current.forEach(t => clearTimeout(t));
    timeoutsRef.current = [];
    sounds.playRarityReveal(card.rarity);
    setRevealStep(4);
  };

  return (
    <div 
      onClick={handleTapToSkip}
      className="absolute inset-0 z-50 bg-[var(--color-void)] overflow-y-auto select-none font-sans cursor-pointer"
    >
      {/* Background Ambience */}
      <div className="fixed inset-0 bg-radial-vignette pointer-events-none opacity-40" />

      <div className="relative min-h-full flex flex-col items-center pt-[calc(var(--sat,28px)+12px)] pb-[calc(var(--sab,16px)+32px)] px-4 text-center w-full max-w-[380px] mx-auto space-y-3.5">
        {/* 1. Top Banner with Explicit Confidence State */}
        <div className="relative z-10 w-full space-y-1">
          <div className="flex items-center justify-center gap-1.5">
            {isUncertain ? (
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[var(--color-xp)]/10 border border-[var(--color-xp)]/30 text-[var(--color-xp)] text-xs font-semibold uppercase tracking-wider">
                <AlertCircle className="w-3 h-3" />
                <span>UNCERTAIN • VARIANT UNCONFIRMED</span>
              </div>
            ) : isProbable ? (
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[var(--color-rare)]/10 border border-[var(--color-rare)]/30 text-[var(--color-rare)] text-xs font-semibold uppercase tracking-wider">
                <div className="w-1.5 h-1.5 rounded-full bg-[var(--color-rare)] animate-pulse" />
                <span>PROBABLE • LIKELY IDENTIFICATION</span>
              </div>
            ) : (
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[var(--color-ok)]/10 border border-[var(--color-ok)]/30 text-[var(--color-ok)] text-xs font-semibold uppercase tracking-wider">
                <div className="w-1.5 h-1.5 rounded-full bg-[var(--color-ok)]" />
                <span>IDENTIFIED • HIGH CONFIDENCE</span>
              </div>
            )}
          </div>

          {((card as any).serverRecorded === false || (card as any).cloudSyncError) && (
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[var(--color-xp)]/15 border border-[var(--color-xp)]/35 text-[var(--color-xp)] text-[11px] font-medium mt-1">
              <AlertCircle className="w-3.5 h-3.5 text-[var(--color-xp)] shrink-0" />
              <span>Locally Cached · Cloud Sync Pending</span>
            </div>
          )}

          {isDuplicate && (
            <div className="text-[11px] font-semibold tracking-wider text-[var(--color-xp)] uppercase pt-0.5">
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
                className="py-8 space-y-2"
              >
                {revealStep >= 1 && (
                  <span className="text-sm font-medium text-[var(--color-text-3)] uppercase tracking-wider block">
                    {card.make} • {card.originCountry || 'Global'}
                  </span>
                )}

                {revealStep >= 2 && (
                  <h1 className="text-display-l font-display text-[var(--color-text)] tracking-tight leading-tight">
                    {card.model && !card.model.toLowerCase().includes('unknown') ? card.model : `${card.make} (Unidentified Model)`}
                  </h1>
                )}

                {revealStep >= 3 && (
                  <div className="flex items-center justify-center gap-2 pt-2">
                    <span className={`text-xs font-semibold px-3 py-1 rounded-full border ${rarityConf.badgeBg}`}>
                      {rarityConf.label}
                    </span>
                    <span className="text-xs font-semibold text-[var(--color-text-2)] bg-[var(--color-panel-2)] px-3 py-1 rounded-full border border-[var(--color-line)]">
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
                <h2 className="text-display-l font-display text-[var(--color-text)] tracking-tight">
                  {card.make}{card.model && !card.model.toLowerCase().includes('unknown') ? ` ${card.model}` : ''}
                  {card.trim ? ` ${card.trim}` : ''}
                </h2>
                <p className="text-xs text-[var(--color-text-3)] font-medium">
                  {isUncertain ? (
                    <span className="text-[var(--color-xp)] font-semibold">
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

        {/* 2. Collectible Card Showcase + Distinct Telemetry Section */}
        <div className="relative z-10 w-full" onClick={e => e.stopPropagation()}>
          <AnimatePresence>
            {revealStep === 4 && (
              <motion.div
                initial={{ scale: 0.94, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', damping: 22, stiffness: 260 }}
                className="relative w-full space-y-3"
              >
                {/* Visual Card Showcase without embedded specs */}
                <ApexCollectibleCard
                  card={card}
                  size="full"
                  showSpecs={false}
                />

                {/* Grounded Technical Specifications Panel */}
                <ApexVehicleSpecsSection card={card} />

                {/* Local Rarity Engine Sighting Context */}
                {featureFlags.isLocalRarityEnabled() && card.localRarity && card.localRarity.confidenceState !== 'LOCAL_UNKNOWN' && (
                  <motion.div
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="w-full rounded-[var(--radius-panel)] p-3 bg-[var(--color-panel)] border border-[var(--color-accent)]/30 text-left space-y-1.5 shadow-lg"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-3)]">Local Sighting Rarity</span>
                        <span className="text-[10px] text-[var(--color-text-off)]">•</span>
                        <span className="text-[10px] font-semibold text-[var(--color-text)]">{card.localRarity.coarseAreaName}</span>
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${RARITY_CONFIG[card.localRarity.localRarityTier]?.badgeBg || 'bg-white/10 text-white/80'}`}>
                        {RARITY_CONFIG[card.localRarity.localRarityTier]?.label || card.localRarity.localRarityTier.toUpperCase()}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-[var(--color-text-2)]">
                        Global Rarity: <span className="text-[var(--color-text)] font-medium">{RARITY_CONFIG[card.rarity]?.label}</span>
                      </span>
                      {card.localRarity.localXpModifier > 1.0 && (
                        <span className="font-semibold text-[var(--color-ok)]">
                          +{Math.round((card.localRarity.localXpModifier - 1.0) * 100)}% Local Area Bonus
                        </span>
                      )}
                    </div>

                    <p className="text-[10px] text-[var(--color-text-3)] leading-tight">
                      {card.localRarity.explanation}
                    </p>
                  </motion.div>
                )}

                {card.localRarity && card.localRarity.confidenceState === 'LOCAL_UNKNOWN' && (
                  <div className="w-full rounded-[var(--radius-panel)] p-3 bg-[var(--color-panel)] border border-[var(--color-rare)]/30 text-left space-y-1 shadow-lg">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-rare)]">
                        ESTABLISHING LOCAL CENSUS • UNIVERSAL RARITY
                      </span>
                      <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-[var(--color-rare)]/15 border border-[var(--color-rare)]/30 text-[var(--color-rare)]">
                        INITIAL CENSUS
                      </span>
                    </div>
                    <p className="text-[10px] text-[var(--color-text-3)] leading-tight">
                      First observations in this sector. Baseline anchored to global rarity while establishing local prevalence prior.
                    </p>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* 3. Actions Section */}
        <AnimatePresence>
          {revealStep === 4 && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              onClick={e => e.stopPropagation()}
              className="relative z-10 w-full space-y-2.5 pt-1"
            >
              {isUncertain && (
                <button
                  onClick={onContinueHunt}
                  className="w-full py-3.5 px-6 rounded-[var(--radius-button)] bg-[var(--color-xp)] hover:opacity-90 text-[var(--color-void)] font-bold text-base tracking-tight flex items-center justify-center gap-2 transition-all shadow-lg cursor-pointer"
                >
                  <Camera className="w-4 h-4 text-[var(--color-void)]" />
                  <span>Try Another Angle for Exact Trim</span>
                </button>
              )}

              <button
                onClick={() => {
                  addCardToGarage(card, undefined, { publishToFeed: false });
                  setScannerOpen(false);
                  setActiveTab('garage');
                }}
                className="w-full py-3.5 px-6 rounded-[var(--radius-button)] bg-[var(--color-accent)] hover:opacity-90 text-[var(--color-text)] font-semibold text-base shadow-lg tracking-tight flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <Check className="w-4 h-4 text-[var(--color-text)]" />
                <span>{(card as any).serverRecorded ? 'Save to Garage (Cloud Confirmed)' : 'Save to Garage (Local Cache)'}</span>
              </button>

              <button
                onClick={() => setShowPostComposer(true)}
                className="w-full py-3 px-6 rounded-[var(--radius-button)] bg-[var(--color-panel-2)] hover:bg-[var(--color-panel)] border border-[var(--color-line)] text-[var(--color-text)] font-medium text-sm flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <Share2 className="w-4 h-4 text-[var(--color-text-2)]" />
                <span>Share to Community Feed</span>
              </button>

              {!isUncertain && (
                <button
                  onClick={onContinueHunt}
                  className="text-xs font-medium text-[var(--color-text-3)] hover:text-[var(--color-text)] py-1 transition-colors cursor-pointer"
                >
                  Continue Scanning →
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Tap to skip hint shown while choreography is playing */}
        {revealStep < 4 && (
          <div className="py-2 pointer-events-none">
            <span className="text-[10px] font-mono tracking-widest text-[var(--color-text-3)] uppercase">
              TAP ANYWHERE TO SKIP
            </span>
          </div>
        )}
      </div>

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
