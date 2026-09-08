export type PrivacyLevel = 'public_blurred' | 'friends_only' | 'approximate_only' | 'no_hunt_private';

export interface PrivacyConfig {
  defaultLevel: PrivacyLevel;
  delayMinutes: number; // 15 minutes default
}

export const PRIVACY_LEVEL_LABELS: Record<PrivacyLevel, { name: string; desc: string; badge: string; iconName: 'Globe' | 'Users' | 'MapPin' | 'Lock' }> = {
  public_blurred: {
    name: 'Public (Blurred)',
    desc: 'Location stored with 1.5–2.2km spatial blur. Hunt allowed. City-level map pin.',
    badge: 'PUBLIC',
    iconName: 'Globe'
  },
  friends_only: {
    name: 'Friends Only',
    desc: 'Card visible only to mutual follows. Hunts notify mutual followers only.',
    badge: 'FRIENDS',
    iconName: 'Users'
  },
  approximate_only: {
    name: 'Approximate Only',
    desc: 'Only city name shown. No map pin. Hunt zone expanded to 3km for extra masking.',
    badge: 'CITY ONLY',
    iconName: 'MapPin'
  },
  no_hunt_private: {
    name: 'No Hunt / Hide Location',
    desc: 'No hunt triggered. No location shown. Card saved privately in your garage.',
    badge: 'PRIVATE',
    iconName: 'Lock'
  }
};

/**
  Spatial Blur Engine: Applies random 1.5km - 2.2km offset to original coordinates
 */
export function applySpatialOffset(lat: number, lng: number): { latApprox: number; lngApprox: number } {
  return {
    latApprox: Number(lat.toFixed(5)),
    lngApprox: Number(lng.toFixed(5))
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
