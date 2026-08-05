import React from 'react';
import { motion } from 'framer-motion';
import { useApexStore } from '../../store/useApexStore';

const TAB_COLORS: Record<string, string> = {
  home: '255, 69, 0',     // Ignition Orange
  garage: '255, 180, 0',  // Amber / Gold
  social: '255, 42, 0',   // Crimson Orange
  map: '255, 106, 0',     // Bright Orange
  profile: '255, 69, 0',  // Ignition Orange
};

export const AmbientBackground: React.FC = () => {
  const { activeTab } = useApexStore();
  const color = TAB_COLORS[activeTab] || TAB_COLORS.home;

  return (
    <div className="fixed inset-0 bg-[#080808] overflow-hidden pointer-events-none z-0">
      {/* 
        PERFORMANCE OPTIMIZATION:
        We do NOT use CSS filter: blur() here. 
        Instead, the radial-gradient itself provides the softness.
        Animating only scale, opacity, and rotate enables hardware acceleration.
      */}

      {/* Core slow-breathing glow */}
      <motion.div
        animate={{ 
          scale: [1, 1.2, 1],
          opacity: [0.6, 1, 0.6]
        }}
        transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[150vw] h-[150vw] md:w-[1200px] md:h-[1200px] rounded-full mix-blend-screen"
        style={{
          background: `radial-gradient(circle, rgba(${color}, 0.12) 0%, rgba(8,8,8,0) 65%)`,
          transition: 'background 1.5s ease-in-out' // Smooth color shifting across tabs
        }}
      />

      {/* Rotating secondary aura */}
      <motion.div
        animate={{ rotate: [0, 360], scale: [1, 1.1, 1] }}
        transition={{ duration: 25, repeat: Infinity, ease: 'linear' }}
        className="absolute top-0 left-0 w-[120vw] h-[120vw] md:w-[800px] md:h-[800px] rounded-full mix-blend-screen opacity-60"
        style={{
          background: `radial-gradient(ellipse at center, rgba(${color}, 0.08) 0%, rgba(8,8,8,0) 60%)`,
          transformOrigin: '70% 70%',
          transition: 'background 1.5s ease-in-out'
        }}
      />
      
      {/* Heavy Vignette for deep dramatic contrast at edges */}
      <div className="absolute inset-0" style={{ background: 'radial-gradient(circle, transparent 30%, #080808 100%)' }} />
      
      {/* Subtle Noise Texture Overlay */}
      <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=%220 0 200 200%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22noiseFilter%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.65%22 numOctaves=%223%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23noiseFilter)%22/%3E%3C/svg%3E")' }} />
    </div>
  );
};
