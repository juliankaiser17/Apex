import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, CheckCircle, ShieldAlert, Edit3 } from 'lucide-react';
import type { CarCard } from '../../types/apex';
import { useApexStore } from '../../store/useApexStore';

interface CorrectionModalProps {
  isOpen: boolean;
  card: CarCard;
  onClose: () => void;
}

export const CorrectionModal: React.FC<CorrectionModalProps> = ({
  isOpen,
  card,
  onClose
}) => {
  const { updateCardInGarage } = useApexStore();
  const [correctedMake, setCorrectedMake] = useState(card.make || '');
  const [correctedModel, setCorrectedModel] = useState(card.model || '');
  const [correctedTrim, setCorrectedTrim] = useState(card.trim || '');
  const [correctionNotes, setCorrectionNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedSuccess, setSubmittedSuccess] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!correctedMake.trim() || !correctedModel.trim()) return;

    setIsSubmitting(true);

    try {
      // 1. Immediately update local card in garage
      if (updateCardInGarage) {
        updateCardInGarage(card.id, {
          make: correctedMake.trim(),
          model: correctedModel.trim(),
          trim: correctedTrim.trim() || undefined,
          identificationStatus: 'identified',
          identificationReason: correctionNotes.trim()
            ? `User Verified Correction: ${correctionNotes.trim()}`
            : 'User Verified Correction'
        });
      }

      // 2. Save correction audit record to localStorage
      try {
        const auditRecord = {
          cardId: card.id,
          timestamp: new Date().toISOString(),
          original: { make: card.make, model: card.model, trim: card.trim },
          corrected: { make: correctedMake.trim(), model: correctedModel.trim(), trim: correctedTrim.trim() },
          notes: correctionNotes.trim()
        };
        const existing = JSON.parse(localStorage.getItem('apex_user_corrections') || '[]');
        existing.push(auditRecord);
        localStorage.setItem('apex_user_corrections', JSON.stringify(existing));
      } catch (err) {
        console.warn('Failed to save correction audit entry:', err);
      }

      setSubmittedSuccess(true);
      setTimeout(() => {
        setIsSubmitting(false);
        setSubmittedSuccess(false);
        onClose();
      }, 1200);
    } catch (err) {
      console.error('Failed to submit card correction:', err);
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm select-none">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ duration: 0.2 }}
          className="relative w-full max-w-md bg-[#161616] border border-white/10 rounded-3xl p-5 shadow-2xl overflow-hidden text-white"
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-white/10">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
                <Edit3 className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white tracking-tight">Suggest Correction</h3>
                <p className="text-[11px] text-white/50">Update vehicle identity in your garage</p>
              </div>
            </div>

            <button
              onClick={onClose}
              disabled={isSubmitting}
              className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-white/60 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {submittedSuccess ? (
            <div className="py-10 text-center space-y-3">
              <CheckCircle className="w-12 h-12 text-emerald-400 mx-auto animate-bounce" />
              <h4 className="text-base font-bold text-white">Garage Updated</h4>
              <p className="text-xs text-white/60 max-w-xs mx-auto">
                Vehicle identity and specifications have been corrected and saved.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="py-4 space-y-3.5">
              <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/[0.06] text-xs text-white/60 space-y-1">
                <div className="flex items-center gap-1.5 text-amber-400 font-semibold">
                  <ShieldAlert className="w-3.5 h-3.5" />
                  <span>Current AI Identification:</span>
                </div>
                <p className="text-white font-medium pl-5">
                  {card.make} {card.model} {card.trim ? `(${card.trim})` : ''}
                </p>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-white/50">
                  Manufacturer (Make) *
                </label>
                <input
                  type="text"
                  required
                  value={correctedMake}
                  onChange={(e) => setCorrectedMake(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.05] border border-white/10 text-white text-sm focus:outline-none focus:border-amber-400/60 transition-colors"
                  placeholder="e.g. BMW, Porsche, Ferrari"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-white/50">
                  Model Family *
                </label>
                <input
                  type="text"
                  required
                  value={correctedModel}
                  onChange={(e) => setCorrectedModel(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.05] border border-white/10 text-white text-sm focus:outline-none focus:border-amber-400/60 transition-colors"
                  placeholder="e.g. M3, 911 GT3, 488 GTB"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-white/50">
                  Variant / Trim (Optional)
                </label>
                <input
                  type="text"
                  value={correctedTrim}
                  onChange={(e) => setCorrectedTrim(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.05] border border-white/10 text-white text-sm focus:outline-none focus:border-amber-400/60 transition-colors"
                  placeholder="e.g. Competition xDrive, Touring, Weissach"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-white/50">
                  Correction Reason / Evidence
                </label>
                <textarea
                  rows={2}
                  value={correctionNotes}
                  onChange={(e) => setCorrectionNotes(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-white/[0.05] border border-white/10 text-white text-xs focus:outline-none focus:border-amber-400/60 transition-colors resize-none placeholder-white/30"
                  placeholder="e.g. Distinctive front fascia and exhaust layout show this is an M3 Competition, not base 3-Series."
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isSubmitting}
                  className="flex-1 py-2.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-white/70 hover:text-white text-xs font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !correctedMake.trim() || !correctedModel.trim()}
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 text-white text-xs font-bold shadow-lg disabled:opacity-50 transition-all"
                >
                  {isSubmitting ? 'Updating...' : 'Save Correction'}
                </button>
              </div>
            </form>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
