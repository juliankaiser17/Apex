import React, { useState, useMemo, useDeferredValue, useCallback } from 'react';
import { Search, Grid, List, X, Sparkles, AlertCircle } from 'lucide-react';
import { useApexStore } from '../../store/useApexStore';
import type { CarCard } from '../../types/apex';
import { sounds } from '../../utils/audio';
import { hapticTap } from '../../utils/haptics';
import { computeAuthoritativeStats } from '../../utils/userStats';
import { Slab } from '../ui/Slab';
import { RarityBadge, type RarityTier } from '../ui/RarityBadge';
import { Button } from '../ui/Button';

const INITIAL_RENDER_LIMIT = 24;

const GHOST_TIERS: RarityTier[] = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic'];

// Example Mythic car fixture (strictly static demonstration asset; never saved to user store)
const EXAMPLE_MYTHIC_FIXTURE: CarCard = {
  id: 'fixture-mythic-example',
  make: 'Bugatti',
  model: 'Chiron Super Sport 300+',
  yearEstimate: '2021',
  color: 'Black / Orange',
  bodyStyle: 'Coupe',
  rarity: 'mythic',
  rarityScore: 99,
  cardNumber: 'APX-M001',
  imageUrl: '/bugatti-chiron.png',
  city: 'Molsheim',
  country: 'France',
  originCountry: 'France',
  horsepower: 1600,
  topSpeedKmH: 490,
  zeroToHundredSec: 2.4,
  kerbWeightKg: 1978,
  torqueNm: 1600,
  interestingFact: 'First production car to break 300 mph barrier.',
  briefHistory: 'Limited edition longtail hypercar engineered for high-speed aerodynamics.',
  modsDetected: [],
  latApprox: 48.5,
  lngApprox: 7.5,
  xpEarned: 1500,
  marketValueLowUsd: 3800000,
  marketValueHighUsd: 4200000,
  scanValidated: true,
  isPublic: true,
  huntTriggered: false,
  privacyLevel: 'public_blurred',
  aiConfidence: 0.99,
  createdAt: '2026-10-11T00:00:00Z',
};

export const GarageScreen: React.FC = () => {
  const garage = useApexStore(s => s.garage);
  const badges = useApexStore(s => s.badges);
  const user = useApexStore(s => s.user);
  const setScannerOpen = useApexStore(s => s.setScannerOpen);
  const setSelectedCardForDetail = useApexStore(s => s.setSelectedCardForDetail);

  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const [selectedRarity, setSelectedRarity] = useState<RarityTier | 'all'>('all');
  const [visibleCount, setVisibleCount] = useState(INITIAL_RENDER_LIMIT);
  const [isExampleModalOpen, setIsExampleModalOpen] = useState(false);

  const deferredSearch = useDeferredValue(searchQuery);

  // Authoritative metrics aggregation
  const { stats, rarityCounts, existingTiers } = useMemo(() => {
    const authStats = computeAuthoritativeStats(garage, badges, user);
    const counts: Record<RarityTier, number> = {
      mythic: authStats.mythicCount,
      legendary: authStats.legendaryCount,
      epic: authStats.epicCount,
      rare: authStats.rareCount,
      uncommon: authStats.uncommonCount,
      common: authStats.commonCount,
    };

    // Filter only tiers with at least 1 car
    const active = GHOST_TIERS.filter(t => (counts[t] || 0) > 0);

    return {
      stats: {
        highestTier: (garage.length > 0
          ? (authStats.highestTierLabel.toLowerCase() as RarityTier)
          : 'common'),
        topSpeed: authStats.topSpeedKmH,
        totalHp: authStats.totalHorsepower,
      },
      rarityCounts: counts,
      existingTiers: active,
    };
  }, [garage, badges, user]);

  // Filtered Cards
  const filteredGarage = useMemo(() => {
    const cleanSearch = deferredSearch.toLowerCase().trim();
    return garage.filter((card) => {
      const matchesSearch =
        !cleanSearch ||
        `${card.make} ${card.model} ${card.generation || ''}`.toLowerCase().includes(cleanSearch);
      const matchesRarity = selectedRarity === 'all' || card.rarity === selectedRarity;
      return matchesSearch && matchesRarity;
    });
  }, [garage, deferredSearch, selectedRarity]);

  const visibleCards = useMemo(() => {
    return filteredGarage.slice(0, visibleCount);
  }, [filteredGarage, visibleCount]);

  const handleCardClick = useCallback(
    (card: CarCard) => {
      hapticTap();
      sounds.playTargetLock();
      setSelectedCardForDetail(card);
    },
    [setSelectedCardForDetail]
  );

  const handleLoadMore = () => {
    hapticTap();
    sounds.playTargetLock();
    setVisibleCount(prev => prev + 24);
  };

  return (
    <div className="flex-1 w-full pb-36 px-4 pt-3 space-y-6 font-sans bg-[var(--color-void)] max-w-lg mx-auto select-none">
      {/* ─── 1. HEADER (Display-L, Mono Count, View Toggle) ─── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-display-l text-[var(--color-text)] tracking-tight uppercase leading-none">
            Garage
          </h1>
          <p className="font-mono text-secondary text-[var(--color-text-3)] mt-1 tabular-nums">
            {garage.length} {garage.length === 1 ? 'car' : 'cars'}
          </p>
        </div>

        {/* Controls: Search Toggle + Grid/List View */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              hapticTap();
              setIsSearchExpanded(prev => !prev);
            }}
            aria-label="Toggle search"
            className="w-10 h-10 rounded-[var(--radius-button)] bg-[var(--color-panel-2)] border border-[var(--color-line)] flex items-center justify-center text-[var(--color-text-2)] hover:text-[var(--color-text)] cursor-pointer active:scale-95 transition-transform"
          >
            <Search size={16} />
          </button>

          <div className="flex items-center bg-[var(--color-panel-2)] p-1 rounded-[var(--radius-button)] border border-[var(--color-line)]">
            <button
              onClick={() => {
                hapticTap();
                setViewMode('grid');
              }}
              aria-label="Grid view"
              className={`p-2 rounded-[var(--radius-chip)] transition-all cursor-pointer ${
                viewMode === 'grid'
                  ? 'bg-[var(--color-panel)] text-[var(--color-text)] shadow-sm'
                  : 'text-[var(--color-text-3)] hover:text-[var(--color-text)]'
              }`}
            >
              <Grid size={16} />
            </button>
            <button
              onClick={() => {
                hapticTap();
                setViewMode('list');
              }}
              aria-label="List view"
              className={`p-2 rounded-[var(--radius-chip)] transition-all cursor-pointer ${
                viewMode === 'list'
                  ? 'bg-[var(--color-panel)] text-[var(--color-text)] shadow-sm'
                  : 'text-[var(--color-text-3)] hover:text-[var(--color-text)]'
              }`}
            >
              <List size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Expandable Search Input */}
      {isSearchExpanded && (
        <div className="relative flex items-center animate-fadeIn">
          <Search size={16} className="absolute left-3.5 text-[var(--color-text-3)] pointer-events-none" />
          <input
            type="text"
            placeholder="Search make, model, or year..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[var(--color-panel-2)] border border-[var(--color-line)] rounded-[var(--radius-button)] pl-10 pr-9 py-2.5 text-secondary text-[var(--color-text)] placeholder-[var(--color-text-off)] focus:outline-none focus:border-[var(--color-text-3)] transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 p-1 text-[var(--color-text-3)] hover:text-[var(--color-text)]"
            >
              <X size={14} />
            </button>
          )}
        </div>
      )}

      {/* ─── 2. STATS STRIP (Only when garage.length > 0) ─── */}
      {garage.length > 0 && (
        <div className="rounded-[var(--radius-panel)] border border-[var(--color-line)] bg-[var(--color-panel)] grid grid-cols-3 divide-x divide-[var(--color-line)] py-3 px-2">
          {/* Highest Tier */}
          <div className="flex flex-col items-center justify-center px-2 text-center">
            <span className="text-[11px] font-medium text-[var(--color-text-3)] uppercase tracking-wider mb-1">
              Top Tier
            </span>
            <RarityBadge rarity={stats.highestTier} size="sm" />
          </div>

          {/* Top Speed */}
          <div className="flex flex-col items-center justify-center px-2 text-center">
            <span className="text-[11px] font-medium text-[var(--color-text-3)] uppercase tracking-wider mb-0.5">
              Top Speed
            </span>
            <div className="font-mono text-display-m font-bold text-[var(--color-text)] tabular-nums leading-none">
              {stats.topSpeed}
              <span className="font-sans text-[11px] font-normal text-[var(--color-text-3)] ml-1">
                km/h
              </span>
            </div>
          </div>

          {/* Total Power */}
          <div className="flex flex-col items-center justify-center px-2 text-center">
            <span className="text-[11px] font-medium text-[var(--color-text-3)] uppercase tracking-wider mb-0.5">
              Total Power
            </span>
            <div className="font-mono text-display-m font-bold text-[var(--color-text)] tabular-nums leading-none">
              {stats.totalHp.toLocaleString()}
              <span className="font-sans text-[11px] font-normal text-[var(--color-text-3)] ml-1">
                HP
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ─── 3. FILTERS (Only existing tiers, no zero chips) ─── */}
      {garage.length > 0 && existingTiers.length > 1 && (
        <div className="flex gap-2 overflow-x-auto no-scrollbar py-0.5">
          <button
            onClick={() => {
              hapticTap();
              setSelectedRarity('all');
            }}
            className={`px-3 py-1.5 rounded-[var(--radius-chip)] text-secondary transition-all cursor-pointer whitespace-nowrap ${
              selectedRarity === 'all'
                ? 'bg-[var(--color-text)] text-[var(--color-void)] font-bold'
                : 'bg-[var(--color-panel-2)] text-[var(--color-text-2)] border border-[var(--color-line)]'
            }`}
          >
            All ({garage.length})
          </button>
          {existingTiers.map((tier) => {
            const count = rarityCounts[tier] || 0;
            const isSelected = selectedRarity === tier;
            return (
              <button
                key={tier}
                onClick={() => {
                  hapticTap();
                  setSelectedRarity(tier);
                }}
                className={`px-3 py-1.5 rounded-[var(--radius-chip)] text-secondary transition-all cursor-pointer whitespace-nowrap capitalize ${
                  isSelected
                    ? 'bg-[var(--color-text)] text-[var(--color-void)] font-bold'
                    : 'bg-[var(--color-panel-2)] text-[var(--color-text-2)] border border-[var(--color-line)]'
                }`}
              >
                {tier} ({count})
              </button>
            );
          })}
        </div>
      )}

      {/* ─── 4. COLLECTIBLE CARDS (Populated or Designed Empty State) ─── */}
      {garage.length > 0 ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            {visibleCards.map((card) => {
              const isHero = card.rarity === 'legendary' || card.rarity === 'mythic';
              return (
                <div key={card.id} className={isHero ? 'col-span-2' : 'col-span-1'}>
                  <Slab
                    rarity={card.rarity as RarityTier}
                    serial={card.cardNumber || 'APX-0000'}
                    imageUrl={card.imageUrl}
                    carName={card.model}
                    make={card.make}
                    city={card.city}
                    isHero={isHero}
                    onClick={() => handleCardClick(card)}
                    stats={{
                      hp: card.horsepower,
                      topSpeed: card.topSpeedKmH,
                      zeroToHundred: card.zeroToHundredSec,
                      weight: card.kerbWeightKg,
                    }}
                  />
                </div>
              );
            })}
          </div>

          {/* Load More Window */}
          {visibleCards.length < filteredGarage.length && (
            <Button variant="secondary" onClick={handleLoadMore} className="w-full">
              Show More Vehicles ({filteredGarage.length - visibleCards.length} remaining)
            </Button>
          )}
        </div>
      ) : (
        /* ─── 5. DESIGNED EMPTY STATE (6 Ghost Slots + Honest Guidance) ─── */
        <div className="space-y-6 pt-2">
          {/* 6 Ghost Slots in 2x3 Layout */}
          <div className="grid grid-cols-2 gap-3">
            {GHOST_TIERS.map((tier) => (
              <div
                key={tier}
                data-rarity={tier}
                className="rounded-[var(--radius-slab)] border border-dashed border-[var(--color-line)] bg-[var(--color-panel)]/40 p-3.5 aspect-[4/5] flex flex-col justify-between items-center text-center select-none"
              >
                <div className="w-full flex justify-between items-center">
                  <span className="font-mono text-[10px] text-[var(--color-text-off)]">
                    SLOT--
                  </span>
                  <div className="w-2 h-2 rounded-full bg-[var(--r)] shadow-[0_0_6px_var(--r-glow)]" />
                </div>

                <div className="w-12 h-12 rounded-full border border-[var(--r)]/30 flex items-center justify-center bg-[var(--color-panel-2)]/60">
                  <Sparkles size={18} className="text-[var(--r)] opacity-70" />
                </div>

                <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-[var(--r)]">
                  {tier}
                </span>
              </div>
            ))}
          </div>

          {/* Seductive Copy & Action */}
          <div className="text-center space-y-2 max-w-sm mx-auto">
            <h3 className="font-display text-display-m text-[var(--color-text)]">
              Nothing here yet.
            </h3>
            <p className="text-secondary text-[var(--color-text-3)] leading-relaxed">
              Your first scan lands here as a card. Rarer cars look very different.
            </p>
          </div>

          <div className="space-y-3 max-w-xs mx-auto">
            <Button
              variant="primary"
              className="w-full"
              onClick={() => {
                hapticTap();
                setScannerOpen(true);
              }}
            >
              Scan your first car
            </Button>

            <button
              onClick={() => setIsExampleModalOpen(true)}
              className="w-full text-secondary text-[var(--color-text-3)] hover:text-[var(--color-text)] transition-colors py-2 cursor-pointer font-medium underline underline-offset-4"
            >
              See what a Mythic looks like
            </button>
          </div>
        </div>
      )}

      {/* ─── 6. EXAMPLE MYTHIC MODAL (Visibly Labelled Static Asset) ─── */}
      {isExampleModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
          <div className="w-full max-w-sm space-y-4 animate-scalePop">
            <div className="flex items-center justify-between px-1">
              <span className="font-mono text-caption text-amber-400 font-bold uppercase tracking-wider bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 rounded-full flex items-center gap-1">
                <AlertCircle size={12} /> Example Demonstration Specimen
              </span>
              <button
                onClick={() => setIsExampleModalOpen(false)}
                className="w-8 h-8 rounded-full bg-[var(--color-panel-2)] border border-[var(--color-line)] flex items-center justify-center text-[var(--color-text)] cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <Slab
              rarity="mythic"
              serial="SAMPLE-000"
              imageUrl={EXAMPLE_MYTHIC_FIXTURE.imageUrl}
              carName={EXAMPLE_MYTHIC_FIXTURE.model}
              make={EXAMPLE_MYTHIC_FIXTURE.make}
              city="Molsheim"
              isHero
              stats={{
                hp: EXAMPLE_MYTHIC_FIXTURE.horsepower,
                topSpeed: EXAMPLE_MYTHIC_FIXTURE.topSpeedKmH,
                zeroToHundred: EXAMPLE_MYTHIC_FIXTURE.zeroToHundredSec,
                weight: EXAMPLE_MYTHIC_FIXTURE.kerbWeightKg,
              }}
            />

            <Button
              variant="secondary"
              className="w-full"
              onClick={() => setIsExampleModalOpen(false)}
            >
              Close Specimen
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

GarageScreen.displayName = 'GarageScreen';
