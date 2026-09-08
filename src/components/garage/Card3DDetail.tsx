import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { X, RotateCw, Trash2, Undo2, Clock } from 'lucide-react';
import type { CarCard } from '../../types/apex';
import { RARITY_CONFIG } from '../../utils/rarity';
import { ApexCollectibleCard } from '../card/ApexCollectibleCard';
import { sounds } from '../../utils/audio';
import { useApexStore } from '../../store/useApexStore';
import { DeleteCardConfirmModal } from './DeleteCardConfirmModal';

interface Card3DDetailProps {
  card: CarCard | null;
  onClose: () => void;
}

export const Card3DDetail: React.FC<Card3DDetailProps> = ({ card, onClose }) => {
  const [isFlipped, setIsFlipped] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'mods' | 'history' | 'specs'>('overview');
  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);

  const scheduleCardDeletion = useApexStore(s => s.scheduleCardDeletion);
  const cancelCardDeletion = useApexStore(s => s.cancelCardDeletion);

  if (!card) return null;

  const rarityConf = RARITY_CONFIG[card.rarity] || RARITY_CONFIG.rare;
  const serialStr = card.cardNumber || 'APX-001';

  const handleFlip = () => {
    sounds.playCardFlip();
    setIsFlipped(!isFlipped);
  };

  // Remaining time computation for deletion grace period
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

  return (
    <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-xl flex flex-col items-center justify-between p-4 overflow-y-auto select-none font-sans">
      {/* Top Bar */}
      <div className="w-full max-w-sm flex items-center justify-between z-10 pt-2 pb-3 border-b border-white/[0.06]">
        <div className="flex items-center gap-2">
          <div 
            className="w-1.5 h-4 rounded-full" 
            style={{ backgroundColor: 'var(--accent-color)' }}
          />
          <span className="text-base font-bold text-white tracking-tight">
            Vehicle Specs
          </span>
        </div>
        <div className="flex items-center gap-2">
          {isPendingDeletion ? (
            <button
              onClick={() => cancelCardDeletion(card.id)}
              className="px-2.5 py-1 rounded-full bg-amber-400 text-black text-[11px] font-bold flex items-center gap-1 active:scale-95 transition-transform"
              title="Cancel Deletion"
            >
              <Undo2 className="w-3 h-3" /> Restore
            </button>
          ) : (
            <button
              onClick={() => setIsConfirmDeleteOpen(true)}
              className="w-8 h-8 rounded-full bg-red-500/10 hover:bg-red-500/20 border border-red-500/25 flex items-center justify-center text-red-400 hover:text-red-300 transition-colors"
              title="Schedule Card for Deletion (3-day grace period)"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/[0.08] hover:bg-white/[0.15] border border-white/[0.08] flex items-center justify-center text-white/70 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Deletion Grace Period Banner */}
      {isPendingDeletion && card.pendingDeletionUntil && (
        <div className="w-full max-w-sm mt-2 p-3 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-400 shrink-0" />
            <div className="text-left">
              <span className="text-[11px] font-bold text-amber-300 block leading-tight">
                Scheduled for Deletion
              </span>
              <span className="text-[10px] text-white/70 font-data">
                {getRemainingTimeStr(card.pendingDeletionUntil)} remaining · Tap Restore to cancel
              </span>
            </div>
          </div>
          <button
            onClick={() => cancelCardDeletion(card.id)}
            className="px-3 py-1.5 rounded-xl bg-amber-400 text-black font-bold text-xs flex items-center gap-1 hover:bg-amber-300 active:scale-95 transition-all shadow"
          >
            <Undo2 className="w-3.5 h-3.5" /> Cancel Deletion
          </button>
        </div>
      )}


      {/* 3D Trading Card Center Container */}
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

            {/* BACK OF CARD (DETAILED SPECS & MODS) */}
            <div 
              className={`w-full h-full rounded-2xl overflow-hidden border border-white/[0.08] bg-[#141414] text-white p-5 space-y-4 shadow-2xl ${isFlipped ? 'block' : 'hidden'}`}
              style={{ transform: 'rotateY(180deg)' }}
            >
              <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
                <div>
                  <h3 className="text-xl font-bold text-white leading-tight">{card.make} {card.model}</h3>
                  <p className="text-xs text-white/50 mt-0.5">Serial {serialStr} • {rarityConf.label}</p>
                </div>
                <button className="p-2 rounded-full bg-white/[0.06] border border-white/[0.08] text-white/60 hover:text-white">
                  <RotateCw className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Sub-Tabs within Card Back */}
              <div className="flex gap-1 border-b border-white/[0.06] pb-2">
                {(['overview', 'mods', 'history', 'specs'] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveTab(tab);
                    }}
                    className={`px-3 py-1 rounded-full text-xs font-medium capitalize transition-colors ${
                      activeTab === tab ? 'bg-[#E50914] text-white' : 'text-white/50 hover:text-white bg-white/[0.04]'
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              {activeTab === 'overview' && (
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between py-1.5 border-b border-white/[0.04]">
                    <span className="text-white/50">Production</span>
                    <span className="text-white font-medium">{card.productionYears || '2022–Present'}</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-white/[0.04]">
                    <span className="text-white/50">Body Style</span>
                    <span className="text-white font-medium">{card.bodyStyle || 'Coupe'}</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-white/[0.04]">
                    <span className="text-white/50">Horsepower</span>
                    <span className="text-[#E50914] font-bold">{card.horsepower ? `${card.horsepower} hp` : '525 hp'}</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-white/[0.04]">
                    <span className="text-white/50">Top Speed</span>
                    <span className="text-white font-medium">{card.topSpeedKmH ? `${card.topSpeedKmH} km/h` : '296 km/h'}</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-white/[0.04]">
                    <span className="text-white/50">0–100 km/h</span>
                    <span className="text-white font-medium">{card.zeroToHundredSec ? `${card.zeroToHundredSec.toFixed(1)} s` : '3.2 s'}</span>
                  </div>
                  <div className="flex justify-between py-1.5">
                    <span className="text-white/50">Engine</span>
                    <span className="text-white font-medium truncate max-w-[170px]">{card.engine || '4.0L Flat-6 NA'}</span>
                  </div>
                </div>
              )}

              {activeTab === 'mods' && (
                <div className="space-y-2 text-xs">
                  {card.modsDetected && card.modsDetected.length > 0 ? (
                    card.modsDetected.map((m, idx) => (
                      <div key={idx} className="p-2.5 rounded-xl bg-white/[0.04] border border-white/[0.06]">
                        <strong className="text-[#E50914] block">{m.part}</strong>
                        <span className="text-white/60 text-[11px]">{m.description}</span>
                      </div>
                    ))
                  ) : (
                    <div className="p-4 rounded-xl bg-white/[0.04] border border-white/[0.06] text-center space-y-1">
                      <span className="text-white font-medium block">Factory OEM Specification</span>
                      <p className="text-white/40 text-[11px]">Factory aerodynamics, lightweight forged wheels, titanium exhaust.</p>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'history' && (
                <div className="space-y-2 text-xs">
                  <div className="p-3 rounded-xl bg-white/[0.04] border border-white/[0.06] space-y-1">
                    <span className="text-white/40 block text-[10px]">Origin & Assembly</span>
                    <p className="text-white text-xs">{card.originCountry || 'Germany'}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-white/[0.04] border border-white/[0.06] space-y-1">
                    <span className="text-white/40 block text-[10px]">Estimated Market Value</span>
                    <p className="text-[#E50914] text-sm font-bold">${(card.marketValueLowUsd || 240000).toLocaleString()} – ${(card.marketValueHighUsd || 310000).toLocaleString()} USD</p>
                  </div>
                </div>
              )}

              {activeTab === 'specs' && (
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between py-1.5 border-b border-white/[0.04]">
                    <span className="text-white/50">Kerb Weight</span>
                    <span className="text-white font-medium">{card.kerbWeightKg || 1450} kg</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-white/[0.04]">
                    <span className="text-white/50">Torque</span>
                    <span className="text-white font-medium">{card.torqueNm || 465} Nm</span>
                  </div>
                  <div className="flex justify-between py-1.5">
                    <span className="text-white/50">Power-to-Weight</span>
                    <span className="text-[#E50914] font-bold">{(525 / 1.45).toFixed(0)} hp / ton</span>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </div>

        {/* Flip Instruction */}
        <div className="flex items-center gap-1.5 text-xs text-white/50 bg-white/[0.06] px-3 py-1 rounded-full border border-white/[0.08]">
          <RotateCw className="w-3 h-3" style={{ color: 'var(--accent-color)' }} />
          <span>Tap card to flip</span>
        </div>
      </div>

      {/* Footer Action */}
      <div className="w-full max-w-sm pb-4 pt-2 border-t border-white/[0.06]">
        <button
          onClick={onClose}
          className="w-full py-3 rounded-xl bg-white/[0.08] hover:bg-white/[0.14] text-white font-medium text-sm transition-colors border border-white/[0.08]"
        >
          Close
        </button>
      </div>

      {/* 3-Day Delayed Deletion Confirmation Modal */}
      <DeleteCardConfirmModal
        isOpen={isConfirmDeleteOpen}
        card={card}
        onConfirmSchedule={() => {
          scheduleCardDeletion(card.id);
          setIsConfirmDeleteOpen(false);
        }}
        onClose={() => setIsConfirmDeleteOpen(false)}
      />
    </div>
  );
};
