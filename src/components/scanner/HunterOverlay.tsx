import React from 'react';
import { Camera, X } from 'lucide-react';
import { ScanningReticle } from './ScanningReticle';
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
  onClose: () => void;
}

export const HunterOverlay: React.FC<HunterOverlayProps> = ({
  onShutterPress,
  onClose,
}) => {
  return (
    <div className="absolute inset-0 z-30 pointer-events-none flex flex-col justify-between overflow-hidden select-none font-sans">
      
      {/* 1. TOP HEADER (SAFE AREA COMPENSATED) */}
      <div className="relative z-20 pt-[calc(var(--sat,28px)+12px)] px-4 flex items-center justify-between pointer-events-auto">
        <button
          onClick={onClose}
          className="w-10 h-10 rounded-full bg-black/60 backdrop-blur-md border border-white/15 flex items-center justify-center text-white/80 hover:text-white active:scale-95 transition-all shadow-lg cursor-pointer"
          title="Exit"
          aria-label="Exit scanner"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2 bg-black/60 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-white/15 shadow-lg">
          <span className="w-2 h-2 rounded-full bg-[#E50914] animate-pulse" />
          <span className="text-xs font-semibold text-white tracking-wide">
            Live Viewfinder
          </span>
        </div>

        <div className="w-10 h-10" />
      </div>

      {/* 2. UNIFIED TARGETING RETICLE (Apex Red #E50914) */}
      <ScanningReticle isScanning={false} />

      {/* 3. BOTTOM ACTION CONTROLS (SAFE AREA COMPENSATED) */}
      <div className="relative z-20 pb-[calc(var(--sab,16px)+20px)] px-6 flex items-center justify-center pointer-events-auto max-w-xs mx-auto w-full">
        {/* Clean Shutter Trigger */}
        <button
          onClick={onShutterPress}
          className="w-18 h-18 rounded-full bg-[#E50914] hover:bg-[#DC2626] active:scale-92 border-4 border-white/30 flex items-center justify-center shadow-2xl transition-all cursor-pointer text-white"
          title="Capture Vehicle"
          aria-label="Capture Vehicle"
        >
          <Camera className="w-7 h-7" />
        </button>
      </div>
    </div>
  );
};
