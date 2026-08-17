import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Image as ImageIcon, Navigation, Crosshair, Sparkles } from 'lucide-react';
import type { HunterTargetCandidate, ApproachGuidance } from '../../services/hunterSceneEngine';
import type { ScannerPhase } from '../../hooks/useScannerStateMachine';

interface HunterOverlayProps {
  phase: ScannerPhase;
  hasVehicle: boolean;
  candidates: HunterTargetCandidate[];
  primaryTarget: HunterTargetCandidate | null;
  guidance: ApproachGuidance;
  onSelectTarget: (targetId: string) => void;
  onShutterPress: () => void;
  onGalleryPick: () => void;
  onClose: () => void;
}

export const HunterOverlay: React.FC<HunterOverlayProps> = ({
  phase,
  hasVehicle,
  candidates,
  primaryTarget,
  guidance,
  onSelectTarget,
  onShutterPress,
  onGalleryPick,
  onClose,
}) => {
  const isLocked = phase === 'LOCKED' || phase === 'LOCKING';
  const isPotentialDiscovery = phase === 'POTENTIAL_DISCOVERY' || phase === 'TRACKING';

  return (
    <div className="absolute inset-0 z-30 pointer-events-none flex flex-col justify-between overflow-hidden select-none">
      
      {/* 1. SIGNATURE TARGET LOCK VIGNETTE DIMMING */}
      <motion.div
        animate={{
          opacity: isLocked ? 0.45 : 0,
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

        {/* Minimal Subtle Hunter Tag */}
        <div className="flex items-center gap-2 bg-[#111111]/80 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-white/10">
          <span className={`w-2 h-2 rounded-full ${hasVehicle ? 'bg-[#FF4500] animate-pulse' : 'bg-[#9A9088]'}`} />
          <span className="text-[11px] font-data font-semibold text-[#F0EBE3] tracking-[0.2em] uppercase">
            APEX // HUNTER MODE
          </span>
        </div>

        <div className="w-10 h-10" />
      </div>

      {/* 3. CONTEXT-AWARE VEHICLE TARGET RETICLES (Only rendered when a vehicle is detected) */}
      <AnimatePresence>
        {hasVehicle && candidates.map((cand) => {
          const isSelected = primaryTarget?.id === cand.id;
          return (
            <motion.div
              key={cand.id}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.25 }}
              onClick={(e) => {
                e.stopPropagation();
                onSelectTarget(cand.id);
              }}
              style={{
                left: `${cand.x}%`,
                top: `${cand.y}%`,
                transform: 'translate(-50%, -50%)'
              }}
              className="absolute pointer-events-auto cursor-pointer z-10"
            >
              <div className="relative flex flex-col items-center">
                {/* Subtle Diamond Target Geometry */}
                <motion.div
                  animate={{
                    scale: isSelected ? (isLocked ? 1.15 : 1.05) : 0.85,
                    rotate: isSelected ? 45 : 0
                  }}
                  transition={{ duration: 0.2 }}
                  className={`w-10 h-10 rounded-lg border-2 flex items-center justify-center transition-colors ${
                    isSelected
                      ? isLocked
                        ? 'border-[#FF4500] bg-[#FF4500]/25 shadow-[0_0_20px_#FF4500]'
                        : 'border-[#FF4500] bg-[#FF4500]/10 shadow-[0_0_12px_rgba(255,69,0,0.5)]'
                      : 'border-[#F0EBE3]/40 bg-black/40 hover:border-[#FF4500]'
                  }`}
                >
                  <span className={`text-[10px] font-data font-bold -rotate-45 ${
                    isSelected ? 'text-[#FF4500]' : 'text-[#F0EBE3]'
                  }`}>
                    #{cand.index < 10 ? `0${cand.index}` : cand.index}
                  </span>
                </motion.div>

                {/* "POTENTIAL DISCOVERY" Badge (ONLY rendered when vehicle exists and confidence is stable) */}
                {isSelected && isPotentialDiscovery && (
                  <motion.div
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 5 }}
                    className="absolute -bottom-7 whitespace-nowrap bg-[#111111]/90 backdrop-blur-md px-2.5 py-0.5 rounded-full border border-[#FF4500]/50 flex items-center gap-1.5 shadow-lg"
                  >
                    <Sparkles className="w-3 h-3 text-[#FF4500]" />
                    <span className="text-[10px] font-data font-bold text-[#F0EBE3] tracking-wider uppercase">
                      POTENTIAL DISCOVERY
                    </span>
                  </motion.div>
                )}
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>

      {/* 4. SIGNATURE MINIMAL RETICLE (Clean & Unobtrusive) */}
      <div className="relative z-10 my-auto mx-auto w-64 h-64 pointer-events-none flex items-center justify-center">
        <motion.div
          animate={{
            scale: isLocked ? 0.75 : hasVehicle ? 0.9 : 1,
            rotate: isLocked ? 90 : 360,
          }}
          transition={{
            rotate: { repeat: isLocked ? 0 : Infinity, duration: 720, ease: 'linear' },
            scale: { duration: 0.25, ease: 'easeOut' }
          }}
          className="absolute inset-0 flex items-center justify-center"
        >
          {/* Outer Ring */}
          <div className={`w-[200px] h-[200px] rounded-full border transition-all duration-300 relative ${
            isLocked
              ? 'border-[#FF4500] shadow-[0_0_24px_#FF4500]'
              : hasVehicle
              ? 'border-[#FF4500]/40'
              : 'border-[#F0EBE3]/15'
          }`}>
            {/* 4 Corner Calipers */}
            <div className={`absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-5 h-0.5 ${isLocked ? 'bg-[#FF4500]' : hasVehicle ? 'bg-[#FF4500]/60' : 'bg-[#F0EBE3]/20'}`} />
            <div className={`absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 w-5 h-0.5 ${isLocked ? 'bg-[#FF4500]' : hasVehicle ? 'bg-[#FF4500]/60' : 'bg-[#F0EBE3]/20'}`} />
            <div className={`absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1/2 h-5 w-0.5 ${isLocked ? 'bg-[#FF4500]' : hasVehicle ? 'bg-[#FF4500]/60' : 'bg-[#F0EBE3]/20'}`} />
            <div className={`absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 h-5 w-0.5 ${isLocked ? 'bg-[#FF4500]' : hasVehicle ? 'bg-[#FF4500]/60' : 'bg-[#F0EBE3]/20'}`} />
          </div>

          {/* Center Precision Aperture */}
          <div className={`absolute w-[100px] h-[100px] rounded-full border transition-all duration-300 ${
            isLocked ? 'border-[#FF4500]/80 shadow-[0_0_12px_#FF4500]' : hasVehicle ? 'border-[#FF4500]/30' : 'border-[#F0EBE3]/20'
          }`} />
        </motion.div>

        {/* Center Optical Resonance Dot */}
        <motion.div
          animate={{
            scale: isLocked ? [1, 1.8, 1.2] : hasVehicle ? 1.2 : 1,
            backgroundColor: hasVehicle ? '#FF4500' : 'rgba(240, 235, 227, 0.4)'
          }}
          transition={{ duration: 0.2 }}
          className="w-2 h-2 rounded-full z-10"
        />
      </div>

      {/* 5. CONTEXTUAL APPROACH GUIDANCE MICRO-PILL (Only when prompt exists) */}
      <div className="relative z-20 px-6 flex justify-center pb-2 pointer-events-none min-h-[32px]">
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
                  : 'bg-[#111111]/90 border-[#2C2C2C] text-[#F0EBE3]'
              }`}
            >
              <Navigation className="w-3.5 h-3.5 text-[#FF4500]" />
              <span className="font-semibold tracking-wider uppercase">{guidance.instruction}</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* 6. BOTTOM SHUTTER TRIGGER & CONTROLS */}
      <div className="relative z-20 pb-10 pt-3 flex flex-col items-center gap-3 bg-gradient-to-t from-[#080808] via-[#080808]/70 to-transparent pointer-events-auto">
        <div className="flex items-center gap-8">
          {/* Gallery Upload Button */}
          <button
            onClick={onGalleryPick}
            className="w-12 h-12 rounded-full bg-[#141414]/90 border border-[#2C2C2C] flex items-center justify-center text-[#F0EBE3] hover:border-[#FF4500] transition-colors"
            title="Import Photo from Device"
          >
            <ImageIcon className="w-5 h-5 text-[#FF4500]" />
          </button>

          {/* Precision Machined Shutter Button */}
          <motion.button
            onClick={onShutterPress}
            whileTap={{ scale: 0.85, transition: { duration: 0.08 } }}
            className={`w-[78px] h-[78px] rounded-full border-2 bg-[#080808] flex items-center justify-center shrink-0 shadow-2xl transition-all ${
              isLocked || hasVehicle
                ? 'border-[#FF4500] shadow-[0_0_30px_rgba(255,69,0,0.6)]'
                : 'border-[#F0EBE3]/50 hover:border-[#FF4500]'
            }`}
          >
            <motion.div
              className={`w-[62px] h-[62px] rounded-full flex items-center justify-center transition-colors ${
                isLocked || hasVehicle ? 'bg-[#FF4500]' : 'bg-[#F0EBE3]'
              }`}
              whileTap={{ scale: 0.88, transition: { duration: 0.06 } }}
            >
              <Crosshair className={`w-7 h-7 ${isLocked || hasVehicle ? 'text-white' : 'text-[#080808]'}`} />
            </motion.div>
          </motion.button>

          {/* Scanner Status indicator */}
          <div className="w-12 h-12 flex flex-col items-center justify-center text-center">
            <span className="text-[9px] font-data font-bold text-[#9A9088] uppercase tracking-wider block">
              STATUS
            </span>
            <span className={`text-[11px] font-data font-bold ${hasVehicle ? 'text-[#2ECC71]' : 'text-[#9A9088]'}`}>
              {hasVehicle ? 'LOCKED' : 'SEARCH'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
