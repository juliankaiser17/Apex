import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ZoomIn, ZoomOut, RotateCw, Check } from 'lucide-react';
import { sounds } from '../../utils/audio';

interface ImageCropModalProps {
  isOpen: boolean;
  imageSrc: string | null;
  onCropComplete: (croppedDataUrl: string) => void;
  onClose: () => void;
}

export const ImageCropModal: React.FC<ImageCropModalProps> = ({
  isOpen,
  imageSrc,
  onCropComplete,
  onClose
}) => {
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const imgRef = useRef<HTMLImageElement | null>(null);

  // Reset transform state when a new image is provided
  useEffect(() => {
    if (isOpen && imageSrc) {
      setZoom(1);
      setRotation(0);
      setPan({ x: 0, y: 0 });
    }
  }, [isOpen, imageSrc]);

  const handleImageLoaded = (e: React.SyntheticEvent<HTMLImageElement>) => {
    imgRef.current = e.currentTarget;
  };

  // Pan interaction
  const handlePointerDown = (e: React.PointerEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    setPan({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    setIsDragging(false);
    try {
      (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
    } catch (_) {}
  };

  const handleRotate = () => {
    sounds.playTargetLock();
    setRotation(prev => (prev + 90) % 360);
  };

  const handleApplyCrop = useCallback(() => {
    sounds.playTargetLock();
    if (!imgRef.current) return;

    const img = imgRef.current;
    const outputSize = 400; // High-res avatar output
    const canvas = document.createElement('canvas');
    canvas.width = outputSize;
    canvas.height = outputSize;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    // The crop circle in the viewport is 240px wide
    const viewportDiameter = 240;
    const scaleFactor = outputSize / viewportDiameter;

    ctx.save();
    // Center of canvas
    ctx.translate(outputSize / 2, outputSize / 2);

    // Apply rotation
    ctx.rotate((rotation * Math.PI) / 180);

    // Apply pan and zoom
    const drawWidth = (img.naturalWidth / Math.min(img.naturalWidth, img.naturalHeight)) * viewportDiameter * zoom * scaleFactor;
    const drawHeight = (img.naturalHeight / Math.min(img.naturalWidth, img.naturalHeight)) * viewportDiameter * zoom * scaleFactor;

    ctx.drawImage(
      img,
      -drawWidth / 2 + pan.x * scaleFactor,
      -drawHeight / 2 + pan.y * scaleFactor,
      drawWidth,
      drawHeight
    );

    ctx.restore();

    const croppedResult = canvas.toDataURL('image/jpeg', 0.88);
    onCropComplete(croppedResult);
    onClose();
  }, [zoom, rotation, pan, onCropComplete, onClose]);

  if (!isOpen || !imageSrc) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-xl select-none font-sans">
        <motion.div
          initial={{ opacity: 0, scale: 0.94 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.94 }}
          transition={{ duration: 0.2 }}
          className="relative w-full max-w-sm rounded-3xl bg-[#121212] border border-white/[0.12] p-5 shadow-2xl flex flex-col items-center space-y-4 overflow-hidden"
        >
          {/* Header */}
          <div className="w-full flex items-center justify-between border-b border-white/[0.08] pb-3">
            <div className="flex items-center gap-2">
              <div 
                className="w-2.5 h-2.5 rounded-full shadow-[0_0_8px_currentColor]"
                style={{ backgroundColor: 'var(--accent-color)', color: 'var(--accent-color)' }}
              />
              <h3 className="text-base font-bold text-white tracking-tight">
                Crop Profile Picture
              </h3>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.08] flex items-center justify-center text-white/60 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Interactive Crop Viewport */}
          <div 
            className="relative w-[260px] h-[260px] rounded-2xl bg-black overflow-hidden border border-white/[0.1] flex items-center justify-center cursor-grab active:cursor-grabbing touch-none"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
          >
            {/* The Image being transformed */}
            <div 
              className="absolute pointer-events-none transition-transform duration-75"
              style={{
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom}) rotate(${rotation}deg)`,
                transformOrigin: 'center center',
                willChange: 'transform'
              }}
            >
              <img
                ref={imgRef}
                src={imageSrc}
                alt="Crop preview"
                onLoad={handleImageLoaded}
                crossOrigin="anonymous"
                className="max-w-none w-[240px] h-[240px] object-cover"
                draggable={false}
              />
            </div>

            {/* Circular Vignette Overlay (Darkened outer edges with transparent circular aperture) */}
            <div 
              className="absolute inset-0 pointer-events-none rounded-2xl"
              style={{
                background: 'radial-gradient(circle at center, transparent 110px, rgba(0,0,0,0.75) 112px)',
                boxShadow: 'inset 0 0 0 2px var(--accent-color)'
              }}
            />

            {/* Subtle Crosshair Guidelines */}
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              <div className="w-[220px] h-[220px] rounded-full border border-white/25 border-dashed" />
            </div>
          </div>

          {/* Controls: Zoom & Rotate */}
          <div className="w-full space-y-3 pt-1">
            {/* Zoom Slider */}
            <div className="flex items-center gap-3 px-2">
              <ZoomOut className="w-4 h-4 text-white/50" />
              <input
                type="range"
                min="0.8"
                max="3"
                step="0.05"
                value={zoom}
                onChange={(e) => setZoom(parseFloat(e.target.value))}
                className="flex-1 accent-[var(--accent-color)] h-1.5 bg-white/10 rounded-lg cursor-pointer"
                style={{ accentColor: 'var(--accent-color)' }}
              />
              <ZoomIn className="w-4 h-4 text-white/50" />
            </div>

            {/* Quick Actions */}
            <div className="flex items-center justify-between text-xs text-white/60 px-2">
              <span className="text-[11px] font-data">
                {Math.round(zoom * 100)}% Zoom
              </span>
              <button
                type="button"
                onClick={handleRotate}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] text-white/80 transition-colors border border-white/[0.08]"
              >
                <RotateCw className="w-3.5 h-3.5" />
                <span>Rotate 90°</span>
              </button>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="w-full flex items-center gap-2.5 pt-2 border-t border-white/[0.08]">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 rounded-xl bg-white/[0.08] hover:bg-white/[0.12] text-white text-xs font-semibold transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleApplyCrop}
              className="flex-1 py-3 rounded-xl text-white text-xs font-bold transition-all shadow-lg flex items-center justify-center gap-1.5 active:scale-95"
              style={{
                backgroundColor: 'var(--accent-color)',
                boxShadow: '0 4px 15px var(--accent-glow)'
              }}
            >
              <Check className="w-4 h-4" />
              <span>Apply Crop</span>
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
