import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, X, Check, Car, ChevronRight } from 'lucide-react';
import type { CarCard, RarityTier } from '../../types/apex';
import { SMART_CAR_DATABASE } from '../../services/aiVisionService';
import { sounds } from '../../utils/audio';

interface VehicleSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentCard: CarCard;
  onConfirm: (updatedCard: CarCard) => void;
}

export const POPULAR_VEHICLES = [
  { key: 'supra', make: 'Toyota', model: 'GR Supra 3.0 (A90)', country: 'Japan', rarity: 'epic' as RarityTier },
  { key: 'porsche997', make: 'Porsche', model: '911 Carrera S (997)', country: 'Germany', rarity: 'rare' as RarityTier },
  { key: 'porsche996', make: 'Porsche', model: '911 Carrera Cabriolet (996)', country: 'Germany', rarity: 'rare' as RarityTier },
  { key: 'mclaren650s', make: 'McLaren', model: '650S', country: 'United Kingdom', rarity: 'legendary' as RarityTier },
  { key: 'ferrari458', make: 'Ferrari', model: '458 Spider', country: 'Italy', rarity: 'legendary' as RarityTier },
  { key: 'lamborghini_huracan', make: 'Lamborghini', model: 'Huracán LP610-4', country: 'Italy', rarity: 'legendary' as RarityTier },
  { key: 'bmw_m3', make: 'BMW', model: 'M3 Competition (G80)', country: 'Germany', rarity: 'epic' as RarityTier },
  { key: 'gtr', make: 'Nissan', model: 'GT-R Nismo (R35)', country: 'Japan', rarity: 'legendary' as RarityTier },
  { key: 'dc_avanti', make: 'DC', model: 'Avanti', country: 'India', rarity: 'rare' as RarityTier },
];

export const VehicleSelectorModal: React.FC<VehicleSelectorModalProps> = ({
  isOpen,
  onClose,
  currentCard,
  onConfirm,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [customMake, setCustomMake] = useState('');
  const [customModel, setCustomModel] = useState('');
  const [isCustomMode, setIsCustomMode] = useState(false);

  if (!isOpen) return null;

  const filteredPresets = POPULAR_VEHICLES.filter(v =>
    `${v.make} ${v.model}`.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSelectPreset = (key: string) => {
    sounds.playTargetLock();
    const preset = SMART_CAR_DATABASE[key];
    if (preset) {
      const updatedCard: CarCard = {
        ...currentCard,
        make: preset.make,
        model: preset.model,
        generation: preset.generation,
        trim: preset.trim || undefined,
        yearEstimate: preset.year_estimate,
        releasedYear: preset.year_estimate,
        color: preset.color,
        bodyStyle: preset.body_style,
        rarity: preset.rarity,
        topSpeedKmH: preset.top_speed_kmh,
        horsepower: preset.horsepower,
        engine: preset.engine,
        zeroToHundredSec: preset.zero_to_hundred_seconds,
        torqueNm: preset.torque_nm,
        kerbWeightKg: preset.kerb_weight_kg,
        originCountry: preset.origin_country,
        interestingFact: preset.interesting_facts,
        briefHistory: preset.historical_information,
        modsDetected: preset.aftermarket_parts_detected.map(p => ({
          part: p.part_name,
          description: p.description,
          confidence: p.confidence
        })),
        marketValueLowUsd: preset.estimated_market_value_usd_low,
        marketValueHighUsd: preset.estimated_market_value_usd_high,
      };
      onConfirm(updatedCard);
      onClose();
    }
  };

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customMake.trim() || !customModel.trim()) return;
    sounds.playTargetLock();

    const updatedCard: CarCard = {
      ...currentCard,
      make: customMake.trim(),
      model: customModel.trim(),
      trim: 'Custom Spec',
      yearEstimate: '2023',
    };
    onConfirm(updatedCard);
    onClose();
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-xl flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="w-full max-w-md bg-[#111111] border border-[#FF4500]/50 rounded-3xl p-5 space-y-4 shadow-[0_0_50px_rgba(255,69,0,0.3)] text-[#F0EBE3]"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-[#2C2C2C] pb-3">
            <div className="flex items-center gap-2">
              <Car className="w-5 h-5 text-[#FF4500]" />
              <h3 className="font-display text-2xl tracking-wide">CONFIRM YOUR CAR MODEL</h3>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-[#1A1A1A] flex items-center justify-center text-[#9A9088] hover:text-[#F0EBE3]"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <p className="text-xs text-[#9A9088] font-data">
            Select your exact vehicle from the verified database or enter a custom model to guarantee 100% accuracy.
          </p>

          {/* Mode Toggle */}
          <div className="flex bg-[#1A1A1A] p-1 rounded-xl border border-[#2C2C2C] text-xs font-data">
            <button
              onClick={() => setIsCustomMode(false)}
              className={`flex-1 py-2 rounded-lg transition-all ${
                !isCustomMode ? 'bg-[#FF4500] text-[#F0EBE3] font-semibold' : 'text-[#9A9088]'
              }`}
            >
              VERIFIED DATABASE
            </button>
            <button
              onClick={() => setIsCustomMode(true)}
              className={`flex-1 py-2 rounded-lg transition-all ${
                isCustomMode ? 'bg-[#FF4500] text-[#F0EBE3] font-semibold' : 'text-[#9A9088]'
              }`}
            >
              TYPE CUSTOM MODEL
            </button>
          </div>

          {!isCustomMode ? (
            <div className="space-y-3">
              {/* Search Bar */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9A9088]" />
                <input
                  type="text"
                  placeholder="Search make or model (e.g. Porsche 911, Supra, BMW)..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full bg-[#080808] border border-[#2C2C2C] rounded-xl pl-9 pr-4 py-2.5 text-xs text-[#F0EBE3] placeholder-[#5A5550] focus:outline-none focus:border-[#FF4500]"
                />
              </div>

              {/* Vehicle List */}
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1 no-scrollbar">
                {filteredPresets.map(v => (
                  <div
                    key={v.key}
                    onClick={() => handleSelectPreset(v.key)}
                    className="p-3 rounded-xl bg-[#1A1A1A] border border-[#2C2C2C] hover:border-[#FF4500] hover:bg-[#FF4500]/10 transition-all cursor-pointer flex items-center justify-between group"
                  >
                    <div>
                      <h4 className="font-display text-lg text-[#F0EBE3] group-hover:text-[#FF4500] transition-colors leading-tight">
                        {v.make} {v.model}
                      </h4>
                      <p className="text-[10px] text-[#9A9088] font-data">
                        {v.country} · {v.rarity.toUpperCase()} TIER
                      </p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-[#9A9088] group-hover:text-[#FF4500] group-hover:translate-x-1 transition-all" />
                  </div>
                ))}
              </div>
            </div>
          ) : (
            /* Custom Make / Model Input Form */
            <form onSubmit={handleCustomSubmit} className="space-y-3">
              <div>
                <label className="text-[10px] font-data text-[#9A9088] uppercase block mb-1">Make / Manufacturer</label>
                <input
                  type="text"
                  placeholder="e.g. Porsche, Toyota, BMW, Ferrari"
                  value={customMake}
                  onChange={e => setCustomMake(e.target.value)}
                  required
                  className="w-full bg-[#080808] border border-[#2C2C2C] rounded-xl px-3 py-2.5 text-xs text-[#F0EBE3] focus:outline-none focus:border-[#FF4500]"
                />
              </div>

              <div>
                <label className="text-[10px] font-data text-[#9A9088] uppercase block mb-1">Model & Generation</label>
                <input
                  type="text"
                  placeholder="e.g. 911 Carrera S (997), GR Supra 3.0"
                  value={customModel}
                  onChange={e => setCustomModel(e.target.value)}
                  required
                  className="w-full bg-[#080808] border border-[#2C2C2C] rounded-xl px-3 py-2.5 text-xs text-[#F0EBE3] focus:outline-none focus:border-[#FF4500]"
                />
              </div>

              <button
                type="submit"
                className="w-full py-3 rounded-xl bg-[#FF4500] text-[#F0EBE3] font-display text-lg tracking-wider glow-orange mt-2 flex items-center justify-center gap-2"
              >
                <Check className="w-5 h-5" /> CONFIRM VEHICLE DETAILS
              </button>
            </form>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
