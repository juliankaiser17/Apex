import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, ChevronLeft } from 'lucide-react';
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

interface OnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type OnboardingStep = 'auth' | 'email_input' | 'email_otp' | 'roles' | 'cam_perm' | 'loc_perm' | 'notif_perm' | 'celebration';

const ROLES: { id: Persona; title: string; ctaLabel: string; desc: string }[] = [
  {
    id: 'spotter',
    title: 'THE HUNTER',
    ctaLabel: "I'M A HUNTER",
    desc: "You see what others walk past.\nEvery lot. Every street. Every target.",
  },
  {
    id: 'finder',
    title: 'THE SPOTTER',
    ctaLabel: "I'M A SPOTTER",
    desc: "Cities have secrets. You find them.\nYour eyes, your map, your discovery.",
  },
  {
    id: 'love_of_cars',
    title: 'FOR THE LOVE',
    ctaLabel: "I'M IN FOR THE LOVE",
    desc: "The cars are enough. Always have been.\nYou know. You feel it.",
  },
];

// ─── SVG ILLUSTRATIONS ───

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
    <circle cx="36" cy="36" r="28" stroke="#F0EBE3" strokeWidth="1.5" opacity="0.3" />
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
    {/* Bell body */}
    <path d="M36 8 C24 8, 14 20, 14 32 L14 44 L10 50 L62 50 L58 44 L58 32 C58 20, 48 8, 36 8Z" fill="#F0EBE3" opacity="0.85" />
    {/* Bell clapper */}
    <circle cx="36" cy="56" r="5" fill="#F0EBE3" opacity="0.85" />
    {/* Orange notification dot */}
    <motion.circle
      cx="52" cy="14" r="6" fill="#FF4500"
      animate={{ scale: [1, 1.3, 1], opacity: [1, 0.7, 1] }}
      transition={{ duration: 1.5, repeat: Infinity }}
    />
  </motion.svg>
);

// ─── MAIN COMPONENT ───

export const OnboardingModal: React.FC<OnboardingModalProps> = ({ isOpen, onClose }) => {
  const { setPersona, completeOnboarding } = useApexStore();
  const [step, setStep] = useState<OnboardingStep>('auth');
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');
  const [emailInput, setEmailInput] = useState('');
  const [otpCode, setOtpCode] = useState(['', '', '', '', '', '']);
  const [activeRoleIdx, setActiveRoleIdx] = useState(1); // Middle page pre-selected
  const [camDenied, setCamDenied] = useState(false);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);
  const carouselRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) setStep('auth');
  }, [isOpen]);

  // ─── AUTH HANDLERS ───

  const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '708398928493-8qkjhla9p00kkjrse5f0l4d8spo9pj6c.apps.googleusercontent.com';

  const handleGoogleSignIn = async () => {
    sounds.playTargetLock();
    setIsAuthLoading(true);
    setAuthError('');
    try {
      if (Capacitor.isNativePlatform()) {
        await GoogleSignIn.initialize({ clientId: CLIENT_ID, scopes: ['profile', 'email'] });
        const result = await GoogleSignIn.signIn();
        if (result.idToken) {
          const { error } = await supabase.auth.signInWithIdToken({ provider: 'google', token: result.idToken });
          if (error) throw error;
        } else {
          throw new Error('No ID Token found');
        }
      } else {
        // Web: Google Identity Services popup — zero redirects
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
        const { error } = await supabase.auth.signInWithIdToken({ provider: 'google', token: idToken });
        if (error) throw error;
      }
    } catch (err: any) {
      console.error(err);
      setAuthError(err?.message || 'Google Sign-In failed.');
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
    if (error) { setAuthError(error.message); setIsAuthLoading(false); }
    else { setIsAuthLoading(false); setStep('email_otp'); }
  };

  const handleOtpChange = async (idx: number, val: string) => {
    if (val.length > 1) return;
    const next = [...otpCode];
    next[idx] = val;
    setOtpCode(next);
    if (val && idx < 5) otpRefs.current[idx + 1]?.focus();
    if (next.every(c => c !== '')) {
      setIsAuthLoading(true);
      const { error } = await supabase.auth.verifyOtp({ email: emailInput, token: next.join(''), type: 'email' });
      if (error) { setAuthError(error.message); setIsAuthLoading(false); }
    }
  };

  // Advance to roles when auth completes
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user && (step === 'auth' || step === 'email_otp')) {
        setStep('roles');
      }
    });
    return () => subscription.unsubscribe();
  }, [step]);

  // ─── PERMISSION HANDLERS ───

  const handleRoleContinue = () => {
    setPersona(ROLES[activeRoleIdx].id);
    setStep('cam_perm');
  };

  const requestCamera = async () => {
    try {
      const result = await CapCamera.requestPermissions();
      if (result.camera === 'denied') { setCamDenied(true); return; }
    } catch (e) { console.log(e); }
    setStep('loc_perm');
  };

  const requestLocation = async (precise: boolean) => {
    if (precise) {
      try { await requestRealLocationPermission(); } catch (e) { console.log(e); }
    }
    setStep('notif_perm');
  };

  const handleNotifications = async () => {
    try {
      if (Capacitor.isNativePlatform()) await PushNotifications.requestPermissions();
    } catch (e) { console.log(e); }
    setStep('celebration');
  };

  // ─── CAROUSEL SCROLL HANDLER ───

  const handleCarouselScroll = () => {
    if (!carouselRef.current) return;
    const el = carouselRef.current;
    const page = Math.round(el.scrollLeft / el.clientWidth);
    setActiveRoleIdx(Math.min(Math.max(page, 0), 2));
  };

  useEffect(() => {
    if (step === 'roles' && carouselRef.current) {
      // Scroll to middle page (pre-selected)
      carouselRef.current.scrollTo({ left: carouselRef.current.clientWidth, behavior: 'instant' as ScrollBehavior });
    }
  }, [step]);

  if (!isOpen) return null;

  // ─── RENDER ───

  return (
    <div className="fixed inset-0 z-[100] bg-[#080808] text-[#F0EBE3] overflow-hidden" style={{ fontFamily: "'Inter', 'DM Sans', sans-serif" }}>
      <AnimatePresence mode="wait">

        {/* ═══════════════════════════════════════ */}
        {/* SCREEN 1 — THE OPENING (Auth)           */}
        {/* ═══════════════════════════════════════ */}
        {step === 'auth' && (
          <motion.div key="auth" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="relative flex flex-col h-full w-full">
            {/* Layer 1: Full-bleed photograph */}
            <div className="absolute inset-0">
              <img src="/auth-bg.jpg" alt="" className="w-full h-full object-cover" />
            </div>
            {/* Layer 2: Gradient bottom merge */}
            <div className="absolute inset-0" style={{ background: 'linear-gradient(to bottom, transparent 55%, #080808 88%)' }} />

            {/* Layer 3: APEX wordmark */}
            <div className="relative z-10 flex-1 flex flex-col items-center justify-center" style={{ paddingTop: '30%' }}>
              <motion.h1
                className="font-display text-[88px] tracking-[8px] text-[#F0EBE3] leading-none"
                initial={{ opacity: 0, y: -40 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, ease: EASE_OUT_EXPO as any }}
                style={{ textShadow: '0 2px 20px rgba(255,69,0,0.16)' }}
              >
                APEX
              </motion.h1>

              {/* Layer 4: Tagline */}
              <motion.p
                className="mt-3 text-[14px] tracking-[2px] text-[#F0EBE3]/60"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1.2, duration: 0.4 }}
                style={{ fontFamily: "'DM Sans', sans-serif" }}
              >
                Every street. Every find. Every win.
              </motion.p>
            </div>

            {/* Layer 5: Auth buttons */}
            <div className="relative z-10 px-6 pb-8 space-y-3">
              {/* Google button */}
              <motion.button
                onClick={handleGoogleSignIn}
                disabled={isAuthLoading}
                whileTap={{ scale: 0.97 }}
                className="w-full h-14 rounded-xl flex items-center justify-center gap-3 transition-colors"
                style={{ background: '#F0EBE3', fontFamily: "'DM Sans', sans-serif" }}
              >
                <img src="https://www.svgrepo.com/show/475656/google-color.svg" alt="Google" className="w-5 h-5" />
                <span className="text-[#1A1A1A] font-semibold text-[15px]">Continue with Google</span>
              </motion.button>

              {/* Email button */}
              <motion.button
                onClick={() => setStep('email_input')}
                disabled={isAuthLoading}
                whileTap={{ scale: 0.97 }}
                className="w-full h-14 rounded-xl flex items-center justify-center gap-3 transition-colors"
                style={{ background: 'transparent', border: '1.5px solid #2C2C2C', fontFamily: "'DM Sans', sans-serif" }}
              >
                <Mail className="w-5 h-5 text-[#F0EBE3]/70" />
                <span className="text-[#F0EBE3]/80 font-medium text-[15px]">Continue with Email</span>
              </motion.button>

              {/* Error */}
              {authError && <p className="text-[#FF4500] text-sm text-center">{authError}</p>}

              {/* Legal text */}
              <p className="text-center text-[11px] mt-4" style={{ color: '#9A9088', fontFamily: "'DM Sans', sans-serif" }}>
                By continuing, you agree to our{' '}
                <span className="text-[#FF4500] cursor-pointer">Terms</span> and{' '}
                <span className="text-[#FF4500] cursor-pointer">Privacy Policy</span>
              </p>
            </div>
          </motion.div>
        )}

        {/* ═══════════════════════════════════════ */}
        {/* EMAIL INPUT                             */}
        {/* ═══════════════════════════════════════ */}
        {step === 'email_input' && (
          <motion.div key="email_input" initial={{ x: 300, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -300, opacity: 0 }}
            className="flex flex-col h-full p-6 max-w-sm mx-auto w-full">
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

        {/* ═══════════════════════════════════════ */}
        {/* EMAIL OTP                               */}
        {/* ═══════════════════════════════════════ */}
        {step === 'email_otp' && (
          <motion.div key="email_otp" initial={{ x: 300, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -300, opacity: 0 }}
            className="flex flex-col h-full p-6 max-w-sm mx-auto w-full">
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

        {/* ═══════════════════════════════════════ */}
        {/* SCREEN 2 — ROLE SELECTION (Carousel)    */}
        {/* ═══════════════════════════════════════ */}
        {step === 'roles' && (
          <motion.div key="roles" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="relative h-full w-full">
            {/* Horizontal paged carousel */}
            <div
              ref={carouselRef}
              onScroll={handleCarouselScroll}
              className="h-full w-full flex overflow-x-auto snap-x snap-mandatory scrollbar-hide"
              style={{ scrollbarWidth: 'none', msOverflowStyle: 'none', WebkitOverflowScrolling: 'touch' }}
            >
              {ROLES.map((role, idx) => (
                <div key={role.id} className="h-full min-w-full w-full snap-center relative flex-shrink-0">
                  {/* Background gradient instead of photo — ambient color per role */}
                  <div className="absolute inset-0" style={{
                    background: idx === 0
                      ? 'radial-gradient(ellipse at 50% 40%, rgba(255,69,0,0.08) 0%, #080808 70%)'
                      : idx === 1
                        ? 'radial-gradient(ellipse at 50% 40%, rgba(255,106,0,0.08) 0%, #080808 70%)'
                        : 'radial-gradient(ellipse at 50% 40%, rgba(255,165,0,0.06) 0%, #080808 70%)'
                  }} />

                  {/* Role content */}
                  <div className="absolute bottom-[200px] left-7 right-7 z-10">
                    <div className="flex items-center gap-3 mb-2">
                      {activeRoleIdx === idx && (
                        <motion.div
                          className="w-[3px] h-12 bg-[#FF4500] rounded-full"
                          initial={{ x: -30, opacity: 0 }}
                          animate={{ x: 0, opacity: 1 }}
                          transition={{ duration: 0.3 }}
                        />
                      )}
                      <h2 className="font-display text-[72px] text-[#F0EBE3] leading-none tracking-[4px]">
                        {role.title}
                      </h2>
                    </div>
                    <p className="text-[16px] text-[#F0EBE3]/75 leading-relaxed whitespace-pre-line ml-[15px]" style={{ fontFamily: "'DM Sans', sans-serif" }}>
                      {role.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* Fixed overlay: label + dots + CTA */}
            <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-between z-20">
              {/* Top label */}
              <p className="mt-12 text-[11px] tracking-[3px] font-medium text-[#F0EBE3]/50" style={{ fontFamily: "'DM Sans', sans-serif" }}>
                CHOOSE YOUR ROLE
              </p>

              <div className="w-full px-6 pb-8 pointer-events-auto space-y-4">
                {/* Dot indicator */}
                <div className="flex items-center justify-center gap-2 mb-4">
                  {ROLES.map((_, idx) => (
                    <motion.div
                      key={idx}
                      className="h-2 rounded-full"
                      animate={{
                        width: activeRoleIdx === idx ? 24 : 8,
                        backgroundColor: activeRoleIdx === idx ? '#F0EBE3' : '#2C2C2C',
                      }}
                      transition={{ duration: 0.2 }}
                    />
                  ))}
                </div>

                {/* Continue CTA */}
                <motion.button
                  onClick={handleRoleContinue}
                  whileTap={{ scale: 0.96 }}
                  className="w-full h-14 rounded-xl text-[#F0EBE3] font-display text-[22px] tracking-[2px]"
                  style={{ background: '#FF4500', boxShadow: GLOW_ORANGE }}
                >
                  {ROLES[activeRoleIdx].ctaLabel}
                </motion.button>
              </div>
            </div>
          </motion.div>
        )}

        {/* ═══════════════════════════════════════ */}
        {/* SCREEN 3 — CAMERA PERMISSION            */}
        {/* ═══════════════════════════════════════ */}
        {step === 'cam_perm' && (
          <motion.div key="cam_perm" initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }}
            className="flex flex-col h-full items-center justify-center text-center p-6 max-w-md mx-auto w-full">
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
              Apex needs your camera to photograph real cars. Your photos stay on your device unless you post them.
            </motion.p>

            <div className="flex-1" />

            <div className="w-full space-y-2 mb-8">
              <motion.button
                onClick={requestCamera}
                whileTap={{ scale: 0.96 }}
                className="w-full h-14 bg-[#FF4500] text-white font-display text-xl tracking-wider rounded-xl"
                style={{ boxShadow: GLOW_ORANGE }}
              >
                {camDenied ? 'OPEN SETTINGS' : 'ENABLE CAMERA'}
              </motion.button>
              {camDenied && (
                <p className="text-[12px] text-[#9A9088] text-center" style={{ fontFamily: "'DM Sans', sans-serif" }}>
                  Camera is required to use Apex.
                </p>
              )}
            </div>
          </motion.div>
        )}

        {/* ═══════════════════════════════════════ */}
        {/* SCREEN 4 — LOCATION PERMISSION          */}
        {/* ═══════════════════════════════════════ */}
        {step === 'loc_perm' && (
          <motion.div key="loc_perm" initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }}
            className="flex flex-col h-full items-center justify-center text-center p-6 max-w-md mx-auto w-full">
            <GpsCrosshair />

            <h2 className="font-display text-[46px] text-white leading-none mt-10 mb-4">
              WHERE YOU ARE<br />CHANGES EVERYTHING.
            </h2>
            <p className="text-[15px] text-[#9A9088] max-w-[280px]" style={{ fontFamily: "'DM Sans', sans-serif" }}>
              Local rarity is calculated from your city. A car that's everywhere in Tokyo might be legendary where you are.
            </p>

            <div className="flex-1" />

            <div className="w-full space-y-3 mb-8">
              <motion.button
                onClick={() => requestLocation(true)}
                whileTap={{ scale: 0.96 }}
                className="w-full h-14 bg-[#FF4500] text-white font-display text-xl tracking-wider rounded-xl"
                style={{ boxShadow: GLOW_ORANGE }}
              >
                ENABLE LOCATION
              </motion.button>
              <button
                onClick={() => requestLocation(false)}
                className="w-full text-[#9A9088] text-[14px] underline py-2"
                style={{ fontFamily: "'DM Sans', sans-serif" }}
              >
                Approximate location only →
              </button>
            </div>
          </motion.div>
        )}

        {/* ═══════════════════════════════════════ */}
        {/* SCREEN 5 — NOTIFICATIONS                */}
        {/* ═══════════════════════════════════════ */}
        {step === 'notif_perm' && (
          <motion.div key="notif_perm" initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }}
            className="flex flex-col h-full items-center justify-center text-center p-6 max-w-md mx-auto w-full">
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
                className="w-full h-14 bg-[#FF4500] text-white font-display text-xl tracking-wider rounded-xl"
                style={{ boxShadow: GLOW_ORANGE }}
              >
                ENABLE NOTIFICATIONS
              </motion.button>
              <button
                onClick={() => setStep('celebration')}
                className="w-full text-[#9A9088] text-[14px] py-2"
                style={{ fontFamily: "'DM Sans', sans-serif" }}
              >
                I'll miss hunts (skip)
              </button>
            </div>
          </motion.div>
        )}

        {/* ═══════════════════════════════════════ */}
        {/* SCREEN 6 — CELEBRATION                  */}
        {/* ═══════════════════════════════════════ */}
        {step === 'celebration' && (
          <CelebrationScreen
            role={ROLES[activeRoleIdx]}
            onEnter={() => { completeOnboarding(); onClose(); }}
          />
        )}

      </AnimatePresence>
    </div>
  );
};

// ─── CELEBRATION SCREEN (Separate for clean state management) ───

const CelebrationScreen: React.FC<{ role: typeof ROLES[number]; onEnter: () => void }> = ({ role, onEnter }) => {
  const [phase, setPhase] = useState(0); // 0=black, 1=flash, 2=welcome, 3=role, 4=chips, 5=cta

  useEffect(() => {
    const t1 = setTimeout(() => setPhase(1), 200);    // Orange flash
    const t2 = setTimeout(() => setPhase(2), 660);    // Welcome drops
    const t3 = setTimeout(() => setPhase(3), 760);    // Role pops
    const t4 = setTimeout(() => {                      // Particles + confetti
      setPhase(4);
      confetti({
        particleCount: 40,
        spread: 180,
        origin: { y: 0.5, x: 0.5 },
        colors: ['#FF4500', '#FFA500', '#F0EBE3'],
        disableForReducedMotion: true,
      });
    }, 900);
    const t5 = setTimeout(() => setPhase(5), 2000);   // CTA
    const t6 = setTimeout(() => onEnter(), 5200);     // Auto-advance

    return () => { [t1, t2, t3, t4, t5, t6].forEach(clearTimeout); };
  }, []);

  return (
    <motion.div key="celebration" className="relative flex flex-col h-full items-center justify-center bg-[#080808]">
      {/* Orange flash overlay */}
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

      {/* WELCOME text */}
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

      {/* Role name */}
      {phase >= 3 && (
        <motion.h2
          className="font-display text-[48px] text-[#FF4500] tracking-wider leading-none mt-2"
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={SPRING_POP}
        >
          {role.title.replace('THE ', '').replace('FOR ', '')}.
        </motion.h2>
      )}

      {/* Stat chips */}
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

      {/* ENTER APEX CTA */}
      {phase >= 5 && (
        <motion.button
          onClick={onEnter}
          className="absolute bottom-12 left-6 right-6 h-14 rounded-xl font-display text-[22px] tracking-[2px] text-[#F0EBE3]"
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
