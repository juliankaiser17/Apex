import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Radio, Disc3 } from 'lucide-react';
import { sounds } from '../../utils/audio';

interface Gta5SatelliteHudProps {
  cityName: string;
  countryName: string;
  phase: 'ascent' | 'pan' | 'descent';
}

// 3D Forged Supercar Wheel Rim Component
const SpinningCarWheelRim: React.FC = () => {
  return (
    <div className="relative w-52 h-52 mx-auto flex items-center justify-center">
      {/* Outer Neon Glow Pulse Ring */}
      <motion.div
        animate={{ scale: [1, 1.12, 1], opacity: [0.3, 0.7, 0.3] }}
        transition={{ repeat: Infinity, duration: 1.5, ease: 'easeInOut' }}
        className="absolute inset-0 rounded-full border-2 border-[#FF5500] shadow-[0_0_50px_rgba(255,85,0,0.8)]"
      />

      {/* Outer Speed Streak Reticle Ring */}
      <motion.div
        animate={{ rotate: -360 }}
        transition={{ repeat: Infinity, duration: 6, ease: 'linear' }}
        className="absolute inset-2 rounded-full border border-dashed border-rose-500/60"
      />

      {/* Carbon-Ceramic Brake Rotor with Red Brembo Caliper (Stationary background) */}
      <div className="absolute w-44 h-44 rounded-full bg-slate-900/90 border border-slate-700 flex items-center justify-center shadow-inner overflow-hidden">
        {/* Cross-drilled brake rotor holes */}
        <div className="absolute inset-3 rounded-full border border-dashed border-slate-600/50 bg-[radial-gradient(circle_at_center,transparent_40%,rgba(255,255,255,0.05)_41%)]" />

        {/* Red Brembo Brake Caliper */}
        <div className="absolute top-2 left-1/2 -translate-x-1/2 w-14 h-5 bg-gradient-to-r from-rose-700 via-red-600 to-rose-700 rounded-md border border-rose-400 flex items-center justify-center text-[8px] font-mono font-bold text-white tracking-widest shadow-md">
          BREMBO
        </div>
      </div>

      {/* SPINNING 5-SPOKE FORGED SUPERCAR WHEEL RIM */}
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ repeat: Infinity, duration: 1.2, ease: 'linear' }}
        className="relative z-10 w-44 h-44 flex items-center justify-center"
      >
        {/* SVG Custom 5-Spoke Forged Alloy Wheel Rim */}
        <svg viewBox="0 0 200 200" className="w-full h-full drop-shadow-[0_0_15px_rgba(255,85,0,0.5)]">
          <defs>
            <linearGradient id="rimMetal" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#e2e8f0" />
              <stop offset="50%" stopColor="#64748b" />
              <stop offset="100%" stopColor="#1e293b" />
            </linearGradient>
            <linearGradient id="apexOrange" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#FF5500" />
              <stop offset="100%" stopColor="#cc4400" />
            </linearGradient>
          </defs>

          {/* Outer Rim Lip */}
          <circle cx="100" cy="100" r="92" fill="none" stroke="url(#rimMetal)" strokeWidth="6" />
          <circle cx="100" cy="100" r="86" fill="none" stroke="#FF5500" strokeWidth="1.5" strokeDasharray="6 4" />

          {/* 5 Dual Forged Spokes */}
          {[0, 72, 144, 216, 288].map((angle, i) => (
            <g key={i} transform={`rotate(${angle} 100 100)`}>
              {/* Spoke 1 */}
              <polygon points="94,100 82,20 90,16 97,100" fill="url(#rimMetal)" />
              {/* Spoke 2 */}
              <polygon points="106,100 118,20 110,16 103,100" fill="url(#rimMetal)" />
              {/* Center Accent Line */}
              <line x1="100" y1="95" x2="100" y2="20" stroke="#FF5500" strokeWidth="1" />
            </g>
          ))}

          {/* Center Hub Cap with APEX Emblem */}
          <circle cx="100" cy="100" r="24" fill="#0F172A" stroke="url(#rimMetal)" strokeWidth="3" />
          <circle cx="100" cy="100" r="18" fill="url(#apexOrange)" />
          <text x="100" y="104" textAnchor="middle" fill="#FFFFFF" fontSize="11" fontWeight="900" fontFamily="sans-serif">
            A
          </text>
        </svg>
      </motion.div>

      {/* Speed Lines / Tire Motion Blur */}
      <div className="absolute inset-0 flex items-center justify-center">
        <Disc3 className="w-48 h-48 text-[#FF5500]/20 animate-spin" style={{ animationDuration: '0.8s' }} />
      </div>
    </div>
  );
};

export const Gta5SatelliteHud: React.FC<Gta5SatelliteHudProps> = ({ cityName, countryName, phase }) => {
  const [altitude, setAltitude] = useState(4200);

  useEffect(() => {
    sounds.playTargetLock();

    let interval: ReturnType<typeof setInterval>;
    if (phase === 'ascent') {
      interval = setInterval(() => {
        setAltitude(prev => Math.min(85000, prev + 4500));
      }, 50);
    } else if (phase === 'pan') {
      setAltitude(85000);
    } else if (phase === 'descent') {
      interval = setInterval(() => {
        setAltitude(prev => Math.max(1200, prev - 4100));
      }, 50);
    }
    return () => clearInterval(interval);
  }, [phase]);

  return (
    <div className="fixed inset-0 z-50 pointer-events-none overflow-hidden flex flex-col justify-between p-8 select-none">
      {/* Heavy Camera Motion Blur Tint */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: phase === 'pan' ? 0.75 : 0.45 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-gradient-to-b from-black/85 via-slate-950/50 to-black/85 backdrop-blur-md"
      />

      {/* Satellite Scanlines */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.5)_50%)] bg-[length:100%_4px]" />

      {/* TOP GTA V SATELLITE HUD DATA */}
      <div className="relative z-10 flex items-start justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-rose-500 font-mono text-xs font-bold tracking-widest uppercase bg-black/90 px-3.5 py-1.5 rounded-xl border border-rose-500/60 shadow-[0_0_25px_rgba(244,63,94,0.7)]">
            <Radio className="w-4 h-4 animate-pulse text-rose-400" /> SATELLITE ORBITAL TRANSIT
          </div>
          <p className="text-3xl font-display text-white tracking-widest uppercase drop-shadow-[0_4px_10px_rgba(0,0,0,0.9)] pt-1">
            APEX-SAT // 04-B
          </p>
        </div>

        {/* Live Altitude Metric */}
        <div className="text-right font-mono bg-black/90 px-4 py-2 rounded-2xl border border-white/20 shadow-2xl">
          <span className="text-[10px] text-slate-400 block uppercase tracking-widest">ORBITAL ALTITUDE</span>
          <span className="text-3xl font-bold text-[#FF5500]">{altitude.toLocaleString()} M</span>
        </div>
      </div>

      {/* CENTER SPINNING CAR WHEEL RIM & GTA CHARACTER SWITCHING TITLE */}
      <div className="relative z-10 my-auto text-center space-y-5 max-w-lg mx-auto">
        {/* SPINNING CAR WHEEL RIM IN MIDDLE */}
        <SpinningCarWheelRim />

        <div className="bg-black/90 backdrop-blur-xl p-4 rounded-3xl border border-orange-500/60 shadow-[0_10px_40px_rgba(0,0,0,0.9)] space-y-1">
          <span className="text-xs font-mono font-bold text-orange-400 tracking-widest uppercase block">
            {phase === 'ascent' 
              ? '⬆ SKYWARD ORBIT LIFT-OFF...' 
              : phase === 'pan' 
              ? '✈ HIGH-ALTITUDE GLOBAL PAN...' 
              : '⬇ PLUNGING TO STREET LEVEL...'}
          </span>
          <h2 className="font-display text-4xl text-white tracking-wider uppercase leading-none">
            {cityName}, <span className="text-[#FF5500]">{countryName}</span>
          </h2>
        </div>
      </div>

      {/* BOTTOM COORDINATE FEED */}
      <div className="relative z-10 flex items-center justify-between text-xs font-mono text-slate-400 bg-black/90 px-4 py-2.5 rounded-2xl border border-white/10 shadow-2xl">
        <span>LAT: 35.6762° N // LNG: 139.6503° E</span>
        <span className="text-emerald-400 font-bold flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" /> ORBIT LOCK: 99.8%
        </span>
      </div>
    </div>
  );
};
