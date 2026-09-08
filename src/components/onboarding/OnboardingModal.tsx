import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { User, AtSign, ChevronLeft, MapPin, AlertCircle } from 'lucide-react';
import { useApexStore } from '../../store/useApexStore';
import { isUsernameTaken } from '../../services/userService';
import { triggerGoogleSignIn } from '../../services/googleAuthService';
import { sounds } from '../../utils/audio';
import { SPRING_HEAVY, SPRING_POP, SPRING_SETTLE, GLOW_ORANGE } from '../../utils/animationConfig';
import confetti from 'canvas-confetti';
import { requestRealLocationPermission, geocodeCity } from '../../utils/geolocation';
import { Camera as CapCamera } from '@capacitor/camera';
import { supabase } from '../../lib/supabase';
import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { normalizeEmail, isValidEmail } from '../../utils/emailUtils';

interface OnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type OnboardingStep = 'auth' | 'email_otp' | 'profile_setup' | 'cam_perm' | 'loc_perm' | 'notif_perm' | 'celebration';

// ─── SVG ICONS ───

const AppleIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className || 'w-4 h-4'} viewBox="0 0 170 170" fill="currentColor">
    <path d="M150.37 130.25c-2.45 5.66-5.35 10.87-8.71 15.66-4.58 6.53-8.33 11.05-11.22 13.56-4.48 4.12-9.28 6.23-14.42 6.35-3.69 0-8.14-1.05-13.32-3.18-5.19-2.12-9.97-3.17-14.34-3.17-4.58 0-9.49 1.05-14.75 3.17-5.26 2.13-9.5 3.24-12.74 3.35-4.35.13-9.16-1.9-14.42-6.08-3.69-3.04-7.69-7.85-12-14.43-6.19-9.45-11.03-20.19-14.52-32.22-3.48-12.03-5.23-23.47-5.23-34.33 0-14.45 3.63-26.65 10.89-36.59 7.26-9.94 16.48-15.02 27.66-15.24 5.34 0 11.21 1.41 17.62 4.23 6.4 2.82 10.45 4.3 12.14 4.44 1.45-.14 5.69-1.68 12.72-4.63 7.03-2.95 13.06-4.22 18.09-3.8 13.38 1.09 23.95 6.09 31.7 15.02-11.75 7.17-17.51 16.9-17.29 29.2.22 9.68 3.98 17.75 11.29 24.23 7.31 6.47 16.14 10.14 26.5 11-2.18 6.53-4.9 13.1-8.17 19.71zm-32.99-106.6c0-6.74 2.45-13.1 7.35-19.07 4.9-5.97 11.08-9.84 18.54-11.61 1.09 4.35 1.09 8.91 0 13.68-1.09 4.77-3.32 9.4-6.69 13.9-3.48 4.67-7.66 8.15-12.54 10.43-4.88 2.28-9.33 3.35-13.35 3.2-1.31-3.48-1.31-6.96 0-10.53z" />
  </svg>
);

const GoogleIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className || 'w-4 h-4'} viewBox="0 0 24 24">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
  </svg>
);

const ApertureIris: React.FC = () => {
  const blades = 8;
  return (
    <svg width="64" height="64" viewBox="0 0 72 72" fill="none">
      {Array.from({ length: blades }).map((_, i) => {
        const angle = (360 / blades) * i;
        const rad = (angle * Math.PI) / 180;
        const x1 = 36 + 14 * Math.cos(rad);
        const y1 = 36 + 14 * Math.sin(rad);
        const x2 = 36 + 32 * Math.cos(rad);
        const y2 = 36 + 32 * Math.sin(rad);
        return (
          <motion.line
            key={i}
            x1={36} y1={36} x2={x2} y2={y2}
            stroke="#F0EBE3" strokeWidth="3" strokeLinecap="round"
            initial={{ x1: 36, y1: 36, x2: 36, y2: 36, opacity: 0 }}
            animate={{ x1, y1, x2, y2, opacity: 1 }}
            transition={{ delay: i * 0.06, duration: 1, ease: 'easeInOut' }}
          />
        );
      })}
      <motion.circle
        cx="36" cy="36" r="6" fill="#FF4500"
        initial={{ opacity: 0 }} animate={{ opacity: [0, 0.15, 0.15] }}
        transition={{ delay: 0.8, duration: 1 }}
      />
    </svg>
  );
};

const GpsCrosshair: React.FC = () => (
  <div className="relative w-16 h-16 flex items-center justify-center">
    <svg width="64" height="64" viewBox="0 0 72 72" fill="none" className="overflow-visible">
      <circle cx="36" cy="36" r="28" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" />
      <circle cx="36" cy="36" r="16" stroke="rgba(255,255,255,0.15)" strokeWidth="1" strokeDasharray="3 3" />
      <line x1="36" y1="4" x2="36" y2="18" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="36" y1="54" x2="36" y2="68" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="4" y1="36" x2="18" y2="36" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="54" y1="36" x2="68" y2="36" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="36" cy="36" r="4.5" fill="#E50914" />
      <motion.circle
        cx="36" cy="36" r="12" stroke="#E50914" strokeWidth="1.5" fill="none"
        initial={{ scale: 0.8, opacity: 0.9 }}
        animate={{ scale: 2.2, opacity: 0 }}
        transition={{ duration: 1.8, repeat: Infinity, ease: 'easeOut' }}
      />
    </svg>
  </div>
);

const NotificationBell: React.FC = () => (
  <motion.svg
    width="64" height="64" viewBox="0 0 72 72" fill="none"
    animate={{ rotate: [-12, 12, -12] }}
    transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
  >
    <path
      d="M36 12C26.0589 12 18 20.0589 18 30V44L12 50V54H60V50L54 44V30C54 20.0589 45.9411 12 36 12Z"
      stroke="#F0EBE3" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
    />
    <path d="M30 54C30 57.3137 32.6863 60 36 60C39.3137 60 42 57.3137 42 54" stroke="#FF4500" strokeWidth="2.5" />
    <circle cx="50" cy="18" r="5" fill="#FF4500" />
  </motion.svg>
);

export const OnboardingModal: React.FC<OnboardingModalProps> = ({ isOpen, onClose }) => {
  const { user, updateUserProfile, completeOnboarding, setAuthStatus } = useApexStore();
  const [step, setStep] = useState<OnboardingStep>('auth');
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');

  // Form states
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');
  const [otpCode, setOtpCode] = useState(['', '', '', '', '', '']);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Profile setup states
  const [displayNameInput, setDisplayNameInput] = useState(user.displayName || '');
  const [usernameInput, setUsernameInput] = useState(user.username || '');
  const [usernameError, setUsernameError] = useState('');
  const [isCheckingUsername, setIsCheckingUsername] = useState(false);
  const [selectedCity, setSelectedCity] = useState(user.city || '');
  const [selectedCountry, setSelectedCountry] = useState(user.country || '');

  // Initialize form defaults only on initial modal open
  useEffect(() => {
    if (isOpen) {
      if (!emailInput && user.email) setEmailInput(user.email);
      if (!displayNameInput && user.displayName) setDisplayNameInput(user.displayName);
      if (!usernameInput && user.username && !user.username.startsWith('user_') && !user.username.startsWith('spotter_') && !user.username.startsWith('hunter_')) {
        setUsernameInput(user.username);
      }
      if (!selectedCity && user.city) setSelectedCity(user.city);
      if (!selectedCountry && user.country) setSelectedCountry(user.country);
    }
  }, [isOpen]);

  // Real-time username availability validation
  useEffect(() => {
    if (!usernameInput || usernameInput.length < 3) {
      setUsernameError('');
      return;
    }
    const timer = setTimeout(async () => {
      setIsCheckingUsername(true);
      const clean = usernameInput.toLowerCase().replace(/[^a-z0-9_]/g, '');
      const taken = await isUsernameTaken(clean, user.id);
      setIsCheckingUsername(false);
      if (taken) {
        setUsernameError('Username already taken');
      } else {
        setUsernameError('');
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [usernameInput, user.id]);

  if (!isOpen) return null;

  // ─── AUTH ACTIONS (Step 1) ───

  const handleSignIn = async (cleanEmail: string) => {
    try {
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password: passwordInput,
      });

      if (signInError) {
        setAuthError(signInError.message || 'Invalid email or password. Please try again.');
        setIsAuthLoading(false);
        return;
      }

      if (signInData.user) {
        const u = signInData.user;
        const userEmail = u.email || cleanEmail;
        await useApexStore.getState().initializeSession(u.id, userEmail, 'email', u.user_metadata);

        // Inspect authoritative onboarding state from store or user_metadata
        if (useApexStore.getState().onboardingCompleted || u.user_metadata?.onboarding_completed === true) {
          useApexStore.getState().completeOnboarding();
          onClose();
          setIsAuthLoading(false);
          return;
        }

        // Check if user already has an established profile
        const currentUser = useApexStore.getState().user;
        const isProfileEstablished = Boolean(
          currentUser.username && 
          !currentUser.username.startsWith('hunter_') && 
          !currentUser.username.startsWith('spotter_') &&
          !currentUser.username.startsWith('user_')
        );

        if (isProfileEstablished && u.user_metadata?.onboarding_completed !== false) {
          useApexStore.getState().completeOnboarding();
          onClose();
          setIsAuthLoading(false);
          return;
        }

        // Only incomplete/unconfigured accounts route to profile setup
        setDisplayNameInput(currentUser.displayName || '');
        setUsernameInput(currentUser.username || '');
        setSelectedCity(currentUser.city || '');
        setSelectedCountry(currentUser.country || '');
        setStep('profile_setup');
        setIsAuthLoading(false);
        return;
      }
      setAuthError('Unable to sign in. Please verify credentials.');
    } catch (err: any) {
      console.warn('Sign in error:', err);
      setAuthError(err?.message || 'Sign in failed. Please check your network connection.');
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleSignUp = async (cleanEmail: string) => {
    try {
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: cleanEmail,
        password: passwordInput,
      });

      if (signUpError) {
        if (
          signUpError.message?.toLowerCase().includes('already registered') || 
          signUpError.message?.toLowerCase().includes('already exists')
        ) {
          setAuthError('An account with this email already exists. Please sign in with your password.');
          setAuthMode('signin');
        } else {
          setAuthError(signUpError.message || 'Unable to create account. Please try again.');
        }
        setIsAuthLoading(false);
        return;
      }

      // Supabase sometimes returns an obfuscated user with empty identities for existing accounts
      if (signUpData?.user && signUpData.user.identities && signUpData.user.identities.length === 0) {
        setAuthError('An account with this email already exists. Please sign in with your password.');
        setAuthMode('signin');
        setIsAuthLoading(false);
        return;
      }

      if (signUpData?.user) {
        const u = signUpData.user;
        const userEmail = u.email || cleanEmail;
        const derivedUsername = userEmail.split('@')[0].replace(/[^a-z0-9_]/gi, '').toLowerCase();

        await useApexStore.getState().initializeSession(u.id, userEmail, 'email', u.user_metadata);
        setDisplayNameInput(derivedUsername);
        setUsernameInput(derivedUsername);
        setStep('profile_setup');
        setIsAuthLoading(false);
        return;
      }

      setAuthError('Account created. Please check your email to confirm registration.');
    } catch (err: any) {
      console.warn('Sign up error:', err);
      setAuthError(err?.message || 'Account creation failed. Please retry.');
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleEnterTheSpace = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = normalizeEmail(emailInput);

    if (!isValidEmail(cleanEmail)) {
      setAuthError('Please enter a valid email address (e.g. name@gmail.com)');
      return;
    }

    if (!passwordInput || passwordInput.length < 6) {
      setAuthError('Please enter a password with at least 6 characters');
      return;
    }

    setAuthError('');
    setIsAuthLoading(true);
    sounds.playTargetLock();

    if (authMode === 'signin') {
      await handleSignIn(cleanEmail);
    } else {
      await handleSignUp(cleanEmail);
    }
  };

  const handleGuestSignIn = () => {
    sounds.playTargetLock();
    setIsAuthLoading(true);
    setAuthStatus('GUEST', null);
    const guestUsername = `spotter_${Math.floor(1000 + Math.random() * 9000)}`;
    updateUserProfile({
      email: '',
      username: guestUsername,
      displayName: ''
    });
    setDisplayNameInput('');
    setUsernameInput(guestUsername);
    setIsAuthLoading(false);
    setStep('profile_setup');
  };

  const handleGoogleSignIn = async () => {
    sounds.playTargetLock();
    setIsAuthLoading(true);
    setAuthError('');

    try {
      await triggerGoogleSignIn(
        async (gUser) => {
          if (gUser && gUser.email) {
            const cleanEmail = normalizeEmail(gUser.email);
            const userEmail = cleanEmail;
            const dName = gUser.name || userEmail.split('@')[0] || '';
            const uName = (gUser.name || userEmail.split('@')[0]).replace(/[^a-z0-9_]/gi, '').toLowerCase() || '';

            await useApexStore.getState().initializeSession(gUser.id || user.id, userEmail, 'google', {
              full_name: dName,
              username: uName
            });

            if (useApexStore.getState().onboardingCompleted) {
              onClose();
              setIsAuthLoading(false);
              return;
            }

            const currentUser = useApexStore.getState().user;
            setDisplayNameInput(currentUser.displayName || dName);
            setUsernameInput(currentUser.username || uName);
            setStep('profile_setup');
          }
          setIsAuthLoading(false);
        },
        (errMsg) => {
          setIsAuthLoading(false);
          setAuthError(errMsg || 'Google sign in failed. Please try again or use Email.');
        }
      );
    } catch (e: any) {
      console.warn('Google sign in handler notice:', e);
      setIsAuthLoading(false);
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleAppleSignIn = () => {
    sounds.playTargetLock();
    setAuthError('Apple Sign In is available in App Store release build.');
  };

  // ─── OTP HANDLERS (Step 1.5) ───

  const handleOtpChange = (index: number, value: string) => {
    if (value.length > 1) {
      const digits = value.slice(0, 6).split('');
      const newOtp = [...otpCode];
      digits.forEach((d, i) => { if (index + i < 6) newOtp[index + i] = d; });
      setOtpCode(newOtp);
      const nextIdx = Math.min(index + digits.length, 5);
      otpRefs.current[nextIdx]?.focus();
      return;
    }

    const newOtp = [...otpCode];
    newOtp[index] = value;
    setOtpCode(newOtp);

    if (value && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otpCode[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  const verifyOtp = async () => {
    const token = otpCode.join('');
    if (token.length < 6) {
      setAuthError('Please enter the complete 6-digit code');
      return;
    }

    setIsAuthLoading(true);
    setAuthError('');
    sounds.playTargetLock();

    try {
      const { data, error } = await supabase.auth.verifyOtp({
        email: emailInput.trim(),
        token,
        type: 'email'
      });

      if (!error && data.user) {
        const u = data.user;
        const realEmail = u.email || emailInput.trim();
        const derivedUsername = realEmail.split('@')[0].replace(/[^a-z0-9_]/gi, '').toLowerCase();
        updateUserProfile({
          id: u.id,
          email: realEmail,
          username: user.username || derivedUsername,
          displayName: user.displayName || derivedUsername
        });
        setDisplayNameInput(user.displayName || derivedUsername);
        setUsernameInput(user.username || derivedUsername);
      }
      setStep('profile_setup');
    } catch (e: any) {
      setStep('profile_setup');
    } finally {
      setIsAuthLoading(false);
    }
  };

  // ─── PROFILE SETUP (Step 2) ───

  const handleProfileContinue = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUsername = usernameInput.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
    const cleanDisplayName = displayNameInput.trim() || cleanUsername || 'Apex Driver';

    if (!cleanUsername || cleanUsername.length < 3) {
      setUsernameError('Username must be at least 3 characters');
      return;
    }

    const taken = await isUsernameTaken(cleanUsername, user.id);
    if (taken) {
      setUsernameError('Username already taken');
      return;
    }

    sounds.playTargetLock();
    
    // Geocode city to ensure exact latitude and longitude on map
    const geo = await geocodeCity(selectedCity);

    const finalEmail = (emailInput.trim().includes('@') ? emailInput.trim().toLowerCase() : '') || (user.email && user.email.includes('@') ? user.email : '');

    updateUserProfile({
      displayName: cleanDisplayName,
      username: cleanUsername,
      email: finalEmail,
      city: geo.city || selectedCity,
      country: geo.country || selectedCountry,
      latitude: geo.lat,
      longitude: geo.lng
    });

    // 1. Update Supabase profiles table using ONLY valid existing columns
    try {
      await supabase.from('profiles').upsert([{
        id: user.id,
        display_name: cleanDisplayName,
        username: cleanUsername
      }], { onConflict: 'id' });
    } catch (dbErr) {
      console.warn('Profile Supabase upsert notice:', dbErr);
    }

    // 2. Update Supabase Auth user_metadata with city, country, and display name
    try {
      await supabase.auth.updateUser({
        data: {
          city: geo.city || selectedCity,
          country: geo.country || selectedCountry,
          username: cleanUsername,
          display_name: cleanDisplayName
        }
      });
    } catch (metaErr) {
      console.warn('Metadata update notice:', metaErr);
    }

    // Directly progress to Camera Permission (Roles eliminated)
    setStep('cam_perm');
  };

  // ─── PERMISSION HANDLERS ───

  const requestCamera = async () => {
    sounds.playTargetLock();
    try {
      await CapCamera.requestPermissions();
    } catch {}
    setStep('loc_perm');
  };

  const requestLocation = async (_isPrecise: boolean) => {
    sounds.playTargetLock();
    try {
      const res = await requestRealLocationPermission();
      if (res.city && res.city !== 'Your City') {
        setSelectedCity(res.city);
        setSelectedCountry(res.country);
        updateUserProfile({
          city: res.city,
          country: res.country,
          latitude: res.latitude,
          longitude: res.longitude
        });
      }
    } catch {}
    setStep('notif_perm');
  };

  const requestNotifications = async (enable: boolean) => {
    sounds.playTargetLock();
    if (enable) {
      try {
        if (Capacitor.isNativePlatform()) {
          await PushNotifications.requestPermissions();
        } else if ('Notification' in window && Notification.permission !== 'granted') {
          await Notification.requestPermission();
        }
      } catch (e) {
        console.warn('Notification permission request error:', e);
      }
    }
    setStep('celebration');
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#080808] flex flex-col justify-between overflow-hidden pt-safe pb-safe" style={{ height: '100dvh' }}>
      <AnimatePresence mode="wait">
        
        {/* ══════════════════════════════════════════════════════ */}
        {/* SCREEN 1 — AUTH / LOGIN (Clean Cohesive Spacing)        */}
        {/* ══════════════════════════════════════════════════════ */}
        {step === 'auth' && (
          <motion.div
            key="auth"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="relative flex flex-col min-h-full w-full max-w-md mx-auto px-6 pt-14 pb-8 overflow-y-auto scrollbar-hide select-none"
          >
            {/* Background hypercar photograph */}
            <div className="absolute inset-0 z-0 pointer-events-none">
              <img
                src="/auth-bg.jpg"
                alt="Background"
                className="w-full h-full object-cover filter brightness-35 scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#080808] via-[#080808]/75 to-transparent" />
            </div>

            {/* TOP BRAND HEADER (Moved down naturally, no awkward empty void) */}
            <div className="relative z-10 pt-4 mb-6 space-y-1">
              <span className="text-[#FF4500] font-data text-xs tracking-[0.25em] uppercase font-bold block">
                APEX
              </span>
              <h1 className="font-serif italic text-[44px] sm:text-[52px] text-white font-normal leading-[0.95] tracking-tight">
                Spot the best
              </h1>
              <p className="text-[#9A9088] text-[13px] leading-relaxed pt-1">
                {authMode === 'signin' ? 'Sign in to access your garage & stats.' : 'Create an account to begin your journey.'}
              </p>
            </div>

            {/* SIGN IN / CREATE ACCOUNT TOGGLE */}
            <div className="relative z-10 flex p-1 rounded-xl bg-white/[0.05] border border-white/10 mb-5">
              <button
                type="button"
                onClick={() => {
                  sounds.playTargetLock();
                  setAuthMode('signin');
                  setAuthError('');
                }}
                className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
                  authMode === 'signin'
                    ? 'bg-[#FF4500] text-white shadow'
                    : 'text-white/50 hover:text-white'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => {
                  sounds.playTargetLock();
                  setAuthMode('signup');
                  setAuthError('');
                }}
                className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
                  authMode === 'signup'
                    ? 'bg-[#FF4500] text-white shadow'
                    : 'text-white/50 hover:text-white'
                }`}
              >
                Create Account
              </button>
            </div>

            {/* INPUT FORM */}
            <form onSubmit={handleEnterTheSpace} className="relative z-10 space-y-5">
              <div>
                <label className="text-[10px] font-data font-semibold text-[#9A9088] uppercase tracking-[0.2em] block mb-1">
                  EMAIL
                </label>
                <input
                  type="email"
                  required
                  value={emailInput}
                  onChange={e => setEmailInput(e.target.value)}
                  placeholder="your.email@example.com"
                  className="w-full h-11 bg-transparent border-b border-white/20 text-white placeholder-white/30 focus:border-[#FF4500] outline-none text-[15px] font-sans transition-colors"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[10px] font-data font-semibold text-[#9A9088] uppercase tracking-[0.2em]">
                    PASSWORD
                  </label>
                  <button type="button" className="text-[11px] text-[#9A9088] hover:text-[#FF4500] transition-colors">
                    Forgot?
                  </button>
                </div>
                <input
                  type="password"
                  value={passwordInput}
                  onChange={e => setPasswordInput(e.target.value)}
                  placeholder="••••••••"
                  className="w-full h-11 bg-transparent border-b border-white/20 text-white placeholder-white/30 focus:border-[#FF4500] outline-none text-[15px] font-sans tracking-widest transition-colors"
                />
              </div>

              {authError && <p className="text-[#FF4500] text-xs font-data">{authError}</p>}

              {/* PRIMARY ACTION: SIGN IN / CREATE ACCOUNT */}
              <motion.button
                type="submit"
                disabled={isAuthLoading}
                whileTap={{ scale: 0.97 }}
                className="w-full h-12 rounded-2xl bg-[#FF4500] text-[#F0EBE3] font-display text-[17px] tracking-[1.5px] font-semibold transition-all mt-4 flex items-center justify-center gap-2 shadow-lg shadow-orange-950/40"
              >
                {isAuthLoading ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  authMode === 'signin' ? 'Sign in to Apex' : 'Create account'
                )}
              </motion.button>

              {/* SOCIAL SIGN IN BUTTONS */}
              <div className="grid grid-cols-2 gap-3 pt-3">
                <button
                  type="button"
                  onClick={handleAppleSignIn}
                  className="h-11 rounded-2xl bg-[#1A1A1A]/80 border border-white/10 text-white font-sans text-xs font-medium flex items-center justify-center gap-2 hover:bg-[#252525] active:scale-95 transition-all"
                >
                  <AppleIcon className="w-4 h-4" /> Apple
                </button>
                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  className="h-11 rounded-2xl bg-[#1A1A1A]/80 border border-white/10 text-white font-sans text-xs font-medium flex items-center justify-center gap-2 hover:bg-[#252525] active:scale-95 transition-all"
                >
                  <GoogleIcon className="w-4 h-4" /> Google
                </button>
              </div>

              {/* GUEST SPOTTER INSTANT ACCESS */}
              <div className="pt-2 text-center">
                <button
                  type="button"
                  onClick={handleGuestSignIn}
                  className="text-xs text-[#9A9088] hover:text-[#FF4500] font-sans tracking-wide transition-colors py-1 px-3 rounded-lg hover:bg-white/[0.03]"
                >
                  Or explore as <span className="text-white font-medium underline underline-offset-4">Guest Spotter</span> →
                </button>
              </div>

              {/* LEGAL TERMS & PRIVACY */}
              <div className="pt-4 pb-2 text-center text-[11px] text-[#9A9088]/80 leading-relaxed">
                By continuing, you agree to Apex&apos;s{' '}
                <a
                  href="https://apex-spotter.vercel.app/terms.html"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-white/90 hover:text-white underline underline-offset-2"
                >
                  Terms of Use
                </a>{' '}
                and{' '}
                <a
                  href="https://apex-spotter.vercel.app/privacy.html"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-white/90 hover:text-white underline underline-offset-2"
                >
                  Privacy Policy
                </a>.
              </div>
            </form>
          </motion.div>
        )}

        {/* ══════════════════════════════════════════════════════ */}
        {/* SCREEN 1.5 — EMAIL OTP CODE VERIFICATION              */}
        {/* ══════════════════════════════════════════════════════ */}
        {step === 'email_otp' && (
          <motion.div
            key="email_otp"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="relative flex flex-col justify-between min-h-full w-full max-w-md mx-auto px-6 py-8"
          >
            <div className="space-y-6 pt-4">
              <button
                onClick={() => setStep('auth')}
                className="w-10 h-10 rounded-full bg-white/[0.06] border border-white/[0.08] flex items-center justify-center text-white/70 hover:text-white transition-colors"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>

              <div>
                <span className="text-[#FF4500] font-data text-xs tracking-[0.25em] uppercase font-bold block mb-1">
                  SECURITY CODE
                </span>
                <h2 className="text-3xl font-bold text-white tracking-tight">
                  Verify your email
                </h2>
                <p className="text-xs text-[#9A9088] mt-1.5 leading-relaxed">
                  We sent a 6-digit confirmation code to <span className="text-white font-semibold">{emailInput}</span>.
                </p>
              </div>

              {/* 6 DIGIT OTP INPUT */}
              <div className="flex justify-between gap-2 py-4">
                {otpCode.map((digit, idx) => (
                  <input
                    key={idx}
                    ref={el => { otpRefs.current[idx] = el; }}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={e => handleOtpChange(idx, e.target.value)}
                    onKeyDown={e => handleOtpKeyDown(idx, e)}
                    className="w-12 h-14 text-center text-2xl font-bold font-data text-white bg-[#141414] border border-white/15 rounded-2xl focus:border-[#FF4500] focus:ring-1 focus:ring-[#FF4500] outline-none transition-all"
                  />
                ))}
              </div>

              {authError && (
                <p className="text-[#FF4500] text-xs font-data flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5" /> {authError}
                </p>
              )}
            </div>

            <div className="space-y-3 pb-4">
              <button
                onClick={verifyOtp}
                disabled={isAuthLoading || otpCode.join('').length < 6}
                className="w-full h-12 rounded-2xl bg-[#FF4500] text-white font-display text-[17px] tracking-[1.5px] font-semibold flex items-center justify-center gap-2 shadow-lg disabled:opacity-50 transition-all"
              >
                {isAuthLoading ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  'VERIFY & CONTINUE →'
                )}
              </button>
              <button
                onClick={() => setStep('profile_setup')}
                className="w-full text-center text-xs text-white/50 hover:text-white/80 py-1 transition-colors"
              >
                Skip verification in development
              </button>
            </div>
          </motion.div>
        )}

        {/* ══════════════════════════════════════════════════════ */}
        {/* SCREEN 2 — PROFILE SETUP                              */}
        {/* ══════════════════════════════════════════════════════ */}
        {step === 'profile_setup' && (
          <motion.div
            key="profile_setup"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="relative flex flex-col justify-between min-h-full w-full max-w-md mx-auto px-6 py-8 select-none"
          >
            <div className="space-y-6 pt-4">
              <div>
                <span className="text-[#FF4500] font-data text-xs tracking-[0.25em] uppercase font-bold block mb-1">
                  STAGE 01
                </span>
                <h2 className="text-3xl font-bold text-white tracking-tight">
                  Hunter Profile
                </h2>
                <p className="text-xs text-[#9A9088] mt-1">
                  Choose your identity in the global spotting community.
                </p>
              </div>

              <form id="profileForm" onSubmit={handleProfileContinue} className="space-y-4">
                <div>
                  <label className="text-[10px] font-data font-semibold text-[#9A9088] uppercase tracking-[0.2em] block mb-1">
                    DISPLAY NAME
                  </label>
                  <div className="relative flex items-center">
                    <User className="absolute left-3.5 w-4 h-4 text-white/40" />
                    <input
                      type="text"
                      required
                      value={displayNameInput}
                      onChange={e => setDisplayNameInput(e.target.value)}
                      placeholder="e.g. Alex Rivera"
                      className="w-full h-11 pl-10 pr-4 bg-[#141414] border border-white/15 rounded-2xl text-white placeholder-white/30 focus:border-[#FF4500] outline-none text-[14px] transition-colors"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[10px] font-data font-semibold text-[#9A9088] uppercase tracking-[0.2em]">
                      USERNAME
                    </label>
                    {isCheckingUsername && <span className="text-[10px] text-white/40">Checking...</span>}
                  </div>
                  <div className="relative flex items-center">
                    <AtSign className="absolute left-3.5 w-4 h-4 text-white/40" />
                    <input
                      type="text"
                      required
                      value={usernameInput}
                      onChange={e => setUsernameInput(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                      placeholder="hunter_handle"
                      className="w-full h-11 pl-10 pr-4 bg-[#141414] border border-white/15 rounded-2xl text-white placeholder-white/30 focus:border-[#FF4500] outline-none text-[14px] font-data transition-colors"
                    />
                  </div>
                  {usernameError && (
                    <p className="text-[#FF4500] text-[11px] font-data mt-1">{usernameError}</p>
                  )}
                </div>

                <div>
                  <label className="text-[10px] font-data font-semibold text-[#9A9088] uppercase tracking-[0.2em] block mb-1">
                    HOME BASE / CITY
                  </label>
                  <div className="relative flex items-center">
                    <MapPin className="absolute left-3.5 w-4 h-4 text-white/40" />
                    <input
                      type="text"
                      required
                      value={selectedCity}
                      onChange={e => setSelectedCity(e.target.value)}
                      placeholder="e.g. Los Angeles, Tokyo, London"
                      className="w-full h-11 pl-10 pr-4 bg-[#141414] border border-white/15 rounded-2xl text-white placeholder-white/30 focus:border-[#FF4500] outline-none text-[14px] transition-colors"
                    />
                  </div>
                </div>
              </form>
            </div>

            <div className="pb-4">
              <button
                type="submit"
                form="profileForm"
                className="w-full h-12 rounded-2xl bg-[#FF4500] text-white font-display text-[17px] tracking-[1.5px] font-semibold flex items-center justify-center gap-2 shadow-lg transition-all"
              >
                CONTINUE →
              </button>
            </div>
          </motion.div>
        )}

        {/* ══════════════════════════════════════════════════════ */}
        {/* SCREEN 3 — CAMERA PERMISSION                          */}
        {/* ══════════════════════════════════════════════════════ */}
        {step === 'cam_perm' && (
          <motion.div
            key="cam_perm"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="relative flex flex-col justify-between min-h-full w-full max-w-md mx-auto px-6 py-8 text-center"
          >
            <div className="space-y-4 pt-12 flex flex-col items-center">
              <div className="w-24 h-24 rounded-full bg-white/[0.03] border border-white/10 flex items-center justify-center shadow-xl">
                <ApertureIris />
              </div>
              <span className="text-[#FF4500] font-data text-xs tracking-[0.25em] uppercase font-bold block">
                VISION SCANNER
              </span>
              <h2 className="text-3xl font-bold text-white tracking-tight">
                Camera Access
              </h2>
              <p className="text-xs text-[#9A9088] max-w-xs leading-relaxed">
                APEX uses low-latency neural vision to detect makes, trims, and production years in real-time.
              </p>
            </div>

            <div className="space-y-3 pb-4">
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={requestCamera}
                className="w-full h-12 rounded-2xl bg-[#FF4500] text-white font-display text-[17px] tracking-[1.5px] font-semibold shadow-lg"
              >
                ENABLE CAMERA
              </motion.button>
              <button
                onClick={() => setStep('loc_perm')}
                className="w-full text-[#9A9088] text-[13px] underline py-1"
              >
                Skip for now →
              </button>
            </div>
          </motion.div>
        )}

        {/* ══════════════════════════════════════════════════════ */}
        {/* SCREEN 4 — LOCATION PERMISSION                        */}
        {/* ══════════════════════════════════════════════════════ */}
        {step === 'loc_perm' && (
          <motion.div
            key="loc_perm"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="relative flex flex-col justify-between min-h-full w-full max-w-md mx-auto px-6 py-8 text-center"
          >
            <div className="space-y-4 pt-12 flex flex-col items-center">
              <div className="w-24 h-24 rounded-full bg-white/[0.03] border border-white/10 flex items-center justify-center shadow-xl">
                <GpsCrosshair />
              </div>
              <span className="text-[#FF4500] font-data text-xs tracking-[0.25em] uppercase font-bold block">
                GLOBAL RADAR
              </span>
              <h2 className="text-3xl font-bold text-white tracking-tight">
                Location Tracking
              </h2>
              <p className="text-xs text-[#9A9088] max-w-xs leading-relaxed">
                Pin your vehicle spots to live city heatmaps, unlock district discovery badges, and trigger nearby hunt radar.
              </p>
            </div>

            <div className="space-y-3 pb-4">
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={() => requestLocation(true)}
                className="w-full h-12 rounded-2xl bg-[#FF4500] text-white font-display text-[17px] tracking-[1.5px] font-semibold shadow-lg"
              >
                ENABLE LOCATION
              </motion.button>
              <button
                onClick={() => requestLocation(false)}
                className="w-full text-[#9A9088] text-[13px] underline py-1"
              >
                Use default city →
              </button>
            </div>
          </motion.div>
        )}

        {/* ══════════════════════════════════════════════════════ */}
        {/* SCREEN 5 — NOTIFICATION PERMISSION                    */}
        {/* ══════════════════════════════════════════════════════ */}
        {step === 'notif_perm' && (
          <motion.div
            key="notif_perm"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="relative flex flex-col justify-between min-h-full w-full max-w-md mx-auto px-6 py-8 text-center"
          >
            <div className="space-y-4 pt-12 flex flex-col items-center">
              <div className="w-24 h-24 rounded-full bg-white/[0.03] border border-white/10 flex items-center justify-center shadow-xl">
                <NotificationBell />
              </div>
              <span className="text-[#FF4500] font-data text-xs tracking-[0.25em] uppercase font-bold block">
                HUNT RADAR
              </span>
              <h2 className="text-3xl font-bold text-white tracking-tight">
                Hypercar Alerts
              </h2>
              <p className="text-xs text-[#9A9088] max-w-xs leading-relaxed">
                Get real-time beacon pings when rare or exotic vehicles are spotted in your perimeter.
              </p>
            </div>

            <div className="space-y-3 pb-4">
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={() => requestNotifications(true)}
                className="w-full h-12 rounded-2xl bg-[#FF4500] text-white font-display text-[17px] tracking-[1.5px] font-semibold shadow-lg"
              >
                ENABLE NOTIFICATIONS
              </motion.button>
              <button
                onClick={() => requestNotifications(false)}
                className="w-full text-[#9A9088] text-[13px] underline py-1"
              >
                Maybe later →
              </button>
            </div>
          </motion.div>
        )}

        {/* ══════════════════════════════════════════════════════ */}
        {/* SCREEN 6 — CELEBRATION (LEVEL 1 BEGINNER ENTRY)       */}
        {/* ══════════════════════════════════════════════════════ */}
        {step === 'celebration' && (
          <CelebrationScreen
            onEnter={() => { completeOnboarding(); onClose(); }}
          />
        )}

      </AnimatePresence>
    </div>
  );
};

// ─── CELEBRATION SCREEN (LEVEL 1 BEGINNER START) ───

const CelebrationScreen: React.FC<{ onEnter: () => void }> = ({ onEnter }) => {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const t1 = setTimeout(() => setPhase(1), 200);
    const t2 = setTimeout(() => setPhase(2), 660);
    const t3 = setTimeout(() => setPhase(3), 760);
    const t4 = setTimeout(() => {
      setPhase(4);
      confetti({
        particleCount: 40,
        spread: 180,
        origin: { y: 0.5, x: 0.5 },
        colors: ['#FF4500', '#FFA500', '#F0EBE3'],
        disableForReducedMotion: true,
      });
    }, 900);
    const t5 = setTimeout(() => setPhase(5), 2000);
    const t6 = setTimeout(() => onEnter(), 5200);

    return () => { [t1, t2, t3, t4, t5, t6].forEach(clearTimeout); };
  }, []);

  return (
    <motion.div key="celebration" className="relative flex flex-col min-h-full items-center justify-center bg-[#080808] px-6 select-none">
      <AnimatePresence>
        {phase >= 1 && phase < 2 && (
          <motion.div
            className="absolute inset-0 z-50"
            style={{ background: '#FF4500' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
          />
        )}
      </AnimatePresence>

      {phase >= 2 && (
        <motion.h1
          className="font-display text-[60px] sm:text-[76px] text-[#F0EBE3] tracking-widest leading-none text-center"
          initial={{ y: -60, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={SPRING_HEAVY}
        >
          WELCOME
        </motion.h1>
      )}

      {phase >= 3 && (
        <motion.h2
          className="font-display text-[38px] sm:text-[46px] text-[#FF4500] tracking-wider leading-none mt-2 text-center"
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={SPRING_POP}
        >
          TO APEX.
        </motion.h2>
      )}

      {phase >= 4 && (
        <div className="flex items-center gap-2.5 mt-8">
          {[
            { icon: 'LVL', label: 'LEVEL 1' },
            { icon: 'TIER', label: 'BEGINNER' },
            { icon: 'RANK', label: 'UNRANKED' },
          ].map((chip, i) => (
            <motion.div
              key={chip.label}
              className="px-3 py-1.5 rounded-lg text-[12px] font-medium"
              style={{ background: '#1A1A1A', color: '#F0EBE3', fontFamily: "'DM Sans', sans-serif" }}
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: i * 0.12, ...SPRING_SETTLE }}
            >
              {chip.icon} {chip.label}
            </motion.div>
          ))}
        </div>
      )}

      {phase >= 5 && (
        <motion.button
          onClick={onEnter}
          className="absolute bottom-10 left-6 right-6 h-13 rounded-2xl font-display text-[20px] tracking-[2px] text-[#F0EBE3]"
          style={{ background: '#FF4500', boxShadow: GLOW_ORANGE }}
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={SPRING_SETTLE}
          whileTap={{ scale: 0.96 }}
        >
          START SPOTTING →
        </motion.button>
      )}
    </motion.div>
  );
};
