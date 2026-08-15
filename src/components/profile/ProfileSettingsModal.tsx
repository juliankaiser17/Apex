import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Lock, Eye, Users, MapPin, LogOut, User, Camera, Check, Globe } from 'lucide-react';
import { useApexStore } from '../../store/useApexStore';
import { PRIVACY_LEVEL_LABELS } from '../../utils/privacyPipeline';
import type { PrivacyLevel, Persona } from '../../types/apex';
import { sounds } from '../../utils/audio';
import { Camera as CapCamera, CameraResultType, CameraSource } from '@capacitor/camera';
import ReactCrop, { type Crop, centerCrop, makeAspectCrop } from 'react-image-crop';

interface ProfileSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ProfileSettingsModal: React.FC<ProfileSettingsModalProps> = ({ isOpen, onClose }) => {
  const { user, updateUserProfile, setDefaultPrivacyLevel, logoutUser } = useApexStore();
  const [activeTab, setActiveTab] = useState<'profile' | 'privacy'>('profile');

  // Form state
  const [displayName, setDisplayName] = useState(user.displayName);
  const [username, setUsername] = useState(user.username);
  const [city, setCity] = useState(user.city || 'Hong Kong');
  const [avatarUrl, setAvatarUrl] = useState(user.avatarUrl);
  const [persona, setPersona] = useState<Persona>(user.persona || 'spotter');
  const [savedSuccess, setSavedSuccess] = useState(false);

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
        allowEditing: true, // Native edit if supported
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Camera // STRICTLY Camera only, no gallery
      });
      
      if (image.dataUrl) {
        setCropTargetUrl(image.dataUrl); // Show ReactCrop UI just in case native crop didn't work
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

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    sounds.playXpPop();
    updateUserProfile({
      displayName: displayName.trim(),
      username: username.trim(),
      city: city.trim(),
      avatarUrl,
      persona
    });
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2000);
  };

  const handleLogout = () => {
    sounds.playTargetLock();
    logoutUser();
    onClose();
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-end sm:items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="w-full max-w-md bg-[#080808]/95 backdrop-blur-xl border border-white/10 rounded-3xl overflow-hidden relative z-50 flex flex-col max-h-[90vh]"
        >
          {cropTargetUrl ? (
            <div className="p-6 flex flex-col h-full bg-[#111111]">
              <h3 className="font-display text-xl text-white mb-4 text-center">CROP PROFILE PHOTO</h3>
              <div className="flex-1 overflow-hidden rounded-xl border border-white/10 flex items-center justify-center bg-black mb-4 min-h-[300px]">
                <ReactCrop 
                  crop={crop} 
                  onChange={c => setCrop(c)} 
                  aspect={1}
                  circularCrop
                >
                  <img 
                    src={cropTargetUrl} 
                    ref={imgRef}
                    onLoad={(e) => {
                      const { width, height } = e.currentTarget;
                      const c = centerCrop(
                        makeAspectCrop({ unit: '%', width: 90 }, 1, width, height),
                        width, height
                      );
                      setCrop(c);
                    }}
                    alt="Crop target" 
                    className="max-h-[60vh] object-contain"
                  />
                </ReactCrop>
              </div>
              <div className="flex gap-3 mt-auto">
                <button 
                  onClick={() => setCropTargetUrl(null)}
                  className="flex-1 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-white font-bold"
                >
                  CANCEL
                </button>
                <button 
                  onClick={handleCropComplete}
                  className="flex-1 py-3 rounded-xl bg-[#FF4500] hover:bg-[#FF4500]/80 text-white font-bold glow-orange"
                >
                  APPLY
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Header */}
              <div className="flex items-center justify-between p-5 border-b border-white/10">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-2xl bg-orange-950/60 border border-orange-500/40 text-[#FF5500]">
                    <User className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-display text-2xl text-white">SETTINGS & PROFILE</h3>
                    <p className="text-xs font-mono text-slate-400">Manage account, avatar & privacy</p>
                  </div>
                </div>

                <button
                  onClick={onClose}
                  className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Sub Navigation Tabs */}
              <div className="grid grid-cols-2 p-1 m-4 mb-0 rounded-2xl bg-white/5 border border-white/10 text-sm font-medium">
                <button
                  onClick={() => setActiveTab('profile')}
                  className={`py-2.5 rounded-xl transition-colors ${
                    activeTab === 'profile' ? 'bg-[#FF4500] text-white font-bold' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  EDIT PROFILE
                </button>
                <button
                  onClick={() => setActiveTab('privacy')}
                  className={`py-2.5 rounded-xl transition-colors ${
                    activeTab === 'privacy' ? 'bg-[#FF4500] text-white font-bold' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  PRIVACY & LOCATION
                </button>
              </div>

              {/* TAB 1: EDIT PROFILE */}
              {activeTab === 'profile' && (
                <div className="flex-1 overflow-y-auto p-5 custom-scrollbar">
                  <form onSubmit={handleSaveProfile} className="space-y-4">
                    {/* Avatar Upload */}
                    <div className="flex items-center gap-4 p-4 rounded-2xl bg-white/5 border border-white/10">
                      <div className="relative w-16 h-16 rounded-full overflow-hidden border-2 border-[#FF4500] group shrink-0">
                        <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                        <div
                          onClick={handleAvatarFileSelect}
                          className="absolute inset-0 bg-black/60 flex items-center justify-center cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity text-white"
                        >
                          <Camera className="w-5 h-5" />
                        </div>
                      </div>

                      <div className="flex-1 space-y-1">
                        <p className="text-sm font-semibold text-white">Profile Photo</p>
                        <button
                          type="button"
                          onClick={handleAvatarFileSelect}
                          className="px-3 py-1.5 rounded-xl bg-[#FF4500]/10 border border-[#FF4500]/40 text-xs font-mono text-[#FF4500] hover:bg-[#FF4500]/20"
                        >
                          Change Avatar
                        </button>
                      </div>
                    </div>

                    {/* Display Name */}
                    <div className="space-y-1">
                      <label className="text-xs font-mono text-slate-400 uppercase">Display Name</label>
                      <input
                        type="text"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        className="w-full h-12 px-4 rounded-xl bg-white/5 border border-white/10 text-white font-medium focus:border-[#FF4500] focus:outline-none"
                      />
                    </div>

                    {/* Username */}
                    <div className="space-y-1">
                      <label className="text-xs font-mono text-slate-400 uppercase">Username Handle</label>
                      <input
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        className="w-full h-12 px-4 rounded-xl bg-white/5 border border-white/10 text-white font-medium focus:border-[#FF4500] focus:outline-none"
                      />
                    </div>

                    {/* City Location */}
                    <div className="space-y-1">
                      <label className="text-xs font-mono text-slate-400 uppercase">Primary City</label>
                      <input
                        type="text"
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                        className="w-full h-12 px-4 rounded-xl bg-white/5 border border-white/10 text-white font-medium focus:border-[#FF4500] focus:outline-none"
                      />
                    </div>

                    {/* Role Selection */}
                    <div className="space-y-1 pt-1">
                      <label className="text-xs font-mono text-slate-400 uppercase">Hunter Persona Role</label>
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          { id: 'spotter', name: 'THE HUNTER' },
                          { id: 'finder', name: 'THE SPOTTER' },
                          { id: 'love_of_cars', name: 'FOR THE LOVE' }
                        ].map((r) => (
                          <button
                            key={r.id}
                            type="button"
                            onClick={() => setPersona(r.id as Persona)}
                            className={`py-2 px-2 rounded-xl text-xs font-display tracking-wider border transition-colors ${
                              persona === r.id
                                ? 'bg-[#FF4500] border-[#FF4500] text-white font-bold'
                                : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'
                            }`}
                          >
                            {r.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  </form>
                </div>
              )}

              {/* TAB 2: PRIVACY & LOCATION */}
              {activeTab === 'privacy' && (
                <div className="flex-1 overflow-y-auto p-5 space-y-4 custom-scrollbar">
                  <div className="space-y-3">
                    {privacyOptions.map((opt) => {
                      const info = PRIVACY_LEVEL_LABELS[opt.id];
                      const isSelected = user.defaultPrivacyLevel === opt.id;
                      return (
                        <div
                          key={opt.id}
                          onClick={() => handleSelectLevel(opt.id)}
                          className={`p-4 rounded-2xl cursor-pointer border transition-all flex items-start gap-3.5 ${
                            isSelected
                              ? 'bg-gradient-to-r from-[#FF5500]/20 via-[#1A1A1A] to-[#111111] border-[#FF5500] shadow-[0_0_20px_rgba(255,85,0,0.3)]'
                              : 'bg-white/5 border-white/10 hover:border-white/20'
                          }`}
                        >
                          <div className="p-2 rounded-xl bg-white/5 border border-white/10 shrink-0">
                            {opt.icon}
                          </div>

                          <div className="flex-1">
                            <div className="flex items-center justify-between">
                              <h4 className="font-semibold text-white text-sm">{info.name}</h4>
                              <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded flex items-center gap-1 ${
                                isSelected ? 'bg-[#FF5500] text-white' : 'bg-white/10 text-slate-400'
                              }`}>
                                {info.iconName === 'Globe' && <Globe className="w-3 h-3" />}
                                {info.iconName === 'Users' && <Users className="w-3 h-3" />}
                                {info.iconName === 'MapPin' && <MapPin className="w-3 h-3" />}
                                {info.iconName === 'Lock' && <Lock className="w-3 h-3" />}
                                {info.badge}
                              </span>
                            </div>
                            <p className="text-xs text-slate-400 mt-1 leading-relaxed">{info.desc}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Guarantee Note */}
                  <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 text-slate-400 text-xs font-mono space-y-1">
                    <p className="font-bold text-slate-300">🛡 APEX PRIVACY GUARANTEE:</p>
                    <p className="leading-normal">
                      Your exact GPS coordinates are NEVER stored on our servers. Live position is processed client-side only during active hunts.
                    </p>
                  </div>

                  {/* LOG OUT BUTTON */}
                  <div className="pt-2 border-t border-white/10">
                    <button
                      onClick={handleLogout}
                      className="w-full py-3.5 rounded-xl bg-rose-950/40 hover:bg-rose-950/70 border border-rose-600/40 text-rose-400 font-display text-base tracking-wider flex items-center justify-center gap-2 transition-colors"
                    >
                      <LogOut className="w-5 h-5 text-rose-400" />
                      <span>LOG OUT OF APEX</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Footer Actions */}
              <div className="p-5 border-t border-white/10 flex gap-3 mt-auto">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-3 rounded-xl bg-[#1A1A1A] hover:bg-[#2C2C2C] text-[#F0EBE3] font-display text-base tracking-wider border border-[#2C2C2C] transition-colors"
                >
                  CANCEL
                </button>
                <button
                  type="submit"
                  onClick={activeTab === 'profile' ? handleSaveProfile : onClose}
                  className="flex-1 py-3 rounded-xl bg-[#FF4500] hover:bg-[#FF4500]/90 text-[#F0EBE3] font-display text-base tracking-wider glow-orange transition-colors flex items-center justify-center gap-2"
                >
                  {savedSuccess ? <Check className="w-5 h-5" /> : 'SAVE CHANGES'}
                </button>
              </div>
            </>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
