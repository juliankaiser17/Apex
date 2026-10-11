import React, { useState, useMemo } from 'react';
import { 
  Camera, 
  ChevronRight, 
  Flame, 
  MapPin, 
  Trophy, 
  Sparkles 
} from 'lucide-react';
import { useApexStore } from '../../store/useApexStore';
import type { LeaderboardEntry } from '../../types/apex';
import { sounds } from '../../utils/audio';
import { getOptimizedImageUrl } from '../../utils/imageUrl';
import { hapticTap, hapticImpact } from '../../utils/haptics';
import { ProgressTicks } from '../ui/ProgressTicks';
import { Button } from '../ui/Button';
import { RarityBadge, type RarityTier } from '../ui/RarityBadge';
import { QuestsScreen } from './QuestsScreen';

export const HomeScreen: React.FC = () => {
  const dailyQuests = useApexStore(s => s.dailyQuests);
  const setScannerOpen = useApexStore(s => s.setScannerOpen);
  const setActiveTab = useApexStore(s => s.setActiveTab);
  const feedPosts = useApexStore(s => s.feedPosts);
  const userStreakDays = useApexStore(s => s.user.streakDays);
  const userCity = useApexStore(s => s.user.city) || 'Lucknow';
  const leaderboards = useApexStore(s => s.leaderboards);
  const currentUser = useApexStore(s => s.user);

  const [isQuestsModalOpen, setIsQuestsModalOpen] = useState(false);

  // 1. Closest quest to completion (ties broken by highest reward)
  const heroQuest = useMemo(() => {
    if (!dailyQuests || dailyQuests.length === 0) return null;
    const active = dailyQuests.filter(q => !q.isCompleted);
    if (active.length === 0) return null; // All done for today
    return [...active].sort((a, b) => {
      const pctA = a.currentCount / a.targetCount;
      const pctB = b.currentCount / b.targetCount;
      if (pctB !== pctA) return pctB - pctA;
      return b.xpReward - a.xpReward;
    })[0];
  }, [dailyQuests]);

  const isDailyGoalDone = dailyQuests.length > 0 && dailyQuests.every(q => q.isCompleted);

  // 2. Real Near-You Sightings (Filter out seeded mock posts in production)
  const nearbyPosts = useMemo(() => {
    return feedPosts.filter(p => {
      // Exclude known seeded global posts
      const isSeeded = p.id.startsWith('mock_') || p.id.startsWith('sample_');
      if (import.meta.env.PROD && isSeeded) return false;
      // In dev or with real scans, match user city or vicinity
      if (p.card?.city && userCity) {
        return p.card.city.toLowerCase() === userCity.toLowerCase();
      }
      return !isSeeded;
    }).slice(0, 8);
  }, [feedPosts, userCity]);

  // 3. Compact City Leaderboard Strip (Top 3 in city plus user, max 4 rows)
  const cityLeaderboard = useMemo(() => {
    const cityLower = userCity.toLowerCase().trim();
    const cityList = leaderboards.filter(
      (e: LeaderboardEntry) => (e.city || '').toLowerCase().trim() === cityLower
    );
    const top3 = cityList.slice(0, 3);
    const userInTop3 = top3.some((e: LeaderboardEntry) => e.username === currentUser.username);

    if (userInTop3 || cityList.length <= 3) {
      return top3;
    }

    const userEntry = cityList.find((e: LeaderboardEntry) => e.username === currentUser.username);
    return userEntry ? [...top3, userEntry] : top3;
  }, [leaderboards, currentUser, userCity]);

  // 4. Preview Quests: at most 3 active compact rows
  const activeQuestsPreview = useMemo(() => {
    return dailyQuests.filter(q => !q.isCompleted).slice(0, 3);
  }, [dailyQuests]);

  return (
    <div className="flex-1 w-full pb-36 px-4 pt-3 space-y-6 font-sans bg-[var(--color-void)] max-w-lg mx-auto select-none">
      
      {/* ─── 1. TODAY CARD (THE HERO, ~188px tall) ─── */}
      <div className="rounded-[var(--radius-panel)] border border-[var(--color-line)] bg-[var(--color-panel)] p-5 space-y-4 shadow-[0_8px_32px_rgba(0,0,0,0.5)]">
        {!isDailyGoalDone && heroQuest ? (
          <>
            <div className="flex items-center justify-between">
              <span className="font-mono text-[11px] font-bold text-[var(--color-xp)] uppercase tracking-wider bg-[var(--color-xp)]/10 border border-[var(--color-xp)]/30 px-2 py-0.5 rounded-[var(--radius-chip)] flex items-center gap-1">
                <Sparkles size={11} /> Today's Objective
              </span>
              <span className="font-mono text-caption text-[var(--color-text-3)] tabular-nums">
                +{heroQuest.xpReward} XP
              </span>
            </div>

            <div>
              <h2 className="font-display text-display-m text-[var(--color-text)] tracking-tight leading-tight">
                {heroQuest.title}
              </h2>
              <p className="text-secondary text-[var(--color-text-3)] mt-0.5">
                Day {userStreakDays || 1}. Scan today to keep your streak.
              </p>
            </div>

            <ProgressTicks
              current={heroQuest.currentCount}
              total={heroQuest.targetCount}
              label="Progress"
            />

            <Button
              variant="primary"
              className="w-full"
              onClick={() => {
                hapticImpact('medium');
                sounds.playTargetLock();
                setScannerOpen(true);
              }}
            >
              <Camera size={18} />
              <span>Scan a car</span>
            </Button>
          </>
        ) : (
          /* Done for Today State */
          <div className="text-center py-4 space-y-2">
            <div className="w-12 h-12 rounded-full bg-[var(--color-ok)]/15 border border-[var(--color-ok)]/30 flex items-center justify-center mx-auto text-[var(--color-ok)]">
              <Sparkles size={20} />
            </div>
            <h2 className="font-display text-display-m text-[var(--color-text)]">
              Done for today.
            </h2>
            <p className="text-secondary text-[var(--color-text-3)]">
              Day {userStreakDays || 1} secured. Tomorrow's streak preview unlocks at midnight.
            </p>
          </div>
        )}
      </div>

      {/* ─── 2. NEAR YOU (Real Local Sightings Scroller) ─── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <MapPin size={16} className="text-[var(--color-text-2)]" />
            <h3 className="font-display text-display-m text-[var(--color-text)] uppercase tracking-tight">
              Near You
            </h3>
          </div>
          <button
            onClick={() => {
              hapticTap();
              setActiveTab('map');
            }}
            className="text-secondary text-[var(--color-text-3)] hover:text-[var(--color-text)] flex items-center gap-1 transition-colors cursor-pointer"
          >
            <span>Open map</span>
            <ChevronRight size={14} />
          </button>
        </div>

        {nearbyPosts.length > 0 ? (
          <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1 -mx-4 px-4">
            {nearbyPosts.map((post) => {
              const rarity = (post.card?.rarity || 'common') as RarityTier;
              const imgUrl = post.card?.imageUrl || post.mediaUrl || '';
              const optUrl = getOptimizedImageUrl(imgUrl, 'thumbnail');

              return (
                <div
                  key={post.id}
                  onClick={() => {
                    hapticTap();
                    setActiveTab('social');
                  }}
                  data-rarity={rarity}
                  className="flex-shrink-0 w-40 h-[220px] rounded-[var(--radius-panel)] overflow-hidden relative border-t-2 border-t-[var(--r)] border border-[var(--color-line)] bg-[var(--color-panel)] cursor-pointer group active:scale-95 transition-transform shadow-lg flex flex-col justify-between p-3 select-none"
                >
                  <img
                    src={optUrl}
                    alt={post.card?.model || 'Car'}
                    loading="lazy"
                    decoding="async"
                    className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[var(--color-void)]/95 via-[var(--color-void)]/40 to-transparent pointer-events-none" />

                  {/* Top: Rarity Badge */}
                  <div className="relative z-10 flex justify-start">
                    <RarityBadge rarity={rarity} size="sm" />
                  </div>

                  {/* Bottom: Car Name & Location */}
                  <div className="relative z-10 space-y-0.5">
                    <span className="text-caption text-[var(--color-text-3)] block truncate font-medium">
                      {post.card?.make || 'Unknown'}
                    </span>
                    <h4 className="font-display text-display-m text-[var(--color-text)] leading-tight truncate">
                      {post.card?.model || post.caption || 'Supercar'}
                    </h4>
                    <span className="font-mono text-caption text-[var(--color-text-2)] block tabular-nums">
                      {post.card?.city || userCity}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* Honest Empty State for Near You */
          <div className="p-5 rounded-[var(--radius-panel)] border border-[var(--color-line)] bg-[var(--color-panel)] text-center space-y-3">
            <div className="w-10 h-10 rounded-full bg-[var(--color-panel-2)] border border-[var(--color-line)] flex items-center justify-center mx-auto text-[var(--color-text-3)]">
              <MapPin size={18} />
            </div>
            <div className="space-y-1">
              <h4 className="font-display text-display-m text-[var(--color-text)]">
                Nothing spotted near {userCity} yet.
              </h4>
              <p className="text-secondary text-[var(--color-text-3)] max-w-xs mx-auto">
                Be the first to put it on the map.
              </p>
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                hapticTap();
                setScannerOpen(true);
              }}
            >
              Scan a car
            </Button>
          </div>
        )}
      </div>

      {/* ─── 3. YOUR CITY (Compact Leaderboard Strip) ─── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Trophy size={16} className="text-[var(--color-xp)]" />
            <h3 className="font-display text-display-m text-[var(--color-text)] uppercase tracking-tight">
              Your City ({userCity})
            </h3>
          </div>
          <button
            onClick={() => {
              hapticTap();
              setActiveTab('social');
            }}
            className="text-secondary text-[var(--color-text-3)] hover:text-[var(--color-text)] flex items-center gap-1 transition-colors cursor-pointer"
          >
            <span>View ranks</span>
            <ChevronRight size={14} />
          </button>
        </div>

        {cityLeaderboard.length > 0 ? (
          <div className="rounded-[var(--radius-panel)] border border-[var(--color-line)] bg-[var(--color-panel)] divide-y divide-[var(--color-line)] overflow-hidden">
            {cityLeaderboard.map((entry: LeaderboardEntry, idx: number) => {
              const isCurrentUser = entry.username === currentUser.username;
              return (
                <div
                  key={entry.username || idx}
                  className={`flex items-center justify-between p-3 text-secondary ${
                    isCurrentUser ? 'bg-[var(--color-panel-2)]' : ''
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-secondary font-bold text-[var(--color-text-3)] w-5 text-center tabular-nums">
                      #{idx + 1}
                    </span>
                    <span className="font-semibold text-[var(--color-text)] truncate max-w-[140px]">
                      {entry.displayName || entry.username} {isCurrentUser ? '(You)' : ''}
                    </span>
                  </div>

                  <span className="font-mono text-secondary font-bold text-[var(--color-xp)] tabular-nums">
                    {entry.xp?.toLocaleString()} XP
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          /* Solo state */
          <div className="p-4 rounded-[var(--radius-panel)] border border-[var(--color-line)] bg-[var(--color-panel)] text-center space-y-2">
            <p className="text-secondary text-[var(--color-text)] font-semibold">
              You're #1 in {userCity}. So far it's just you.
            </p>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                if (navigator.share) {
                  navigator.share({
                    title: 'Apex Supercar Spotter',
                    text: `I'm spotting supercars in ${userCity} on Apex! Join me!`,
                    url: window.location.href,
                  }).catch(() => {});
                }
              }}
            >
              Invite Spotters
            </Button>
          </div>
        )}
      </div>

      {/* ─── 4. QUESTS PREVIEW (At most 3 active rows) ─── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Flame size={16} className="text-orange-400" />
            <h3 className="font-display text-display-m text-[var(--color-text)] uppercase tracking-tight">
              Today's Quests
            </h3>
          </div>
          <button
            onClick={() => {
              hapticTap();
              setIsQuestsModalOpen(true);
            }}
            className="text-secondary text-[var(--color-text-3)] hover:text-[var(--color-text)] flex items-center gap-1 transition-colors cursor-pointer"
          >
            <span>See all ({dailyQuests.length})</span>
            <ChevronRight size={14} />
          </button>
        </div>

        <div className="space-y-2.5">
          {activeQuestsPreview.map((quest) => (
            <div
              key={quest.id}
              onClick={() => setIsQuestsModalOpen(true)}
              className="p-3.5 rounded-[var(--radius-panel)] border border-[var(--color-line)] bg-[var(--color-panel)] flex items-center justify-between gap-3 cursor-pointer hover:border-[var(--color-text-3)] active:scale-[0.99] transition-all"
            >
              <div className="space-y-1 flex-1 min-w-0">
                <h4 className="text-secondary font-bold text-[var(--color-text)] truncate">
                  {quest.title}
                </h4>
                <p className="text-caption text-[var(--color-text-3)] truncate">
                  {quest.description}
                </p>
                <div className="pt-0.5">
                  <ProgressTicks
                    current={quest.currentCount}
                    total={quest.targetCount}
                    label="Progress"
                  />
                </div>
              </div>

              <div className="text-right shrink-0">
                <span className="font-mono text-secondary font-bold text-[var(--color-xp)] tabular-nums">
                  +{quest.xpReward} XP
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Full Quests Screen Modal */}
      <QuestsScreen
        isOpen={isQuestsModalOpen}
        onClose={() => setIsQuestsModalOpen(false)}
      />
    </div>
  );
};

HomeScreen.displayName = 'HomeScreen';
