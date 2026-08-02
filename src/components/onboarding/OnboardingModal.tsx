import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, Bell, ChevronLeft, ChevronRight } from 'lucide-react';
import { useApexStore } from '../../store/useApexStore';
import type { Persona } from '../../types/apex';
import { sounds } from '../../utils/audio';
import { triggerGoogleSignIn } from '../../services/googleAuthService';
import confetti from 'canvas-confetti';

interface OnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type OnboardingStep = 'auth' | 'email_input' | 'email_otp' | 'roles' | 'cam_perm' | 'loc_perm' | 'notif_perm' | 'celebration';

/* Spring configs matching the spec */
const SPRING_HEAVY = { type: 'spring' as const, damping: 18, stiffness: 90, mass: 1.4 };
const SPRING_POP = { type: 'spring' as const, damping: 10, stiffness: 280, mass: 0.8 };

/* ═══ ROLE DATA ═══ */
const ROLES = [
  {
    id: 'spotter' as Persona,
    name: 'THE HUNTER',
    ctaText: "I'M A HUNTER",
    desc: "You see what others walk past.\nEvery lot. Every street. Every target.",
    image: '/role_hunter_bg.png',
  },
  {
    id: 'finder' as Persona,
    name: 'THE SPOTTER',
    ctaText: "I'M A SPOTTER",
    desc: "Cities have secrets. You find them.\nYour eyes, your map, your discovery.",
    image: '/role_spotter_bg.png',
  },
  {
    id: 'love_of_cars' as Persona,
    name: 'FOR THE LOVE',
    ctaText: "I'M IN FOR THE LOVE",
    desc: "The cars are enough. Always have been.\nYou know. You feel it.",
    image: '/role_love_bg.png',
  },
];

/* ═══ SVG APERTURE ICON ═══ */
const ApertureIcon: React.FC<{ animate?: boolean; size?: number }> = ({ animate: shouldAnimate = false, size = 72 }) => {
  const bladeCount = 8;
  const blades = Array.from({ length: bladeCount });
  return (
    <svg width={size} height={size} viewBox="0 0 72 72" fill="none">
      {blades.map((_, i) => {
        const angle = (360 / bladeCount) * i;
        const delay = shouldAnimate ? i * 0.06 : 0;
        return (
          <motion.path
            key={i}
            d={`M36 12 L42 24 L36 28 L30 24 Z`}
            fill="none"
            stroke="#F0EBE3"
            strokeWidth="1.5"
            initial={shouldAnimate ? { rotate: angle, scale: 0.3, opacity: 0.3 } : { rotate: angle, scale: 1, opacity: 1 }}
            animate={{ rotate: angle + 45, scale: 1, opacity: 1 }}
            transition={{ duration: 1, delay, ease: 'easeInOut' }}
            style={{ transformOrigin: '36px 36px' }}
          />
        );
      })}
      {/* Center glow */}
      <motion.circle
        cx="36" cy="36" r="6"
        fill="none"
        stroke="#FF4500"
        strokeWidth="1"
        initial={{ opacity: 0 }}
        animate={{ opacity: shouldAnimate ? 0.5 : 0.5 }}
        transition={{ delay: 0.8, duration: 0.5 }}
      />
    </svg>
  );
};

/* ═══ GPS CROSSHAIR ICON ═══ */
const GpsCrosshair: React.FC<{ size?: number }> = ({ size = 72 }) => (
  <svg width={size} height={size} viewBox="0 0 72 72" fill="none">
    <circle cx="36" cy="36" r="24" stroke="#F0EBE3" strokeWidth="1.5" opacity="0.6" />
    <circle cx="36" cy="36" r="12" stroke="#F0EBE3" strokeWidth="1" opacity="0.4" />
    {/* Crosshair lines */}
    <line x1="36" y1="4" x2="36" y2="16" stroke="#F0EBE3" strokeWidth="1.5" opacity="0.5" />
    <line x1="36" y1="56" x2="36" y2="68" stroke="#F0EBE3" strokeWidth="1.5" opacity="0.5" />
    <line x1="4" y1="36" x2="16" y2="36" stroke="#F0EBE3" strokeWidth="1.5" opacity="0.5" />
    <line x1="56" y1="36" x2="68" y2="36" stroke="#F0EBE3" strokeWidth="1.5" opacity="0.5" />
    {/* Center pulsing dot */}
    <motion.circle
      cx="36" cy="36" r="4"
      fill="#FF4500"
      animate={{ scale: [1, 2.5, 1], opacity: [1, 0, 1] }}
      transition={{ duration: 1.8, repeat: Infinity, ease: 'easeOut' }}
      style={{ transformOrigin: '36px 36px' }}
    />
  </svg>
);

/* ═══ MAIN ONBOARDING ═══ */
export const OnboardingModal: React.FC<OnboardingModalProps> = ({ isOpen, onClose }) => {
  const { setPersona, setGoogleUser, completeOnboarding } = useApexStore();
  const [step, setStep] = useState<OnboardingStep>('auth');
  const [emailInput, setEmailInput] = useState('');
  const [otpCode, setOtpCode] = useState(['', '', '', '', '', '']);
  const [activeRoleIdx, setActiveRoleIdx] = useState(0);
  const [resendCountdown, setResendCountdown] = useState(0);
  const [celebStage, setCelebStage] = useState(0);
  const [wordmarkVisible, setWordmarkVisible] = useState(false);
  const [taglineVisible, setTaglineVisible] = useState(false);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Wordmark entrance timing
  useEffect(() => {
    if (step !== 'auth') return;
    const t1 = setTimeout(() => setWordmarkVisible(true), 200);
    const t2 = setTimeout(() => setTaglineVisible(true), 900);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [step]);

  // Resend countdown
  useEffect(() => {
    if (resendCountdown <= 0) return;
    const t = setInterval(() => setResendCountdown(p => Math.max(0, p - 1)), 1000);
    return () => clearInterval(t);
  }, [resendCountdown]);

  // Celebration timeline
  useEffect(() => {
    if (step !== 'celebration') return;
    const timers = [
      setTimeout(() => setCelebStage(1), 200),   // Orange flash
      setTimeout(() => setCelebStage(2), 660),    // WELCOME drops
      setTimeout(() => setCelebStage(3), 760),    // Role name pops
      setTimeout(() => {
        setCelebStage(4);                          // Stat chips
        confetti({ particleCount: 60, spread: 80, origin: { y: 0.45 }, colors: ['#F0EBE3', '#FF4500', '#FFA500'] });
      }, 1200),
      setTimeout(() => setCelebStage(5), 2000),   // CTA
      setTimeout(() => { completeOnboarding(); onClose(); }, 4000),
    ];
    return () => timers.forEach(clearTimeout);
  }, [step, completeOnboarding, onClose]);

  const handleGoogleAuth = () => {
    sounds.playTargetLock();
    triggerGoogleSignIn((userData) => {
      setGoogleUser(userData);
      setStep('roles');
    });
  };

  const handleEmailSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailInput.includes('@')) return;
    sounds.playTargetLock();
    setResendCountdown(45);
    setStep('email_otp');
  };

  const handleOtpChange = useCallback((idx: number, val: string) => {
    if (val.length > 1) return;
    const next = [...otpCode];
    next[idx] = val;
    setOtpCode(next);
    if (val && idx < 5) otpRefs.current[idx + 1]?.focus();
    if (val && idx === 5 && next.every(d => d)) {
      sounds.playTargetLock();
      setTimeout(() => setStep('roles'), 300);
    }
  }, [otpCode]);

  const handleOtpKeyDown = useCallback((idx: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otpCode[idx] && idx > 0) otpRefs.current[idx - 1]?.focus();
  }, [otpCode]);

  const handleFinish = () => {
    sounds.playXpPop();
    setPersona(ROLES[activeRoleIdx].id);
    setStep('celebration');
  };

  // Role carousel swipe
  const swipeRole = (dir: number) => {
    setActiveRoleIdx(prev => Math.max(0, Math.min(ROLES.length - 1, prev + dir)));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col overflow-hidden select-none" style={{ background: '#080808' }}>
      <AnimatePresence mode="wait">

        {/* ═══ SCREEN 1: THE OPENING (AUTH) ═══ */}
        {step === 'auth' && (
          <motion.div key="auth" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="flex-1 flex flex-col relative">
            {/* Hero photo */}
            <div className="absolute inset-0">
              <img src="/hero_auth.png" alt="" className="w-full h-full object-cover" />
              {/* Bottom gradient merge */}
              <div className="absolute bottom-0 left-0 right-0 h-[45%]"
                style={{ background: 'linear-gradient(to top, #080808, #08080800)' }} />
            </div>

            {/* Content overlay */}
            <div className="relative z-10 flex-1 flex flex-col justify-between max-w-md mx-auto w-full px-6">
              {/* Wordmark — 42% from top */}
              <div className="flex-1 flex flex-col items-center justify-center" style={{ paddingTop: '28vh' }}>
                <motion.h1
                  initial={{ opacity: 0, y: -40 }}
                  animate={wordmarkVisible ? { opacity: 1, y: 0 } : {}}
                  transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
                  className="font-display text-[88px] leading-none tracking-[8px]"
                  style={{ color: '#F0EBE3', textShadow: '0 2px 20px rgba(255,69,0,0.15)' }}
                >
                  APEX
                </motion.h1>
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={taglineVisible ? { opacity: 0.6 } : {}}
                  transition={{ duration: 0.4 }}
                  className="text-sm tracking-[2px] mt-3"
                  style={{ fontFamily: 'DM Sans', color: '#F0EBE3' }}
                >
                  Every street. Every find. Every win.
                </motion.p>
              </div>

              {/* Auth buttons — bottom */}
              <div className="pb-8 space-y-3">
                <motion.button
                  onClick={handleGoogleAuth}
                  whileTap={{ scale: 0.97 }}
                  transition={{ duration: 0.08 }}
                  className="w-full h-14 rounded-xl flex items-center justify-center gap-3 text-[15px] font-medium"
                  style={{ background: '#F0EBE3', color: '#1A1A1A', fontFamily: 'DM Sans', fontWeight: 600 }}
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                  </svg>
                  Continue with Google
                </motion.button>

                <motion.button
                  onClick={() => setStep('email_input')}
                  whileTap={{ scale: 0.97 }}
                  className="w-full h-14 rounded-xl flex items-center justify-center gap-3 text-[15px]"
                  style={{ background: 'transparent', border: '1.5px solid #2C2C2C', fontFamily: 'DM Sans', fontWeight: 500 }}
                >
                  <Mail className="w-5 h-5" style={{ color: '#F0EBE3', opacity: 0.7 }} />
                  <span style={{ color: '#F0EBE3', opacity: 0.8 }}>Continue with Email</span>
                </motion.button>

                <p className="text-center text-[11px] pt-2" style={{ color: '#9A9088', fontFamily: 'DM Sans' }}>
                  By continuing, you agree to our{' '}
                  <span style={{ color: '#FF4500' }}>Terms</span> and{' '}
                  <span style={{ color: '#FF4500' }}>Privacy Policy</span>
                </p>
              </div>
            </div>
          </motion.div>
        )}

        {/* ═══ SCREEN 2a: EMAIL ENTRY ═══ */}
        {step === 'email_input' && (
          <motion.div key="email_input" initial={{ opacity: 0, x: 60 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -60 }}
            transition={{ duration: 0.3 }}
            className="flex-1 flex flex-col justify-center px-6 max-w-md mx-auto w-full">
            <button onClick={() => setStep('auth')} className="absolute top-6 left-6 z-20 flex items-center gap-1 text-sm" style={{ color: '#9A9088' }}>
              <ChevronLeft className="w-4 h-4" /> Back
            </button>
            <h2 className="font-display text-[36px] leading-none" style={{ color: '#F0EBE3' }}>ENTER YOUR EMAIL</h2>
            <p className="text-sm mt-2 mb-6" style={{ color: '#9A9088', fontFamily: 'DM Sans' }}>
              We'll send a 6-digit code. No passwords.
            </p>
            <form onSubmit={handleEmailSend} className="space-y-4">
              <input type="email" required autoFocus placeholder="racer@apex.app" value={emailInput}
                onChange={e => setEmailInput(e.target.value)}
                className="w-full h-14 px-5 rounded-xl text-base outline-none"
                style={{ background: '#1A1A1A', border: '1px solid #2C2C2C', color: '#F0EBE3', fontFamily: 'DM Sans',
                  boxShadow: 'inset 0 2px 8px rgba(0,0,0,0.4)' }} />
              <motion.button type="submit" whileTap={{ scale: 0.97 }}
                className="w-full h-14 rounded-xl font-display text-xl tracking-wider"
                style={{ background: '#FF4500', color: '#F0EBE3' }}>
                SEND CODE
              </motion.button>
            </form>
          </motion.div>
        )}

        {/* ═══ SCREEN 2b: OTP ═══ */}
        {step === 'email_otp' && (
          <motion.div key="email_otp" initial={{ opacity: 0, x: 60 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -60 }}
            transition={{ duration: 0.3 }}
            className="flex-1 flex flex-col justify-center px-6 max-w-md mx-auto w-full">
            <button onClick={() => setStep('email_input')} className="absolute top-6 left-6 z-20 flex items-center gap-1 text-sm" style={{ color: '#9A9088' }}>
              <ChevronLeft className="w-4 h-4" /> Back
            </button>
            <h2 className="font-display text-[32px] leading-none" style={{ color: '#F0EBE3' }}>VERIFY CODE</h2>
            <p className="text-sm mt-2 mb-6" style={{ color: '#9A9088', fontFamily: 'DM Sans' }}>
              Sent to <span style={{ color: '#F0EBE3', fontFamily: 'DM Sans', fontWeight: 500 }}>{emailInput}</span>
            </p>
            <div className="flex gap-3 justify-center mb-6">
              {otpCode.map((d, i) => (
                <input key={i} ref={el => { otpRefs.current[i] = el; }} type="text" inputMode="numeric" maxLength={1}
                  value={d} onChange={e => handleOtpChange(i, e.target.value.replace(/\D/, ''))}
                  onKeyDown={e => handleOtpKeyDown(i, e)}
                  className="w-12 h-14 rounded-xl text-center font-display text-2xl outline-none transition-all"
                  style={{ background: '#1A1A1A', color: '#F0EBE3',
                    border: d ? '2px solid #FF4500' : '1px solid #2C2C2C',
                    boxShadow: d ? '0 0 12px rgba(255,69,0,0.2)' : 'inset 0 2px 6px rgba(0,0,0,0.5)' }} />
              ))}
            </div>
            <div className="text-center">
              {resendCountdown > 0 ? (
                <p className="text-xs" style={{ color: '#5A5550', fontFamily: 'DM Sans' }}>
                  Resend in <span style={{ color: '#FF4500' }}>{resendCountdown}s</span>
                </p>
              ) : (
                <button onClick={() => { setResendCountdown(45); sounds.playTargetLock(); }}
                  className="text-sm font-medium" style={{ color: '#FF4500' }}>Resend Code</button>
              )}
            </div>
          </motion.div>
        )}

        {/* ═══ SCREEN 3: ROLE SELECTION CAROUSEL ═══ */}
        {step === 'roles' && (
          <motion.div key="roles" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="flex-1 flex flex-col relative overflow-hidden">
            {/* Top label */}
            <div className="absolute top-6 left-0 right-0 z-20 text-center">
              <p className="text-[11px] tracking-[3px] font-medium" style={{ color: 'rgba(240,235,227,0.5)', fontFamily: 'DM Sans' }}>
                CHOOSE YOUR ROLE
              </p>
            </div>

            {/* Carousel */}
            <div className="flex-1 relative">
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeRoleIdx}
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  transition={{ duration: 0.4 }}
                  className="absolute inset-0"
                >
                  {/* Full-bleed photo */}
                  <img src={ROLES[activeRoleIdx].image} alt="" className="w-full h-full object-cover" />
                  {/* Bottom gradient */}
                  <div className="absolute bottom-0 left-0 right-0 h-[55%]"
                    style={{ background: 'linear-gradient(to top, #080808, #08080800)' }} />

                  {/* Role info — 62% from top */}
                  <div className="absolute left-0 right-0 px-7" style={{ top: '58%' }}>
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-[3px] h-12 rounded-full" style={{ background: '#FF4500' }} />
                      <h2 className="font-display text-[56px] leading-none tracking-[4px]"
                        style={{ color: '#F0EBE3' }}>
                        {ROLES[activeRoleIdx].name}
                      </h2>
                    </div>
                    <p className="text-[15px] leading-relaxed whitespace-pre-line pl-[15px]"
                      style={{ color: 'rgba(240,235,227,0.75)', fontFamily: 'DM Sans' }}>
                      {ROLES[activeRoleIdx].desc}
                    </p>
                  </div>
                </motion.div>
              </AnimatePresence>

              {/* Swipe arrows */}
              {activeRoleIdx > 0 && (
                <button onClick={() => swipeRole(-1)} className="absolute left-3 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full flex items-center justify-center"
                  style={{ background: 'rgba(8,8,8,0.6)' }}>
                  <ChevronLeft className="w-5 h-5" style={{ color: '#F0EBE3' }} />
                </button>
              )}
              {activeRoleIdx < ROLES.length - 1 && (
                <button onClick={() => swipeRole(1)} className="absolute right-3 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full flex items-center justify-center"
                  style={{ background: 'rgba(8,8,8,0.6)' }}>
                  <ChevronRight className="w-5 h-5" style={{ color: '#F0EBE3' }} />
                </button>
              )}
            </div>

            {/* Bottom overlay: dots + CTA */}
            <div className="absolute bottom-0 left-0 right-0 z-20 px-6 pb-8">
              {/* Dot indicator */}
              <div className="flex justify-center gap-2 mb-5">
                {ROLES.map((_, i) => (
                  <motion.div key={i}
                    animate={{ width: i === activeRoleIdx ? 24 : 8, background: i === activeRoleIdx ? '#F0EBE3' : '#2C2C2C' }}
                    transition={{ duration: 0.2 }}
                    className="h-2 rounded-full cursor-pointer"
                    onClick={() => setActiveRoleIdx(i)} />
                ))}
              </div>
              {/* CTA */}
              <motion.button
                onClick={() => { sounds.playTargetLock(); setStep('cam_perm'); }}
                whileTap={{ scale: 0.97 }}
                className="w-full h-14 rounded-xl font-display text-[22px] tracking-wider relative overflow-hidden glow-orange"
                style={{ background: '#FF4500', color: '#F0EBE3' }}>
                {ROLES[activeRoleIdx].ctaText}
              </motion.button>
            </div>
          </motion.div>
        )}

        {/* ═══ SCREEN 4: CAMERA PERMISSION ═══ */}
        {step === 'cam_perm' && (
          <motion.div key="cam_perm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="flex-1 flex flex-col items-center justify-center px-6 max-w-md mx-auto w-full">
            <ApertureIcon animate size={72} />
            <div className="text-center mt-10 space-y-1">
              {['POINT.', 'SCAN.', 'COLLECT.'].map((word, i) => (
                <motion.span key={word}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 + i * 0.3, duration: 0.25 }}
                  className="block font-display text-[52px] leading-none"
                  style={{ color: '#F0EBE3' }}>
                  {word}
                </motion.span>
              ))}
            </div>
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.5, duration: 0.5 }}
              className="text-center text-[15px] leading-relaxed mt-6 max-w-[280px]"
              style={{ color: '#9A9088', fontFamily: 'DM Sans' }}>
              Apex needs your camera to photograph real cars.
              Your photos stay on your device unless you post them.
            </motion.p>
            <div className="absolute bottom-8 left-6 right-6 max-w-md mx-auto">
              <motion.button initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.8 }}
                onClick={() => { sounds.playTargetLock(); setStep('loc_perm'); }}
                whileTap={{ scale: 0.97 }}
                className="w-full h-14 rounded-xl font-display text-xl tracking-wider glow-orange"
                style={{ background: '#FF4500', color: '#F0EBE3' }}>
                ENABLE CAMERA
              </motion.button>
            </div>
          </motion.div>
        )}

        {/* ═══ SCREEN 5: LOCATION PERMISSION ═══ */}
        {step === 'loc_perm' && (
          <motion.div key="loc_perm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="flex-1 flex flex-col items-center justify-center px-6 max-w-md mx-auto w-full">
            <GpsCrosshair size={72} />
            <div className="text-center mt-10">
              <h2 className="font-display text-[46px] leading-none" style={{ color: '#F0EBE3' }}>
                WHERE YOU ARE
              </h2>
              <h2 className="font-display text-[46px] leading-none" style={{ color: '#F0EBE3' }}>
                CHANGES EVERYTHING.
              </h2>
            </div>
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4, duration: 0.5 }}
              className="text-center text-[15px] leading-relaxed mt-6 max-w-[280px]"
              style={{ color: '#9A9088', fontFamily: 'DM Sans' }}>
              Local rarity is calculated from your city.
              A car that's everywhere in Tokyo might be legendary where you are.
            </motion.p>
            <div className="absolute bottom-8 left-6 right-6 max-w-md mx-auto space-y-3">
              <motion.button initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}
                onClick={() => { sounds.playTargetLock(); setStep('notif_perm'); }}
                whileTap={{ scale: 0.97 }}
                className="w-full h-14 rounded-xl font-display text-xl tracking-wider glow-orange"
                style={{ background: '#FF4500', color: '#F0EBE3' }}>
                ENABLE LOCATION
              </motion.button>
              <button onClick={() => { sounds.playTargetLock(); setStep('notif_perm'); }}
                className="w-full text-center text-sm underline" style={{ color: '#9A9088', fontFamily: 'DM Sans' }}>
                Approximate location only →
              </button>
            </div>
          </motion.div>
        )}

        {/* ═══ SCREEN 6: NOTIFICATIONS PERMISSION ═══ */}
        {step === 'notif_perm' && (
          <motion.div key="notif_perm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="flex-1 flex flex-col items-center justify-center px-6 max-w-md mx-auto w-full">
            <motion.div animate={{ rotate: [0, 12, 0, -12, 0] }} transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}>
              <Bell className="w-[72px] h-[72px]" style={{ color: '#F0EBE3' }} />
              <motion.div className="absolute -top-1 -right-1 w-3 h-3 rounded-full" style={{ background: '#FF4500' }}
                animate={{ scale: [1, 1.4, 1] }} transition={{ duration: 1.2, repeat: Infinity }} />
            </motion.div>
            <h2 className="font-display text-[52px] leading-none mt-10 text-center" style={{ color: '#F0EBE3' }}>
              HUNTS HAPPEN FAST.
            </h2>
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4, duration: 0.5 }}
              className="text-center text-[15px] leading-relaxed mt-6 max-w-[280px]"
              style={{ color: '#9A9088', fontFamily: 'DM Sans' }}>
              We alert you when a rare car appears nearby.
              Nothing else. Miss a hunt, miss the points.
            </motion.p>
            <div className="absolute bottom-8 left-6 right-6 max-w-md mx-auto space-y-3">
              <motion.button initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}
                onClick={handleFinish} whileTap={{ scale: 0.97 }}
                className="w-full h-14 rounded-xl font-display text-xl tracking-wider glow-orange"
                style={{ background: '#FF4500', color: '#F0EBE3' }}>
                ENABLE NOTIFICATIONS
              </motion.button>
              <button onClick={handleFinish}
                className="w-full text-center text-sm" style={{ color: '#5A5550', fontFamily: 'DM Sans' }}>
                I'll miss hunts (skip)
              </button>
            </div>
          </motion.div>
        )}

        {/* ═══ SCREEN 7: CELEBRATION ═══ */}
        {step === 'celebration' && (
          <motion.div key="celebration" initial={{ opacity: 1 }} className="flex-1 flex flex-col items-center justify-center relative overflow-hidden">
            {/* Orange flash burst */}
            {celebStage >= 1 && celebStage < 2 && (
              <motion.div className="absolute inset-0 z-10"
                initial={{ scale: 0, borderRadius: '50%' }}
                animate={{ scale: [0, 30, 0], opacity: [1, 1, 0] }}
                transition={{ duration: 0.66, times: [0, 0.27, 1] }}
                style={{ background: '#FF4500', transformOrigin: 'center' }} />
            )}

            {/* WELCOME */}
            {celebStage >= 2 && (
              <motion.h1 initial={{ y: -80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={SPRING_HEAVY}
                className="font-display text-[80px] leading-none" style={{ color: '#F0EBE3' }}>
                WELCOME
              </motion.h1>
            )}

            {/* Role name */}
            {celebStage >= 3 && (
              <motion.h2 initial={{ scale: 0 }} animate={{ scale: [0, 1.15, 1] }} transition={SPRING_POP}
                className="font-display text-[48px] leading-none mt-2" style={{ color: '#FF4500' }}>
                {ROLES[activeRoleIdx].name.replace('THE ', '')}.
              </motion.h2>
            )}

            {/* Stat chips */}
            {celebStage >= 4 && (
              <div className="flex gap-3 mt-8">
                {[
                  { icon: '⚡', text: 'LEVEL 1' },
                  { icon: '🔥', text: '0 STREAK' },
                  { icon: '🏆', text: 'UNRANKED' },
                ].map((chip, i) => (
                  <motion.div key={chip.text}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.12 }}
                    className="px-3 py-1.5 rounded-lg text-[13px] font-medium"
                    style={{ background: '#1A1A1A', color: '#F0EBE3', fontFamily: 'DM Sans' }}>
                    {chip.icon} {chip.text}
                  </motion.div>
                ))}
              </div>
            )}

            {/* CTA */}
            {celebStage >= 5 && (
              <motion.button
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                onClick={() => { completeOnboarding(); onClose(); }}
                whileTap={{ scale: 0.97 }}
                className="mt-12 px-12 h-14 rounded-xl font-display text-xl tracking-wider relative overflow-hidden glow-orange"
                style={{ background: '#FF4500', color: '#F0EBE3' }}>
                ENTER APEX →
                <motion.div className="absolute inset-0"
                  style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.15), transparent)' }}
                  animate={{ x: ['-100%', '200%'] }}
                  transition={{ duration: 1.5, repeat: 2, ease: 'easeInOut' }} />
              </motion.button>
            )}
          </motion.div>
        )}

      </AnimatePresence>
    </div>
  );
};
