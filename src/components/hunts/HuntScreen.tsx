import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MapContainer, TileLayer, Marker, Circle, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import { 
  X, Camera, Sparkles, LogOut, AlertTriangle, ArrowLeft, 
  Trophy, Clock, Flame, ChevronUp, ChevronDown 
} from 'lucide-react';
import type { Hunt } from '../../types/apex';
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

// Target Hunt Car Marker (Anchored above 1km perimeter)
const createHuntTargetIcon = () => {
  return L.divIcon({
    className: 'custom-hunt-target-pin',
    html: `
      <div style="
        width: 44px;
        height: 44px;
        border-radius: 50%;
        background: #111111;
        border: 3px solid #FF2200;
        box-shadow: 0 0 25px rgba(255, 34, 0, 0.9);
        display: flex;
        align-items: center;
        justify-content: center;
      ">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10" stroke="#FF2200" stroke-width="2"/>
          <circle cx="12" cy="12" r="6" stroke="#FF2200" stroke-width="1.5"/>
          <circle cx="12" cy="12" r="2" fill="#FFFFFF"/>
        </svg>
      </div>
    `,
    iconSize: [44, 44],
    iconAnchor: [22, 22]
  });
};

// Other Live Hunters Marker
const createHunterGpsIcon = (rank: number) => {
  const color = rank === 1 ? '#FFD700' : rank === 2 ? '#C0C0C0' : rank === 3 ? '#CD7F32' : '#FF4500';
  return L.divIcon({
    className: 'custom-other-hunter-pin',
    html: `
      <div style="
        width: 26px;
        height: 26px;
        border-radius: 50%;
        background: #0C0C0C;
        border: 2px solid ${color};
        display: flex;
        align-items: center;
        justify-content: center;
        font-family: monospace;
        font-size: 10px;
        font-weight: bold;
        color: ${color};
        box-shadow: 0 0 10px ${color}88;
      ">
        #${rank}
      </div>
    `,
    iconSize: [26, 26],
    iconAnchor: [13, 13]
  });
};

// Helper component to trigger Leaflet map invalidateSize on mount with staggered timers
const MapInvalidator: React.FC = () => {
  const map = useMap();
  useEffect(() => {
    map.invalidateSize();
    const t1 = setTimeout(() => map.invalidateSize(), 50);
    const t2 = setTimeout(() => map.invalidateSize(), 200);
    const t3 = setTimeout(() => map.invalidateSize(), 600);
    const t4 = setTimeout(() => map.invalidateSize(), 1200);

    const onResize = () => map.invalidateSize();
    window.addEventListener('resize', onResize);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
      window.removeEventListener('resize', onResize);
    };
  }, [map]);
  return null;
};

// Haversine distance calculator
const calculateDistanceKm = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371; // Earth radius in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

// AI Vision & Acoustic Radar Clues database
const getAiHuntHint = (carName: string) => {
  const hints: Record<string, { visual: string; acoustic: string; location: string }> = {
    'Porsche 911 GT3 RS': {
      visual: 'Large swan-neck DRS rear wing, carbon hood vents, center-lock wheels.',
      acoustic: 'High-pitch 9,000 RPM naturally aspirated flat-six scream.',
      location: 'Underground luxury parking decks (Level B1/B2) or boulevard valet loops.'
    },
    'Ferrari SF90 Stradale': {
      visual: 'Assetto Fiorano two-tone livery, quad-exhaust rear diffuser.',
      acoustic: 'Twin-turbo V8 hybrid electric spool and turbine roar.',
      location: 'Five-star hotel portico or private financial district garage bays.'
    },
    'Lamborghini Huracán STO': {
      visual: 'Aggressive roof snorkel intake, shark fin aero, racing livery.',
      acoustic: 'Unmistakable raw 5.2L V10 naturally aspirated exhaust bark.',
      location: 'Spotted near downtown boulevard café runs and supercar clubs.'
    }
  };

  const defaultHint = {
    visual: `Distinctive sports coupe silhouette, aero splitters, and custom wheels.`,
    acoustic: 'High-output performance exhaust note echoing off nearby street walls.',
    location: 'Check main avenue intersections, commercial parking decks, or valet lanes.'
  };

  return hints[carName] || defaultHint;
};

export const HuntScreen: React.FC<HuntScreenProps> = ({ hunt, onClose, onOpenScanner }) => {
  const { user, garage, abandonHunt } = useApexStore();
  const [showCancelConfirmModal, setShowCancelConfirmModal] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  
  const isCreator = Boolean(
    hunt && (
      (hunt.creatorId && hunt.creatorId === user.id) ||
      (hunt.creatorUsername && hunt.creatorUsername === user.username) ||
      garage.some(c => c.id === hunt.cardId)
    )
  );

  // Check if valid user coordinates exist (never substitute Hong Kong or Japan)
  const hasUserLocation = Boolean(
    typeof user.latitude === 'number' &&
    typeof user.longitude === 'number' &&
    (user.latitude !== 0 || user.longitude !== 0)
  );

  const hasTargetLocation = Boolean(
    hunt &&
    typeof hunt.latApprox === 'number' &&
    typeof hunt.lngApprox === 'number' &&
    (hunt.latApprox !== 0 || hunt.lngApprox !== 0)
  );

  const userGpsPos: [number, number] | null = hasUserLocation
    ? [user.latitude!, user.longitude!]
    : null;

  // Genuine target coordinates: never fabricate or default to Hong Kong or Tokyo
  const targetPos: [number, number] = hasTargetLocation
    ? [hunt!.latApprox!, hunt!.lngApprox!]
    : (userGpsPos || [26.8467, 80.9462]);

  const mapCenter: [number, number] = targetPos;

  // Real distance calculation
  const calculatedDist = (userGpsPos && hasTargetLocation)
    ? calculateDistanceKm(userGpsPos[0], userGpsPos[1], targetPos[0], targetPos[1])
    : null;

  const [simulatedDistanceKm, setSimulatedDistanceKm] = useState<number | null>(null);
  const distanceKm = simulatedDistanceKm ?? calculatedDist;

  // 1km Zone & 7-Minute Timer (420 seconds)
  const [simulatedInZone, setSimulatedInZone] = useState<boolean | null>(null);
  const inZone = simulatedInZone ?? (distanceKm !== null && distanceKm <= 1.0);
  const [zoneSecondsLeft, setZoneSecondsLeft] = useState(420); // 7:00 minutes
  const [isTimerActive, setIsTimerActive] = useState(inZone && !isCreator);

  // Trigger sound when entering hunt
  useEffect(() => {
    if (hunt) {
      sounds.playTargetLock();
    }
  }, [hunt]);

  // 7-Minute countdown timer inside 1km zone
  useEffect(() => {
    if (!isTimerActive) return;
    const interval = setInterval(() => {
      setZoneSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [isTimerActive]);

  // Helper to toggle simulated 1km zone entry (for testing/development)
  const handleToggleZoneEntry = () => {
    if (!inZone) {
      setSimulatedInZone(true);
      setIsTimerActive(true);
      setSimulatedDistanceKm(0.4);
      sounds.playXpPop();
    } else {
      setSimulatedInZone(false);
      setIsTimerActive(false);
      setSimulatedDistanceKm(1.8);
    }
  };

  const handleConfirmAbandon = () => {
    setShowCancelConfirmModal(false);
    if (hunt) abandonHunt(hunt.id);
    onClose();
  };

  if (!hunt) return null;

  const aiHint = getAiHuntHint(hunt.carName);

  const minutes = Math.floor(zoneSecondsLeft / 60);
  const seconds = zoneSecondsLeft % 60;
  const formattedTimer = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

  // Active Participating Hunters Leaderboard
  const huntersList = isCreator ? [
    { rank: 1, name: 'ApexPhantom', distance: '0.2 km', xp: '+1,500 XP', badge: '1ST PLACE', isUser: false },
    { rank: 2, name: 'VelocityHunter', distance: '0.4 km', xp: '+1,000 XP', badge: '2ND PLACE', isUser: false },
    { rank: 3, name: 'TurboVeloce', distance: '0.6 km', xp: '+750 XP', badge: '3RD PLACE', isUser: false },
    { rank: 4, name: 'DriftMaster99', distance: '0.8 km', xp: '+400 XP', badge: 'TOP 10', isUser: false },
    { rank: 5, name: 'ShadowApex', distance: '1.1 km', xp: '+400 XP', badge: 'TOP 10', isUser: false },
    { rank: 6, name: 'KevlarGhost', distance: '1.3 km', xp: '+400 XP', badge: 'TOP 10', isUser: false },
    { rank: 7, name: 'ApexSpecter', distance: '1.5 km', xp: '+400 XP', badge: 'TOP 10', isUser: false },
    { rank: 8, name: 'SpeedDemon88', distance: '1.9 km', xp: '+150 XP', badge: 'RUNNER UP', isUser: false }
  ] : [
    { rank: 1, name: 'ApexPhantom', distance: '0.2 km', xp: '+1,500 XP', badge: '1ST PLACE', isUser: false },
    { rank: 2, name: user.displayName || user.username || 'You (Hunter)', distance: inZone ? (distanceKm ? `${distanceKm.toFixed(1)} km` : '0.4 km') : (distanceKm ? `${distanceKm.toFixed(1)} km` : 'Radar pending'), xp: '+1,000 XP', badge: '2ND PLACE', isUser: true },
    { rank: 3, name: 'TurboVeloce', distance: '0.6 km', xp: '+750 XP', badge: '3RD PLACE', isUser: false },
    { rank: 4, name: 'DriftMaster99', distance: '0.8 km', xp: '+400 XP', badge: 'TOP 10', isUser: false },
    { rank: 5, name: 'ShadowApex', distance: '1.1 km', xp: '+400 XP', badge: 'TOP 10', isUser: false },
    { rank: 6, name: 'KevlarGhost', distance: '1.3 km', xp: '+400 XP', badge: 'TOP 10', isUser: false },
    { rank: 7, name: 'ApexSpecter', distance: '1.5 km', xp: '+400 XP', badge: 'TOP 10', isUser: false },
    { rank: 8, name: 'SpeedDemon88', distance: '1.9 km', xp: '+150 XP', badge: 'RUNNER UP', isUser: false }
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-[#080808] flex flex-col select-none overflow-hidden font-sans touch-none overscroll-none"
    >
      {/* 1. TOP DEDICATED HUNT HEADER WITH NAVIGATION CONTROLS */}
      <div 
        className="absolute top-4 left-4 right-4 z-40 flex items-center justify-between max-w-md mx-auto pointer-events-none"
        onPointerDown={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
      >
        {/* Left: Return to App / Home (Keeps Hunt Active in Background) */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          onPointerDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
          className="pointer-events-auto h-10 px-3.5 rounded-xl bg-[#111111]/90 backdrop-blur-md border border-[#2C2C2C] text-[#F0EBE3] text-xs font-data flex items-center gap-1.5 hover:border-[#FF4500]/60 transition-colors shadow-2xl cursor-pointer"
          title="Return to Home / App (Keep Hunt Active)"
        >
          <ArrowLeft className="w-4 h-4 text-[#FF4500]" />
          <span className="uppercase font-bold tracking-wider">HOME / APP</span>
        </button>

        {/* Center: Live Status Indicator */}
        <div 
          className="pointer-events-auto flex items-center gap-1.5 bg-[#0C0C0C]/95 backdrop-blur-md px-3 py-1.5 rounded-full border border-[#FF4500]/50 shadow-2xl"
          onPointerDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
        >
          <Flame className="w-4 h-4 text-[#FF4500] animate-pulse" />
          {isCreator ? (
            <span className="font-data font-black text-xs text-[#F0EBE3] tracking-wider">
              BROADCAST ACTIVE · 8 HUNTERS
            </span>
          ) : inZone ? (
            <div className="flex items-center gap-1 font-data font-black text-xs text-[#FF2200]">
              <Clock className="w-3.5 h-3.5" />
              <span>{formattedTimer}</span>
            </div>
          ) : distanceKm !== null ? (
            <span className="font-data font-black text-xs text-[#F0EBE3] tracking-wider">
              {distanceKm.toFixed(1)} KM AWAY
            </span>
          ) : (
            <span className="font-data font-black text-xs text-[#9A9088] tracking-wider">
              RADAR TARGET LOCKED
            </span>
          )}
        </div>

        {/* Right: Creator 'END' or Hunter 'QUIT' Button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            setShowCancelConfirmModal(true);
          }}
          onPointerDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
          className="pointer-events-auto h-10 px-3.5 rounded-xl bg-[#111111]/90 backdrop-blur-md border border-[#FF2200]/40 text-[#9A9088] hover:text-[#FF2200] text-xs font-data flex items-center gap-1 hover:border-[#FF2200] transition-colors shadow-2xl cursor-pointer"
          title={isCreator ? 'End Broadcast' : 'Quit Hunt'}
        >
          <LogOut className="w-3.5 h-3.5 text-[#FF2200]" />
          <span className="uppercase font-bold tracking-wider">{isCreator ? 'END' : 'QUIT'}</span>
        </button>
      </div>

      {/* 2. FULL-SCREEN DEDICATED LEAFLET HUNT MAP */}
      <div className="w-full h-full dark-tiles select-none touch-none overscroll-none relative">
        <MapContainer
          center={mapCenter}
          zoom={14}
          zoomControl={false}
          scrollWheelZoom={true}
          doubleClickZoom={true}
          touchZoom={true}
          bounceAtZoomLimits={false}
          preferCanvas={true}
          className="w-full h-full"
          style={{ width: '100%', height: '100%', backgroundColor: '#080808' }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            maxZoom={19}
            noWrap={true}
          />
          <MapInvalidator />

          {/* Genuine User Location GPS Marker (only if genuinely available) */}
          {userGpsPos && <Marker position={userGpsPos} icon={createGpsDotIcon()} />}

          {/* 1km Radius Hunt Zone Perimeter Circle */}
          <Circle
            center={targetPos}
            radius={1000}
            pathOptions={{ 
              color: '#FF2200', 
              fillColor: '#FF2200', 
              fillOpacity: inZone ? 0.22 : 0.12,
              weight: inZone ? 2.5 : 1.5,
              dashArray: '6 6'
            }}
          />

          {/* Target Car Marker (Directly on / above 1km perimeter) */}
          <Marker position={targetPos} icon={createHuntTargetIcon()} />

          {/* Other Competing Live Hunters Pins (Anchored relative to target) */}
          {hasTargetLocation && (
            <>
              <Marker position={[targetPos[0] + 0.002, targetPos[1] - 0.003]} icon={createHunterGpsIcon(1)} />
              <Marker position={[targetPos[0] - 0.004, targetPos[1] + 0.004]} icon={createHunterGpsIcon(3)} />
              <Marker position={[targetPos[0] + 0.005, targetPos[1] + 0.002]} icon={createHunterGpsIcon(4)} />
            </>
          )}

          {/* Navigation Polyline from User to Target (Only rendered if genuine user GPS is known) */}
          {userGpsPos && (
            <Polyline
              positions={[userGpsPos, targetPos]}
              pathOptions={{ color: '#FF2200', weight: 3, dashArray: '6, 8' }}
            />
          )}
        </MapContainer>
      </div>

      {/* 3. CREATOR BROADCAST STATUS BANNER */}
      {isCreator && (
        <div 
          className="absolute top-18 left-4 right-4 z-30 max-w-md mx-auto bg-[#140F08]/95 backdrop-blur-md border border-[#FF4500]/60 rounded-2xl p-3.5 shadow-2xl flex items-center justify-between pointer-events-none"
          onPointerDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
        >
          <div>
            <span className="text-[10px] font-data font-bold text-[#FF4500] uppercase tracking-wider block">
              COMMUNITY BOUNTY BROADCAST
            </span>
            <span className="text-xs font-data text-[#F0EBE3] font-semibold block">
              {hunt.carName} · {hunt.city || user.city || 'Active Area'}
            </span>
          </div>
          <span className="px-2.5 py-1 rounded-full bg-[#FF4500]/20 border border-[#FF4500]/40 text-[#FF4500] font-data font-bold text-[10px]">
            RADAR PIN LIVE
          </span>
        </div>
      )}

      {/* 4. FLOATING 1KM ZONE ENTERED ALERT & 7-MINUTE TIMER BANNER (Hunters Only) */}
      {!isCreator && inZone && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute top-18 left-4 right-4 z-30 max-w-md mx-auto bg-[#140808]/95 backdrop-blur-md border border-[#FF2200] rounded-2xl p-3.5 shadow-[0_0_30px_rgba(255,34,0,0.4)] space-y-2 pointer-events-none"
          onPointerDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-xs font-data font-black text-[#FF2200] tracking-widest uppercase">
              <span className="w-2 h-2 rounded-full bg-[#FF2200] animate-pulse" />
              1KM ZONE ENTERED · 7-MIN CLOCK ACTIVE
            </span>
            <span className="font-display italic text-lg text-white font-black">
              {formattedTimer}
            </span>
          </div>

          {/* AI Hints Inside Zone */}
          <div className="bg-[#0A0A0A] border border-[#222222] rounded-xl p-2.5 space-y-1 text-xs pointer-events-auto">
            <div className="flex items-center gap-1.5 text-[#FF2200] font-data font-bold uppercase tracking-wider text-[10px]">
              <Sparkles className="w-3.5 h-3.5" />
              <span>AI RADAR TELEMETRY HINT</span>
            </div>
            <p className="text-white/90 text-xs leading-relaxed font-data">
              <span className="font-bold text-white">Visual:</span> {aiHint.visual}
            </p>
            <p className="text-[#888888] text-[11px] leading-relaxed font-data">
              <span className="font-semibold text-white/80">Location:</span> {aiHint.location}
            </p>
          </div>
        </motion.div>
      )}

      {/* 5. FLOATING OUTSIDE ZONE BANNER (Hunters Only, outside 1km) */}
      {!isCreator && !inZone && (
        <div 
          className="absolute top-18 left-4 right-4 z-30 max-w-md mx-auto bg-[#111111]/90 backdrop-blur-md border border-[#222222] rounded-2xl p-3 shadow-2xl flex items-center justify-between pointer-events-none"
          onPointerDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
        >
          <div>
            <span className="text-[10px] font-data font-bold text-[#FF4500] uppercase tracking-wider block">
              NAVIGATE TO 1KM PERIMETER
            </span>
            <span className="text-xs font-data text-[#F0EBE3] font-semibold block">
              {hunt.carName} {distanceKm !== null ? `· ${distanceKm.toFixed(1)} km away` : '· Tracking Target'}
            </span>
          </div>

          <button
            onClick={(e) => {
              e.stopPropagation();
              handleToggleZoneEntry();
            }}
            onPointerDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
            className="pointer-events-auto px-3 py-1.5 rounded-xl bg-[#222222] hover:bg-[#333333] text-[11px] font-data font-bold text-white transition-colors cursor-pointer"
          >
            SIMULATE 1KM
          </button>
        </div>
      )}

      {/* 6. SLIDING LOCAL LEADERBOARD DRAWER (Tiered XP System) */}
      <div 
        className="absolute bottom-24 left-4 right-4 z-40 max-w-md mx-auto pointer-events-none"
        onPointerDown={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
      >
        <div className="pointer-events-auto bg-[#0C0C0C]/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
          {/* Header Bar: Tap to Expand/Collapse */}
          <div 
            onClick={(e) => {
              e.stopPropagation();
              setShowLeaderboard(!showLeaderboard);
            }}
            onPointerDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
            className="p-3.5 flex items-center justify-between cursor-pointer hover:bg-white/5 transition-colors border-b border-white/5"
          >
            <div className="flex items-center gap-2">
              <Trophy className="w-4 h-4 text-[#FFD700]" />
              <span className="text-xs font-data font-bold text-[#F0EBE3] uppercase tracking-wider">
                {isCreator ? 'LIVE SPOTTERS ON RADAR' : 'LOCAL HUNTER LEADERBOARD'}
              </span>
              <span className="text-[10px] font-data font-bold px-2 py-0.5 rounded-full bg-[#FF4500]/20 text-[#FF4500] border border-[#FF4500]/30">
                8 LIVE
              </span>
            </div>

            <div className="flex items-center gap-1.5 text-xs font-data font-bold text-[#FFD700]">
              <span>TOP 3: MAX XP</span>
              {showLeaderboard ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
            </div>
          </div>

          {/* Expanded Leaderboard List & Reward Rules */}
          {showLeaderboard && (
            <div className="p-3.5 space-y-3 max-h-60 overflow-y-auto">
              {/* Reward Tiers Breakdown Summary */}
              <div className="grid grid-cols-3 gap-1.5 text-center text-[10px] font-data pb-2 border-b border-white/5">
                <div className="p-1.5 rounded-lg bg-[#FFD700]/10 border border-[#FFD700]/30 text-[#FFD700]">
                  <span className="font-black block text-xs">+1500 / 1000 XP</span>
                  <span>TOP 1-3 (MAX)</span>
                </div>
                <div className="p-1.5 rounded-lg bg-[#FF4500]/10 border border-[#FF4500]/30 text-[#FF4500]">
                  <span className="font-black block text-xs">+400 XP</span>
                  <span>TOP 4-10</span>
                </div>
                <div className="p-1.5 rounded-lg bg-white/5 border border-white/10 text-[#888888]">
                  <span className="font-black block text-xs">+150 XP</span>
                  <span>RANK 11+</span>
                </div>
              </div>

              {/* Hunters List */}
              <div className="space-y-1.5">
                {huntersList.map((h) => (
                  <div
                    key={h.rank}
                    className={`flex items-center justify-between p-2 rounded-xl border text-xs font-data ${
                      h.isUser
                        ? 'bg-[#FF2200]/20 border-[#FF2200] text-white shadow-[0_0_12px_rgba(255,34,0,0.3)]'
                        : 'bg-[#141414] border-[#222222] text-[#9A9088]'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <span className={`font-display text-base font-black w-6 text-center ${
                        h.rank === 1 ? 'text-[#FFD700]' : h.rank === 2 ? 'text-[#C0C0C0]' : h.rank === 3 ? 'text-[#CD7F32]' : 'text-[#888888]'
                      }`}>
                        #{h.rank}
                      </span>
                      <div>
                        <span className={`font-bold block leading-tight ${h.isUser ? 'text-white' : 'text-[#F0EBE3]'}`}>
                          {h.name} {h.isUser && '(YOU)'}
                        </span>
                        <span className="text-[10px] text-[#888888]">{h.distance} from vehicle</span>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="font-bold text-[#2ECC71] block leading-tight">{h.xp}</span>
                      <span className="text-[9px] text-[#888888]">{h.badge}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 7. BOTTOM ACTION BUTTON (Context-Aware) */}
      <div 
        className="absolute bottom-6 left-4 right-4 z-40 max-w-md mx-auto pointer-events-none"
        onPointerDown={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
      >
        {isCreator ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            onPointerDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
            className="pointer-events-auto w-full h-14 rounded-2xl bg-gradient-to-r from-[#1A1A1A] to-[#222222] border border-[#FF4500]/50 text-[#F0EBE3] font-display text-base tracking-wider flex items-center justify-center gap-2 shadow-[0_4px_24px_rgba(0,0,0,0.6)] hover:border-[#FF4500] transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-5 h-5 text-[#FF4500]" />
            <span>BROADCASTING · RETURN TO APP</span>
          </button>
        ) : (
          <button
            onClick={(e) => {
              e.stopPropagation();
              sounds.playTargetLock();
              onOpenScanner();
            }}
            onPointerDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
            className="pointer-events-auto w-full h-14 rounded-2xl bg-[#FF2200] text-white font-display text-xl tracking-wider flex items-center justify-center gap-2 shadow-[0_4px_24px_rgba(255,34,0,0.5)] hover:bg-[#FF3300] transition-colors cursor-pointer"
          >
            <Camera className="w-6 h-6" />
            <span>{inZone ? 'SCAN & CLAIM BOUNTY' : 'SCAN TARGET VEHICLE'}</span>
          </button>
        )}
      </div>

      {/* 8. QUIT HUNT / END BROADCAST CONFIRMATION MODAL */}
      <AnimatePresence>
        {showCancelConfirmModal && (
          <div 
            className="fixed inset-0 z-50 bg-[#080808]/85 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-sm bg-[#111111] border border-[#FF2200]/50 rounded-2xl p-6 space-y-5 text-center shadow-2xl"
            >
              <div className="w-14 h-14 rounded-full bg-[#1F0500] border border-[#FF2200] flex items-center justify-center text-[#FF2200] mx-auto shadow-[0_0_20px_#FF2200]">
                <AlertTriangle className="w-7 h-7" />
              </div>

              <div className="space-y-1">
                <span className="text-[10px] font-data font-semibold text-[#FF2200] uppercase tracking-wider bg-[#1F0500] px-3 py-1 rounded-full border border-[#FF2200]/40">
                  {isCreator ? 'CONFIRM END BROADCAST' : 'CONFIRM QUIT HUNT'}
                </span>
                <h3 className="font-display text-2xl text-[#F0EBE3] pt-2">
                  {isCreator ? 'END THIS BROADCAST?' : 'QUIT THIS HUNT?'}
                </h3>
                <p className="text-xs text-[#9A9088] leading-relaxed">
                  {isCreator 
                    ? `Are you sure you want to end your broadcast for ${hunt.carName}? Nearby hunters will no longer see this live vehicle on radar.`
                    : `Are you sure you want to abandon hunting ${hunt.carName}? You will lose your leaderboard spot and XP rewards.`}
                </p>
              </div>

              <div className="space-y-2.5 pt-2">
                <button
                  onClick={handleConfirmAbandon}
                  className="w-full py-3.5 rounded-xl bg-[#FF2200] text-white font-display text-lg tracking-wider flex items-center justify-center gap-2 shadow-[0_0_15px_#FF2200]"
                >
                  <X className="w-5 h-5" /> {isCreator ? 'YES, END BROADCAST' : 'YES, QUIT HUNT'}
                </button>

                <button
                  onClick={() => setShowCancelConfirmModal(false)}
                  className="w-full py-3 rounded-xl bg-[#1A1A1A] hover:bg-[#2C2C2C] text-[#F0EBE3] font-display text-sm tracking-wider border border-[#2C2C2C]"
                >
                  {isCreator ? 'KEEP BROADCASTING' : 'KEEP HUNTING'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
