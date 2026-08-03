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
  // ~111,000 meters per degree of latitude
  const radiusKm = 1.5 + Math.random() * 0.5; // 1.5km to 2.0km
  const angle = Math.random() * Math.PI * 2;

  const latOffset = (radiusKm * Math.cos(angle)) / 111;
  const lngOffset = (radiusKm * Math.sin(angle)) / (111 * Math.cos((lat * Math.PI) / 180));

  return {
    latApprox: Number((lat + latOffset).toFixed(4)),
    lngApprox: Number((lng + lngOffset).toFixed(4))
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

/**
 * Request real device GPS location permission
 */
export function requestRealLocationPermission(): Promise<LocationPermissionResult> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      const approx = offsetCoordinatesApprox(DEFAULT_CENTER.latitude, DEFAULT_CENTER.longitude);
      resolve({
        granted: false,
        latitude: DEFAULT_CENTER.latitude,
        longitude: DEFAULT_CENTER.longitude,
        ...approx,
        city: DEFAULT_CENTER.city,
        country: DEFAULT_CENTER.country
      });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const approx = offsetCoordinatesApprox(lat, lng);
        const geoInfo = await reverseGeocodeCity(lat, lng);

        resolve({
          granted: true,
          latitude: lat,
          longitude: lng,
          ...approx,
          city: geoInfo.city,
          country: geoInfo.country
        });
      },
      (err) => {
        console.warn('Location permission denied or unavailable:', err.message);
        const approx = offsetCoordinatesApprox(DEFAULT_CENTER.latitude, DEFAULT_CENTER.longitude);
        resolve({
          granted: false,
          latitude: DEFAULT_CENTER.latitude,
          longitude: DEFAULT_CENTER.longitude,
          ...approx,
          city: DEFAULT_CENTER.city,
          country: DEFAULT_CENTER.country
        });
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 }
    );
  });
}
