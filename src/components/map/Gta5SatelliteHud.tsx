import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Radio, Navigation } from 'lucide-react';
import { sounds } from '../../utils/audio';

interface Gta5SatelliteHudProps {
  cityName: string;
  countryName: string;
  phase: 'ascent' | 'pan' | 'descent';
}

export const Gta5SatelliteHud: React.FC<Gta5SatelliteHudProps> = ({ cityName, countryName, phase }) => {
  const [altitude, setAltitude] = useState(phase === 'descent' ? 85000 : 4200);

  useEffect(() => {
    sounds.playTargetLock();

    let start = Date.now();
    const duration = 1200;
    const initialAlt = phase === 'descent' ? 85000 : 4200;
    const targetAlt = phase === 'descent' ? 1200 : 85000;

    const timer = setInterval(() => {
      const elapsed = Date.now() - start;
      const progress = Math.min(1, elapsed / duration);
      const current = Math.round(initialAlt + (targetAlt - initialAlt) * progress);
      setAltitude(current);
      if (progress >= 1) clearInterval(timer);
    }, 100);

    return () => clearInterval(timer);
  }, [phase]);

  return (
    <div className="fixed inset-0 z-50 pointer-events-none flex flex-col justify-between p-6 pt-safe pb-safe select-none overflow-hidden bg-black/60 backdrop-blur-md">
      {/* Top Telemetry Header */}
      <motion.div 
        initial={{ opacity: 0, y: -15 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between z-10"
      >
        <div className="flex items-center gap-2 bg-[#111111]/90 border border-white/15 px-3 py-1.5 rounded-full shadow-lg">
          <Radio className="w-3.5 h-3.5 text-[#FF4500] animate-pulse" />
          <span className="text-[10px] font-data font-bold tracking-[0.2em] text-[#F0EBE3] uppercase">
            ORBITAL TRANSIT
          </span>
        </div>

        <div className="bg-[#111111]/90 border border-white/15 px-3.5 py-1.5 rounded-2xl shadow-lg text-right">
          <span className="text-[9px] font-data text-[#9A9088] uppercase tracking-wider block">ALTITUDE</span>
          <span className="text-sm font-data font-bold text-[#FFA500] leading-none">
            {altitude.toLocaleString()} M
          </span>
        </div>
      </motion.div>

      {/* Center Cinematic Radar Reticle & Destination Card */}
      <div className="my-auto text-center space-y-6 max-w-sm mx-auto z-10 w-full">
        {/* Sleek Minimalist Orbital Compass */}
        <div className="relative w-28 h-28 mx-auto flex items-center justify-center">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 4, ease: 'linear' }}
            className="absolute inset-0 rounded-full border-2 border-dashed border-[#FF4500]/50"
          />
          <motion.div
            animate={{ scale: [1, 1.15, 1], opacity: [0.4, 0.9, 0.4] }}
            transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
            className="absolute inset-3 rounded-full border border-[#FF4500] shadow-[0_0_20px_rgba(255,69,0,0.5)]"
          />
          <div className="w-12 h-12 rounded-full bg-[#1A1A1A] border border-white/20 flex items-center justify-center text-[#FF4500] shadow-inner">
            <Navigation className="w-5 h-5 animate-pulse" />
          </div>
        </div>

        {/* Destination Information */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-[#111111]/90 border border-white/15 p-5 rounded-3xl shadow-[0_12px_40px_rgba(0,0,0,0.8)] space-y-1.5"
        >
          <span className="text-[10px] font-data font-bold text-[#FF4500] tracking-[0.25em] uppercase block">
            {phase === 'ascent'
              ? '↑ SKYWARD ORBIT'
              : phase === 'pan'
              ? '✈ HIGH-ALTITUDE TRANSIT'
              : '↓ DESCENDING TO RADAR'}
          </span>
          <h2 className="font-display text-3xl text-[#F0EBE3] tracking-wide leading-none">
            {cityName}
          </h2>
          <p className="text-xs font-data text-[#9A9088] uppercase tracking-wider">
            {countryName}
          </p>
        </motion.div>
      </div>

      {/* Bottom Coordinates Status */}
      <motion.div 
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-center z-10"
      >
        <span className="text-[10px] font-data text-[#9A9088] bg-[#111111]/80 px-4 py-1.5 rounded-full border border-white/10 uppercase tracking-widest">
          GPS LOCK: <span className="text-[#2ECC71] font-bold">99.8% READY</span>
        </span>
      </motion.div>
    </div>
  );
};
