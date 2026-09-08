import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { PipelineStageInfo } from '../../hooks/useScannerStateMachine';
import type { CarCard } from '../../types/apex';
import { ScanningReticle } from './ScanningReticle';

interface ProgressiveAnalysisOverlayProps {
  photoUrl: string | null;
  stages: PipelineStageInfo[];
  currentStageIndex: number;
  previewCard?: Partial<CarCard> | null;
}

export const ProgressiveAnalysisOverlay: React.FC<ProgressiveAnalysisOverlayProps> = React.memo(({
  photoUrl,
  currentStageIndex = 0,
  previewCard,
}) => {
  const hasResolvedCar = Boolean(previewCard && previewCard.make && previewCard.model);

  return (
    <div className="absolute inset-0 z-40 flex flex-col justify-between pt-[calc(var(--sat,28px)+16px)] pb-[calc(var(--sab,16px)+24px)] px-6 select-none overflow-hidden font-sans">
      
      {/* 1. FROZEN CAPTURED PHOTO BACKDROP (Zero live camera movement during analysis) */}
      {photoUrl && (
        <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden bg-black">
          <img
            src={photoUrl}
            alt="Captured vehicle frame"
            className="w-full h-full object-cover"
          />
          {/* Subtle dark vignette overlay for scanning contrast */}
          <div className="absolute inset-0 bg-black/40" />
        </div>
      )}

      {/* 2. TOP STATUS PILL (Independent real-time visual telemetry) */}
      <div className="relative z-30 pt-4 flex justify-center pointer-events-none">
        <div className="flex items-center gap-2 bg-black/75 backdrop-blur-md px-4 py-1.5 rounded-full border border-white/15 shadow-xl">
          <span className="w-2 h-2 rounded-full bg-[#E50914] animate-pulse" />
          <span className="text-xs font-semibold text-white tracking-wide">
            {currentStageIndex >= 3
              ? 'Verifying Vehicle Details…'
              : currentStageIndex >= 1
              ? 'Matching Neural Telemetry…'
              : 'Analyzing Visual Geometry…'}
          </span>
        </div>
      </div>

      {/* 3. UNIFIED SCANNING RETICLE + LASER SCAN LINE (Apex Red #E50914) */}
      <div className="relative z-20 pointer-events-none my-auto">
        <ScanningReticle isScanning={true} />
      </div>

      {/* 4. BOTTOM TELEMETRY CARD */}
      <div className="relative z-30 pb-12 max-w-xs mx-auto w-full pointer-events-none">
        <AnimatePresence mode="wait">
          {hasResolvedCar ? (
            <motion.div
              key="resolved"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-black/85 backdrop-blur-xl border border-white/15 rounded-2xl p-4 space-y-2 text-center shadow-2xl"
            >
              <div>
                <span className="text-[11px] font-medium text-white/50 uppercase tracking-wider block">
                  {previewCard?.make}
                </span>
                <h2 className="text-xl font-bold text-white tracking-tight">
                  {previewCard?.model}
                </h2>
              </div>

              <div className="flex items-center justify-center gap-3 text-xs font-medium text-white/80 pt-1 border-t border-white/10">
                {previewCard?.horsepower && <span>{previewCard.horsepower} hp</span>}
                {previewCard?.topSpeedKmH && (
                  <>
                    <div className="w-1 h-1 rounded-full bg-white/30" />
                    <span>{previewCard.topSpeedKmH} km/h</span>
                  </>
                )}
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="analyzing"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-black/80 backdrop-blur-xl border border-white/10 rounded-2xl p-3.5 space-y-1 text-center shadow-xl"
            >
              <span className="text-xs font-semibold text-white/90 block">
                Optical Recognition in Progress
              </span>
              <p className="text-[11px] text-white/50">
                Extracting body curves, wheels, and badge geometry…
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
});

ProgressiveAnalysisOverlay.displayName = 'ProgressiveAnalysisOverlay';
