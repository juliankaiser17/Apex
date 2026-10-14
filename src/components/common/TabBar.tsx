import React from 'react';
import { Home, Compass, Camera, Grid, Users } from 'lucide-react';
import { useApexStore } from '../../store/useApexStore';
import { sounds } from '../../utils/audio';
import { hapticTap, hapticImpact } from '../../utils/haptics';

export const TabBar: React.FC = React.memo(() => {
  const activeTab = useApexStore(s => s.activeTab);
  const setActiveTab = useApexStore(s => s.setActiveTab);
  const setScannerOpen = useApexStore(s => s.setScannerOpen);
  const activeHuntModal = useApexStore(s => s.activeHuntModal);

  if (activeHuntModal !== null) return null;

  const tabs = [
    { id: 'home' as const, label: 'Home', icon: Home },
    { id: 'map' as const, label: 'Map', icon: Compass },
    { id: 'scan' as const, label: 'Scan', icon: Camera, isCenter: true },
    { id: 'garage' as const, label: 'Garage', icon: Grid },
    { id: 'social' as const, label: 'Feed', icon: Users },
  ];

  return (
    <nav 
      className="fixed bottom-0 left-0 right-0 z-30 pb-safe select-none font-sans pointer-events-none px-4 mb-2"
      aria-label="Main Navigation"
    >
      <div className="max-w-md mx-auto pointer-events-auto">
        <div className="apple-dock rounded-[28px] px-2 py-1.5 flex items-center justify-around relative">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = !tab.isCenter && activeTab === tab.id;

            if (tab.isCenter) {
              return (
                <div key="scan" className="flex flex-col items-center -mt-4">
                  <button
                    onClick={() => {
                      hapticImpact('medium');
                      sounds.playShutter();
                      setScannerOpen(true);
                    }}
                    aria-label="Instant AI Vehicle Scanner"
                    className="relative w-12 h-12 rounded-full active:scale-95 text-white flex items-center justify-center transition-transform duration-150 cursor-pointer shadow-lg group"
                    style={{
                      background: 'linear-gradient(180deg, var(--accent-color) 0%, #B80710 100%)',
                      border: '0.5px solid rgba(255, 255, 255, 0.35)',
                      boxShadow: '0 4px 14px rgba(0, 0, 0, 0.4), inset 0 1px 0.5px rgba(255, 255, 255, 0.38)'
                    }}
                  >
                    <Camera className="w-5 h-5 text-white drop-shadow-sm group-hover:scale-105 transition-transform" />
                  </button>
                  <span className="text-[9px] font-bold tracking-wider mt-0.5 text-white/80 uppercase">
                    Scan
                  </span>
                </div>
              );
            }

            return (
              <button 
                key={tab.id}
                onClick={() => {
                  hapticTap();
                  sounds.playTargetLock();
                  if (tab.id !== 'scan') {
                    setActiveTab(tab.id as 'home' | 'map' | 'garage' | 'social');
                  }
                }}
                aria-label={tab.label}
                aria-selected={isActive}
                className="flex flex-col items-center justify-center py-1 px-2.5 min-w-[50px] min-h-[44px] rounded-xl transition-all duration-150 active:scale-92 cursor-pointer group"
              >
                <Icon 
                  className={`w-5 h-5 transition-transform duration-150 ${
                    isActive ? 'scale-105' : 'group-hover:text-white/70'
                  }`} 
                  style={isActive ? { color: 'var(--accent-color)' } : { color: 'rgba(255, 255, 255, 0.45)' }}
                />
                
                <span 
                  className={`text-[10px] tracking-tight mt-0.5 transition-colors ${
                    isActive ? 'font-semibold' : 'font-medium'
                  }`}
                  style={isActive ? { color: '#FFFFFF' } : { color: 'rgba(255, 255, 255, 0.45)' }}
                >
                  {tab.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
});

TabBar.displayName = 'TabBar';
