import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Image as ImageIcon, Navigation, Crosshair } from 'lucide-react';
import type { ApproachGuidance } from '../../services/hunterSceneEngine';
import type { ScannerPhase } from '../../hooks/useScannerStateMachine';

interface HunterOverlayProps {
  phase: ScannerPhase;
  guidance: ApproachGuidance;
  onShutterPress: () => void;
  onGalleryPick: () => void;
  onClose: () => void;
}

export const HunterOverlay: React.FC<HunterOverlayProps> = ({
  phase,
  guidance,
  onShutterPress,
  onGalleryPick,
  onClose,
}) => {
  const isLocked = phase === 'LOCKED' || phase === 'LOCKING';

  return (
    <div className="absolute inset-0 z-30 pointer-events-none flex flex-col justify-between overflow-hidden select-none">
      
      {/* 1. SIGNATURE TARGET LOCK VIGNETTE DIMMING */}
      <motion.div
        animate={{
          opacity: isLocked ? 0.6 : 0,
        }}
        transition={{ duration: 0.2 }}
        className="absolute inset-0 bg-[#080808] pointer-events-none z-0"
      />

      {/* 2. MINIMAL TOP HUD BAR (Progressive Disclosure) */}
      <div className="relative z-20 pt-4 px-4 flex items-center justify-between pointer-events-auto">
        <button
          onClick={onClose}
          className="w-10 h-10 rounded-full bg-[#111111]/80 backdrop-blur-md border border-[#2C2C2C] flex items-center justify-center text-[#F0EBE3] hover:border-[#FF4500] transition-colors"
          title="Exit Scanner"
        >
          <span className="text-sm font-data font-bold">✕</span>
        </button>

        {/* Minimal Subtle HUD Label */}
        <div className="flex items-center gap-2 bg-[#111111]/80 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-white/10">
          <span className="w-2 h-2 rounded-full bg-[#FF4500] animate-pulse" />
          <span className="text-[11px] font-data font-semibold text-[#F0EBE3] tracking-[0.2em] uppercase">
            APEX // VISION SCANNER
          </span>
        </div>

        <div className="w-10 h-10" />
      </div>

      {/* 3. SIGNATURE CENTRAL TARGETING RETICLE & CALIPERS */}
      <div className="relative z-10 my-auto mx-auto w-72 h-72 pointer-events-none flex items-center justify-center">
        <motion.div
          animate={{
            scale: isLocked ? 0.8 : 1,
            rotate: isLocked ? 90 : 360,
          }}
          transition={{
            rotate: { repeat: isLocked ? 0 : Infinity, duration: 720, ease: 'linear' },
            scale: { duration: 0.2, ease: 'easeOut' }
          }}
          className="absolute inset-0 flex items-center justify-center"
        >
          {/* Outer Ring */}
          <div className={`w-[220px] h-[220px] rounded-full border transition-all duration-300 relative ${
            isLocked ? 'border-[#FF4500] shadow-[0_0_24px_#FF4500]' : 'border-[#F0EBE3]/20'
          }`}>
            {/* 4 Corner Mechanical Calipers */}
            <div className={`absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-6 h-1 ${isLocked ? 'bg-[#FF4500]' : 'bg-[#080808]'}`} />
            <div className={`absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 w-6 h-1 ${isLocked ? 'bg-[#FF4500]' : 'bg-[#080808]'}`} />
            <div className={`absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1/2 h-6 w-1 ${isLocked ? 'bg-[#FF4500]' : 'bg-[#080808]'}`} />
            <div className={`absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 h-6 w-1 ${isLocked ? 'bg-[#FF4500]' : 'bg-[#080808]'}`} />
          </div>

          {/* Inner Precision Aperture */}
          <div className={`absolute w-[120px] h-[120px] rounded-full border transition-all duration-300 ${
            isLocked ? 'border-[#FF4500]/80 shadow-[0_0_12px_#FF4500]' : 'border-[#F0EBE3]/35'
          }`} />
        </motion.div>

        {/* Center Optical Resonance Dot */}
        <motion.div
          animate={{
            scale: isLocked ? [1, 1.8, 1.2] : 1,
            backgroundColor: '#FF4500'
          }}
          transition={{ duration: 0.2 }}
          className="w-2.5 h-2.5 rounded-full bg-[#FF4500] z-10 shadow-[0_0_12px_#FF4500]"
        />
      </div>

      {/* 4. CONTEXTUAL APPROACH GUIDANCE MICRO-PILL */}
      <div className="relative z-20 px-6 flex justify-center pb-2 pointer-events-none">
        <AnimatePresence mode="wait">
          {guidance.instruction && (
            <motion.div
              key={guidance.instruction}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className={`px-4 py-1.5 rounded-full backdrop-blur-md border text-xs font-data flex items-center gap-2 shadow-2xl ${
                guidance.severity === 'warning'
                  ? 'bg-[#1F1508]/90 border-[#FFA500]/60 text-[#FFA500]'
                  : guidance.severity === 'alert'
                  ? 'bg-[#200A0A]/90 border-[#FF3B30]/60 text-[#FF3B30]'
                  : 'bg-[#111111]/90 border-[#2C2C2C] text-[#F0EBE3]'
              }`}
            >
              <Navigation className="w-3.5 h-3.5 text-[#FF4500]" />
              <span className="font-semibold tracking-wider uppercase">{guidance.instruction}</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* 5. BOTTOM SHUTTER TRIGGER & CONTROLS */}
      <div className="relative z-20 pb-10 pt-3 flex flex-col items-center gap-3 bg-gradient-to-t from-[#080808] via-[#080808]/80 to-transparent pointer-events-auto">
        <div className="flex items-center gap-8">
          {/* Gallery Upload Button */}
          <button
            onClick={onGalleryPick}
            className="w-12 h-12 rounded-full bg-[#141414]/90 border border-[#2C2C2C] flex items-center justify-center text-[#F0EBE3] hover:border-[#FF4500] transition-colors"
            title="Import Photo from Device"
          >
            <ImageIcon className="w-5 h-5 text-[#FF4500]" />
          </button>

          {/* Precision Machined Shutter Button (76px ring + 62px inner core) */}
          <motion.button
            onClick={onShutterPress}
            whileTap={{ scale: 0.85, transition: { duration: 0.08 } }}
            className={`w-[78px] h-[78px] rounded-full border-2 bg-[#080808] flex items-center justify-center shrink-0 shadow-2xl transition-all ${
              isLocked
                ? 'border-[#FF4500] shadow-[0_0_30px_rgba(255,69,0,0.6)]'
                : 'border-[#F0EBE3]/60 hover:border-[#FF4500]'
            }`}
          >
            <motion.div
              className={`w-[62px] h-[62px] rounded-full flex items-center justify-center transition-colors ${
                isLocked ? 'bg-[#FF4500]' : 'bg-[#F0EBE3]'
              }`}
              whileTap={{ scale: 0.88, transition: { duration: 0.06 } }}
            >
              <Crosshair className={`w-7 h-7 ${isLocked ? 'text-white' : 'text-[#080808]'}`} />
            </motion.div>
          </motion.button>

          {/* Scanner Status indicator */}
          <div className="w-12 h-12 flex flex-col items-center justify-center text-center">
            <span className="text-[9px] font-data font-bold text-[#9A9088] uppercase tracking-wider block">
              STATUS
            </span>
            <span className="text-[11px] font-data font-bold text-[#2ECC71]">
              ONLINE
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
