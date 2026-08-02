import React, { useEffect } from 'react';
import { useApexStore } from './store/useApexStore';
import { HeaderBar } from './components/common/HeaderBar';
import { TabBar } from './components/common/TabBar';
import { HomeScreen } from './components/home/HomeScreen';
import { MapScreen } from './components/map/MapScreen';
import { GarageScreen } from './components/garage/GarageScreen';
import { SocialScreen } from './components/social/SocialScreen';
import { ScannerModal } from './components/scanner/ScannerModal';
import { OnboardingModal } from './components/onboarding/OnboardingModal';
import { ActiveHuntNotification } from './components/hunts/ActiveHuntNotification';
import { EnthusiastModal } from './components/premium/EnthusiastModal';
import { HuntScreen } from './components/hunts/HuntScreen';
import { Card3DDetail } from './components/garage/Card3DDetail';

export const App: React.FC = () => {
  useEffect(() => {
    document.title = 'APEX — Every Street Is a Track';
  }, []);

  const { 
    activeTab, 
    onboardingCompleted, 
    activeHuntModal, 
    closeHuntModal, 
    setScannerOpen,
    selectedCardForDetail,
    setSelectedCardForDetail
  } = useApexStore();

  return (
    <div className="min-h-screen bg-[#080808] text-[#F0EBE3] flex flex-col selection:bg-[#FF4500] selection:text-white" style={{ fontFamily: 'DM Sans' }}>
      {/* Top Status Header */}
      <HeaderBar />

      {/* Main Tab Viewport */}
      <main className="flex-1 flex flex-col">
        {activeTab === 'home' && <HomeScreen />}
        {activeTab === 'map' && <MapScreen />}
        {activeTab === 'garage' && <GarageScreen />}
        {activeTab === 'social' && <SocialScreen />}
        {activeTab === 'profile' && <SocialScreen />}
      </main>

      {/* Fixed Bottom 5-Tab Bar */}
      <TabBar />

      {/* Global 3D Card Detail Modal (accessible from Map, Home, Garage & Social) */}
      <Card3DDetail
        card={selectedCardForDetail}
        onClose={() => setSelectedCardForDetail(null)}
      />

      {/* Modals & Overlays */}
      <ScannerModal />
      <ActiveHuntNotification />
      <EnthusiastModal />

      {/* Dedicated Full-Screen Hunt Experience */}
      <HuntScreen
        hunt={activeHuntModal}
        onClose={closeHuntModal}
        onOpenScanner={() => {
          closeHuntModal();
          setScannerOpen(true);
        }}
      />
      
      {/* Onboarding Trigger Modal */}
      <OnboardingModal 
        isOpen={!onboardingCompleted} 
        onClose={() => {}} 
      />
    </div>
  );
};

export default App;
