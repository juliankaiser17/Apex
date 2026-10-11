import React, { useState, useMemo } from 'react';
import { Trophy, Users, Globe, MapPin, Flag, ChevronUp, ChevronDown, Minus } from 'lucide-react';
import { useApexStore } from '../../store/useApexStore';
import { sounds } from '../../utils/audio';
import { hapticTap } from '../../utils/haptics';

type RankFilter = 'global' | 'country' | 'city' | 'friends';

interface RanksScreenProps {
  onOpenProfile?: (userId?: string, username?: string) => void;
}

export const RanksScreen: React.FC<RanksScreenProps> = ({ onOpenProfile }) => {
  const leaderboards = useApexStore(s => s.leaderboards);
  const currentUser = useApexStore(s => s.user);
  const friends = useApexStore(s => s.friends);

  const [filter, setFilter] = useState<RankFilter>('global');

  const filteredEntries = useMemo(() => {
    let list = [...leaderboards];
    const userCity = (currentUser.city || '').toLowerCase().trim();
    const userCountry = (currentUser.country || '').toLowerCase().trim();
    const userUsername = (currentUser.username || '').toLowerCase().trim();
    const friendSet = new Set(friends.map(f => f.username.toLowerCase().trim()));

    if (filter === 'friends') {
      list = list.filter(
        e => e.isUser || e.username.toLowerCase().trim() === userUsername || friendSet.has(e.username.toLowerCase().trim())
      );
    } else if (filter === 'city' && userCity) {
      list = list.filter(
        e => e.isUser || (e.city || '').toLowerCase().trim() === userCity
      );
    } else if (filter === 'country' && userCountry) {
      list = list.filter(
        e => e.isUser || (e.country || '').toLowerCase().trim() === userCountry
      );
    }

    // Sort descending by XP
    list.sort((a, b) => b.xp - a.xp);

    return list.map((entry, idx) => ({
      ...entry,
      scopedRank: idx + 1,
      isCurrentUser: entry.isUser || entry.username.toLowerCase().trim() === userUsername,
    }));
  }, [leaderboards, filter, currentUser, friends]);

  const top3 = filteredEntries.slice(0, 3);
  const remaining = filteredEntries.slice(3);

  // If current user is not in top 3 and not in top rows, locate their entry for pin strip
  const userEntry = useMemo(() => {
    return filteredEntries.find(e => e.isCurrentUser);
  }, [filteredEntries]);

  const isUserInTop3 = top3.some(e => e.isCurrentUser);

  const tabs: { id: RankFilter; label: string; icon: React.FC<{ size?: number; className?: string }> }[] = [
    { id: 'global', label: 'Global', icon: Globe },
    { id: 'country', label: currentUser.country || 'Country', icon: Flag },
    { id: 'city', label: currentUser.city || 'City', icon: MapPin },
    { id: 'friends', label: 'Friends', icon: Users },
  ];

  const renderRankChange = (change: 'up' | 'down' | 'same', amount?: number) => {
    if (change === 'up') {
      return (
        <span className="flex items-center text-[10px] font-mono text-[var(--color-ok)]">
          <ChevronUp size={12} />
          {amount ? amount : ''}
        </span>
      );
    }
    if (change === 'down') {
      return (
        <span className="flex items-center text-[10px] font-mono text-[var(--color-danger)]">
          <ChevronDown size={12} />
          {amount ? amount : ''}
        </span>
      );
    }
    return (
      <span className="text-[var(--color-text-3)]">
        <Minus size={10} />
      </span>
    );
  };

  return (
    <div className="flex-1 w-full pb-36 px-4 pt-2 space-y-5 font-sans bg-[var(--color-void)] max-w-lg mx-auto select-none">
      {/* Screen Title */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Trophy size={20} className="text-[var(--color-xp)]" />
          <h2 className="font-display text-display-l text-[var(--color-text)] uppercase leading-none">
            Spotter Ranks
          </h2>
        </div>
        <span className="font-mono text-caption text-[var(--color-text-3)] tabular-nums">
          {filteredEntries.length} Spotters
        </span>
      </div>

      {/* Underline Tabs */}
      <div className="flex border-b border-[var(--color-line)] gap-6 overflow-x-auto no-scrollbar">
        {tabs.map((tab) => {
          const isActive = filter === tab.id;
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => {
                hapticTap();
                sounds.playTargetLock();
                setFilter(tab.id);
              }}
              className={`pb-2.5 pt-1 text-secondary font-semibold flex items-center gap-1.5 transition-colors relative cursor-pointer whitespace-nowrap ${
                isActive
                  ? 'text-[var(--color-text)]'
                  : 'text-[var(--color-text-3)] hover:text-[var(--color-text-2)]'
              }`}
            >
              <Icon size={14} />
              <span>{tab.label}</span>
              {isActive && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--color-xp)] rounded-full" />
              )}
            </button>
          );
        })}
      </div>

      {/* Metal Top 3 Podium Cards */}
      {top3.length > 0 ? (
        <div className="grid grid-cols-3 gap-2.5 pt-2">
          {/* Order: #2 Silver, #1 Gold, #3 Bronze */}
          {[1, 0, 2].map((podiumIdx) => {
            const entry = top3[podiumIdx];
            if (!entry) return <div key={podiumIdx} />;

            const isGold = entry.scopedRank === 1;
            const isSilver = entry.scopedRank === 2;

            return (
              <div
                key={entry.username}
                onClick={() => onOpenProfile?.(undefined, entry.username)}
                className={`p-3 rounded-[var(--radius-panel)] border text-center flex flex-col justify-between items-center transition-transform active:scale-95 cursor-pointer relative ${
                  isGold
                    ? 'bg-gradient-to-b from-amber-500/15 to-[var(--color-panel)] border-amber-400/40 -translate-y-1 shadow-[0_8px_24px_rgba(242,179,61,0.15)]'
                    : isSilver
                    ? 'bg-gradient-to-b from-slate-400/15 to-[var(--color-panel)] border-slate-300/40'
                    : 'bg-gradient-to-b from-amber-800/15 to-[var(--color-panel)] border-amber-700/40'
                }`}
              >
                {/* Crown / Rank Tag */}
                <div className="space-y-1">
                  <span
                    className={`font-mono text-[10px] font-bold px-2 py-0.5 rounded-[var(--radius-chip)] uppercase tracking-wider inline-block ${
                      isGold
                        ? 'bg-amber-400/20 text-amber-300 border border-amber-400/30'
                        : isSilver
                        ? 'bg-slate-300/20 text-slate-200 border border-slate-300/30'
                        : 'bg-amber-700/20 text-amber-300 border border-amber-700/30'
                    }`}
                  >
                    #{entry.scopedRank}
                  </span>

                  <div className="relative pt-1">
                    <img
                      src={entry.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=400'}
                      alt={entry.username}
                      className={`w-12 h-12 rounded-full object-cover mx-auto border-2 ${
                        isGold ? 'border-amber-400 shadow-md' : isSilver ? 'border-slate-300' : 'border-amber-600'
                      }`}
                    />
                  </div>
                </div>

                <div className="space-y-0.5 pt-2 w-full">
                  <span className="font-semibold text-secondary text-[var(--color-text)] truncate block">
                    {entry.displayName || entry.username}
                  </span>
                  <span className="font-mono text-caption text-[var(--color-xp)] font-bold block tabular-nums">
                    {entry.xp.toLocaleString()} XP
                  </span>
                  <span className="font-mono text-[10px] text-[var(--color-text-3)] block truncate">
                    Lvl {entry.level}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="p-8 rounded-[var(--radius-panel)] border border-[var(--color-line)] bg-[var(--color-panel)] text-center space-y-2">
          <Trophy size={24} className="text-[var(--color-text-3)] mx-auto" />
          <h4 className="font-display text-display-m text-[var(--color-text)]">
            No Spotters Found
          </h4>
          <p className="text-secondary text-[var(--color-text-3)]">
            Be the first to score XP in this category.
          </p>
        </div>
      )}

      {/* Ranks 4+ List */}
      {remaining.length > 0 && (
        <div className="rounded-[var(--radius-panel)] border border-[var(--color-line)] bg-[var(--color-panel)] divide-y divide-[var(--color-line)] overflow-hidden">
          {remaining.map((entry) => (
            <div
              key={entry.username}
              onClick={() => onOpenProfile?.(undefined, entry.username)}
              className={`flex items-center justify-between p-3.5 transition-colors cursor-pointer ${
                entry.isCurrentUser
                  ? 'bg-[var(--color-panel-2)] border-l-2 border-l-[var(--color-xp)]'
                  : 'hover:bg-[var(--color-panel-2)]/50'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className="font-mono text-secondary font-bold text-[var(--color-text-3)] w-6 text-center tabular-nums">
                  #{entry.scopedRank}
                </span>

                <img
                  src={entry.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=400'}
                  alt={entry.username}
                  className="w-9 h-9 rounded-full object-cover border border-[var(--color-line)] shrink-0"
                />

                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-secondary text-[var(--color-text)] truncate max-w-[130px]">
                      {entry.displayName || entry.username}
                    </span>
                    {entry.isCurrentUser && (
                      <span className="text-[10px] font-mono text-[var(--color-xp)] font-bold">
                        (You)
                      </span>
                    )}
                  </div>
                  <span className="font-mono text-[11px] text-[var(--color-text-3)] block truncate">
                    Level {entry.level} {entry.city ? `· ${entry.city}` : ''}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2.5 shrink-0 text-right">
                {renderRankChange(entry.rankChange, entry.changeAmount)}
                <span className="font-mono text-secondary font-bold text-[var(--color-xp)] tabular-nums">
                  {entry.xp.toLocaleString()} XP
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pinned User Strip (If user is not in top 3 and list is long) */}
      {!isUserInTop3 && userEntry && (
        <div className="sticky bottom-20 z-20 rounded-[var(--radius-panel)] border-2 border-[var(--color-xp)]/50 bg-[var(--color-panel)] p-3 shadow-2xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="font-mono text-secondary font-bold text-[var(--color-xp)] w-6 text-center tabular-nums">
              #{userEntry.scopedRank}
            </span>
            <img
              src={currentUser.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=400'}
              alt={currentUser.username}
              className="w-8 h-8 rounded-full object-cover border border-[var(--color-xp)]"
            />
            <div>
              <span className="font-semibold text-secondary text-[var(--color-text)]">
                {currentUser.displayName || currentUser.username} (You)
              </span>
              <span className="font-mono text-[10px] text-[var(--color-text-3)] block">
                Level {currentUser.level || 1}
              </span>
            </div>
          </div>
          <span className="font-mono text-secondary font-bold text-[var(--color-xp)] tabular-nums">
            {(currentUser.xp || 0).toLocaleString()} XP
          </span>
        </div>
      )}
    </div>
  );
};

RanksScreen.displayName = 'RanksScreen';
