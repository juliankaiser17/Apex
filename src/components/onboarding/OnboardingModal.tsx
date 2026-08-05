import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, Bell, ChevronLeft } from 'lucide-react';
import { useApexStore } from '../../store/useApexStore';
import type { Persona } from '../../types/apex';
import { sounds } from '../../utils/audio';
import { triggerGoogleSignIn } from '../../services/googleAuthService';
import confetti from 'canvas-confetti';
import { requestRealLocationPermission } from '../../utils/geolocation';

interface OnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type OnboardingStep = 'auth' | 'email_input' | 'email_otp' | 'profile_setup' | 'roles' | 'cam_perm' | 'loc_perm' | 'notif_perm' | 'celebration';

/* Spring configs matching the spec */
const SPRING_HEAVY = { type: 'spring' as const, damping: 18, stiffness: 90, mass: 1.4 };
const SPRING_POP = { type: 'spring' as const, damping: 10, stiffness: 280, mass: 0.8 };

/* ═══ ROLE DATA ═══ */
const ROLES = [
  {
    id: 'spotter' as Persona,
    name: 'THE COLLECTOR',
    ctaText: "I'M A COLLECTOR",
    desc: "You see what others walk past.\nEvery lot. Every street.\nEvery car is a target.",
    gradient: 'radial-gradient(ellipse at top left, rgba(255,69,0,0.15) 0%, rgba(8,8,8,1) 70%)',
  },
  {
    id: 'finder' as Persona,
    name: 'THE SPOTTER',
    ctaText: "I'M A SPOTTER",
    desc: "Cities hide things in plain sight.\nYou're the one who finds them.\nDiscovery is your discipline.",
    gradient: 'radial-gradient(ellipse at top right, rgba(0,120,255,0.1) 0%, rgba(8,8,8,1) 70%)',
  },
  {
    id: 'love_of_cars' as Persona,
    name: 'FOR THE LOVE',
    ctaText: "I'M IN FOR THE LOVE",
    desc: "You don't need a reason.\nThe machines are enough.\nYou know. You feel it.",
    gradient: 'radial-gradient(ellipse at bottom, rgba(255,180,0,0.12) 0%, rgba(8,8,8,1) 80%)',
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
  const [setupDisplayName, setSetupDisplayName] = useState('');
  const [setupUsername, setSetupUsername] = useState('');
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Reset step to auth whenever modal opens (e.g., on logout)
  useEffect(() => {
    if (isOpen) {
      setStep('auth');
      setCelebStage(0);
    }
  }, [isOpen]);

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
    setCelebStage(0);
    const timers = [
      setTimeout(() => setCelebStage(1), 200),    // Spark expands
      setTimeout(() => setCelebStage(2), 380),    // Spark contracts
      setTimeout(() => setCelebStage(3), 660),    // WELCOME drops
      setTimeout(() => setCelebStage(4), 760),    // Role title appears
      setTimeout(() => {
        setCelebStage(5);                         // Particles burst
        confetti({ particleCount: 20, spread: 120, origin: { y: 0.45 }, colors: ['#FF4500'], disableForReducedMotion: true });
      }, 900),
      setTimeout(() => setCelebStage(6), 1400),   // Stat chips
      setTimeout(() => setCelebStage(7), 2000),   // CTA button
      setTimeout(() => {
        completeOnboarding();
        onClose();
        setStep('auth');
        setCelebStage(0);
      }, 3400),
    ];
    return () => timers.forEach(clearTimeout);
  }, [step]);

  const handleGoogleAuth = () => {
    sounds.playTargetLock();
    triggerGoogleSignIn((userData) => {
      setGoogleUser(userData);
      setSetupDisplayName(userData.name || '');
      setSetupUsername((userData.email || '').split('@')[0]);
      setStep('profile_setup');
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
      setSetupDisplayName('Apex Hunter');
      setSetupUsername('hunter_' + Math.floor(Math.random() * 9999));
      setTimeout(() => setStep('profile_setup'), 300);
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


  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col overflow-hidden select-none" style={{ background: '#080808' }}>
      <AnimatePresence mode="wait">

        {/* ═══ SCREEN 1: THE OPENING (AUTH) ═══ */}
        {step === 'auth' && (
          <motion.div key="auth" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="flex-1 flex flex-col relative">
            {/* Ambient Animated Background */}
            <div className="absolute inset-0 bg-[#080808] overflow-hidden flex items-center justify-center">
              {/* Core glow */}
              <motion.div
                animate={{ rotate: [0, 360], scale: [1, 1.2, 1] }}
                transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
                className="absolute w-[150vw] h-[150vw] md:w-[800px] md:h-[800px]"
                style={{
                  background: 'radial-gradient(circle, rgba(255,69,0,0.15) 0%, rgba(255,69,0,0) 60%)',
                  filter: 'blur(60px)'
                }}
              />
              {/* Secondary sweeping light */}
              <motion.div
                animate={{ rotate: [360, 0], scale: [1, 1.3, 1] }}
                transition={{ duration: 25, repeat: Infinity, ease: 'linear' }}
                className="absolute w-[120vw] h-[120vw] md:w-[600px] md:h-[600px] opacity-70"
                style={{
                  background: 'conic-gradient(from 90deg, transparent 0%, rgba(255,69,0,0.1) 25%, transparent 50%, rgba(255,69,0,0.05) 75%, transparent 100%)',
                  filter: 'blur(40px)'
                }}
              />
              {/* Heavy Vignette for dramatic contrast */}
              <div className="absolute inset-0" style={{ background: 'radial-gradient(circle, transparent 30%, #080808 100%)' }} />
              
              {/* Noise overlay for texture */}
              <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=%220 0 200 200%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22noiseFilter%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.65%22 numOctaves=%223%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23noiseFilter)%22/%3E%3C/svg%3E")' }} />
            </div>

            {/* Content overlay */}
            <div className="relative z-10 flex-1 flex flex-col justify-end max-w-md mx-auto w-full px-6">
              {/* Wordmark — Center 30% */}
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <motion.h1
                  initial={{ opacity: 0, y: -60 }}
                  animate={wordmarkVisible ? { opacity: 1, y: 0 } : {}}
                  transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                  className="font-display text-[84px] leading-none tracking-[10px]"
                  style={{ color: '#F0EBE3' }}
                >
                  APEX
                </motion.h1>
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={taglineVisible ? { opacity: 0.55 } : {}}
                  transition={{ duration: 0.5, ease: 'easeIn' }}
                  className="text-[14px] tracking-[2px] mt-2"
                  style={{ fontFamily: 'DM Sans', color: '#F0EBE3' }}
                >
                  Every street. Every find.
                </motion.p>
              </div>

              {/* Auth buttons — bottom */}
              <div className="pb-8 space-y-[12px]">
                <motion.button
                  onClick={handleGoogleAuth}
                  whileTap={{ scale: 0.97 }}
                  transition={{ duration: 0.08 }}
                  className="w-full h-[56px] rounded-[12px] flex items-center justify-center gap-[12px] text-[15px] font-semibold"
                  style={{ background: '#F0EBE3', color: '#1A1A1A', fontFamily: 'DM Sans' }}
                >
                  <svg className="w-[20px] h-[20px]" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                  </svg>
                  Sign in with Google
                </motion.button>

                <motion.button
                  onClick={() => setStep('email_input')}
                  whileTap={{ scale: 0.97 }}
                  className="w-full h-[56px] rounded-[12px] flex items-center justify-center gap-[12px] text-[15px]"
                  style={{ background: 'transparent', border: '1.5px solid #2C2C2C', fontFamily: 'DM Sans', fontWeight: 500 }}
                >
                  <Mail className="w-[20px] h-[20px]" style={{ color: '#F0EBE3', opacity: 0.6 }} />
                  <span style={{ color: '#F0EBE3', opacity: 0.75 }}>Continue with Email</span>
                </motion.button>

                <div className="pt-[8px]">
                  <p className="text-center text-[11px]" style={{ color: '#5A5550', fontFamily: 'DM Sans' }}>
                    By continuing you agree to our{' '}
                    <span style={{ color: '#FF4500' }}>Terms</span> &amp;{' '}
                    <span style={{ color: '#FF4500' }}>Privacy Policy</span>
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* ═══ SCREEN 2a: EMAIL ENTRY ═══ */}
        {step === 'email_input' && (
          <motion.div key="email_input" initial={{ opacity: 0, x: 60 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -60 }}
            transition={{ duration: 0.3 }}
            className="flex-1 flex flex-col justify-center items-center px-[20px] w-full relative">
            <button onClick={() => setStep('auth')} className="absolute top-6 left-6 z-20 flex items-center gap-1 text-sm" style={{ color: '#9A9088' }}>
              <ChevronLeft className="w-4 h-4" /> Back
            </button>
            
            <div className="w-full max-w-md p-[28px] rounded-[16px] text-center"
                 style={{ background: '#111111', border: '1px solid #2C2C2C' }}>
              <h2 className="font-display text-[32px] leading-none text-center" style={{ color: '#F0EBE3' }}>ENTER YOUR EMAIL</h2>
              
              <div className="h-[16px]" />
              
              <form onSubmit={handleEmailSend} className="space-y-[20px]">
                <input type="email" required autoFocus placeholder="you@example.com" value={emailInput}
                  onChange={e => setEmailInput(e.target.value)}
                  className="w-full h-[52px] px-[16px] rounded-[8px] text-[16px] outline-none"
                  style={{ background: '#1A1A1A', border: '1.5px solid #2C2C2C', color: '#F0EBE3', fontFamily: 'DM Sans' }} />
                
                <motion.button type="submit" whileTap={{ scale: 0.97 }}
                  className="w-full h-[52px] rounded-[8px] font-display text-[20px] tracking-[2px]"
                  style={{ background: '#FF4500', color: '#F0EBE3',
                           opacity: emailInput ? 1 : 0.35,
                           boxShadow: emailInput ? '0 4px 20px rgba(255,69,0,0.3)' : 'none' }}>
                  SEND CODE
                </motion.button>
              </form>
            </div>
          </motion.div>
        )}

        {/* ═══ SCREEN 2b: OTP ═══ */}
        {step === 'email_otp' && (
          <motion.div key="email_otp" initial={{ opacity: 0, x: 60 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -60 }}
            transition={{ duration: 0.3 }}
            className="flex-1 flex flex-col justify-center items-center px-[20px] w-full relative">
            <button onClick={() => setStep('email_input')} className="absolute top-6 left-6 z-20 flex items-center gap-1 text-sm" style={{ color: '#9A9088' }}>
              <ChevronLeft className="w-4 h-4" /> Back
            </button>
            
            <div className="w-full max-w-md p-[28px] rounded-[16px] text-center"
                 style={{ background: '#111111', border: '1px solid #2C2C2C' }}>
              <h2 className="font-display text-[32px] leading-none" style={{ color: '#F0EBE3' }}>CHECK YOUR EMAIL</h2>
              
              <p className="text-[13px] mt-[8px]" style={{ color: '#9A9088', fontFamily: 'DM Sans' }}>
                Sent to <span style={{ color: '#F0EBE3', fontFamily: 'DM Sans', fontWeight: 500 }}>{emailInput}</span>
              </p>
              
              <div className="h-[24px]" />
              
              <div className="flex gap-[8px] justify-center">
                {otpCode.map((d, i) => (
                  <input key={i} ref={el => { otpRefs.current[i] = el; }} type="text" inputMode="numeric" maxLength={1}
                    value={d} onChange={e => handleOtpChange(i, e.target.value.replace(/\D/, ''))}
                    onKeyDown={e => handleOtpKeyDown(i, e)}
                    className="w-[44px] h-[56px] rounded-[8px] text-center font-display text-[28px] outline-none transition-all"
                    style={{ background: '#1A1A1A', color: '#F0EBE3',
                      border: d ? '1.5px solid #FF4500' : '1.5px solid #2C2C2C' }} />
                ))}
              </div>
              
              <div className="h-[16px]" />
              
              <div className="text-center">
                {resendCountdown > 0 ? (
                  <p className="text-[13px]" style={{ color: '#9A9088', fontFamily: 'DM Sans' }}>
                    Resend in 0:{resendCountdown.toString().padStart(2, '0')}
                  </p>
                ) : (
                  <button onClick={() => { setResendCountdown(45); sounds.playTargetLock(); }}
                    className="text-[13px]" style={{ color: '#FF4500', fontFamily: 'DM Sans' }}>Resend code</button>
                )}
              </div>
            </div>
          </motion.div>
        )}

        {/* ═══ SCREEN 2.5: PROFILE SETUP ═══ */}
        {step === 'profile_setup' && (
          <motion.div key="profile_setup" initial={{ opacity: 0, x: 60 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -60 }}
            transition={{ duration: 0.3 }}
            className="flex-1 flex flex-col justify-center px-6 max-w-md mx-auto w-full">
            <h2 className="font-display text-[36px] leading-none mb-6" style={{ color: '#F0EBE3' }}>YOUR IDENTITY</h2>
            
            <form onSubmit={(e) => {
              e.preventDefault();
              if (setupDisplayName && setupUsername) {
                sounds.playTargetLock();
                useApexStore.getState().updateUserProfile({
                  displayName: setupDisplayName,
                  username: setupUsername.toLowerCase().replace(/[^a-z0-9_]/g, '')
                });
                setStep('roles');
              }
            }} className="space-y-6">
              <div>
                <label className="text-[11px] tracking-[2px] mb-2 block" style={{ color: '#9A9088', fontFamily: 'DM Sans' }}>DISPLAY NAME</label>
                <input type="text" required placeholder="John Doe" value={setupDisplayName}
                  onChange={e => setSetupDisplayName(e.target.value)}
                  className="w-full h-14 px-5 rounded-xl text-base outline-none"
                  style={{ background: '#1A1A1A', border: '1px solid #2C2C2C', color: '#F0EBE3', fontFamily: 'DM Sans' }} />
              </div>

              <div>
                <label className="text-[11px] tracking-[2px] mb-2 block" style={{ color: '#9A9088', fontFamily: 'DM Sans' }}>USERNAME</label>
                <div className="relative">
                  <span className="absolute left-5 top-1/2 -translate-y-1/2 opacity-50" style={{ color: '#F0EBE3', fontFamily: 'DM Sans' }}>@</span>
                  <input type="text" required placeholder="username" value={setupUsername}
                    onChange={e => setSetupUsername(e.target.value)}
                    className="w-full h-14 pl-10 pr-5 rounded-xl text-base outline-none"
                    style={{ background: '#1A1A1A', border: '1px solid #2C2C2C', color: '#F0EBE3', fontFamily: 'DM Sans' }} />
                </div>
              </div>

              <motion.button type="submit" whileTap={{ scale: 0.97 }}
                className="w-full h-14 rounded-xl font-display text-xl tracking-wider mt-4"
                style={{ background: '#FF4500', color: '#F0EBE3' }}>
                CONTINUE
              </motion.button>
            </form>
          </motion.div>
        )}

        {/* ═══ SCREEN 3: ROLE SELECTION CAROUSEL ═══ */}
        {step === 'roles' && (
          <motion.div key="roles" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="flex-1 flex flex-col relative overflow-hidden bg-black">
            
            {/* Scroll Container */}
            <div 
              className="flex-1 flex overflow-x-auto snap-x snap-mandatory"
              style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
              onScroll={(e) => {
                const scrollX = e.currentTarget.scrollLeft;
                const width = e.currentTarget.offsetWidth;
                const index = Math.round(scrollX / width);
                if (index !== activeRoleIdx) setActiveRoleIdx(index);
              }}
            >
              {ROLES.map((role, idx) => (
                <div key={role.id} className="min-w-full w-full h-full relative snap-center flex-shrink-0">
                  <div className="absolute inset-0" style={{ background: role.gradient }} />
                  {/* Overlay vignette */}
                  <div className="absolute inset-0"
                    style={{ background: 'linear-gradient(to bottom, transparent 30%, rgba(8,8,8,0.98) 100%)' }} />
                  
                  {/* Content bottom aligned */}
                  <div className="absolute bottom-[160px] left-0 right-0 px-[28px] pointer-events-none">
                    {/* Accent bar */}
                    <AnimatePresence>
                      {activeRoleIdx === idx && (
                        <motion.div 
                          initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} exit={{ scaleX: 0 }}
                          transition={{ duration: 0.3 }}
                          style={{ transformOrigin: 'left' }}
                          className="w-[32px] h-[4px] bg-[#FF4500] rounded-[2px] mb-[8px]" 
                        />
                      )}
                    </AnimatePresence>
                    
                    <h2 className="font-display text-[72px] leading-none tracking-[2px] text-[#F0EBE3]">
                      {role.name}
                    </h2>
                    
                    <div className="h-[12px]" />
                    
                    <p className="text-[16px] leading-[1.65] text-[#F0EBE3] opacity-70 whitespace-pre-line"
                       style={{ fontFamily: 'DM Sans' }}>
                      {role.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* Fixed Bottom Overlay */}
            <div className="absolute bottom-0 left-0 right-0 h-[140px] pointer-events-none flex flex-col justify-end pb-[32px]">
              
              {/* PAGE DOTS */}
              <div className="flex justify-center gap-[8px] mb-[24px]">
                {ROLES.map((_, i) => (
                  <motion.div key={i}
                    animate={{ width: i === activeRoleIdx ? 28 : 8, background: i === activeRoleIdx ? '#F0EBE3' : '#2C2C2C' }}
                    transition={{ duration: 0.2, ease: 'easeOut' }}
                    className="h-[8px] rounded-[4px]"
                  />
                ))}
              </div>
              
              {/* CONTINUE BUTTON */}
              <div className="px-[20px] pointer-events-auto">
                <motion.button
                  onClick={() => { sounds.playTargetLock(); setStep('cam_perm'); }}
                  whileTap={{ scale: 0.97 }}
                  className="w-full h-[56px] rounded-[12px] font-display text-[22px] tracking-[2px]"
                  style={{ background: '#FF4500', color: '#F0EBE3', boxShadow: '0 4px 24px rgba(255,69,0,0.4)' }}>
                  {ROLES[activeRoleIdx].ctaText}
                </motion.button>
              </div>
            </div>
          </motion.div>
        )}

        {/* ═══ SCREEN 4: CAMERA PERMISSION ═══ */}
        {step === 'cam_perm' && (
          <motion.div key="cam_perm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="flex-1 flex flex-col items-center relative pt-[24vh] px-[24px] w-full max-w-md mx-auto">
            <ApertureIcon animate size={72} />
            <div className="text-center mt-[32px] space-y-1">
              {['POINT.', 'SCAN.', 'COLLECT.'].map((word, i) => (
                <motion.span key={word}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 1.2 + i * 0.3, duration: 0.25, ease: 'easeOut' }}
                  className="block font-display text-[52px] leading-none"
                  style={{ color: '#F0EBE3' }}>
                  {word}
                </motion.span>
              ))}
            </div>
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 2.1, duration: 0.7 }}
              className="text-center text-[15px] leading-[1.6] mt-[20px] max-w-[280px]"
              style={{ color: '#9A9088', fontFamily: 'DM Sans' }}>
              Apex needs your camera to photograph real cars.
              Photos stay on your device until you post them.
            </motion.p>
            <div className="absolute bottom-[48px] left-[24px] right-[24px]">
              <motion.button initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 2.4 }}
                onClick={() => { sounds.playTargetLock(); setStep('loc_perm'); }}
                whileTap={{ scale: 0.97 }}
                className="w-full h-[56px] rounded-[12px] font-display text-[22px] tracking-[2px]"
                style={{ background: '#FF4500', color: '#F0EBE3' }}>
                ENABLE CAMERA
              </motion.button>
            </div>
          </motion.div>
        )}

        {/* ═══ SCREEN 5: LOCATION PERMISSION ═══ */}
        {step === 'loc_perm' && (
          <motion.div key="loc_perm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="flex-1 flex flex-col items-center relative pt-[24vh] px-[24px] w-full max-w-md mx-auto">
            <GpsCrosshair size={72} />
            <div className="text-center mt-[32px]">
              <h2 className="font-display text-[46px] leading-none" style={{ color: '#F0EBE3' }}>
                WHERE YOU ARE
              </h2>
              <h2 className="font-display text-[46px] leading-none" style={{ color: '#F0EBE3' }}>
                CHANGES EVERYTHING.
              </h2>
            </div>
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4, duration: 0.5 }}
              className="text-center text-[15px] leading-[1.6] mt-[20px] max-w-[300px]"
              style={{ color: '#9A9088', fontFamily: 'DM Sans' }}>
              Rarity is calculated for your specific city.
              A Ferrari might be common in Dubai.
              In your city? It could be Legendary.
            </motion.p>
            <div className="absolute bottom-[48px] left-[24px] right-[24px] space-y-[12px]">
              <motion.button initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}
                onClick={() => {
                  sounds.playTargetLock();
                  requestRealLocationPermission().then((res) => {
                    if (res.city && res.city !== 'Your City') {
                      useApexStore.getState().updateUserProfile({
                        city: res.city,
                        country: res.country
                      });
                    }
                  });
                  setStep('notif_perm');
                }}
                whileTap={{ scale: 0.97 }}
                className="w-full h-[56px] rounded-[12px] font-display text-[22px] tracking-[2px]"
                style={{ background: '#FF4500', color: '#F0EBE3' }}>
                ENABLE LOCATION
              </motion.button>
              <button onClick={() => { sounds.playTargetLock(); setStep('notif_perm'); }}
                className="w-full text-center text-[13px]" style={{ color: '#9A9088', fontFamily: 'DM Sans' }}>
                Approximate only
              </button>
            </div>
          </motion.div>
        )}

        {/* ═══ SCREEN 6: NOTIFICATIONS PERMISSION ═══ */}
        {step === 'notif_perm' && (
          <motion.div key="notif_perm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="flex-1 flex flex-col items-center relative pt-[24vh] px-[24px] w-full max-w-md mx-auto">
            <motion.div animate={{ rotate: [0, 12, 0, -12, 0] }} transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}>
              <Bell className="w-[72px] h-[72px]" style={{ color: '#F0EBE3', opacity: 0.7 }} strokeWidth={1.5} />
              <motion.div className="absolute top-[4px] right-[4px] w-[8px] h-[8px] rounded-[4px]" style={{ background: '#FF4500' }}
                animate={{ scale: [1, 1.4, 1] }} transition={{ duration: 1.5, repeat: Infinity }} />
            </motion.div>
            <h2 className="font-display text-[52px] leading-none mt-[32px] text-center" style={{ color: '#F0EBE3' }}>
              HUNTS HAPPEN FAST.
            </h2>
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4, duration: 0.5 }}
              className="text-center text-[15px] leading-[1.6] mt-[20px] max-w-[280px]"
              style={{ color: '#9A9088', fontFamily: 'DM Sans' }}>
              We only notify you when rare cars appear nearby or a hunt goes live. Nothing else.
            </motion.p>
            <div className="absolute bottom-[48px] left-[24px] right-[24px] space-y-[12px]">
              <motion.button initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}
                onClick={handleFinish} whileTap={{ scale: 0.97 }}
                className="w-full h-[56px] rounded-[12px] font-display text-[22px] tracking-[2px]"
                style={{ background: '#FF4500', color: '#F0EBE3' }}>
                ENABLE NOTIFICATIONS
              </motion.button>
              <button onClick={handleFinish}
                className="w-full text-center text-[13px]" style={{ color: '#9A9088', fontFamily: 'DM Sans' }}>
                Skip for now
              </button>
            </div>
          </motion.div>
        )}

        {/* ═══ SCREEN 7: CELEBRATION ═══ */}
        {step === 'celebration' && (
          <motion.div key="celebration" initial={{ opacity: 1 }} className="flex-1 flex flex-col items-center justify-center relative overflow-hidden bg-black">
            {/* Spark burst */}
            {celebStage >= 1 && celebStage < 2 && (
              <motion.div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 100 }}
                  transition={{ duration: 0.18, ease: [0.19, 1, 0.22, 1] }} // ease-out-expo
                  className="w-[10px] h-[10px] rounded-full"
                  style={{ background: '#FF4500' }} />
              </motion.div>
            )}
            
            {celebStage >= 2 && celebStage < 3 && (
              <motion.div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none bg-[#FF4500]">
                <motion.div
                  initial={{ scale: 100 }}
                  animate={{ scale: 0 }}
                  transition={{ duration: 0.28, ease: [0.95, 0.05, 0.795, 0.035] }} // reverse ease-in
                  className="w-[10px] h-[10px] rounded-full"
                  style={{ background: 'black', boxShadow: '0 0 0 1000px black' }} />
              </motion.div>
            )}

            {/* WELCOME */}
            {celebStage >= 3 && (
              <motion.h1 initial={{ y: -80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={SPRING_HEAVY}
                className="font-display text-[80px] leading-none" style={{ color: '#F0EBE3', letterSpacing: '4px' }}>
                WELCOME
              </motion.h1>
            )}

            {/* Role name */}
            {celebStage >= 4 && (
              <motion.h2 initial={{ scale: 0 }} animate={{ scale: [0, 1.15, 1] }} transition={SPRING_POP}
                className="font-display text-[48px] leading-none mt-2" style={{ color: '#FF4500' }}>
                {ROLES[activeRoleIdx].name.replace('THE ', '')}.
              </motion.h2>
            )}

            {/* Stat chips */}
            {celebStage >= 6 && (
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
            {celebStage >= 7 && (
              <motion.button
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                onClick={() => { completeOnboarding(); onClose(); }}
                whileTap={{ scale: 0.97 }}
                className="mt-12 px-12 h-14 rounded-xl font-display text-xl tracking-wider relative overflow-hidden glow-orange z-20"
                style={{ background: '#FF4500', color: '#F0EBE3' }}>
                ENTER APEX →
              </motion.button>
            )}
          </motion.div>
        )}

      </AnimatePresence>
    </div>
  );
};
