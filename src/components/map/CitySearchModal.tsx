import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, MapPin, Globe, Navigation, X } from 'lucide-react';
import { sounds } from '../../utils/audio';

export interface CityLocation {
  name: string;
  country: string;
  lat: number;
  lng: number;
  tagline: string;
}

export const FAMOUS_CITIES: CityLocation[] = [
  { name: 'Tokyo', country: 'Japan', lat: 35.6762, lng: 139.6503, tagline: 'Shibuya & Daikanyama JDM Mecca' },
  { name: 'Dubai', country: 'United Arab Emirates', lat: 25.2048, lng: 55.2708, tagline: 'Downtown & Palm Jumeirah Hypercars' },
  { name: 'Monaco', country: 'Monaco', lat: 43.7384, lng: 7.4246, tagline: 'Casino Square Millionaire Corridor' },
  { name: 'London', country: 'United Kingdom', lat: 51.5074, lng: -0.1278, tagline: 'Mayfair & Knightsbridge Supercar Season' },
  { name: 'New York', country: 'United States', lat: 40.7128, lng: -74.0060, tagline: 'Manhattan & Hamptons Exotic Radar' },
  { name: 'Hong Kong', country: 'Hong Kong', lat: 22.2950, lng: 114.1720, tagline: 'Tsim Sha Tsui Harbour Supercar Strip' },
  { name: 'Los Angeles', country: 'United States', lat: 34.0522, lng: -118.2437, tagline: 'Rodeo Drive & Angeles Crest Highway' },
  { name: 'Paris', country: 'France', lat: 48.8566, lng: 2.3522, tagline: 'Champs-Élysées Luxury & Vintage Spec' },
  { name: 'Stuttgart', country: 'Germany', lat: 48.7758, lng: 9.1829, tagline: 'Porsche & Mercedes Motorsport Heritage' },
  { name: 'Mumbai', country: 'India', lat: 19.0760, lng: 72.8777, tagline: 'Marine Drive & Bandra Supercar Spotting' }
];

interface CitySearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectCity: (city: CityLocation) => void;
}

export const CitySearchModal: React.FC<CitySearchModalProps> = ({ isOpen, onClose, onSelectCity }) => {
  const [query, setQuery] = useState('');

  if (!isOpen) return null;

  const filteredCities = FAMOUS_CITIES.filter(
    c => c.name.toLowerCase().includes(query.toLowerCase()) || c.country.toLowerCase().includes(query.toLowerCase())
  );

  const handleSelect = (city: CityLocation) => {
    sounds.playTargetLock();
    onSelectCity(city);
    onClose();
  };

  const handleCustomSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    const matched = FAMOUS_CITIES.find(c => c.name.toLowerCase() === query.trim().toLowerCase());
    if (matched) {
      handleSelect(matched);
    } else {
      const customCity: CityLocation = {
        name: query.trim(),
        country: 'Search Location',
        lat: 25.2048 + (Math.random() * 10 - 5),
        lng: 55.2708 + (Math.random() * 10 - 5),
        tagline: 'Custom Radar Search Co-ordinates'
      };
      handleSelect(customCity);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xl flex items-start justify-center pt-16 px-4">
        <motion.div
          initial={{ opacity: 0, y: -20, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.96 }}
          className="w-full max-w-md bg-[#111111] border border-orange-500/50 rounded-3xl p-5 space-y-4 shadow-[0_0_50px_rgba(255,85,0,0.3)]"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <div className="flex items-center gap-2">
              <Globe className="w-5 h-5 text-[#FF5500]" />
              <h3 className="font-display text-2xl text-white tracking-wide">LOCATION SEARCH</h3>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Search Form Input */}
          <form onSubmit={handleCustomSearchSubmit} className="relative">
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search any city or place (e.g. Tokyo, Dubai, Paris)..."
              autoFocus
              className="w-full bg-white/5 border border-white/15 rounded-2xl py-3 pl-11 pr-4 text-sm text-white placeholder-slate-400 focus:outline-none focus:border-[#FF5500] font-sans transition-colors"
            />
            <Search className="w-5 h-5 text-[#FF5500] absolute left-3.5 top-3.5" />
          </form>

          {/* Featured Global Cities List */}
          <div className="space-y-2 max-h-80 overflow-y-auto pr-1 no-scrollbar">
            <span className="text-[10px] font-mono text-slate-400 uppercase tracking-widest block">
              POPULAR GLOBAL HOTSPOTS ({filteredCities.length})
            </span>

            {filteredCities.map((city) => (
              <div
                key={city.name}
                onClick={() => handleSelect(city)}
                className="p-3 rounded-2xl bg-white/5 border border-white/10 hover:border-[#FF5500] hover:bg-orange-950/30 transition-all cursor-pointer flex items-center justify-between group"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-orange-950/60 border border-orange-500/40 text-[#FF5500] group-hover:scale-110 transition-transform">
                    <MapPin className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="font-display text-lg text-white group-hover:text-[#FF5500] transition-colors leading-none">
                      {city.name}, <span className="text-xs font-sans text-slate-300 font-normal">{city.country}</span>
                    </h4>
                    <p className="text-[11px] text-slate-400 font-mono mt-0.5">{city.tagline}</p>
                  </div>
                </div>

                <div className="text-right">
                  <Navigation className="w-4 h-4 text-slate-400 ml-auto group-hover:text-[#FF5500]" />
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
