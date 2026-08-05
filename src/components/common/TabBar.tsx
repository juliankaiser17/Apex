import React from 'react';
import { motion } from 'framer-motion';
import { Home, Map, Camera, Layers, Users } from 'lucide-react';
import { useApexStore } from '../../store/useApexStore';

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
    <nav className="fixed bottom-0 left-0 right-0 z-30 pb-safe backdrop-blur-xl"
      style={{ background: 'rgba(8,8,8,0.65)', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
      <div className="max-w-md mx-auto flex items-end justify-between px-4 pt-1 pb-2">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = !tab.isCenter && activeTab === tab.id;

          if (tab.isCenter) {
            return (
              <div key="scan" className="flex flex-col items-center -mt-6">
                {/* Scanner button — the heartbeat */}
                <motion.button
                  onClick={() => setScannerOpen(true)}
                  whileTap={{ scale: 0.88 }}
                  className="relative w-[76px] h-[76px] rounded-full flex items-center justify-center"
                  style={{ background: '#080808', border: '2px solid #FF4500' }}
                >
                  {/* Pulsing glow ring */}
                  <motion.div
                    className="absolute inset-[-4px] rounded-full"
                    animate={{ boxShadow: ['0 0 0px rgba(255,69,0,0)', '0 0 24px rgba(255,69,0,0.4)', '0 0 0px rgba(255,69,0,0)'] }}
                    transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
                  />
                  {/* Inner fill */}
                  <div className="w-[60px] h-[60px] rounded-full flex items-center justify-center"
                    style={{ background: '#FF4500' }}>
                    <Camera className="w-[26px] h-[26px]" style={{ color: '#F0EBE3' }} />
                  </div>
                </motion.button>
                <span className="text-[10px] font-display tracking-[2px] mt-1" style={{ color: '#FF4500' }}>
                  SCAN
                </span>
              </div>
            );
          }

          return (
            <button key={tab.id}
                onClick={() => {
                  if (tab.id !== 'scan') {
                    setActiveTab(tab.id as 'home' | 'map' | 'garage' | 'social');
                  }
                }}
              className="flex flex-col items-center gap-0.5 py-1 px-3 transition-colors min-w-[48px]">
              <Icon className="w-5 h-5" style={{ color: isActive ? '#FF4500' : '#5A5550' }} />
              <span className="text-[11px] font-medium"
                style={{ color: isActive ? '#FF4500' : '#5A5550', fontFamily: 'DM Sans' }}>
                {tab.label}
              </span>
              {/* Active indicator dot */}
              {isActive && (
                <motion.div layoutId="tab-dot"
                  className="w-1 h-1 rounded-full mt-0.5" style={{ background: '#FF4500' }} />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};
