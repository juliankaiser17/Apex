import React from 'react';
import { motion } from 'framer-motion';

export type ScannerHudStatus = 'idle' | 'aiming' | 'locking' | 'scanning' | 'identified' | 'uncertain';

export interface ScanningReticleProps {
  isScanning?: boolean;
  status?: ScannerHudStatus;
  makeName?: string;
}

export const ScanningReticle: React.FC<ScanningReticleProps> = React.memo(({ 
  isScanning = false,
  status: statusProp,
  makeName
}) => {
  // Compute effective state with backward compatibility for isScanning boolean
  const currentStatus: ScannerHudStatus = statusProp || (isScanning ? 'scanning' : 'idle');
  const isActivelyScanning = currentStatus === 'scanning' || isScanning;

  // Color selection based on status state
  const reticleColor = currentStatus === 'identified'
    ? 'var(--color-ok)'
    : currentStatus === 'uncertain'
    ? 'var(--color-xp)'
    : 'var(--color-accent)';

  return (
    <div className="relative my-auto w-[320px] max-w-[85vw] h-[260px] mx-auto pointer-events-none flex flex-col justify-between select-none">
      
      {/* ─── 1. TOP RANGEFINDER TELEMETRY STRIP ─── */}
      <div className="flex justify-between items-center px-1 text-[9px] font-mono tracking-widest text-[var(--color-text-3)] drop-shadow-[0_1px_3px_rgba(0,0,0,0.95)]">
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: reticleColor }} />
          <span className="uppercase text-[var(--color-text-2)] font-bold">
            {currentStatus === 'scanning' ? 'ANALYZING' : currentStatus === 'locking' ? 'TARGET LOCK' : 'AF-C OPTIC'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {makeName && (
            <span className="text-[var(--color-text)] font-bold tracking-wider uppercase">
              {makeName}
            </span>
          )}
          <span>35MM // F2.8</span>
        </div>
      </div>

      {/* ─── 2. RANGEFINDER CORNER BRACKETS WITH PRECISION TICKS ─── */}
      <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
        {/* Top Corners */}
        <div className="flex justify-between items-start">
          {/* Top Left */}
          <div className="relative">
            <div 
              className="w-9 h-9 border-t-[2.5px] border-l-[2.5px] rounded-tl-lg drop-shadow-[0_1px_4px_rgba(0,0,0,0.95)] transition-colors duration-300"
              style={{ borderColor: reticleColor }}
            />
            {/* Rangefinder Tick Mark */}
            <div 
              className="absolute top-0 left-5 w-[1.5px] h-2 drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]"
              style={{ backgroundColor: reticleColor }}
            />
          </div>

          {/* Top Right */}
          <div className="relative">
            <div 
              className="w-9 h-9 border-t-[2.5px] border-r-[2.5px] rounded-tr-lg drop-shadow-[0_1px_4px_rgba(0,0,0,0.95)] transition-colors duration-300"
              style={{ borderColor: reticleColor }}
            />
            {/* Rangefinder Tick Mark */}
            <div 
              className="absolute top-0 right-5 w-[1.5px] h-2 drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]"
              style={{ backgroundColor: reticleColor }}
            />
          </div>
        </div>

        {/* Bottom Corners */}
        <div className="flex justify-between items-end">
          {/* Bottom Left */}
          <div className="relative">
            {/* Rangefinder Tick Mark */}
            <div 
              className="absolute bottom-0 left-5 w-[1.5px] h-2 drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]"
              style={{ backgroundColor: reticleColor }}
            />
            <div 
              className="w-9 h-9 border-b-[2.5px] border-l-[2.5px] rounded-bl-lg drop-shadow-[0_1px_4px_rgba(0,0,0,0.95)] transition-colors duration-300"
              style={{ borderColor: reticleColor }}
            />
          </div>

          {/* Bottom Right */}
          <div className="relative">
            {/* Rangefinder Tick Mark */}
            <div 
              className="absolute bottom-0 right-5 w-[1.5px] h-2 drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]"
              style={{ backgroundColor: reticleColor }}
            />
            <div 
              className="w-9 h-9 border-b-[2.5px] border-r-[2.5px] rounded-br-lg drop-shadow-[0_1px_4px_rgba(0,0,0,0.95)] transition-colors duration-300"
              style={{ borderColor: reticleColor }}
            />
          </div>
        </div>
      </div>

      {/* ─── 3. CENTRAL APERTURE RING & MICRO-RETICLE ─── */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none flex items-center justify-center">
        {/* Outer Dotted Aperture Ring */}
        <motion.div
          animate={isActivelyScanning ? { rotate: 360 } : { rotate: 0 }}
          transition={isActivelyScanning ? { repeat: Infinity, duration: 6, ease: 'linear' } : { duration: 0.3 }}
          className="w-20 h-20 rounded-full border border-dashed opacity-40 drop-shadow-[0_1px_4px_rgba(0,0,0,0.9)]"
          style={{ borderColor: reticleColor }}
        />

        {/* Inner Aperture Blades Guide */}
        <motion.div
          animate={isActivelyScanning ? { scale: [1, 1.1, 1], opacity: [0.5, 0.85, 0.5] } : { scale: 1, opacity: 0.35 }}
          transition={isActivelyScanning ? { repeat: Infinity, duration: 1.6, ease: 'easeInOut' } : { duration: 0.2 }}
          className="absolute w-12 h-12 rounded-full border opacity-50 drop-shadow-[0_0_8px_rgba(0,0,0,0.8)]"
          style={{ borderColor: reticleColor }}
        />

        {/* Center Target Dot */}
        <div 
          className="absolute w-2 h-2 rounded-full drop-shadow-[0_0_4px_rgba(0,0,0,0.95)]"
          style={{ backgroundColor: reticleColor }}
        />

        {/* Horizontal Hairlines */}
        <div 
          className="absolute left-[-16px] w-3 h-[1px] opacity-60"
          style={{ backgroundColor: reticleColor }}
        />
        <div 
          className="absolute right-[-16px] w-3 h-[1px] opacity-60"
          style={{ backgroundColor: reticleColor }}
        />
      </div>

      {/* ─── 4. VERTICAL LASER SCAN SWEEP (Active Analysis Mode) ─── */}
      {isActivelyScanning && (
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <motion.div
            animate={{ top: ['4%', '92%', '4%'] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute left-2 right-2"
          >
            {/* Crisp 2px Laser Line */}
            <div 
              className="h-[2px] bg-gradient-to-r from-transparent via-[var(--color-accent)] to-transparent"
              style={{ boxShadow: '0 0 10px var(--color-accent)' }}
            />
            {/* Gradient Laser Trail */}
            <div className="h-10 bg-gradient-to-b from-[var(--color-accent)]/20 to-transparent pointer-events-none" />
          </motion.div>
        </div>
      )}

      {/* ─── 5. BOTTOM RANGEFINDER STATUS FOOTER ─── */}
      <div className="flex justify-between items-center px-1 text-[9px] font-mono tracking-widest text-[var(--color-text-3)] drop-shadow-[0_1px_3px_rgba(0,0,0,0.95)]">
        <span>ISO AUTO // 1/500</span>
        <div className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-sm bg-white/30" />
          <span className="uppercase text-[var(--color-text-2)] font-semibold">
            {isActivelyScanning ? 'NEURAL VISION ACTIVE' : 'CENTER VEHICLE'}
          </span>
        </div>
      </div>
    </div>
  );
});

ScanningReticle.displayName = 'ScanningReticle';
