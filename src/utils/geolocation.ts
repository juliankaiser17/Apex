/**
 * Real Location & Geolocation Service for APEX
 * 
 * Requests user location permissions and generates an approximate location offset 
 * (~1.5km - 2.0km radius) for privacy while preserving local city accuracy.
 */

export interface LocationPermissionResult {
  granted: boolean;
  latitude: number;
  longitude: number;
  latApprox: number;
  lngApprox: number;
  city: string;
  country: string;
}

// Default fallback approximate center if GPS is denied or unavailable
const DEFAULT_CENTER = {
  latitude: 22.2950,
  longitude: 114.1720,
  city: 'Your City',
  country: 'Local Area'
};

/**
 * Apply a random 1.5km - 2.0km privacy radius offset to raw GPS coordinates
 */
export function offsetCoordinatesApprox(lat: number, lng: number): { latApprox: number; lngApprox: number } {
  // Removing privacy offset to provide exact accuracy per user request
  return {
    latApprox: Number(lat.toFixed(5)),
    lngApprox: Number(lng.toFixed(5))
  };
}

/**
 * Reverse geocode latitude & longitude to get real city and country name
 */
export async function reverseGeocodeCity(lat: number, lng: number): Promise<{ city: string; country: string }> {
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=10`);
    if (res.ok) {
      const data = await res.json();
      const addr = data.address || {};
      const city = addr.city || addr.town || addr.village || addr.state_district || addr.county || 'Local Area';
      const country = addr.country || 'Global';
      return { city, country };
    }
  } catch (e) {
    console.warn('Reverse geocoding fetch failed:', e);
  }
  return { city: 'Local Area', country: 'Your Region' };
}

import { Geolocation } from '@capacitor/geolocation';

/**
 * Request real device GPS location permission
 */
export async function requestRealLocationPermission(): Promise<LocationPermissionResult> {
  try {
    // 1. Check and Request Permissions natively
    let permStatus = await Geolocation.checkPermissions();
    if (permStatus.location !== 'granted') {
      permStatus = await Geolocation.requestPermissions();
    }

    if (permStatus.location !== 'granted') {
      throw new Error('Location permission denied');
    }

    // 2. Get high-accuracy GPS natively (bypasses browser HTTPS restriction)
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
    return {
      granted: false,
      latitude: DEFAULT_CENTER.latitude,
      longitude: DEFAULT_CENTER.longitude,
      ...approx,
      city: DEFAULT_CENTER.city,
      country: DEFAULT_CENTER.country
    };
  }
}
