import React, { useState, useMemo, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from 'react-leaflet';
import L from 'leaflet';
import { ShieldAlert, Crosshair, Eye, Search, Flame, ArrowLeft, MapPin } from 'lucide-react';
import { useApexStore } from '../../store/useApexStore';
import { RARITY_CONFIG } from '../../utils/rarity';
import type { CarCard } from '../../types/apex';
import { CitySearchModal } from './CitySearchModal';
import type { CityLocation } from './CitySearchModal';
import { Gta5SatelliteHud } from './Gta5SatelliteHud';
import { sounds } from '../../utils/audio';

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

import { requestRealLocationPermission } from '../../utils/geolocation';

export const MapScreen: React.FC = () => {
  const { garage, activeHunts, user, updateUserProfile, locationDisplayMode, setLocationDisplayMode, setSelectedCardForDetail, setActiveTab, openHuntModal } = useApexStore();
  const [selectedPin, setSelectedPin] = useState<MapSpotPin | null>(null);
  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const [selectedCity, setSelectedCity] = useState<CityLocation | null>(null);
  const [gtaAnimationPhase, setGtaAnimationPhase] = useState<'ascent' | 'pan' | 'descent' | null>(null);

  React.useEffect(() => {
    // If user's latitude is 0 (hasn't been set or acquired), fetch it now
    if (user.latitude === 0) {
      requestRealLocationPermission().then((res) => {
        if (res.granted) {
          updateUserProfile({
            latitude: res.latitude,
            longitude: res.longitude,
            city: res.city,
          });
        }
      }).catch(err => console.warn('Location fetch failed in MapScreen:', err));
    }
  }, [user.latitude, updateUserProfile]);

  const defaultCenter: [number, number] = [user.latitude || 20.5937, user.longitude || 78.9629];

  const mapSpots = useMemo<MapSpotPin[]>(() => {
    return garage.map((card, index) => ({
      ...card,
      id: `map-spot-${card.id}`,
      lat: card.latApprox,
      lng: card.lngApprox,
      city: 'Unknown City',
      distance: `${(0.4 + (index % 5) * 0.4).toFixed(1)} km away`
    }));
  }, [garage]);

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
    setSearchModalOpen(false);
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
          <TileLayer
            attribution='&copy; <a href="https://carto.com/">CartoDB</a>'
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          />

          {/* User Location */}
          {user.latitude && user.longitude && (
            locationDisplayMode === 'radius' ? (
              <Circle
                center={[user.latitude, user.longitude]}
                radius={1000}
                pathOptions={{ color: '#FF4500', fillColor: '#FF4500', fillOpacity: 0.15, weight: 2, dashArray: '6 6', className: 'animate-map-glow' }}
              />
            ) : (
              <Circle
                center={[user.latitude, user.longitude]}
                radius={30}
                pathOptions={{ color: '#FF4500', fillColor: '#FF4500', fillOpacity: 1, weight: 3 }}
              />
            )
          )}

          {/* GTA V Camera Controller */}
          <GtaCameraController
            targetCity={selectedCity}
            onAnimationPhaseChange={setGtaAnimationPhase}
          />

          {/* Active Hunt Zone Circles */}
          {activeHunts.map((hunt) => (
            <Circle
              key={hunt.id}
              center={[hunt.latApprox, hunt.lngApprox]}
              radius={2000}
              pathOptions={{ color: '#FF4500', fillColor: '#FF4500', fillOpacity: 0.2 }}
            />
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

      {/* 2. Top GTA 5 Search & Back Button Bar */}
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
            <span className="truncate uppercase font-bold">
              {selectedCity ? `${selectedCity.name} RADAR` : 'LOCATION RADAR / SEARCH'}
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
          countryName={selectedCity?.country || 'India'}
          phase={gtaAnimationPhase}
        />
      )}

      {/* City Search Modal */}
      <CitySearchModal
        isOpen={searchModalOpen}
        onClose={() => setSearchModalOpen(false)}
        onSelectCity={handleSelectCity}
      />

      {/* Map Settings / Location Mode Toggle */}
      <button
        onClick={() => {
          sounds.playXpPop();
          setLocationDisplayMode(locationDisplayMode === 'radius' ? 'exact' : 'radius');
        }}
        className="absolute bottom-44 right-4 z-30 p-3 rounded-full bg-[#111111]/95 backdrop-blur-md border border-[#2C2C2C] text-[#F0EBE3] shadow-2xl hover:border-[#FF4500] transition-colors pointer-events-auto"
        title="Toggle Location Mode (1km Radius vs Exact)"
      >
        {locationDisplayMode === 'radius' ? (
           <Eye className="w-6 h-6 text-[#FF4500]" />
        ) : (
           <MapPin className="w-6 h-6 text-[#2ECC71]" />
        )}
      </button>

      {/* Recenter Button */}
      <button
        onClick={() => setSelectedPin(null)}
        className="absolute bottom-28 right-4 z-30 p-3 rounded-full bg-[#111111]/90 backdrop-blur-md border border-[#2C2C2C] text-[#F0EBE3] shadow-2xl hover:border-[#FF4500] transition-colors glow-orange pointer-events-auto"
      >
        <Crosshair className="w-6 h-6 text-[#FF4500]" />
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
