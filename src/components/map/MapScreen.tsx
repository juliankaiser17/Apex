import React, { useState, useMemo, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, CircleMarker, useMap } from 'react-leaflet';
import L from 'leaflet';
import { ShieldAlert, Crosshair, Eye, Search, Flame, ArrowLeft, Globe } from 'lucide-react';
import { useApexStore } from '../../store/useApexStore';
import { RARITY_CONFIG } from '../../utils/rarity';
import type { CarCard } from '../../types/apex';
import { CitySearchModal } from './CitySearchModal';
import type { CityLocation } from './CitySearchModal';
import { Gta5SatelliteHud } from './Gta5SatelliteHud';
import { sounds } from '../../utils/audio';
import { requestRealLocationPermission } from '../../utils/geolocation';

// Custom Leaflet Icons for Rarity Pins — 52×64px with car thumbnail + rarity bar
const createCustomPinIcon = (color: string, imageUrl?: string) => {
  const safeImg = imageUrl || '';
  return L.divIcon({
    className: 'custom-pin',
    html: `
      <div style="
        width: 52px; height: 64px; position: relative; cursor: pointer;
        filter: drop-shadow(0 2px 6px rgba(0,0,0,0.5));
      ">
        <div style="
          width: 52px; height: 48px; border-radius: 10px;
          background: #111111; border: 2px solid ${color};
          overflow: hidden; position: relative;
        ">
          ${safeImg ? `<img src="${safeImg}" style="width:100%;height:36px;object-fit:cover;border-radius:7px 7px 0 0;" onerror="this.style.display='none'" />` : '<div style="width:100%;height:36px;background:#1A1A1A;display:flex;align-items:center;justify-content:center;font-size:20px;">🚗</div>'}
          <div style="height:4px;width:100%;background:${color};position:absolute;bottom:0;left:0;"></div>
        </div>
        <div style="
          width: 0; height: 0;
          border-left: 8px solid transparent; border-right: 8px solid transparent;
          border-top: 12px solid ${color};
          margin: 0 auto; position: relative; top: -1px;
        "></div>
      </div>
    `,
    iconSize: [52, 64],
    iconAnchor: [26, 64],
    popupAnchor: [0, -64]
  });
};

// GTA V Camera Controller sub-component using useMap
interface GtaCameraControllerProps {
  targetCity: CityLocation | null;
  onAnimationPhaseChange: (phase: 'ascent' | 'pan' | 'descent' | null) => void;
}

const GtaCameraController: React.FC<GtaCameraControllerProps> = ({ targetCity, onAnimationPhaseChange }) => {
  const map = useMap();
  const lastCityRef = useRef<string | null>(null);

  React.useEffect(() => {
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
  React.useEffect(() => {
    if (!recenterTarget) return;
    map.flyTo([recenterTarget.lat, recenterTarget.lng], recenterTarget.zoom || 15, {
      duration: 1.5,
      easeLinearity: 0.25
    });
    map.invalidateSize();
  }, [recenterTarget, map]);
  return null;
};

// Helper component to trigger Leaflet map invalidateSize on mount
const MapInvalidator: React.FC = () => {
  const map = useMap();
  React.useEffect(() => {
    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 200);
    return () => clearTimeout(timer);
  }, [map]);
  return null;
};

// AutoLocater component to recenter map when location is acquired
const AutoLocater: React.FC<{ userLat: number; userLng: number }> = ({ userLat, userLng }) => {
  const map = useMap();
  const hasLocated = useRef(false);

  React.useEffect(() => {
    if (userLat !== 0 && userLng !== 0 && !hasLocated.current) {
      map.setView([userLat, userLng], 14, { animate: true, duration: 1.5 });
      hasLocated.current = true;
    }
  }, [userLat, userLng, map]);
  return null;
};

export interface MapSpotPin extends CarCard {
  lat: number;
  lng: number;
  city: string;
  distance: string;
}

export const MapScreen: React.FC = () => {
  const { garage, activeHunts, user, updateUserProfile, setSelectedCardForDetail, setActiveTab, openHuntModal } = useApexStore();
  const [selectedPin, setSelectedPin] = useState<MapSpotPin | null>(null);
  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const [selectedCity, setSelectedCity] = useState<CityLocation | null>(null);
  const [gtaAnimationPhase, setGtaAnimationPhase] = useState<'ascent' | 'pan' | 'descent' | null>(null);
  const [recenterTarget, setRecenterTarget] = useState<{ lat: number; lng: number; zoom?: number; timestamp: number } | null>(null);

  React.useEffect(() => {
    if (user.latitude === 0) {
      requestRealLocationPermission().then((res) => {
        if (res.granted && res.city && res.city !== 'Local Area') {
          updateUserProfile({
            latitude: res.latitude,
            longitude: res.longitude,
            city: res.city,
            country: res.country
          });
        }
      }).catch(err => console.warn('Location fetch failed in MapScreen:', err));
    }
  }, [user.latitude, updateUserProfile]);

  const defaultCenter: [number, number] = [user.latitude || 35.6762, user.longitude || 139.6503];

  const mapSpots = useMemo<MapSpotPin[]>(() => {
    return garage.map((card, index) => ({
      ...card,
      id: `map-spot-${card.id}`,
      lat: card.latApprox || (user.latitude ? user.latitude + (index % 3) * 0.005 : 35.6762),
      lng: card.lngApprox || (user.longitude ? user.longitude + (index % 3) * 0.005 : 139.6503),
      city: card.city || user.city || 'Radar Sector',
      distance: `${(0.4 + (index % 5) * 0.4).toFixed(1)} km away`
    }));
  }, [garage, user.latitude, user.longitude, user.city]);

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
    try {
      const res = await requestRealLocationPermission();
      if (res.granted) {
        updateUserProfile({
          latitude: res.latitude,
          longitude: res.longitude,
          city: res.city,
          country: res.country
        });
        setRecenterTarget({ lat: res.latitude, lng: res.longitude, zoom: 15, timestamp: Date.now() });
      } else if (user.latitude && user.longitude) {
        setRecenterTarget({ lat: user.latitude, lng: user.longitude, zoom: 15, timestamp: Date.now() });
      }
    } catch {
      if (user.latitude && user.longitude) {
        setRecenterTarget({ lat: user.latitude, lng: user.longitude, zoom: 15, timestamp: Date.now() });
      }
    }
  };

  return (
    <div className="relative flex-1 flex flex-col w-full h-[calc(100vh-140px)] min-h-[580px] bg-[#080808] overflow-hidden select-none" style={{ fontFamily: 'DM Sans' }}>
      {/* 1. Full-Screen Mapbox Dark Leaflet Container */}
      <div className="absolute inset-0 z-0 dark-tiles">
        <MapContainer
          center={defaultCenter}
          zoom={13}
          scrollWheelZoom={true}
          className="w-full h-full"
          zoomControl={false}
          style={{ width: '100%', height: '100%' }}
        >
          <MapInvalidator />
          <AutoLocater userLat={user.latitude} userLng={user.longitude} />
          <MapNavigationController recenterTarget={recenterTarget} />
          <TileLayer
            attribution='&copy; <a href="https://carto.com/">CartoDB</a>'
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          />

          {/* User Location — 3-Ring Ripple Marker */}
          {user.latitude && user.longitude && (
            <>
              <CircleMarker
                center={[user.latitude, user.longitude]}
                radius={24}
                pathOptions={{ color: '#FF4500', fillColor: '#FF4500', fillOpacity: 0.06, weight: 1, className: 'animate-ripple-1' }}
              />
              <CircleMarker
                center={[user.latitude, user.longitude]}
                radius={16}
                pathOptions={{ color: '#FF4500', fillColor: '#FF4500', fillOpacity: 0.1, weight: 1, className: 'animate-ripple-2' }}
              />
              <CircleMarker
                center={[user.latitude, user.longitude]}
                radius={10}
                pathOptions={{ color: '#FF4500', fillColor: '#FF4500', fillOpacity: 0.15, weight: 1.5, className: 'animate-ripple-3' }}
              />
              <CircleMarker
                center={[user.latitude, user.longitude]}
                radius={5}
                pathOptions={{ color: '#FF4500', fillColor: '#FF4500', fillOpacity: 1, weight: 2 }}
              />
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
                radius={2500}
                pathOptions={{ color: '#FF4500', fillColor: 'transparent', fillOpacity: 0, weight: 1, dashArray: '8 4', className: 'animate-hunt-ring' }}
              />
              <Circle
                center={[hunt.latApprox, hunt.lngApprox]}
                radius={2000}
                pathOptions={{ color: '#FF4500', fillColor: '#FF4500', fillOpacity: 0.08, weight: 1.5 }}
              />
              <Circle
                center={[hunt.latApprox, hunt.lngApprox]}
                radius={1500}
                pathOptions={{ color: '#FF4500', fillColor: '#FF4500', fillOpacity: 0.15, weight: 0 }}
              />
            </React.Fragment>
          ))}

          {/* Spot Markers */}
          {mapSpots.map((spot) => {
            const conf = RARITY_CONFIG[spot.rarity];
            const icon = createCustomPinIcon(conf.color, spot.imageUrl);
            return (
              <Marker
                key={spot.id}
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
                    <span className="text-xs text-[#FF4500] font-semibold">Spotted in {spot.city}</span>
                  </div>
                </Popup>
              </Marker>
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
          className="h-11 px-3.5 rounded-xl bg-[#111111]/90 backdrop-blur-md border border-[#2C2C2C] text-[#F0EBE3] font-display text-sm tracking-wider flex items-center gap-1.5 shadow-2xl hover:border-[#FF4500]/60 transition-all shrink-0 group"
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
          className="flex-1 h-11 px-4 rounded-xl bg-[#111111]/90 backdrop-blur-md border border-[#2C2C2C] text-[#F0EBE3] font-display text-sm tracking-wider flex items-center justify-between shadow-2xl hover:border-[#FF4500]/60 transition-all group"
        >
          <div className="flex items-center gap-2">
            <Search className="w-5 h-5 text-[#FF4500] group-hover:scale-110 transition-transform" />
            <span className="truncate uppercase font-bold text-xs tracking-wider">
              {selectedCity ? `${selectedCity.name} RADAR` : `${user.city || 'LOCATION'} RADAR`}
            </span>
          </div>
          <span className="text-[10px] font-data text-[#FF4500] bg-[#FF4500]/10 px-2 py-0.5 rounded border border-[#FF4500]/30 shrink-0">
            SEARCH 🔍
          </span>
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

      {/* BUTTON 1: Location Radar / City Search Modal Button */}
      <button
        onClick={() => {
          sounds.playTargetLock();
          setSearchModalOpen(true);
        }}
        className="absolute bottom-44 right-4 z-30 p-3.5 rounded-full bg-[#111111]/95 backdrop-blur-md border border-[#2C2C2C] text-[#F0EBE3] shadow-2xl hover:border-[#FF4500] transition-colors pointer-events-auto group"
        title="Search Global Cities & Radars"
      >
        <Globe className="w-6 h-6 text-[#FF4500] group-hover:rotate-45 transition-transform" />
      </button>

      {/* BUTTON 2: Recenter GPS Live Location Button */}
      <button
        onClick={handleRecenterGps}
        className="absolute bottom-28 right-4 z-30 p-3.5 rounded-full bg-[#111111]/95 backdrop-blur-md border border-[#2C2C2C] text-[#F0EBE3] shadow-2xl hover:border-[#FF4500] transition-colors glow-orange pointer-events-auto group"
        title="Recenter on Device GPS Location"
      >
        <Crosshair className="w-6 h-6 text-[#FF4500] group-hover:scale-110 transition-transform" />
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
