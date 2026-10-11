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
      className="fixed bottom-0 left-0 right-0 z-30 pb-safe select-none font-sans pointer-events-none px-4 mb-2.5"
      aria-label="Main Navigation"
    >
      <div className="max-w-md mx-auto pointer-events-auto">
        <div className="h-14 rounded-[var(--radius-pill)] bg-[var(--color-panel)]/96 border border-[var(--color-line)] shadow-[0_12px_36px_rgba(0,0,0,0.7)] backdrop-blur-md px-3 flex items-center justify-around relative">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = !tab.isCenter && activeTab === tab.id;

            if (tab.isCenter) {
              return (
                <div key="scan" className="flex flex-col items-center -mt-6">
                  <button
                    onClick={() => {
                      hapticImpact('medium');
                      sounds.playShutter();
                      setScannerOpen(true);
                    }}
                    aria-label="Instant AI Vehicle Scanner"
                    className="relative w-16 h-16 rounded-full active:scale-95 text-white flex items-center justify-center transition-transform duration-150 cursor-pointer shadow-[0_4px_24px_var(--accent-glow)] bg-[var(--color-accent)] border-2 border-white/20 group"
                  >
                    <Camera className="w-6 h-6 text-white group-hover:scale-105 transition-transform" />
                  </button>
                  <span className="text-caption font-bold tracking-wider mt-1 text-[var(--color-text-2)] uppercase">
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
                className="flex flex-col items-center justify-center py-1 px-2 min-w-[52px] min-h-[48px] rounded-[var(--radius-chip)] transition-all duration-150 active:scale-95 cursor-pointer group"
              >
                <Icon 
                  className={`w-5 h-5 transition-transform duration-150 ${
                    isActive
                      ? 'text-[var(--color-text)] fill-current scale-105'
                      : 'text-[var(--color-text-3)] group-hover:text-[var(--color-text-2)]'
                  }`} 
                />
                
                <span 
                  className={`text-caption tracking-tight mt-0.5 transition-colors flex items-center gap-1 ${
                    isActive ? 'font-semibold text-[var(--color-text)]' : 'font-normal text-[var(--color-text-3)]'
                  }`}
                >
                  {tab.label}
                  {isActive && <span className="w-1 h-1 rounded-full bg-[var(--color-accent)] inline-block" />}
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
