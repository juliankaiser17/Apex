import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Lock, Eye, Users, MapPin, LogOut, User, Camera, Check, Globe, RefreshCcw } from 'lucide-react';
import { useApexStore } from '../../store/useApexStore';
import { PRIVACY_LEVEL_LABELS } from '../../utils/privacyPipeline';
import type { PrivacyLevel, Persona } from '../../types/apex';
import { sounds } from '../../utils/audio';
import { Camera as CapCamera, CameraResultType, CameraSource } from '@capacitor/camera';
import ReactCrop, { type Crop } from 'react-image-crop';
import { supabase } from '../../lib/supabase';

interface ProfileSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ProfileSettingsModal: React.FC<ProfileSettingsModalProps> = ({ isOpen, onClose }) => {
  const { user, updateUserProfile, setDefaultPrivacyLevel, logoutUser, resetDevelopmentState } = useApexStore();
  const [activeTab, setActiveTab] = useState<'profile' | 'privacy'>('profile');

  // Form state synced with user
  const [displayName, setDisplayName] = useState(user.displayName);
  const [username, setUsername] = useState(user.username);
  const [city, setCity] = useState(user.city || 'Tokyo');
  const [avatarUrl, setAvatarUrl] = useState(user.avatarUrl);
  const [persona, setPersona] = useState<Persona>(user.persona || 'unspecified');
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Sync state whenever modal opens or user updates
  useEffect(() => {
    if (isOpen) {
      setDisplayName(user.displayName || '');
      setUsername(user.username || '');
      setCity(user.city || 'Tokyo');
      setAvatarUrl(user.avatarUrl);
      setPersona(user.persona || 'unspecified');
      setSavedSuccess(false);
    }
  }, [isOpen, user]);

  // Cropping State
  const [cropTargetUrl, setCropTargetUrl] = useState<string | null>(null);
  const [crop, setCrop] = useState<Crop>({ unit: '%', width: 100, height: 100, x: 0, y: 0 });
  const imgRef = useRef<HTMLImageElement | null>(null);

  if (!isOpen) return null;

  const privacyOptions: { id: PrivacyLevel; icon: React.ReactNode }[] = [
    { id: 'public_blurred', icon: <Eye className="w-5 h-5 text-emerald-400" /> },
    { id: 'friends_only', icon: <Users className="w-5 h-5 text-blue-400" /> },
    { id: 'approximate_only', icon: <MapPin className="w-5 h-5 text-amber-400" /> },
    { id: 'no_hunt_private', icon: <Lock className="w-5 h-5 text-rose-400" /> }
  ];

  const handleSelectLevel = (level: PrivacyLevel) => {
    sounds.playTargetLock();
    setDefaultPrivacyLevel(level);
  };

  const handleAvatarFileSelect = async () => {
    try {
      const image = await CapCamera.getPhoto({
        quality: 90,
        allowEditing: true,
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Camera
      });
      
      if (image.dataUrl) {
        setCropTargetUrl(image.dataUrl);
      }
    } catch (error) {
      console.warn('User cancelled photo or error occurred:', error);
    }
  };

  const handleCropComplete = () => {
    if (imgRef.current && crop.width && crop.height) {
      const canvas = document.createElement('canvas');
      const scaleX = imgRef.current.naturalWidth / imgRef.current.width;
      const scaleY = imgRef.current.naturalHeight / imgRef.current.height;
      canvas.width = crop.width;
      canvas.height = crop.height;
      const ctx = canvas.getContext('2d');
      
      if (ctx) {
        ctx.drawImage(
          imgRef.current,
          crop.x * scaleX,
          crop.y * scaleY,
          crop.width * scaleX,
          crop.height * scaleY,
          0,
          0,
          crop.width,
          crop.height
        );
        const base64Image = canvas.toDataURL('image/jpeg');
        setAvatarUrl(base64Image);
        setCropTargetUrl(null);
      }
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    sounds.playXpPop();
    const cleanDisplayName = displayName.trim();
    const cleanUsername = username.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');

    updateUserProfile({
      displayName: cleanDisplayName,
      username: cleanUsername,
      city: city.trim(),
      avatarUrl,
      persona
    });

    // Update remote profile in Supabase if logged in
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        await supabase.from('profiles').update({
          display_name: cleanDisplayName,
          username: cleanUsername,
          city: city.trim(),
          avatar_url: avatarUrl,
          updated_at: new Date().toISOString()
        }).eq('id', session.user.id);
      }
    } catch (err) {
      console.warn('Remote profile update:', err);
    }

    setSavedSuccess(true);
    setTimeout(() => {
      onClose();
    }, 500);
  };

  const handleLogout = () => {
    sounds.playTargetLock();
    logoutUser();
    onClose();
  };

  const handleDevReset = async () => {
    if (window.confirm('Reset all development data and start with a clean zero state?')) {
      sounds.playTargetLock();
      await resetDevelopmentState();
      onClose();
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/80 backdrop-blur-md"
        />

        {/* Modal Window */}
        <motion.div
          initial={{ scale: 0.95, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 20 }}
          className="relative w-full max-w-lg bg-[#111111] border border-white/10 rounded-3xl overflow-hidden shadow-2xl z-10 max-h-[90vh] flex flex-col"
        >
          {/* Cropping View */}
          {cropTargetUrl ? (
            <div className="p-6 flex flex-col items-center justify-center space-y-4">
              <h3 className="text-lg font-display text-[#F0EBE3]">ADJUST AVATAR</h3>
              <div className="max-h-64 overflow-hidden rounded-2xl border border-white/10">
                <ReactCrop
                  crop={crop}
                  onChange={(c) => setCrop(c)}
                  aspect={1}
                  circularCrop
                >
                  <img
                    ref={imgRef}
                    src={cropTargetUrl}
                    alt="Crop preview"
                    className="max-h-64 object-contain"
                  />
                </ReactCrop>
              </div>
              <div className="flex gap-4 w-full">
                <button
                  type="button"
                  onClick={() => setCropTargetUrl(null)}
                  className="flex-1 py-3 rounded-xl bg-[#1A1A1A] text-[#9A9088] font-display text-sm"
                >
                  CANCEL
                </button>
                <button
                  type="button"
                  onClick={handleCropComplete}
                  className="flex-1 py-3 rounded-xl bg-[#FF4500] text-[#F0EBE3] font-display text-sm glow-orange"
                >
                  USE PHOTO
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Header */}
              <div className="flex items-center justify-between p-5 border-b border-white/10">
                <div className="flex gap-2">
                  <button
                    onClick={() => setActiveTab('profile')}
                    className={`px-4 py-1.5 rounded-full text-xs font-display tracking-wider transition-colors ${
                      activeTab === 'profile'
                        ? 'bg-[#FF4500] text-[#F0EBE3] glow-orange'
                        : 'bg-[#1A1A1A] text-[#9A9088] hover:text-[#F0EBE3]'
                    }`}
                  >
                    PROFILE
                  </button>
                  <button
                    onClick={() => setActiveTab('privacy')}
                    className={`px-4 py-1.5 rounded-full text-xs font-display tracking-wider transition-colors ${
                      activeTab === 'privacy'
                        ? 'bg-[#FF4500] text-[#F0EBE3] glow-orange'
                        : 'bg-[#1A1A1A] text-[#9A9088] hover:text-[#F0EBE3]'
                    }`}
                  >
                    PRIVACY & DEV
                  </button>
                </div>
                <button
                  onClick={onClose}
                  className="w-8 h-8 rounded-full bg-[#1A1A1A] flex items-center justify-center text-[#9A9088] hover:text-[#F0EBE3]"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Tab 1: Profile Details */}
              {activeTab === 'profile' && (
                <form onSubmit={handleSaveProfile} className="p-6 space-y-4 overflow-y-auto max-h-[65vh]">
                  {/* Avatar Upload */}
                  <div className="flex items-center gap-4 pb-2 border-b border-white/5">
                    <div className="relative w-16 h-16 rounded-full overflow-hidden border border-[#FF4500] shrink-0">
                      <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={handleAvatarFileSelect}
                        className="absolute inset-0 bg-black/40 flex items-center justify-center text-white/90 hover:bg-black/60 transition-colors"
                      >
                        <Camera className="w-5 h-5" />
                      </button>
                    </div>
                    <div>
                      <span className="text-xs font-data text-[#F0EBE3] font-semibold block">PROFILE PHOTO</span>
                      <span className="text-[11px] text-[#9A9088] block">Take a new photo with camera</span>
                    </div>
                  </div>

                  {/* Display Name */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-data text-[#9A9088] uppercase tracking-wider block">
                      DISPLAY NAME
                    </label>
                    <div className="relative">
                      <User className="w-4 h-4 text-[#9A9088] absolute left-3.5 top-3.5" />
                      <input
                        type="text"
                        required
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        placeholder="Apex Hunter"
                        className="w-full h-11 bg-[#1A1A1A] border border-[#2C2C2C] rounded-xl pl-10 pr-4 text-xs font-data text-[#F0EBE3] focus:border-[#FF4500] outline-none"
                      />
                    </div>
                  </div>

                  {/* Username */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-data text-[#9A9088] uppercase tracking-wider block">
                      USERNAME (HANDLE)
                    </label>
                    <div className="relative">
                      <span className="text-[#FF4500] text-xs font-data absolute left-3.5 top-3">@</span>
                      <input
                        type="text"
                        required
                        value={username}
                        onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                        placeholder="hunter_01"
                        className="w-full h-11 bg-[#1A1A1A] border border-[#2C2C2C] rounded-xl pl-8 pr-4 text-xs font-data text-[#F0EBE3] focus:border-[#FF4500] outline-none"
                      />
                    </div>
                  </div>

                  {/* City */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-data text-[#9A9088] uppercase tracking-wider block">
                      HOME RADAR CITY
                    </label>
                    <div className="relative">
                      <Globe className="w-4 h-4 text-[#9A9088] absolute left-3.5 top-3.5" />
                      <input
                        type="text"
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                        placeholder="Tokyo"
                        className="w-full h-11 bg-[#1A1A1A] border border-[#2C2C2C] rounded-xl pl-10 pr-4 text-xs font-data text-[#F0EBE3] focus:border-[#FF4500] outline-none"
                      />
                    </div>
                  </div>

                  {/* Persona Role */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-data text-[#9A9088] uppercase tracking-wider block">
                      CURRENT ROLE
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { id: 'finder', name: 'SPOTTER' },
                        { id: 'spotter', name: 'HUNTER' },
                        { id: 'love_of_cars', name: 'PURIST' },
                        { id: 'unspecified', name: 'UNSPECIFIED' },
                      ].map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => setPersona(item.id as Persona)}
                          className={`py-2 px-3 rounded-xl border text-[11px] font-data font-semibold text-center transition-all ${
                            persona === item.id
                              ? 'border-[#FF4500] bg-[#FF4500]/15 text-[#FF4500]'
                              : 'border-[#2C2C2C] bg-[#1A1A1A] text-[#9A9088] hover:border-white/20'
                          }`}
                        >
                          {item.name}
                        </button>
                      ))}
                    </div>
                  </div>
                </form>
              )}

              {/* Tab 2: Privacy & Dev Tools */}
              {activeTab === 'privacy' && (
                <div className="p-6 space-y-5 overflow-y-auto max-h-[65vh]">
                  {/* Privacy Levels */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-data text-[#9A9088] uppercase tracking-wider block">
                      SCAN BROADCAST PRIVACY
                    </label>
                    {privacyOptions.map((opt) => {
                      const isSelected = user.defaultPrivacyLevel === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => handleSelectLevel(opt.id)}
                          className={`w-full p-3 rounded-xl border flex items-center justify-between text-left transition-all ${
                            isSelected
                              ? 'border-[#FF4500] bg-[#FF4500]/10 text-white'
                              : 'border-[#2C2C2C] bg-[#1A1A1A] text-[#9A9088] hover:border-white/20'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            {opt.icon}
                            <div>
                              <span className="text-xs font-data font-semibold block text-[#F0EBE3]">
                                {PRIVACY_LEVEL_LABELS[opt.id].name}
                              </span>
                              <span className="text-[10px] text-[#9A9088] font-sans block">
                                {PRIVACY_LEVEL_LABELS[opt.id].desc}
                              </span>
                            </div>
                          </div>
                          {isSelected && <Check className="w-4 h-4 text-[#FF4500]" />}
                        </button>
                      );
                    })}
                  </div>

                  {/* Dev Reset Action */}
                  <div className="pt-2 border-t border-white/10 space-y-2">
                    <button
                      type="button"
                      onClick={handleDevReset}
                      className="w-full py-3 rounded-xl bg-amber-950/40 hover:bg-amber-950/70 border border-amber-600/40 text-amber-400 font-display text-sm tracking-wider flex items-center justify-center gap-2 transition-colors"
                    >
                      <RefreshCcw className="w-4 h-4 text-amber-400" />
                      <span>RESET DEVELOPMENT STATE (CLEAN ZERO)</span>
                    </button>
                  </div>

                  {/* Log Out */}
                  <div className="pt-2 border-t border-white/10">
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="w-full py-3 rounded-xl bg-rose-950/40 hover:bg-rose-950/70 border border-rose-600/40 text-rose-400 font-display text-sm tracking-wider flex items-center justify-center gap-2 transition-colors"
                    >
                      <LogOut className="w-4 h-4 text-rose-400" />
                      <span>LOG OUT OF APEX</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Footer Actions */}
              <div className="p-4 border-t border-white/10 flex gap-3 mt-auto bg-[#141414]">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-3 rounded-xl bg-[#1A1A1A] hover:bg-[#2C2C2C] text-[#F0EBE3] font-display text-sm tracking-wider border border-[#2C2C2C] transition-colors"
                >
                  CANCEL
                </button>
                <button
                  type="button"
                  onClick={activeTab === 'profile' ? handleSaveProfile : onClose}
                  className="flex-1 py-3 rounded-xl bg-[#FF4500] hover:bg-[#FF4500]/90 text-[#F0EBE3] font-display text-sm tracking-wider glow-orange transition-colors flex items-center justify-center gap-2"
                >
                  {savedSuccess ? <Check className="w-4 h-4" /> : 'SAVE CHANGES'}
                </button>
              </div>
            </>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
