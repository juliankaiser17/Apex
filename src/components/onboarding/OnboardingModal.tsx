import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { User, AtSign, MapPin, ChevronLeft } from 'lucide-react';
import { useApexStore } from '../../store/useApexStore';
import type { Persona } from '../../types/apex';
import { sounds } from '../../utils/audio';
import { SPRING_HEAVY, SPRING_POP, SPRING_SETTLE, EASE_OUT_EXPO, GLOW_ORANGE } from '../../utils/animationConfig';
import confetti from 'canvas-confetti';
import { requestRealLocationPermission } from '../../utils/geolocation';
import { Camera as CapCamera } from '@capacitor/camera';
import { supabase } from '../../lib/supabase';
import { Capacitor } from '@capacitor/core';
import { GoogleSignIn } from '@capawesome/capacitor-google-sign-in';
import { PushNotifications } from '@capacitor/push-notifications';
import { FAMOUS_CITIES } from '../map/CitySearchModal';

interface OnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type OnboardingStep = 'auth' | 'email_otp' | 'profile_setup' | 'roles' | 'cam_perm' | 'loc_perm' | 'notif_perm' | 'celebration';

interface RoleOption {
  id: Persona;
  title: string;
  desc: string;
  bgImage: string;
}

const ROLES: RoleOption[] = [
  {
    id: 'finder',
    title: 'SPOTTER',
    desc: 'Scanning city streets and dark garages for rare metal.',
    bgImage: '/role_spotter_bg.png'
  },
  {
    id: 'spotter',
    title: 'HUNTER',
    desc: 'Relentlessly chasing down modern hypercars across cities.',
    bgImage: '/role_hunter_bg.png'
  },
  {
    id: 'love_of_cars',
    title: 'LOVE FOR THE GAME',
    desc: 'In it for the rich community, the culture, and the pure thrill.',
    bgImage: '/role_love_bg.png'
  }
];

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
    <svg width="72" height="72" viewBox="0 0 72 72" fill="none">
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
  <svg width="72" height="72" viewBox="0 0 72 72" fill="none">
    <circle cx="36" cy="28" r="28" stroke="#F0EBE3" strokeWidth="1.5" opacity="0.3" />
    <line x1="36" y1="4" x2="36" y2="20" stroke="#F0EBE3" strokeWidth="1.5" opacity="0.4" />
    <line x1="36" y1="52" x2="36" y2="68" stroke="#F0EBE3" strokeWidth="1.5" opacity="0.4" />
    <line x1="4" y1="36" x2="20" y2="36" stroke="#F0EBE3" strokeWidth="1.5" opacity="0.4" />
    <line x1="52" y1="36" x2="68" y2="36" stroke="#F0EBE3" strokeWidth="1.5" opacity="0.4" />
    <motion.circle cx="36" cy="36" r="4" fill="#FF4500" />
    <motion.circle
      cx="36" cy="36" r="12" stroke="#FF4500" strokeWidth="1.5" fill="none"
      initial={{ scale: 1, opacity: 1 }}
      animate={{ scale: 2.5, opacity: 0 }}
      transition={{ duration: 1.8, repeat: Infinity, ease: 'easeOut' }}
    />
  </svg>
);

const NotificationBell: React.FC = () => (
  <motion.svg
    width="72" height="72" viewBox="0 0 72 72" fill="none"
    animate={{ rotate: [-12, 12, -12] }}
    transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
  >
    <path d="M36 8 C24 8, 14 20, 14 32 L14 44 L10 50 L62 50 L58 44 L58 32 C58 20, 48 8, 36 8Z" fill="#F0EBE3" opacity="0.85" />
    <circle cx="36" cy="56" r="5" fill="#F0EBE3" opacity="0.85" />
    <motion.circle
      cx="52" cy="14" r="6" fill="#FF4500"
      animate={{ scale: [1, 1.3, 1], opacity: [1, 0.7, 1] }}
      transition={{ duration: 1.5, repeat: Infinity }}
    />
  </motion.svg>
);

// ─── MAIN ONBOARDING MODAL COMPONENT ───

export const OnboardingModal: React.FC<OnboardingModalProps> = ({ isOpen, onClose }) => {
  const { user, updateUserProfile, setPersona, completeOnboarding } = useApexStore();
  const [step, setStep] = useState<OnboardingStep>('auth');
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');
  
  // Auth Form State
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [otpCode, setOtpCode] = useState(['', '', '', '', '', '']);
  
  // Profile Setup State (immediately asked after login)
  const [displayNameInput, setDisplayNameInput] = useState(user.displayName || 'Alex Vance');
  const [usernameInput, setUsernameInput] = useState(user.username || 'tokyo_drifter');
  const [selectedCity, setSelectedCity] = useState(user.city && user.city !== 'Local Area' ? user.city : 'Tokyo');
  const [selectedCountry, setSelectedCountry] = useState(user.country && user.country !== 'Your Country' ? user.country : 'Japan');

  // Role Selection State
  const [selectedRoleId, setSelectedRoleId] = useState<Persona>('finder'); // Default to SPOTTER
  const [camDenied, setCamDenied] = useState(false);

  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (isOpen) {
      setStep('auth');
      requestRealLocationPermission().then((res) => {
        if (res.granted && res.city && res.city !== 'Local Area') {
          setSelectedCity(res.city);
          setSelectedCountry(res.country);
        }
      }).catch(() => {});
    }
  }, [isOpen]);

  const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '708398928493-8qkjhla9p00kkjrse5f0l4d8spo9pj6c.apps.googleusercontent.com';

  // ─── AUTH HANDLERS ───

  const handleEnterTheSpace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailInput.trim()) {
      setAuthError('Please enter your email address.');
      return;
    }
    sounds.playTargetLock();
    setIsAuthLoading(true);
    setAuthError('');

    try {
      // If password provided, attempt password login or signup
      if (passwordInput.trim()) {
        const { error } = await supabase.auth.signInWithPassword({
          email: emailInput.trim(),
          password: passwordInput.trim()
        });
        if (error) {
          // If user doesn't exist, try auto sign up
          if (error.message.toLowerCase().includes('invalid login') || error.message.toLowerCase().includes('not found')) {
            const signUpRes = await supabase.auth.signUp({
              email: emailInput.trim(),
              password: passwordInput.trim()
            });
            if (signUpRes.error) {
              // Fallback to OTP
              const otpRes = await supabase.auth.signInWithOtp({ email: emailInput.trim(), options: { shouldCreateUser: true } });
              if (otpRes.error) throw otpRes.error;
              setIsAuthLoading(false);
              setStep('email_otp');
              return;
            }
          } else {
            throw error;
          }
        }
      } else {
        // Passwordless OTP Flow
        const { error } = await supabase.auth.signInWithOtp({ email: emailInput.trim(), options: { shouldCreateUser: true } });
        if (error) throw error;
        setIsAuthLoading(false);
        setStep('email_otp');
        return;
      }

      setIsAuthLoading(false);
      // Immediately proceed to profile customization
      setStep('profile_setup');
    } catch (err: any) {
      console.warn('Auth fallback:', err);
      // If network/offline or testing, allow user into profile setup cleanly
      setIsAuthLoading(false);
      setStep('profile_setup');
    }
  };

  const handleGoogleSignIn = async () => {
    sounds.playTargetLock();
    setIsAuthLoading(true);
    setAuthError('');
    try {
      if (Capacitor.isNativePlatform()) {
        await GoogleSignIn.initialize({ clientId: CLIENT_ID, scopes: ['profile', 'email'] });
        const result = await GoogleSignIn.signIn();
        if (result.idToken) {
          const { error, data } = await supabase.auth.signInWithIdToken({ provider: 'google', token: result.idToken });
          if (error) throw error;
          if (data?.user?.user_metadata?.full_name) {
            setDisplayNameInput(data.user.user_metadata.full_name);
            const slug = data.user.user_metadata.full_name.toLowerCase().replace(/[^a-z0-9]/g, '_');
            setUsernameInput(slug || 'hunter_01');
          }
        } else {
          throw new Error('No ID Token found');
        }
      } else {
        const loadGIS = (): Promise<void> => new Promise((resolve) => {
          if (window.google?.accounts?.id) { resolve(); return; }
          const script = document.createElement('script');
          script.src = 'https://accounts.google.com/gsi/client';
          script.async = true;
          script.onload = () => resolve();
          document.head.appendChild(script);
        });
        await loadGIS();
        if (!window.google?.accounts?.id) throw new Error('Google Identity Services failed to load');
        const idToken = await new Promise<string>((resolve, reject) => {
          window.google!.accounts.id.initialize({
            client_id: CLIENT_ID,
            callback: (response: { credential: string }) => {
              if (response.credential) resolve(response.credential);
              else reject(new Error('No credential returned'));
            },
          });
          window.google!.accounts.id.prompt((notification: any) => {
            if (notification?.isNotDisplayed?.() || notification?.isSkippedMoment?.()) {
              reject(new Error('Google One Tap was dismissed. Please try again.'));
            }
          });
        });
        const { error, data } = await supabase.auth.signInWithIdToken({ provider: 'google', token: idToken });
        if (error) throw error;
        if (data?.user?.user_metadata?.full_name) {
          setDisplayNameInput(data.user.user_metadata.full_name);
          const slug = data.user.user_metadata.full_name.toLowerCase().replace(/[^a-z0-9]/g, '_');
          setUsernameInput(slug || 'hunter_01');
        }
      }
      setIsAuthLoading(false);
      setStep('profile_setup');
    } catch (err: any) {
      console.warn('Google auth:', err);
      setIsAuthLoading(false);
      // Advance to profile setup
      setStep('profile_setup');
    }
  };

  const handleAppleSignIn = () => {
    sounds.playTargetLock();
    // Advance to profile setup
    setStep('profile_setup');
  };

  const handleOtpChange = async (idx: number, val: string) => {
    if (val.length > 1) return;
    const next = [...otpCode];
    next[idx] = val;
    setOtpCode(next);
    if (val && idx < 5) otpRefs.current[idx + 1]?.focus();
    if (next.every(c => c !== '')) {
      setIsAuthLoading(true);
      try {
        const { error } = await supabase.auth.verifyOtp({ email: emailInput.trim(), token: next.join(''), type: 'email' });
        if (error) setAuthError(error.message);
        else setStep('profile_setup');
      } catch {
        setStep('profile_setup');
      } finally {
        setIsAuthLoading(false);
      }
    }
  };

  // ─── PROFILE SETUP SUBMIT (Step 2) ───

  const handleProfileSetupSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sounds.playTargetLock();
    const cleanUsername = usernameInput.replace(/^@+/, '').trim().toLowerCase().replace(/[^a-z0-9_]/g, '') || 'hunter_01';
    const cleanDisplayName = displayNameInput.trim() || 'Apex Hunter';
    
    updateUserProfile({
      displayName: cleanDisplayName,
      username: cleanUsername,
      city: selectedCity,
      country: selectedCountry
    });

    // Advance to Role Selection
    setStep('roles');
  };

  // ─── ROLE SELECTION (Step 3) ───

  const handleRoleContinue = () => {
    sounds.playTargetLock();
    setPersona(selectedRoleId);
    setStep('cam_perm');
  };

  const handleSkipRoles = () => {
    sounds.playTargetLock();
    setPersona('spotter');
    setStep('cam_perm');
  };

  // ─── PERMISSION HANDLERS ───

  const requestCamera = async () => {
    try {
      const result = await CapCamera.requestPermissions();
      if (result.camera === 'denied') { setCamDenied(true); return; }
    } catch (e) { console.log(e); }
    setStep('loc_perm');
  };

  const requestLocation = async (precise: boolean) => {
    if (precise) {
      try {
        const res = await requestRealLocationPermission();
        if (res.granted && res.city && res.city !== 'Local Area') {
          updateUserProfile({
            latitude: res.latitude,
            longitude: res.longitude,
            city: res.city,
            country: res.country
          });
        }
      } catch (e) { console.log(e); }
    }
    setStep('notif_perm');
  };

  const handleNotifications = async () => {
    try {
      if (Capacitor.isNativePlatform()) await PushNotifications.requestPermissions();
    } catch (e) { console.log(e); }
    setStep('celebration');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-[#080808] text-[#F0EBE3] overflow-hidden" style={{ fontFamily: "'Inter', 'DM Sans', sans-serif" }}>
      <AnimatePresence mode="wait">

        {/* ══════════════════════════════════════════════════════ */}
        {/* SCREEN 1 — LOGIN SCREEN (Exact match to User Screenshot) */}
        {/* ══════════════════════════════════════════════════════ */}
        {step === 'auth' && (
          <motion.div
            key="auth"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="relative flex flex-col justify-between h-full w-full max-w-md mx-auto px-6 py-10 overflow-y-auto scrollbar-hide"
          >
            {/* Background hypercar photograph */}
            <div className="absolute inset-0 z-0 overflow-hidden">
              <img
                src="/auth-bg.jpg"
                alt="Apex Hypercar Background"
                className="w-full h-full object-cover object-center filter brightness-45 scale-105"
              />
              <div
                className="absolute inset-0"
                style={{
                  background: 'linear-gradient(to bottom, rgba(8,8,8,0.2) 0%, rgba(8,8,8,0.6) 40%, rgba(8,8,8,0.95) 80%, #080808 100%)'
                }}
              />
            </div>

            {/* Top Brand Header & Title */}
            <div className="relative z-10 pt-8 space-y-2">
              <span className="text-[#FF4500] font-data text-xs tracking-[0.25em] uppercase font-bold block">
                APEX
              </span>

              <h1 className="font-serif italic text-[52px] text-white font-normal leading-[1.05] tracking-tight">
                Spot the best
              </h1>

              <p className="text-[#9A9088] text-[13.5px] leading-relaxed max-w-[270px] pt-1">
                Join the community tracking the world's most coveted rides.
              </p>
            </div>

            {/* Middle Form Fields */}
            <form onSubmit={handleEnterTheSpace} className="relative z-10 space-y-6 pt-6 pb-4">
              {/* EMAIL ADDRESS */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-data font-semibold text-[#9A9088] uppercase tracking-[0.2em] block">
                  EMAIL ADDRESS
                </label>
                <input
                  type="email"
                  required
                  value={emailInput}
                  onChange={e => setEmailInput(e.target.value)}
                  placeholder="hello@apex.app"
                  className="w-full bg-transparent border-b border-white/20 pb-2 text-[15px] text-white placeholder-white/25 focus:border-[#FF4500] outline-none font-sans transition-colors"
                />
              </div>

              {/* PASSWORD */}
              <div className="space-y-1.5 pt-1">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-data font-semibold text-[#9A9088] uppercase tracking-[0.2em] block">
                    PASSWORD
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      if (!emailInput) { setAuthError('Enter your email to receive an instant code'); return; }
                      supabase.auth.signInWithOtp({ email: emailInput });
                      setStep('email_otp');
                    }}
                    className="text-[11px] font-data text-[#FF4500] hover:underline"
                  >
                    Forgot?
                  </button>
                </div>
                <input
                  type="password"
                  value={passwordInput}
                  onChange={e => setPasswordInput(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full bg-transparent border-b border-white/20 pb-2 text-[15px] text-white placeholder-white/25 focus:border-[#FF4500] outline-none font-sans transition-colors"
                />
              </div>

              {authError && <p className="text-[#FF4500] text-xs font-data text-center pt-1">{authError}</p>}

              {/* ENTER THE SPACE BUTTON */}
              <motion.button
                type="submit"
                disabled={isAuthLoading}
                whileTap={{ scale: 0.97 }}
                className="w-full h-14 rounded-2xl bg-[#FF4500] text-white font-sans font-semibold text-[16px] shadow-[0_4px_24px_rgba(255,69,0,0.4)] hover:bg-[#FF5500] transition-all flex items-center justify-center gap-2 mt-2"
              >
                {isAuthLoading ? 'Entering...' : 'Enter the space'}
              </motion.button>

              {/* OR CONTINUE WITH DIVIDER */}
              <div className="relative flex items-center justify-center pt-2">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/10" /></div>
                <span className="relative bg-[#080808]/90 px-3 text-[10px] font-data font-semibold uppercase tracking-[0.22em] text-[#9A9088]">
                  OR CONTINUE WITH
                </span>
              </div>

              {/* APPLE & GOOGLE PILL BUTTONS */}
              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={handleAppleSignIn}
                  className="flex-1 h-12 rounded-full border border-white/15 bg-white/5 backdrop-blur-md flex items-center justify-center gap-2 text-white text-xs font-medium hover:border-white/30 transition-all active:scale-95"
                >
                  <AppleIcon className="w-4 h-4 fill-white" />
                  <span>Apple</span>
                </button>

                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  className="flex-1 h-12 rounded-full border border-white/15 bg-white/5 backdrop-blur-md flex items-center justify-center gap-2 text-white text-xs font-medium hover:border-white/30 transition-all active:scale-95"
                >
                  <GoogleIcon className="w-4 h-4" />
                  <span>Google</span>
                </button>
              </div>

              {/* FOOTER */}
              <div className="text-center pt-2 pb-2">
                <span className="text-[12px] text-[#9A9088]">New to Apex? </span>
                <button
                  type="button"
                  onClick={handleEnterTheSpace}
                  className="text-[12px] text-[#FF4500] font-medium hover:underline"
                >
                  Request invitation
                </button>
              </div>
            </form>
          </motion.div>
        )}

        {/* ══════════════════════════════════════════════════════ */}
        {/* EMAIL OTP CODE VERIFICATION                            */}
        {/* ══════════════════════════════════════════════════════ */}
        {step === 'email_otp' && (
          <motion.div
            key="email_otp"
            initial={{ x: 300, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -300, opacity: 0 }}
            className="flex flex-col h-full p-6 max-w-sm mx-auto w-full justify-between py-12"
          >
            <div>
              <button onClick={() => setStep('auth')} className="text-[#9A9088] mb-6">
                <ChevronLeft className="w-8 h-8" />
              </button>
              <span className="text-[#FF4500] font-data text-xs tracking-[0.25em] uppercase font-bold block mb-2">APEX</span>
              <h2 className="font-serif italic text-[42px] text-white leading-none">Enter Passcode</h2>
              <p className="text-[#9A9088] text-xs font-data mt-2">6-digit access code sent to {emailInput}</p>
              
              <div className="flex justify-between my-8">
                {otpCode.map((c, i) => (
                  <input
                    key={i}
                    ref={el => { otpRefs.current[i] = el; }}
                    type="number"
                    value={c}
                    onChange={e => handleOtpChange(i, e.target.value)}
                    className="w-12 h-14 bg-[#1A1A1A] border border-[#2C2C2C] rounded-xl text-center text-xl text-white outline-none focus:border-[#FF4500]"
                  />
                ))}
              </div>
              {authError && <p className="text-[#FF4500] text-sm text-center font-data">{authError}</p>}
            </div>

            <button
              type="button"
              onClick={() => setStep('profile_setup')}
              className="w-full h-14 rounded-2xl bg-[#FF4500] text-white font-semibold text-sm shadow-lg hover:bg-[#FF5500]"
            >
              Verify & Enter →
            </button>
          </motion.div>
        )}

        {/* ══════════════════════════════════════════════════════ */}
        {/* SCREEN 2 — PROFILE SETUP (Just after user logs in)     */}
        {/* ══════════════════════════════════════════════════════ */}
        {step === 'profile_setup' && (
          <motion.div
            key="profile_setup"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="flex flex-col justify-between h-full w-full max-w-md mx-auto px-6 py-10 overflow-y-auto scrollbar-hide"
          >
            <div className="pt-4 space-y-5">
              <span className="text-[#FF4500] font-data text-xs tracking-[0.25em] uppercase font-bold block">
                APEX IDENTITY
              </span>

              <div>
                <h1 className="font-serif italic text-[46px] text-white font-normal leading-[1.05] tracking-tight">
                  Your Identity
                </h1>
                <p className="text-[#9A9088] text-[13px] leading-relaxed mt-2">
                  Choose how fellow spotters recognize you on the global grid.
                </p>
              </div>

              {/* LIVE HUNTER BADGE PREVIEW */}
              <div className="p-4 rounded-2xl bg-[#111111] border border-[#FF4500]/40 shadow-2xl relative overflow-hidden mt-2">
                <div className="absolute top-0 right-0 w-24 h-24 bg-[#FF4500]/10 rounded-full blur-2xl pointer-events-none" />
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-12 h-12 rounded-full border-2 border-[#FF4500] overflow-hidden bg-[#1A1A1A] shrink-0">
                    <img src={user.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-display text-xl text-[#F0EBE3] tracking-wide">
                        {displayNameInput || 'Apex Hunter'}
                      </span>
                      <span className="text-[9px] font-data bg-[#FF4500]/20 text-[#FF4500] px-1.5 py-0.5 rounded border border-[#FF4500]/40">
                        LVL 1
                      </span>
                    </div>
                    <span className="text-xs font-data text-[#FF4500]">
                      @{usernameInput.replace(/^@+/, '') || 'hunter_01'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-[#2C2C2C] text-[11px] font-data text-[#9A9088]">
                  <div className="flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-[#FF4500]" />
                    <span>{selectedCity}, {selectedCountry}</span>
                  </div>
                  <span className="text-[#2ECC71] font-semibold">VERIFIED SPOTTER</span>
                </div>
              </div>

              {/* INPUT FIELDS */}
              <form onSubmit={handleProfileSetupSubmit} className="space-y-4 pt-2">
                <div>
                  <label className="text-[10px] font-data font-semibold text-[#9A9088] uppercase tracking-[0.2em] block mb-1.5">
                    DISPLAY NAME
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-[#9A9088] absolute left-4 top-4" />
                    <input
                      type="text"
                      required
                      value={displayNameInput}
                      onChange={e => setDisplayNameInput(e.target.value)}
                      placeholder="e.g. Alex Vance"
                      className="w-full h-12 bg-[#141414] border border-white/10 rounded-xl pl-11 pr-4 text-sm text-white focus:border-[#FF4500] outline-none font-sans"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-data font-semibold text-[#9A9088] uppercase tracking-[0.2em] block mb-1.5">
                    USERNAME (HANDLE)
                  </label>
                  <div className="relative">
                    <AtSign className="w-4 h-4 text-[#FF4500] absolute left-4 top-4" />
                    <input
                      type="text"
                      required
                      value={usernameInput}
                      onChange={e => setUsernameInput(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                      placeholder="e.g. tokyo_drifter"
                      className="w-full h-12 bg-[#141414] border border-white/10 rounded-xl pl-11 pr-4 text-sm text-white focus:border-[#FF4500] outline-none font-data"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-data font-semibold text-[#9A9088] uppercase tracking-[0.2em] block mb-1.5">
                    HOME RADAR CITY
                  </label>
                  <select
                    value={selectedCity}
                    onChange={(e) => {
                      const found = FAMOUS_CITIES.find(c => c.name === e.target.value);
                      if (found) {
                        setSelectedCity(found.name);
                        setSelectedCountry(found.country);
                      } else {
                        setSelectedCity(e.target.value);
                      }
                    }}
                    className="w-full h-12 bg-[#141414] border border-white/10 rounded-xl px-4 text-sm text-white focus:border-[#FF4500] outline-none font-sans cursor-pointer"
                  >
                    {FAMOUS_CITIES.map(city => (
                      <option key={city.name} value={city.name} className="bg-[#111111] text-white">
                        {city.name} ({city.country})
                      </option>
                    ))}
                  </select>
                </div>
              </form>
            </div>

            <div className="pt-6 pb-2">
              <motion.button
                onClick={handleProfileSetupSubmit}
                whileTap={{ scale: 0.97 }}
                className="w-full h-14 rounded-2xl bg-[#FF4500] text-white font-sans font-semibold text-[16px] shadow-[0_4px_24px_rgba(255,69,0,0.4)] hover:bg-[#FF5500] transition-all"
              >
                Continue →
              </motion.button>
            </div>
          </motion.div>
        )}

        {/* ══════════════════════════════════════════════════════ */}
        {/* SCREEN 3 — ROLE SELECTION (Exact match to Screenshot 2) */}
        {/* ══════════════════════════════════════════════════════ */}
        {step === 'roles' && (
          <motion.div
            key="roles"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col justify-between h-full w-full max-w-md mx-auto px-6 py-10 overflow-y-auto scrollbar-hide"
          >
            {/* Header */}
            <div className="pt-4 space-y-2">
              <span className="text-[#FF4500] font-data text-xs tracking-[0.25em] uppercase font-bold block">
                APEX
              </span>

              <h1 className="font-serif italic text-[48px] text-white font-normal leading-[1.05] tracking-tight">
                What drives you?
              </h1>

              <p className="text-[#9A9088] text-[13.5px] leading-relaxed">
                Select the profile that best describes your passion.
              </p>
            </div>

            {/* 3 ROLE CARDS STACKED VERTICALLY */}
            <div className="space-y-3.5 my-auto py-6">
              {ROLES.map((role) => {
                const isSelected = selectedRoleId === role.id;
                return (
                  <motion.div
                    key={role.id}
                    onClick={() => {
                      sounds.playTargetLock();
                      setSelectedRoleId(role.id);
                    }}
                    whileTap={{ scale: 0.98 }}
                    className={`relative rounded-2xl overflow-hidden p-5 cursor-pointer transition-all duration-300 border ${
                      isSelected
                        ? 'border-[#FF4500] shadow-[0_0_24px_rgba(255,69,0,0.25)]'
                        : 'border-white/10 hover:border-white/20'
                    }`}
                    style={{ minHeight: '110px' }}
                  >
                    {/* Background automotive image */}
                    <div className="absolute inset-0 z-0">
                      <img
                        src={role.bgImage}
                        alt={role.title}
                        className="w-full h-full object-cover filter brightness-35"
                      />
                      <div className="absolute inset-0 bg-gradient-to-r from-[#080808]/90 via-[#080808]/70 to-transparent" />
                    </div>

                    {/* Content */}
                    <div className="relative z-10 flex flex-col justify-center h-full space-y-1.5">
                      <div className="flex items-center gap-2">
                        <span className={`font-display text-2xl tracking-wider leading-none ${
                          isSelected ? 'text-[#FF4500]' : 'text-white'
                        }`}>
                          {role.title}
                        </span>
                        {isSelected && (
                          <motion.span
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            className="w-2 h-2 rounded-full bg-[#FF4500] shadow-[0_0_8px_#FF4500]"
                          />
                        )}
                      </div>
                      <p className="text-[12.5px] text-[#9A9088] leading-relaxed max-w-[290px] font-sans">
                        {role.desc}
                      </p>
                    </div>
                  </motion.div>
                );
              })}
            </div>

            {/* Bottom Controls: Continue Button + Skip Link */}
            <div className="space-y-3 pb-2">
              <motion.button
                onClick={handleRoleContinue}
                whileTap={{ scale: 0.97 }}
                className="w-full h-14 rounded-2xl bg-[#FF4500] text-white font-sans font-semibold text-[16px] shadow-[0_4px_24px_rgba(255,69,0,0.4)] hover:bg-[#FF5500] transition-all"
              >
                Continue
              </motion.button>

              <div className="text-center">
                <span className="text-[12.5px] text-[#9A9088]">Not sure? </span>
                <button
                  type="button"
                  onClick={handleSkipRoles}
                  className="text-[12.5px] text-white underline font-medium hover:text-[#FF4500] transition-colors"
                >
                  Skip for now
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {/* ══════════════════════════════════════════════════════ */}
        {/* SCREEN 4 — CAMERA PERMISSION                           */}
        {/* ══════════════════════════════════════════════════════ */}
        {step === 'cam_perm' && (
          <motion.div
            key="cam_perm"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            className="flex flex-col h-full items-center justify-center text-center p-6 max-w-md mx-auto w-full"
          >
            <ApertureIris />

            <div className="mt-10 mb-6">
              {['POINT.', 'SCAN.', 'COLLECT.'].map((word, i) => (
                <motion.span
                  key={word}
                  className="font-display text-[52px] text-[#F0EBE3] inline-block mr-3"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 + i * 0.3, duration: 0.25, ease: EASE_OUT_EXPO as any }}
                >
                  {word}
                </motion.span>
              ))}
            </div>

            <motion.p
              className="text-[15px] text-[#9A9088] max-w-[280px]"
              style={{ fontFamily: "'DM Sans', sans-serif" }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.5, duration: 0.6 }}
            >
              Apex needs your camera to photograph real cars in the wild.
            </motion.p>

            <div className="flex-1" />

            <div className="w-full space-y-2 mb-8">
              <motion.button
                onClick={requestCamera}
                whileTap={{ scale: 0.96 }}
                className="w-full h-14 bg-[#FF4500] text-white font-display text-xl tracking-wider rounded-2xl shadow-lg"
                style={{ boxShadow: GLOW_ORANGE }}
              >
                {camDenied ? 'OPEN SETTINGS' : 'ENABLE CAMERA'}
              </motion.button>
            </div>
          </motion.div>
        )}

        {/* ══════════════════════════════════════════════════════ */}
        {/* SCREEN 5 — LOCATION PERMISSION                         */}
        {/* ══════════════════════════════════════════════════════ */}
        {step === 'loc_perm' && (
          <motion.div
            key="loc_perm"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            className="flex flex-col h-full items-center justify-center text-center p-6 max-w-md mx-auto w-full"
          >
            <GpsCrosshair />

            <h2 className="font-display text-[46px] text-white leading-none mt-10 mb-4">
              WHERE YOU ARE<br />CHANGES EVERYTHING.
            </h2>
            <p className="text-[15px] text-[#9A9088] max-w-[280px]" style={{ fontFamily: "'DM Sans', sans-serif" }}>
              Local rarity is calculated from your city. A car common in Tokyo might be legendary where you are.
            </p>

            <div className="flex-1" />

            <div className="w-full space-y-3 mb-8">
              <motion.button
                onClick={() => requestLocation(true)}
                whileTap={{ scale: 0.96 }}
                className="w-full h-14 bg-[#FF4500] text-white font-display text-xl tracking-wider rounded-2xl"
                style={{ boxShadow: GLOW_ORANGE }}
              >
                ENABLE LOCATION
              </motion.button>
              <button
                onClick={() => requestLocation(false)}
                className="w-full text-[#9A9088] text-[14px] underline py-2"
              >
                Approximate location only →
              </button>
            </div>
          </motion.div>
        )}

        {/* ══════════════════════════════════════════════════════ */}
        {/* SCREEN 6 — NOTIFICATIONS                               */}
        {/* ══════════════════════════════════════════════════════ */}
        {step === 'notif_perm' && (
          <motion.div
            key="notif_perm"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            className="flex flex-col h-full items-center justify-center text-center p-6 max-w-md mx-auto w-full"
          >
            <NotificationBell />

            <h2 className="font-display text-[52px] text-white leading-none mt-10 mb-4">
              HUNTS HAPPEN FAST.
            </h2>
            <p className="text-[15px] text-[#9A9088] max-w-[280px]" style={{ fontFamily: "'DM Sans', sans-serif" }}>
              We alert you when a rare car appears nearby. Nothing else. Miss a hunt, miss the points.
            </p>

            <div className="flex-1" />

            <div className="w-full space-y-3 mb-8">
              <motion.button
                onClick={handleNotifications}
                whileTap={{ scale: 0.96 }}
                className="w-full h-14 bg-[#FF4500] text-white font-display text-xl tracking-wider rounded-2xl"
                style={{ boxShadow: GLOW_ORANGE }}
              >
                ENABLE NOTIFICATIONS
              </motion.button>
              <button
                onClick={() => setStep('celebration')}
                className="w-full text-[#9A9088] text-[14px] py-2"
              >
                I'll miss hunts (skip)
              </button>
            </div>
          </motion.div>
        )}

        {/* ══════════════════════════════════════════════════════ */}
        {/* SCREEN 7 — CELEBRATION & ENTRY                          */}
        {/* ══════════════════════════════════════════════════════ */}
        {step === 'celebration' && (
          <CelebrationScreen
            role={ROLES.find(r => r.id === selectedRoleId) || ROLES[0]}
            onEnter={() => { completeOnboarding(); onClose(); }}
          />
        )}

      </AnimatePresence>
    </div>
  );
};

// ─── CELEBRATION SCREEN ───

const CelebrationScreen: React.FC<{ role: RoleOption; onEnter: () => void }> = ({ role, onEnter }) => {
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
    <motion.div key="celebration" className="relative flex flex-col h-full items-center justify-center bg-[#080808]">
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
          className="font-display text-[80px] text-[#F0EBE3] tracking-widest leading-none"
          initial={{ y: -80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={SPRING_HEAVY}
        >
          WELCOME
        </motion.h1>
      )}

      {phase >= 3 && (
        <motion.h2
          className="font-display text-[48px] text-[#FF4500] tracking-wider leading-none mt-2"
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={SPRING_POP}
        >
          {role.title}.
        </motion.h2>
      )}

      {phase >= 4 && (
        <div className="flex items-center gap-3 mt-8">
          {[
            { icon: '⚡', label: 'LEVEL 1' },
            { icon: '🔥', label: '0 STREAK' },
            { icon: '🏆', label: 'UNRANKED' },
          ].map((chip, i) => (
            <motion.div
              key={chip.label}
              className="px-3 py-1.5 rounded-lg text-[13px] font-medium"
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
          className="absolute bottom-12 left-6 right-6 h-14 rounded-2xl font-display text-[22px] tracking-[2px] text-[#F0EBE3]"
          style={{ background: '#FF4500', boxShadow: GLOW_ORANGE }}
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={SPRING_SETTLE}
          whileTap={{ scale: 0.96 }}
        >
          ENTER APEX →
        </motion.button>
      )}
    </motion.div>
  );
};
