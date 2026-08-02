import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldAlert, Clock, X, ChevronRight } from 'lucide-react';
import { useApexStore } from '../../store/useApexStore';
import { RARITY_CONFIG } from '../../utils/rarity';

export const ActiveHuntNotification: React.FC = () => {
  const { activeHuntAlert, dismissHuntAlert, openHuntModal } = useApexStore();
  const [timeLeft, setTimeLeft] = useState(262); // ~4m 22s

  useEffect(() => {
    if (!activeHuntAlert) return;
    const interval = setInterval(() => {
      setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [activeHuntAlert]);

  if (!activeHuntAlert) return null;

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const formattedTime = `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;

  const rarityConf = RARITY_CONFIG[activeHuntAlert.rarity];

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -50 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -50 }}
        className="fixed top-16 left-4 right-4 z-40 max-w-md mx-auto"
      >
        <div className="bg-gradient-to-r from-rose-950 via-slate-900 to-slate-950 border-2 border-rose-500 rounded-3xl p-4 shadow-[0_0_30px_rgba(255,23,68,0.5)] flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-rose-900/80 text-rose-300 animate-pulse">
            <ShieldAlert className="w-6 h-6" />
          </div>

          <div className="flex-1">
            <div className="flex items-center justify-between">
              <span className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded border ${rarityConf.badgeBg}`}>
                🚨 RARE HUNT SPOTTED
              </span>
              <span className="text-xs font-mono font-bold text-rose-400 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" /> {formattedTime}
              </span>
            </div>

            <h4 className="font-display text-xl text-white mt-0.5">{activeHuntAlert.carName}</h4>
            <p className="text-xs text-slate-300 font-mono">Spotted 0.4 km away in {activeHuntAlert.city}</p>
          </div>

          <button
            onClick={() => {
              dismissHuntAlert();
              openHuntModal(activeHuntAlert);
            }}
            className="p-3 rounded-2xl bg-[#FF5500] hover:bg-orange-600 text-white font-display text-xs tracking-wider flex items-center gap-1 shadow-lg"
          >
            HUNT <ChevronRight className="w-4 h-4" />
          </button>

          <button
            onClick={dismissHuntAlert}
            className="text-slate-400 hover:text-white p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
