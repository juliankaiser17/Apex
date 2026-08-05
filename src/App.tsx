import React, { useEffect } from 'react';
import { supabase } from './lib/supabase';
import { useApexStore } from './store/useApexStore';
import { HeaderBar } from './components/common/HeaderBar';
import { TabBar } from './components/common/TabBar';
import { AmbientBackground } from './components/common/AmbientBackground';
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
import { ProfileSettingsModal } from './components/profile/ProfileSettingsModal';

import { requestRealLocationPermission } from './utils/geolocation';

export const App: React.FC = () => {
  useEffect(() => {
    document.title = 'APEX — Every Street Is a Track';

    requestRealLocationPermission().then((res) => {
      if (res.city && res.city !== 'Your City') {
        useApexStore.getState().updateUserProfile({
          city: res.city,
          country: res.country
        });
      }
    });

    // ─── AUTH LISTENER ───
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        useApexStore.getState().initializeSession(session.user.id);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        useApexStore.getState().initializeSession(session.user.id);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const { 
    activeTab, 
    onboardingCompleted, 
    activeHuntModal, 
    closeHuntModal, 
    setScannerOpen,
    selectedCardForDetail,
    setSelectedCardForDetail,
    settingsModalOpen,
    setSettingsModalOpen
  } = useApexStore();

  return (
    <div className="min-h-screen bg-transparent text-[#F0EBE3] flex flex-col selection:bg-[#FF4500] selection:text-white relative z-0" style={{ fontFamily: 'DM Sans' }}>
      <AmbientBackground />
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

      {/* Profile & Privacy Settings Modal */}
      <ProfileSettingsModal
        isOpen={settingsModalOpen}
        onClose={() => setSettingsModalOpen(false)}
      />

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
