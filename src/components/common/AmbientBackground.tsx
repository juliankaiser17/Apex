import React from 'react';
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
    <div className="fixed inset-0 overflow-hidden pointer-events-none z-[-1]" style={{ background: '#080808' }}>
      {/* 
        ULTRA-LIGHTWEIGHT: Pure CSS, zero JavaScript animations, zero motion.div.
        A single static radial gradient — instant render, zero GPU cost.
      */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[160vw] h-[160vw] rounded-full"
        style={{
          background: `radial-gradient(circle, rgba(${color}, 0.18) 0%, rgba(8,8,8,0) 60%)`,
          transition: 'background 1s ease-in-out'
        }}
      />

      {/* Vignette — edges fade to pure black */}
      <div className="absolute inset-0" style={{ background: 'radial-gradient(circle, transparent 30%, #080808 100%)' }} />
    </div>
  );
};
