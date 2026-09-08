import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, X, Trash2 } from 'lucide-react';
import type { CarCard } from '../../types/apex';
import { sounds } from '../../utils/audio';

interface DeleteCardConfirmModalProps {
  isOpen: boolean;
  card: CarCard | null;
  onConfirmSchedule: () => void;
  onClose: () => void;
}

export const DeleteCardConfirmModal: React.FC<DeleteCardConfirmModalProps> = ({
  isOpen,
  card,
  onConfirmSchedule,
  onClose
}) => {
  if (!isOpen || !card) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md select-none font-sans">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ duration: 0.18 }}
          className="relative w-full max-w-sm rounded-3xl bg-[#141414] border border-red-500/30 p-5 shadow-2xl space-y-4 overflow-hidden text-center"
        >
          {/* Ambient Glow */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-40 h-24 bg-gradient-to-b from-red-600/20 to-transparent pointer-events-none rounded-full" />

          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-7 h-7 rounded-full bg-white/[0.06] hover:bg-white/[0.12] flex items-center justify-center text-white/50 hover:text-white transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>

          {/* Icon Header */}
          <div className="relative mx-auto mt-1 w-14 h-14 rounded-2xl bg-red-500/15 border border-red-500/30 flex items-center justify-center text-red-500 shadow-lg">
            <Trash2 className="w-7 h-7" />
          </div>

          <div className="space-y-1.5">
            <span className="text-[10px] font-bold tracking-[0.2em] text-red-400 uppercase block font-data">
              3-DAY GRACE PERIOD DELETION
            </span>
            <h3 className="text-lg font-bold text-white tracking-tight">
              Schedule Card For Deletion?
            </h3>
            <p className="text-xs text-white/60 leading-relaxed max-w-xs mx-auto">
              This card will enter a <strong>72-hour grace period</strong>. It will be scheduled for deletion, but you can <strong>cancel and restore it anytime</strong> before the timer expires.
            </p>
          </div>

          {/* Card Preview Pill */}
          <div className="flex items-center gap-3 p-2.5 rounded-2xl bg-white/[0.03] border border-white/[0.06] text-left">
            <img
              src={card.imageUrl}
              alt={card.model}
              className="w-12 h-12 rounded-xl object-cover bg-black shrink-0 border border-white/10"
            />
            <div className="min-w-0 flex-1">
              <span className="text-[10px] font-medium text-white/40 uppercase tracking-wider block">
                {card.make}
              </span>
              <h4 className="text-xs font-bold text-white truncate">
                {card.model}
              </h4>
              <div className="flex items-center gap-1.5 text-[10px] text-amber-400/90 font-data mt-0.5">
                <Clock className="w-3 h-3" />
                <span>Expires in 3 days after confirmation</span>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="space-y-2 pt-1">
            <button
              onClick={() => {
                sounds.playTargetLock();
                onConfirmSchedule();
                onClose();
              }}
              className="w-full py-3 rounded-2xl bg-red-600 hover:bg-red-700 text-white font-semibold text-xs transition-colors shadow-lg shadow-red-950/50 active:scale-98 flex items-center justify-center gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Schedule Deletion (3 Days Grace)</span>
            </button>

            <button
              onClick={onClose}
              className="w-full py-2.5 rounded-2xl bg-white/[0.06] hover:bg-white/[0.1] text-white/80 text-xs font-medium transition-colors"
            >
              Keep Card (Cancel)
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
