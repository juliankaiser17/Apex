import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { X, RotateCw, Trash2, Undo2, Clock, ArrowLeft, Edit3, Sparkles, CloudOff, Share2 } from 'lucide-react';
import type { CarCard } from '../../types/apex';
import { ApexCollectibleCard } from '../card/ApexCollectibleCard';
import { sounds } from '../../utils/audio';
import { useApexStore } from '../../store/useApexStore';
import { DeleteCardConfirmModal } from './DeleteCardConfirmModal';
import { CorrectionModal } from './CorrectionModal';
import { getEstimatedMarketValue } from '../../utils/marketValuation';
import { RarityBadge, type RarityTier } from '../ui/RarityBadge';
import { StatGauge } from '../ui/StatGauge';
import { Button } from '../ui/Button';

interface Card3DDetailProps {
  card: CarCard | null;
  onClose: () => void;
}

export const Card3DDetail: React.FC<Card3DDetailProps> = ({ card, onClose }) => {
  const [isFlipped, setIsFlipped] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'mods' | 'history' | 'specs'>('overview');
  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);
  const [isCorrectionOpen, setIsCorrectionOpen] = useState(false);

  const scheduleCardDeletion = useApexStore(s => s.scheduleCardDeletion);
  const cancelCardDeletion = useApexStore(s => s.cancelCardDeletion);
  const purchaseCardFoil = useApexStore(s => s.purchaseCardFoil);
  const currentUser = useApexStore(s => s.user);
  const garage = useApexStore(s => s.garage);

  const isCardOwner = Boolean(
    card && (
      ((card as any)?.userId && (card as any)?.userId === currentUser?.id) ||
      garage.some(c => c.id === card.id)
    )
  );

  useEffect(() => {
    if (!card) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);

    window.history.pushState({ modal: 'card-detail' }, '');
    const handlePopState = () => {
      onClose();
    };
    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('popstate', handlePopState);
    };
  }, [card, onClose]);

  if (!card) return null;

  const normRarity = (card.rarity?.toLowerCase() || 'common') as RarityTier;
  const serialStr = card.cardNumber || 'APX-001';

  const valuation = getEstimatedMarketValue({
    make: card.make,
    model: card.model,
    rarity: card.rarity,
    marketValueLowUsd: card.marketValueLowUsd,
    marketValueHighUsd: card.marketValueHighUsd,
  });

  const handleFlip = () => {
    sounds.playCardFlip();
    setIsFlipped(!isFlipped);
  };

  const getRemainingTimeStr = (untilStr: string) => {
    const diffMs = Math.max(0, new Date(untilStr).getTime() - Date.now());
    const totalHours = Math.floor(diffMs / (1000 * 60 * 60));
    const days = Math.floor(totalHours / 24);
    const hours = totalHours % 24;
    if (days > 0) return `${days}d ${hours}h`;
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  };

  const isPendingDeletion = Boolean(
    card.pendingDeletionUntil && new Date(card.pendingDeletionUntil).getTime() > Date.now()
  );

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Apex: ${card.make} ${card.model}`,
          text: `Check out this ${card.rarity.toUpperCase()} ${card.make} ${card.model} spotted on Apex!`,
          url: window.location.href,
        });
      } catch (_) {}
    }
  };

  return (
    <div 
      className="fixed inset-0 z-[120] bg-[var(--color-void)]/95 backdrop-blur-xl flex flex-col items-center justify-between overflow-y-auto select-none font-sans"
      style={{
        paddingTop: 'max(env(safe-area-inset-top), 12px)',
        paddingBottom: 'max(env(safe-area-inset-bottom), 12px)'
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* Sticky Top Bar */}
      <div className="sticky top-0 z-40 w-full max-w-sm bg-[var(--color-void)]/90 backdrop-blur-md px-4 py-2.5 border-b border-[var(--color-line)] flex items-center justify-between">
        <button
          onClick={onClose}
          className="px-3 py-1.5 rounded-[var(--radius-button)] bg-[var(--color-panel-2)] border border-[var(--color-line)] flex items-center gap-1.5 text-[var(--color-text)] text-caption font-bold active:scale-95 transition-all cursor-pointer"
        >
          <ArrowLeft size={14} />
          <span>Back</span>
        </button>

        <span className="font-mono text-caption text-[var(--color-text-3)] uppercase tracking-wider">
          Card Specimen
        </span>

        <div className="flex items-center gap-2">
          <button
            onClick={handleShare}
            aria-label="Share card"
            className="w-8 h-8 rounded-full bg-[var(--color-panel-2)] border border-[var(--color-line)] flex items-center justify-center text-[var(--color-text-2)] hover:text-[var(--color-text)] transition-colors cursor-pointer"
          >
            <Share2 size={14} />
          </button>
          {isCardOwner && (
            <button
              onClick={() => setIsCorrectionOpen(true)}
              aria-label="Suggest correction"
              className="w-8 h-8 rounded-full bg-[var(--color-panel-2)] border border-[var(--color-line)] flex items-center justify-center text-[var(--color-text-2)] hover:text-[var(--color-text)] transition-colors cursor-pointer"
            >
              <Edit3 size={14} />
            </button>
          )}
          {isCardOwner && (
            isPendingDeletion ? (
              <button
                onClick={() => cancelCardDeletion(card.id)}
                className="px-2.5 py-1 rounded-full bg-[var(--color-xp)] text-[var(--color-void)] text-[11px] font-bold flex items-center gap-1 active:scale-95 transition-transform cursor-pointer"
              >
                <Undo2 size={12} /> Restore
              </button>
            ) : (
              <button
                onClick={() => setIsConfirmDeleteOpen(true)}
                aria-label="Delete card"
                className="w-8 h-8 rounded-full bg-[var(--color-panel-2)] border border-[var(--color-danger)]/40 flex items-center justify-center text-[var(--color-danger)] hover:bg-[var(--color-danger)]/20 transition-colors cursor-pointer"
              >
                <Trash2 size={14} />
              </button>
            )
          )}
          <button
            onClick={onClose}
            aria-label="Close vehicle inspection"
            className="w-8 h-8 rounded-full bg-[var(--color-panel-2)] border border-[var(--color-line)] flex items-center justify-center text-[var(--color-text-2)] hover:text-[var(--color-text)] cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Deletion Grace Period Banner (Plain Language per Section 6.3) */}
      {isPendingDeletion && card.pendingDeletionUntil && (
        <div className="w-full max-w-sm mt-2 p-3 rounded-[var(--radius-panel)] bg-amber-500/10 border border-amber-500/30 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock size={16} className="text-amber-400 shrink-0" />
            <div className="text-left">
              <span className="text-caption font-bold text-amber-300 block leading-tight">
                Scheduled for deletion
              </span>
              <span className="text-[11px] text-[var(--color-text-2)] font-mono">
                You can restore it for {getRemainingTimeStr(card.pendingDeletionUntil)}
              </span>
            </div>
          </div>
          <button
            onClick={() => cancelCardDeletion(card.id)}
            className="px-3 py-1.5 rounded-[var(--radius-chip)] bg-amber-400 text-black font-bold text-caption flex items-center gap-1 hover:bg-amber-300 active:scale-95 transition-all cursor-pointer"
          >
            <Undo2 size={12} /> Restore
          </button>
        </div>
      )}

      {/* Cloud Sync Warning */}
      {(card.serverRecorded === false || card.cloudSyncError) && !isPendingDeletion && (
        <div className="w-full max-w-sm mt-2 p-3 rounded-[var(--radius-panel)] bg-[var(--color-panel-2)] border border-[var(--color-line)] flex items-center gap-2.5">
          <CloudOff size={16} className="text-amber-400 shrink-0" />
          <div className="text-left min-w-0">
            <span className="text-caption font-semibold text-[var(--color-text)] block leading-tight">
              Locally cached · Cloud persistence pending
            </span>
            <span className="text-[11px] text-[var(--color-text-3)] font-mono block truncate">
              {card.cloudSyncError ? card.cloudSyncError : 'Will synchronize automatically on reconnect'}
            </span>
          </div>
        </div>
      )}

      {/* 3D Trading Card Container */}
      <div className="w-full max-w-sm my-auto py-4 space-y-4 flex flex-col items-center">
        <div 
          onClick={handleFlip}
          className="relative cursor-pointer perspective-1000 group flex items-center justify-center"
        >
          <motion.div
            animate={{ rotateY: isFlipped ? 180 : 0 }}
            transition={{ duration: 0.5, ease: 'easeInOut' }}
            className="relative w-[325px] min-h-[460px]"
            style={{ transformStyle: 'preserve-3d' }}
          >
            {/* FRONT OF CARD */}
            <div className={`w-full h-full ${isFlipped ? 'hidden' : 'block'}`}>
              <ApexCollectibleCard card={card} size="md" />
            </div>

            {/* BACK OF CARD: Telemetry Cluster, Specs & Mods */}
            <div 
              data-rarity={normRarity}
              className={`w-full h-full rounded-[var(--radius-slab)] overflow-hidden border border-[var(--color-line)] bg-[var(--color-panel)] text-[var(--color-text)] p-5 space-y-4 shadow-2xl ${isFlipped ? 'block' : 'hidden'}`}
              style={{ transform: 'rotateY(180deg)' }}
            >
              <div className="flex items-center justify-between border-b border-[var(--color-line)] pb-3">
                <div>
                  <h3 className="font-display text-display-m font-bold text-[var(--color-text)] leading-tight">
                    {card.make} {card.model}
                  </h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="font-mono text-caption text-[var(--color-text-3)]">
                      {serialStr}
                    </span>
                    <RarityBadge rarity={normRarity} size="sm" />
                  </div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleFlip();
                  }}
                  className="p-2 rounded-full bg-[var(--color-panel-2)] border border-[var(--color-line)] text-[var(--color-text-2)] hover:text-[var(--color-text)] cursor-pointer"
                >
                  <RotateCw size={14} />
                </button>
              </div>

              {/* Back Sub-Tabs */}
              <div className="flex gap-1 border-b border-[var(--color-line)] pb-2">
                {(['overview', 'mods', 'history', 'specs'] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveTab(tab);
                    }}
                    className={`px-3 py-1 rounded-full text-caption font-medium capitalize transition-colors cursor-pointer ${
                      activeTab === tab
                        ? 'bg-[var(--color-text)] text-[var(--color-void)] font-bold'
                        : 'text-[var(--color-text-3)] hover:text-[var(--color-text)] bg-[var(--color-panel-2)]'
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              {/* 5-Gauge Telemetry Overview */}
              {activeTab === 'overview' && (
                <div className="space-y-3">
                  <StatGauge
                    label="Power"
                    value={card.horsepower || 450}
                    unit="HP"
                    percentage={((card.horsepower || 450) / 1000) * 100}
                    rarity={normRarity}
                  />
                  <StatGauge
                    label="Top Speed"
                    value={card.topSpeedKmH || 260}
                    unit="km/h"
                    percentage={((card.topSpeedKmH || 260) / 400) * 100}
                    rarity={normRarity}
                  />
                  <StatGauge
                    label="Acceleration 0-100"
                    value={(card.zeroToHundredSec || 3.5).toFixed(1)}
                    unit="s"
                    percentage={Math.max(0, 100 - ((card.zeroToHundredSec || 3.5) / 6) * 100)}
                    rarity={normRarity}
                  />
                  <StatGauge
                    label="Torque"
                    value={card.torqueNm || 500}
                    unit="Nm"
                    percentage={((card.torqueNm || 500) / 1000) * 100}
                    rarity={normRarity}
                  />
                  <StatGauge
                    label="Weight"
                    value={card.kerbWeightKg || 1500}
                    unit="kg"
                    percentage={((card.kerbWeightKg || 1500) / 2500) * 100}
                    rarity={normRarity}
                  />
                </div>
              )}

              {/* Mods Tab */}
              {activeTab === 'mods' && (
                <div className="space-y-2 text-secondary">
                  {card.modsDetected && card.modsDetected.length > 0 ? (
                    card.modsDetected.map((m, idx) => (
                      <div key={idx} className="p-2.5 rounded-[var(--radius-chip)] bg-[var(--color-panel-2)] border border-[var(--color-line)]">
                        <strong className="text-[var(--color-xp)] block">{m.part}</strong>
                        <span className="text-[var(--color-text-3)] text-caption">{m.description}</span>
                      </div>
                    ))
                  ) : (
                    <div className="p-4 rounded-[var(--radius-panel)] bg-[var(--color-panel-2)] border border-[var(--color-line)] text-center space-y-1">
                      <span className="text-[var(--color-text)] font-medium block">Factory OEM Specification</span>
                      <p className="text-[var(--color-text-3)] text-caption">Factory aerodynamics, OEM wheels, stock exhaust configuration.</p>
                    </div>
                  )}
                </div>
              )}

              {/* History & Valuation Tab */}
              {activeTab === 'history' && (
                <div className="space-y-3 text-secondary">
                  <div className="p-3 rounded-[var(--radius-chip)] bg-[var(--color-panel-2)] border border-[var(--color-line)] space-y-1">
                    <span className="text-[var(--color-text-3)] block text-[11px] uppercase tracking-wider">
                      Origin & Location
                    </span>
                    <p className="font-mono text-secondary text-[var(--color-text)]">
                      {card.city || 'Unknown'}, {card.country || card.originCountry || 'Global'}
                    </p>
                  </div>
                  <div className="p-3 rounded-[var(--radius-chip)] bg-[var(--color-panel-2)] border border-[var(--color-line)] space-y-1">
                    <span className="text-[var(--color-text-3)] block text-[11px] uppercase tracking-wider">
                      Estimated Market Value
                    </span>
                    <p className="font-mono text-display-m font-bold text-[var(--color-xp)] tabular-nums">
                      ${valuation.lowUsd.toLocaleString()} – ${valuation.highUsd.toLocaleString()} USD
                    </p>
                  </div>

                  {isCardOwner && !card.customFoil && (
                    <Button
                      variant="secondary"
                      className="w-full text-caption"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (purchaseCardFoil) {
                          const res = purchaseCardFoil(card.id);
                          if (!res.success) {
                            alert(res.error || 'Insufficient coins to apply foil (1,000 Coins required).');
                          } else {
                            sounds.playUnlock();
                          }
                        }
                      }}
                    >
                      <Sparkles size={14} className="text-[var(--color-xp)]" />
                      <span>Holographic Foil Upgrade (1,000 Coins)</span>
                    </Button>
                  )}
                </div>
              )}

              {/* Detailed Specs Tab */}
              {activeTab === 'specs' && (
                <div className="space-y-2 text-secondary font-mono">
                  <div className="flex justify-between py-1.5 border-b border-[var(--color-line)]">
                    <span className="text-[var(--color-text-3)] font-sans">Engine</span>
                    <span className="text-[var(--color-text)] font-semibold">{card.engine || 'ICE'}</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-[var(--color-line)]">
                    <span className="text-[var(--color-text-3)] font-sans">Body Style</span>
                    <span className="text-[var(--color-text)] font-semibold">{card.bodyStyle || 'Coupe'}</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-[var(--color-line)]">
                    <span className="text-[var(--color-text-3)] font-sans">Kerb Weight</span>
                    <span className="text-[var(--color-text)] font-semibold">{card.kerbWeightKg || 1450} kg</span>
                  </div>
                  <div className="flex justify-between py-1.5">
                    <span className="text-[var(--color-text-3)] font-sans">Torque Output</span>
                    <span className="text-[var(--color-text)] font-semibold">{card.torqueNm || 465} Nm</span>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </div>

        {/* Flip Instruction Hint */}
        <div className="flex items-center gap-1.5 text-caption text-[var(--color-text-3)] bg-[var(--color-panel-2)] px-3 py-1 rounded-full border border-[var(--color-line)]">
          <RotateCw size={12} className="text-[var(--color-text-2)]" />
          <span>Tap card to flip</span>
        </div>
      </div>

      {/* Sticky Bottom Close Button */}
      <div className="sticky bottom-0 z-40 w-full max-w-sm bg-[var(--color-void)]/90 backdrop-blur-md px-4 py-3 border-t border-[var(--color-line)]">
        <Button variant="secondary" className="w-full" onClick={onClose}>
          Close Inspection
        </Button>
      </div>

      {/* 3-Day Delayed Deletion Modal */}
      <DeleteCardConfirmModal
        isOpen={isConfirmDeleteOpen}
        card={card}
        onConfirmSchedule={() => {
          scheduleCardDeletion(card.id);
          setIsConfirmDeleteOpen(false);
        }}
        onClose={() => setIsConfirmDeleteOpen(false)}
      />

      {/* Suggest Correction Modal */}
      <CorrectionModal
        isOpen={isCorrectionOpen}
        card={card}
        onClose={() => setIsCorrectionOpen(false)}
      />
    </div>
  );
};

Card3DDetail.displayName = 'Card3DDetail';
