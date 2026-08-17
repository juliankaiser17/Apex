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
  photoUrl,
  stages,
  currentStageIndex,
}) => {
  return (
    <div className="relative flex-1 flex flex-col justify-center items-center p-6 text-center overflow-hidden select-none">
      {/* Frozen vehicle photograph in background with dark cinematic blur */}
      {photoUrl && (
        <img
          src={photoUrl}
          alt="Target Captured"
          className="absolute inset-0 w-full h-full object-cover filter blur-sm brightness-30 scale-105"
        />
      )}
      <div className="absolute inset-0 bg-[#080808]/80 backdrop-blur-md" />

      {/* Main Content Container */}
      <div className="relative z-10 w-full max-w-sm space-y-6">
        
        {/* Radar Spinner & Header */}
        <div className="flex flex-col items-center space-y-3">
          <div className="w-16 h-16 rounded-full border-2 border-[#FF4500] flex items-center justify-center relative shadow-[0_0_24px_rgba(255,69,0,0.5)]">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 1.5, ease: 'linear' }}
              className="w-full h-full rounded-full border-2 border-transparent border-t-[#FF4500]"
            />
            <Sparkles className="w-6 h-6 text-[#FF4500] absolute" />
          </div>

          <div>
            <span className="text-[11px] font-data font-bold text-[#FF4500] uppercase tracking-[0.25em] block">
              APEX RECOGNITION PIPELINE
            </span>
            <h2 className="font-display text-3xl text-white tracking-wide mt-1">
              ANALYZING TARGET
            </h2>
          </div>
        </div>

        {/* Real Pipeline Stages List (No Fake Bars) */}
        <div className="space-y-2.5 text-left bg-[#111111]/90 border border-white/10 rounded-2xl p-4 backdrop-blur-xl shadow-2xl">
          {stages.map((stage, idx) => {
            const isDone = stage.status === 'completed';
            const isCurrent = stage.status === 'in_progress' || idx === currentStageIndex;

            return (
              <motion.div
                key={stage.index}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.05 }}
                className={`flex items-center justify-between p-2.5 rounded-xl border transition-all ${
                  isDone
                    ? 'bg-[#142018]/80 border-[#2ECC71]/40 text-white'
                    : isCurrent
                    ? 'bg-[#20140A]/90 border-[#FF4500]/60 text-white shadow-[0_0_12px_rgba(255,69,0,0.2)]'
                    : 'bg-transparent border-transparent text-[#9A9088]/40'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                    isDone
                      ? 'bg-[#2ECC71] text-black shadow-[0_0_8px_#2ECC71]'
                      : isCurrent
                      ? 'bg-[#FF4500] text-white animate-pulse'
                      : 'bg-[#222222] text-[#9A9088]'
                  }`}>
                    {isDone ? (
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                    ) : isCurrent ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      idx + 1
                    )}
                  </div>

                  <div>
                    <span className={`text-xs font-data font-bold tracking-wider uppercase block ${
                      isDone ? 'text-[#F0EBE3]' : isCurrent ? 'text-[#FF4500]' : 'text-[#9A9088]'
                    }`}>
                      {stage.label}
                    </span>
                    <span className="text-[10px] text-[#9A9088] font-sans block truncate max-w-[210px]">
                      {stage.detail}
                    </span>
                  </div>
                </div>

                {isDone && (
                  <ShieldCheck className="w-4 h-4 text-[#2ECC71] shrink-0" />
                )}
              </motion.div>
            );
          })}
        </div>

        {/* Verification Notice */}
        <p className="text-[11px] font-data text-[#9A9088] text-center uppercase tracking-wider">
          Secured by Supabase RLS & Gemini 2.0 Vision Multimodal AI
        </p>
      </div>
    </div>
  );
};
