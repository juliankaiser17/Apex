import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Shield, Lock, Eye, Users, MapPin } from 'lucide-react';
import { useApexStore } from '../../store/useApexStore';
import { PRIVACY_LEVEL_LABELS } from '../../utils/privacyPipeline';
import type { PrivacyLevel } from '../../utils/privacyPipeline';
import { sounds } from '../../utils/audio';

interface ProfileSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ProfileSettingsModal: React.FC<ProfileSettingsModalProps> = ({ isOpen, onClose }) => {
  const { user, setDefaultPrivacyLevel } = useApexStore();

  if (!isOpen) return null;

  const privacyOptions: { id: PrivacyLevel; icon: React.ReactNode }[] = [
    { id: 'public_blurred', icon: <Eye className="w-5 h-5 text-emerald-400" /> },
    { id: 'friends_only', icon: <Users className="w-5 h-5 text-blue-400" /> },
    { id: 'approximate_only', icon: <MapPin className="w-5 h-5 text-amber-400" /> },
    { id: 'no_hunt_private', icon: <Lock className="w-5 h-5 text-rose-400" /> }
  ];

  const handleSelectLevel = (level: PrivacyLevel) => {
    sounds.playTargetLock();
    setDefaultPrivacyLevel(level);
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-end justify-center p-4">
        <motion.div
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 220 }}
          className="w-full max-w-md bg-[#111111] border border-white/10 rounded-3xl p-6 space-y-6 shadow-2xl"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-white/10 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-orange-950/60 border border-orange-500/40 text-[#FF5500]">
                <Shield className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-display text-2xl text-white">PRIVACY & LOCATION</h3>
                <p className="text-xs font-mono text-slate-400">1.5–2.2km spatial blur active by default</p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* 4 Privacy Levels Selection Stack */}
          <div className="space-y-3">
            {privacyOptions.map((opt) => {
              const info = PRIVACY_LEVEL_LABELS[opt.id];
              const isSelected = user.defaultPrivacyLevel === opt.id;
              return (
                <div
                  key={opt.id}
                  onClick={() => handleSelectLevel(opt.id)}
                  className={`p-4 rounded-2xl cursor-pointer border transition-all flex items-start gap-3.5 ${
                    isSelected
                      ? 'bg-gradient-to-r from-[#FF5500]/20 via-[#1A1A1A] to-[#111111] border-[#FF5500] shadow-[0_0_20px_rgba(255,85,0,0.3)]'
                      : 'bg-white/5 border-white/10 hover:border-white/20'
                  }`}
                >
                  <div className="p-2 rounded-xl bg-white/5 border border-white/10 shrink-0">
                    {opt.icon}
                  </div>

                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <h4 className="font-semibold text-white text-sm">{info.name}</h4>
                      <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${
                        isSelected ? 'bg-[#FF5500] text-white' : 'bg-white/10 text-slate-400'
                      }`}>
                        {info.badge}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-1 leading-relaxed">{info.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Location Hygiene Guarantee Note */}
          <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 text-slate-400 text-xs font-mono space-y-1">
            <p className="font-bold text-slate-300">🛡 APEX PRIVACY GUARANTEE:</p>
            <p className="leading-normal">
              Your exact GPS coordinates are NEVER stored on our servers. Live position is processed client-side only during active hunts. Hunt notifications have a 15-minute delay.
            </p>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
