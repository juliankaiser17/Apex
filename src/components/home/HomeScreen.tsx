import React, { useState, useEffect, memo, useMemo } from 'react';
import { 
  Camera, 
  ChevronRight, 
  CheckCircle2, 
  Clock, 
  Flame,
  Sparkles
} from 'lucide-react';
import { useApexStore, GLOBAL_QUEST_EXPIRES_AT } from '../../store/useApexStore';
import { RARITY_CONFIG } from '../../utils/rarity';
import type { Mission } from '../../types/apex';
import { sounds } from '../../utils/audio';
import { getOptimizedImageUrl } from '../../utils/imageUrl';
import { hapticTap, hapticImpact, hapticSuccess } from '../../utils/haptics';
import { getProgressToNextLevel } from '../../utils/mastery';
import { MasteryTierModal } from './MasteryTierModal';

// Isolated, High-Performance Micro-Countdown Component (Prevents Root Page Re-rendering)
const LiveCountdownTimer = memo(({ targetTimestamp, className }: { targetTimestamp: number; className?: string }) => {
  const [secondsRemaining, setSecondsRemaining] = useState(() => 
    Math.max(0, Math.floor((targetTimestamp - Date.now()) / 1000))
  );

  useEffect(() => {
    const timer = setInterval(() => {
      const remaining = Math.max(0, Math.floor((targetTimestamp - Date.now()) / 1000));
      setSecondsRemaining(remaining);
      if (remaining <= 0) clearInterval(timer);
    }, 1000);

    return () => clearInterval(timer);
  }, [targetTimestamp]);

  const hours = Math.floor(secondsRemaining / 3600);
  const minutes = Math.floor((secondsRemaining % 3600) / 60);
  const seconds = secondsRemaining % 60;

  return (
    <span className={className}>
      {hours > 0 ? `${hours}h ` : ''}{minutes}m {seconds < 10 ? '0' : ''}{seconds}s
    </span>
  );
});

LiveCountdownTimer.displayName = 'LiveCountdownTimer';

export const HomeScreen: React.FC = () => {
  const dailyQuests = useApexStore(s => s.dailyQuests);
  const dailyMissions = useApexStore(s => s.dailyMissions);
  const setScannerOpen = useApexStore(s => s.setScannerOpen);
  const setActiveTab = useApexStore(s => s.setActiveTab);
  const completeMission = useApexStore(s => s.completeMission);
  const feedPosts = useApexStore(s => s.feedPosts);
  const userLevel = useApexStore(s => s.user.level);
  const userXp = useApexStore(s => s.user.xp);
  const userStreakDays = useApexStore(s => s.user.streakDays);

  const [activeTabSection, setActiveTabSection] = useState<'quests' | 'missions'>('quests');
  const [isTierModalOpen, setIsTierModalOpen] = useState(false);
  const activeQuest = dailyQuests[0];
  const sideQuests = dailyQuests.slice(1);

  const { level, tierConfig, percentage } = useMemo(() => {
    return getProgressToNextLevel(userLevel, userXp);
  }, [userLevel, userXp]);

  const handleMissionClick = (m: Mission) => {
    if (m.completed) return;
    hapticSuccess();
    sounds.playTargetLock();
    completeMission(m.id);
  };

  return (
    <div className="relative flex-1 w-full bg-black font-sans pb-36 px-4 pt-3 space-y-4 max-w-lg mx-auto">
      
      {/* ─── 0. SPATIAL DRIVER COCKPIT TELEMETRY ─── */}
      <div 
        onClick={() => {
          hapticTap();
          sounds.playTargetLock();
          setIsTierModalOpen(true);
        }}
        className="glass-card-spatial rounded-3xl p-4 relative overflow-hidden shadow-2xl cursor-pointer group hover:border-white/20 active:scale-[0.99] transition-all"
        title="Tap to view Driver Mastery & Tier Roadmap"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div 
              className="w-10 h-10 rounded-2xl flex items-center justify-center font-extrabold text-sm text-white shadow-lg border border-white/20 group-hover:scale-105 transition-transform"
              style={{
                background: 'linear-gradient(135deg, var(--accent-color) 0%, #111111 100%)',
                boxShadow: '0 4px 14px var(--accent-glow)'
              }}
            >
              L{level}
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold uppercase tracking-wider text-white">
                  {tierConfig?.label || 'Apex Hunter'}
                </span>
                <Sparkles className="w-3 h-3 text-yellow-400" />
              </div>
              <p className="text-[10px] text-white/50 font-data">
                {userXp.toLocaleString()} XP Total
              </p>
            </div>
          </div>

          {/* Daily Streak Pill */}
          <div 
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-white/10 bg-white/[0.04] backdrop-blur-md"
          >
            <Flame className="w-4 h-4 text-orange-400 fill-orange-400" />
            <span className="text-xs font-extrabold text-white font-data">
              {userStreakDays || 1} DAY STREAK
            </span>
          </div>
        </div>

        {/* Level XP Progress Bar */}
        <div className="mt-3.5 space-y-1">
          <div className="flex justify-between text-[10px] font-data text-white/50">
            <span className="flex items-center gap-1 group-hover:text-white/80 transition-colors">
              TIER PROGRESS <ChevronRight className="w-3 h-3 text-white/40 group-hover:text-white/80 transition-colors" />
            </span>
            <span className="text-white/80 font-bold">{Math.round(percentage)}%</span>
          </div>
          <div className="h-1.5 bg-white/[0.08] rounded-full overflow-hidden">
            <div 
              style={{ 
                width: `${Math.min(100, percentage)}%`,
                backgroundColor: 'var(--accent-color)',
                boxShadow: '0 0 8px var(--accent-color)'
              }}
              className="h-full rounded-full transition-all duration-500"
            />
          </div>
        </div>
      </div>

      {/* ─── 1. HERO SPOTLIGHT & INSTANT SCAN BANNER ─── */}
      <div className="relative overflow-hidden rounded-3xl border border-white/[0.12] bg-gradient-to-b from-[#1e1515] via-[#141414] to-[#0e0e0e] p-5 shadow-2xl space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span 
              className="px-2.5 py-0.5 rounded-full text-white text-[10px] font-bold tracking-wider uppercase shadow-md flex items-center gap-1"
              style={{ backgroundColor: 'var(--accent-color)' }}
            >
              <Flame className="w-3 h-3 fill-current" /> DAILY SPOTLIGHT
            </span>
          </div>

          <div 
            className="flex items-center gap-1.5 bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-full border border-white/10 text-xs font-semibold"
            style={{ color: 'var(--accent-color)' }}
          >
            <Clock className="w-3.5 h-3.5" />
            <LiveCountdownTimer 
              targetTimestamp={activeQuest?.expiresAtTimestamp || GLOBAL_QUEST_EXPIRES_AT} 
              className="font-data text-[11px]" 
            />
          </div>
        </div>

        <div>
          <h2 className="text-xl font-extrabold text-white tracking-tight">
            {activeQuest ? activeQuest.title : 'Spot a Rare Supercar'}
          </h2>
          <p className="text-xs text-white/65 mt-1 leading-relaxed">
            {activeQuest ? activeQuest.description : 'Scan street vehicles to earn bonus XP and unlock mastery badges.'}
          </p>
        </div>

        {/* Progress bar */}
        {activeQuest && (
          <div className="space-y-1.5 pt-1">
            <div className="flex justify-between text-xs font-data">
              <span className="text-white/50 text-[11px]">TARGET PROGRESS</span>
              <span className="font-bold" style={{ color: 'var(--accent-color)' }}>
                {activeQuest.currentCount} / {activeQuest.targetCount} SPOTTED
              </span>
            </div>
            <div className="h-2 bg-white/[0.08] rounded-full overflow-hidden">
              <div 
                style={{ 
                  width: `${Math.min(100, (activeQuest.currentCount / activeQuest.targetCount) * 100)}%`,
                  backgroundColor: 'var(--accent-color)',
                  boxShadow: '0 0 10px var(--accent-color)'
                }}
                className="h-full rounded-full transition-all duration-500"
              />
            </div>
          </div>
        )}

        {/* Primary Action Button */}
        <button
          onClick={() => {
            hapticImpact('medium');
            sounds.playTargetLock();
            setScannerOpen(true);
          }}
          className="w-full py-3.5 px-5 rounded-2xl active:scale-[0.98] text-white font-bold text-base tracking-wide flex items-center justify-center gap-2.5 transition-all shadow-xl border border-white/10 cursor-pointer"
          style={{
            backgroundColor: 'var(--accent-color)',
            boxShadow: '0 6px 24px var(--accent-glow)'
          }}
        >
          <Camera className="w-5 h-5" />
          <span>OPEN AI SCANNER</span>
        </button>
      </div>

      {/* ─── 2. RECENT NEARBY SPOTS CAROUSEL ─── */}
      {feedPosts.length > 0 && (
        <div className="space-y-2.5">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <div 
                className="w-1.5 h-4 rounded-full" 
                style={{ backgroundColor: 'var(--accent-color)', boxShadow: '0 0 6px var(--accent-color)' }}
              />
              <h3 className="text-sm font-bold text-white tracking-tight uppercase">
                Nearby Discoveries
              </h3>
            </div>
            <button 
              onClick={() => {
                hapticTap();
                sounds.playTargetLock();
                setActiveTab('map');
              }}
              className="text-xs font-semibold flex items-center gap-1 transition-colors active:scale-95 cursor-pointer"
              style={{ color: 'var(--accent-color)' }}
            >
              Map Radar <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1 -mx-4 px-4 scroll-smooth-mobile">
            {feedPosts.slice(0, 6).map((post) => {
              const rarity = post.card?.rarity || 'common';
              const rarityConf = RARITY_CONFIG[rarity] || RARITY_CONFIG.rare;
              const mediaImg = post.card?.imageUrl || post.thumbnailUrl || post.mediaUrl || '';
              const optimizedThumbnail = mediaImg ? getOptimizedImageUrl(mediaImg, 'thumbnail') : '';
              const title = post.card?.model || post.caption || 'Apex Discovery';
              const subtitle = post.card?.make || `@${post.user.username}`;
              const location = post.card?.city || 'Nearby';
              return (
                <div
                  key={post.id}
                  onClick={() => {
                    hapticTap();
                    sounds.playTargetLock();
                    setActiveTab('social');
                  }}
                  className="flex-shrink-0 w-32 h-44 rounded-2xl overflow-hidden relative border border-white/[0.09] bg-[#121212] group cursor-pointer hover:border-white/[0.25] active:scale-95 transition-all shadow-xl"
                >
                  <img 
                    src={optimizedThumbnail} 
                    alt={title} 
                    loading="lazy"
                    decoding="async"
                    className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />

                  <div className="absolute top-2 left-2">
                    <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full border shadow ${rarityConf.badgeBg}`}>
                      {rarityConf.label}
                    </span>
                  </div>

                  <div className="absolute bottom-2 left-2 right-2">
                    <span className="text-[9px] font-semibold text-white/60 block truncate">{subtitle}</span>
                    <h4 className="text-xs font-bold text-white leading-tight truncate">{title}</h4>
                    <p className="text-[9px] text-white/40 font-data mt-0.5">{location}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ─── 3. CLEAN SEGMENTED PROGRESS (QUESTS & MISSIONS) ─── */}
      <div className="glass-panel rounded-3xl p-4 space-y-3.5 shadow-xl">
        {/* Segmented Switcher Header */}
        <div className="flex items-center justify-between pb-1 border-b border-white/[0.06]">
          <div className="flex bg-black/40 p-1 rounded-2xl border border-white/[0.08] backdrop-blur-md">
            <button
              onClick={() => { 
                hapticTap();
                sounds.playTargetLock(); 
                setActiveTabSection('quests'); 
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                activeTabSection === 'quests' 
                  ? 'text-white shadow-lg' 
                  : 'text-white/50 hover:text-white'
              }`}
              style={activeTabSection === 'quests' ? { backgroundColor: 'var(--accent-color)' } : undefined}
            >
              Side Quests ({sideQuests.length})
            </button>
            <button
              onClick={() => { 
                hapticTap();
                sounds.playTargetLock(); 
                setActiveTabSection('missions'); 
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                activeTabSection === 'missions' 
                  ? 'text-white shadow-lg' 
                  : 'text-white/50 hover:text-white'
              }`}
              style={activeTabSection === 'missions' ? { backgroundColor: 'var(--accent-color)' } : undefined}
            >
              Daily Missions ({dailyMissions.filter(m => m.completed).length}/{dailyMissions.length})
            </button>
          </div>
        </div>

        {/* Section 1: Side Quests */}
        {activeTabSection === 'quests' && (
          <div className="space-y-2">
            {sideQuests.length > 0 ? (
              sideQuests.map((quest) => {
                const pct = Math.min(100, (quest.currentCount / quest.targetCount) * 100);
                return (
                  <div 
                    key={quest.id} 
                    className={`p-3 rounded-2xl border transition-all ${
                      quest.isCompleted 
                        ? 'bg-white/[0.02] border-white/[0.04] opacity-50' 
                        : 'bg-[#181818]/90 border-white/[0.08] hover:border-white/[0.16]'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-xs font-bold text-white">{quest.title}</h4>
                        <p className="text-[11px] text-white/50 mt-0.5">{quest.description}</p>
                      </div>
                      <span 
                        className="text-xs font-bold shrink-0 ml-2 font-data"
                        style={{ color: 'var(--accent-color)' }}
                      >
                        +{quest.xpReward} XP
                      </span>
                    </div>

                    <div className="mt-2 space-y-1">
                      <div className="flex justify-between text-[10px] text-white/40 font-data">
                        <span>PROGRESS</span>
                        <span>{quest.currentCount} / {quest.targetCount}</span>
                      </div>
                      <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                        <div 
                          style={{ 
                            width: `${pct}%`,
                            backgroundColor: quest.isCompleted ? 'rgba(255,255,255,0.4)' : 'var(--accent-color)'
                          }} 
                          className="h-full rounded-full transition-all duration-300" 
                        />
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <p className="text-xs text-white/40 text-center py-4">All quests completed for today!</p>
            )}
          </div>
        )}

        {/* Section 2: Daily Missions */}
        {activeTabSection === 'missions' && (
          <div className="space-y-2">
            {dailyMissions.map((m) => (
              <div
                key={m.id}
                onClick={() => handleMissionClick(m)}
                className={`p-3 rounded-2xl flex items-center justify-between border transition-all cursor-pointer ${
                  m.completed 
                    ? 'bg-white/[0.02] border-white/[0.04] opacity-50' 
                    : 'bg-[#181818]/90 border-white/[0.08] hover:border-white/[0.2] active:scale-[0.99]'
                }`}
              >
                <div className="flex items-center gap-3">
                  {m.completed ? (
                    <CheckCircle2 className="w-4 h-4 text-[#2ECC71]" />
                  ) : (
                    <div className="w-4 h-4 rounded-full border border-white/30 transition-colors" />
                  )}
                  <span className={`text-xs ${m.completed ? 'line-through text-white/40' : 'text-white/90 font-semibold'}`}>
                    {m.title}
                  </span>
                </div>
                <span 
                  className="text-xs font-bold font-data"
                  style={{ color: 'var(--accent-color)' }}
                >
                  +{m.xpReward} XP
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Driver Mastery & Tier Progression Roadmap Modal */}
      <MasteryTierModal 
        isOpen={isTierModalOpen} 
        onClose={() => setIsTierModalOpen(false)} 
      />
    </div>
  );
};
