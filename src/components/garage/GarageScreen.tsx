import React, { useState } from 'react';
import { Search, Grid, List, Filter, Plus } from 'lucide-react';
import { useApexStore } from '../../store/useApexStore';
import type { RarityTier } from '../../types/apex';
import { RARITY_CONFIG } from '../../utils/rarity';

export const GarageScreen: React.FC = () => {
  const { garage, setScannerOpen, setSelectedCardForDetail } = useApexStore();
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRarity, setSelectedRarity] = useState<RarityTier | 'all'>('all');

  const filteredGarage = garage.filter((card) => {
    const matchesSearch = `${card.make} ${card.model}`.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRarity = selectedRarity === 'all' || card.rarity === selectedRarity;
    return matchesSearch && matchesRarity;
  });

  const rarityCounts = {
    mythic: garage.filter(c => c.rarity === 'mythic').length,
    legendary: garage.filter(c => c.rarity === 'legendary').length,
    epic: garage.filter(c => c.rarity === 'epic').length
  };

  return (
    <div className="flex-1 pb-24 px-4 pt-4 max-w-md mx-auto space-y-4" style={{ fontFamily: 'DM Sans' }}>
      {/* Garage Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-4xl text-[#F0EBE3] tracking-wide">MY GARAGE</h1>
          <p className="text-xs font-data text-[#9A9088]">
            {garage.length} Cars · {rarityCounts.legendary} Legendary · {rarityCounts.mythic} Mythic
          </p>
        </div>

        {/* View Toggle Buttons */}
        <div className="flex items-center gap-1 bg-[#1A1A1A] p-1 rounded-xl border border-[#2C2C2C]">
          <button
            onClick={() => setViewMode('grid')}
            className={`p-1.5 rounded-lg transition-colors ${viewMode === 'grid' ? 'bg-[#FF4500] text-[#F0EBE3]' : 'text-[#9A9088] hover:text-[#F0EBE3]'}`}
          >
            <Grid className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`p-1.5 rounded-lg transition-colors ${viewMode === 'list' ? 'bg-[#FF4500] text-[#F0EBE3]' : 'text-[#9A9088] hover:text-[#F0EBE3]'}`}
          >
            <List className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="space-y-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9A9088]" />
          <input
            type="text"
            placeholder="Search make or model..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#111111] border border-[#2C2C2C] rounded-xl pl-9 pr-4 py-2.5 text-xs text-[#F0EBE3] placeholder-[#5A5550] focus:outline-none focus:border-[#FF4500]"
          />
        </div>

        {/* Rarity Filter Chips */}
        <div className="flex gap-2 overflow-x-auto no-scrollbar py-1">
          <button
            onClick={() => setSelectedRarity('all')}
            className={`px-3 py-1 rounded-lg text-xs font-data transition-all border ${
              selectedRarity === 'all' 
                ? 'bg-[#FF4500] text-[#F0EBE3] border-[#FF6A00] font-semibold' 
                : 'bg-[#1A1A1A] text-[#9A9088] border-[#2C2C2C] hover:border-[#FF4500]/40'
            }`}
          >
            ALL ({garage.length})
          </button>
          {(['mythic', 'legendary', 'epic', 'rare', 'uncommon', 'common'] as const).map((r) => {
            const count = garage.filter(c => c.rarity === r).length;
            return (
              <button
                key={r}
                onClick={() => setSelectedRarity(r)}
                className={`px-3 py-1 rounded-lg text-xs font-data uppercase transition-all border whitespace-nowrap ${
                  selectedRarity === r 
                    ? 'bg-[#FF4500] text-[#F0EBE3] border-[#FF6A00] font-semibold' 
                    : 'bg-[#1A1A1A] text-[#9A9088] border-[#2C2C2C] hover:border-[#FF4500]/40'
                }`}
              >
                {r} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* Cards Grid / List View */}
      {filteredGarage.length > 0 ? (
        viewMode === 'grid' ? (
          <div className="grid grid-cols-2 gap-3">
            {filteredGarage.map((card) => {
              const rarityConf = RARITY_CONFIG[card.rarity];
              const cardNumStr = card.cardNumber || 'APX-001';
              const topSpeed = card.topSpeedKmH || 260;
              const hp = card.horsepower || 450;

              // Calculate OVR Score
              const isMythic = card.rarity === 'mythic';
              const isLegendary = card.rarity === 'legendary';
              const rawOvr = Math.round(((topSpeed / 420) * 35 + (hp / 1500) * 45 + 20) * (isMythic ? 1.25 : isLegendary ? 1.15 : 1.0));
              const ovrScore = Math.min(99, Math.max(65, rawOvr));

              return (
                <div
                  key={card.id}
                  onClick={() => setSelectedCardForDetail(card)}
                  className={`group relative rounded-xl overflow-hidden border-2 ${rarityConf.borderClass} bg-[#0E0E0E] cursor-pointer hover:scale-[1.03] transition-all shadow-xl ${
                    isMythic ? 'animate-gradient-border shadow-[0_0_24px_rgba(255,34,0,0.4)]' : ''
                  }`}
                >
                  {/* Image Header */}
                  <div className="relative h-32 overflow-hidden bg-[#050505]">
                    <img 
                      src={card.imageUrl} 
                      alt={card.model} 
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" 
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#0E0E0E] via-transparent to-transparent" />
                    
                    {/* OVR Rating Badge Top-Left */}
                    <div className="absolute top-2 left-2 z-10">
                      <div className="px-1.5 py-0.5 rounded bg-[#080808]/85 backdrop-blur-md border border-white/20 font-data text-[10px] text-[#F0EBE3] font-bold flex items-center gap-0.5 shadow-md">
                        <span className="text-[#FF4500]">⚡</span>
                        <span className="font-display text-xs">{ovrScore}</span>
                      </div>
                    </div>

                    {/* Rarity Pill Top-Right */}
                    <div className="absolute top-2 right-2 z-10">
                      <span className={`text-[9px] font-data font-bold px-1.5 py-0.5 rounded border ${rarityConf.badgeBg} shadow-md uppercase tracking-wider`}>
                        {rarityConf.label}
                      </span>
                    </div>

                    {/* Holographic Sweep */}
                    <div className="absolute inset-0 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                      <div className="w-[200%] h-[200%] absolute -top-1/2 -left-1/2 bg-gradient-to-r from-transparent via-white/20 to-transparent transform -rotate-[30deg] animate-[sweep_3s_infinite_linear]" />
                    </div>
                  </div>

                  {/* Card Info & Performance Specs */}
                  <div className="p-2.5 bg-[#0E0E0E] border-t border-[#2C2C2C] space-y-1.5">
                    <div>
                      <h4 className="font-display text-base text-[#F0EBE3] truncate leading-tight uppercase tracking-wide group-hover:text-[#FF4500] transition-colors">{card.make}</h4>
                      <p className="text-xs text-[#9A9088] font-medium truncate font-data">{card.model}</p>
                    </div>

                    {/* Stats bar */}
                    <div className="flex items-center justify-between text-[10px] font-data text-[#F0EBE3]/90 pt-1 border-t border-[#2C2C2C]/80">
                      <span className="font-bold text-[#FFA500]">{hp} HP</span>
                      <span className="text-[#9A9088]">·</span>
                      <span className="font-bold">{topSpeed} KM/H</span>
                      <span className="text-[#9A9088]">·</span>
                      <span className="text-[#FF4500] font-semibold">#{cardNumStr.slice(-4)}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="space-y-2">
            {filteredGarage.map((card) => {
              const rarityConf = RARITY_CONFIG[card.rarity];
              return (
                <div
                  key={card.id}
                  onClick={() => setSelectedCardForDetail(card)}
                  className={`p-3 rounded-xl bg-[#111111] border ${rarityConf.borderClass} flex items-center justify-between cursor-pointer hover:border-[#FF4500]/50 transition-all`}
                >
                  <div className="flex items-center gap-3">
                    <img src={card.imageUrl} alt={card.model} className="w-14 h-14 rounded-lg object-cover border border-[#2C2C2C]" />
                    <div>
                      <h4 className="font-display text-lg text-[#F0EBE3]">{card.make} {card.model}</h4>
                      <p className="text-xs text-[#9A9088] font-data">{card.releasedYear || card.yearEstimate} · {card.engine || 'V8'}</p>
                    </div>
                  </div>
                  <span className={`text-xs font-data font-semibold px-2.5 py-1 rounded border ${rarityConf.badgeBg}`}>
                    {rarityConf.label}
                  </span>
                </div>
              );
            })}
          </div>
        )
      ) : (
        /* Empty State */
        <div className="text-center py-16 px-4 space-y-4 bg-[#111111] rounded-xl border border-[#2C2C2C]">
          <div className="w-16 h-16 rounded-full bg-[#1A1A1A] border border-[#FF4500] flex items-center justify-center mx-auto text-[#FF4500] glow-orange">
            <Filter className="w-8 h-8" />
          </div>
          <div>
            <h3 className="font-display text-2xl text-[#F0EBE3]">NO CARS FOUND</h3>
            <p className="text-xs text-[#9A9088] mt-1 max-w-xs mx-auto">
              Every car you scan becomes a collectible 3D trading card.
            </p>
          </div>
          <button
            onClick={() => setScannerOpen(true)}
            className="py-3 px-6 rounded-xl bg-[#FF4500] text-[#F0EBE3] font-display text-lg tracking-wider glow-orange inline-flex items-center gap-2"
          >
            <Plus className="w-5 h-5" /> SCAN YOUR FIRST CAR
          </button>
        </div>
      )}
    </div>
  );
};
