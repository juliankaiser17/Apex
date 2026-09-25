import React, { useRef, useState, useCallback } from 'react';
import { Sun } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { FocusPoint } from '../../hooks/useNativeCamera';

interface FocusExposureReticleProps {
  focusPoint: FocusPoint | null;
  exposureValue: number;
  onExposureChange: (ev: number) => void;
}

export const FocusExposureReticle: React.FC<FocusExposureReticleProps> = React.memo(({
  focusPoint,
  exposureValue,
  onExposureChange
}) => {
  const [isDraggingExposure, setIsDraggingExposure] = useState(false);
  const dragStartYRef = useRef<number>(0);
  const startEvRef = useRef<number>(0);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    e.stopPropagation();
    setIsDraggingExposure(true);
    dragStartYRef.current = e.clientY;
    startEvRef.current = exposureValue;
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  }, [exposureValue]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDraggingExposure) return;
    e.stopPropagation();
    // Delta Y: dragging up (negative clientY) increases exposure
    const deltaY = dragStartYRef.current - e.clientY;
    // 60px of drag = 1.0 EV
    const evDelta = deltaY / 50;
    const newEv = Math.max(-2, Math.min(2, startEvRef.current + evDelta));
    onExposureChange(newEv);
  }, [isDraggingExposure, onExposureChange]);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    if (isDraggingExposure) {
      e.stopPropagation();
      setIsDraggingExposure(false);
      try {
        (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
      } catch {
        // Ignore
      }
    }
  }, [isDraggingExposure]);

  if (!focusPoint) return null;

  return (
    <AnimatePresence>
      <div
        className="absolute pointer-events-none select-none z-30"
        style={{
          left: focusPoint.x,
          top: focusPoint.y,
          transform: 'translate(-50%, -50%)'
        }}
      >
        {/* Google Lens / Camera Focus Ring */}
        <motion.div
          initial={{ scale: 1.35, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.85, opacity: 0 }}
          transition={{ type: 'spring', damping: 20, stiffness: 350 }}
          className="relative w-16 h-16 flex items-center justify-center pointer-events-none"
        >
          {/* 4 Corner Brackets in Apex Gold/Red */}
          <div className="absolute top-0 left-0 w-3.5 h-3.5 border-t-2 border-l-2 border-[#F59E0B] rounded-tl-sm shadow-[0_0_6px_rgba(245,158,11,0.6)]" />
          <div className="absolute top-0 right-0 w-3.5 h-3.5 border-t-2 border-r-2 border-[#F59E0B] rounded-tr-sm shadow-[0_0_6px_rgba(245,158,11,0.6)]" />
          <div className="absolute bottom-0 left-0 w-3.5 h-3.5 border-b-2 border-l-2 border-[#F59E0B] rounded-bl-sm shadow-[0_0_6px_rgba(245,158,11,0.6)]" />
          <div className="absolute bottom-0 right-0 w-3.5 h-3.5 border-b-2 border-r-2 border-[#F59E0B] rounded-br-sm shadow-[0_0_6px_rgba(245,158,11,0.6)]" />

          {/* Center Target Dot */}
          <div className="w-1.5 h-1.5 rounded-full bg-[#F59E0B] shadow-[0_0_5px_#F59E0B]" />
        </motion.div>

        {/* Vertical Exposure Adjustment Slider (Positioned directly beside the reticle) */}
        <div
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          className="absolute -right-8 top-1/2 -translate-y-1/2 h-24 w-8 flex flex-col items-center justify-center pointer-events-auto touch-none cursor-ns-resize"
          title="Drag up or down to adjust exposure"
        >
          {/* Subtle Vertical Track */}
          <div className="w-0.5 h-16 bg-white/30 rounded-full relative flex items-center justify-center">
            {/* Exposure Sun Handle */}
            <motion.div
              style={{
                // exposureValue from -2 to +2 maps to translateY +24px (bottom) to -24px (top)
                transform: `translateY(${-exposureValue * 12}px)`
              }}
              className="absolute w-5 h-5 rounded-full bg-[#F59E0B] flex items-center justify-center shadow-lg cursor-grab active:cursor-grabbing border border-black/40"
            >
              <Sun className="w-3.5 h-3.5 text-black" />
            </motion.div>
          </div>

          {/* Current EV readout badge if adjusted */}
          {exposureValue !== 0 && (
            <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 bg-black/80 backdrop-blur-md px-1.5 py-0.5 rounded text-[10px] font-mono font-bold text-[#F59E0B] border border-white/10 whitespace-nowrap shadow-md">
              {exposureValue > 0 ? `+${exposureValue.toFixed(1)}` : exposureValue.toFixed(1)}
            </div>
          )}
        </div>
      </div>
    </AnimatePresence>
  );
});

FocusExposureReticle.displayName = 'FocusExposureReticle';
