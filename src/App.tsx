import React, { useEffect, useState } from 'react';
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
import { LevelUpModal } from './components/common/LevelUpModal';

import { requestRealLocationPermission } from './utils/geolocation';

export const App: React.FC = () => {
  const [isAuthReady, setIsAuthReady] = useState(false);
  useEffect(() => {
    document.title = 'APEX — Every Street Is a Track';

    // Location will be requested during onboarding or when needed.

    // ─── AUTH LISTENER ───
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        useApexStore.getState().initializeSession(session.user.id).then(() => {
          setIsAuthReady(true);
          if (useApexStore.getState().onboardingCompleted) {
            requestRealLocationPermission().then((res) => {
              if (res.city && res.city !== 'Your City') {
                useApexStore.getState().updateUserProfile({
                  city: res.city,
                  country: res.country,
                  latitude: res.latitude,
                  longitude: res.longitude
                });
              } else if (res.latitude !== 0) {
                useApexStore.getState().updateUserProfile({
                  latitude: res.latitude,
                  longitude: res.longitude
                });
              }
            }).catch(() => {});
          }
          if (typeof window !== 'undefined' && window.location.hash && window.location.hash.includes('access_token=')) {
            window.history.replaceState(null, '', window.location.pathname);
          }
        }).catch(() => {
          setIsAuthReady(true);
        });
      } else {
        // DO NOT log out valid local user session!
        if (typeof window !== 'undefined' && window.location.hash && window.location.hash.includes('access_token=')) {
          return;
        }
        setIsAuthReady(true);
      }
    }).catch(() => {
      setIsAuthReady(true);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (_event === 'INITIAL_SESSION') return;
      if (session?.user) {
        useApexStore.getState().initializeSession(session.user.id).then(() => {
          if (typeof window !== 'undefined' && window.location.hash && window.location.hash.includes('access_token=')) {
            window.history.replaceState(null, '', window.location.pathname);
          }
          setIsAuthReady(true);
        }).catch(() => setIsAuthReady(true));
      } else if (_event === 'SIGNED_OUT') {
        useApexStore.getState().logoutUser();
        setIsAuthReady(true);
      } else {
        setIsAuthReady(true);
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

  if (!isAuthReady) {
    return (
      <div className="min-h-[100dvh] bg-[#080808] flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-[#FF4500] border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-transparent text-[#F0EBE3] flex flex-col selection:bg-[#FF4500] selection:text-white relative z-0 pb-[110px]" style={{ fontFamily: 'DM Sans' }}>
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
      
      <LevelUpModal />
      <OnboardingModal isOpen={!onboardingCompleted} onClose={() => {}} />
    </div>
  );
};

export default App;
