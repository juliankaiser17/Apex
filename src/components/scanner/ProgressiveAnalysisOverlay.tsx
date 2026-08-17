import React from 'react';
import { motion } from 'framer-motion';
import { Check, Loader2, Sparkles, ShieldCheck } from 'lucide-react';
import type { PipelineStageInfo } from '../../hooks/useScannerStateMachine';

interface ProgressiveAnalysisOverlayProps {
  photoUrl: string | null;
  stages: PipelineStageInfo[];
  currentStageIndex: number;
}

export const ProgressiveAnalysisOverlay: React.FC<ProgressiveAnalysisOverlayProps> = ({
  stages,
  currentStageIndex,
}) => {
  return (
    <div className="absolute inset-0 z-40 pointer-events-none flex flex-col justify-end p-4 pb-28 select-none">
      {/* Lightweight, Floating Glassmorphic Recognition Panel (Leaves 75-85% camera visible) */}
      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.95 }}
        transition={{ type: 'spring', stiffness: 320, damping: 28 }}
        className="w-full max-w-sm mx-auto bg-[#0C0C0C]/85 backdrop-blur-xl border border-white/15 rounded-3xl p-4 shadow-[0_12px_40px_rgba(0,0,0,0.8)] pointer-events-auto"
      >
        {/* Header with Mini Radar Ping */}
        <div className="flex items-center justify-between pb-3 border-b border-white/10">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-full border border-[#FF4500] flex items-center justify-center relative shadow-[0_0_10px_rgba(255,69,0,0.5)]">
              <Sparkles className="w-3 h-3 text-[#FF4500]" />
            </div>
            <div>
              <span className="text-[10px] font-data font-bold text-[#FF4500] uppercase tracking-[0.2em] block leading-tight">
                APEX RECOGNITION PIPELINE
              </span>
              <span className="text-xs font-data font-bold text-[#F0EBE3] tracking-wide block">
                PROCESSING EVIDENCE
              </span>
            </div>
          </div>

          <div className="px-2 py-0.5 rounded-full bg-[#FF4500]/15 border border-[#FF4500]/30 text-[9px] font-data font-bold text-[#FF4500]">
            STAGE {Math.min(5, currentStageIndex + 1)} / 5
          </div>
        </div>

        {/* Real-Time Processing Stages List */}
        <div className="space-y-1.5 pt-3">
          {stages.map((stage, idx) => {
            const isDone = stage.status === 'completed';
            const isCurrent = stage.status === 'in_progress' || idx === currentStageIndex;

            return (
              <motion.div
                key={stage.index}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.04 }}
                className={`flex items-center justify-between px-3 py-2 rounded-xl border transition-all ${
                  isDone
                    ? 'bg-[#142018]/70 border-[#2ECC71]/35 text-white'
                    : isCurrent
                    ? 'bg-[#20140A]/85 border-[#FF4500]/50 text-white shadow-[0_0_10px_rgba(255,69,0,0.15)]'
                    : 'bg-transparent border-transparent text-[#9A9088]/35'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                    isDone
                      ? 'bg-[#2ECC71] text-black'
                      : isCurrent
                      ? 'bg-[#FF4500] text-white animate-pulse'
                      : 'bg-[#222222] text-[#9A9088]'
                  }`}>
                    {isDone ? (
                      <Check className="w-3 h-3 stroke-[3]" />
                    ) : isCurrent ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      idx + 1
                    )}
                  </div>

                  <div>
                    <span className={`text-[11px] font-data font-bold tracking-wider uppercase block leading-tight ${
                      isDone ? 'text-[#F0EBE3]' : isCurrent ? 'text-[#FF4500]' : 'text-[#9A9088]'
                    }`}>
                      {stage.label}
                    </span>
                    <span className="text-[9px] text-[#9A9088] font-sans block truncate max-w-[200px] leading-tight">
                      {stage.detail}
                    </span>
                  </div>
                </div>

                {isDone && (
                  <ShieldCheck className="w-3.5 h-3.5 text-[#2ECC71] shrink-0" />
                )}
              </motion.div>
            );
          })}
        </div>

        {/* Verification Subtitle */}
        <div className="mt-2.5 pt-2 border-t border-white/5 flex items-center justify-between text-[9px] font-data text-[#9A9088]">
          <span>VERIFIED BY APEX AI</span>
          <span className="text-[#2ECC71]">OFFLINE / ONLINE MINT READY</span>
        </div>
      </motion.div>
    </div>
  );
};
