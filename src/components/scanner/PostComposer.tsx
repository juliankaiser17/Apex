import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, MessageSquare, Flame, Check, Lock } from 'lucide-react';
import type { CarCard } from '../../types/apex';
import { RARITY_CONFIG } from '../../utils/rarity';
import { useApexStore } from '../../store/useApexStore';
import { sounds } from '../../utils/audio';

interface PostComposerProps {
  card: CarCard;
  onClose?: () => void;
  onPosted?: () => void;
  onBack?: () => void;
  onPostComplete?: () => void;
}

export type LocationPrivacyOption = 'approx_delayed_5' | 'exact_delayed_15' | 'private_hidden';

export const PostComposer: React.FC<PostComposerProps> = ({ 
  card, 
  onClose, 
  onPosted, 
  onBack, 
  onPostComplete 
}) => {
  const handleExit = onClose || onBack || (() => {});
  const handleFinished = onPosted || onPostComplete || (() => {});
  const { addCardToGarage, setActiveTab, setScannerOpen, friends } = useApexStore();
  
  const [caption, setCaption] = useState('');
  const [privacyMode, setPrivacyMode] = useState<LocationPrivacyOption>('approx_delayed_5');
  const [allowComments, setAllowComments] = useState(true);
  const [startHunt, setStartHunt] = useState(true);
  const [uploadState, setUploadState] = useState<'idle' | 'uploading' | 'success'>('idle');

  const activeSpottersInCity = (friends || []).filter(f => f.city && card.city && f.city.toLowerCase() === card.city.toLowerCase()).length;
  const isSoloHunt = activeSpottersInCity < 2;

  const rarityConf = RARITY_CONFIG[card.rarity] || RARITY_CONFIG.rare;
  const charCount = caption.length;
  const remainingChars = 280 - charCount;

  const handlePost = async (publishToFeed: boolean = true) => {
    if (uploadState !== 'idle') return;

    sounds.playTargetLock();
    setUploadState('uploading');

    setTimeout(async () => {
      setUploadState('success');
      sounds.playXpPop();

      await addCardToGarage(card, caption, {
        publishToFeed,
        privacyMode,
        allowComments,
        allowHunts: startHunt && privacyMode !== 'private_hidden'
      });

      setTimeout(() => {
        setScannerOpen(false);
        handleFinished();
        if (publishToFeed) {
          setActiveTab('social');
        } else {
          setActiveTab('garage');
        }
      }, 600);
    }, 700);
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 15 }}
      className="fixed inset-0 z-50 bg-black flex flex-col justify-between overflow-y-auto select-none font-sans text-white"
    >
      <div>
        {/* HEADER BAR */}
        <div className="sticky top-0 z-40 bg-black/90 backdrop-blur-md px-4 h-14 flex items-center justify-between border-b border-white/[0.08]">
          <div className="flex items-center gap-2">
            <button 
              onClick={handleExit}
              className="w-9 h-9 rounded-full bg-white/[0.06] border border-white/[0.08] flex items-center justify-center text-white/70 hover:text-white transition-colors"
              title="Back"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <span className="text-lg font-bold text-white tracking-tight">
              Publish Spot
            </span>
          </div>

          <button
            onClick={() => handlePost(true)}
            disabled={uploadState !== 'idle'}
            className="px-4 py-1.5 rounded-full bg-[#E50914] hover:bg-[#DC2626] text-white font-semibold text-xs disabled:opacity-50 transition-colors"
          >
            {uploadState === 'uploading' ? 'Posting...' : uploadState === 'success' ? 'Posted!' : 'Post'}
          </button>
        </div>

        <div className="p-4 space-y-4 max-w-md mx-auto pb-32">
          {/* VEHICLE PREVIEW STRIP */}
          <div className="flex gap-3 bg-[#141414] p-3 rounded-2xl border border-white/[0.08]">
            <img 
              src={card.imageUrl} 
              alt={card.model} 
              className="w-20 h-20 rounded-xl object-cover border border-white/[0.08] bg-black"
            />
            <div className="flex-1 flex flex-col justify-center">
              <span className={`text-[9px] font-semibold px-2 py-0.5 rounded-full border ${rarityConf.badgeBg} w-max`}>
                {rarityConf.label}
              </span>
              <h3 className="text-base font-bold text-white mt-1 leading-tight">
                {card.make} {card.model}
              </h3>
              <p className="text-xs text-white/50 mt-0.5">{card.city || 'Global Radar'}</p>
            </div>
          </div>

          {/* CAPTION TEXTAREA */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-white/50">
              Caption
            </label>
            <div className="relative">
              <textarea
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                maxLength={280}
                rows={3}
                placeholder="Spotted this beauty today..."
                className="w-full bg-[#141414] border border-white/[0.08] rounded-2xl p-3.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-white/20 transition-colors resize-none"
              />
              <span className="absolute right-3.5 bottom-3 text-[10px] text-white/30 font-medium">
                {remainingChars}
              </span>
            </div>
          </div>

          {/* LOCATION PRIVACY MODE */}
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-white/50">
              Location Privacy
            </label>
            <div className="space-y-2">
              {/* Option 1: Approximate 1km */}
              <div 
                onClick={() => setPrivacyMode('approx_delayed_5')}
                className={`p-3.5 rounded-2xl border transition-colors cursor-pointer flex items-center justify-between ${
                  privacyMode === 'approx_delayed_5' 
                    ? 'bg-red-500/10 border-red-500/30' 
                    : 'bg-[#141414] border-white/[0.08]'
                }`}
              >
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-semibold text-white">1km Approximate Radius</span>
                    <span className="text-[9px] font-semibold px-2 py-0.2 rounded-full bg-[#E50914] text-white">Default</span>
                  </div>
                  <p className="text-xs text-white/50 mt-0.5">Creates a 1km zone on radar for community hunters.</p>
                </div>
                <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                  privacyMode === 'approx_delayed_5' ? 'border-[#E50914] bg-[#E50914]' : 'border-white/30'
                }`}>
                  {privacyMode === 'approx_delayed_5' && <Check className="w-2.5 h-2.5 text-white" />}
                </div>
              </div>

              {/* Option 2: Exact Location */}
              <div 
                onClick={() => setPrivacyMode('exact_delayed_15')}
                className={`p-3.5 rounded-2xl border transition-colors cursor-pointer flex items-center justify-between ${
                  privacyMode === 'exact_delayed_15' 
                    ? 'bg-red-500/10 border-red-500/30' 
                    : 'bg-[#141414] border-white/[0.08]'
                }`}
              >
                <div>
                  <span className="text-sm font-semibold text-white">Exact Location</span>
                  <p className="text-xs text-white/50 mt-0.5">Pins the precise coordinates directly on the live map.</p>
                </div>
                <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                  privacyMode === 'exact_delayed_15' ? 'border-[#E50914] bg-[#E50914]' : 'border-white/30'
                }`}>
                  {privacyMode === 'exact_delayed_15' && <Check className="w-2.5 h-2.5 text-white" />}
                </div>
              </div>

              {/* Option 3: Private Hidden */}
              <div 
                onClick={() => setPrivacyMode('private_hidden')}
                className={`p-3.5 rounded-2xl border transition-colors cursor-pointer flex items-center justify-between ${
                  privacyMode === 'private_hidden' 
                    ? 'bg-red-500/10 border-red-500/30' 
                    : 'bg-[#141414] border-white/[0.08]'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Lock className="w-4 h-4 text-white/50" />
                  <div>
                    <span className="text-sm font-semibold text-white">Private Only</span>
                    <p className="text-xs text-white/50 mt-0.5">Only saved in your private garage collection.</p>
                  </div>
                </div>
                <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                  privacyMode === 'private_hidden' ? 'border-[#E50914] bg-[#E50914]' : 'border-white/30'
                }`}>
                  {privacyMode === 'private_hidden' && <Check className="w-2.5 h-2.5 text-white" />}
                </div>
              </div>
            </div>
          </div>

          {/* HUNT MODE TOGGLE */}
          <div className="bg-[#141414] border border-white/[0.08] p-4 rounded-2xl space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-red-500/10 border border-red-500/20 text-[#E50914]">
                  <Flame className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-sm font-semibold text-white block">
                    {isSoloHunt ? 'Start Solo Time-Attack Hunt' : 'Start Community Hunt'}
                  </span>
                  <span className="text-xs text-white/50">
                    {isSoloHunt ? '15-min personal challenge with +50% XP bonus' : 'Launches a 7-minute radar hunt with tiered XP'}
                  </span>
                </div>
              </div>

              <button
                onClick={() => setStartHunt(!startHunt)}
                className={`w-11 h-6 rounded-full transition-colors relative ${
                  startHunt ? 'bg-[#E50914]' : 'bg-white/20'
                }`}
              >
                <div className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-all ${
                  startHunt ? 'left-6' : 'left-1'
                }`} />
              </button>
            </div>

            {startHunt && isSoloHunt && (
              <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-left space-y-1">
                <span className="text-[11px] font-bold text-amber-300 block">
                  ⚡ Low Spotter Density in {card.city || 'Sector'}
                </span>
                <p className="text-[10px] text-white/60 leading-snug">
                  Fewer than 2 spotters active nearby. A 15-minute <strong>Solo Time-Attack Hunt</strong> will be initiated with +50% XP bonus instead of an unjoinable multiplayer lobby.
                </p>
              </div>
            )}
          </div>

          {/* COMMENTS TOGGLE */}
          <div className="bg-[#141414] border border-white/[0.08] p-4 rounded-2xl flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-white/[0.06] border border-white/[0.08] text-white/60">
                <MessageSquare className="w-4 h-4" />
              </div>
              <div>
                <span className="text-sm font-semibold text-white block">Allow Comments</span>
                <span className="text-xs text-white/50">Let other spotters discuss this car</span>
              </div>
            </div>

            <button
              onClick={() => setAllowComments(!allowComments)}
              className={`w-11 h-6 rounded-full transition-colors relative ${
                allowComments ? 'bg-[#E50914]' : 'bg-white/20'
              }`}
            >
              <div className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-all ${
                allowComments ? 'left-6' : 'left-1'
              }`} />
            </button>
          </div>
        </div>
      </div>

      {/* FOOTER ACTIONS */}
      <div className="sticky bottom-0 bg-black/95 backdrop-blur-md p-4 border-t border-white/[0.08] max-w-md mx-auto w-full space-y-2 pb-safe">
        <button
          onClick={() => handlePost(true)}
          disabled={uploadState !== 'idle'}
          className="w-full py-3.5 rounded-2xl bg-[#E50914] hover:bg-[#DC2626] text-white font-semibold text-base tracking-tight transition-colors disabled:opacity-50 shadow-lg"
        >
          {uploadState === 'uploading' ? 'Publishing...' : 'Publish Spot'}
        </button>

        <button
          onClick={() => handlePost(false)}
          disabled={uploadState !== 'idle'}
          className="w-full py-3 rounded-2xl bg-[#181818] hover:bg-[#222222] border border-white/[0.08] text-white/70 hover:text-white font-medium text-sm transition-colors disabled:opacity-50"
        >
          Save to Private Garage Only
        </button>
      </div>
    </motion.div>
  );
};
