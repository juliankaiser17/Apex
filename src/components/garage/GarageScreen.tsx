import React, { useState, useMemo, useDeferredValue, useCallback } from 'react';
import { 
  Search, 
  Grid, 
  List, 
  Plus, 
  Gauge, 
  Zap, 
  Trophy, 
  Sparkles, 
  X, 
  ChevronRight,
  ChevronDown,
  Clock
} from 'lucide-react';
import { useApexStore } from '../../store/useApexStore';
import type { CarCard, RarityTier } from '../../types/apex';
import { RARITY_CONFIG } from '../../utils/rarity';
import { sounds } from '../../utils/audio';
import { getOptimizedImageUrl } from '../../utils/imageUrl';
import { hapticTap, hapticImpact } from '../../utils/haptics';

const INITIAL_RENDER_LIMIT = 24;

/* ══════════════════════════════════════════════════════════════════ */
/* MEMOIZED GRID CARD ITEM                                            */
/* ══════════════════════════════════════════════════════════════════ */
const GarageGridCard = React.memo<{ card: CarCard; onClick: (card: CarCard) => void }>(({ card, onClick }) => {
  const rarityConf = RARITY_CONFIG[card.rarity] || RARITY_CONFIG.rare;
  const topSpeed = card.topSpeedKmH || 260;
  const hp = card.horsepower || 450;
  const optimizedUrl = getOptimizedImageUrl(card.imageUrl, 'card');

  return (
    <div
      onClick={() => onClick(card)}
      className={`relative rounded-2xl overflow-hidden glass-card-spatial border hover:border-white/[0.25] active:scale-[0.97] transition-all cursor-pointer group flex flex-col shadow-xl ${
        card.pendingDeletionUntil ? 'border-amber-500/50 ring-1 ring-amber-500/30' : 'border-white/[0.09]'
      }`}
    >
      {/* Vehicle Image Container */}
      <div className="relative aspect-[4/3] bg-black overflow-hidden">
        <img 
          src={optimizedUrl} 
          alt={card.model} 
          loading="lazy"
          decoding="async"
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#101010] via-transparent to-transparent opacity-90" />

        {/* Floating Rarity Badge */}
        <div className="absolute top-2 left-2">
          <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border shadow-lg backdrop-blur-md ${rarityConf.badgeBg}`}>
            {rarityConf.label}
          </span>
        </div>

        {/* Pending Deletion Grace Period Indicator */}
        {card.pendingDeletionUntil && (
          <div className="absolute bottom-2 left-2 right-2 z-10">
            <span className="text-[9px] font-bold px-2 py-0.5 rounded-lg bg-amber-500/95 text-black shadow-md flex items-center justify-center gap-1 font-data">
              <Clock className="w-2.5 h-2.5" /> Deleting in 3d · Tap to Restore
            </span>
          </div>
        )}

        {card.generation && (
          <div className="absolute top-2 right-2">
            <span className="text-[9px] font-data bg-black/70 backdrop-blur-md text-white/80 px-1.5 py-0.5 rounded border border-white/10">
              {card.generation}
            </span>
          </div>
        )}
      </div>

      {/* Vehicle Details */}
      <div className="p-3 bg-gradient-to-b from-[#141414] to-[#0d0d0d] space-y-1.5 flex-1 flex flex-col justify-between">
        <div>
          <span className="text-[10px] font-semibold text-white/50 uppercase tracking-wider block truncate">
            {card.make}
          </span>
          <h3 className="text-xs font-bold text-white leading-tight truncate">
            {card.model}
          </h3>
        </div>

        {/* Key Performance Indicators */}
        <div className="pt-2 border-t border-white/[0.06] flex items-center justify-between text-[10px] text-white/70 font-data">
          <span className="font-semibold text-white/90">{hp} HP</span>
          <div className="w-1 h-1 rounded-full bg-white/30" />
          <span>{topSpeed} KM/H</span>
        </div>
      </div>
    </div>
  );
});

GarageGridCard.displayName = 'GarageGridCard';

/* ══════════════════════════════════════════════════════════════════ */
/* MEMOIZED LIST CARD ITEM                                            */
/* ══════════════════════════════════════════════════════════════════ */
const GarageListCard = React.memo<{ card: CarCard; onClick: (card: CarCard) => void }>(({ card, onClick }) => {
  const rarityConf = RARITY_CONFIG[card.rarity] || RARITY_CONFIG.rare;
  const optimizedUrl = getOptimizedImageUrl(card.imageUrl, 'thumbnail');

  return (
    <div
      onClick={() => onClick(card)}
      className={`p-3 rounded-2xl glass-panel border hover:border-white/[0.2] active:scale-[0.98] flex items-center justify-between transition-all cursor-pointer group shadow-lg ${
        card.pendingDeletionUntil ? 'border-amber-500/50 ring-1 ring-amber-500/30' : 'border-white/[0.09]'
      }`}
    >
      <div className="flex items-center gap-3.5 min-w-0">
        <img 
          src={optimizedUrl} 
          alt={card.model} 
          loading="lazy"
          decoding="async"
          className="w-16 h-16 rounded-xl object-cover border border-white/[0.1] bg-black shrink-0 shadow-md"
        />
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border backdrop-blur-md ${rarityConf.badgeBg}`}>
              {rarityConf.label}
            </span>
            {card.generation && (
              <span className="text-[10px] text-white/40 font-data">
                {card.generation}
              </span>
            )}
            {card.pendingDeletionUntil && (
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-500/90 text-black flex items-center gap-0.5 font-data">
                <Clock className="w-2.5 h-2.5" /> Deleting in 3d
              </span>
            )}
          </div>
          <h3 className="text-sm font-bold text-white truncate mt-1">
            {card.make} {card.model}
          </h3>
          <p className="text-xs text-white/50 font-data mt-0.5">
            {card.horsepower || 450} hp • {card.topSpeedKmH || 260} km/h • {card.engine || 'ICE'}
          </p>
        </div>
      </div>

      <ChevronRight className="w-4 h-4 text-white/30 group-hover:text-white shrink-0 ml-2 transition-colors" />
    </div>
  );
});

GarageListCard.displayName = 'GarageListCard';

/* ══════════════════════════════════════════════════════════════════ */
/* MAIN GARAGE SCREEN                                                 */
/* ══════════════════════════════════════════════════════════════════ */
export const GarageScreen: React.FC = () => {
  const garage = useApexStore(s => s.garage);
  const setScannerOpen = useApexStore(s => s.setScannerOpen);
  const setSelectedCardForDetail = useApexStore(s => s.setSelectedCardForDetail);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRarity, setSelectedRarity] = useState<RarityTier | 'all'>('all');
  const [visibleCount, setVisibleCount] = useState(INITIAL_RENDER_LIMIT);

  // Non-blocking concurrent search input scheduling
  const deferredSearch = useDeferredValue(searchQuery);

  // Single-Pass O(N) Aggregation for Stats & Rarity Counts
  const { stats, rarityCounts } = useMemo(() => {
    let totalHp = 0;
    let topSpeedMax = 0;
    let mythicCount = 0;
    let legendaryCount = 0;
    let epicCount = 0;
    const counts: Record<string, number> = {
      mythic: 0,
      legendary: 0,
      epic: 0,
      rare: 0,
      uncommon: 0,
      common: 0
    };

    for (let i = 0; i < garage.length; i++) {
      const c = garage[i];
      totalHp += (c.horsepower || 300);
      if ((c.topSpeedKmH || 240) > topSpeedMax) {
        topSpeedMax = c.topSpeedKmH || 240;
      }
      if (c.rarity === 'mythic') mythicCount++;
      else if (c.rarity === 'legendary') legendaryCount++;
      else if (c.rarity === 'epic') epicCount++;

      if (counts[c.rarity] !== undefined) {
        counts[c.rarity]++;
      }
    }

    return {
      stats: { totalHp, topSpeedMax, mythicCount, legendaryCount, epicCount },
      rarityCounts: counts
    };
  }, [garage]);

  // Memoized Filtered Garage Cards
  const filteredGarage = useMemo(() => {
    const cleanSearch = deferredSearch.toLowerCase().trim();
    return garage.filter((card) => {
      const matchesSearch = !cleanSearch || `${card.make} ${card.model} ${card.generation || ''}`.toLowerCase().includes(cleanSearch);
      const matchesRarity = selectedRarity === 'all' || card.rarity === selectedRarity;
      return matchesSearch && matchesRarity;
    });
  }, [garage, deferredSearch, selectedRarity]);

  // Windowed visible slice
  const visibleCards = useMemo(() => {
    return filteredGarage.slice(0, visibleCount);
  }, [filteredGarage, visibleCount]);

  const handleCardClick = useCallback((card: CarCard) => {
    hapticTap();
    sounds.playTargetLock();
    setSelectedCardForDetail(card);
  }, [setSelectedCardForDetail]);

  const handleLoadMore = () => {
    hapticTap();
    sounds.playTargetLock();
    setVisibleCount(prev => prev + 24);
  };

  return (
    <div className="flex-1 w-full pb-36 px-4 pt-3 space-y-4 font-sans bg-black max-w-lg mx-auto">
      
      {/* ─── 1. TOP MOBILE HEADER & METRICS SUMMARY BAR ─── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div 
              className="w-1.5 h-6 rounded-full" 
              style={{ backgroundColor: 'var(--accent-color)', boxShadow: '0 0 10px var(--accent-color)' }}
            />
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight leading-none">
                Showroom Vault
              </h1>
              <p className="text-[11px] text-white/50 font-data mt-1 uppercase tracking-wider">
                {garage.length} Vehicles Collected
              </p>
            </div>
          </div>

          {/* View Mode Switcher + Add Button */}
          <div className="flex items-center gap-2">
            <div className="flex items-center bg-black/50 p-1 rounded-2xl border border-white/[0.08] backdrop-blur-md">
              <button
                onClick={() => { 
                  hapticImpact('light');
                  sounds.playTargetLock(); 
                  setViewMode('grid'); 
                }}
                className={`p-1.5 rounded-xl transition-all cursor-pointer ${
                  viewMode === 'grid' 
                    ? 'text-white shadow-md' 
                    : 'text-white/40 hover:text-white'
                }`}
                style={viewMode === 'grid' ? { backgroundColor: 'var(--accent-color)' } : undefined}
                title="Grid View"
              >
                <Grid className="w-4 h-4" />
              </button>
              <button
                onClick={() => { 
                  hapticImpact('light');
                  sounds.playTargetLock(); 
                  setViewMode('list'); 
                }}
                className={`p-1.5 rounded-xl transition-all cursor-pointer ${
                  viewMode === 'list' 
                    ? 'text-white shadow-md' 
                    : 'text-white/40 hover:text-white'
                }`}
                style={viewMode === 'list' ? { backgroundColor: 'var(--accent-color)' } : undefined}
                title="List View"
              >
                <List className="w-4 h-4" />
              </button>
            </div>

            <button
              onClick={() => { 
                hapticImpact('medium');
                sounds.playTargetLock(); 
                setScannerOpen(true); 
              }}
              className="p-2.5 rounded-2xl text-white shadow-xl active:scale-95 transition-all cursor-pointer border border-white/15"
              style={{
                backgroundColor: 'var(--accent-color)',
                boxShadow: '0 4px 16px var(--accent-glow)'
              }}
              title="Scan New Vehicle"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Dynamic Telemetry Stats Pill Bar */}
        <div className="glass-panel grid grid-cols-3 gap-2 p-2.5 rounded-3xl border border-white/[0.09] shadow-xl">
          <div className="text-center p-2 rounded-2xl bg-black/40 border border-white/[0.05]">
            <span className="text-[9px] font-data text-white/40 uppercase block">HIGHEST TIER</span>
            <span 
              className="text-xs font-bold flex items-center justify-center gap-1 mt-0.5"
              style={{ color: 'var(--accent-color)' }}
            >
              <Trophy className="w-3 h-3" style={{ color: 'var(--accent-color)' }} />
              {stats.mythicCount > 0 ? 'Mythic' : stats.legendaryCount > 0 ? 'Legendary' : stats.epicCount > 0 ? 'Epic' : 'Rare'}
            </span>
          </div>

          <div className="text-center p-2 rounded-2xl bg-black/40 border border-white/[0.05]">
            <span className="text-[9px] font-data text-white/40 uppercase block">TOP SPEED</span>
            <span className="text-xs font-bold text-white flex items-center justify-center gap-1 mt-0.5">
              <Gauge className="w-3 h-3 text-white/50" />
              {stats.topSpeedMax > 0 ? `${stats.topSpeedMax} km/h` : '—'}
            </span>
          </div>

          <div className="text-center p-2 rounded-2xl bg-black/40 border border-white/[0.05]">
            <span className="text-[9px] font-data text-white/40 uppercase block">TOTAL POWER</span>
            <span className="text-xs font-bold text-white flex items-center justify-center gap-1 mt-0.5">
              <Zap className="w-3 h-3 text-yellow-400" />
              {stats.totalHp > 0 ? `${stats.totalHp.toLocaleString()} hp` : '0 hp'}
            </span>
          </div>
        </div>
      </div>

      {/* ─── 2. SEARCH & FILTER SECTION ─── */}
      <div className="space-y-2.5">
        <div className="relative flex items-center">
          <Search className="absolute left-3.5 w-4 h-4 text-white/40 pointer-events-none" />
          <input
            type="text"
            placeholder="Search make, model, or year..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#141414]/90 backdrop-blur-md border border-white/[0.09] rounded-2xl pl-10 pr-9 py-2.5 text-xs text-white placeholder-white/30 focus:outline-none focus:border-white/30 transition-colors shadow-inner"
          />
          {searchQuery && (
            <button
              onClick={() => {
                hapticTap();
                setSearchQuery('');
              }}
              className="absolute right-3 p-1 text-white/40 hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Scrollable Rarity Filter Chips */}
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar py-0.5">
          <button
            onClick={() => { 
              hapticTap();
              sounds.playTargetLock(); 
              setSelectedRarity('all'); 
            }}
            className={`flex-shrink-0 px-3 py-1.5 rounded-xl text-xs transition-all border whitespace-nowrap active:scale-95 cursor-pointer ${
              selectedRarity === 'all' 
                ? 'text-white font-semibold shadow-md' 
                : 'bg-black/40 text-white/60 border-white/[0.08] hover:border-white/20'
            }`}
            style={selectedRarity === 'all' ? {
              backgroundColor: 'var(--accent-color)',
              borderColor: 'var(--accent-color)',
              boxShadow: '0 2px 10px var(--accent-glow)'
            } : undefined}
          >
            All ({garage.length})
          </button>
          {(['mythic', 'legendary', 'epic', 'rare', 'uncommon', 'common'] as const).map((r) => {
            const count = rarityCounts[r] || 0;
            const rConf = RARITY_CONFIG[r];
            const isSelected = selectedRarity === r;
            return (
              <button
                key={r}
                onClick={() => { 
                  hapticTap();
                  sounds.playTargetLock(); 
                  setSelectedRarity(r); 
                }}
                className={`flex-shrink-0 px-3 py-1.5 rounded-xl text-xs transition-all border whitespace-nowrap active:scale-95 cursor-pointer ${
                  isSelected 
                    ? 'text-white font-semibold shadow-md' 
                    : 'bg-black/40 text-white/60 border-white/[0.08] hover:border-white/20'
                }`}
                style={isSelected ? {
                  backgroundColor: 'var(--accent-color)',
                  borderColor: 'var(--accent-color)',
                  boxShadow: '0 2px 10px var(--accent-glow)'
                } : undefined}
              >
                {rConf.label} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* ─── 3. CARDS DISPLAY (GRID OR LIST VIEW WITH WINDOWING) ─── */}
      {filteredGarage.length > 0 ? (
        <div className="space-y-4">
          {viewMode === 'grid' ? (
            <div className="grid grid-cols-2 gap-3 pt-1">
              {visibleCards.map((card) => (
                <GarageGridCard 
                  key={card.id} 
                  card={card} 
                  onClick={handleCardClick} 
                />
              ))}
            </div>
          ) : (
            <div className="space-y-2.5 pt-1">
              {visibleCards.map((card) => (
                <GarageListCard 
                  key={card.id} 
                  card={card} 
                  onClick={handleCardClick} 
                />
              ))}
            </div>
          )}

          {/* Load More Window for large garages */}
          {visibleCards.length < filteredGarage.length && (
            <button
              onClick={handleLoadMore}
              className="w-full py-3 rounded-2xl glass-panel border border-white/[0.09] hover:border-white/20 text-white/80 hover:text-white font-medium text-xs flex items-center justify-center gap-1.5 transition-all shadow-md active:scale-[0.99] cursor-pointer"
            >
              <span>Show More Vehicles ({filteredGarage.length - visibleCards.length} remaining)</span>
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      ) : (
        /* Empty State */
        <div className="text-center py-16 space-y-4 glass-panel border border-white/[0.09] rounded-3xl p-6 shadow-2xl">
          <div className="w-14 h-14 rounded-2xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center mx-auto shadow-inner">
            <Sparkles className="w-6 h-6" style={{ color: 'var(--accent-color)' }} />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-white">
              {searchQuery ? 'No matching vehicles' : 'Your Garage is Empty'}
            </h3>
            <p className="text-xs text-white/50 max-w-xs mx-auto">
              {searchQuery 
                ? `No cars found for "${searchQuery}". Try a different search term.` 
                : 'Point your camera scanner at real vehicles on the street to start building your collection.'}
            </p>
          </div>
          
          <button
            onClick={() => {
              hapticImpact('medium');
              sounds.playTargetLock();
              if (searchQuery) setSearchQuery('');
              else setScannerOpen(true);
            }}
            className="px-6 py-3 rounded-2xl text-white font-semibold text-xs transition-all shadow-xl active:scale-95 inline-flex items-center gap-2 cursor-pointer border border-white/10"
            style={{
              backgroundColor: 'var(--accent-color)',
              boxShadow: '0 4px 16px var(--accent-glow)'
            }}
          >
            {searchQuery ? 'Clear Search' : 'Scan Your First Car →'}
          </button>
        </div>
      )}
    </div>
  );
};
