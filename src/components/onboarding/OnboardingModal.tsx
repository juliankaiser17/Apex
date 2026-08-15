import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, ChevronLeft, Target, Map, Flame } from 'lucide-react';
import { useApexStore } from '../../store/useApexStore';
import type { Persona } from '../../types/apex';
import { sounds } from '../../utils/audio';
import confetti from 'canvas-confetti';
import { requestRealLocationPermission } from '../../utils/geolocation';
import { Camera as CapCamera } from '@capacitor/camera';
import { supabase } from '../../lib/supabase';
import { Capacitor } from '@capacitor/core';
import { GoogleSignIn } from '@capawesome/capacitor-google-sign-in';
import { PushNotifications } from '@capacitor/push-notifications';

interface OnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type OnboardingStep = 'auth' | 'email_input' | 'email_otp' | 'roles' | 'cam_perm' | 'loc_perm' | 'notif_perm' | 'celebration';

const ROLES = [
  {
    id: 'spotter' as Persona,
    name: 'CAR SPOTTER 🎯',
    desc: 'I hunt rare cars everywhere I go. Every street is a target.',
    icon: Target
  },
  {
    id: 'finder' as Persona,
    name: 'CAR FINDER 🗺',
    desc: "I explore cities and discover what's hiding in plain sight.",
    icon: Map
  },
  {
    id: 'love_of_cars' as Persona,
    name: 'LOVE OF THE GAME 🔥',
    desc: "I'm here for the cars. Knowledge, beauty, obsession.",
    icon: Flame
  }
];

const CameraIllustration = () => (
  <svg width="200" height="200" viewBox="0 0 200 200" fill="none">
    <motion.path
      d="M40 80 L40 40 L80 40" stroke="#FF4500" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"
      initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1 }}
    />
    <motion.path
      d="M160 80 L160 40 L120 40" stroke="#FF4500" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"
      initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1 }}
    />
    <motion.path
      d="M40 120 L40 160 L80 160" stroke="#FF4500" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"
      initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1 }}
    />
    <motion.path
      d="M160 120 L160 160 L120 160" stroke="#FF4500" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"
      initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1 }}
    />
    <circle cx="100" cy="100" r="30" stroke="#F0EBE3" strokeWidth="2" opacity="0.3" />
    <motion.circle cx="100" cy="100" r="15" fill="#FF4500" animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }} transition={{ duration: 2, repeat: Infinity }} />
  </svg>
);

const CityMapIllustration = () => (
  <svg width="200" height="200" viewBox="0 0 200 200" fill="none">
    {/* Grid lines */}
    {[20, 60, 100, 140, 180].map(x => (
      <line key={`x-${x}`} x1={x} y1="0" x2={x} y2="200" stroke="#F0EBE3" strokeWidth="1" opacity="0.1" />
    ))}
    {[20, 60, 100, 140, 180].map(y => (
      <line key={`y-${y}`} x1="0" y1={y} x2="200" y2={y} stroke="#F0EBE3" strokeWidth="1" opacity="0.1" />
    ))}
    <motion.circle cx="100" cy="100" r="40" stroke="#FF4500" strokeWidth="2" strokeDasharray="4 4" opacity="0.5"
      animate={{ scale: [1, 1.5], opacity: [0.5, 0] }} transition={{ duration: 2, repeat: Infinity }} />
    <motion.circle cx="100" cy="100" r="8" fill="#FF4500" />
    <motion.path d="M100 100 L100 80 L115 80" stroke="#FF4500" strokeWidth="2" fill="none" opacity="0.8" />
  </svg>
);

const NotificationIllustration = () => (
  <svg width="200" height="200" viewBox="0 0 200 200" fill="none">
    <rect x="60" y="20" width="80" height="160" rx="12" stroke="#F0EBE3" strokeWidth="2" opacity="0.3" />
    <motion.rect x="50" y="60" width="100" height="40" rx="8" fill="#1A1A1A" stroke="#FF4500" strokeWidth="1"
      initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2, type: 'spring' }} />
    <motion.circle cx="70" cy="80" r="6" fill="#FF4500" initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.4 }} />
    <motion.line x1="85" y1="75" x2="130" y2="75" stroke="#F0EBE3" strokeWidth="4" strokeLinecap="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ delay: 0.5 }} />
    <motion.line x1="85" y1="85" x2="110" y2="85" stroke="#F0EBE3" strokeWidth="2" strokeLinecap="round" opacity="0.5" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ delay: 0.6 }} />
  </svg>
);

export const OnboardingModal: React.FC<OnboardingModalProps> = ({ isOpen, onClose }) => {
  const { setPersona, completeOnboarding } = useApexStore();
  const [step, setStep] = useState<OnboardingStep>('auth');
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');
  const [emailInput, setEmailInput] = useState('');
  const [otpCode, setOtpCode] = useState(['', '', '', '', '', '']);
  const [activeRoleIdx, setActiveRoleIdx] = useState<number | null>(null);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (isOpen) setStep('auth');
  }, [isOpen]);

  const handleGoogleSignIn = async () => {
    sounds.playTargetLock();
    setIsAuthLoading(true);
    setAuthError('');
    const CLIENT_ID = '708398928493-8qkjhla9p00kkjrse5f0l4d8spo9pj6c.apps.googleusercontent.com';
    try {
      if (Capacitor.isNativePlatform()) {
        // Native: use Capacitor plugin
        await GoogleSignIn.initialize({
          clientId: CLIENT_ID,
          scopes: ['profile', 'email'],
        });
        const result = await GoogleSignIn.signIn();
        if (result.idToken) {
          const { error } = await supabase.auth.signInWithIdToken({ provider: 'google', token: result.idToken });
          if (error) throw error;
        } else {
          throw new Error("No ID Token found");
        }
      } else {
        // Web: use Google Identity Services popup — NO redirects!
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

        // Create a promise that resolves when the GIS callback fires
        const idToken = await new Promise<string>((resolve, reject) => {
          window.google!.accounts.id.initialize({
            client_id: CLIENT_ID,
            callback: (response: { credential: string }) => {
              if (response.credential) {
                resolve(response.credential);
              } else {
                reject(new Error('No credential returned from Google'));
              }
            },
          });
          // Try One Tap first, fall back to button
          window.google!.accounts.id.prompt((notification: any) => {
            // If One Tap is dismissed/skipped, we let the user retry
            if (notification?.isNotDisplayed?.() || notification?.isSkippedMoment?.()) {
              reject(new Error('Google One Tap was dismissed. Please try again.'));
            }
          });
        });

        // Exchange the Google ID token for a Supabase session — no redirect!
        const { error } = await supabase.auth.signInWithIdToken({ provider: 'google', token: idToken });
        if (error) throw error;
      }
    } catch (err: any) {
      console.error(err);
      setAuthError(err?.message || 'Google Sign-In failed. Please try again.');
      setIsAuthLoading(false);
    }
  };

  const handleEmailSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailInput.includes('@')) return;
    sounds.playTargetLock();
    setIsAuthLoading(true);
    setAuthError('');
    const { error } = await supabase.auth.signInWithOtp({ email: emailInput, options: { shouldCreateUser: true } });
    if (error) {
      setAuthError(error.message);
      setIsAuthLoading(false);
    } else {
      setIsAuthLoading(false);
      setStep('email_otp');
    }
  };

  const handleOtpChange = async (idx: number, val: string) => {
    if (val.length > 1) return;
    const next = [...otpCode];
    next[idx] = val;
    setOtpCode(next);
    if (val && idx < 5) {
      otpRefs.current[idx + 1]?.focus();
    }
    if (next.every(c => c !== '')) {
      setIsAuthLoading(true);
      const code = next.join('');
      const { error } = await supabase.auth.verifyOtp({ email: emailInput, token: code, type: 'email' });
      if (error) {
        setAuthError(error.message);
        setIsAuthLoading(false);
      }
      // Success is handled by App.tsx listener, but we also want to advance the modal locally
    }
  };

  // When auth completes via any method, App.tsx's onAuthStateChange will trigger initializeSession.
  // Wait, if it triggers initializeSession and onboardingCompleted is false, we should advance to 'roles'.
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user && (step === 'auth' || step === 'email_otp')) {
        setStep('roles');
      }
    });
    return () => subscription.unsubscribe();
  }, [step]);

  const handleRoleContinue = () => {
    if (activeRoleIdx !== null) {
      setPersona(ROLES[activeRoleIdx].id);
      setStep('cam_perm');
    }
  };

  const requestCamera = async () => {
    try {
      await CapCamera.requestPermissions();
    } catch (e) { console.log(e); }
    setStep('loc_perm');
  };

  const requestLocation = async (precise: boolean) => {
    if (precise) {
      try { await requestRealLocationPermission(); } catch (e) { console.log(e); }
    }
    setStep('notif_perm');
  };

  const handleFinish = async () => {
    try {
      if (Capacitor.isNativePlatform()) {
        await PushNotifications.requestPermissions();
      }
    } catch (e) {
      console.log(e);
    }
    setStep('celebration');
  };

  const handleSkipFinish = () => {
    setStep('celebration');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-[#080808] text-[#F0EBE3]" style={{ fontFamily: 'Inter, sans-serif' }}>
      <AnimatePresence mode="wait">
        
        {/* SCREEN 1: AUTH */}
        {step === 'auth' && (
          <motion.div key="auth" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col h-full items-center p-6">
            <div className="flex-1 flex items-center justify-center">
              <h1 className="font-display text-[64px] tracking-widest text-white">APEX</h1>
            </div>
            
            <div className="w-full max-w-sm space-y-4 mb-8">
              <button onClick={handleGoogleSignIn} disabled={isAuthLoading} className="w-full h-12 bg-white text-black rounded-full flex items-center justify-center gap-3 font-medium text-[15px] hover:bg-gray-100 transition-colors">
                <img src="https://www.svgrepo.com/show/475656/google-color.svg" alt="Google" className="w-5 h-5" />
                Continue with Google
              </button>
              
              <button onClick={() => setStep('email_input')} disabled={isAuthLoading} className="w-full h-12 border border-[#2C2C2C] text-white rounded-full flex items-center justify-center gap-3 font-medium text-[15px] hover:bg-[#1A1A1A] transition-colors">
                <Mail className="w-5 h-5" />
                Continue with Email
              </button>
              
              <p className="text-center text-[#9A9088] text-[12px] mt-6">
                By continuing you agree to our <span className="underline cursor-pointer">Terms of Service</span> and <span className="underline cursor-pointer">Privacy Policy</span>
              </p>
            </div>
          </motion.div>
        )}

        {/* EMAIL INPUT */}
        {step === 'email_input' && (
          <motion.div key="email_input" initial={{ x: 300, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -300, opacity: 0 }} className="flex flex-col h-full p-6 max-w-sm mx-auto w-full">
            <button onClick={() => setStep('auth')} className="mt-8 text-[#9A9088]"><ChevronLeft className="w-8 h-8" /></button>
            <h2 className="font-display text-[32px] mt-8 mb-4">ENTER EMAIL</h2>
            <form onSubmit={handleEmailSend} className="space-y-4">
              <input type="email" autoFocus value={emailInput} onChange={e => setEmailInput(e.target.value)} placeholder="hunter@apex.com"
                className="w-full h-14 bg-[#1A1A1A] border border-[#2C2C2C] rounded-xl px-4 text-white focus:border-[#FF4500] outline-none" />
              <button type="submit" disabled={isAuthLoading} className="w-full h-14 bg-[#FF4500] text-white font-display text-xl tracking-wider rounded-xl hover:opacity-90">
                SEND CODE
              </button>
              {authError && <p className="text-[#FF4500] text-sm text-center">{authError}</p>}
            </form>
          </motion.div>
        )}

        {/* EMAIL OTP */}
        {step === 'email_otp' && (
          <motion.div key="email_otp" initial={{ x: 300, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -300, opacity: 0 }} className="flex flex-col h-full p-6 max-w-sm mx-auto w-full">
            <button onClick={() => setStep('email_input')} className="mt-8 text-[#9A9088]"><ChevronLeft className="w-8 h-8" /></button>
            <h2 className="font-display text-[32px] mt-8 mb-2">VERIFY EMAIL</h2>
            <p className="text-[#9A9088] text-sm mb-8">Code sent to {emailInput}</p>
            <div className="flex justify-between mb-8">
              {otpCode.map((c, i) => (
                <input key={i} ref={el => { otpRefs.current[i] = el; }} type="number" value={c} onChange={e => handleOtpChange(i, e.target.value)}
                  className="w-12 h-14 bg-[#1A1A1A] border border-[#2C2C2C] rounded-xl text-center text-xl text-white outline-none focus:border-[#FF4500]" />
              ))}
            </div>
            {authError && <p className="text-[#FF4500] text-sm text-center mb-4">{authError}</p>}
          </motion.div>
        )}

        {/* SCREEN 2: ROLE SELECTION */}
        {step === 'roles' && (
          <motion.div key="roles" initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }} className="flex flex-col h-full p-6 max-w-md mx-auto w-full pt-16">
            <h2 className="font-display text-[44px] text-center text-white mb-2 leading-none">WHY ARE YOU HERE?</h2>
            <p className="text-center text-[#9A9088] text-[14px] mb-8">This shapes your entire Apex experience.</p>
            <div className="space-y-3 flex-1">
              {ROLES.map((role, idx) => {
                const Icon = role.icon;
                const isSelected = activeRoleIdx === idx;
                return (
                  <motion.div key={role.id} onClick={() => setActiveRoleIdx(idx)}
                    animate={{ scale: isSelected ? 1.03 : 1 }}
                    className={`p-4 rounded-2xl flex items-center gap-4 cursor-pointer relative overflow-hidden transition-colors ${isSelected ? 'bg-[#1A1A1A]' : 'bg-[#0F0F0F] hover:bg-[#151515]'}`}
                    style={{ border: isSelected ? '1px solid rgba(255,69,0,0.5)' : '1px solid rgba(255,255,255,0.05)', boxShadow: isSelected ? '0 0 20px rgba(255,69,0,0.1)' : 'none' }}>
                    {isSelected && <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#FF4500]" />}
                    <div className="w-[60px] h-[60px] shrink-0 bg-black/40 rounded-xl flex items-center justify-center">
                      <Icon className={`w-8 h-8 ${isSelected ? 'text-[#FF4500]' : 'text-[#F0EBE3]'}`} />
                    </div>
                    <div>
                      <h3 className="font-display text-[20px] text-white tracking-wider">{role.name}</h3>
                      <p className="text-[13px] text-[#9A9088] leading-snug pr-2">{role.desc}</p>
                    </div>
                  </motion.div>
                );
              })}
            </div>
            <AnimatePresence>
              {activeRoleIdx !== null && (
                <motion.button initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 50, opacity: 0 }}
                  onClick={handleRoleContinue} className="w-full h-14 bg-[#FF4500] text-white font-display text-xl tracking-wider rounded-xl mb-8">
                  CONTINUE
                </motion.button>
              )}
            </AnimatePresence>
          </motion.div>
        )}

        {/* SCREEN 3: CAMERA PERMISSION */}
        {step === 'cam_perm' && (
          <motion.div key="cam_perm" initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }} className="flex flex-col h-full items-center text-center p-6 max-w-md mx-auto w-full pt-12">
            <div className="h-[40%] w-full flex items-center justify-center relative">
              <CameraIllustration />
            </div>
            <h2 className="font-display text-[36px] text-white leading-none mt-8 mb-4">POINT. SCAN. COLLECT.</h2>
            <p className="text-[#9A9088] text-[14px] max-w-[300px]">
              Apex needs camera access to photograph real cars and identify them using AI. Without this, the app cannot work.
            </p>
            <div className="flex-1" />
            <button onClick={requestCamera} className="w-full h-14 bg-[#FF4500] text-white font-display text-xl tracking-wider rounded-xl mb-8">
              ENABLE CAMERA
            </button>
          </motion.div>
        )}

        {/* SCREEN 4: LOCATION PERMISSION */}
        {step === 'loc_perm' && (
          <motion.div key="loc_perm" initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }} className="flex flex-col h-full items-center text-center p-6 max-w-md mx-auto w-full pt-12">
            <div className="h-[40%] w-full flex items-center justify-center relative">
              <CityMapIllustration />
            </div>
            <h2 className="font-display text-[36px] text-white leading-none mt-8 mb-4">YOUR CITY IS FULL OF RARE FINDS.</h2>
            <p className="text-[#9A9088] text-[14px] max-w-[300px]">
              Location lets Apex calculate how rare a car is in your specific area, show you active hunts nearby, and place your discoveries on the community map. Your exact location is never stored or shared.
            </p>
            <div className="flex-1" />
            <div className="w-full space-y-3 mb-6">
              <button onClick={() => requestLocation(true)} className="w-full h-14 bg-[#FF4500] text-white font-display text-xl tracking-wider rounded-xl">
                ENABLE PRECISE LOCATION
              </button>
              <button onClick={() => requestLocation(false)} className="w-full h-12 border border-[#2C2C2C] text-white font-display text-lg tracking-wider rounded-xl">
                USE APPROXIMATE LOCATION
              </button>
            </div>
            <p className="text-[#9A9088] text-[10px] mb-2 max-w-[280px]">
              Location data is blurred before storage. Hunt locations are delayed 15 minutes.
            </p>
          </motion.div>
        )}

        {/* SCREEN 5: NOTIFICATIONS */}
        {step === 'notif_perm' && (
          <motion.div key="notif_perm" initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }} className="flex flex-col h-full items-center text-center p-6 max-w-md mx-auto w-full pt-12">
            <div className="h-[40%] w-full flex items-center justify-center relative">
              <NotificationIllustration />
            </div>
            <h2 className="font-display text-[36px] text-white leading-none mt-8 mb-4">DON'T MISS A HUNT.</h2>
            <p className="text-[#9A9088] text-[14px] max-w-[300px]">
              Apex only notifies you when something rare appears nearby or a hunt goes live. No spam. No irrelevant alerts.
            </p>
            <div className="flex-1" />
            <div className="w-full space-y-3 mb-8">
              <button onClick={handleFinish} className="w-full h-14 bg-[#FF4500] text-white font-display text-xl tracking-wider rounded-xl">
                ENABLE NOTIFICATIONS
              </button>
              <button onClick={handleSkipFinish} className="w-full h-12 text-[#9A9088] font-medium text-[14px]">
                Maybe Later
              </button>
            </div>
          </motion.div>
        )}

        {/* CELEBRATION */}
        {step === 'celebration' && (
          <motion.div key="celebration" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col h-full items-center justify-center relative">
            <motion.div
              initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.2, type: 'spring', damping: 12 }}
              onAnimationComplete={() => {
                confetti({ particleCount: 50, spread: 100, origin: { y: 0.5 }, colors: ['#FF4500', '#FFA500', '#FFFFFF'], disableForReducedMotion: true });
                setTimeout(() => {
                  completeOnboarding();
                  onClose();
                }, 2500);
              }}
            >
              <h1 className="font-display text-[64px] text-white tracking-widest text-center">WELCOME TO<br/><span className="text-[#FF4500]">APEX</span></h1>
            </motion.div>
          </motion.div>
        )}

      </AnimatePresence>
    </div>
  );
};
