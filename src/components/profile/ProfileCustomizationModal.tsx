import React, { useState, useRef, useMemo } from 'react';
import type { Badge } from '../../types/apex';
import { 
  X, 
  Check, 
  Camera, 
  Sparkles, 
  User, 
  Award, 
  Car, 
  Palette, 
  Upload, 
  Link as LinkIcon 
} from 'lucide-react';
import { useApexStore } from '../../store/useApexStore';
import { sounds } from '../../utils/audio';
import { hapticTap, hapticSuccess } from '../../utils/haptics';

interface ProfileCustomizationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const AVATAR_PRESETS = [
  { id: 'spectre', name: 'Carbon Spectre', url: 'https://api.dicebear.com/7.x/bottts/svg?seed=CarbonSpectre' },
  { id: 'drift', name: 'Drift Sensei', url: 'https://api.dicebear.com/7.x/bottts/svg?seed=DriftSensei' },
  { id: 'ghost', name: 'Apex Ghost', url: 'https://api.dicebear.com/7.x/bottts/svg?seed=ApexGhost' },
  { id: 'turbo', name: 'Turbo Nomad', url: 'https://api.dicebear.com/7.x/bottts/svg?seed=TurboNomad' },
  { id: 'diamond', name: 'Diamond Pilot', url: 'https://api.dicebear.com/7.x/bottts/svg?seed=DiamondPilot' },
  { id: 'falcon', name: 'Cyber Falcon', url: 'https://api.dicebear.com/7.x/bottts/svg?seed=CyberFalcon' }
];

const DRIVER_TITLES = [
  'Apex Spotter',
  'Hypercar Hunter',
  'Track Day Purist',
  'Midnight Scout',
  'Stuttgart Disciple',
  'JDM Connoisseur',
  'M Power Pilot',
  'Exotic Collector'
];

const THEME_COLORS = [
  { name: 'Apex Crimson', color: '#E50914' },
  { name: 'Electric Cyan', color: '#00E5FF' },
  { name: 'Acid Neon', color: '#76FF03' },
  { name: 'Sunset Amber', color: '#FFB300' },
  { name: 'Ultraviolet', color: '#7C4DFF' },
  { name: 'Carbon Silver', color: '#90A4AE' }
];

const VEHICLE_CLASSES = [
  'Supercars',
  'Hypercars',
  'JDM Icons',
  'Track Machines',
  'Classic Heritage',
  'American Muscle',
  'Luxury GT'
];

export const ProfileCustomizationModal: React.FC<ProfileCustomizationModalProps> = ({ isOpen, onClose }) => {
  const user = useApexStore(s => s.user);
  const garage = useApexStore(s => s.garage);
  const badges = useApexStore(s => s.badges);
  const updateUserProfile = useApexStore(s => s.updateUserProfile);

  const unlockedBadges = useMemo(() => badges.filter(b => b.isUnlocked), [badges]);

  const [displayName, setDisplayName] = useState(user.displayName || '');
  const [username, setUsername] = useState(user.username || '');
  const [bio, setBio] = useState(user.bio || '');
  const [driverTitle, setDriverTitle] = useState(user.driverTitle || 'Apex Spotter');
  const [avatarUrl, setAvatarUrl] = useState(user.avatarUrl || '');
  const [favoriteCar, setFavoriteCar] = useState(user.favoriteCar || '');
  const [favoriteBrand, setFavoriteBrand] = useState(user.favoriteBrand || '');
  const [cardThemeColor, setCardThemeColor] = useState(user.cardThemeColor || '#E50914');
  const [featuredBadgeSlug, setFeaturedBadgeSlug] = useState(user.featuredBadgeSlug || (unlockedBadges[0]?.slug ?? ''));
  const [favoriteClass, setFavoriteClass] = useState(user.favoriteClass || 'Supercars');
  const [showcaseCardId, setShowcaseCardId] = useState(user.showcaseCardId || (garage[0]?.id ?? ''));

  const selectedShowcaseCard = useMemo(() => {
    return garage.find(c => c.id === showcaseCardId) || garage[0] || null;
  }, [garage, showcaseCardId]);

  const selectedFeaturedBadge = useMemo(() => {
    return badges.find(b => b.slug === featuredBadgeSlug) || unlockedBadges[0] || null;
  }, [badges, unlockedBadges, featuredBadgeSlug]);

  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const [customUrlInput, setCustomUrlInput] = useState('');
  const [showUrlField, setShowUrlField] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleSave = () => {
    hapticSuccess();
    sounds.playTargetAcquired();

    const cleanUsername = username.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');

    updateUserProfile({
      displayName: displayName.trim() || 'Apex Spotter',
      username: cleanUsername || user.username,
      bio: bio.trim(),
      driverTitle,
      avatarUrl: avatarUrl || user.avatarUrl,
      favoriteCar: selectedShowcaseCard ? `${selectedShowcaseCard.make} ${selectedShowcaseCard.model}` : favoriteCar.trim(),
      favoriteBrand: selectedShowcaseCard ? selectedShowcaseCard.make : favoriteBrand.trim(),
      cardThemeColor,
      featuredBadgeSlug,
      favoriteClass,
      showcaseCardId: selectedShowcaseCard?.id
    });

    setSaveSuccess(true);
    setTimeout(() => {
      setSaveSuccess(false);
      onClose();
    }, 400);
  };

  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      if (dataUrl) {
        setAvatarUrl(dataUrl);
        hapticTap();
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
      <div 
        className="w-full max-w-lg bg-[#0E0E0E] border border-white/10 rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200"
        style={{ borderColor: `${cardThemeColor}40` }}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.08] bg-[#141414]">
          <div className="flex items-center gap-2.5">
            <div 
              className="w-2 h-6 rounded-full" 
              style={{ backgroundColor: cardThemeColor, boxShadow: `0 0 10px ${cardThemeColor}` }} 
            />
            <div>
              <h2 className="text-lg font-bold text-white tracking-tight">Customize Identity</h2>
              <p className="text-[10px] text-white/40 uppercase tracking-widest font-data">Profile Appearance & Showcase</p>
            </div>
          </div>
          <button 
            onClick={() => {
              hapticTap();
              onClose();
            }}
            className="p-2 rounded-xl text-white/50 hover:text-white hover:bg-white/[0.06] transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 text-left no-scrollbar">

          {/* 1. Avatar Customization */}
          <div className="space-y-3">
            <label className="text-xs font-bold text-white/60 uppercase tracking-wider block">
              Driver Avatar & Sigil
            </label>
            <div className="flex items-center gap-4">
              <div className="relative group">
                <img 
                  src={avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=400'} 
                  alt="Avatar Preview" 
                  className="w-20 h-20 rounded-2xl object-cover border-2 shadow-lg"
                  style={{ borderColor: cardThemeColor, boxShadow: `0 0 16px ${cardThemeColor}40` }}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 rounded-2xl flex items-center justify-center text-white transition-opacity cursor-pointer"
                >
                  <Camera className="w-5 h-5" />
                </button>
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  accept="image/*" 
                  className="hidden" 
                  onChange={handleImageFileChange} 
                />
              </div>

              <div className="space-y-2 flex-1">
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      hapticTap();
                      setShowAvatarPicker(!showAvatarPicker);
                      setShowUrlField(false);
                    }}
                    className="px-3 py-1.5 rounded-xl bg-white/[0.05] border border-white/10 hover:border-white/20 text-xs text-white flex items-center gap-1.5 transition-all"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" /> Presets
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      hapticTap();
                      fileInputRef.current?.click();
                    }}
                    className="px-3 py-1.5 rounded-xl bg-white/[0.05] border border-white/10 hover:border-white/20 text-xs text-white flex items-center gap-1.5 transition-all"
                  >
                    <Upload className="w-3.5 h-3.5" /> Upload Photo
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      hapticTap();
                      setShowUrlField(!showUrlField);
                      setShowAvatarPicker(false);
                    }}
                    className="px-3 py-1.5 rounded-xl bg-white/[0.05] border border-white/10 hover:border-white/20 text-xs text-white flex items-center gap-1.5 transition-all"
                  >
                    <LinkIcon className="w-3.5 h-3.5" /> Image Link
                  </button>
                </div>

                {showUrlField && (
                  <div className="flex gap-2 pt-1 animate-in fade-in">
                    <input 
                      type="url"
                      placeholder="Paste image URL..."
                      value={customUrlInput}
                      onChange={(e) => setCustomUrlInput(e.target.value)}
                      className="flex-1 bg-black/60 border border-white/10 rounded-xl px-3 py-1 text-xs text-white placeholder-white/30 focus:outline-none focus:border-white/30"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (customUrlInput.trim()) {
                          setAvatarUrl(customUrlInput.trim());
                          setShowUrlField(false);
                          setCustomUrlInput('');
                          hapticTap();
                        }
                      }}
                      className="px-3 py-1 rounded-xl bg-[#E50914] text-xs font-semibold text-white"
                    >
                      Apply
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Presets Grid */}
            {showAvatarPicker && (
              <div className="p-3 bg-black/50 border border-white/10 rounded-2xl grid grid-cols-6 gap-2 mt-2 animate-in fade-in">
                {AVATAR_PRESETS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      hapticTap();
                      setAvatarUrl(p.url);
                    }}
                    className={`p-1 rounded-xl border transition-all hover:scale-105 ${
                      avatarUrl === p.url ? 'border-amber-400 bg-amber-400/10' : 'border-white/10 bg-white/[0.02]'
                    }`}
                    title={p.name}
                  >
                    <img src={p.url} alt={p.name} className="w-full h-auto rounded-lg" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 2. Names & Identity */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-white/50 uppercase tracking-wider block">
                Display Name
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                <input 
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Your Name or Call-sign"
                  maxLength={30}
                  className="w-full bg-white/[0.03] border border-white/10 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-white/20 focus:outline-none focus:border-white/30"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-white/50 uppercase tracking-wider block">
                Username (@handle)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-white/30">@</span>
                <input 
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="username"
                  maxLength={20}
                  className="w-full bg-white/[0.03] border border-white/10 rounded-xl pl-8 pr-3 py-2 text-xs text-white placeholder-white/20 focus:outline-none focus:border-white/30 lowercase"
                />
              </div>
            </div>
          </div>

          {/* 3. Driver Title */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-white/50 uppercase tracking-wider block">
              Driver Title / Rank Badge
            </label>
            <div className="flex flex-wrap gap-2">
              {DRIVER_TITLES.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => {
                    hapticTap();
                    setDriverTitle(t);
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                    driverTitle === t 
                      ? 'text-white border-transparent shadow-md' 
                      : 'text-white/40 border-white/10 hover:border-white/20 bg-white/[0.02]'
                  }`}
                  style={driverTitle === t ? { backgroundColor: cardThemeColor, boxShadow: `0 0 12px ${cardThemeColor}40` } : undefined}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* 4. Bio / Collector Statement */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-white/50 uppercase tracking-wider block">
              Collector Bio & Statement
            </label>
            <textarea 
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Tell other spotters about your passion, dream builds, or local hunting grounds..."
              maxLength={180}
              rows={3}
              className="w-full bg-white/[0.03] border border-white/10 rounded-xl p-3 text-xs text-white placeholder-white/20 focus:outline-none focus:border-white/30 resize-none leading-relaxed"
            />
            <div className="flex justify-end text-[10px] text-white/30 font-data">
              {bio.length} / 180 characters
            </div>
          </div>

          {/* 5. Showcase Car Selection (From Garage) */}
          <div className="space-y-2">
            <label className="text-[11px] font-bold text-white/60 uppercase tracking-wider block">
              Showcase Vehicle (Pinned to Profile)
            </label>
            {garage.length > 0 ? (
              <div className="flex gap-2.5 overflow-x-auto no-scrollbar py-1">
                {garage.map(c => {
                  const isSelected = selectedShowcaseCard?.id === c.id;
                  return (
                    <div
                      key={c.id}
                      onClick={() => {
                        hapticTap();
                        setShowcaseCardId(c.id);
                        setFavoriteCar(`${c.make} ${c.model}`);
                        setFavoriteBrand(c.make);
                      }}
                      className={`shrink-0 w-36 rounded-xl border overflow-hidden transition-all cursor-pointer ${
                        isSelected 
                          ? 'border-white bg-white/[0.08] shadow-lg scale-[1.02]' 
                          : 'border-white/10 bg-white/[0.02] hover:border-white/20 opacity-70'
                      }`}
                      style={isSelected ? { borderColor: cardThemeColor, boxShadow: `0 0 12px ${cardThemeColor}40` } : undefined}
                    >
                      <div className="h-20 bg-black/40 relative">
                        <img 
                          src={c.imageUrl} 
                          alt={c.model} 
                          className="w-full h-full object-cover" 
                        />
                        <span className="absolute top-1 right-1 text-[8px] font-bold uppercase px-1.5 py-0.5 rounded bg-black/70 backdrop-blur-sm text-white/90">
                          {c.rarity}
                        </span>
                      </div>
                      <div className="p-2">
                        <p className="text-[10px] text-white/40 uppercase font-data truncate">{c.make}</p>
                        <p className="text-xs font-bold text-white truncate">{c.model}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-white/40 italic">Scan vehicles to pin them as your showcase car.</p>
            )}
          </div>

          {/* 6. Featured Badge (Pinned to Public Card) */}
          <div className="space-y-2">
            <label className="text-[11px] font-bold text-white/60 uppercase tracking-wider block">
              Featured Medal / Badge
            </label>
            {unlockedBadges.length > 0 ? (
              <div className="flex gap-2 overflow-x-auto no-scrollbar py-1">
                {unlockedBadges.map((b: Badge) => {
                  const isSelected = selectedFeaturedBadge?.slug === b.slug;
                  return (
                    <button
                      key={b.slug}
                      type="button"
                      onClick={() => {
                        hapticTap();
                        setFeaturedBadgeSlug(b.slug);
                      }}
                      className={`px-3 py-1.5 rounded-xl border text-xs whitespace-nowrap font-bold flex items-center gap-1.5 transition-all ${
                        isSelected 
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-md' 
                          : 'bg-black/40 text-white/50 border-white/10 hover:text-white hover:border-white/20'
                      }`}
                    >
                      <Award className="w-3.5 h-3.5 text-amber-400" />
                      <span>{b.name}</span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-white/40 italic">Unlock trophies to feature them on your profile.</p>
            )}
          </div>

          {/* 7. Favorite Vehicle Class */}
          <div className="space-y-2">
            <label className="text-[11px] font-bold text-white/60 uppercase tracking-wider block">
              Favorite Vehicle Class
            </label>
            <div className="flex gap-1.5 flex-wrap">
              {VEHICLE_CLASSES.map(cls => (
                <button
                  key={cls}
                  type="button"
                  onClick={() => {
                    hapticTap();
                    setFavoriteClass(cls);
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                    favoriteClass === cls
                      ? 'bg-white/15 text-white border-white/40 shadow-sm'
                      : 'bg-white/[0.02] text-white/50 border-white/10 hover:text-white'
                  }`}
                  style={favoriteClass === cls ? { borderColor: cardThemeColor } : undefined}
                >
                  {cls}
                </button>
              ))}
            </div>
          </div>

          {/* 8. Live Preview: How Others See You */}
          <div className="space-y-2 pt-2 border-t border-white/10">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold text-white/60 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" /> How Others See You
              </label>
              <span className="text-[10px] text-white/30 font-data">PUBLIC PREVIEW</span>
            </div>

            <div className="p-4 rounded-2xl bg-black/60 border border-white/10 shadow-2xl relative overflow-hidden">
              {/* Header Gradient */}
              <div 
                className="absolute inset-x-0 top-0 h-14 opacity-30 pointer-events-none"
                style={{ 
                  background: `linear-gradient(to bottom, ${cardThemeColor}, transparent)` 
                }} 
              />

              <div className="relative flex items-center gap-3.5">
                <img 
                  src={avatarUrl || user.avatarUrl} 
                  alt="Avatar" 
                  className="w-14 h-14 rounded-2xl object-cover border-2 shadow-lg shrink-0"
                  style={{ borderColor: cardThemeColor }}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-bold text-white truncate">{displayName || user.displayName}</h4>
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-white/10 text-white/80 font-data">
                      LVL {user.level || 1}
                    </span>
                  </div>
                  <p className="text-[11px] text-white/50 font-data truncate">@{username || user.username}</p>
                  <p className="text-[10px] text-white/40 italic truncate">{driverTitle}</p>
                </div>
              </div>

              {/* Badges & Class Chips */}
              <div className="flex items-center gap-2 mt-3 pt-3 border-t border-white/[0.06] flex-wrap">
                {selectedFeaturedBadge && (
                  <span className="px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-[10px] font-bold flex items-center gap-1">
                    <Award className="w-3 h-3" /> {selectedFeaturedBadge.name}
                  </span>
                )}
                <span className="px-2 py-0.5 rounded-full bg-white/[0.06] border border-white/10 text-white/80 text-[10px] font-semibold">
                  {favoriteClass}
                </span>
                {selectedShowcaseCard && (
                  <span className="px-2 py-0.5 rounded-full bg-white/[0.06] border border-white/10 text-white/80 text-[10px] font-semibold flex items-center gap-1">
                    <Car className="w-3 h-3 text-white/50" /> {selectedShowcaseCard.make} {selectedShowcaseCard.model}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* 6. Signature Card & Theme Accent */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-white/50 uppercase tracking-wider flex items-center gap-1.5">
              <Palette className="w-3.5 h-3.5" /> Signature Accent Color
            </label>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 pt-1">
              {THEME_COLORS.map((t) => (
                <button
                  key={t.color}
                  type="button"
                  onClick={() => {
                    hapticTap();
                    setCardThemeColor(t.color);
                  }}
                  className={`p-2 rounded-2xl border flex flex-col items-center gap-1.5 transition-all ${
                    cardThemeColor === t.color 
                      ? 'border-white bg-white/[0.08] shadow-lg scale-105' 
                      : 'border-white/10 bg-white/[0.02] hover:border-white/20'
                  }`}
                >
                  <div 
                    className="w-5 h-5 rounded-full shadow" 
                    style={{ backgroundColor: t.color, boxShadow: `0 0 10px ${t.color}` }} 
                  />
                  <span className="text-[9px] font-semibold text-white/70 truncate w-full text-center">{t.name}</span>
                </button>
              ))}
            </div>
          </div>

        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-white/[0.08] bg-[#141414]">
          <button
            type="button"
            onClick={() => {
              hapticTap();
              onClose();
            }}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-white/60 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-6 py-2.5 rounded-xl font-bold text-xs text-white flex items-center gap-2 shadow-xl active:scale-95 transition-all cursor-pointer"
            style={{ 
              backgroundColor: cardThemeColor, 
              boxShadow: `0 4px 16px ${cardThemeColor}60` 
            }}
          >
            {saveSuccess ? (
              <>
                <Check className="w-4 h-4" /> Saved!
              </>
            ) : (
              'Save Profile Identity'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
