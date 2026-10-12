import React, { useState, useMemo } from 'react';
import { 
  X, 
  Award, 
  Search, 
  Lock, 
  CheckCircle, 
  Sparkles, 
  Flame, 
  Zap, 
  Shield, 
  Car, 
  Globe, 
  Moon, 
  Clock, 
  Gauge, 
  Compass, 
  Sliders, 
  Trophy 
} from 'lucide-react';
import { useApexStore } from '../../store/useApexStore';
import { hapticTap } from '../../utils/haptics';

interface BadgesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const RARITY_THEME: Record<string, { badge: string; text: string; border: string; glow: string }> = {
  bronze: { badge: 'bg-amber-900/30 text-amber-400 border-amber-800/40', text: 'text-amber-400', border: 'border-amber-700/30', glow: 'rgba(217, 119, 6, 0.2)' },
  silver: { badge: 'bg-slate-500/20 text-slate-300 border-slate-500/40', text: 'text-slate-300', border: 'border-slate-500/30', glow: 'rgba(203, 213, 225, 0.2)' },
  gold: { badge: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/40', text: 'text-yellow-400', border: 'border-yellow-500/40', glow: 'rgba(234, 179, 8, 0.3)' },
  platinum: { badge: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40', text: 'text-cyan-300', border: 'border-cyan-500/40', glow: 'rgba(6, 182, 212, 0.3)' },
  diamond: { badge: 'bg-purple-500/25 text-purple-300 border-purple-500/50', text: 'text-purple-300', border: 'border-purple-500/50', glow: 'rgba(168, 85, 247, 0.4)' }
};

export const BadgesModal: React.FC<BadgesModalProps> = ({ isOpen, onClose }) => {
  const badges = useApexStore(s => s.badges);
  const cardThemeColor = useApexStore(s => s.user.cardThemeColor) || '#E50914';

  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [selectedTier, setSelectedTier] = useState<string>('all');
  const [filterState, setFilterState] = useState<'all' | 'unlocked' | 'locked'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const stats = useMemo(() => {
    const total = badges.length;
    const unlocked = badges.filter(b => b.isUnlocked).length;
    const locked = total - unlocked;
    const percent = total > 0 ? Math.round((unlocked / total) * 100) : 0;
    const xpBonusTotal = badges.filter(b => b.isUnlocked).reduce((sum, b) => sum + (b.xpBonus || 0), 0);
    return { total, unlocked, locked, percent, xpBonusTotal };
  }, [badges]);

  const tierCounts = useMemo(() => {
    const counts: Record<string, { total: number; unlocked: number }> = {
      bronze: { total: 0, unlocked: 0 },
      silver: { total: 0, unlocked: 0 },
      gold: { total: 0, unlocked: 0 },
      platinum: { total: 0, unlocked: 0 },
      diamond: { total: 0, unlocked: 0 }
    };
    badges.forEach(b => {
      const r = (b.rarity || 'bronze').toLowerCase();
      if (counts[r]) {
        counts[r].total += 1;
        if (b.isUnlocked) counts[r].unlocked += 1;
      }
    });
    return counts;
  }, [badges]);

  const filteredBadges = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return badges.filter((b) => {
      // 1. Status Filter
      if (filterState === 'unlocked' && !b.isUnlocked) return false;
      if (filterState === 'locked' && b.isUnlocked) return false;

      // 2. Medal Tier Filter (Bronze, Silver, Gold, Platinum, Diamond)
      if (selectedTier !== 'all' && (b.rarity || 'bronze').toLowerCase() !== selectedTier) {
        return false;
      }

      // 3. Category Filter
      if (activeCategory !== 'all' && (b as any).category !== activeCategory) {
        return false;
      }

      // 3. Search Query
      if (q) {
        const nameMatch = b.name.toLowerCase().includes(q);
        const descMatch = b.description.toLowerCase().includes(q);
        const condMatch = (b as any).unlockCondition?.toLowerCase().includes(q);
        if (!nameMatch && !descMatch && !condMatch) return false;
      }

      return true;
    });
  }, [badges, activeCategory, filterState, searchQuery]);

  if (!isOpen) return null;

  const renderBadgeIcon = (iconName: string, isUnlocked: boolean, rarity: string) => {
    const theme = RARITY_THEME[rarity] || RARITY_THEME.bronze;
    const colorClass = isUnlocked ? theme.text : 'text-white/20';

    switch (iconName) {
      case 'Flame': return <Flame className={`w-6 h-6 ${colorClass}`} />;
      case 'Zap': return <Zap className={`w-6 h-6 ${colorClass}`} />;
      case 'Crown': return <Trophy className={`w-6 h-6 ${colorClass}`} />;
      case 'Shield': return <Shield className={`w-6 h-6 ${colorClass}`} />;
      case 'Car': return <Car className={`w-6 h-6 ${colorClass}`} />;
      case 'Globe': return <Globe className={`w-6 h-6 ${colorClass}`} />;
      case 'Moon': return <Moon className={`w-6 h-6 ${colorClass}`} />;
      case 'Clock': return <Clock className={`w-6 h-6 ${colorClass}`} />;
      case 'Gauge': return <Gauge className={`w-6 h-6 ${colorClass}`} />;
      case 'Compass': return <Compass className={`w-6 h-6 ${colorClass}`} />;
      case 'Sliders': return <Sliders className={`w-6 h-6 ${colorClass}`} />;
      case 'Sparkles': return <Sparkles className={`w-6 h-6 ${colorClass}`} />;
      default: return <Award className={`w-6 h-6 ${colorClass}`} />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
      <div 
        className="w-full max-w-2xl bg-[#0E0E0E] border border-white/10 rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-200"
        style={{ borderColor: `${cardThemeColor}40` }}
      >
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-white/[0.08] bg-[#141414] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div 
              className="p-2 rounded-xl"
              style={{ backgroundColor: `${cardThemeColor}20`, border: `1px solid ${cardThemeColor}40` }}
            >
              <Trophy className="w-5 h-5" style={{ color: cardThemeColor }} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white tracking-tight">Apex Hall of Trophies</h2>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/[0.08] text-white/80 border border-white/10 font-data">
                  {stats.unlocked} / {stats.total} Unlocked
                </span>
              </div>
              <p className="text-[10px] text-white/40 uppercase tracking-widest font-data">
                {stats.percent}% Completed · +{stats.xpBonusTotal.toLocaleString()} Bonus XP
              </p>
            </div>
          </div>

          <button 
            onClick={() => {
              hapticTap();
              onClose();
            }}
            className="p-2 rounded-xl text-white/50 hover:text-white hover:bg-white/[0.06] transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Global Progress Bar */}
        <div className="px-6 pt-3 pb-1 bg-[#121212] border-b border-white/[0.06]">
          <div className="flex justify-between text-[11px] font-data mb-1.5">
            <span className="text-white/40 uppercase font-medium">Mastery Progress</span>
            <span className="font-bold text-white">{stats.percent}% ({stats.unlocked}/{stats.total})</span>
          </div>
          <div className="w-full h-2 bg-white/[0.06] rounded-full overflow-hidden p-0.5">
            <div 
              className="h-full rounded-full transition-all duration-500 shadow-sm"
              style={{ 
                width: `${stats.percent}%`,
                backgroundColor: cardThemeColor,
                boxShadow: `0 0 10px ${cardThemeColor}`
              }}
            />
          </div>
        </div>

        {/* Search & Filter Controls */}
        <div className="p-4 space-y-3 bg-[#111111] border-b border-white/[0.06]">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
              <input 
                type="text"
                placeholder="Search 100+ badges by name or challenge..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-black/60 border border-white/10 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-white/30 focus:outline-none focus:border-white/30"
              />
            </div>

            <div className="flex bg-black/50 p-1 rounded-xl border border-white/10">
              <button
                type="button"
                onClick={() => { hapticTap(); setFilterState('all'); }}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                  filterState === 'all' ? 'bg-white/10 text-white shadow' : 'text-white/40 hover:text-white'
                }`}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => { hapticTap(); setFilterState('unlocked'); }}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                  filterState === 'unlocked' ? 'bg-emerald-500/20 text-emerald-400 shadow' : 'text-white/40 hover:text-white'
                }`}
              >
                Unlocked ({stats.unlocked})
              </button>
              <button
                type="button"
                onClick={() => { hapticTap(); setFilterState('locked'); }}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                  filterState === 'locked' ? 'bg-white/10 text-white shadow' : 'text-white/40 hover:text-white'
                }`}
              >
                Locked ({stats.locked})
              </button>
            </div>
          </div>

          {/* Medal Tier Tabs: Bronze, Silver, Gold, Platinum, Diamond */}
          <div className="flex gap-1.5 overflow-x-auto no-scrollbar py-1 border-b border-white/[0.06]">
            {[
              { id: 'all', label: 'All Medals', count: `${stats.unlocked}/${stats.total}`, color: 'text-white' },
              { id: 'bronze', label: 'Bronze', count: `${tierCounts.bronze.unlocked}/${tierCounts.bronze.total}`, color: 'text-amber-400' },
              { id: 'silver', label: 'Silver', count: `${tierCounts.silver.unlocked}/${tierCounts.silver.total}`, color: 'text-slate-300' },
              { id: 'gold', label: 'Gold', count: `${tierCounts.gold.unlocked}/${tierCounts.gold.total}`, color: 'text-yellow-400' },
              { id: 'platinum', label: 'Platinum', count: `${tierCounts.platinum.unlocked}/${tierCounts.platinum.total}`, color: 'text-cyan-300' },
              { id: 'diamond', label: 'Diamond', count: `${tierCounts.diamond.unlocked}/${tierCounts.diamond.total}`, color: 'text-purple-300' }
            ].map(tier => (
              <button
                key={tier.id}
                type="button"
                onClick={() => {
                  hapticTap();
                  setSelectedTier(tier.id);
                }}
                className={`px-3 py-1.5 rounded-xl text-xs whitespace-nowrap font-bold border transition-all flex items-center gap-1.5 ${
                  selectedTier === tier.id 
                    ? 'bg-white/10 border-white/35 shadow-sm ' + tier.color
                    : 'bg-black/40 border-white/5 text-white/40 hover:text-white/80 hover:border-white/15'
                }`}
              >
                <span>{tier.label}</span>
                <span className="text-[10px] font-mono opacity-60">({tier.count})</span>
              </button>
            ))}
          </div>

          {/* Category Tabs */}
          <div className="flex gap-1.5 overflow-x-auto no-scrollbar py-0.5">
            {[
              { id: 'all', label: 'All Badges' },
              { id: 'rarity', label: 'Rarity' },
              { id: 'manufacturer', label: 'Marques' },
              { id: 'streaks', label: 'Streaks' },
              { id: 'time_session', label: 'Speed & Time' },
              { id: 'performance', label: 'Performance' },
              { id: 'body_diversity', label: 'Body Styles' },
              { id: 'exploration', label: 'Exploration' },
              { id: 'collection', label: 'Collection' },
              { id: 'forensics', label: 'Forensics' }
            ].map(cat => (
              <button
                key={cat.id}
                type="button"
                onClick={() => {
                  hapticTap();
                  setActiveCategory(cat.id);
                }}
                className={`px-3 py-1.5 rounded-xl text-xs whitespace-nowrap font-semibold border transition-all ${
                  activeCategory === cat.id 
                    ? 'text-white border-white/30 bg-white/[0.08]' 
                    : 'text-white/40 border-white/5 hover:border-white/15 bg-black/40'
                }`}
                style={activeCategory === cat.id ? { borderColor: cardThemeColor, color: '#fff' } : undefined}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Scrollable Badge Grid */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 grid grid-cols-1 sm:grid-cols-2 gap-3 no-scrollbar text-left">
          {filteredBadges.length > 0 ? (
            filteredBadges.map((badge) => {
              const theme = RARITY_THEME[badge.rarity] || RARITY_THEME.bronze;
              const progress = badge.progress;
              const hasProgress = progress && progress.max > 1 && !badge.isUnlocked;
              const progressPercent = progress ? Math.min(100, Math.round((progress.current / progress.max) * 100)) : 0;

              return (
                <div
                  key={badge.id}
                  className={`p-3.5 rounded-2xl border transition-all relative overflow-hidden flex flex-col justify-between ${
                    badge.isUnlocked 
                      ? 'bg-[#151515] border-white/10 hover:border-white/25 shadow-lg' 
                      : 'bg-black/30 border-white/5 opacity-60'
                  }`}
                >
                  {/* Card Glow if unlocked */}
                  {badge.isUnlocked && (
                    <div 
                      className="absolute -top-10 -right-10 w-24 h-24 rounded-full blur-2xl pointer-events-none"
                      style={{ backgroundColor: theme.glow }}
                    />
                  )}

                  <div className="flex items-start gap-3">
                    <div 
                      className={`p-2.5 rounded-2xl border flex-shrink-0 flex items-center justify-center ${
                        badge.isUnlocked 
                          ? 'bg-black/60 ' + theme.border 
                          : 'bg-black/40 border-white/5'
                      }`}
                    >
                      {renderBadgeIcon(badge.icon, badge.isUnlocked, badge.rarity)}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <h4 className="text-xs font-bold text-white tracking-tight truncate">
                          {badge.name}
                        </h4>
                        <span className={`text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border whitespace-nowrap ${theme.badge}`}>
                          {badge.rarity}
                        </span>
                      </div>

                      <p className="text-[11px] text-white/60 mt-1 leading-snug">
                        {badge.description}
                      </p>

                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-[10px] font-semibold text-amber-400 font-data">
                          +{badge.xpBonus} XP
                        </span>
                        {(badge as any).unlockCondition && (
                          <span className="text-[9px] text-white/30 truncate block font-data">
                            · {(badge as any).unlockCondition}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Progress Bar for Locked Badges with Multi-step progress */}
                  {hasProgress && (
                    <div className="mt-3 pt-2 border-t border-white/[0.04]">
                      <div className="flex justify-between text-[10px] font-data text-white/40 mb-1">
                        <span>Progress</span>
                        <span className="font-semibold text-white/70">
                          {progress.current} / {progress.max} {progress.unit || ''} ({progressPercent}%)
                        </span>
                      </div>
                      <div className="w-full h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                        <div 
                          className="h-full rounded-full transition-all duration-300"
                          style={{ 
                            width: `${progressPercent}%`,
                            backgroundColor: theme.text.replace('text-', '') === 'amber-400' ? '#f59e0b' : '#38bdf8' 
                          }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Unlocked stamp */}
                  {badge.isUnlocked && (
                    <div className="mt-2.5 pt-1.5 border-t border-white/[0.04] flex items-center justify-between text-[10px] text-emerald-400 font-data">
                      <span className="flex items-center gap-1">
                        <CheckCircle className="w-3 h-3 text-emerald-400" /> Unlocked
                      </span>
                      {badge.earnedAt && (
                        <span className="text-white/30">
                          {new Date(badge.earnedAt).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          ) : (
            <div className="col-span-2 py-12 text-center space-y-2">
              <Lock className="w-8 h-8 text-white/20 mx-auto" />
              <p className="text-xs text-white/40">No badges match the selected filters.</p>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 border-t border-white/[0.08] bg-[#141414] flex items-center justify-between text-xs text-white/40 font-data">
          <span>Showing {filteredBadges.length} of {badges.length} achievements</span>
          <button
            type="button"
            onClick={() => {
              hapticTap();
              onClose();
            }}
            className="px-4 py-1.5 rounded-xl bg-white/[0.08] text-white text-xs font-semibold hover:bg-white/15 transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
