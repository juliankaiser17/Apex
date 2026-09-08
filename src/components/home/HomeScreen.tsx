import React, { useState, useEffect, memo } from 'react';
import { 
  Camera, 
  ChevronRight, 
  CheckCircle2, 
  Clock, 
  Flame
} from 'lucide-react';
import { useApexStore, GLOBAL_QUEST_EXPIRES_AT } from '../../store/useApexStore';
import { RARITY_CONFIG } from '../../utils/rarity';
import type { Mission } from '../../types/apex';
import { sounds } from '../../utils/audio';
import { getOptimizedImageUrl } from '../../utils/imageUrl';

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

  const [activeTabSection, setActiveTabSection] = useState<'quests' | 'missions'>('quests');
  const activeQuest = dailyQuests[0];
  const sideQuests = dailyQuests.slice(1);

  const handleMissionClick = (m: Mission) => {
    if (m.completed) return;
    sounds.playTargetLock();
    completeMission(m.id);
  };

  return (
    <div className="relative flex-1 w-full bg-black font-sans pb-36 px-4 pt-3 space-y-4 max-w-lg mx-auto">
      {/* ─── 1. HERO SPOTLIGHT & INSTANT SCAN BANNER ─── */}
      <div className="relative overflow-hidden rounded-3xl border border-white/[0.12] bg-gradient-to-b from-[#1c1414] to-[#121212] p-5 shadow-2xl space-y-4">
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
            <p className="text-xs text-white/60 mt-1 leading-relaxed">
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
                    boxShadow: '0 0 8px var(--accent-color)'
                  }}
                  className="h-full rounded-full transition-all duration-500"
                />
              </div>
            </div>
          )}

          {/* Primary Action Button */}
          <button
            onClick={() => {
              sounds.playTargetLock();
              setScannerOpen(true);
            }}
            className="w-full py-3.5 px-5 rounded-2xl active:scale-[0.98] text-white font-bold text-base tracking-wide flex items-center justify-center gap-2.5 transition-all shadow-xl border border-white/10"
            style={{
              backgroundColor: 'var(--accent-color)',
              boxShadow: '0 4px 20px var(--accent-glow)'
            }}
          >
            <Camera className="w-5 h-5" />
            <span>OPEN SCANNER</span>
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
                  sounds.playTargetLock();
                  setActiveTab('map');
                }}
                className="text-xs font-semibold flex items-center gap-1 transition-colors"
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
                      sounds.playTargetLock();
                      setActiveTab('social');
                    }}
                    className="flex-shrink-0 w-32 h-44 rounded-2xl overflow-hidden relative border border-white/[0.08] bg-[#121212] group cursor-pointer hover:border-white/[0.2] active:scale-95 transition-all shadow-lg"
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
        <div className="bg-[#121212] border border-white/[0.08] rounded-3xl p-4 space-y-3.5 shadow-xl">
          {/* Segmented Switcher Header */}
          <div className="flex items-center justify-between pb-1 border-b border-white/[0.06]">
            <div className="flex bg-[#181818] p-1 rounded-xl border border-white/[0.06]">
              <button
                onClick={() => { sounds.playTargetLock(); setActiveTabSection('quests'); }}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                  activeTabSection === 'quests' 
                    ? 'text-white shadow' 
                    : 'text-white/50 hover:text-white'
                }`}
                style={activeTabSection === 'quests' ? { backgroundColor: 'var(--accent-color)' } : undefined}
              >
                Side Quests ({sideQuests.length})
              </button>
              <button
                onClick={() => { sounds.playTargetLock(); setActiveTabSection('missions'); }}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                  activeTabSection === 'missions' 
                    ? 'text-white shadow' 
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
                      className={`p-3 rounded-2xl border transition-colors ${
                        quest.isCompleted 
                          ? 'bg-white/[0.02] border-white/[0.04] opacity-50' 
                          : 'bg-[#181818] border-white/[0.06]'
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
                            className="h-full rounded-full" 
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
                      : 'bg-[#181818] border-white/[0.06] hover:border-white/[0.14] active:scale-[0.99]'
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
    </div>
  );
};
