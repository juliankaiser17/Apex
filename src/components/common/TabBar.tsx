import React from 'react';
import { motion } from 'framer-motion';
import { Home, Map, Camera, Layers, Users } from 'lucide-react';
import { useApexStore } from '../../store/useApexStore';
import { sounds } from '../../utils/audio';

export const TabBar: React.FC = () => {
  const { activeTab, setActiveTab, setScannerOpen, activeHuntModal } = useApexStore();

  // Hide during active hunt
  if (activeHuntModal !== null) return null;

  const tabs = [
    { id: 'home' as const, label: 'Home', icon: Home },
    { id: 'map' as const, label: 'Map', icon: Map },
    { id: 'scan' as const, label: 'SCAN', icon: Camera, isCenter: true },
    { id: 'garage' as const, label: 'Garage', icon: Layers },
    { id: 'social' as const, label: 'Social', icon: Users },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 pb-safe backdrop-blur-2xl bg-[#080808]/92 border-t border-white/10 select-none shadow-[0_-10px_30px_rgba(0,0,0,0.8)]">
      <div className="flex items-end justify-between px-4 pt-1.5 pb-2 max-w-lg mx-auto">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = !tab.isCenter && activeTab === tab.id;

          if (tab.isCenter) {
            return (
              <div key="scan" className="flex flex-col items-center -mt-7">
                {/* Center Optical Shutter Button */}
                <motion.button
                  onClick={() => {
                    sounds.playShutter();
                    setScannerOpen(true);
                  }}
                  whileHover={{ scale: 1.06 }}
                  whileTap={{ scale: 0.88 }}
                  className="relative w-[78px] h-[78px] rounded-full flex items-center justify-center cursor-pointer shadow-[0_0_25px_rgba(255,69,0,0.4)] border border-[#FF4500]/60 bg-[#080808]"
                >
                  {/* Outer Pulsing Radial Aura */}
                  <motion.div
                    className="absolute inset-[-4px] rounded-full border border-[#FF4500]/40"
                    animate={{ scale: [1, 1.14, 1], opacity: [0.7, 0.1, 0.7] }}
                    transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
                  />

                  {/* Tachometer Gradient Ring */}
                  <div className="w-[62px] h-[62px] rounded-full p-[2px] bg-gradient-to-tr from-[#FF2200] via-[#FF4500] to-[#FFA500] shadow-[inset_0_0_12px_rgba(0,0,0,0.6)]">
                    <div className="w-full h-full rounded-full bg-[#FF4500] flex items-center justify-center shadow-lg">
                      <Camera className="w-[26px] h-[26px] text-white drop-shadow-md" />
                    </div>
                  </div>
                </motion.button>
                <span className="text-[10px] font-display tracking-[3px] mt-1 font-bold text-[#FF4500] drop-shadow-[0_0_8px_rgba(255,69,0,0.5)]">
                  SCAN
                </span>
              </div>
            );
          }

          return (
            <motion.button 
              key={tab.id}
              whileTap={{ scale: 0.88 }}
              onClick={() => {
                sounds.playTargetLock();
                if (tab.id !== 'scan') {
                  setActiveTab(tab.id as 'home' | 'map' | 'garage' | 'social');
                }
              }}
              className="flex flex-col items-center gap-1 py-1 px-3 transition-colors min-w-[54px] relative"
            >
              <Icon 
                className={`w-5 h-5 transition-transform duration-200 ${isActive ? 'text-[#FF4500] scale-110 drop-shadow-[0_0_10px_#FF4500]' : 'text-[#9A9088]'}`} 
              />
              <span className={`text-[10px] font-data font-semibold tracking-wider uppercase ${isActive ? 'text-[#F0EBE3]' : 'text-[#9A9088]'}`}>
                {tab.label}
              </span>
              {/* Active illuminated dot */}
              {isActive && (
                <motion.div 
                  layoutId="tab-glow-dot"
                  className="w-1.5 h-1.5 rounded-full bg-[#FF4500] shadow-[0_0_8px_#FF4500] mt-0.5" 
                />
              )}
            </motion.button>
          );
        })}
      </div>
    </nav>
  );
};
