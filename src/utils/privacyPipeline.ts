export type PrivacyLevel = 'public_blurred' | 'friends_only' | 'approximate_only' | 'no_hunt_private';

export interface PrivacyConfig {
  defaultLevel: PrivacyLevel;
  delayMinutes: number; // 15 minutes default
}

export const PRIVACY_LEVEL_LABELS: Record<PrivacyLevel, { name: string; desc: string; badge: string }> = {
  public_blurred: {
    name: 'Public (Blurred)',
    desc: 'Location stored with 1.5–2.2km spatial blur. Hunt allowed. City-level map pin.',
    badge: '🌐 PUBLIC'
  },
  friends_only: {
    name: 'Friends Only',
    desc: 'Card visible only to mutual follows. Hunts notify mutual followers only.',
    badge: '👥 FRIENDS'
  },
  approximate_only: {
    name: 'Approximate Only',
    desc: 'Only city name shown. No map pin. Hunt zone expanded to 3km for extra masking.',
    badge: '📍 CITY ONLY'
  },
  no_hunt_private: {
    name: 'No Hunt / Hide Location',
    desc: 'No hunt triggered. No location shown. Card saved privately in your garage.',
    badge: '🔒 PRIVATE'
  }
};

/**
  Spatial Blur Engine: Applies random 1.5km - 2.2km offset to original coordinates
 */
export function applySpatialOffset(lat: number, lng: number, radiusKmOverride?: number): { latApprox: number; lngApprox: number } {
  const minDistanceKm = radiusKmOverride || 1.5;
  const maxDistanceKm = radiusKmOverride ? radiusKmOverride + 0.7 : 2.2;
  const distanceKm = minDistanceKm + Math.random() * (maxDistanceKm - minDistanceKm);

  // Random bearing angle in radians
  const angleRad = Math.random() * 2 * Math.PI;

  // Approx conversion: 1 deg lat = 111km, 1 deg lng = 111km * cos(lat)
  const latOffsetDeg = (distanceKm * Math.cos(angleRad)) / 111;
  const lngOffsetDeg = (distanceKm * Math.sin(angleRad)) / (111 * Math.cos((lat * Math.PI) / 180));

  return {
    latApprox: Number((lat + latOffsetDeg).toFixed(5)),
    lngApprox: Number((lng + lngOffsetDeg).toFixed(5))
  };
}

/**
 * Calculates delayed dispatch timestamp (15 minutes from scan time)
 */
export function getDelayedDispatchTimestamp(scanTimestamp: string, delayMinutes: number = 15): string {
  const date = new Date(scanTimestamp);
  date.setMinutes(date.getMinutes() + delayMinutes);
  return date.toISOString();
}
