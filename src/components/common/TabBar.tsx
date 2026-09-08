import React from 'react';
import { Home, Compass, Camera, Grid, Users } from 'lucide-react';
import { useApexStore } from '../../store/useApexStore';
import { sounds } from '../../utils/audio';

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
    <nav className="fixed bottom-0 left-0 right-0 z-30 pb-safe bg-black/90 backdrop-blur-2xl border-t border-white/[0.08] select-none font-sans">
      <div className="flex items-center justify-between px-6 py-2 max-w-md mx-auto">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = !tab.isCenter && activeTab === tab.id;

          if (tab.isCenter) {
            return (
              <div key="scan" className="flex flex-col items-center -mt-5">
                <button
                  onClick={() => {
                    sounds.playShutter();
                    setScannerOpen(true);
                  }}
                  className="w-13 h-13 rounded-full active:scale-92 text-white flex items-center justify-center shadow-lg transition-all border border-white/20"
                  style={{
                    backgroundColor: 'var(--accent-color)',
                    boxShadow: '0 4px 18px var(--accent-glow)'
                  }}
                >
                  <Camera className="w-6 h-6" />
                </button>
                <span 
                  className="text-[10px] font-semibold mt-1"
                  style={{ color: 'var(--accent-color)' }}
                >
                  Scan
                </span>
              </div>
            );
          }

          return (
            <button 
              key={tab.id}
              onClick={() => {
                sounds.playTargetLock();
                if (tab.id !== 'scan') {
                  setActiveTab(tab.id as 'home' | 'map' | 'garage' | 'social');
                }
              }}
              className="flex flex-col items-center gap-1 py-1 px-3 transition-colors min-w-[54px] relative"
            >
              <Icon 
                className={`w-5 h-5 transition-colors ${isActive ? '' : 'text-white/40 hover:text-white/70'}`} 
                style={isActive ? { color: 'var(--accent-color)' } : undefined}
              />
              <span className={`text-[10px] font-medium transition-colors ${isActive ? 'text-white' : 'text-white/40'}`}>
                {tab.label}
              </span>
              {isActive && (
                <div 
                  className="w-1 h-1 rounded-full absolute -bottom-1" 
                  style={{ 
                    backgroundColor: 'var(--accent-color)',
                    boxShadow: '0 0 6px var(--accent-color)'
                  }}
                />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
});

TabBar.displayName = 'TabBar';
