import React, { useState, useMemo, useRef, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from 'react-leaflet';
import L from 'leaflet';
import { ShieldAlert, Crosshair, Eye, Search, Flame, ArrowLeft, Globe, Shield, EyeOff, MapPin, Navigation } from 'lucide-react';
import { useApexStore } from '../../store/useApexStore';
import { RARITY_CONFIG } from '../../utils/rarity';
import type { CarCard } from '../../types/apex';
import { CitySearchModal } from './CitySearchModal';
import type { CityLocation } from './CitySearchModal';
import { Gta5SatelliteHud } from './Gta5SatelliteHud';
import { sounds } from '../../utils/audio';
import { requestRealLocationPermission, watchUserLocation } from '../../utils/geolocation';

// Cache for Leaflet DivIcons to prevent garbage collection churn and re-creation
const pinIconCache = new Map<string, L.DivIcon>();

const getCachedPinIcon = (color: string, imageUrl?: string): L.DivIcon => {
  const safeImg = imageUrl || '';
  const key = `${color}_${safeImg}`;
  const existing = pinIconCache.get(key);
  if (existing) return existing;

  const icon = L.divIcon({
    className: 'custom-pin',
    html: `
      <div style="
        width: 50px; height: 62px; position: relative; cursor: pointer;
        filter: drop-shadow(0 2px 5px rgba(0,0,0,0.6));
      ">
        <div style="
          width: 50px; height: 46px; border-radius: 9px;
          background: #111111; border: 2px solid ${color};
          overflow: hidden; position: relative;
        ">
          ${safeImg ? `<img src="${safeImg}" style="width:100%;height:34px;object-fit:cover;border-radius:6px 6px 0 0;" onerror="this.style.display='none'" />` : '<div style="width:100%;height:34px;background:#1A1A1A;display:flex;align-items:center;justify-content:center;"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/></svg></div>'}
          <div style="height:4px;width:100%;background:${color};position:absolute;bottom:0;left:0;"></div>
        </div>
        <div style="
          width: 0; height: 0;
          border-left: 7px solid transparent; border-right: 7px solid transparent;
          border-top: 11px solid ${color};
          margin: 0 auto; position: relative; top: -1px;
        "></div>
      </div>
    `,
    iconSize: [50, 62],
    iconAnchor: [25, 62],
    popupAnchor: [0, -62]
  });

  pinIconCache.set(key, icon);
  return icon;
};

// User Live GPS Icon with glowing beacon (Exact Mode)
const userGpsIcon = L.divIcon({
  className: 'custom-user-gps-marker',
  html: `
    <div style="position: relative; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center;">
      <div style="position: absolute; width: 32px; height: 32px; border-radius: 50%; background: rgba(255,69,0,0.25); animation: mapGlow 2s infinite ease-in-out;"></div>
      <div style="position: absolute; width: 18px; height: 18px; border-radius: 50%; background: rgba(255,69,0,0.4); border: 1.5px solid rgba(255,69,0,0.8);"></div>
      <div style="width: 10px; height: 10px; border-radius: 50%; background: #FF4500; border: 2px solid #FFFFFF; box-shadow: 0 0 10px rgba(255,69,0,0.95); z-index: 2;"></div>
    </div>
  `,
  iconSize: [32, 32],
  iconAnchor: [16, 16]
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
    <div className="relative w-full h-[calc(100dvh-130px)] bg-[#080808] overflow-hidden select-none font-sans">
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
          preferCanvas={true}
          className="w-full h-full"
          zoomControl={false}
          style={{ width: '100%', height: '100%', backgroundColor: '#080808' }}
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

          {/* User Location Rendering — Exact GPS Pin vs 1km Approximate Circle vs Hidden */}
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
                        color: '#FF4500',
                        fillColor: '#FF4500',
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
                    color: '#FF4500',
                    fillColor: '#FF4500',
                    fillOpacity: 0.12,
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
                pathOptions={{ color: '#FF4500', fillColor: '#FF4500', fillOpacity: 0.08, weight: 1.5, dashArray: '6 4' }}
              />
            </React.Fragment>
          ))}

          {/* Spot Markers */}
          {mapSpots.map((spot) => {
            const conf = RARITY_CONFIG[spot.rarity];
            const icon = getCachedPinIcon(conf.color, spot.imageUrl);
            const isApprox = spot.privacyLevel === 'public_blurred' || spot.privacyLevel === 'approximate_only' || !spot.privacyLevel;

            return (
              <React.Fragment key={spot.id}>
                {/* 1km Approximate Perimeter Circle for the spotted vehicle */}
                {isApprox && (
                  <Circle
                    center={[spot.lat, spot.lng]}
                    radius={1000}
                    pathOptions={{
                      color: conf.color,
                      fillColor: conf.color,
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
                      className="p-2.5 text-[#080808] font-sans cursor-pointer hover:bg-[#F0EBE3] rounded-lg transition-colors"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-[9px] font-data font-semibold px-1.5 py-0.5 rounded border ${conf.badgeBg}`}>
                          {conf.label}
                        </span>
                        <span className="text-[10px] font-data text-[#5A5550]">TAP TO VIEW CARD →</span>
                      </div>
                      <strong className="text-sm block leading-tight text-[#080808] font-display">{spot.make} {spot.model}</strong>
                      <span className="text-xs text-[#FF4500] font-semibold">Spotted in {spot.city} · 1km Area</span>
                    </div>
                  </Popup>
                </Marker>
              </React.Fragment>
            );
          })}
        </MapContainer>
      </div>

      {/* Top Search & Back Button Bar */}
      <div className="absolute top-4 left-4 right-4 z-40 max-w-md mx-auto flex items-center gap-2 pointer-events-auto">
        <button
          onClick={() => {
            sounds.playTargetLock();
            setActiveTab('home');
          }}
          className="h-11 px-3.5 rounded-xl bg-[#111111]/90 backdrop-blur-md border border-[#2C2C2C] text-[#F0EBE3] font-display text-sm tracking-wider flex items-center gap-1.5 shadow-2xl hover:border-[#FF4500]/60 transition-all shrink-0 group active:scale-95"
          title="Back to Home"
        >
          <ArrowLeft className="w-5 h-5 text-[#FF4500] group-hover:-translate-x-1 transition-transform" />
          <span>HOME</span>
        </button>

        <button
          onClick={() => {
            sounds.playTargetLock();
            setSearchModalOpen(true);
          }}
          className="flex-1 h-11 px-4 rounded-xl bg-[#111111]/90 backdrop-blur-md border border-[#2C2C2C] text-[#F0EBE3] font-display text-sm tracking-wider flex items-center justify-between shadow-2xl hover:border-[#FF4500]/60 transition-all group active:scale-95"
        >
          <div className="flex items-center gap-2">
            <Search className="w-4 h-4 text-[#FF4500] group-hover:scale-110 transition-transform" />
            <span className="truncate uppercase font-bold text-xs tracking-wider">
              {selectedCity ? `${selectedCity.name} MAP` : `${user.city || 'LOCATION'} MAP`}
            </span>
          </div>
          <span className="text-[10px] font-data text-[#FF4500] bg-[#FF4500]/10 px-2 py-0.5 rounded border border-[#FF4500]/30 shrink-0">
            SEARCH
          </span>
        </button>
      </div>

      {/* Location Privacy & Visibility Mode Control Bar */}
      <div className="absolute top-[68px] left-4 right-4 z-40 max-w-md mx-auto flex items-center justify-between pointer-events-auto">
        <div className="flex items-center gap-1.5 bg-[#111111]/90 backdrop-blur-md border border-[#2C2C2C] rounded-2xl p-1 shadow-2xl">
          <button
            onClick={() => {
              sounds.playTargetLock();
              setLocationDisplayMode('exact');
            }}
            className={`px-3 py-1.5 rounded-xl font-data text-[10px] font-bold tracking-wider flex items-center gap-1.5 transition-all ${
              locationDisplayMode === 'exact'
                ? 'bg-[#FF4500] text-[#F0EBE3] shadow-[0_0_12px_rgba(255,69,0,0.5)]'
                : 'text-[#9A9088] hover:text-[#F0EBE3] hover:bg-white/5'
            }`}
            title="Show Live Pinpoint GPS Location"
          >
            <MapPin className="w-3.5 h-3.5" />
            <span>EXACT PIN</span>
          </button>

          <button
            onClick={() => {
              sounds.playTargetLock();
              setLocationDisplayMode('radius');
            }}
            className={`px-3 py-1.5 rounded-xl font-data text-[10px] font-bold tracking-wider flex items-center gap-1.5 transition-all ${
              locationDisplayMode === 'radius'
                ? 'bg-[#FFA500] text-black shadow-[0_0_12px_rgba(255,165,0,0.5)]'
                : 'text-[#9A9088] hover:text-[#F0EBE3] hover:bg-white/5'
            }`}
            title="Show 1km Approximate Perimeter Zone"
          >
            <Shield className="w-3.5 h-3.5" />
            <span>1KM APPROX</span>
          </button>

          <button
            onClick={() => {
              sounds.playTargetLock();
              setLocationDisplayMode('hidden');
            }}
            className={`px-3 py-1.5 rounded-xl font-data text-[10px] font-bold tracking-wider flex items-center gap-1.5 transition-all ${
              locationDisplayMode === 'hidden'
                ? 'bg-[#333333] text-[#F0EBE3] border border-white/20'
                : 'text-[#9A9088] hover:text-[#F0EBE3] hover:bg-white/5'
            }`}
            title="Hide Location from Map"
          >
            <EyeOff className="w-3.5 h-3.5" />
            <span>HIDE</span>
          </button>
        </div>

        {/* Live Active Mode Indicator Badge with Accuracy */}
        <div className="px-2.5 py-1.5 rounded-xl bg-[#111111]/90 backdrop-blur-md border border-[#2C2C2C] text-[9px] font-data font-bold text-[#9A9088] shadow-2xl flex items-center gap-1.5">
          <span className={`w-2 h-2 rounded-full ${
            locationDisplayMode === 'exact'
              ? 'bg-[#2ECC71] shadow-[0_0_8px_#2ECC71] animate-pulse'
              : locationDisplayMode === 'radius'
              ? 'bg-[#FFA500] shadow-[0_0_8px_#FFA500]'
              : 'bg-[#555555]'
          }`} />
          <span className="uppercase text-[#F0EBE3]">
            {locationDisplayMode === 'exact' ? (liveAccuracyMeters ? `GPS ±${Math.round(liveAccuracyMeters)}M` : 'GPS LIVE') : locationDisplayMode === 'radius' ? '1KM RADIUS' : 'GHOST MODE'}
          </span>
        </div>
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

      {/* BUTTON 1: Location Radar / City Search Modal Button */}
      <button
        onClick={() => {
          sounds.playTargetLock();
          setSearchModalOpen(true);
        }}
        className="absolute bottom-44 right-4 z-30 p-3.5 rounded-full bg-[#111111]/95 backdrop-blur-md border border-[#2C2C2C] text-[#F0EBE3] shadow-2xl hover:border-[#FF4500] transition-all pointer-events-auto group active:scale-90"
        title="Search Global Cities & Radars"
      >
        <Globe className="w-6 h-6 text-[#FF4500] group-hover:rotate-45 transition-transform" />
      </button>

      {/* BUTTON 2: Recenter GPS Live Location Button */}
      <button
        onClick={handleRecenterGps}
        className={`absolute bottom-28 right-4 z-30 p-3.5 rounded-full bg-[#111111]/95 backdrop-blur-md border border-[#2C2C2C] text-[#F0EBE3] shadow-2xl hover:border-[#FF4500] transition-all glow-orange pointer-events-auto group active:scale-90 ${
          isLocating ? 'animate-spin border-[#FF4500]' : ''
        }`}
        title="Recenter on Device GPS Location"
      >
        {isLocating ? (
          <Navigation className="w-6 h-6 text-[#FF4500]" />
        ) : (
          <Crosshair className="w-6 h-6 text-[#FF4500] group-hover:scale-110 transition-transform" />
        )}
      </button>

      {/* Pin Tap Detail Bottom Sheet */}
      {selectedPin && (
        <div className="absolute bottom-20 left-4 right-4 z-40 max-w-md mx-auto bg-[#111111]/95 backdrop-blur-md border border-[#FF4500]/50 hover:border-[#FF4500] rounded-xl p-4 shadow-2xl transition-all pointer-events-auto">
          <div
            onClick={() => {
              if (!activeMatchingHunt) {
                handleOpenSpotCard(selectedPin);
              }
            }}
            className="flex gap-4 cursor-pointer group"
          >
            <div className="relative overflow-hidden rounded-lg border border-[#2C2C2C] shrink-0 bg-[#080808]">
              <img src={selectedPin.imageUrl} alt={selectedPin.model} className="w-24 h-24 object-cover group-hover:scale-110 transition-transform duration-300" />
            </div>

            <div className="flex-1 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <span className={`text-[10px] font-data font-semibold px-2 py-0.5 rounded border ${RARITY_CONFIG[selectedPin.rarity].badgeBg}`}>
                    {RARITY_CONFIG[selectedPin.rarity].label}
                  </span>
                  <span className="text-[10px] font-data text-[#9A9088]">{selectedPin.distance}</span>
                </div>
                <h3 className="font-display text-2xl text-[#F0EBE3] mt-1 leading-none group-hover:text-[#FF4500] transition-colors">{selectedPin.make} {selectedPin.model}</h3>
                <p className="text-xs text-[#9A9088] font-data mt-0.5">Spotted in {selectedPin.city} · Tap card to view</p>
              </div>

              <div className="flex gap-2 pt-2" onClick={e => e.stopPropagation()}>
                {activeMatchingHunt ? (
                  <button
                    onClick={() => {
                      setSelectedPin(null);
                      openHuntModal(activeMatchingHunt);
                    }}
                    className="flex-1 py-2.5 rounded-lg bg-[#FF4500] text-[#F0EBE3] font-display text-sm tracking-wider flex items-center justify-center gap-1.5 glow-orange"
                  >
                    <Flame className="w-4 h-4 fill-[#F0EBE3]" /> JOIN HUNT
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      handleOpenSpotCard(selectedPin);
                      setSelectedPin(null);
                    }}
                    className="flex-1 py-2.5 rounded-lg bg-[#FF4500] text-[#F0EBE3] font-display text-sm tracking-wider flex items-center justify-center gap-1.5 border border-[#FF6A00]/40 glow-orange"
                  >
                    <Eye className="w-4 h-4 text-[#F0EBE3]" /> VIEW 3D CARD
                  </button>
                )}

                <button
                  onClick={() => setSelectedPin(null)}
                  className="px-3 py-2 rounded-lg bg-[#1A1A1A] text-[#F0EBE3] font-display text-sm hover:bg-[#2C2C2C] border border-[#2C2C2C]"
                >
                  CLOSE
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Active Hunt Banner Overlay */}
      {activeHunts.length > 0 && (
        <div className="absolute bottom-24 left-4 right-4 z-30 max-w-md mx-auto bg-[#111111] border border-[#FF4500]/50 rounded-xl p-3 flex items-center justify-between shadow-2xl pointer-events-auto">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-[#1A1A1A] text-[#FF4500] border border-[#FF4500]/30 animate-pulse">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-display text-lg text-[#F0EBE3] leading-none">ACTIVE HUNT ZONE</h4>
              <p className="text-xs text-[#9A9088] font-data">{activeHunts[0].carName} spotted nearby!</p>
            </div>
          </div>
          <button
            onClick={() => openHuntModal(activeHunts[0])}
            className="px-3 py-1.5 rounded-lg bg-[#FF4500] text-[#F0EBE3] font-display text-xs tracking-wider glow-orange"
          >
            JOIN HUNT
          </button>
        </div>
      )}
    </div>
  );
};
