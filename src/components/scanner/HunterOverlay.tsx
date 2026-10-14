import React, { useState, useEffect } from 'react';
import { Camera, X, SwitchCamera, Zap, ZapOff } from 'lucide-react';
import { ScanningReticle } from './ScanningReticle';
import { useApexStore } from '../../store/useApexStore';
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
  onSwitchCamera?: () => void;
  onToggleTorch?: () => void;
  hasTorch?: boolean;
  torchOn?: boolean;
  isRearCamera?: boolean;
  zoomLevel?: number;
  onSelectZoom?: (z: number) => void;
  isCameraReady?: boolean;
  isCapturing?: boolean;
}

export const HunterOverlay: React.FC<HunterOverlayProps> = ({
  onShutterPress,
  onClose,
  onSwitchCamera,
  onToggleTorch,
  hasTorch = false,
  torchOn = false,
  isRearCamera = true,
  zoomLevel = 1,
  onSelectZoom,
  isCameraReady = true,
  isCapturing = false
}) => {
  const zoomPresets = [1, 2, 3, 5];
  const activeTimedQuest = useApexStore(s => s.activeTimedQuest);
  const [remainingMs, setRemainingMs] = useState<number>(() => {
    return activeTimedQuest ? Math.max(0, activeTimedQuest.expiresAt - Date.now()) : 0;
  });

  useEffect(() => {
    if (!activeTimedQuest) return;
    const interval = setInterval(() => {
      const rem = Math.max(0, activeTimedQuest.expiresAt - Date.now());
      setRemainingMs(rem);
    }, 1000);
    return () => clearInterval(interval);
  }, [activeTimedQuest]);

  const formatRemainingTime = (ms: number) => {
    const totalSecs = Math.floor(ms / 1000);
    const m = Math.floor(totalSecs / 60);
    const s = totalSecs % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="absolute inset-0 z-30 pointer-events-none flex flex-col justify-between overflow-hidden select-none font-sans">
      
      {/* 1. TOP HEADER (SAFE AREA COMPENSATED) */}
      <div className="relative z-20 pt-[calc(var(--sat,24px)+12px)] px-4 flex items-center justify-between pointer-events-auto w-full">
        {/* Exit Button */}
        <button
          onClick={onClose}
          className="w-10 h-10 rounded-full bg-black/60 backdrop-blur-md border border-white/15 flex items-center justify-center text-white/90 hover:text-white active:scale-95 transition-all shadow-lg cursor-pointer"
          title="Exit Scanner"
          aria-label="Exit scanner"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Status Pill Badge */}
        <div className="flex items-center gap-2 bg-black/60 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-white/15 shadow-lg">
          <span className="w-2 h-2 rounded-full bg-[#E50914] animate-pulse" />
          <span className="text-xs font-semibold text-white tracking-wide">
            {isRearCamera ? 'Live Viewfinder' : 'Front Viewfinder'}
          </span>
        </div>

        {/* Top Right Action Cluster: Torch & Camera Switch */}
        <div className="flex items-center gap-2">
          {hasTorch && onToggleTorch && (
            <button
              onClick={onToggleTorch}
              className={`w-10 h-10 rounded-full backdrop-blur-md border flex items-center justify-center transition-all shadow-lg cursor-pointer active:scale-95 ${
                torchOn
                  ? 'bg-[#F59E0B] text-black border-[#F59E0B] shadow-[0_0_12px_rgba(245,158,11,0.6)]'
                  : 'bg-black/60 text-white/80 border-white/15 hover:text-white'
              }`}
              title={torchOn ? 'Turn Flash Off' : 'Turn Flash On'}
              aria-label="Toggle Flashlight"
            >
              {torchOn ? <Zap className="w-5 h-5 fill-current" /> : <ZapOff className="w-5 h-5" />}
            </button>
          )}

          {onSwitchCamera && (
            <button
              onClick={onSwitchCamera}
              className="w-10 h-10 rounded-full bg-black/60 backdrop-blur-md border border-white/15 flex items-center justify-center text-white/80 hover:text-white active:scale-95 transition-all shadow-lg cursor-pointer"
              title="Flip Camera (Front / Rear)"
              aria-label="Switch Camera"
            >
              <SwitchCamera className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* ACTIVE TIMED QUEST HUD BADGE */}
      {activeTimedQuest && remainingMs > 0 && (
        <div className="relative z-20 flex justify-center -mt-2 pointer-events-auto px-4">
          <div className="flex items-center gap-2.5 bg-black/85 backdrop-blur-xl border border-amber-500/40 px-4 py-1.5 rounded-full shadow-[0_0_24px_rgba(245,158,11,0.35)] animate-pulse">
            <div className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
            <span className="text-xs font-mono font-bold text-amber-300">
              ⚡ {formatRemainingTime(remainingMs)}
            </span>
            <span className="text-white/30 text-xs">|</span>
            <span className="text-[11px] font-bold text-white/90 truncate max-w-[150px]">
              {activeTimedQuest.currentCount}/{activeTimedQuest.targetCount} Spotted
            </span>
          </div>
        </div>
      )}

      {/* 2. UNIFIED TARGETING RETICLE (Apex Red #E50914) */}
      <ScanningReticle isScanning={false} />

      {/* 3. BOTTOM CONTROLS CLUSTER (SAFE AREA COMPENSATED) */}
      <div className="relative z-20 pb-[calc(var(--sab,16px)+16px)] px-6 flex flex-col items-center gap-4 pointer-events-auto w-full max-w-sm mx-auto">
        
        {/* Google Lens Style Zoom Pills */}
        {onSelectZoom && (
          <div className="flex items-center gap-1.5 bg-black/60 backdrop-blur-md px-2.5 py-1.5 rounded-full border border-white/15 shadow-xl">
            {zoomPresets.map((preset) => {
              const isActive = Math.abs(zoomLevel - preset) < 0.2;
              return (
                <button
                  key={preset}
                  onClick={() => onSelectZoom(preset)}
                  className={`min-w-8 h-7 px-2 rounded-full text-xs font-bold transition-all cursor-pointer ${
                    isActive
                      ? 'bg-[#E50914] text-white shadow-md scale-105'
                      : 'text-white/60 hover:text-white bg-white/5 active:scale-95'
                  }`}
                >
                  {preset}x
                </button>
              );
            })}

            {/* Custom intermediate zoom indicator badge if pinching */}
            {!zoomPresets.some((p) => Math.abs(zoomLevel - p) < 0.2) && (
              <span className="min-w-8 h-7 px-2 rounded-full text-xs font-bold bg-[#E50914] text-white shadow-md flex items-center justify-center">
                {zoomLevel.toFixed(1)}x
              </span>
            )}
          </div>
        )}

        {/* Primary Action Row: Spacer | Shutter | Spacer */}
        <div className="flex items-center justify-between w-full px-4">
          <div className="w-12 h-12" />

          {/* Shutter Button (Pixel/Google Lens style double ring) */}
          <button
            onClick={onShutterPress}
            disabled={!isCameraReady || isCapturing}
            className={`group relative w-20 h-20 rounded-full border-4 border-white/80 flex items-center justify-center transition-all shadow-[0_4px_20px_rgba(0,0,0,0.8)] ${
              !isCameraReady || isCapturing
                ? 'opacity-40 cursor-not-allowed'
                : 'cursor-pointer active:scale-90'
            }`}
            title={!isCameraReady ? 'Camera Initializing…' : isCapturing ? 'Capturing…' : 'Capture Vehicle'}
            aria-label="Capture Vehicle"
          >
            {/* Inner Vibrant Red Button */}
            <div className={`w-16 h-16 rounded-full bg-[#E50914] ${!isCameraReady || isCapturing ? '' : 'group-hover:bg-[#DC2626] group-active:scale-95'} transition-all flex items-center justify-center shadow-inner text-white`}>
              <Camera className="w-7 h-7" />
            </div>
          </button>

          {/* Symmetrical Spacer */}
          <div className="w-12 h-12" />
        </div>
      </div>
    </div>
  );
};
