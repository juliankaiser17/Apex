import React, { useEffect, useState } from 'react';
import { supabase, getAuthoritativeUser } from './lib/supabase';
import { useApexStore } from './store/useApexStore';
import { HeaderBar } from './components/common/HeaderBar';
import { TabBar } from './components/common/TabBar';
import { AmbientBackground } from './components/common/AmbientBackground';
import { HomeScreen } from './components/home/HomeScreen';
import { ActiveHuntNotification } from './components/hunts/ActiveHuntNotification';
import { EnthusiastModal } from './components/premium/EnthusiastModal';
import { LevelUpModal } from './components/common/LevelUpModal';
import { DailyStreakModal } from './components/common/DailyStreakModal';
import { NotificationCenterModal } from './components/common/NotificationCenterModal';
import { AuthDiagnosticPanel } from './components/admin/AuthDiagnosticPanel';
import { ModuleErrorBoundary } from './components/common/ModuleErrorBoundary';

const MapScreen = React.lazy(() => import('./components/map/MapScreen').then(m => ({ default: m.MapScreen })));
const GarageScreen = React.lazy(() => import('./components/garage/GarageScreen').then(m => ({ default: m.GarageScreen })));
const SocialScreen = React.lazy(() => import('./components/social/SocialScreen').then(m => ({ default: m.SocialScreen })));
const ScannerModal = React.lazy(() => import('./components/scanner/ScannerModal').then(m => ({ default: m.ScannerModal })));
const OnboardingModal = React.lazy(() => import('./components/onboarding/OnboardingModal').then(m => ({ default: m.OnboardingModal })));
const Card3DDetail = React.lazy(() => import('./components/garage/Card3DDetail').then(m => ({ default: m.Card3DDetail })));
const ProfileSettingsModal = React.lazy(() => import('./components/profile/ProfileSettingsModal').then(m => ({ default: m.ProfileSettingsModal })));
const ProfileScreen = React.lazy(() => import('./components/profile/ProfileScreen').then(m => ({ default: m.ProfileScreen })));
const HuntScreen = React.lazy(() => import('./components/hunts/HuntScreen').then(m => ({ default: m.HuntScreen })));
const StoreScreenshotFixtures = import.meta.env.DEV 
  ? React.lazy(() => import('./components/dev/StoreScreenshotFixtures').then(m => ({ default: m.StoreScreenshotFixtures }))) 
  : null;

import { requestRealLocationPermission } from './utils/geolocation';
import { applyAppTheme, THEME_ACCENT_PALETTES } from './utils/theme';

import { logAuthTransition } from './utils/authLogger';
import { ToastProvider } from './components/ui/Toast';

export const App: React.FC = () => {
  const [isAuthReady, setIsAuthReady] = useState(false);
  useEffect(() => {
    document.title = 'APEX — Every Street Is a Track';
    logAuthTransition('AUTH_INIT_START');

    // ─── PHASE 6: APP STARTUP & DETERMINISTIC SESSION RESOLUTION ───
    useApexStore.getState().setAuthStatus('AUTH_LOADING', null);

    const hasAuthCallback = typeof window !== 'undefined' && (
      window.location.hash.includes('access_token=') || 
      window.location.hash.includes('refresh_token=') ||
      window.location.search.includes('code=')
    );

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        // Authoritatively verify with Supabase server in background
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
      } else if (hasAuthCallback) {
        // Wait for onAuthStateChange to process OAuth callback tokens, don't flash guest
        logAuthTransition('OAUTH_CALLBACK_PENDING');
      } else {
        // No Supabase session: check if cached authenticated user exists before dropping to guest
        const cached = useApexStore.getState().user;
        if (cached?.id && cached.email && !cached.id.startsWith('user_')) {
          logAuthTransition('CACHED_SESSION_PRESERVED', cached.id, cached.email);
          useApexStore.getState().setAuthStatus('AUTHENTICATED', { id: cached.id, email: cached.email });
        } else {
          useApexStore.getState().setAuthStatus('GUEST', null);
          logAuthTransition('GUEST_SESSION_STARTED');
        }
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
  const scannerOpen = useApexStore(s => s.scannerOpen);
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
    applyAppTheme(cardThemeColor || THEME_ACCENT_PALETTES[0].hex);
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

  // Dev-only store screenshot mode (0 network calls, local static fixtures)
  if (import.meta.env.DEV && StoreScreenshotFixtures && typeof window !== 'undefined' && window.location.search.includes('fixture=screenshot')) {
    return (
      <React.Suspense fallback={null}>
        <StoreScreenshotFixtures />
      </React.Suspense>
    );
  }

  if (!isAuthReady) {
    return (
      <div className="min-h-[100dvh] bg-[var(--color-void)] flex flex-col items-center justify-center select-none font-sans">
        <div className="relative flex flex-col items-center">
          <div className="w-16 h-16 rounded-2xl bg-[var(--color-panel-2)] border border-[var(--color-line)] flex items-center justify-center shadow-2xl relative overflow-hidden">
            <div className="w-8 h-8 rounded-lg bg-[var(--color-accent)] flex items-center justify-center shadow-lg font-black text-white text-base tracking-tighter">
              A
            </div>
            <div className="absolute inset-0 apex-skeleton opacity-20 pointer-events-none" />
          </div>
          <span className="mt-4 text-caption font-black tracking-[0.25em] text-[var(--color-text)] uppercase font-display">
            APEX
          </span>
          <span className="text-[10px] text-[var(--color-text-3)] tracking-wider mt-1 font-sans">
            EVERY STREET IS A TRACK
          </span>
        </div>
      </div>
    );
  }

  // If user has not completed onboarding, display the onboarding experience exclusively
  if (!onboardingCompleted) {
    return (
      <div className="fixed inset-0 z-50 bg-[var(--color-void)] overflow-hidden">
        <OnboardingModal isOpen={true} onClose={() => {}} />
      </div>
    );
  }

  return (
    <ToastProvider>
      <div className="min-h-[100dvh] bg-[var(--color-void)] text-[var(--color-text)] flex flex-col selection:bg-[var(--color-accent)] selection:text-white relative z-0 pb-[100px] font-sans">
      {/* Ambient Background (Omitted while scanner active to ensure full transparency) */}
      {!scannerOpen && <AmbientBackground />}

      {/* Top Status Header (Omitted while scanner active) */}
      {!scannerOpen && <HeaderBar />}

      {/* Main Tab Viewport (Omitted while scanner active to prevent rendering beneath viewfinder) */}
      {!scannerOpen && (
        <main className="flex-1 flex flex-col">
          {activeTab === 'home' && (
            <ModuleErrorBoundary moduleName="Dashboard">
              <HomeScreen />
            </ModuleErrorBoundary>
          )}
          {activeTab === 'map' && (
            <ModuleErrorBoundary moduleName="Radar Map">
              <React.Suspense fallback={null}>
                <MapScreen />
              </React.Suspense>
            </ModuleErrorBoundary>
          )}
          {activeTab === 'garage' && (
            <ModuleErrorBoundary moduleName="Garage Vault">
              <React.Suspense fallback={null}>
                <GarageScreen />
              </React.Suspense>
            </ModuleErrorBoundary>
          )}
          {activeTab === 'social' && (
            <ModuleErrorBoundary moduleName="Spotter Feed">
              <React.Suspense fallback={null}>
                <SocialScreen />
              </React.Suspense>
            </ModuleErrorBoundary>
          )}
          {activeTab === 'profile' && (
            <ModuleErrorBoundary moduleName="Spotter Profile">
              <React.Suspense fallback={null}>
                <ProfileScreen />
              </React.Suspense>
            </ModuleErrorBoundary>
          )}
        </main>
      )}

      {/* Fixed Bottom 5-Tab Bar (Omitted while scanner active) */}
      {!scannerOpen && <TabBar />}

      {/* Global 3D Card Detail Modal (accessible from Map, Home, Garage & Social) */}
      {selectedCardForDetail && (
        <ModuleErrorBoundary moduleName="3D Card Viewer">
          <React.Suspense fallback={null}>
            <Card3DDetail
              card={selectedCardForDetail}
              onClose={() => setSelectedCardForDetail(null)}
            />
          </React.Suspense>
        </ModuleErrorBoundary>
      )}

      {/* Modals & Overlays */}
      <ModuleErrorBoundary moduleName="Vision Scanner">
        <React.Suspense fallback={null}>
          <ScannerModal />
        </React.Suspense>
      </ModuleErrorBoundary>
      <ActiveHuntNotification />
      <EnthusiastModal />

      {/* Profile & Privacy Settings Modal */}
      <React.Suspense fallback={null}>
        <ProfileSettingsModal
          isOpen={settingsModalOpen}
          onClose={() => setSettingsModalOpen(false)}
        />
      </React.Suspense>

      {/* Daily Streak & Rewards Box */}
      <DailyStreakModal />

      {/* Notification Center & Active Hunts Drawer */}
      <NotificationCenterModal />

      {/* Dedicated Full-Screen Hunt Experience */}
      <React.Suspense fallback={null}>
        <HuntScreen
          hunt={activeHuntModal}
          onClose={closeHuntModal}
          onOpenScanner={() => {
            closeHuntModal();
            setScannerOpen(true);
          }}
        />
      </React.Suspense>
      
      <LevelUpModal />
      <AuthDiagnosticPanel />
    </div>
  </ToastProvider>
  );
};

export default App;
