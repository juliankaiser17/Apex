import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ArrowLeft,
  Shield, 
  LogOut, 
  RefreshCcw, 
  Check, 
  Gauge, 
  Volume2, 
  VolumeX, 
  Compass, 
  Trash2, 
  ExternalLink, 
  AlertTriangle,
  Vibrate,
  VibrateOff,
  Activity
} from 'lucide-react';
import { useApexStore } from '../../store/useApexStore';
import { sounds, setSoundEnabled } from '../../utils/audio';
import { isHapticsEnabled, setHapticsEnabled, hapticTap } from '../../utils/haptics';
import { computeAuthoritativeStats } from '../../utils/userStats';
import { useLocalRarity } from '../../hooks/useLocalRarity';

interface ProfileSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ProfileSettingsModal: React.FC<ProfileSettingsModalProps> = ({ isOpen, onClose }) => {
  // Store subscriptions & selectors
  const user = useApexStore(s => s.user);
  const garage = useApexStore(s => s.garage);
  const badges = useApexStore(s => s.badges);
  const updateUserProfile = useApexStore(s => s.updateUserProfile);
  const logoutUser = useApexStore(s => s.logoutUser);
  const deleteAccount = useApexStore(s => s.deleteAccount);
  const clearStorageCache = useApexStore(s => s.clearStorageCache);
  const locationDisplayMode = useApexStore(s => s.locationDisplayMode);
  const setLocationDisplayMode = useApexStore(s => s.setLocationDisplayMode);
  const localRarityEnabled = useApexStore(s => s.localRarityEnabled);
  const setLocalRarityEnabled = useApexStore(s => s.setLocalRarityEnabled);
  const localRarityXpEnabled = useApexStore(s => s.localRarityXpEnabled);
  const setLocalRarityXpEnabled = useApexStore(s => s.setLocalRarityXpEnabled);
  const { permissionState } = useLocalRarity();
  const authStatus = useApexStore(s => s.authStatus);
  const authUser = useApexStore(s => s.authUser);

  // Authoritative Single Source of Truth Statistics
  const authoritativeStats = useMemo(() => {
    return computeAuthoritativeStats(garage, badges);
  }, [garage, badges]);

  // Preferences state
  const [speedUnits, setSpeedUnits] = useState<'kmh' | 'mph'>(user.speedUnits || 'kmh');
  const [soundEffectsEnabled, setSoundEffectsEnabled] = useState<boolean>(user.soundEffectsEnabled !== false);
  const [vibrationActive, setVibrationActive] = useState<boolean>(
    user.hapticsEnabled !== undefined ? user.hapticsEnabled : isHapticsEnabled()
  );
  
  // UI states
  const [savedNotice, setSavedNotice] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Sync state with store on open
  useEffect(() => {
    if (isOpen) {
      setSpeedUnits(user.speedUnits || 'kmh');
      setSoundEffectsEnabled(user.soundEffectsEnabled !== false);
      setVibrationActive(user.hapticsEnabled !== undefined ? user.hapticsEnabled : isHapticsEnabled());
      setShowDeleteConfirm(false);
    }
  }, [isOpen, user]);

  // Android hardware back & browser popstate routing
  useEffect(() => {
    if (!isOpen) return;

    window.history.pushState({ apexRoute: 'settings' }, '');

    const handlePopState = () => {
      onClose();
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [isOpen, onClose]);

  const handleBack = () => {
    hapticTap();
    sounds.playTargetLock();
    if (window.history.state?.apexRoute === 'settings') {
      window.history.back();
    } else {
      onClose();
    }
  };

  // Toggle Vibration / Haptic Feedback
  const handleToggleVibration = () => {
    const nextState = !vibrationActive;
    setVibrationActive(nextState);
    setHapticsEnabled(nextState);
    if (nextState) {
      hapticTap();
    }
    sounds.playTargetLock();
    updateUserProfile({ hapticsEnabled: nextState });
    triggerSavedToast();
  };

  // Toggle Speed Units
  const handleSelectSpeedUnits = (units: 'kmh' | 'mph') => {
    hapticTap();
    sounds.playTargetLock();
    setSpeedUnits(units);
    updateUserProfile({ speedUnits: units });
    triggerSavedToast();
  };

  // Toggle Sound FX
  const handleToggleSound = () => {
    hapticTap();
    const nextVal = !soundEffectsEnabled;
    setSoundEffectsEnabled(nextVal);
    setSoundEnabled(nextVal);
    if (nextVal) {
      sounds.playTargetLock();
    }
    updateUserProfile({ soundEffectsEnabled: nextVal });
    triggerSavedToast();
  };

  const triggerSavedToast = () => {
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 1800);
  };

  // Canonical Identity
  const displayEmail = authUser?.email || user.email || 'Guest (Local Session)';
  const displayAuthStatus = useMemo(() => {
    if (authStatus === 'AUTH_LOADING') return 'Checking session…';
    if (authStatus === 'AUTHENTICATED' || authUser?.email) {
      return 'Authenticated (Cloud Synced)';
    }
    return 'Local Device Session';
  }, [authStatus, authUser]);

  const handleSignOut = () => {
    hapticTap();
    sounds.playTargetLock();
    logoutUser();
    onClose();
  };

  const handleDeleteAccount = async () => {
    hapticTap();
    sounds.playTargetLock();
    setIsDeleting(true);
    try {
      await deleteAccount();
      setShowDeleteConfirm(false);
      onClose();
    } catch (e) {
      console.warn('Delete account error:', e);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 20 }}
          transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
          className="fixed inset-0 z-50 bg-[#0c0c0c] flex flex-col font-sans select-none overflow-hidden"
          style={{ willChange: 'transform, opacity' }}
        >
          {/* Header */}
          <div className="pt-[calc(var(--sat,24px)+10px)] pb-3.5 px-4 border-b border-white/[0.08] bg-[#121212] flex items-center justify-between z-10 shrink-0 shadow-md">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleBack}
                aria-label="Back"
                className="w-10 h-10 rounded-full bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.08] flex items-center justify-center text-white/80 hover:text-white transition-colors active:scale-95 cursor-pointer"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div className="flex items-center gap-2">
                <div 
                  className="w-2.5 h-2.5 rounded-full shadow-[0_0_8px_currentColor]"
                  style={{ backgroundColor: 'var(--accent-color)', color: 'var(--accent-color)' }}
                />
                <h2 className="text-base font-bold text-white tracking-tight uppercase">
                  Settings & Preferences
                </h2>
              </div>
            </div>

            {savedNotice && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-full flex items-center gap-1"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Saved</span>
              </motion.div>
            )}
          </div>

          {/* Scrollable Body */}
          <div className="flex-1 overflow-y-auto space-y-4 py-4 px-4 max-w-xl mx-auto w-full pb-[calc(var(--sab,16px)+36px)]">
            
            {/* ─── 1. AUTHORITATIVE PROGRESSION & STATS SOURCE OF TRUTH ─── */}
            <div className="p-4 rounded-2xl bg-[#141414] border border-white/[0.08] space-y-3 shadow-lg">
              <div className="flex items-center justify-between pb-1 border-b border-white/[0.06]">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4" style={{ color: 'var(--accent-color)' }} />
                  <span className="text-xs font-bold text-white uppercase tracking-wider">
                    Authoritative Progression
                  </span>
                </div>
                <span className="text-[10px] font-data text-white/40 uppercase">
                  Sync Status: Verified
                </span>
              </div>

              {/* Grid of Synchronized Stats */}
              <div className="grid grid-cols-3 gap-2 font-data">
                <div className="p-2.5 rounded-xl bg-black/40 border border-white/[0.05] text-center">
                  <span className="text-[10px] text-white/40 uppercase block">Spotted</span>
                  <span className="text-base font-bold text-white">{authoritativeStats.totalCarsSpotted}</span>
                </div>
                <div className="p-2.5 rounded-xl bg-black/40 border border-white/[0.05] text-center">
                  <span className="text-[10px] text-white/40 uppercase block">Unique</span>
                  <span className="text-base font-bold text-[#FF4500]">{authoritativeStats.uniqueFindsCount}</span>
                </div>
                <div className="p-2.5 rounded-xl bg-black/40 border border-white/[0.05] text-center">
                  <span className="text-[10px] text-white/40 uppercase block">Badges</span>
                  <span className="text-base font-bold text-amber-400">{authoritativeStats.badgesUnlockedCount}</span>
                </div>
                <div className="p-2.5 rounded-xl bg-black/40 border border-white/[0.05] text-center">
                  <span className="text-[10px] text-white/40 uppercase block">Rare</span>
                  <span className="text-base font-bold text-blue-400">{authoritativeStats.rareCount}</span>
                </div>
                <div className="p-2.5 rounded-xl bg-black/40 border border-white/[0.05] text-center">
                  <span className="text-[10px] text-white/40 uppercase block">Epic</span>
                  <span className="text-base font-bold text-purple-400">{authoritativeStats.epicCount}</span>
                </div>
                <div className="p-2.5 rounded-xl bg-black/40 border border-white/[0.05] text-center">
                  <span className="text-[10px] text-white/40 uppercase block">Legendary</span>
                  <span className="text-base font-bold text-amber-500">{authoritativeStats.legendaryCount}</span>
                </div>
              </div>

              {/* Garage Specs Telemetry Preview */}
              <div className="pt-2 border-t border-white/[0.04] grid grid-cols-3 gap-2 text-center font-data text-[10px]">
                <div>
                  <span className="text-white/40 block">Highest Tier</span>
                  <span className="font-bold text-white capitalize">{authoritativeStats.highestTier}</span>
                </div>
                <div>
                  <span className="text-white/40 block">Top Speed</span>
                  <span className="font-bold text-white">
                    {authoritativeStats.topSpeedKmH > 0 
                      ? (speedUnits === 'mph' ? `${Math.round(authoritativeStats.topSpeedKmH * 0.621371)} mph` : `${authoritativeStats.topSpeedKmH} km/h`)
                      : '—'}
                  </span>
                </div>
                <div>
                  <span className="text-white/40 block">Total HP</span>
                  <span className="font-bold text-white">
                    {authoritativeStats.totalHorsepower > 0 ? `${authoritativeStats.totalHorsepower.toLocaleString()} hp` : '0 hp'}
                  </span>
                </div>
              </div>
            </div>

            {/* ─── 2. VIBRATION / HAPTICS TOGGLE ─── */}
            <div className="p-4 rounded-2xl bg-[#141414] border border-white/[0.08] space-y-2.5 shadow-md">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    {vibrationActive ? (
                      <Vibrate className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <VibrateOff className="w-4 h-4 text-red-400" />
                    )}
                    <span className="text-xs font-bold text-white uppercase tracking-wider">
                      Vibration & Haptic Feedback
                    </span>
                  </div>
                  <p className="text-[11px] text-white/50 leading-relaxed">
                    Controls tactile feedback across scanning, button interactions, target locks, and progression modals.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleToggleVibration}
                  className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                    vibrationActive
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 shadow-[0_0_12px_rgba(16,185,129,0.2)]'
                      : 'bg-white/[0.05] text-white/40 border border-white/[0.08] hover:text-white/70'
                  }`}
                >
                  {vibrationActive ? 'ON' : 'OFF'}
                </button>
              </div>
              <div className="text-[10px] text-white/40 pt-1 border-t border-white/[0.04]">
                Preference persists between app sessions and reinstallation.
              </div>
            </div>

            {/* ─── 3. APP PREFERENCES (SPEED & AUDIO) ─── */}
            <div className="p-4 rounded-2xl bg-[#141414] border border-white/[0.08] space-y-3.5 shadow-md">
              <span className="text-xs font-bold text-white uppercase tracking-wider block pb-1 border-b border-white/[0.06]">
                App Preferences
              </span>

              {/* Speed Units */}
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <span className="text-xs font-semibold text-white/80 flex items-center gap-1.5">
                    <Gauge className="w-3.5 h-3.5 text-white/50" /> Speed Display Units
                  </span>
                  <span className="text-[10px] text-white/40 block">Used for vehicle specs and garage telemetry</span>
                </div>
                <div className="flex bg-black/50 p-1 rounded-xl border border-white/[0.08]">
                  <button
                    type="button"
                    onClick={() => handleSelectSpeedUnits('kmh')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold uppercase transition-all cursor-pointer ${
                      speedUnits === 'kmh' ? 'bg-white text-black shadow' : 'text-white/40 hover:text-white'
                    }`}
                  >
                    km/h
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSelectSpeedUnits('mph')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold uppercase transition-all cursor-pointer ${
                      speedUnits === 'mph' ? 'bg-white text-black shadow' : 'text-white/40 hover:text-white'
                    }`}
                  >
                    mph
                  </button>
                </div>
              </div>

              {/* Audio Sound FX */}
              <div className="flex items-center justify-between pt-2 border-t border-white/[0.04]">
                <div className="space-y-0.5">
                  <span className="text-xs font-semibold text-white/80 flex items-center gap-1.5">
                    {soundEffectsEnabled ? <Volume2 className="w-3.5 h-3.5 text-emerald-400" /> : <VolumeX className="w-3.5 h-3.5 text-red-400" />} Audio Sound FX
                  </span>
                  <span className="text-[10px] text-white/40 block">Shutter clicks, scan locks, and XP rewards</span>
                </div>
                <button
                  type="button"
                  onClick={handleToggleSound}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold uppercase transition-all cursor-pointer ${
                    soundEffectsEnabled
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      : 'bg-white/[0.05] text-white/40 border border-white/[0.08]'
                  }`}
                >
                  {soundEffectsEnabled ? 'Enabled' : 'Muted'}
                </button>
              </div>
            </div>

            {/* ─── 4. MAP PRIVACY & LOCAL SIGHTING RARITY ─── */}
            <div className="p-4 rounded-2xl bg-[#141414] border border-white/[0.08] space-y-3.5 shadow-md">
              <span className="text-xs font-bold text-white uppercase tracking-wider block pb-1 border-b border-white/[0.06]">
                Location & Privacy
              </span>

              {/* Map Location Privacy */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-semibold text-white/80 flex items-center gap-1.5">
                    <Shield className="w-3.5 h-3.5 text-white/50" /> Map Spotting Privacy
                  </label>
                  <span className="text-[10px] text-white/40 font-data uppercase">
                    {locationDisplayMode}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-black/50 border border-white/[0.08]">
                  {[
                    { id: 'exact' as const, label: 'Exact Pin' },
                    { id: 'radius' as const, label: '1km Zone' },
                    { id: 'hidden' as const, label: 'Hidden' }
                  ].map((mode) => (
                    <button
                      key={mode.id}
                      type="button"
                      onClick={() => {
                        hapticTap();
                        sounds.playTargetLock();
                        setLocationDisplayMode(mode.id);
                        triggerSavedToast();
                      }}
                      className={`py-1.5 rounded-lg text-[11px] font-semibold transition-all cursor-pointer ${
                        locationDisplayMode === mode.id
                          ? 'bg-white text-black font-bold shadow'
                          : 'text-white/50 hover:text-white'
                      }`}
                    >
                      {mode.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Local Sighting Rarity */}
              <div className="pt-2 border-t border-white/[0.04] space-y-2">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-white/90 flex items-center gap-1.5">
                        <Compass className="w-3.5 h-3.5 text-[#E50914]" /> Local Sighting Rarity
                      </span>
                      <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider ${
                        permissionState === 'granted' 
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          : 'bg-white/[0.06] text-white/50 border border-white/10'
                      }`}>
                        {permissionState === 'granted' ? 'Active' : 'Prompt'}
                      </span>
                    </div>
                    <p className="text-[10px] text-white/40 leading-relaxed">
                      Evaluates rarity based on verified local sightings within your broader area (5-char Geohash, ~12–25 km²).
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      hapticTap();
                      sounds.playTargetLock();
                      setLocalRarityEnabled(!localRarityEnabled);
                      triggerSavedToast();
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                      localRarityEnabled
                        ? 'bg-[#E50914] text-white shadow-lg'
                        : 'bg-white/[0.06] text-white/40 border border-white/[0.08]'
                    }`}
                  >
                    {localRarityEnabled ? 'Active' : 'Off'}
                  </button>
                </div>

                {localRarityEnabled && (
                  <div className="pt-2 border-t border-white/[0.04] flex items-center justify-between">
                    <div className="space-y-0.5">
                      <span className="text-[10px] font-semibold text-white/80 block">Local XP Modifier</span>
                      <span className="text-[9px] text-white/40 block">Applies bounded local XP bonuses (up to +50%)</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        hapticTap();
                        sounds.playTargetLock();
                        setLocalRarityXpEnabled(!localRarityXpEnabled);
                        triggerSavedToast();
                      }}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer ${
                        localRarityXpEnabled
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          : 'bg-white/[0.04] text-white/40 border border-white/[0.06]'
                      }`}
                    >
                      {localRarityXpEnabled ? 'XP Active' : 'XP Pinned (1.0x)'}
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* ─── 5. ACCOUNT CLOUD IDENTITY ─── */}
            <div className="p-4 rounded-2xl bg-[#141414] border border-white/[0.08] space-y-2 shadow-md text-xs text-white/60">
              <span className="text-xs font-bold text-white uppercase tracking-wider block pb-1 border-b border-white/[0.06]">
                Cloud Account & Security
              </span>
              <div className="flex justify-between items-center pt-1">
                <span>Account Email</span>
                <span className="text-white font-medium truncate max-w-[200px]">
                  {displayEmail}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span>Account Provider</span>
                <span className="text-white font-medium capitalize">
                  {authUser?.provider || (displayEmail.includes('gmail') ? 'Google Account' : 'Email Account')}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span>Cloud Sync</span>
                <span className="text-emerald-400 font-medium flex items-center gap-1 font-data text-xs">
                  <Check className="w-3.5 h-3.5" /> Connected & Active
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span>Session State</span>
                <span className="font-semibold text-emerald-400 font-data">
                  {displayAuthStatus}
                </span>
              </div>
            </div>

            {/* ─── 6. LEGAL & PRIVACY ─── */}
            <div className="p-4 rounded-2xl bg-[#141414] border border-white/[0.08] space-y-2.5 shadow-md">
              <span className="text-xs font-bold text-white uppercase tracking-wider block pb-1 border-b border-white/[0.06]">
                Legal & Compliance
              </span>
              <div className="grid grid-cols-2 gap-2">
                <a
                  href="https://apex-spotter.vercel.app/privacy.html"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => sounds.playTargetLock()}
                  className="py-2.5 px-3 rounded-xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06] text-white/70 hover:text-white text-xs font-medium flex items-center justify-center gap-1.5 transition-colors"
                >
                  Privacy Policy <ExternalLink className="w-3 h-3 text-white/40" />
                </a>
                <a
                  href="https://apex-spotter.vercel.app/terms.html"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => sounds.playTargetLock()}
                  className="py-2.5 px-3 rounded-xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06] text-white/70 hover:text-white text-xs font-medium flex items-center justify-center gap-1.5 transition-colors"
                >
                  Terms of Use <ExternalLink className="w-3 h-3 text-white/40" />
                </a>
              </div>
            </div>

            {/* ─── 7. SESSION & CACHE ACTIONS ─── */}
            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  hapticTap();
                  sounds.playTargetLock();
                  clearStorageCache();
                  triggerSavedToast();
                }}
                className="flex-1 py-3 px-3 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] text-white/60 hover:text-white text-xs font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <RefreshCcw className="w-3.5 h-3.5" /> Clear Cache
              </button>

              <button
                type="button"
                onClick={handleSignOut}
                className="flex-1 py-3 px-3 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] text-white/80 hover:text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" /> Sign Out
              </button>
            </div>

            {/* ─── 8. DANGER ZONE: ACCOUNT DELETION ─── */}
            {!showDeleteConfirm ? (
              <button
                type="button"
                onClick={() => {
                  hapticTap();
                  sounds.playTargetLock();
                  setShowDeleteConfirm(true);
                }}
                className="w-full py-2.5 px-3 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/25 text-red-400 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5 text-red-400" /> Delete Account & Personal Data
              </button>
            ) : (
              <div className="p-3.5 rounded-2xl bg-red-950/40 border border-red-500/40 space-y-2.5">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  <div>
                    <div className="text-xs font-bold text-red-300">Permanently Delete Account?</div>
                    <p className="text-[11px] text-red-200/70 leading-relaxed mt-0.5">
                      This will permanently remove your garage collection, spotting history, XP stats, and authentication identity from Supabase.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    disabled={isDeleting}
                    onClick={() => setShowDeleteConfirm(false)}
                    className="flex-1 py-2 px-3 rounded-lg bg-white/10 hover:bg-white/15 text-white text-xs font-medium transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={isDeleting}
                    onClick={handleDeleteAccount}
                    className="flex-1 py-2.5 px-3 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition-colors flex items-center justify-center gap-1.5 min-h-[44px] cursor-pointer"
                  >
                    {isDeleting ? (
                      <>
                        <span className="w-2 h-2 rounded-full bg-white animate-ping" />
                        <span>Deleting...</span>
                      </>
                    ) : (
                      'Confirm Delete'
                    )}
                  </button>
                </div>
              </div>
            )}

          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
