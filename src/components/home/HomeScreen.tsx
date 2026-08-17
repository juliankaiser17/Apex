import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Camera, ChevronRight, Zap, Trophy, ShieldAlert, CheckCircle2, Clock, AlertCircle, Eye } from 'lucide-react';
import { useApexStore, GLOBAL_QUEST_EXPIRES_AT, GLOBAL_EVENT_EXPIRES_AT } from '../../store/useApexStore';
import { RARITY_CONFIG } from '../../utils/rarity';
import type { Mission } from '../../types/apex';

// Persistent Real-World Live Countdown Timer Component
const LiveCountdownTimer: React.FC<{ targetTimestamp: number; className?: string }> = ({ targetTimestamp, className }) => {
  const getSecondsRemaining = () => Math.max(0, Math.floor((targetTimestamp - Date.now()) / 1000));
  const [timeLeft, setTimeLeft] = useState(getSecondsRemaining());

  useEffect(() => {
    setTimeLeft(getSecondsRemaining());
    const timer = setInterval(() => {
      setTimeLeft(getSecondsRemaining());
    }, 1000);

    return () => clearInterval(timer);
  }, [targetTimestamp]);

  const hours = Math.floor(timeLeft / 3600);
  const minutes = Math.floor((timeLeft % 3600) / 60);
  const seconds = timeLeft % 60;

  return (
    <span className={className}>
      {hours > 0 ? `${hours}h ` : ''}{minutes}m {seconds < 10 ? '0' : ''}{seconds}s
    </span>
  );
};

export const HomeScreen: React.FC = () => {
  const { 
    user, 
    dailyQuests, 
    dailyMissions, 
    leaderboards, 
    setScannerOpen, 
    setActiveTab, 
    completeMission,
    garage,
    feedPosts,
    liveEventExpiresAt,
    setSelectedCardForDetail
  } = useApexStore();

  const [selectedMissionForProof, setSelectedMissionForProof] = useState<Mission | null>(null);
  const [questExpanded, setQuestExpanded] = useState(false);

  const activeQuest = dailyQuests[0];

  const handleMissionCheckboxClick = (m: Mission) => {
    if (m.completed) return;

    if (m.type === 'login') {
      completeMission(m.id);
    } else {
      setSelectedMissionForProof(m);
    }
  };

  const handleVerifyWithGarage = () => {
    if (selectedMissionForProof) {
      completeMission(selectedMissionForProof.id);
      setSelectedMissionForProof(null);
    }
  };


  return (
    <div className="relative flex-1 select-none" style={{ fontFamily: 'DM Sans' }}>
      {/* Layer 0: Telemetry Radar Background Grid */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none opacity-20">
        <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <radialGradient id="radarGlow" cx="50%" cy="40%" r="50%">
              <stop offset="0%" stopColor="#FF4500" stopOpacity="0.25" />
              <stop offset="60%" stopColor="#FF4500" stopOpacity="0.05" />
              <stop offset="100%" stopColor="#080808" stopOpacity="0" />
            </radialGradient>
            <pattern id="dotGrid" width="24" height="24" patternUnits="userSpaceOnUse">
              <circle cx="2" cy="2" r="1" fill="#FFFFFF" fillOpacity="0.1" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#dotGrid)" />
          <circle cx="50%" cy="30%" r="280" fill="url(#radarGlow)" />
          <circle cx="50%" cy="30%" r="90" fill="none" stroke="#FF4500" strokeWidth="1" strokeDasharray="3 3" opacity="0.4" />
          <circle cx="50%" cy="30%" r="180" fill="none" stroke="#FF4500" strokeWidth="1" strokeDasharray="4 6" opacity="0.3" />
          <circle cx="50%" cy="30%" r="270" fill="none" stroke="#FF4500" strokeWidth="1" opacity="0.2" />
        </svg>
      </div>

      {/* Layer 1: HUD Content */}
      <div className="relative z-10 pb-36 px-4 pt-3 space-y-4 max-w-lg mx-auto">
        {/* 1. Daily Quest Card (Collapsible, left ignition accent bar) */}
        {activeQuest && (
          <motion.div 
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#111111]/90 backdrop-blur-xl transition-all shadow-[0_8px_30px_rgba(0,0,0,0.6)]"
          >
            {/* Left ignition bar */}
            <div className="absolute left-0 top-0 bottom-0 w-[4px] bg-gradient-to-b from-[#FF2200] via-[#FF4500] to-[#FFA500]" />

            <div className="p-4 pl-5">
              <div 
                className="flex items-center justify-between cursor-pointer" 
                onClick={() => setQuestExpanded(!questExpanded)}
              >
                <div className="flex items-center gap-2">
                  <div className="p-1 rounded-md bg-[#FF4500]/10 border border-[#FF4500]/30">
                    <Zap className="w-3.5 h-3.5 text-[#FF4500]" />
                  </div>
                  <span className="font-display text-sm tracking-widest text-[#F0EBE3]">DAILY SPOTLIGHT</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5 bg-[#171717] px-2.5 py-1 rounded-lg border border-white/10 shadow-inner">
                    <Clock className="w-3 h-3 text-[#FF4500]" />
                    <LiveCountdownTimer 
                      targetTimestamp={activeQuest.expiresAtTimestamp || GLOBAL_QUEST_EXPIRES_AT} 
                      className="text-[#FF4500] font-data text-xs font-bold" 
                    />
                  </div>
                </div>
              </div>

              <h3 className="font-display text-2xl text-[#F0EBE3] tracking-wide mt-2">{activeQuest.title}</h3>
              
              {/* Progress bar */}
              <div className="space-y-1.5 my-3">
                <div className="flex justify-between text-xs font-data">
                  <span className="text-[#9A9088]">Progress</span>
                  <span className="text-[#FF4500] font-bold">{activeQuest.currentCount} / {activeQuest.targetCount} spotted</span>
                </div>
                <div className="h-2 bg-[#1A1A1A] rounded-full overflow-hidden border border-white/5 shadow-inner">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${(activeQuest.currentCount / activeQuest.targetCount) * 100}%` }}
                    transition={{ duration: 0.8, ease: 'easeOut' }}
                    className="h-full bg-gradient-to-r from-[#FF2200] via-[#FF4500] to-[#FFA500] rounded-full shadow-[0_0_8px_#FF4500]"
                  />
                </div>
              </div>

              {/* Collapsed vs Expanded details */}
              {questExpanded && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="space-y-3 pt-2 border-t border-white/10">
                  <p className="text-xs text-[#9A9088] leading-relaxed">{activeQuest.description}</p>
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-xs font-data font-bold text-[#FFA500] bg-[#FFA500]/10 px-2.5 py-1 rounded-md border border-[#FFA500]/30">
                      +{activeQuest.xpReward} XP · +{activeQuest.coinReward} Coins
                    </span>
                    <button 
                      onClick={() => setScannerOpen(true)}
                      className="text-xs font-display tracking-wider text-[#F0EBE3] bg-[#FF4500] hover:bg-[#FF6A00] px-3.5 py-1.5 rounded-xl transition-all shadow-[0_0_12px_rgba(255,69,0,0.4)]"
                    >
                      SCAN NOW →
                    </button>
                  </div>
                </motion.div>
              )}
            </div>
          </motion.div>
        )}

        {/* 2. Primary Scan CTA Button */}
        <div className="flex justify-center py-1">
          <motion.button
            onClick={() => setScannerOpen(true)}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.96 }}
            className="relative group w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-[#FF2200] via-[#FF4500] to-[#FF6A00] text-white font-display text-2xl tracking-wider shadow-[0_8px_28px_rgba(255,69,0,0.45)] flex items-center justify-center gap-3 border border-[#FF6A00]/50 overflow-hidden"
          >
            <Camera className="w-7 h-7 text-white group-hover:rotate-12 transition-transform" />
            <span>SCAN A CAR</span>
          </motion.button>
        </div>

      {/* 3. Near You Section (Rendered only when real posts exist) */}
      {feedPosts.length > 0 && (
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-lg text-[#F0EBE3] tracking-wide flex items-center gap-1.5">
              <span>NEAR YOU</span>
              <span className="text-xs font-data text-[#9A9088]">(within 3 km)</span>
            </h3>
            <button 
              onClick={() => setActiveTab('map')}
              className="text-xs font-semibold text-[#FF4500] hover:underline flex items-center gap-0.5"
            >
              See all on map <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2 -mx-4 px-4">
            {feedPosts.map((post) => {
              const rarityConf = RARITY_CONFIG[post.card.rarity];
              return (
                <div
                  key={post.id}
                  onClick={() => setActiveTab('social')}
                  className="flex-shrink-0 w-32 h-44 rounded-xl overflow-hidden relative border border-white/10 bg-[#111111] group cursor-pointer hover:border-[#FF4500]/60 transition-all"
                >
                  {/* Background Image */}
                  <img 
                    src={post.card.imageUrl} 
                    alt={post.card.model} 
                    className="absolute inset-0 w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#080808] via-[#080808]/40 to-transparent" />

                  {/* Top Rarity Badge */}
                  <div className="absolute top-2 left-2">
                    <span className={`text-[9px] font-data font-semibold px-1.5 py-0.5 rounded border ${rarityConf.badgeBg}`}>
                      {rarityConf.label}
                    </span>
                  </div>

                  {/* Bottom Info */}
                  <div className="absolute bottom-2 left-2 right-2">
                    <h4 className="font-display text-sm text-[#F0EBE3] leading-tight truncate">{post.card.make}</h4>
                    <p className="text-[11px] font-medium text-[#F0EBE3]/80 truncate">{post.card.model}</p>
                    <p className="text-[9px] text-[#9A9088] font-data mt-0.5">Spotted in {post.card.city}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 4. Daily Missions */}
      <div className="bg-[#111111] border border-white/10 rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-lg text-[#F0EBE3] tracking-wide">DAILY MISSIONS</h3>
          <span className="text-xs font-data text-[#9A9088]">
            {dailyMissions.filter(m => m.completed).length} / {dailyMissions.length} Complete
          </span>
        </div>

        <div className="space-y-2">
          {dailyMissions.map((m) => (
            <div
              key={m.id}
              onClick={() => handleMissionCheckboxClick(m)}
              className={`p-3 rounded-lg flex items-center justify-between border transition-all cursor-pointer ${
                m.completed 
                  ? 'bg-black/20 border-white/5 opacity-60' 
                  : 'bg-black/40 border-white/10 hover:border-[#FF4500]/50'
              }`}
            >
              <div className="flex items-center gap-3">
                {m.completed ? (
                  <CheckCircle2 className="w-5 h-5 text-[#2ECC71]" />
                ) : (
                  <div className="w-5 h-5 rounded-full border-2 border-[#5A5550] hover:border-[#FF4500] transition-colors" />
                )}
                <span className={`text-xs ${m.completed ? 'line-through text-[#9A9088]' : 'text-[#F0EBE3] font-medium'}`}>
                  {m.title}
                </span>
              </div>
              <span className="text-xs font-data font-semibold text-[#FF4500]">
                +{m.xpReward} XP
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* MISSION CAR PROOF REQUIRED MODAL */}
      <AnimatePresence>
        {selectedMissionForProof && (
          <div className="fixed inset-0 z-50 bg-[#080808]/90 flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-sm bg-[#111111] border border-[#FF4500]/50 rounded-xl p-6 space-y-5 text-center shadow-2xl"
            >
              <div className="w-14 h-14 rounded-full bg-[#1A1A1A] border border-[#FF4500] flex items-center justify-center text-[#FF4500] mx-auto shadow-lg">
                <AlertCircle className="w-7 h-7" />
              </div>

              <div className="space-y-1">
                <span className="text-[10px] font-data font-semibold text-[#FF4500] uppercase tracking-wider bg-[#1A1A1A] px-3 py-1 rounded-full border border-[#FF4500]/40">
                  CAR PROOF REQUIRED
                </span>
                <h3 className="font-display text-2xl text-[#F0EBE3] pt-2">{selectedMissionForProof.title}</h3>
                <p className="text-xs text-[#9A9088] leading-relaxed">
                  To claim this mission reward (+{selectedMissionForProof.xpReward} XP), please provide proof of a car spot!
                </p>
              </div>

              <div className="space-y-3 pt-2">
                <button
                  onClick={() => {
                    setSelectedMissionForProof(null);
                    setScannerOpen(true);
                  }}
                  className="w-full py-3.5 rounded-xl bg-[#FF4500] text-[#F0EBE3] font-display text-lg tracking-wider flex items-center justify-center gap-2 glow-orange"
                >
                  <Camera className="w-5 h-5" /> SCAN CAR PROOF NOW
                </button>

                {garage.length > 0 && (
                  <button
                    onClick={handleVerifyWithGarage}
                    className="w-full py-3 rounded-xl bg-[#1A1A1A] hover:bg-[#2C2C2C] text-[#F0EBE3] font-display text-sm tracking-wider flex items-center justify-center gap-2 border border-[#2C2C2C]"
                  >
                    <Eye className="w-4 h-4" /> VERIFY WITH GARAGE CARD
                  </button>
                )}

                <button
                  onClick={() => setSelectedMissionForProof(null)}
                  className="text-xs text-[#9A9088] hover:text-[#F0EBE3] pt-1"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 5. Live Event Banner */}
      <div className="p-4 rounded-xl bg-[#111111] border border-[#FFA500]/30 flex items-center gap-3 relative overflow-hidden">
        <div className="p-3 rounded-xl bg-black/60 text-[#FFA500] border border-[#FFA500]/30">
          <ShieldAlert className="w-6 h-6 animate-pulse" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-data font-semibold px-1.5 py-0.5 rounded bg-[#FFA500] text-[#080808]">LIVE EVENT</span>
            <span className="text-[11px] font-data text-[#FFA500] flex items-center gap-1">
              <LiveCountdownTimer 
                targetTimestamp={liveEventExpiresAt || GLOBAL_EVENT_EXPIRES_AT} 
                className="text-[#FFA500] font-data font-semibold" 
              /> remaining
            </span>
          </div>
          <h4 className="font-display text-lg text-[#F0EBE3] mt-0.5">Supercar Sunday</h4>
          <p className="text-xs text-[#9A9088]">Find supercars this weekend for 2× XP rewards.</p>
        </div>
      </div>

      {/* 5.5. Nearby Discoveries Strip */}
      {feedPosts.length > 0 && (
        <div className="bg-[#111111] border border-[#2C2C2C] rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-lg text-[#F0EBE3] tracking-wide flex items-center gap-1.5">
              <Eye className="w-4 h-4 text-[#FF4500]" />
              <span>NEARBY DISCOVERIES</span>
            </h3>
            <button 
              onClick={() => setActiveTab('social')}
              className="text-xs font-semibold text-[#FF4500] hover:underline"
            >
              View Feed →
            </button>
          </div>

          <div className="grid grid-cols-3 gap-2.5">
            {feedPosts.slice(0, 3).map((post) => {
              const rConf = RARITY_CONFIG[post.card.rarity];
              return (
                <motion.div
                  key={post.id}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setSelectedCardForDetail(post.card)}
                  className="group relative rounded-lg overflow-hidden bg-[#1A1A1A] border border-[#2C2C2C] cursor-pointer hover:border-[#FF4500]/60 transition-all flex flex-col"
                  style={{ borderTop: `2px solid ${rConf.color}` }}
                >
                  <div className="h-16 w-full overflow-hidden bg-[#080808]">
                    <img 
                      src={post.card.imageUrl} 
                      alt={post.card.model}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300" 
                    />
                  </div>
                  <div className="p-1.5 text-center bg-[#111111]">
                    <span 
                      style={{ color: rConf.color }} 
                      className="font-display text-[10px] tracking-wider uppercase block truncate"
                    >
                      {rConf.label}
                    </span>
                    <span className="text-[10px] text-[#F0EBE3] font-data font-semibold block truncate leading-tight">
                      {post.card.make}
                    </span>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}

      {/* 6. City Leaderboard Peek */}
      <div className="bg-[#111111] border border-[#2C2C2C] rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-lg text-[#F0EBE3] tracking-wide flex items-center gap-1.5">
            <Trophy className="w-4 h-4 text-[#FFA500]" />
            <span>CITY LEADERBOARD</span>
          </h3>
          <button 
            onClick={() => setActiveTab('social')}
            className="text-xs font-semibold text-[#FF4500] hover:underline"
          >
            Full Leaderboard →
          </button>
        </div>

        <div className="space-y-2">
          {leaderboards.slice(0, 4).map((entry) => {
            const isMe = entry.username === user.username;
            return (
              <div
                key={entry.username}
                className={`p-3 rounded-lg flex items-center justify-between border ${
                  isMe 
                    ? 'bg-[#1A1A1A] border-[#FF4500]/50 glow-orange' 
                    : 'bg-[#1A1A1A]/60 border-[#2C2C2C]'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className={`font-display text-lg ${entry.rank <= 3 ? 'text-[#FFA500]' : 'text-[#9A9088]'}`}>
                    #{entry.rank}
                  </span>
                  <img src={entry.avatarUrl} alt={entry.displayName} className="w-8 h-8 rounded-full border border-[#2C2C2C] object-cover" />
                  <div>
                    <h4 className="text-xs font-semibold text-[#F0EBE3]">{entry.displayName}</h4>
                    <p className="text-[10px] text-[#9A9088] font-data">Level {entry.level}</p>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-xs font-data font-semibold text-[#FF4500]">{entry.xp.toLocaleString()} XP</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      </div>
    </div>
  );
};
