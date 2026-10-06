import React, { useState, useEffect, memo, useMemo } from 'react';
import { 
  Camera, 
  ChevronRight, 
  CheckCircle2, 
  Clock, 
  Flame,
  Sparkles,
  Zap,
  MapPin,
  Gauge,
  Compass
} from 'lucide-react';
import { useApexStore, GLOBAL_QUEST_EXPIRES_AT } from '../../store/useApexStore';
import type { Mission, DailyQuest } from '../../types/apex';
import { sounds } from '../../utils/audio';
import { getOptimizedImageUrl } from '../../utils/imageUrl';
import { hapticTap, hapticImpact, hapticSuccess } from '../../utils/haptics';
import { getProgressToNextLevel } from '../../utils/mastery';
import { MasteryTierModal } from './MasteryTierModal';
import { TimedQuestConfirmModal } from './TimedQuestConfirmModal';
import { RARITY_CONFIG } from '../../utils/rarity';

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
  const startTimedQuest = useApexStore(s => s.startTimedQuest);
  const claimMissionReward = useApexStore(s => s.claimMissionReward);
  const feedPosts = useApexStore(s => s.feedPosts);
  const userLevel = useApexStore(s => s.user.level);
  const userXp = useApexStore(s => s.user.xp);
  const userStreakDays = useApexStore(s => s.user.streakDays);

  const [activeTabSection, setActiveTabSection] = useState<'quests' | 'missions'>('quests');
  const [questFilter, setQuestFilter] = useState<'all' | 'NORMAL' | 'HARD' | 'EXTREME'>('all');
  const [isTierModalOpen, setIsTierModalOpen] = useState(false);
  const [selectedQuestForModal, setSelectedQuestForModal] = useState<DailyQuest | null>(null);
  const [missionClaimingId, setMissionClaimingId] = useState<string | null>(null);
  const [missionToast, setMissionToast] = useState<{ message: string; isError: boolean } | null>(null);

  const normalQuests = useMemo(() => dailyQuests.filter(q => (q as any).tier === 'NORMAL' || !(q as any).tier), [dailyQuests]);
  const hardQuests = useMemo(() => dailyQuests.filter(q => (q as any).tier === 'HARD'), [dailyQuests]);
  const extremeQuests = useMemo(() => dailyQuests.filter(q => (q as any).tier === 'EXTREME'), [dailyQuests]);
  const activeQuest = dailyQuests[0];

  const { level, tierConfig, percentage } = useMemo(() => {
    return getProgressToNextLevel(userLevel, userXp);
  }, [userLevel, userXp]);

  const handleMissionClick = async (m: Mission) => {
    if (m.completed || missionClaimingId) return;
    hapticTap();
    sounds.playTargetLock();

    // Only 'login' mission can be claimed on click without vehicle scan
    if (m.type === 'login') {
      setMissionClaimingId(m.id);
      const res = await claimMissionReward(m.id);
      setMissionClaimingId(null);

      if (res.success) {
        hapticSuccess();
        sounds.playXpPop();
        setMissionToast({ message: `Reward Claimed! +${res.xpAwarded} XP`, isError: false });
        setTimeout(() => setMissionToast(null), 3000);
      } else {
        setMissionToast({ 
          message: res.error || 'Login bonus already claimed today.', 
          isError: true 
        });
        setTimeout(() => setMissionToast(null), 3000);
      }
      return;
    }

    // For scan-based missions, clicking prompts user to scan vehicles
    setMissionToast({ 
      message: `${m.title}: Scan vehicles to fulfill this objective!`, 
      isError: true 
    });
    setTimeout(() => setMissionToast(null), 4000);
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
              Quests ({dailyQuests.length})
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

        {/* Section 1: 3-Tier Quests (Normal, Hard, Extreme) */}
        {activeTabSection === 'quests' && (
          <div className="space-y-3.5">
            {/* Difficulty Sub-Filter Pills */}
            <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
              {[
                { id: 'all' as const, label: `All (${dailyQuests.length})` },
                { id: 'NORMAL' as const, label: `Normal (${normalQuests.length})` },
                { id: 'HARD' as const, label: `Hard (${hardQuests.length})` },
                { id: 'EXTREME' as const, label: `Extreme (${extremeQuests.length})` },
              ].map((pill) => (
                <button
                  key={pill.id}
                  onClick={() => {
                    hapticTap();
                    sounds.playTargetLock();
                    setQuestFilter(pill.id);
                  }}
                  className={`text-[10px] font-bold px-2.5 py-1 rounded-xl border transition-all cursor-pointer whitespace-nowrap ${
                    questFilter === pill.id
                      ? 'bg-white text-black font-extrabold shadow-md border-white'
                      : 'bg-black/40 text-white/50 border-white/10 hover:border-white/20'
                  }`}
                >
                  {pill.label}
                </button>
              ))}
            </div>

            {/* Helper to render a group of quests */}
            {(() => {
              const renderQuestCard = (quest: any) => {
                const pct = Math.min(100, Math.round((quest.currentCount / quest.targetCount) * 100));
                const tierColor = 
                  quest.tier === 'EXTREME' ? { badge: 'bg-rose-500/20 text-rose-300 border-rose-500/40', bar: '#F43F5E' } :
                  quest.tier === 'HARD' ? { badge: 'bg-amber-500/20 text-amber-300 border-amber-500/40', bar: '#F59E0B' } :
                  { badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40', bar: '#10B981' };

                return (
                  <div 
                    key={quest.id} 
                    onClick={() => {
                      hapticTap();
                      sounds.playTargetLock();
                      if (quest.isCompleted) {
                        sounds.playXpPop();
                        return;
                      }
                      setSelectedQuestForModal(quest);
                    }}
                    className={`p-3 rounded-2xl border transition-all cursor-pointer active:scale-[0.99] ${
                      quest.isCompleted 
                        ? 'bg-emerald-950/20 border-emerald-500/30 shadow-sm' 
                        : 'bg-[#181818]/90 border-white/[0.08] hover:border-white/[0.22]'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${tierColor.badge}`}>
                            {quest.tier || 'NORMAL'}
                          </span>

                          {quest.targetCity && (
                            <span className="text-[9px] font-semibold text-white/70 bg-white/[0.05] border border-white/10 px-2 py-0.5 rounded-full flex items-center gap-1">
                              <MapPin className="w-2.5 h-2.5 text-white/50" /> {quest.targetCity}
                            </span>
                          )}

                          {quest.allowedMakes && quest.allowedMakes.length > 0 && (
                            <span className="text-[9px] font-semibold text-white/70 bg-white/[0.05] border border-white/10 px-2 py-0.5 rounded-full flex items-center gap-1">
                              <Compass className="w-2.5 h-2.5 text-white/50" /> Heritage
                            </span>
                          )}

                          {quest.windowMinutes && (
                            <span className="text-[9px] font-semibold text-amber-300 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full flex items-center gap-1">
                              <Clock className="w-2.5 h-2.5" /> {quest.windowMinutes}m Window
                            </span>
                          )}

                          {quest.minHorsepower && (
                            <span className="text-[9px] font-semibold text-orange-300 bg-orange-500/10 border border-orange-500/20 px-2 py-0.5 rounded-full flex items-center gap-1">
                              <Gauge className="w-2.5 h-2.5" /> {quest.minHorsepower}+ HP
                            </span>
                          )}

                          {quest.minRarity && (
                            <span className="text-[9px] font-semibold text-purple-300 bg-purple-500/10 border border-purple-500/20 px-2 py-0.5 rounded-full capitalize">
                              {quest.minRarity}+
                            </span>
                          )}
                        </div>

                        <h4 className="text-xs font-bold text-white tracking-tight pt-0.5">
                          {quest.title}
                        </h4>
                        <p className="text-[11px] text-white/60 leading-snug">
                          {quest.description}
                        </p>
                      </div>

                      <div className="text-right shrink-0">
                        <span 
                          className="text-xs font-extrabold font-data block"
                          style={{ color: 'var(--accent-color)' }}
                        >
                          +{quest.xpReward} XP
                        </span>
                        {quest.coinReward > 0 && (
                          <span className="text-[10px] font-data text-amber-400 block">
                            +{quest.coinReward} Coins
                          </span>
                        )}
                        {quest.isCompleted && (
                          <span className="text-[9px] font-bold text-emerald-400 bg-emerald-500/20 border border-emerald-500/40 px-1.5 py-0.5 rounded-full uppercase inline-block mt-1">
                            Done
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="mt-2.5 space-y-1">
                      <div className="flex justify-between text-[10px] font-data">
                        <span className="text-white/40">OBJECTIVE PROGRESS</span>
                        <span className="font-bold text-white/90">
                          {quest.currentCount} / {quest.targetCount}
                        </span>
                      </div>
                      <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                        <div 
                          style={{ 
                            width: `${pct}%`,
                            backgroundColor: quest.isCompleted ? '#10B981' : tierColor.bar
                          }} 
                          className="h-full rounded-full transition-all duration-300" 
                        />
                      </div>
                    </div>
                  </div>
                );
              };

              return (
                <div className="space-y-3.5">
                  {/* Normal Tier Section */}
                  {(questFilter === 'all' || questFilter === 'NORMAL') && normalQuests.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                          <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider">
                            Normal Quests
                          </span>
                        </div>
                        <span className="text-[10px] text-white/40">Everyday Spotting</span>
                      </div>
                      <div className="space-y-2">
                        {normalQuests.map(renderQuestCard)}
                      </div>
                    </div>
                  )}

                  {/* Hard Tier Section */}
                  {(questFilter === 'all' || questFilter === 'HARD') && hardQuests.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <Zap className="w-3.5 h-3.5 text-amber-400" />
                          <span className="text-[11px] font-bold text-amber-400 uppercase tracking-wider">
                            Hard Quests
                          </span>
                        </div>
                        <span className="text-[10px] text-white/40">Speed & Power</span>
                      </div>
                      <div className="space-y-2">
                        {hardQuests.map(renderQuestCard)}
                      </div>
                    </div>
                  )}

                  {/* Extreme Tier Section */}
                  {(questFilter === 'all' || questFilter === 'EXTREME') && extremeQuests.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <Flame className="w-3.5 h-3.5 text-rose-400" />
                          <span className="text-[11px] font-bold text-rose-400 uppercase tracking-wider">
                            Extreme Quests
                          </span>
                        </div>
                        <span className="text-[10px] text-white/40">Ultra-Rare & Precision</span>
                      </div>
                      <div className="space-y-2">
                        {extremeQuests.map(renderQuestCard)}
                      </div>
                    </div>
                  )}

                  {dailyQuests.length === 0 && (
                    <p className="text-xs text-white/40 text-center py-4">
                      All daily quests completed! Check back after rotation.
                    </p>
                  )}
                </div>
              );
            })()}
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
                  ) : missionClaimingId === m.id ? (
                    <div className="w-4 h-4 rounded-full border-2 border-amber-400 border-t-transparent animate-spin" />
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

            {missionToast && (
              <div className={`p-2.5 rounded-xl text-xs font-semibold flex items-center justify-between border transition-all ${
                missionToast.isError 
                  ? 'bg-red-950/40 border-red-500/30 text-red-300' 
                  : 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300'
              }`}>
                <span>{missionToast.message}</span>
                {missionToast.isError && (
                  <button
                    onClick={() => { setScannerOpen(true); }}
                    className="ml-2 px-2 py-0.5 rounded-lg bg-white/10 text-[11px] font-bold text-white hover:bg-white/20 transition-colors shrink-0"
                  >
                    Scan →
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Driver Mastery & Tier Progression Roadmap Modal */}
      <MasteryTierModal 
        isOpen={isTierModalOpen} 
        onClose={() => setIsTierModalOpen(false)} 
      />

      {/* Timed Quest Challenge Confirmation Modal */}
      <TimedQuestConfirmModal
        quest={selectedQuestForModal}
        isOpen={Boolean(selectedQuestForModal)}
        onClose={() => setSelectedQuestForModal(null)}
        onStartQuest={(questId) => {
          startTimedQuest(questId);
          setSelectedQuestForModal(null);
          setScannerOpen(true);
        }}
      />
    </div>
  );
};
