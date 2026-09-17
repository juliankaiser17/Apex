import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, 
  Camera, 
  ScanLine, 
  ImageIcon, 
  AlertCircle,
  Sparkles,
  ChevronRight
} from 'lucide-react';
import { Camera as CapCamera, CameraResultType, CameraSource } from '@capacitor/camera';
import { sounds } from '../../utils/audio';
import { hapticImpact, hapticWarning } from '../../utils/haptics';

interface SpatialCreationSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenScanner: () => void;
  onOpenMediaComposer: (initialPhotoUrl?: string) => void;
}

export const SpatialCreationSheet: React.FC<SpatialCreationSheetProps> = ({
  isOpen,
  onClose,
  onOpenScanner,
  onOpenMediaComposer
}) => {
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);

  if (!isOpen) return null;

  const handleLaunchScanner = () => {
    hapticImpact('medium');
    sounds.playTargetLock();
    onClose();
    onOpenScanner();
  };

  const handleTakeDirectPhoto = async () => {
    setPermissionError(null);
    setIsCameraActive(true);
    hapticImpact('medium');
    sounds.playShutter();

    try {
      // 1. Authoritatively request camera permissions natively on Android
      const permStatus = await CapCamera.requestPermissions();
      if (permStatus.camera !== 'granted' && permStatus.camera !== 'prompt-with-rationale') {
        hapticWarning();
        setPermissionError('Camera permission is required to capture photos directly. Please allow camera access in device settings.');
        setIsCameraActive(false);
        return;
      }

      // 2. Launch native Android camera capture
      const photo = await CapCamera.getPhoto({
        quality: 90,
        allowEditing: false,
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Camera
      });

      if (photo.dataUrl) {
        onClose();
        onOpenMediaComposer(photo.dataUrl);
      }
    } catch (err: any) {
      const msg = err?.message || String(err);
      if (!msg.toLowerCase().includes('cancel') && !msg.toLowerCase().includes('user cancelled')) {
        console.warn('[SpatialCreationSheet] Camera launch issue:', err);
        setPermissionError('Could not open camera. Please ensure permissions are granted or select an image from gallery.');
      }
    } finally {
      setIsCameraActive(false);
    }
  };

  const handleChooseFromGallery = () => {
    hapticImpact('light');
    sounds.playTargetLock();
    onClose();
    onOpenMediaComposer();
  };

  return createPortal(
    <AnimatePresence>
      <div className="fixed inset-0 z-[120] bg-black/80 backdrop-blur-md flex flex-col justify-end select-none font-sans">
        {/* Backdrop Dismiss */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0"
        />

        {/* Spatial Bottom Sheet */}
        <motion.div
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 28, stiffness: 320 }}
          className="relative z-10 w-full max-w-lg mx-auto bg-[#111111]/95 border-t border-x border-white/15 rounded-t-[32px] p-5 pb-safe shadow-2xl flex flex-col gap-4 overflow-hidden"
          style={{
            backdropFilter: 'blur(24px)',
            boxShadow: '0 -8px 40px rgba(0,0,0,0.8), 0 0 1px rgba(255,255,255,0.2)'
          }}
        >
          {/* Top Sheet Notch */}
          <div className="w-12 h-1.5 rounded-full bg-white/20 mx-auto -mt-1 mb-1" />

          {/* Header */}
          <div className="flex items-center justify-between pb-1 border-b border-white/[0.08]">
            <div className="flex items-center gap-2.5">
              <div 
                className="w-9 h-9 rounded-2xl flex items-center justify-center border border-white/10 shadow-lg"
                style={{ backgroundColor: 'rgba(229,9,20,0.15)' }}
              >
                <Sparkles className="w-4 h-4 text-[#E50914]" />
              </div>
              <div>
                <h3 className="font-display text-base font-bold text-white tracking-wide">
                  NEW APEX SPOT
                </h3>
                <p className="text-[11px] text-white/50">Choose how to document your find</p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="w-9 h-9 rounded-full bg-white/10 text-white/60 hover:text-white transition-colors flex items-center justify-center min-h-[44px] min-w-[44px]"
              aria-label="Close creation menu"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Permission Error Banner */}
          {permissionError && (
            <motion.div 
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-3 rounded-2xl bg-red-950/50 border border-red-500/40 text-red-200 text-xs flex items-start gap-2.5"
            >
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <span className="leading-relaxed flex-1">{permissionError}</span>
            </motion.div>
          )}

          {/* Action List */}
          <div className="space-y-2.5 pt-1">
            {/* OPTION 1 (HERO): Instant AI Vision Scanner */}
            <button
              onClick={handleLaunchScanner}
              className="w-full text-left p-4 rounded-2xl bg-gradient-to-r from-[#E50914]/20 via-[#E50914]/10 to-transparent border border-[#E50914]/40 hover:border-[#E50914] active:scale-[0.98] transition-all group flex items-center justify-between shadow-lg shadow-red-950/30 min-h-[64px]"
            >
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-[#E50914] text-white flex items-center justify-center shadow-lg shadow-red-950/50 shrink-0 group-hover:scale-105 transition-transform">
                  <ScanLine className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-display text-sm font-bold text-white tracking-wide">
                      AI VISION SCANNER
                    </span>
                    <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-[#E50914] text-white">
                      MINT CARD
                    </span>
                  </div>
                  <p className="text-xs text-white/70 leading-snug mt-0.5">
                    Live targeting HUD • Auto Make, Model & Specs
                  </p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-white/50 group-hover:text-white group-hover:translate-x-0.5 transition-all" />
            </button>

            {/* OPTION 2: Direct Native Camera Shoot */}
            <button
              onClick={handleTakeDirectPhoto}
              disabled={isCameraActive}
              className="w-full text-left p-4 rounded-2xl bg-[#181818] border border-white/10 hover:border-white/25 active:scale-[0.98] transition-all group flex items-center justify-between min-h-[60px]"
            >
              <div className="flex items-center gap-3.5">
                <div className="w-11 h-11 rounded-2xl bg-white/10 text-white flex items-center justify-center border border-white/10 shrink-0 group-hover:border-white/30 transition-colors">
                  <Camera className="w-5 h-5 text-white/90" />
                </div>
                <div>
                  <span className="font-display text-sm font-bold text-white tracking-wide block">
                    {isCameraActive ? 'Opening Camera…' : 'Take Vehicle Photo'}
                  </span>
                  <p className="text-xs text-white/50 leading-snug mt-0.5">
                    Capture a photo directly with camera for feed
                  </p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-white/40 group-hover:text-white group-hover:translate-x-0.5 transition-all" />
            </button>

            {/* OPTION 3: Media Gallery Import */}
            <button
              onClick={handleChooseFromGallery}
              className="w-full text-left p-4 rounded-2xl bg-[#181818] border border-white/10 hover:border-white/25 active:scale-[0.98] transition-all group flex items-center justify-between min-h-[60px]"
            >
              <div className="flex items-center gap-3.5">
                <div className="w-11 h-11 rounded-2xl bg-white/10 text-white flex items-center justify-center border border-white/10 shrink-0 group-hover:border-white/30 transition-colors">
                  <ImageIcon className="w-5 h-5 text-white/90" />
                </div>
                <div>
                  <span className="font-display text-sm font-bold text-white tracking-wide block">
                    Upload from Gallery
                  </span>
                  <p className="text-xs text-white/50 leading-snug mt-0.5">
                    Select rolling shots, video clips, or high-res edits
                  </p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-white/40 group-hover:text-white group-hover:translate-x-0.5 transition-all" />
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>,
    document.body
  );
};
