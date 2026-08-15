import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MapContainer, TileLayer, Marker, Circle, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import { X, Camera, Sparkles, LogOut, AlertTriangle, ArrowLeft } from 'lucide-react';
import type { Hunt } from '../../types/apex';
import { RARITY_CONFIG } from '../../utils/rarity';
import { sounds } from '../../utils/audio';
import { useApexStore } from '../../store/useApexStore';

interface HuntScreenProps {
  hunt: Hunt | null;
  onClose: () => void;
  onOpenScanner: () => void;
}

// User Ignition Orange GPS Marker
const createGpsDotIcon = () => {
  return L.divIcon({
    className: 'custom-gps-dot',
    html: `
      <div style="
        width: 22px;
        height: 22px;
        border-radius: 50%;
        background: #FF4500;
        border: 3px solid #F0EBE3;
        box-shadow: 0 0 20px rgba(255, 69, 0, 0.9);
      "></div>
    `,
    iconSize: [22, 22],
    iconAnchor: [11, 11]
  });
};

// Target Hunt Car Marker
const createHuntTargetIcon = () => {
  return L.divIcon({
    className: 'custom-hunt-target-pin',
    html: `
      <div style="
        width: 42px;
        height: 42px;
        border-radius: 50%;
        background: #111111;
        border: 3px solid #FF4500;
        box-shadow: 0 0 25px rgba(255, 69, 0, 0.9);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 20px;
      ">
        🎯
      </div>
    `,
    iconSize: [42, 42],
    iconAnchor: [21, 21]
  });
};

// City Pin Icon
const createCustomPinIcon = (color: string) => {
  return L.divIcon({
    className: 'custom-pin',
    html: `
      <div style="
        width: 32px;
        height: 32px;
        border-radius: 50%;
        background: #111111;
        border: 2px solid ${color};
        opacity: 0.85;
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-size: 14px;
      ">
        🚗
      </div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 16]
  });
};

// Helper component to trigger Leaflet map invalidateSize on mount
const MapInvalidator: React.FC = () => {
  const map = useMap();
  useEffect(() => {
    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 250);
    return () => clearTimeout(timer);
  }, [map]);
  return null;
};

// AI Radar Hint database mapping
const getAiHuntHint = (carName: string) => {
  const hints: Record<string, string> = {
    'Porsche 911 GT3 RS': 'Check high-end commercial valet loops or underground sports car parking garages near luxury shopping districts.',
    'Ferrari SF90 Stradale': 'Spotted near exclusive hotel driveways or financial center underground decks.',
    'Lamborghini Huracán STO': 'Listen for loud V10 exhaust notes near main avenue boulevard intersections.',
    'Bugatti Chiron Super Sport': 'Parked in a private covered bay near five-star hotel entrances.',
    'BMW M4 CSL': 'Spotted near performance tuning shops or boulevard coffee runs.'
  };
  return hints[carName] || 'Target is frequently seen near main city avenues or underground parking bays.';
};

export const HuntScreen: React.FC<HuntScreenProps> = ({
  hunt,
  onClose,
  onOpenScanner
}) => {
  const [inZone] = useState(false);
  const [showCancelConfirmModal, setShowCancelConfirmModal] = useState(false);
  const { user } = useApexStore();

  useEffect(() => {
    if (hunt) {
      sounds.playTargetLock();
    }
  }, [hunt]);

  if (!hunt) return null;

  const userLat = user.latitude || 20.5937;
  const userLng = user.longitude || 78.9629;
  const userGpsPos: [number, number] = [userLat, userLng];
  const targetPos: [number, number] = [hunt.latApprox, hunt.lngApprox];

  const nearbySpots = [
    { id: 'spot-1', lat: userLat + 0.002, lng: userLng + 0.003, make: 'Ferrari', model: '488 GTB', rarity: 'epic' },
    { id: 'spot-2', lat: userLat - 0.003, lng: userLng - 0.003, make: 'Lamborghini', model: 'Huracán', rarity: 'legendary' },
    { id: 'spot-3', lat: userLat + 0.006, lng: userLng + 0.006, make: 'Porsche', model: '911 GT3 RS', rarity: 'mythic' }
  ];

  const handleConfirmCancel = () => {
    setShowCancelConfirmModal(false);
    onClose();
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-[#080808] flex flex-col select-none overflow-hidden"
      style={{ fontFamily: 'DM Sans' }}
    >
      {/* 1. TOP DEDICATED HUNT HEADER WITH BACK BUTTON */}
      <div className="absolute top-4 left-4 right-4 z-40 flex items-center justify-between max-w-md mx-auto pointer-events-auto">
        <div className="flex items-center gap-2">
          <button
            onClick={onClose}
            className="h-10 px-3 rounded-xl bg-[#111111]/90 backdrop-blur-md border border-[#2C2C2C] text-[#F0EBE3] text-xs font-data flex items-center gap-1.5 hover:border-[#FF4500]/60 transition-colors shadow-2xl"
            title="Back to Map"
          >
            <ArrowLeft className="w-4 h-4 text-[#FF4500]" />
            <span>BACK TO MAP</span>
          </button>

          <button
            onClick={() => setShowCancelConfirmModal(true)}
            className="h-10 px-3 rounded-xl bg-[#111111]/90 backdrop-blur-md border border-[#FF2200]/40 text-[#9A9088] hover:text-[#FF2200] text-xs font-data flex items-center gap-1 hover:border-[#FF2200] transition-colors shadow-2xl"
          >
            <LogOut className="w-3.5 h-3.5 text-[#FF2200]" />
            <span>ABANDON</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[10px] font-data font-semibold text-[#FF4500] bg-[#080808]/90 px-2.5 py-1 rounded-full border border-[#FF4500]/40 backdrop-blur-md">
            🚨 HUNT ACTIVE
          </span>
        </div>
      </div>

      {/* 2. FULL-SCREEN DEDICATED LEAFLET HUNT MAP */}
      <div className="w-full h-full dark-tiles">
        <MapContainer
          center={userGpsPos}
          zoom={14}
          zoomControl={false}
          scrollWheelZoom={true}
          className="w-full h-full"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <MapInvalidator />

          {/* User Location GPS Marker */}
          <Marker position={userGpsPos} icon={createGpsDotIcon()} />

          {/* Nearby City Spot Pins */}
          {nearbySpots.map(spot => {
            const conf = RARITY_CONFIG[spot.rarity as keyof typeof RARITY_CONFIG];
            return (
              <Marker
                key={spot.id}
                position={[spot.lat, spot.lng]}
                icon={createCustomPinIcon(conf ? conf.color : '#FF4500')}
              />
            );
          })}

          {/* 2km Radius Hunt Zone */}
          <Circle
            center={targetPos}
            radius={2000}
            pathOptions={{ color: '#FF4500', fillColor: '#FF4500', fillOpacity: 0.2 }}
          />

          {/* Target Car Marker */}
          <Marker position={targetPos} icon={createHuntTargetIcon()} />

          {/* Navigation Polyline */}
          <Polyline
            positions={[userGpsPos, targetPos]}
            pathOptions={{ color: '#FF4500', weight: 3, dashArray: '6, 8' }}
          />
        </MapContainer>
      </div>

      {/* 3. PERMANENT AI RADAR HINT BANNER (Visible when outside the zone) */}
      {!inZone && (
        <div className="absolute top-24 left-4 right-4 z-30 max-w-md mx-auto bg-[#111111]/90 backdrop-blur-md border border-[#FFA500]/40 rounded-xl p-3.5 shadow-2xl space-y-1">
          <div className="flex items-center justify-between text-[#FFA500] font-data text-xs font-semibold uppercase tracking-wider">
            <span className="flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-[#FFA500]" /> AI RADAR HINT (1 / HUNT)
            </span>
            <span className="text-[10px] text-[#9A9088]">TARGET: {hunt.carName}</span>
          </div>
          <p className="text-xs text-[#F0EBE3] leading-relaxed">
            "{getAiHuntHint(hunt.carName)}"
          </p>
        </div>
      )}

      {/* 4. BLURRED GEOFENCE OVERLAY (Triggers when inside 2km radius) */}
      <AnimatePresence>
        {inZone && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            className="absolute inset-0 z-30 flex flex-col items-center justify-center text-center p-6 bg-[#080808]/85 backdrop-blur-md space-y-6"
          >
            <div className="space-y-2 max-w-xs">
              <span className="text-xs font-data font-semibold uppercase tracking-wider text-[#FF4500] bg-[#1A1A1A] px-3 py-1 rounded-full border border-[#FF4500]/40">
                GEOFENCE ACQUIRED
              </span>
              <h2 className="font-display text-5xl text-[#F0EBE3] tracking-wide leading-none pt-2">
                YOU'RE IN THE <span className="text-[#FF4500]">ZONE.</span>
              </h2>
              <p className="text-sm text-[#9A9088] leading-relaxed">
                The car is within 2 km of your position. Find it and tap scan!
              </p>
            </div>

            {/* AI RADAR HINT CARD INSIDE ZONE */}
            <div className="max-w-xs p-4 rounded-xl bg-[#111111] border border-[#FFA500]/60 shadow-2xl text-left space-y-2">
              <div className="flex items-center gap-1.5 text-[#FFA500] font-data text-xs font-semibold uppercase tracking-wider">
                <Sparkles className="w-4 h-4 text-[#FFA500]" />
                <span>AI RADAR HINT (1 / HUNT)</span>
              </div>
              <p className="text-xs text-[#F0EBE3] leading-relaxed">
                "{getAiHuntHint(hunt.carName)}"
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 5. CANCEL HUNT CONFIRMATION MODAL */}
      <AnimatePresence>
        {showCancelConfirmModal && (
          <div className="fixed inset-0 z-50 bg-[#080808]/85 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-sm bg-[#111111] border border-[#FF2200]/50 rounded-xl p-6 space-y-5 text-center shadow-2xl"
            >
              <div className="w-14 h-14 rounded-full bg-[#1F0500] border border-[#FF2200] flex items-center justify-center text-[#FF2200] mx-auto glow-fire">
                <AlertTriangle className="w-7 h-7" />
              </div>

              <div className="space-y-1">
                <span className="text-[10px] font-data font-semibold text-[#FF2200] uppercase tracking-wider bg-[#1F0500] px-3 py-1 rounded-full border border-[#FF2200]/40">
                  CONFIRM CANCEL HUNT
                </span>
                <h3 className="font-display text-2xl text-[#F0EBE3] pt-2">ABANDON THIS HUNT?</h3>
                <p className="text-xs text-[#9A9088] leading-relaxed">
                  Are you sure you want to cancel hunting {hunt.carName}? You will forfeit active hunter placement.
                </p>
              </div>

              <div className="space-y-3 pt-2">
                <button
                  onClick={handleConfirmCancel}
                  className="w-full py-3.5 rounded-xl bg-[#FF2200] text-[#F0EBE3] font-display text-lg tracking-wider flex items-center justify-center gap-2 glow-fire"
                >
                  <X className="w-5 h-5" /> YES, CANCEL HUNT
                </button>

                <button
                  onClick={() => setShowCancelConfirmModal(false)}
                  className="w-full py-3 rounded-xl bg-[#1A1A1A] hover:bg-[#2C2C2C] text-[#F0EBE3] font-display text-sm tracking-wider border border-[#2C2C2C]"
                >
                  KEEP HUNTING
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 6. BOTTOM CONTROLS & SCANNER BUTTON */}
      <div className="absolute bottom-6 left-4 right-4 z-40 flex flex-col items-center gap-3 max-w-md mx-auto">
        {/* Circular Orange Scanner CTA */}
        <button
          onClick={() => {
            sounds.playTargetLock();
            onOpenScanner();
          }}
          className="w-full py-4 rounded-xl bg-[#FF4500] text-[#F0EBE3] font-display text-2xl tracking-wider flex items-center justify-center gap-3 border border-[#FF6A00]/50 glow-orange"
        >
          <Camera className="w-7 h-7 text-[#F0EBE3]" />
          <span>{inZone ? 'SCAN WHEN YOU FIND IT' : 'SCAN FOR HUNT CAR'}</span>
        </button>
      </div>
    </motion.div>
  );
};
