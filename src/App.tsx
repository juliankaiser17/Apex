import React, { useEffect, useState } from 'react';
import { supabase, getAuthoritativeUser } from './lib/supabase';
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
import { DailyStreakModal } from './components/common/DailyStreakModal';
import { NotificationCenterModal } from './components/common/NotificationCenterModal';
import { AuthDiagnosticPanel } from './components/admin/AuthDiagnosticPanel';

import { requestRealLocationPermission } from './utils/geolocation';
import { applyAppTheme } from './utils/theme';

import { logAuthTransition } from './utils/authLogger';

export const App: React.FC = () => {
  const [isAuthReady, setIsAuthReady] = useState(false);
  useEffect(() => {
    document.title = 'APEX — Every Street Is a Track';
    logAuthTransition('AUTH_INIT_START');

    // ─── PHASE 6: APP STARTUP & DETERMINISTIC SESSION RESOLUTION ───
    useApexStore.getState().setAuthStatus('AUTH_LOADING', null);

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        logAuthTransition('SESSION_RESOLVED', session.user.id, session.user.email);
        
        // Authoritatively verify with Supabase server
        const authUser = (await getAuthoritativeUser()) || session.user;
        const provider = authUser.app_metadata?.provider || (authUser.email?.includes('gmail') ? 'google' : 'email');
        
        await useApexStore.getState().initializeSession(
          authUser.id, 
          authUser.email, 
          provider, 
          authUser.user_metadata
        );

        // Acquire accurate real location only if user is already onboarded
        if (useApexStore.getState().onboardingCompleted) {
          requestRealLocationPermission().then((res) => {
            if (res.city && res.city !== 'Your City' && res.latitude !== 0) {
              useApexStore.getState().updateUserProfile({
                city: res.city,
                country: res.country,
                latitude: res.latitude,
                longitude: res.longitude
              });
            }
          }).catch(() => {});
        }

        if (typeof window !== 'undefined' && window.location.hash && window.location.hash.includes('access_token=')) {
          window.history.replaceState(null, '', window.location.pathname);
        }
        setIsAuthReady(true);
      } else {
        // No Supabase session: Authoritatively transition to GUEST
        useApexStore.getState().setAuthStatus('GUEST', null);
        logAuthTransition('GUEST_SESSION_STARTED');
        setIsAuthReady(true);
      }
    }).catch((err) => {
      logAuthTransition('AUTH_ERROR', null, null, { error: err });
      // Temporary network failure: if we already have a cached authenticated user, preserve identity
      const cached = useApexStore.getState().user;
      if (cached?.id && cached.email && !cached.username.startsWith('spotter_')) {
        useApexStore.getState().setAuthStatus('AUTHENTICATED', { id: cached.id, email: cached.email });
      } else {
        useApexStore.getState().setAuthStatus('GUEST', null);
      }
      setIsAuthReady(true);
    });

    // ─── PHASE 7: SINGLE APPLICATION-LEVEL AUTH LISTENER ───
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      logAuthTransition(event as any, session?.user?.id, session?.user?.email);

      if (event === 'SIGNED_IN' || event === 'USER_UPDATED') {
        if (session?.user) {
          const provider = session.user.app_metadata?.provider || (session.user.email?.includes('gmail') ? 'google' : 'email');
          await useApexStore.getState().initializeSession(
            session.user.id, 
            session.user.email, 
            provider, 
            session.user.user_metadata
          );
          if (typeof window !== 'undefined' && window.location.hash && window.location.hash.includes('access_token=')) {
            window.history.replaceState(null, '', window.location.pathname);
          }
        }
        setIsAuthReady(true);
      } else if (event === 'TOKEN_REFRESHED') {
        // Token refreshed: maintain active authenticated state without flickering
        if (session?.user) {
          const currentStatus = useApexStore.getState().authStatus;
          if (currentStatus !== 'AUTHENTICATED') {
            useApexStore.getState().setAuthStatus('AUTHENTICATED', { 
              id: session.user.id, 
              email: session.user.email || '' 
            });
          }
        }
        setIsAuthReady(true);
      } else if (event === 'SIGNED_OUT') {
        useApexStore.getState().setAuthStatus('GUEST', null);
        setIsAuthReady(true);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // ─── PHASE 1: FINE-GRAINED ATOMIC STORE SELECTORS ───
  // Completely shields App root, active screens, and feed from XP/coin/profile mutations
  const activeTab = useApexStore(s => s.activeTab);
  const onboardingCompleted = useApexStore(s => s.onboardingCompleted);
  const activeHuntModal = useApexStore(s => s.activeHuntModal);
  const closeHuntModal = useApexStore(s => s.closeHuntModal);
  const setScannerOpen = useApexStore(s => s.setScannerOpen);
  const selectedCardForDetail = useApexStore(s => s.selectedCardForDetail);
  const setSelectedCardForDetail = useApexStore(s => s.setSelectedCardForDetail);
  const settingsModalOpen = useApexStore(s => s.settingsModalOpen);
  const setSettingsModalOpen = useApexStore(s => s.setSettingsModalOpen);

  // Primitive selectors for daily streak popup (zero rerender on XP changes)
  const userId = useApexStore(s => s.user.id);
  const userUsername = useApexStore(s => s.user.username);
  const userStreakDays = useApexStore(s => s.user.streakDays);
  const userStreakLastAt = useApexStore(s => s.user.streakLastAt);
  const cardThemeColor = useApexStore(s => s.user.cardThemeColor);

  // ─── DYNAMIC APP THEME ENGINE ───
  useEffect(() => {
    applyAppTheme(cardThemeColor || '#E50914');
  }, [cardThemeColor]);

  // ─── DAILY STREAK AUTO POPUP (Only Once Per Calendar Day If Not Already Claimed) ───
  useEffect(() => {
    if (onboardingCompleted && userId) {
      const today = new Date().toDateString();
      const userKey = `apex_last_streak_popup_${userId || userUsername}`;
      const lastShown = localStorage.getItem(userKey);

      // Check if already claimed today (only if user has claimed before, i.e. streakDays > 0)
      const lastClaim = userStreakLastAt ? new Date(userStreakLastAt) : null;
      const now = new Date();
      const isClaimedToday = lastClaim !== null && 
        (userStreakDays || 0) > 0 &&
        now.getFullYear() === lastClaim.getFullYear() &&
        now.getMonth() === lastClaim.getMonth() &&
        now.getDate() === lastClaim.getDate();

      if (lastShown !== today && !isClaimedToday) {
        localStorage.setItem(userKey, today);
        const timer = setTimeout(() => {
          useApexStore.getState().setStreakModalOpen(true);
        }, 1200);
        return () => clearTimeout(timer);
      }
    }
  }, [onboardingCompleted, userId, userUsername, userStreakDays, userStreakLastAt]);

  if (!isAuthReady) {
    return (
      <div className="min-h-[100dvh] bg-[#080808] flex flex-col items-center justify-center select-none font-sans">
        <div className="relative flex flex-col items-center">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#1a1a1a] to-[#0d0d0d] border border-white/10 flex items-center justify-center shadow-2xl relative overflow-hidden">
            <div className="w-8 h-8 rounded-lg bg-[#E50914] flex items-center justify-center shadow-lg shadow-red-950/60 font-black text-white text-base tracking-tighter">
              A
            </div>
            <div className="absolute inset-0 apex-skeleton opacity-20 pointer-events-none" />
          </div>
          <span className="mt-4 text-xs font-black tracking-[0.25em] text-white/70 uppercase">
            APEX
          </span>
          <span className="text-[10px] text-white/30 tracking-wider mt-1">
            EVERY STREET IS A TRACK
          </span>
        </div>
      </div>
    );
  }

  // If user has not completed onboarding, display the onboarding experience exclusively
  if (!onboardingCompleted) {
    return (
      <div className="fixed inset-0 z-50 bg-[#080808] overflow-hidden">
        <OnboardingModal isOpen={true} onClose={() => {}} />
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

      {/* Daily Streak & Rewards Box */}
      <DailyStreakModal />

      {/* Notification Center & Active Hunts Drawer */}
      <NotificationCenterModal />

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
      <AuthDiagnosticPanel />
    </div>
  );
};

export default App;
