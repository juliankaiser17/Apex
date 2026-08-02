import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Lock, Eye, Users, MapPin, LogOut, User, Camera, Check } from 'lucide-react';
import { useApexStore } from '../../store/useApexStore';
import { PRIVACY_LEVEL_LABELS } from '../../utils/privacyPipeline';
import type { PrivacyLevel, Persona } from '../../types/apex';
import { sounds } from '../../utils/audio';

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

  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const handleAvatarFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const url = event.target?.result as string;
        setAvatarUrl(url);
      };
      reader.readAsDataURL(file);
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
          initial={{ y: '100%', opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: '100%', opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 220 }}
          className="w-full max-w-md bg-[#111111] border border-white/10 rounded-3xl p-6 space-y-6 shadow-2xl max-h-[90vh] overflow-y-auto"
        >
          {/* Top Bar Header */}
          <div className="flex items-center justify-between border-b border-white/10 pb-4">
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
          <div className="grid grid-cols-2 p-1 rounded-2xl bg-white/5 border border-white/10 text-sm font-medium">
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
            <form onSubmit={handleSaveProfile} className="space-y-4">
              {/* Avatar Upload */}
              <div className="flex items-center gap-4 p-4 rounded-2xl bg-white/5 border border-white/10">
                <div className="relative w-16 h-16 rounded-full overflow-hidden border-2 border-[#FF4500] group shrink-0">
                  <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="absolute inset-0 bg-black/60 flex items-center justify-center cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity text-white"
                  >
                    <Camera className="w-5 h-5" />
                  </div>
                </div>

                <div className="flex-1 space-y-1">
                  <p className="text-sm font-semibold text-white">Profile Photo</p>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-3 py-1.5 rounded-xl bg-[#FF4500]/10 border border-[#FF4500]/40 text-xs font-mono text-[#FF4500] hover:bg-[#FF4500]/20"
                  >
                    Change Avatar
                  </button>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleAvatarFileSelect}
                    accept="image/*"
                    className="hidden"
                  />
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

              {/* Save Profile Button */}
              <button
                type="submit"
                className="w-full py-3.5 rounded-xl bg-[#FF4500] text-white font-display text-lg tracking-wider flex items-center justify-center gap-2 glow-orange mt-2"
              >
                {savedSuccess ? <Check className="w-5 h-5" /> : null}
                <span>{savedSuccess ? 'PROFILE SAVED!' : 'SAVE PROFILE CHANGES'}</span>
              </button>
            </form>
          )}

          {/* TAB 2: PRIVACY & LOCATION */}
          {activeTab === 'privacy' && (
            <div className="space-y-4">
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
                          <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${
                            isSelected ? 'bg-[#FF5500] text-white' : 'bg-white/10 text-slate-400'
                          }`}>
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
            </div>
          )}

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
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
