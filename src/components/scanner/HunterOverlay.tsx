import React from 'react';
import { Camera, X, SwitchCamera, Zap, ZapOff, Image as ImageIcon } from 'lucide-react';
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
  onSwitchCamera?: () => void;
  onToggleTorch?: () => void;
  hasTorch?: boolean;
  torchOn?: boolean;
  isRearCamera?: boolean;
  onOpenGallery?: () => void;
  zoomLevel?: number;
  onSelectZoom?: (z: number) => void;
}

export const HunterOverlay: React.FC<HunterOverlayProps> = ({
  onShutterPress,
  onClose,
  onSwitchCamera,
  onToggleTorch,
  hasTorch = false,
  torchOn = false,
  isRearCamera = true,
  onOpenGallery,
  zoomLevel = 1,
  onSelectZoom
}) => {
  const zoomPresets = [1, 2, 3, 5];

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

        {/* Primary Action Row: Gallery | Shutter | Spacer */}
        <div className="flex items-center justify-between w-full px-4">
          {/* Gallery Button */}
          {onOpenGallery ? (
            <button
              onClick={onOpenGallery}
              className="w-12 h-12 rounded-full bg-black/60 backdrop-blur-md border border-white/15 flex items-center justify-center text-white/80 hover:text-white active:scale-90 transition-all shadow-lg cursor-pointer"
              title="Upload from Photo Library"
              aria-label="Photo Library"
            >
              <ImageIcon className="w-5 h-5" />
            </button>
          ) : (
            <div className="w-12 h-12" />
          )}

          {/* Shutter Button (Pixel/Google Lens style double ring) */}
          <button
            onClick={onShutterPress}
            className="group relative w-20 h-20 rounded-full border-4 border-white/80 flex items-center justify-center transition-all cursor-pointer active:scale-90 shadow-[0_4px_20px_rgba(0,0,0,0.8)]"
            title="Capture Vehicle"
            aria-label="Capture Vehicle"
          >
            {/* Inner Vibrant Red Button */}
            <div className="w-16 h-16 rounded-full bg-[#E50914] group-hover:bg-[#DC2626] group-active:scale-95 transition-all flex items-center justify-center shadow-inner text-white">
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
