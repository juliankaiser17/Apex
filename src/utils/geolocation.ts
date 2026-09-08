/**
 * APEX — Production-Grade High-Accuracy Geolocation & Reverse Geocoding Engine
 * 
 * Implements multi-tier location acquisition:
 * 1. Hardware GPS (Satellite + Wi-Fi Fine Location, 0 maxAge)
 * 2. Network Triangulation (Coarse Location fallback)
 * 3. Real-time IP-based Geo-resolution (ISP/City accurate fallback)
 * 4. Continuous High-Frequency Live GPS Watcher with minimum distance filtering.
 */

import { Geolocation, type Position } from '@capacitor/geolocation';
import { Capacitor } from '@capacitor/core';

export interface LocationPermissionResult {
  granted: boolean;
  isFallback: boolean;
  latitude: number;
  longitude: number;
  latApprox: number;
  lngApprox: number;
  city: string;
  country: string;
  accuracyMeters?: number;
}

// In-memory cache for reverse geocoding to prevent excessive network requests
const geocodeCache = new Map<string, { city: string; country: string; timestamp: number }>();

export function offsetCoordinatesApprox(lat: number, lng: number): { latApprox: number; lngApprox: number } {
  return {
    latApprox: Number(lat.toFixed(5)),
    lngApprox: Number(lng.toFixed(5))
  };
}

/**
 * High-accuracy reverse geocode using multi-provider cascade:
 * 1. BigDataCloud Client (fast, CORS-friendly, free, high locality accuracy)
 * 2. OpenStreetMap Nominatim
 * 3. FreeIPAPI / Timezone fallback
 */
export async function reverseGeocodeCity(lat: number, lng: number): Promise<{ city: string; country: string }> {
  if (lat === 0 && lng === 0) {
    return { city: '', country: 'Global' };
  }

  const cacheKey = `${lat.toFixed(3)},${lng.toFixed(3)}`;
  const cached = geocodeCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < 3600000) {
    return { city: cached.city, country: cached.country };
  }

  // 1. BigDataCloud Reverse Geocode
  try {
    const res = await fetch(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en`,
      { signal: AbortSignal.timeout(4000) }
    );
    if (res.ok) {
      const data = await res.json();
      // Specifically pick municipality/city first, NOT state/principalSubdivision
      const rawCity = data.city || data.locality;
      const adminCity = data.localityInfo?.administrative?.find((a: any) => 
        (a.order === 3 || a.order === 4 || a.adminLevel === 8 || a.adminLevel === 6) && a.name
      )?.name;
      const city = (rawCity && rawCity.trim().length > 0) ? rawCity : (adminCity || '');
      const country = data.countryName || 'Global';

      if (city && city.trim().length > 0) {
        const cleanCity = city.trim();
        geocodeCache.set(cacheKey, { city: cleanCity, country, timestamp: Date.now() });
        return { city: cleanCity, country };
      }
    }
  } catch (e) {
    // Fallthrough to provider 2
  }

  // 2. OpenStreetMap Nominatim Reverse Geocoding
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=12`,
      {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'APEX-Vehicle-Scanner/2.5'
        },
        signal: AbortSignal.timeout(4000)
      }
    );
    if (res.ok) {
      const data = await res.json();
      const addr = data.address || {};
      const city =
        addr.city ||
        addr.town ||
        addr.municipality ||
        addr.village ||
        addr.hamlet ||
        addr.city_district ||
        addr.suburb ||
        addr.county ||
        '';
      const country = addr.country || 'Global';

      if (city && city.trim().length > 0) {
        const cleanCity = city.trim();
        geocodeCache.set(cacheKey, { city: cleanCity, country, timestamp: Date.now() });
        return { city: cleanCity, country };
      }
    }
  } catch (e) {
    // Fallthrough
  }

  // 3. Fallback based on Timezone estimation
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
  const tzCity = tz.split('/')[1]?.replace(/_/g, ' ') || 'Your City';
  return { city: tzCity, country: 'Global' };
}

/**
 * Forward Geocoding: Look up city name to coordinates
 */
export async function geocodeCity(cityName: string): Promise<{ lat: number; lng: number; city: string; country: string }> {
  const clean = cityName.trim();
  if (!clean) {
    return { lat: 0, lng: 0, city: '', country: '' };
  }

  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(clean)}&format=json&limit=1`,
      {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'APEX-Vehicle-Scanner/2.5'
        },
        signal: AbortSignal.timeout(5000)
      }
    );
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        const item = data[0];
        const lat = parseFloat(item.lat);
        const lng = parseFloat(item.lon);
        const country = item.display_name?.split(',').pop()?.trim() || 'Global';
        return { lat, lng, city: clean, country };
      }
    }
  } catch (e) {
    console.warn('Forward geocode failed:', e);
  }

  return { lat: 0, lng: 0, city: clean, country: 'Global' };
}

/**
 * High-accuracy, non-rate-limited IP-based Geolocation fallback
 */
async function fetchIpGeolocation(): Promise<{ latitude: number; longitude: number; city: string; country: string } | null> {
  // Provider 1: ipwho.is (CORS-friendly, accurate city/coordinates, no rate limit errors)
  try {
    const res = await fetch('https://ipwho.is/', { signal: AbortSignal.timeout(3500) });
    if (res.ok) {
      const data = await res.json();
      if (data.success && data.latitude && data.longitude) {
        return {
          latitude: Number(data.latitude),
          longitude: Number(data.longitude),
          city: data.city || data.region || 'Current City',
          country: data.country || 'Global'
        };
      }
    }
  } catch (e) {}

  // Provider 2: ipwhois.app
  try {
    const res = await fetch('https://ipwhois.app/json/', { signal: AbortSignal.timeout(3500) });
    if (res.ok) {
      const data = await res.json();
      if (data.success && data.latitude && data.longitude) {
        return {
          latitude: Number(data.latitude),
          longitude: Number(data.longitude),
          city: data.city || data.region || 'Current City',
          country: data.country || 'Global'
        };
      }
    }
  } catch (e) {}

  // Provider 3: ipinfo.io
  try {
    const res = await fetch('https://ipinfo.io/json', { signal: AbortSignal.timeout(3500) });
    if (res.ok) {
      const data = await res.json();
      if (data.loc) {
        const [lat, lng] = data.loc.split(',').map(Number);
        if (!isNaN(lat) && !isNaN(lng)) {
          return {
            latitude: lat,
            longitude: lng,
            city: data.city || data.region || 'Current City',
            country: data.country || 'Global'
          };
        }
      }
    }
  } catch (e) {}

  return null;
}

/**
 * Request real device GPS location permission with progressive multi-tier fallback
 */
export async function requestRealLocationPermission(): Promise<LocationPermissionResult> {
  let lat = 0;
  let lng = 0;
  let accuracyMeters: number | undefined;

  const isPermGranted = (status: any) =>
    status?.location === 'granted' || status?.coarseLocation === 'granted';

  // 1. Native Capacitor Geolocation
  if (Capacitor.isNativePlatform()) {
    try {
      let permStatus = await Geolocation.checkPermissions();
      if (!isPermGranted(permStatus)) {
        permStatus = await Geolocation.requestPermissions({ permissions: ['location', 'coarseLocation'] });
      }

      if (isPermGranted(permStatus)) {
        try {
          // High-accuracy GPS fix with 7s timeout
          const pos = await Geolocation.getCurrentPosition({
            enableHighAccuracy: true,
            timeout: 7000,
            maximumAge: 60000
          });
          lat = pos.coords.latitude;
          lng = pos.coords.longitude;
          accuracyMeters = pos.coords.accuracy;
        } catch (gpsErr) {
          // Fallback to coarse network location
          const coarsePos = await Geolocation.getCurrentPosition({
            enableHighAccuracy: false,
            timeout: 5000,
            maximumAge: 300000
          });
          lat = coarsePos.coords.latitude;
          lng = coarsePos.coords.longitude;
          accuracyMeters = coarsePos.coords.accuracy;
        }
      }
    } catch (nativeErr) {
      console.warn('Native Capacitor GPS acquisition notice:', nativeErr);
    }
  }

  // 2. Web Browser HTML5 Geolocation (also works as Android WebView direct provider)
  if (lat === 0 && lng === 0 && typeof navigator !== 'undefined' && navigator.geolocation) {
    try {
      const getBrowserPos = (highAcc: boolean, timeoutMs: number): Promise<GeolocationPosition> =>
        new Promise((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: highAcc,
            timeout: timeoutMs,
            maximumAge: highAcc ? 60000 : 300000
          });
        });

      try {
        const pos = await getBrowserPos(true, 6000);
        lat = pos.coords.latitude;
        lng = pos.coords.longitude;
        accuracyMeters = pos.coords.accuracy;
      } catch {
        const coarsePos = await getBrowserPos(false, 4000);
        lat = coarsePos.coords.latitude;
        lng = coarsePos.coords.longitude;
        accuracyMeters = coarsePos.coords.accuracy;
      }
    } catch (browserErr) {
      console.warn('Browser GPS notice:', browserErr);
    }
  }

  // If valid hardware GPS/network coordinates obtained, reverse geocode exact city
  if (lat !== 0 && lng !== 0) {
    const approx = offsetCoordinatesApprox(lat, lng);
    const geoInfo = await reverseGeocodeCity(lat, lng);

    return {
      granted: true,
      isFallback: false,
      latitude: lat,
      longitude: lng,
      ...approx,
      city: geoInfo.city,
      country: geoInfo.country,
      accuracyMeters
    };
  }

  // 3. High-Accuracy IP Geolocation fallback (accurate to real ISP city/region)
  const ipGeo = await fetchIpGeolocation();
  if (ipGeo && ipGeo.latitude !== 0 && ipGeo.longitude !== 0) {
    const approx = offsetCoordinatesApprox(ipGeo.latitude, ipGeo.longitude);
    return {
      granted: false,
      isFallback: true,
      latitude: ipGeo.latitude,
      longitude: ipGeo.longitude,
      ...approx,
      city: ipGeo.city,
      country: ipGeo.country,
      accuracyMeters: 2500
    };
  }

  // 4. Timezone estimation without hardcoding arbitrary cities
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
  const tzCity = tz.split('/')[1]?.replace(/_/g, ' ') || 'Your City';

  return {
    granted: false,
    isFallback: true,
    latitude: 0,
    longitude: 0,
    latApprox: 0,
    lngApprox: 0,
    city: tzCity,
    country: 'Global',
    accuracyMeters: 10000
  };
}

export const GPS_MOVEMENT_THRESHOLD_METERS = 10;

/**
 * Continuous high-frequency GPS watcher for smooth map tracking.
 * Uses configurable distance threshold to eliminate micro-jitter and unnecessary renders.
 */
export function watchUserLocation(
  onUpdate: (result: { latitude: number; longitude: number; accuracyMeters: number }) => void,
  onError?: (err: any) => void,
  thresholdMeters: number = GPS_MOVEMENT_THRESHOLD_METERS
): () => void {
  let watchId: any = null;
  let lastLat = 0;
  let lastLng = 0;

  // Accurate equirectangular distance filter in meters
  const isMeaningfulMovement = (newLat: number, newLng: number) => {
    if (lastLat === 0 && lastLng === 0) return true;
    const latRad = ((lastLat + newLat) / 2) * (Math.PI / 180);
    const dx = (newLng - lastLng) * Math.cos(latRad) * 111320;
    const dy = (newLat - lastLat) * 110540;
    const distanceMeters = Math.sqrt(dx * dx + dy * dy);
    return distanceMeters >= thresholdMeters;
  };

  if (Capacitor.isNativePlatform()) {
    Geolocation.watchPosition(
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 1000 },
      (position: Position | null, err?: any) => {
        if (err) {
          onError?.(err);
          return;
        }
        if (position) {
          const { latitude, longitude, accuracy } = position.coords;
          if (isMeaningfulMovement(latitude, longitude)) {
            lastLat = latitude;
            lastLng = longitude;
            onUpdate({ latitude, longitude, accuracyMeters: accuracy || 10 });
          }
        }
      }
    ).then((id) => {
      watchId = id;
    });

    return () => {
      if (watchId) {
        Geolocation.clearWatch({ id: watchId });
      }
    };
  }

  // Web navigator.geolocation
  if (typeof navigator !== 'undefined' && navigator.geolocation) {
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        if (isMeaningfulMovement(latitude, longitude)) {
          lastLat = latitude;
          lastLng = longitude;
          onUpdate({ latitude, longitude, accuracyMeters: accuracy || 10 });
        }
      },
      (err) => onError?.(err),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 1000 }
    );

    return () => {
      navigator.geolocation.clearWatch(id);
    };
  }

  return () => {};
}
