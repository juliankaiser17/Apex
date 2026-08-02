import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Flame, ShieldOff } from 'lucide-react';
import type { CarCard } from '../../types/apex';
import { RARITY_CONFIG } from '../../utils/rarity';

interface PostScanHuntModalProps {
  card: CarCard | null;
  isOpen: boolean;
  onStartHunt: () => void;
  onJustSave: () => void;
}

export const PostScanHuntModal: React.FC<PostScanHuntModalProps> = ({
  card,
  isOpen,
  onStartHunt,
  onJustSave
}) => {
  if (!isOpen || !card) return null;

  const rarityConf = RARITY_CONFIG[card.rarity];

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#080808]/85 backdrop-blur-sm select-none" style={{ fontFamily: 'DM Sans' }}>
        <motion.div
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 220 }}
          className="w-full max-w-md bg-[#111111] border-t border-[#FF4500]/50 rounded-t-xl p-6 space-y-5 shadow-2xl glow-orange"
        >
          {/* Rarity Badge at Top */}
          <div className="flex items-center justify-between">
            <span
              style={{
                backgroundColor: rarityConf.color,
                boxShadow: `0 0 16px ${rarityConf.color}66`
              }}
              className="px-3 py-1 rounded-full font-display text-sm text-[#F0EBE3] uppercase tracking-wider font-bold border border-white/20"
            >
              {rarityConf.label} FIND
            </span>

            <span className="text-xs font-data text-[#9A9088]">
              0.4 km · {card.city}
            </span>
          </div>

          {/* Car Name & Subtitle */}
          <div>
            <h2 className="font-display text-[28px] text-[#F0EBE3] tracking-wide leading-none uppercase">
              {card.make} {card.model}
            </h2>
            <p className="text-base text-[#9A9088] font-normal leading-relaxed mt-2">
              Do you want to broadcast this rare spot as a live community hunt? Spotters nearby will get notified!
            </p>
          </div>

          {/* Action Buttons */}
          <div className="space-y-3 pt-2">
            <button
              onClick={onStartHunt}
              className="w-full py-4 rounded-xl bg-[#FF4500] text-[#F0EBE3] font-display text-xl tracking-wider flex items-center justify-center gap-2 glow-orange"
            >
              <Flame className="w-5 h-5 fill-[#F0EBE3]" /> START LIVE COMMUNITY HUNT
            </button>

            <button
              onClick={onJustSave}
              className="w-full py-3.5 rounded-xl bg-[#1A1A1A] hover:bg-[#2C2C2C] text-[#F0EBE3] font-display text-base tracking-wider border border-[#2C2C2C] flex items-center justify-center gap-2"
            >
              <ShieldOff className="w-4 h-4 text-[#9A9088]" /> JUST SAVE TO MY GARAGE
            </button>
          </div>

          {/* Privacy Footnote */}
          <p className="text-[11px] text-[#5A5550] font-data text-center">
            Hunt locations are blurred 1.5–2.2 km and delayed 15 minutes for your privacy.
          </p>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
