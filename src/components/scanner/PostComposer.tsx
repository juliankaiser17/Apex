import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, MapPin, MessageSquare, Flame, Check } from 'lucide-react';
import type { CarCard } from '../../types/apex';
import { RARITY_CONFIG } from '../../utils/rarity';
import { useApexStore } from '../../store/useApexStore';
import { sounds } from '../../utils/audio';

interface PostComposerProps {
  card: CarCard;
  onBack: () => void;
  onPostComplete: () => void;
}

export const PostComposer: React.FC<PostComposerProps> = ({ card, onBack, onPostComplete }) => {
  const { addCardToGarage, triggerMockHunt, setActiveTab } = useApexStore();
  
  const [caption, setCaption] = useState('');
  const [showLocation, setShowLocation] = useState(true);
  const [allowComments, setAllowComments] = useState(true);
  
  // Default ON for Rare+, OFF for Uncommon. (Row hidden for Common)
  const isEligibleForHunt = card.rarity !== 'common';
  const initialStartHunt = card.rarity === 'rare' || card.rarity === 'epic' || card.rarity === 'legendary' || card.rarity === 'mythic';
  const [startHunt, setStartHunt] = useState(initialStartHunt);

  const [uploadState, setUploadState] = useState<'idle' | 'uploading' | 'success'>('idle');

  const rarityConf = RARITY_CONFIG[card.rarity];
  const charCount = caption.length;
  const remainingChars = 280 - charCount;

  const handlePost = async () => {
    if (uploadState !== 'idle') return;

    sounds.playTargetLock();
    setUploadState('uploading');

    // Simulate upload delay
    setTimeout(() => {
      setUploadState('success');
      sounds.playXpPop();

      // Trigger hunt if enabled
      if (isEligibleForHunt && startHunt) {
        triggerMockHunt(card);
      }

      // Add to store/garage & feed
      addCardToGarage({
        ...card,
        isPublic: showLocation,
        privacyLevel: showLocation ? 'public_blurred' : 'no_hunt_private'
      }, caption);

      setTimeout(() => {
        onPostComplete();
        setActiveTab('social');
      }, 700);
    }, 1200);
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="fixed inset-0 z-50 bg-[#080808] flex flex-col justify-between overflow-y-auto select-none"
      style={{ fontFamily: 'DM Sans' }}
    >
      <div>
        {/* HEADER BAR */}
        <div className="sticky top-0 z-40 bg-[#080808]/95 backdrop-blur-md px-5 h-14 flex items-center justify-between border-b border-[#2C2C2C]">
          <button 
            onClick={onBack}
            className="p-2 -ml-2 text-[#F0EBE3]/80 hover:text-[#F0EBE3] transition-colors"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>

          <h2 className="font-display text-2xl tracking-wider text-[#F0EBE3]">
            NEW SPOT
          </h2>

          <button
            onClick={handlePost}
            disabled={uploadState !== 'idle'}
            className={`text-sm font-semibold transition-opacity ${
              uploadState !== 'idle' ? 'opacity-40 text-[#5A5550]' : 'text-[#FF4500] hover:text-[#FF6A00]'
            }`}
          >
            POST
          </button>
        </div>

        {/* PHOTO PREVIEW (Full width, 220px height) */}
        <div className="relative w-full h-[220px] bg-[#111111] overflow-hidden">
          <img 
            src={card.imageUrl} 
            alt={`${card.make} ${card.model}`}
            className="w-full h-full object-cover"
          />

          {/* Overlaid bottom-left: Rarity badge pill */}
          <div className="absolute bottom-3 left-4">
            <span 
              style={{ backgroundColor: rarityConf.color }}
              className="px-2.5 py-1 rounded-[4px] font-display text-[11px] text-[#F0EBE3] uppercase tracking-wider font-bold shadow-lg"
            >
              {rarityConf.label}
            </span>
          </div>

          {/* Overlaid bottom-right: Car name pill */}
          <div className="absolute bottom-3 right-4 bg-[#080808]/80 backdrop-blur-md px-2.5 py-1 rounded-[4px]">
            <span className="text-[12px] font-semibold text-[#F0EBE3]">
              {card.make} {card.model}
            </span>
          </div>
        </div>

        {/* CAPTION FIELD */}
        <div className="bg-[#111111] border-t border-b border-[#2C2C2C] px-5 py-3.5 relative">
          <textarea
            value={caption}
            onChange={(e) => setCaption(e.target.value.slice(0, 280))}
            placeholder="Say something about this find..."
            rows={3}
            className="w-full bg-transparent text-[#F0EBE3] text-[15px] placeholder-[#5A5550] outline-none resize-none"
          />
          
          {/* Character counter */}
          {charCount > 220 && (
            <div className="text-right text-[11px] font-data font-semibold">
              <span className={remainingChars < 20 ? 'text-[#FF3B30]' : 'text-[#9A9088]'}>
                {remainingChars}
              </span>
            </div>
          )}
        </div>

        {/* SECTION DIVIDER */}
        <div className="px-5 py-3 text-[10px] font-medium tracking-[3px] text-[#5A5550] border-b border-[#2C2C2C]/50">
          SETTINGS
        </div>

        {/* TOGGLE ROWS */}
        <div className="divide-y divide-[#2C2C2C]/50">
          {/* ROW 1 — SHOW LOCATION */}
          <div className="h-[60px] px-5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <MapPin className="w-5 h-5 text-[#FF4500]" />
              <div>
                <div className="text-[15px] font-semibold text-[#F0EBE3]">Show Location</div>
                <div className="text-[12px] text-[#9A9088]">Your city will appear on the post</div>
              </div>
            </div>

            {/* Custom Toggle */}
            <button
              type="button"
              onClick={() => {
                sounds.playTargetLock();
                setShowLocation(!showLocation);
              }}
              className={`w-[44px] h-[26px] rounded-full p-[2px] transition-colors duration-200 ${
                showLocation ? 'bg-[#FF4500]' : 'bg-[#2C2C2C]'
              }`}
            >
              <div 
                className={`w-[22px] h-[22px] rounded-full bg-[#F0EBE3] shadow-md transform transition-transform duration-200 ${
                  showLocation ? 'translate-x-[18px]' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* ROW 2 — ALLOW COMMENTS */}
          <div className="h-[60px] px-5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <MessageSquare className="w-5 h-5 text-[#FF4500]" />
              <div>
                <div className="text-[15px] font-semibold text-[#F0EBE3]">Allow Comments</div>
                <div className="text-[12px] text-[#9A9088]">Let the community comment on your spot</div>
              </div>
            </div>

            {/* Custom Toggle */}
            <button
              type="button"
              onClick={() => {
                sounds.playTargetLock();
                setAllowComments(!allowComments);
              }}
              className={`w-[44px] h-[26px] rounded-full p-[2px] transition-colors duration-200 ${
                allowComments ? 'bg-[#FF4500]' : 'bg-[#2C2C2C]'
              }`}
            >
              <div 
                className={`w-[22px] h-[22px] rounded-full bg-[#F0EBE3] shadow-md transform transition-transform duration-200 ${
                  allowComments ? 'translate-x-[18px]' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* ROW 3 — START A HUNT (Only shown if Uncommon or higher) */}
          {isEligibleForHunt && (
            <div className="px-5 transition-all">
              <div className="h-[60px] flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Flame className={`w-5 h-5 ${startHunt ? 'text-[#FF4500] animate-pulse' : 'text-[#383838]'}`} />
                  <div>
                    <div className="text-[15px] font-semibold text-[#F0EBE3]">Start a Hunt</div>
                    <div className="text-[12px] text-[#9A9088]">
                      Nearby spotters race to find this car{' '}
                      <span style={{ color: rarityConf.color }} className="font-semibold uppercase">
                        {rarityConf.label}
                      </span>{' '}
                      tier
                    </div>
                  </div>
                </div>

                {/* Custom Toggle */}
                <button
                  type="button"
                  onClick={() => {
                    sounds.playTargetLock();
                    setStartHunt(!startHunt);
                  }}
                  className={`w-[44px] h-[26px] rounded-full p-[2px] transition-colors duration-200 ${
                    startHunt ? 'bg-[#FF4500]' : 'bg-[#2C2C2C]'
                  }`}
                >
                  <div 
                    className={`w-[22px] h-[22px] rounded-full bg-[#F0EBE3] shadow-md transform transition-transform duration-200 ${
                      startHunt ? 'translate-x-[18px]' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Sub-card when toggled ON */}
              <AnimatePresence>
                {startHunt && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mb-3 p-3 rounded-lg bg-[#FF4500]/10 border border-[#FF4500]/25 text-[12px] text-[#9A9088] leading-relaxed"
                  >
                    🔥 5-minute hunt starts automatically when you post this spot. Nearby spotters will receive a hunt notification.
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>

        {/* INFO BANNER (When Show Location is ON) */}
        {showLocation && (
          <div className="mx-5 mt-4 p-3 rounded-r-md bg-[#FFA500]/10 border-l-3 border-[#FFA500] text-[12px] text-[#9A9088] leading-relaxed">
            📍 Location appears as city name only. Your exact GPS is never stored.
          </div>
        )}
      </div>

      {/* POST BUTTON (Sticky bottom) */}
      <div className="p-5 bg-[#080808] border-t border-[#2C2C2C]/50">
        <motion.button
          onClick={handlePost}
          disabled={uploadState !== 'idle'}
          whileTap={{ scale: 0.97 }}
          className={`w-full h-14 rounded-xl font-display text-[22px] tracking-widest text-[#F0EBE3] relative overflow-hidden transition-colors ${
            uploadState === 'success' 
              ? 'bg-[#2ECC71]' 
              : 'bg-[#FF4500] glow-orange'
          }`}
        >
          {uploadState === 'idle' && 'POST SPOT'}

          {uploadState === 'uploading' && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-3/5 h-0.5 bg-[#F0EBE3]/30 overflow-hidden rounded-full relative">
                <motion.div 
                  animate={{ x: ['-100%', '200%'] }}
                  transition={{ duration: 1.0, repeat: Infinity, ease: 'easeInOut' }}
                  className="w-1/3 h-full bg-[#F0EBE3] rounded-full"
                />
              </div>
            </div>
          )}

          {uploadState === 'success' && (
            <motion.div 
              initial={{ scale: 0 }} 
              animate={{ scale: [0, 1.2, 1] }} 
              className="flex items-center justify-center gap-2 text-[#F0EBE3]"
            >
              <Check className="w-6 h-6 stroke-[3]" /> SPOTTED!
            </motion.div>
          )}
        </motion.button>
      </div>
    </motion.div>
  );
};
