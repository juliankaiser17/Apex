import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ArrowLeft,
  User, 
  AtSign, 
  MapPin, 
  Shield, 
  LogOut, 
  RefreshCcw, 
  Check, 
  Camera,
  Upload,
  Image as ImageIcon,
  Sparkles,
  Car,
  Tag,
  Palette,
  Gauge,
  Volume2,
  VolumeX,
  Compass,
  FileText,
  ChevronDown,
  ChevronUp,
  Crop,
  Trash2,
  ExternalLink,
  AlertTriangle
} from 'lucide-react';
import { Camera as CapCamera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Capacitor } from '@capacitor/core';
import { useApexStore } from '../../store/useApexStore';
import { sounds } from '../../utils/audio';
import { supabase } from '../../lib/supabase';
import { ImageCropModal } from './ImageCropModal';
import { applyAppTheme } from '../../utils/theme';

interface ProfileSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const FAMOUS_CITIES = [
  'Tokyo', 'London', 'Los Angeles', 'Dubai', 'Monaco', 'Miami', 'Berlin', 'New York', 'Lucknow'
];

const DRIVER_TITLES = [
  'Apex Spotter',
  'Hypercar Hunter',
  'Midnight Cruiser',
  'Track Specialist',
  'JDM Purist',
  'Classic Archivist',
  'Supercar Paparazzo',
  'Ghost Driver'
];

const POPULAR_BRANDS = [
  'Porsche',
  'Ferrari',
  'BMW',
  'Nissan',
  'McLaren',
  'Lamborghini',
  'Mercedes-AMG',
  'Toyota',
  'Aston Martin'
];

const THEME_ACCENT_COLORS = [
  { id: 'red', label: 'Apex Red', hex: '#E50914', border: 'border-red-500' },
  { id: 'orange', label: 'Papaya', hex: '#FF5722', border: 'border-orange-500' },
  { id: 'gold', label: 'Gold Rush', hex: '#F59E0B', border: 'border-amber-500' },
  { id: 'green', label: 'Nürburgring', hex: '#10B981', border: 'border-emerald-500' },
  { id: 'cyan', label: 'Riviera Cyan', hex: '#06B6D4', border: 'border-cyan-500' },
  { id: 'purple', label: 'Ultraviolet', hex: '#8B5CF6', border: 'border-purple-500' },
  { id: 'carbon', label: 'Stealth Carbon', hex: '#71717A', border: 'border-zinc-500' }
];

const CURATED_AVATARS = [
  { id: 'supercar', name: 'Supercar Pilot', url: 'https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?q=80&w=300&auto=format&fit=crop' },
  { id: 'track', name: 'Track Specialist', url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=300&auto=format&fit=crop' },
  { id: 'midnight', name: 'Midnight Cruiser', url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=300&auto=format&fit=crop' },
  { id: 'legend', name: 'Apex Legend', url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?q=80&w=300&auto=format&fit=crop' },
  { id: 'cyber', name: 'Cyber Racer', url: 'https://api.dicebear.com/7.x/bottts/svg?seed=ApexRacer99' },
  { id: 'stig', name: 'Volt Stig', url: 'https://api.dicebear.com/7.x/bottts/svg?seed=VoltStig' },
  { id: 'neon', name: 'Neon Hunter', url: 'https://api.dicebear.com/7.x/bottts/svg?seed=NeonHunter42' },
  { id: 'spectre', name: 'Carbon Spectre', url: 'https://api.dicebear.com/7.x/bottts/svg?seed=CarbonSpectre' },
  { id: 'drift', name: 'Drift Sensei', url: 'https://api.dicebear.com/7.x/bottts/svg?seed=DriftSensei' },
  { id: 'ghost', name: 'Apex Ghost', url: 'https://api.dicebear.com/7.x/bottts/svg?seed=ApexGhost' },
  { id: 'turbo', name: 'Turbo Nomad', url: 'https://api.dicebear.com/7.x/bottts/svg?seed=TurboNomad' },
  { id: 'diamond', name: 'Diamond Pilot', url: 'https://api.dicebear.com/7.x/bottts/svg?seed=DiamondPilot' }
];

export const ProfileSettingsModal: React.FC<ProfileSettingsModalProps> = ({ isOpen, onClose }) => {
  // Store subscriptions & selectors
  const user = useApexStore(s => s.user);
  const updateUserProfile = useApexStore(s => s.updateUserProfile);
  const logoutUser = useApexStore(s => s.logoutUser);
  const deleteAccount = useApexStore(s => s.deleteAccount);
  const clearStorageCache = useApexStore(s => s.clearStorageCache);
  const garage = useApexStore(s => s.garage);
  const locationDisplayMode = useApexStore(s => s.locationDisplayMode);
  const setLocationDisplayMode = useApexStore(s => s.setLocationDisplayMode);
  const authStatus = useApexStore(s => s.authStatus);
  const authUser = useApexStore(s => s.authUser);

  // Form states
  const [displayName, setDisplayName] = useState(user.displayName || '');
  const [username, setUsername] = useState(user.username || '');
  const [city, setCity] = useState(user.city || '');
  const [avatarUrl, setAvatarUrl] = useState(user.avatarUrl || '');
  const [bio, setBio] = useState(user.bio || '');
  const [driverTitle, setDriverTitle] = useState(user.driverTitle || 'Apex Spotter');
  const [favoriteCar, setFavoriteCar] = useState(user.favoriteCar || '');
  const [favoriteBrand, setFavoriteBrand] = useState(user.favoriteBrand || '');
  const [cardThemeColor, setCardThemeColor] = useState(user.cardThemeColor || '#E50914');
  const [speedUnits, setSpeedUnits] = useState<'kmh' | 'mph'>(user.speedUnits || 'kmh');
  const [soundEffectsEnabled, setSoundEffectsEnabled] = useState<boolean>(user.soundEffectsEnabled !== false);
  
  // UI states
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const [customUrlInput, setCustomUrlInput] = useState('');
  const [showCustomUrlInput, setShowCustomUrlInput] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [isCropModalOpen, setIsCropModalOpen] = useState(false);
  const [cropImageSrc, setCropImageSrc] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Synchronize form states when modal opens or user profile changes
  useEffect(() => {
    if (isOpen) {
      setDisplayName(user.displayName || '');
      setUsername(user.username || '');
      setCity(user.city || '');
      setAvatarUrl(user.avatarUrl || '');
      setBio(user.bio || '');
      setDriverTitle(user.driverTitle || 'Apex Spotter');
      setFavoriteCar(user.favoriteCar || '');
      setFavoriteBrand(user.favoriteBrand || '');
      setCardThemeColor(user.cardThemeColor || '#E50914');
      setSpeedUnits(user.speedUnits || 'kmh');
      setSoundEffectsEnabled(user.soundEffectsEnabled !== false);
      setShowAvatarPicker(false);
      setShowCustomUrlInput(false);
      setIsCropModalOpen(false);
      setCropImageSrc(null);
    }
  }, [isOpen, user]);

  // Android hardware back & browser popstate routing
  useEffect(() => {
    if (!isOpen) return;

    // Push entry to browser history
    window.history.pushState({ apexRoute: 'settings' }, '');

    const handlePopState = (_e: PopStateEvent) => {
      onClose();
    };

    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [isOpen, onClose]);

  const handleBack = () => {
    sounds.playTargetLock();
    if (window.history.state?.apexRoute === 'settings') {
      window.history.back();
    } else {
      onClose();
    }
  };

  // Authoritative identity derivations
  const displayEmail = useMemo(() => {
    if (authStatus === 'AUTH_LOADING') return 'Checking account…';
    if (authUser?.email) return authUser.email;
    if (user.email && user.email.includes('@')) return user.email;
    return 'Guest (Unregistered)';
  }, [authStatus, authUser?.email, user.email]);

  const displayAuthStatus = useMemo(() => {
    if (authStatus === 'AUTH_LOADING') return 'Checking…';
    if (authStatus === 'AUTHENTICATED_PROFILE_LOADING') return 'Loading Profile…';
    if (authStatus === 'AUTHENTICATED' || authUser?.email || (user.email && user.email.includes('@'))) {
      const email = authUser?.email || user.email || '';
      if (email.includes('gmail') || email.includes('google') || authUser?.provider === 'google') {
        return 'Authenticated (Google)';
      }
      return 'Authenticated (Verified Email)';
    }
    return 'Guest Session';
  }, [authStatus, authUser, user.email]);

  // ─── AVATAR PICKERS & CROPPER ───

  const startCroppingImage = (source: string) => {
    setCropImageSrc(source);
    setIsCropModalOpen(true);
    setShowAvatarPicker(false);
  };

  const handlePickFromGallery = async () => {
    sounds.playTargetLock();
    if (Capacitor.isNativePlatform()) {
      try {
        const image = await CapCamera.getPhoto({
          quality: 90,
          allowEditing: false,
          resultType: CameraResultType.DataUrl,
          source: CameraSource.Photos
        });
        if (image.dataUrl) {
          startCroppingImage(image.dataUrl);
        }
      } catch (e) {
        console.warn('Gallery pick canceled/error:', e);
      }
    } else {
      fileInputRef.current?.click();
    }
  };

  const handleTakePhoto = async () => {
    sounds.playTargetLock();
    if (Capacitor.isNativePlatform()) {
      try {
        const image = await CapCamera.getPhoto({
          quality: 90,
          allowEditing: false,
          resultType: CameraResultType.DataUrl,
          source: CameraSource.Camera
        });
        if (image.dataUrl) {
          startCroppingImage(image.dataUrl);
        }
      } catch (e) {
        console.warn('Camera capture canceled/error:', e);
      }
    } else {
      fileInputRef.current?.click();
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        startCroppingImage(reader.result);
      }
    };
    reader.readAsDataURL(file);
    // Reset file input so re-selecting same file triggers event
    e.target.value = '';
  };

  const handleApplyCustomUrl = () => {
    if (customUrlInput.trim().startsWith('http')) {
      sounds.playTargetLock();
      startCroppingImage(customUrlInput.trim());
      setCustomUrlInput('');
      setShowCustomUrlInput(false);
    }
  };

  const handleRandomizeAvatar = () => {
    sounds.playTargetLock();
    const seed = Math.random().toString(36).substring(7);
    const newAvatar = `https://api.dicebear.com/7.x/bottts/svg?seed=${seed}`;
    setAvatarUrl(newAvatar);
  };

  const handleSelectThemeColor = (colorHex: string) => {
    sounds.playTargetLock();
    setCardThemeColor(colorHex);
    applyAppTheme(colorHex);
  };


  // ─── SAVE & PERSIST ───

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    sounds.playTargetLock();
    const cleanDName = displayName.trim() || user.displayName || user.username || 'Spotter';
    const cleanUName = username.toLowerCase().replace(/[^a-z0-9_]/g, '') || user.username || 'spotter';
    const cleanCity = city.trim() || user.city || '';
    const cleanBio = bio.trim().substring(0, 100);
    const cleanCar = favoriteCar.trim();
    const cleanBrand = favoriteBrand.trim();

    updateUserProfile({
      displayName: cleanDName,
      username: cleanUName,
      city: cleanCity,
      avatarUrl,
      bio: cleanBio,
      driverTitle,
      favoriteCar: cleanCar,
      favoriteBrand: cleanBrand,
      cardThemeColor,
      speedUnits,
      soundEffectsEnabled
    });

    // 1. Update Supabase profiles table using valid existing columns
    try {
      await supabase.from('profiles').upsert([{
        id: user.id,
        display_name: cleanDName,
        username: cleanUName,
        avatar_url: avatarUrl
      }], { onConflict: 'id' });
    } catch (err) {
      console.warn('Profile Supabase upsert notice:', err);
    }

    // 2. Update Supabase Auth user metadata with extended profile customizations
    try {
      await supabase.auth.updateUser({
        data: {
          city: cleanCity,
          username: cleanUName,
          display_name: cleanDName,
          bio: cleanBio,
          driver_title: driverTitle,
          favorite_car: cleanCar,
          favorite_brand: cleanBrand,
          card_theme_color: cardThemeColor,
          speed_units: speedUnits,
          sound_effects_enabled: soundEffectsEnabled,
          onboarding_completed: true
        }
      });
    } catch (metaErr) {
      console.warn('Auth metadata update notice:', metaErr);
    }

    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2200);
  };

  const handleSignOut = () => {
    sounds.playTargetLock();
    logoutUser();
    onClose();
  };

  const handleDeleteAccount = async () => {
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
          {/* Hidden File Input for Web / Fallback Photo Upload */}
          <input
            type="file"
            ref={fileInputRef}
            accept="image/*"
            onChange={handleFileInputChange}
            className="hidden"
          />

          {/* Full-Screen Page Header with Android/Native Back Navigation */}
          <div className="pt-[calc(var(--sat,24px)+10px)] pb-3.5 px-4 border-b border-white/[0.08] bg-[#121212] flex items-center justify-between z-10 shrink-0 shadow-md">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleBack}
                aria-label="Back to previous screen"
                className="w-10 h-10 rounded-full bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.08] flex items-center justify-center text-white/80 hover:text-white transition-colors active:scale-95 cursor-pointer"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div className="flex items-center gap-2">
                <div 
                  className="w-2.5 h-2.5 rounded-full shadow-[0_0_8px_currentColor] transition-colors"
                  style={{ backgroundColor: cardThemeColor, color: cardThemeColor }}
                />
                <h2 className="text-base font-bold text-white tracking-tight uppercase">
                  Settings
                </h2>
              </div>
            </div>
            <button
              type="submit"
              form="settingsForm"
              className="text-xs font-semibold px-4 py-2 rounded-xl transition-all shadow-md active:scale-95 flex items-center gap-1.5 cursor-pointer"
              style={{ backgroundColor: cardThemeColor, color: '#FFFFFF' }}
            >
              {savedSuccess ? (
                <>
                  <Check className="w-3.5 h-3.5 text-white" />
                  <span>Saved</span>
                </>
              ) : (
                'Save'
              )}
            </button>
          </div>

          {/* Scrollable Page Body */}
          <div className="flex-1 overflow-y-auto space-y-4 py-4 px-4 max-w-xl mx-auto w-full pb-[calc(var(--sab,16px)+36px)]">
              
              {/* ─── 1. INTERACTIVE DRIVER LICENSE PREVIEW CARD ─── */}
              <div 
                className="p-4 rounded-2xl border transition-all duration-300 relative overflow-hidden bg-gradient-to-br from-[#181818] via-[#141414] to-black"
                style={{ borderColor: `${cardThemeColor}40` }}
              >
                {/* Dynamic Ambient Accent Flare */}
                <div 
                  className="absolute -top-10 -right-10 w-36 h-36 rounded-full blur-3xl opacity-20 pointer-events-none"
                  style={{ backgroundColor: cardThemeColor }}
                />

                <div className="flex items-start gap-3.5 relative z-10">
                  {/* Avatar Container with glowing ring */}
                  <div className="relative group">
                    <div 
                      className="w-16 h-16 rounded-2xl overflow-hidden p-0.5 border-2 transition-all duration-300 shadow-lg bg-black"
                      style={{ borderColor: cardThemeColor }}
                    >
                      <img
                        src={avatarUrl || user.avatarUrl}
                        alt={displayName || user.displayName}
                        className="w-full h-full object-cover rounded-[14px]"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowAvatarPicker(!showAvatarPicker)}
                      className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full text-white flex items-center justify-center shadow-lg active:scale-90 transition-transform"
                      style={{ backgroundColor: cardThemeColor }}
                      title="Change Profile Photo"
                    >
                      <Camera className="w-3 h-3" />
                    </button>
                  </div>

                  {/* License Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span 
                        className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border"
                        style={{ 
                          color: cardThemeColor, 
                          backgroundColor: `${cardThemeColor}15`,
                          borderColor: `${cardThemeColor}30`
                        }}
                      >
                        {driverTitle}
                      </span>
                      <span className="text-[10px] font-data text-white/40">
                        LVL {user.level} · {garage.length} SPOTS
                      </span>
                    </div>

                    <h4 className="text-base font-bold text-white tracking-tight truncate mt-1">
                      {displayName || user.displayName || 'Apex Hunter'}
                    </h4>
                    <p className="text-xs text-white/50 truncate font-data">
                      @{username || user.username} {city ? `· ${city}` : ''}
                    </p>

                    {bio && (
                      <p className="text-[11px] text-white/70 italic mt-1 line-clamp-2">
                        "{bio}"
                      </p>
                    )}

                    {(favoriteCar || favoriteBrand) && (
                      <div className="flex items-center gap-1.5 mt-1.5 text-[10px] text-white/60 font-medium">
                        <Car className="w-3 h-3 text-white/40" />
                        <span className="text-white/80">{[favoriteBrand, favoriteCar].filter(Boolean).join(' · ')}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Avatar Quick Action Bar */}
                <div className="flex items-center justify-between gap-1.5 pt-3 mt-3 border-t border-white/[0.06]">
                  <button
                    type="button"
                    onClick={handlePickFromGallery}
                    className="flex-1 py-1.5 px-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] text-[10px] font-medium text-white/70 hover:text-white flex items-center justify-center gap-1 transition-colors"
                  >
                    <Upload className="w-3 h-3" /> Upload
                  </button>

                  <button
                    type="button"
                    onClick={handleTakePhoto}
                    className="flex-1 py-1.5 px-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] text-[10px] font-medium text-white/70 hover:text-white flex items-center justify-center gap-1 transition-colors"
                  >
                    <Camera className="w-3 h-3" /> Photo
                  </button>

                  <button
                    type="button"
                    onClick={() => startCroppingImage(avatarUrl || user.avatarUrl)}
                    className="flex-1 py-1.5 px-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] text-[10px] font-medium text-white/70 hover:text-white flex items-center justify-center gap-1 transition-colors"
                    title="Crop Profile Picture"
                  >
                    <Crop className="w-3 h-3" /> Crop
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowAvatarPicker(!showAvatarPicker)}
                    className="flex-1 py-1.5 px-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] text-[10px] font-medium text-white/70 hover:text-white flex items-center justify-center gap-1 transition-colors"
                  >
                    <ImageIcon className="w-3 h-3" /> Avatars {showAvatarPicker ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  </button>

                  <button
                    type="button"
                    onClick={handleRandomizeAvatar}
                    className="w-7 h-7 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] text-white/70 hover:text-white flex items-center justify-center transition-colors"
                    title="Generate Procedural Bot"
                  >
                    <Sparkles className="w-3 h-3" />
                  </button>
                </div>

                {/* Expandable Curated Avatar Preset Gallery */}
                <AnimatePresence>
                  {showAvatarPicker && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden pt-3 border-t border-white/[0.06] mt-2.5"
                    >
                      <div className="flex items-center justify-between pb-2">
                        <span className="text-[10px] font-semibold text-white/60 uppercase tracking-wider">
                          Choose Curated Driver Avatar
                        </span>
                        <button
                          type="button"
                          onClick={() => setShowCustomUrlInput(!showCustomUrlInput)}
                          className="text-[10px] text-white/40 hover:text-white underline"
                        >
                          Paste Image URL
                        </button>
                      </div>

                      {showCustomUrlInput && (
                        <div className="flex items-center gap-1.5 mb-2.5">
                          <input
                            type="url"
                            value={customUrlInput}
                            onChange={(e) => setCustomUrlInput(e.target.value)}
                            placeholder="https://example.com/avatar.jpg"
                            className="flex-1 bg-black/60 border border-white/10 rounded-lg px-2.5 py-1 text-[11px] text-white placeholder-white/30 focus:outline-none"
                          />
                          <button
                            type="button"
                            onClick={handleApplyCustomUrl}
                            className="px-2 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-[10px] text-white font-semibold"
                          >
                            Apply
                          </button>
                        </div>
                      )}

                      <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                        {CURATED_AVATARS.map((av) => (
                          <button
                            key={av.id}
                            type="button"
                            onClick={() => {
                              sounds.playTargetLock();
                              setAvatarUrl(av.url);
                              setShowAvatarPicker(false);
                            }}
                            className={`p-1 rounded-xl border transition-all flex flex-col items-center ${
                              avatarUrl === av.url
                                ? 'bg-white/10 scale-105'
                                : 'bg-black/40 border-white/[0.06] hover:border-white/20'
                            }`}
                            style={{ borderColor: avatarUrl === av.url ? cardThemeColor : undefined }}
                          >
                            <img
                              src={av.url}
                              alt={av.name}
                              className="w-10 h-10 rounded-lg object-cover bg-black/60"
                            />
                            <span className="text-[8px] text-white/60 truncate w-full text-center mt-1">
                              {av.name.split(' ')[0]}
                            </span>
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* ─── 2. PROFILE CUSTOMIZATION FORM ─── */}
              <form id="settingsForm" onSubmit={handleSave} className="space-y-3.5">
                
                {/* Display Name & Username (2 Column) */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-white/60 flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-white/40" /> Display Name
                    </label>
                    <input
                      type="text"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="e.g. Alex Rivera"
                      className="w-full bg-[#181818] border border-white/[0.08] rounded-xl px-3 py-2 text-xs text-white placeholder-white/20 focus:outline-none focus:border-[#E50914] transition-colors"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-white/60 flex items-center gap-1.5">
                      <AtSign className="w-3.5 h-3.5 text-white/40" /> Username
                    </label>
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                      placeholder="e.g. apex_driver"
                      className="w-full bg-[#181818] border border-white/[0.08] rounded-xl px-3 py-2 text-xs text-white placeholder-white/20 focus:outline-none focus:border-[#E50914] transition-colors font-data"
                    />
                  </div>
                </div>

                {/* Driver Bio / Motto */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-semibold text-white/60 flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5 text-white/40" /> Driver Bio / Hunter Motto
                    </label>
                    <span className="text-[10px] text-white/30 font-data">
                      {bio.length}/100
                    </span>
                  </div>
                  <input
                    type="text"
                    maxLength={100}
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    placeholder="e.g. Hunting air-cooled 911s & high-revving V10s 🏁"
                    className="w-full bg-[#181818] border border-white/[0.08] rounded-xl px-3.5 py-2 text-xs text-white placeholder-white/20 focus:outline-none focus:border-[#E50914] transition-colors"
                  />
                </div>

                {/* Driver Call-Sign / Title */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold text-white/60 flex items-center gap-1.5">
                    <Compass className="w-3.5 h-3.5 text-white/40" /> Driver Call-Sign / Title
                  </label>
                  <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
                    {DRIVER_TITLES.map((title) => (
                      <button
                        key={title}
                        type="button"
                        onClick={() => {
                          sounds.playTargetLock();
                          setDriverTitle(title);
                        }}
                        className={`text-[10px] font-semibold px-2.5 py-1 rounded-xl border whitespace-nowrap transition-all ${
                          driverTitle === title
                            ? 'bg-white text-black font-bold shadow'
                            : 'bg-[#181818] text-white/50 border-white/[0.06] hover:border-white/20'
                        }`}
                      >
                        {title}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Dream Garage: Favorite Car & Brand */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-white/60 flex items-center gap-1.5">
                      <Car className="w-3.5 h-3.5 text-white/40" /> Dream Machine
                    </label>
                    <input
                      type="text"
                      value={favoriteCar}
                      onChange={(e) => setFavoriteCar(e.target.value)}
                      placeholder="e.g. 911 GT3 RS"
                      className="w-full bg-[#181818] border border-white/[0.08] rounded-xl px-3 py-2 text-xs text-white placeholder-white/20 focus:outline-none focus:border-[#E50914] transition-colors"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-white/60 flex items-center gap-1.5">
                      <Tag className="w-3.5 h-3.5 text-white/40" /> Favorite Brand
                    </label>
                    <input
                      type="text"
                      value={favoriteBrand}
                      onChange={(e) => setFavoriteBrand(e.target.value)}
                      placeholder="e.g. Porsche"
                      className="w-full bg-[#181818] border border-white/[0.08] rounded-xl px-3 py-2 text-xs text-white placeholder-white/20 focus:outline-none focus:border-[#E50914] transition-colors"
                    />
                  </div>
                </div>

                {/* Popular Brand Pills */}
                <div className="flex gap-1 overflow-x-auto no-scrollbar pt-0.5">
                  {POPULAR_BRANDS.map((b) => (
                    <button
                      key={b}
                      type="button"
                      onClick={() => {
                        sounds.playTargetLock();
                        setFavoriteBrand(b);
                      }}
                      className={`text-[9px] px-2 py-0.5 rounded-lg border whitespace-nowrap transition-colors ${
                        favoriteBrand === b
                          ? 'bg-[#E50914] text-white border-[#E50914]'
                          : 'bg-white/[0.03] text-white/40 border-white/[0.05] hover:border-white/15'
                      }`}
                    >
                      {b}
                    </button>
                  ))}
                </div>

                {/* Hunter Accent Theme Glow */}
                <div className="space-y-1.5 pt-1">
                  <label className="text-[11px] font-semibold text-white/60 flex items-center gap-1.5">
                    <Palette className="w-3.5 h-3.5 text-white/40" /> Hunter Accent Theme
                  </label>
                  <div className="flex items-center justify-between gap-1 p-1.5 rounded-2xl bg-[#181818] border border-white/[0.06]">
                    {THEME_ACCENT_COLORS.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => handleSelectThemeColor(c.hex)}
                        className={`w-7 h-7 rounded-xl flex items-center justify-center transition-all ${
                          cardThemeColor === c.hex
                            ? 'scale-110 shadow-md ring-2 ring-white/50'
                            : 'opacity-70 hover:opacity-100'
                        }`}
                        style={{ backgroundColor: c.hex }}
                        title={c.label}
                      >
                        {cardThemeColor === c.hex && <Check className="w-3.5 h-3.5 text-white" />}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Home City / Base */}
                <div className="space-y-1 pt-1">
                  <label className="text-[11px] font-semibold text-white/60 flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-white/40" /> Base City
                  </label>
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="Enter your home city..."
                    className="w-full bg-[#181818] border border-white/[0.08] rounded-xl px-3.5 py-2 text-xs text-white placeholder-white/20 focus:outline-none focus:border-[#E50914] transition-colors"
                  />
                  {/* Quick City Suggestions */}
                  <div className="flex gap-1 overflow-x-auto no-scrollbar pt-1">
                    {FAMOUS_CITIES.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => {
                          sounds.playTargetLock();
                          setCity(c);
                        }}
                        className={`text-[10px] px-2 py-0.5 rounded-lg border whitespace-nowrap transition-colors ${
                          city === c
                            ? 'bg-[#E50914] text-white border-[#E50914]'
                            : 'bg-white/[0.04] text-white/50 border-white/[0.06] hover:border-white/20'
                        }`}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                </div>

                {/* App Preferences: Speed Units & Sound FX */}
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <div className="p-2 rounded-xl bg-[#181818] border border-white/[0.06] space-y-1.5">
                    <span className="text-[10px] font-semibold text-white/50 flex items-center gap-1 uppercase">
                      <Gauge className="w-3 h-3" /> Speed Units
                    </span>
                    <div className="grid grid-cols-2 gap-1">
                      {(['kmh', 'mph'] as const).map((u) => (
                        <button
                          key={u}
                          type="button"
                          onClick={() => {
                            sounds.playTargetLock();
                            setSpeedUnits(u);
                          }}
                          className={`py-1 rounded-lg text-[10px] font-bold uppercase transition-all ${
                            speedUnits === u
                              ? 'bg-white text-black shadow'
                              : 'text-white/50 hover:text-white'
                          }`}
                        >
                          {u === 'kmh' ? 'km/h' : 'mph'}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="p-2 rounded-xl bg-[#181818] border border-white/[0.06] space-y-1.5">
                    <span className="text-[10px] font-semibold text-white/50 flex items-center gap-1 uppercase">
                      {soundEffectsEnabled ? <Volume2 className="w-3 h-3 text-emerald-400" /> : <VolumeX className="w-3 h-3 text-red-400" />} Audio FX
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        sounds.playTargetLock();
                        setSoundEffectsEnabled(!soundEffectsEnabled);
                      }}
                      className={`w-full py-1 rounded-lg text-[10px] font-bold uppercase transition-all ${
                        soundEffectsEnabled
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          : 'bg-white/[0.04] text-white/40 border border-white/[0.06]'
                      }`}
                    >
                      {soundEffectsEnabled ? 'Enabled' : 'Muted'}
                    </button>
                  </div>
                </div>

                {/* Location Privacy Selector */}
                <div className="space-y-1.5 pt-1">
                  <label className="text-[11px] font-semibold text-white/60 flex items-center gap-1.5">
                    <Shield className="w-3.5 h-3.5 text-white/40" /> Map Location Privacy
                  </label>
                  <div className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-[#181818] border border-white/[0.06]">
                    {[
                      { id: 'exact' as const, label: 'Exact Pin' },
                      { id: 'radius' as const, label: '1km Zone' },
                      { id: 'hidden' as const, label: 'Hidden' }
                    ].map((mode) => (
                      <button
                        key={mode.id}
                        type="button"
                        onClick={() => {
                          sounds.playTargetLock();
                          setLocationDisplayMode(mode.id);
                        }}
                        className={`py-1.5 rounded-lg text-[11px] font-semibold transition-all ${
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
              </form>

              {/* ─── 3. ACCOUNT INFO ─── */}
              <div className="p-3 rounded-2xl bg-[#181818] border border-white/[0.06] space-y-1.5 text-xs text-white/60">
                <div className="flex justify-between items-center">
                  <span>Account Email</span>
                  <span className="text-white font-medium truncate max-w-[200px]">
                    {displayEmail}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span>Authentication</span>
                  <span className="font-semibold font-data" style={{ color: cardThemeColor }}>
                    {displayAuthStatus}
                  </span>
                </div>
              </div>

              {/* ─── 4. LEGAL & PRIVACY ─── */}
              <div className="p-3 rounded-2xl bg-[#181818] border border-white/[0.06] space-y-2">
                <div className="text-[11px] font-semibold text-white/50 uppercase tracking-wider">
                  Legal & Privacy
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <a
                    href="https://apex-spotter.vercel.app/privacy.html"
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => sounds.playTargetLock()}
                    className="py-2 px-3 rounded-xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06] text-white/70 hover:text-white text-xs font-medium flex items-center justify-center gap-1.5 transition-colors"
                  >
                    Privacy Policy <ExternalLink className="w-3 h-3 text-white/40" />
                  </a>
                  <a
                    href="https://apex-spotter.vercel.app/terms.html"
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => sounds.playTargetLock()}
                    className="py-2 px-3 rounded-xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06] text-white/70 hover:text-white text-xs font-medium flex items-center justify-center gap-1.5 transition-colors"
                  >
                    Terms of Use <ExternalLink className="w-3 h-3 text-white/40" />
                  </a>
                </div>
              </div>

              {/* ─── 5. SESSION & CACHE ACTIONS ─── */}
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    sounds.playTargetLock();
                    clearStorageCache();
                  }}
                  className="flex-1 py-2 px-3 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] text-white/60 hover:text-white text-xs font-medium flex items-center justify-center gap-1.5 transition-colors"
                >
                  <RefreshCcw className="w-3.5 h-3.5" /> Clear Cache
                </button>

                <button
                  type="button"
                  onClick={handleSignOut}
                  className="flex-1 py-2 px-3 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] text-white/70 hover:text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5" /> Sign Out
                </button>
              </div>

              {/* ─── 6. DANGER ZONE: ACCOUNT DELETION ─── */}
              {!showDeleteConfirm ? (
                <button
                  type="button"
                  onClick={() => {
                    sounds.playTargetLock();
                    setShowDeleteConfirm(true);
                  }}
                  className="w-full py-2 px-3 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/25 text-red-400 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5 text-red-400" /> Delete Account & Personal Data
                </button>
              ) : (
                <div className="p-3 rounded-2xl bg-red-950/40 border border-red-500/40 space-y-2.5">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                    <div>
                      <div className="text-xs font-bold text-red-300">Permanently Delete Account?</div>
                      <p className="text-[11px] text-red-200/70 leading-relaxed mt-0.5">
                        This will permanently remove your garage collection, spotting history, XP stats, and authentication identity. This action cannot be undone.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      disabled={isDeleting}
                      onClick={() => setShowDeleteConfirm(false)}
                      className="flex-1 py-1.5 px-3 rounded-lg bg-white/10 hover:bg-white/15 text-white text-xs font-medium transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={isDeleting}
                      onClick={handleDeleteAccount}
                      className="flex-1 py-2.5 px-3 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition-colors flex items-center justify-center gap-1.5 min-h-[44px]"
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

              {/* Bottom Save Action Button */}
              <div className="pt-2 pb-8">
                <button
                  type="submit"
                  form="settingsForm"
                  className="w-full py-3.5 rounded-2xl text-white font-semibold text-xs transition-all shadow-lg active:scale-98 flex items-center justify-center gap-1.5 hover:opacity-95 min-h-[46px] cursor-pointer"
                  style={{ backgroundColor: cardThemeColor }}
                >
                  {savedSuccess ? (
                    <>
                      <Check className="w-4 h-4 text-white" /> Profile Changes Saved
                    </>
                  ) : (
                    'Save Profile Customization'
                  )}
                </button>
              </div>

            </div>

          {/* Avatar Image Cropper Modal */}
          <ImageCropModal
            isOpen={isCropModalOpen}
            imageSrc={cropImageSrc}
            onCropComplete={(cropped) => {
              setAvatarUrl(cropped);
              setIsCropModalOpen(false);
              setCropImageSrc(null);
            }}
            onClose={() => {
              setIsCropModalOpen(false);
              setCropImageSrc(null);
            }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
};
