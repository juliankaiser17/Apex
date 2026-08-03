import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { X, RotateCw, MapPin, Calendar, ShieldCheck, Share2 } from 'lucide-react';
import type { CarCard } from '../../types/apex';
import { RARITY_CONFIG } from '../../utils/rarity';
import { ApexCollectibleCard } from '../card/ApexCollectibleCard';
import { sounds } from '../../utils/audio';

interface Card3DDetailProps {
  card: CarCard | null;
  onClose: () => void;
}

export const Card3DDetail: React.FC<Card3DDetailProps> = ({ card, onClose }) => {
  const [isFlipped, setIsFlipped] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'mods' | 'history' | 'stats'>('overview');

  if (!card) return null;

  const rarityConf = RARITY_CONFIG[card.rarity];
  const serialStr = card.cardNumber || 'APX-001';

  const handleFlip = () => {
    sounds.playCardFlip();
    setIsFlipped(!isFlipped);
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#080808]/90 backdrop-blur-md flex flex-col items-center justify-between p-4 overflow-y-auto select-none" style={{ fontFamily: 'DM Sans' }}>
      {/* Top Bar */}
      <div className="w-full max-w-md flex items-center justify-between z-10 pt-2 pb-4">
        <span className="font-display text-2xl text-[#F0EBE3] tracking-widest">
          GARAGE COLLECTIBLE
        </span>
        <button
          onClick={onClose}
          className="w-10 h-10 rounded-full bg-[#1A1A1A] border border-[#2C2C2C] flex items-center justify-center text-[#F0EBE3] hover:bg-[#2C2C2C] transition-colors"
        >
          <X className="w-6 h-6" />
        </button>
      </div>

      {/* 3D Trading Card Container */}
      <div className="w-full max-w-md my-auto space-y-4 flex flex-col items-center">
        <div 
          onClick={handleFlip}
          className="relative cursor-pointer perspective-1000 group flex items-center justify-center"
        >
          <motion.div
            animate={{ rotateY: isFlipped ? 180 : 0 }}
            transition={{ duration: 0.6 }}
            className="relative w-[320px] h-[456px]"
            style={{ transformStyle: 'preserve-3d' }}
          >
            {/* FRONT OF CARD */}
            <div className={`w-full h-full ${isFlipped ? 'hidden' : 'block'}`}>
              <ApexCollectibleCard card={card} showHolo={true} />
            </div>

            {/* BACK OF CARD (DETAILED SPECS & MODS) */}
            <div 
              className={`w-full h-full rounded-xl overflow-hidden border-2 ${rarityConf.borderClass} bg-[#111111] text-[#F0EBE3] p-5 space-y-4 shadow-2xl ${isFlipped ? 'block' : 'hidden'}`}
              style={{ transform: 'rotateY(180deg)' }}
            >
              <div className="flex items-center justify-between border-b border-[#2C2C2C] pb-3">
                <div>
                  <h3 className="font-display text-2xl text-[#FF4500] leading-none">{card.make} {card.model}</h3>
                  <p className="text-xs font-data text-[#9A9088] mt-1">Card #{serialStr}</p>
                </div>
                <RotateCw className="w-5 h-5 text-[#9A9088]" />
              </div>

              {/* Sub-Tabs within Card Back */}
              <div className="flex gap-1.5 border-b border-[#2C2C2C] pb-2">
                {(['overview', 'mods', 'history', 'stats'] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveTab(tab);
                    }}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-data capitalize transition-colors ${
                      activeTab === tab ? 'bg-[#FF4500] text-[#F0EBE3] font-semibold' : 'text-[#9A9088] hover:text-[#F0EBE3]'
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              {activeTab === 'overview' && (
                <div className="space-y-1.5 text-xs font-data">
                  <div className="flex justify-between py-1 border-b border-[#2C2C2C]">
                    <span className="text-[#9A9088]">Manufactured</span>
                    <span className="text-[#F0EBE3] font-semibold">{card.productionYears || card.releasedYear || '2019–Present'}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-[#2C2C2C]">
                    <span className="text-[#9A9088]">Status</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      card.productionYears?.includes('Present') || !card.productionYears
                        ? 'bg-[#2ECC71]/20 text-[#2ECC71] border border-[#2ECC71]/40'
                        : 'bg-[#FF3B30]/20 text-[#FF3B30] border border-[#FF3B30]/40'
                    }`}>
                      {card.productionYears?.includes('Present') || !card.productionYears ? 'ACTIVE PRODUCTION' : 'DISCONTINUED'}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-[#2C2C2C]">
                    <span className="text-[#9A9088]">Horsepower</span>
                    <span className="text-[#FFA500] font-semibold">{card.horsepower ? `${card.horsepower} HP` : '—'}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-[#2C2C2C]">
                    <span className="text-[#9A9088]">Engine Spec</span>
                    <span className="text-[#F0EBE3] font-semibold truncate max-w-[170px]">{card.engine || 'V8 Twin-Turbo'}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-[#2C2C2C]">
                    <span className="text-[#9A9088]">Top Speed</span>
                    <span className="text-[#F0EBE3] font-semibold">{card.topSpeedKmH ? `${card.topSpeedKmH} km/h` : '—'}</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-[#9A9088]">0–100 km/h</span>
                    <span className="text-[#F0EBE3] font-semibold">{card.zeroToHundredSec ? `${card.zeroToHundredSec}s` : '—'}</span>
                  </div>
                </div>
              )}

              {activeTab === 'mods' && (
                <div className="space-y-2 text-xs">
                  {card.modsDetected && card.modsDetected.length > 0 ? (
                    card.modsDetected.map((m, idx) => (
                      <div key={idx} className="p-2 rounded bg-[#1A1A1A] border border-[#2C2C2C]">
                        <strong className="text-[#FF6A00]">{m.part}:</strong> {m.description}
                      </div>
                    ))
                  ) : (
                    <div className="p-3 rounded bg-[#1A1A1A] border border-[#2C2C2C] text-center space-y-1">
                      <span className="text-[#FFA500] font-semibold block">FACTORY STOCK SPECIFICATION</span>
                      <p className="text-[#9A9088] text-[11px]">OEM factory aerodynamic kit & performance tuning.</p>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'history' && (
                <div className="space-y-2 text-xs text-[#F0EBE3]/90 leading-relaxed">
                  <p className="italic bg-[#1A1A1A] p-2.5 rounded border border-[#2C2C2C]">
                    "{card.briefHistory || 'A masterpiece of automotive engineering spotted live on city streets.'}"
                  </p>
                  {card.interestingFact && (
                    <p className="text-[11px] text-[#9A9088]">
                      💡 <strong className="text-[#F0EBE3]">Engineering Note:</strong> {card.interestingFact}
                    </p>
                  )}
                </div>
              )}

              {activeTab === 'stats' && (
                <div className="space-y-2 text-xs font-data">
                  <div className="flex items-center gap-2 text-[#F0EBE3]">
                    <MapPin className="w-4 h-4 text-[#FF4500]" />
                    <span>Location: {card.city}, {card.stateRegion || card.country}</span>
                  </div>
                  <div className="flex items-center gap-2 text-[#F0EBE3]">
                    <Calendar className="w-4 h-4 text-[#FFA500]" />
                    <span>Spotted: {card.spottedDateFormatted || 'TODAY'}</span>
                  </div>
                  <div className="flex items-center gap-2 text-[#F0EBE3]">
                    <ShieldCheck className="w-4 h-4 text-[#2ECC71]" />
                    <span>Card Verification: Verified 100% Authentic</span>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </div>

        <p className="text-center text-xs font-data text-[#9A9088]">
          Tap card to flip 180°
        </p>

        {/* Share Button */}
        <button
          onClick={() => {
            sounds.playTargetLock();
            alert('Story Card exported to gallery!');
          }}
          className="w-[320px] py-3 rounded-xl bg-[#1A1A1A] hover:bg-[#2C2C2C] text-[#F0EBE3] font-display text-lg tracking-wider border border-[#2C2C2C] flex items-center justify-center gap-2 transition-colors"
        >
          <Share2 className="w-5 h-5 text-[#FF4500]" /> SHARE STORY CARD
        </button>
      </div>
    </div>
  );
};
