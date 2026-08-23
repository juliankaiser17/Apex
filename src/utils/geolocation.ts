/**
 * Real Location & Geolocation Service for APEX
 * 
 * Requests user location permissions and resolves real city and country accurately
 * across Android, iOS, and Web environments.
 */

import { Geolocation } from '@capacitor/geolocation';

export interface LocationPermissionResult {
  granted: boolean;
  latitude: number;
  longitude: number;
  latApprox: number;
  lngApprox: number;
  city: string;
  country: string;
}

// Default fallback center if GPS is completely denied
const DEFAULT_CENTER = {
  latitude: 35.6762,
  longitude: 139.6503,
  city: 'Tokyo',
  country: 'Japan'
};

export function offsetCoordinatesApprox(lat: number, lng: number): { latApprox: number; lngApprox: number } {
  return {
    latApprox: Number(lat.toFixed(5)),
    lngApprox: Number(lng.toFixed(5))
  };
}

// In-memory cache for reverse geocoding
const geocodeCache = new Map<string, { city: string; country: string; timestamp: number }>();

/**
 * Reverse geocode latitude & longitude to get real city and country name
 */
export async function reverseGeocodeCity(lat: number, lng: number): Promise<{ city: string; country: string }> {
  const cacheKey = `${lat.toFixed(2)},${lng.toFixed(2)}`;
  const cached = geocodeCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < 3600000) {
    return { city: cached.city, country: cached.country };
  }

  // 1. Primary fast provider: BigDataCloud Reverse Geocoding API
  try {
    const bdcUrl = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en`;
    const res = await fetch(bdcUrl);
    if (res.ok) {
      const data = await res.json();
      const city = data.city || data.locality || data.principalSubdivision || data.localityInfo?.administrative?.[2]?.name || '';
      const country = data.countryName || 'Global';
      if (city && city.trim().length > 0) {
        geocodeCache.set(cacheKey, { city: city.trim(), country, timestamp: Date.now() });
        return { city: city.trim(), country };
      }
    }
  } catch (e) {
    console.warn('BigDataCloud geocode failed, trying fallback:', e);
  }

  // 2. Secondary fallback: OpenStreetMap Nominatim with User-Agent
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=10`, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'APEX-Spotter-App/1.0'
      }
    });
    if (res.ok) {
      const data = await res.json();
      const addr = data.address || {};
      const city = addr.city || addr.town || addr.municipality || addr.village || addr.state_district || addr.county || '';
      const country = addr.country || 'Global';
      if (city && city.trim().length > 0) {
        geocodeCache.set(cacheKey, { city: city.trim(), country, timestamp: Date.now() });
        return { city: city.trim(), country };
      }
    }
  } catch (e) {
    console.warn('Nominatim geocode failed:', e);
  }

  // 3. Fallback based on Timezone estimation if coordinates are valid
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
  const tzCity = tz.split('/')[1]?.replace(/_/g, ' ') || 'Global City';

  return { city: tzCity, country: 'Local Region' };
}

export interface ForwardGeocodeResult {
  name: string;
  country: string;
  lat: number;
  lng: number;
}

// In-memory cache for forward geocoding (city name -> coordinates)
const forwardGeocodeCache = new Map<string, ForwardGeocodeResult | null>();

/**
 * Forward-geocode a free-typed place name to real coordinates using OpenStreetMap
 * Nominatim's public /search endpoint (no API key required). Used by city/location search
 * so typing ANY real-world city, town, or landmark resolves to its actual position instead
 * of a fabricated random point.
 */
export async function forwardGeocodeCity(query: string): Promise<ForwardGeocodeResult | null> {
  const trimmed = query.trim();
  if (!trimmed) return null;

  const cacheKey = trimmed.toLowerCase();
  if (forwardGeocodeCache.has(cacheKey)) {
    return forwardGeocodeCache.get(cacheKey) ?? null;
  }

  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(trimmed)}&limit=1&addressdetails=1`;
    const res = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'APEX-Spotter-App/1.0'
      }
    });

    if (res.ok) {
      const results = await res.json();
      const top = Array.isArray(results) ? results[0] : null;
      if (top && top.lat && top.lon) {
        const addr = top.address || {};
        const name =
          addr.city || addr.town || addr.municipality || addr.village ||
          (typeof top.display_name === 'string' ? top.display_name.split(',')[0] : trimmed);
        const country = addr.country || 'Global';
        const result: ForwardGeocodeResult = {
          name: name || trimmed,
          country,
          lat: parseFloat(top.lat),
          lng: parseFloat(top.lon)
        };
        forwardGeocodeCache.set(cacheKey, result);
        return result;
      }
    }
  } catch (e) {
    console.warn('Forward geocode failed:', e);
  }

  forwardGeocodeCache.set(cacheKey, null);
  return null;
}

/**
 * Request real device GPS location permission
 */
export async function requestRealLocationPermission(): Promise<LocationPermissionResult> {
  try {
    let permStatus = await Geolocation.checkPermissions();
    if (permStatus.location !== 'granted') {
      permStatus = await Geolocation.requestPermissions();
    }

    if (permStatus.location !== 'granted') {
      throw new Error('Location permission denied');
    }

    const pos = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 8000 });
    const lat = pos.coords.latitude;
    const lng = pos.coords.longitude;
    const approx = offsetCoordinatesApprox(lat, lng);
    const geoInfo = await reverseGeocodeCity(lat, lng);

    return {
      granted: true,
      latitude: lat,
      longitude: lng,
      ...approx,
      city: geoInfo.city,
      country: geoInfo.country
    };
  } catch (err: any) {
    console.warn('Native Location permission denied or unavailable:', err.message);
    const approx = offsetCoordinatesApprox(DEFAULT_CENTER.latitude, DEFAULT_CENTER.longitude);
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
    const tzCity = tz.split('/')[1]?.replace(/_/g, ' ') || 'Local Hub';
    return {
      granted: false,
      latitude: DEFAULT_CENTER.latitude,
      longitude: DEFAULT_CENTER.longitude,
      ...approx,
      city: tzCity,
      country: DEFAULT_CENTER.country
    };
  }
}
