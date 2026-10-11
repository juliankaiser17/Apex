import React, { useState, useMemo, useRef, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from 'react-leaflet';
import L from 'leaflet';
import { ShieldAlert, Crosshair, Eye, Search, Flame, ArrowLeft, Globe, Shield, EyeOff, MapPin, Navigation } from 'lucide-react';
import { useApexStore } from '../../store/useApexStore';
import type { CarCard } from '../../types/apex';
import { CitySearchModal } from './CitySearchModal';
import type { CityLocation } from './CitySearchModal';
import { Gta5SatelliteHud } from './Gta5SatelliteHud';
import { sounds } from '../../utils/audio';
import { requestRealLocationPermission, watchUserLocation } from '../../utils/geolocation';
import { BottomSheet } from '../ui/BottomSheet';
import { Button } from '../ui/Button';
import { RarityBadge } from '../ui/RarityBadge';
import { StatChip } from '../ui/StatChip';

// Rarity color variable mapping for 44px circular pins
const RARITY_COLOR_MAP: Record<string, string> = {
  common: 'var(--color-common)',
  uncommon: 'var(--color-uncommon)',
  rare: 'var(--color-rare)',
  epic: 'var(--color-epic)',
  legendary: 'var(--color-legendary)',
  mythic: 'var(--color-xp)',
};

// Rarity stroke rgba mapping for Leaflet perimeter circles
const RARITY_STROKE_MAP: Record<string, string> = {
  common: 'rgba(139, 147, 160, 0.6)',
  uncommon: 'rgba(63, 167, 150, 0.7)',
  rare: 'rgba(79, 125, 240, 0.7)',
  epic: 'rgba(168, 98, 240, 0.7)',
  legendary: 'rgba(232, 168, 56, 0.8)',
  mythic: 'rgba(255, 79, 216, 0.85)',
};

// Cache for Leaflet DivIcons to prevent garbage collection churn and re-creation
const pinIconCache = new Map<string, L.DivIcon>();

// 44px Circular Pin with Rarity Ring
const getCachedPinIcon = (rarity: string, imageUrl?: string): L.DivIcon => {
  const safeImg = imageUrl || '';
  const key = `${rarity}_${safeImg}`;
  const existing = pinIconCache.get(key);
  if (existing) return existing;

  const colorVar = RARITY_COLOR_MAP[rarity] || 'var(--color-common)';

  const icon = L.divIcon({
    className: 'custom-pin-44',
    html: `
      <div style="
        width: 44px; height: 44px; position: relative; cursor: pointer;
        display: flex; align-items: center; justify-content: center;
        border-radius: 50%;
        background: var(--color-void);
        border: 2.5px solid ${colorVar};
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.7), 0 0 10px rgba(0, 0, 0, 0.4);
        overflow: hidden;
      ">
        ${safeImg
          ? `<img src="${safeImg}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;" onerror="this.style.display='none'" />`
          : `<div style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; background: var(--color-panel-2); color: var(--color-text-2);">
               <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                 <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/>
                 <circle cx="7" cy="17" r="2"/>
                 <path d="M9 17h6"/>
                 <circle cx="17" cy="17" r="2"/>
               </svg>
             </div>`
        }
      </div>
    `,
    iconSize: [44, 44],
    iconAnchor: [22, 22],
    popupAnchor: [0, -26]
  });

  pinIconCache.set(key, icon);
  return icon;
};

// User Live GPS Icon: Solid white center dot with expanding ripple pulse
const userGpsIcon = L.divIcon({
  className: 'custom-user-gps-marker',
  html: `
    <div style="position: relative; width: 36px; height: 36px; display: flex; align-items: center; justify-content: center;">
      <!-- Outer expanding ripple pulse -->
      <div style="
        position: absolute; width: 36px; height: 36px; border-radius: 50%;
        background: rgba(255, 255, 255, 0.2);
        border: 1px solid rgba(255, 255, 255, 0.35);
        animation: mapRipple 2.2s cubic-bezier(0, 0.2, 0.8, 1) infinite;
      "></div>
      <!-- Middle subtle aura ring -->
      <div style="
        position: absolute; width: 20px; height: 20px; border-radius: 50%;
        background: rgba(255, 255, 255, 0.15);
        border: 1px solid rgba(255, 255, 255, 0.5);
      "></div>
      <!-- Center solid white dot -->
      <div style="
        width: 10px; height: 10px; border-radius: 50%;
        background: var(--color-text);
        border: 2px solid var(--color-void);
        box-shadow: 0 0 10px rgba(255, 255, 255, 0.95);
        z-index: 2;
      "></div>
    </div>
  `,
  iconSize: [36, 36],
  iconAnchor: [18, 18]
});

// GTA V Camera Controller sub-component using useMap
interface GtaCameraControllerProps {
  targetCity: CityLocation | null;
  onAnimationPhaseChange: (phase: 'ascent' | 'pan' | 'descent' | null) => void;
}

const GtaCameraController: React.FC<GtaCameraControllerProps> = ({ targetCity, onAnimationPhaseChange }) => {
  const map = useMap();
  const lastCityRef = useRef<string | null>(null);

  useEffect(() => {
    if (!targetCity) return;
    if (lastCityRef.current === targetCity.name) return;

    lastCityRef.current = targetCity.name;
    const currentCenter = map.getCenter();
    const targetCoords: [number, number] = [targetCity.lat, targetCity.lng];

    sounds.playTargetLock();
    onAnimationPhaseChange('ascent');

    map.flyTo(currentCenter, 4, {
      duration: 1.5,
      easeLinearity: 0.25
    });

    const panTimer = setTimeout(() => {
      onAnimationPhaseChange('pan');
      map.flyTo(targetCoords, 4, {
        duration: 2.0,
        easeLinearity: 0.25
      });
    }, 1500);

    const descentTimer = setTimeout(() => {
      onAnimationPhaseChange('descent');
      map.flyTo(targetCoords, 13, {
        duration: 1.8,
        easeLinearity: 0.25
      });
    }, 3500);

    const completeTimer = setTimeout(() => {
      onAnimationPhaseChange(null);
    }, 5300);

    return () => {
      clearTimeout(panTimer);
      clearTimeout(descentTimer);
      clearTimeout(completeTimer);
    };
  }, [targetCity, map, onAnimationPhaseChange]);

  return null;
};

// Navigation controller for programmatic flyTo actions
const MapNavigationController: React.FC<{
  recenterTarget: { lat: number; lng: number; zoom?: number; timestamp: number } | null;
}> = ({ recenterTarget }) => {
  const map = useMap();
  useEffect(() => {
    if (!recenterTarget) return;
    map.flyTo([recenterTarget.lat, recenterTarget.lng], recenterTarget.zoom || 15, {
      duration: 1.2,
      easeLinearity: 0.25
    });
  }, [recenterTarget, map]);
  return null;
};

// Helper component to trigger Leaflet map invalidateSize once upon mounting
const MapInvalidator: React.FC = () => {
  const map = useMap();
  useEffect(() => {
    map.invalidateSize();
    const t = setTimeout(() => map.invalidateSize(), 150);

    const onResize = () => map.invalidateSize();
    window.addEventListener('resize', onResize);

    return () => {
      clearTimeout(t);
      window.removeEventListener('resize', onResize);
    };
  }, [map]);
  return null;
};

export interface MapSpotPin extends CarCard {
  lat: number;
  lng: number;
  city: string;
  distance: string;
}

export const MapScreen: React.FC = () => {
  const { 
    garage, 
    feedPosts, 
    activeHunts, 
    user, 
    locationDisplayMode, 
    setLocationDisplayMode, 
    updateUserProfile, 
    setSelectedCardForDetail, 
    setActiveTab, 
    openHuntModal 
  } = useApexStore();
  const [selectedPin, setSelectedPin] = useState<MapSpotPin | null>(null);
  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const [privacySheetOpen, setPrivacySheetOpen] = useState(false);
  const [selectedCity, setSelectedCity] = useState<CityLocation | null>(null);
  const [gtaAnimationPhase, setGtaAnimationPhase] = useState<'ascent' | 'pan' | 'descent' | null>(null);
  const [recenterTarget, setRecenterTarget] = useState<{ lat: number; lng: number; zoom?: number; timestamp: number } | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [liveAccuracyMeters, setLiveAccuracyMeters] = useState<number | null>(null);

  const [liveCoords, setLiveCoords] = useState<{ latitude: number; longitude: number }>(() => ({
    latitude: user.latitude || 26.8467,
    longitude: user.longitude || 80.9462
  }));

  // 1. Initial Real Location fetch on mount if user coordinates not fully established
  useEffect(() => {
    if (!user.city || !user.latitude) {
      requestRealLocationPermission().then((res) => {
        if (res.latitude !== 0 && res.longitude !== 0) {
          setLiveCoords({ latitude: res.latitude, longitude: res.longitude });
          updateUserProfile({
            latitude: res.latitude,
            longitude: res.longitude,
            city: res.city,
            country: res.country
          });
          if (res.accuracyMeters) setLiveAccuracyMeters(res.accuracyMeters);
          setRecenterTarget({ lat: res.latitude, lng: res.longitude, zoom: 14, timestamp: Date.now() });
        }
      }).catch(err => console.warn('Location fetch in MapScreen:', err));
    }
  }, [user.city, user.latitude, updateUserProfile]);

  // 2. Active Live GPS Watcher: Updates only local map marker (0 store persistence writes)
  useEffect(() => {
    const unwatch = watchUserLocation(
      (pos) => {
        setLiveCoords({
          latitude: pos.latitude,
          longitude: pos.longitude
        });
        setLiveAccuracyMeters(pos.accuracyMeters);
      },
      (err) => console.warn('Watch location notice:', err)
    );

    return () => unwatch();
  }, []);

  const defaultCenter: [number, number] = [liveCoords.latitude, liveCoords.longitude];

  const mapSpots = useMemo<MapSpotPin[]>(() => {
    const cardMap = new Map<string, CarCard>();

    feedPosts.forEach(post => {
      if (post.card && post.card.isPublic !== false && post.card.privacyLevel !== 'no_hunt_private') {
        cardMap.set(post.card.id, post.card);
      }
    });

    garage.forEach(card => {
      if (card.isPublic !== false && card.privacyLevel !== 'no_hunt_private') {
        if (!cardMap.has(card.id)) {
          cardMap.set(card.id, card);
        }
      }
    });

    const allCards = Array.from(cardMap.values());
    const userLat = liveCoords.latitude;
    const userLng = liveCoords.longitude;

    return allCards.map((card, index) => {
      const lat = card.latApprox || (userLat ? userLat + ((index % 5) - 2) * 0.005 : 26.8467);
      const lng = card.lngApprox || (userLng ? userLng + (((index + 1) % 5) - 2) * 0.005 : 80.9462);

      let distanceStr = `${(0.4 + (index % 5) * 0.4).toFixed(1)} km away`;
      if (userLat && userLng && lat && lng) {
        const latRad = ((lat + userLat) / 2) * (Math.PI / 180);
        const dx = (lng - userLng) * Math.cos(latRad) * 111.32;
        const dy = (lat - userLat) * 110.54;
        const distKm = Math.sqrt(dx * dx + dy * dy);
        distanceStr = distKm < 0.1 ? 'Right here' : `${distKm.toFixed(1)} km away`;
      }

      return {
        ...card,
        id: `map-spot-${card.id}`,
        lat,
        lng,
        city: card.city || user.city || 'Radar Sector',
        distance: distanceStr
      };
    });
  }, [garage, feedPosts, liveCoords.latitude, liveCoords.longitude, user.city]);

  const activeMatchingHunt = useMemo(() => {
    if (!selectedPin) return null;
    return activeHunts.find(h => 
      h.carName.toLowerCase().includes(selectedPin.model.toLowerCase()) || 
      selectedPin.model.toLowerCase().includes(h.carName.toLowerCase())
    ) || null;
  }, [selectedPin, activeHunts]);

  const handleOpenSpotCard = (spot: CarCard) => {
    setSelectedCardForDetail(spot);
  };

  const handleSelectCity = (city: CityLocation) => {
    setSelectedCity(city);
    updateUserProfile({ city: city.name, country: city.country });
    setSearchModalOpen(false);
  };

  const handleRecenterGps = async () => {
    sounds.playTargetLock();
    setSelectedPin(null);
    setSelectedCity(null);

    setIsLocating(true);
    try {
      const res = await requestRealLocationPermission();
      if (res.latitude !== 0 && res.longitude !== 0) {
        setLiveCoords({ latitude: res.latitude, longitude: res.longitude });
        updateUserProfile({
          latitude: res.latitude,
          longitude: res.longitude,
          city: res.city,
          country: res.country
        });
        if (res.accuracyMeters) setLiveAccuracyMeters(res.accuracyMeters);
        setRecenterTarget({ lat: res.latitude, lng: res.longitude, zoom: 15, timestamp: Date.now() });
      } else if (liveCoords.latitude && liveCoords.longitude) {
        setRecenterTarget({ lat: liveCoords.latitude, lng: liveCoords.longitude, zoom: 15, timestamp: Date.now() });
      }
    } catch (e) {
      console.warn('Recenter GPS error:', e);
      if (liveCoords.latitude && liveCoords.longitude) {
        setRecenterTarget({ lat: liveCoords.latitude, lng: liveCoords.longitude, zoom: 15, timestamp: Date.now() });
      }
    } finally {
      setIsLocating(false);
    }
  };

  return (
    <div className="relative w-full h-[calc(100dvh-130px)] bg-[var(--color-void)] overflow-hidden select-none font-sans">
      {/* ─── 1. FULL-VIEWPORT LEAFLET ROADMAP CANVAS ─── */}
      <div className="absolute inset-0 z-0 dark-tiles">
        <MapContainer
          center={defaultCenter}
          zoom={14}
          minZoom={2.5}
          maxBounds={[[-85, -180], [85, 180]]}
          maxBoundsViscosity={1.0}
          worldCopyJump={false}
          scrollWheelZoom={true}
          preferCanvas={false}
          className="w-full h-full"
          zoomControl={false}
          style={{ width: '100%', height: '100%', backgroundColor: 'var(--color-void)' }}
        >
          <MapInvalidator />
          <MapNavigationController recenterTarget={recenterTarget} />
          
          {/* High-Contrast Cyber Dark Inverted Roadmap Tile Layer */}
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            maxZoom={19}
            noWrap={true}
          />

          {/* User Location Rendering — White Dot with Ripple Pulse vs 1km Approximate Circle vs Hidden */}
          {liveCoords.latitude && liveCoords.longitude && locationDisplayMode !== 'hidden' && (
            <>
              {locationDisplayMode === 'exact' ? (
                <>
                  {/* Real accuracy radius ring if available */}
                  {liveAccuracyMeters && liveAccuracyMeters > 15 && (
                    <Circle
                      center={[liveCoords.latitude, liveCoords.longitude]}
                      radius={liveAccuracyMeters}
                      pathOptions={{
                        color: 'rgba(255, 255, 255, 0.4)',
                        fillColor: 'rgba(255, 255, 255, 0.06)',
                        fillOpacity: 0.06,
                        weight: 1,
                        dashArray: '3 3'
                      }}
                    />
                  )}
                  <Marker
                    position={[liveCoords.latitude, liveCoords.longitude]}
                    icon={userGpsIcon}
                    interactive={false}
                  />
                </>
              ) : (
                /* Approximate 1km Radius Zone — Area Circle Without Center Dot */
                <Circle
                  center={[liveCoords.latitude, liveCoords.longitude]}
                  radius={1000}
                  pathOptions={{
                    color: 'rgba(242, 179, 61, 0.7)',
                    fillColor: 'rgba(242, 179, 61, 0.1)',
                    fillOpacity: 0.1,
                    weight: 1.5,
                    dashArray: '6 6'
                  }}
                />
              )}
            </>
          )}

          {/* GTA V Camera Controller */}
          <GtaCameraController
            targetCity={selectedCity}
            onAnimationPhaseChange={setGtaAnimationPhase}
          />

          {/* Active Hunt Zone */}
          {activeHunts.map((hunt) => (
            <React.Fragment key={hunt.id}>
              <Circle
                center={[hunt.latApprox, hunt.lngApprox]}
                radius={2000}
                pathOptions={{
                  color: 'rgba(229, 9, 20, 0.8)',
                  fillColor: 'rgba(229, 9, 20, 0.1)',
                  fillOpacity: 0.1,
                  weight: 1.5,
                  dashArray: '6 4'
                }}
              />
            </React.Fragment>
          ))}

          {/* Spot Markers — 44px Circular Pins with Rarity Rings */}
          {mapSpots.map((spot) => {
            const icon = getCachedPinIcon(spot.rarity, spot.imageUrl);
            const isApprox = spot.privacyLevel === 'public_blurred' || spot.privacyLevel === 'approximate_only' || !spot.privacyLevel;

            return (
              <React.Fragment key={spot.id}>
                {/* 1km Approximate Perimeter Circle for the spotted vehicle */}
                {isApprox && (
                  <Circle
                    center={[spot.lat, spot.lng]}
                    radius={1000}
                    pathOptions={{
                      color: RARITY_STROKE_MAP[spot.rarity] || 'rgba(139, 147, 160, 0.6)',
                      fillColor: RARITY_STROKE_MAP[spot.rarity] || 'rgba(139, 147, 160, 0.6)',
                      fillOpacity: 0.08,
                      weight: 1.2,
                      dashArray: '5 5'
                    }}
                    eventHandlers={{
                      click: () => setSelectedPin(spot)
                    }}
                  />
                )}

                {/* Spot Card Marker Pin */}
                <Marker
                  position={[spot.lat, spot.lng]}
                  icon={icon}
                  eventHandlers={{
                    click: () => {
                      setSelectedPin(spot);
                    }
                  }}
                >
                  <Popup className="dark-popup">
                    <div
                      onClick={() => handleOpenSpotCard(spot)}
                      className="p-3 text-[var(--color-text)] font-sans cursor-pointer hover:bg-[var(--color-panel-2)] transition-colors"
                    >
                      <div className="flex items-center gap-2 mb-1.5">
                        <RarityBadge rarity={spot.rarity} size="sm" />
                        <span className="text-[10px] font-mono text-[var(--color-text-3)]">VIEW CARD →</span>
                      </div>
                      <strong className="text-base block leading-tight text-[var(--color-text)] font-display">{spot.make} {spot.model}</strong>
                      <span className="text-xs text-[var(--color-accent)] font-semibold mt-0.5 block">Spotted in {spot.city} · 1km Area</span>
                    </div>
                  </Popup>
                </Marker>
              </React.Fragment>
            );
          })}
        </MapContainer>
      </div>

      {/* Top Search, Back, and Privacy Quick Trigger Bar */}
      <div className="absolute top-4 left-4 right-4 z-40 max-w-md mx-auto flex items-center gap-2 pointer-events-auto">
        <button
          onClick={() => {
            sounds.playTargetLock();
            setActiveTab('home');
          }}
          className="h-11 px-3.5 rounded-[var(--radius-panel)] bg-[var(--color-panel)]/90 backdrop-blur-md border border-[var(--color-line)] text-[var(--color-text)] font-display text-sm tracking-wider flex items-center gap-1.5 shadow-2xl hover:border-[var(--color-accent)]/60 transition-all shrink-0 group active:scale-95 cursor-pointer"
          title="Back to Home"
        >
          <ArrowLeft className="w-5 h-5 text-[var(--color-accent)] group-hover:-translate-x-1 transition-transform" />
          <span>HOME</span>
        </button>

        <button
          onClick={() => {
            sounds.playTargetLock();
            setSearchModalOpen(true);
          }}
          className="flex-1 h-11 px-3.5 rounded-[var(--radius-panel)] bg-[var(--color-panel)]/90 backdrop-blur-md border border-[var(--color-line)] text-[var(--color-text)] font-display text-sm tracking-wider flex items-center justify-between shadow-2xl hover:border-[var(--color-accent)]/60 transition-all group active:scale-95 cursor-pointer min-w-0"
        >
          <div className="flex items-center gap-2 min-w-0">
            <Search className="w-4 h-4 text-[var(--color-accent)] group-hover:scale-110 transition-transform shrink-0" />
            <span className="truncate uppercase font-bold text-xs tracking-wider">
              {selectedCity ? `${selectedCity.name} MAP` : `${user.city || 'LOCATION'} MAP`}
            </span>
          </div>
          <span className="text-[10px] font-mono text-[var(--color-accent)] bg-[var(--color-accent)]/10 px-2 py-0.5 rounded border border-[var(--color-accent)]/30 shrink-0 ml-1">
            SEARCH
          </span>
        </button>

        <button
          onClick={() => {
            sounds.playTargetLock();
            setPrivacySheetOpen(true);
          }}
          className="h-11 px-3 rounded-[var(--radius-panel)] bg-[var(--color-panel)]/90 backdrop-blur-md border border-[var(--color-line)] text-[var(--color-text-2)] hover:text-[var(--color-text)] flex items-center gap-1.5 shadow-2xl hover:border-[var(--color-line)] transition-all cursor-pointer active:scale-95 shrink-0"
          title="Configure Location Privacy"
        >
          {locationDisplayMode === 'exact' ? (
            <>
              <span className="w-2 h-2 rounded-full bg-[var(--color-ok)] shadow-[0_0_8px_var(--color-ok)] animate-pulse" />
              <MapPin className="w-4 h-4 text-[var(--color-ok)]" />
            </>
          ) : locationDisplayMode === 'radius' ? (
            <>
              <span className="w-2 h-2 rounded-full bg-[var(--color-xp)] shadow-[0_0_8px_var(--color-xp)]" />
              <Shield className="w-4 h-4 text-[var(--color-xp)]" />
            </>
          ) : (
            <>
              <span className="w-2 h-2 rounded-full bg-[var(--color-text-off)]" />
              <EyeOff className="w-4 h-4 text-[var(--color-text-3)]" />
            </>
          )}
        </button>
      </div>

      {/* GTA V Satellite HUD Overlay during camera transit */}
      {gtaAnimationPhase && (
        <Gta5SatelliteHud
          cityName={selectedCity?.name || 'Hong Kong'}
          countryName={selectedCity?.country || 'Japan'}
          phase={gtaAnimationPhase}
        />
      )}

      {/* City Search Modal */}
      <CitySearchModal
        isOpen={searchModalOpen}
        onClose={() => setSearchModalOpen(false)}
        onSelectCity={handleSelectCity}
      />

      {/* Privacy Zone Radius BottomSheet */}
      <BottomSheet
        isOpen={privacySheetOpen}
        onClose={() => setPrivacySheetOpen(false)}
        title="Location Privacy"
      >
        <div className="space-y-4">
          <p className="text-secondary text-[var(--color-text-3)]">
            Choose how your location appears on the radar and map. Your actual coordinates are never broadcast publicly.
          </p>

          <div className="space-y-2.5">
            {/* Exact Pinpoint */}
            <div
              onClick={() => {
                sounds.playTargetLock();
                setLocationDisplayMode('exact');
              }}
              className={`p-4 rounded-[var(--radius-panel)] border cursor-pointer transition-all flex items-start gap-3.5 ${
                locationDisplayMode === 'exact'
                  ? 'bg-[var(--color-panel-2)] border-[var(--color-accent)] ring-1 ring-[var(--color-accent)]/50'
                  : 'bg-[var(--color-void)] border-[var(--color-line)] hover:border-[var(--color-text-3)]'
              }`}
            >
              <div className={`p-2.5 rounded-[var(--radius-chip)] shrink-0 ${
                locationDisplayMode === 'exact'
                  ? 'bg-[var(--color-accent)]/15 text-[var(--color-accent)]'
                  : 'bg-[var(--color-panel-2)] text-[var(--color-text-3)]'
              }`}>
                <MapPin size={20} />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <h4 className="font-display text-display-m text-[var(--color-text)]">
                    Exact Pinpoint
                  </h4>
                  {locationDisplayMode === 'exact' && (
                    <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-full bg-[var(--color-accent)]/20 text-[var(--color-accent)] border border-[var(--color-accent)]/40">
                      Active
                    </span>
                  )}
                </div>
                <p className="text-secondary text-[var(--color-text-3)] mt-1">
                  Shows your real-time GPS position with live accuracy perimeter. Best for active spotters.
                </p>
              </div>
            </div>

            {/* 1km Blurred Zone */}
            <div
              onClick={() => {
                sounds.playTargetLock();
                setLocationDisplayMode('radius');
              }}
              className={`p-4 rounded-[var(--radius-panel)] border cursor-pointer transition-all flex items-start gap-3.5 ${
                locationDisplayMode === 'radius'
                  ? 'bg-[var(--color-panel-2)] border-[var(--color-xp)] ring-1 ring-[var(--color-xp)]/50'
                  : 'bg-[var(--color-void)] border-[var(--color-line)] hover:border-[var(--color-text-3)]'
              }`}
            >
              <div className={`p-2.5 rounded-[var(--radius-chip)] shrink-0 ${
                locationDisplayMode === 'radius'
                  ? 'bg-[var(--color-xp)]/15 text-[var(--color-xp)]'
                  : 'bg-[var(--color-panel-2)] text-[var(--color-text-3)]'
              }`}>
                <Shield size={20} />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <h4 className="font-display text-display-m text-[var(--color-text)]">
                    1km Blurred Zone
                  </h4>
                  {locationDisplayMode === 'radius' && (
                    <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-full bg-[var(--color-xp)]/20 text-[var(--color-xp)] border border-[var(--color-xp)]/40">
                      Active
                    </span>
                  )}
                </div>
                <p className="text-secondary text-[var(--color-text-3)] mt-1">
                  Masks your exact location with a 1km blurred perimeter. Protects home and workplace privacy.
                </p>
              </div>
            </div>

            {/* Ghost Mode */}
            <div
              onClick={() => {
                sounds.playTargetLock();
                setLocationDisplayMode('hidden');
              }}
              className={`p-4 rounded-[var(--radius-panel)] border cursor-pointer transition-all flex items-start gap-3.5 ${
                locationDisplayMode === 'hidden'
                  ? 'bg-[var(--color-panel-2)] border-[var(--color-text-2)] ring-1 ring-[var(--color-text-2)]/50'
                  : 'bg-[var(--color-void)] border-[var(--color-line)] hover:border-[var(--color-text-3)]'
              }`}
            >
              <div className={`p-2.5 rounded-[var(--radius-chip)] shrink-0 ${
                locationDisplayMode === 'hidden'
                  ? 'bg-white/10 text-[var(--color-text)]'
                  : 'bg-[var(--color-panel-2)] text-[var(--color-text-3)]'
              }`}>
                <EyeOff size={20} />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <h4 className="font-display text-display-m text-[var(--color-text)]">
                    Ghost Mode
                  </h4>
                  {locationDisplayMode === 'hidden' && (
                    <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-full bg-white/10 text-[var(--color-text)] border border-white/20">
                      Active
                    </span>
                  )}
                </div>
                <p className="text-secondary text-[var(--color-text-3)] mt-1">
                  Completely invisible on local radars. You can still discover cars spotted by other users.
                </p>
              </div>
            </div>
          </div>

          <div className="pt-2">
            <Button
              variant="primary"
              size="lg"
              className="w-full"
              onClick={() => setPrivacySheetOpen(false)}
            >
              Save Privacy Setting
            </Button>
          </div>
        </div>
      </BottomSheet>

      {/* BUTTON 1: Location Radar / City Search Modal Button */}
      <button
        onClick={() => {
          sounds.playTargetLock();
          setSearchModalOpen(true);
        }}
        className="absolute bottom-44 right-4 z-30 p-3.5 rounded-full bg-[var(--color-panel)]/95 backdrop-blur-md border border-[var(--color-line)] text-[var(--color-text)] shadow-2xl hover:border-[var(--color-accent)] transition-all pointer-events-auto group active:scale-90 cursor-pointer"
        title="Search Global Cities & Radars"
      >
        <Globe className="w-6 h-6 text-[var(--color-accent)] group-hover:rotate-45 transition-transform" />
      </button>

      {/* BUTTON 2: Recenter GPS Live Location Button */}
      <button
        onClick={handleRecenterGps}
        className={`absolute bottom-28 right-4 z-30 p-3.5 rounded-full bg-[var(--color-panel)]/95 backdrop-blur-md border border-[var(--color-line)] text-[var(--color-text)] shadow-2xl hover:border-[var(--color-accent)] transition-all pointer-events-auto group active:scale-90 cursor-pointer ${
          isLocating ? 'animate-spin border-[var(--color-accent)]' : ''
        }`}
        title="Recenter on Device GPS Location"
      >
        {isLocating ? (
          <Navigation className="w-6 h-6 text-[var(--color-accent)]" />
        ) : (
          <Crosshair className="w-6 h-6 text-[var(--color-accent)] group-hover:scale-110 transition-transform" />
        )}
      </button>

      {/* Pin Tap Detail Panel */}
      {selectedPin && (
        <div className="absolute bottom-20 left-4 right-4 z-40 max-w-md mx-auto pointer-events-auto">
          <div className="bg-[var(--color-panel)] border border-[var(--color-line)] rounded-[var(--radius-panel)] p-4 shadow-2xl">
            <div className="flex gap-3.5">
              <div className="relative w-20 h-20 rounded-[var(--radius-panel)] border border-[var(--color-line)] shrink-0 overflow-hidden bg-[var(--color-void)]">
                <img
                  src={selectedPin.imageUrl}
                  alt={`${selectedPin.make} ${selectedPin.model}`}
                  className="w-full h-full object-cover"
                />
              </div>

              <div className="flex-1 min-w-0 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <RarityBadge rarity={selectedPin.rarity} size="sm" />
                    <StatChip label="DISTANCE" value={selectedPin.distance} />
                  </div>
                  <h3 className="font-display text-display-m text-[var(--color-text)] truncate mt-1">
                    {selectedPin.make} {selectedPin.model}
                  </h3>
                  <p className="text-caption text-[var(--color-text-3)] font-mono truncate">
                    Spotted in {selectedPin.city}
                  </p>
                </div>

                <div className="flex gap-2 pt-2">
                  {activeMatchingHunt ? (
                    <Button
                      variant="primary"
                      size="sm"
                      className="flex-1"
                      onClick={() => {
                        setSelectedPin(null);
                        openHuntModal(activeMatchingHunt);
                      }}
                    >
                      <Flame className="w-4 h-4" /> Join Hunt
                    </Button>
                  ) : (
                    <Button
                      variant="primary"
                      size="sm"
                      className="flex-1"
                      onClick={() => {
                        handleOpenSpotCard(selectedPin);
                        setSelectedPin(null);
                      }}
                    >
                      <Eye className="w-4 h-4" /> View 3D Card
                    </Button>
                  )}

                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setSelectedPin(null)}
                  >
                    Close
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Active Hunt Banner Overlay */}
      {activeHunts.length > 0 && !selectedPin && (
        <div className="absolute bottom-24 left-4 right-4 z-30 max-w-md mx-auto pointer-events-auto">
          <div className="bg-[var(--color-panel)] border border-[var(--color-accent)]/40 rounded-[var(--radius-panel)] p-3.5 flex items-center justify-between shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-[var(--radius-chip)] bg-[var(--color-void)] text-[var(--color-accent)] border border-[var(--color-accent)]/30 animate-pulse">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-display text-lg text-[var(--color-text)] leading-none">ACTIVE HUNT ZONE</h4>
                <p className="text-caption text-[var(--color-text-3)] font-mono">{activeHunts[0].carName} spotted nearby!</p>
              </div>
            </div>
            <Button
              variant="primary"
              size="sm"
              onClick={() => openHuntModal(activeHunts[0])}
            >
              Join Hunt
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
