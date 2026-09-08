import React from 'react';
import { motion } from 'framer-motion';

interface ScanningReticleProps {
  isScanning?: boolean;
}

export const ScanningReticle: React.FC<ScanningReticleProps> = React.memo(({ isScanning = false }) => {
  return (
    <div className="relative my-auto w-[320px] max-w-[85vw] h-[240px] mx-auto pointer-events-none flex flex-col justify-between select-none">
      
      {/* 1. TOP CORNER BRACKETS (Apex Red #E50914 with high-contrast shadow) */}
      <div className="flex justify-between items-start">
        <div className="w-8 h-8 border-t-[2.5px] border-l-[2.5px] border-[#E50914] rounded-tl-lg drop-shadow-[0_1px_3px_rgba(0,0,0,0.95)]" />
        <div className="w-8 h-8 border-t-[2.5px] border-r-[2.5px] border-[#E50914] rounded-tr-lg drop-shadow-[0_1px_3px_rgba(0,0,0,0.95)]" />
      </div>

      {/* 2. OPTIONAL VERTICAL LASER SCAN LINE (When analyzing) */}
      {isScanning && (
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <motion.div
            animate={{ top: ['4%', '92%', '4%'] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute left-2 right-2"
          >
            {/* Crisp 2px Apex Red Laser Line */}
            <div className="h-[2px] bg-gradient-to-r from-transparent via-[#E50914] to-transparent shadow-[0_0_8px_#E50914]" />
            {/* Subtle Gradient Laser Trail */}
            <div className="h-8 bg-gradient-to-b from-[#E50914]/15 to-transparent pointer-events-none" />
          </motion.div>
        </div>
      )}

      {/* 3. CENTER TARGETING RETICLE POINT */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
        <div className="w-1.5 h-1.5 rounded-full bg-[#E50914]/60 drop-shadow-[0_0_3px_rgba(0,0,0,0.9)]" />
      </div>

      {/* 4. BOTTOM CORNER BRACKETS */}
      <div className="flex justify-between items-end">
        <div className="w-8 h-8 border-b-[2.5px] border-l-[2.5px] border-[#E50914] rounded-bl-lg drop-shadow-[0_1px_3px_rgba(0,0,0,0.95)]" />
        <div className="w-8 h-8 border-b-[2.5px] border-r-[2.5px] border-[#E50914] rounded-br-lg drop-shadow-[0_1px_3px_rgba(0,0,0,0.95)]" />
      </div>
    </div>
  );
});

ScanningReticle.displayName = 'ScanningReticle';
