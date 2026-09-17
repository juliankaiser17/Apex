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
 * Pseudo-random ratio generator seeded deterministically by string.
 * Ensures the exact same card ID produces the identical spatial offset at write time.
 * Eliminates vulnerability to multi-request GPS averaging de-anonymization attacks.
 */
function seedStringToRatio(seed: string, salt: number = 0): number {
  let hash = salt;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash % 100000) / 100000;
}

/**
 * Spatial Blur Engine: Applies genuine 1.5km – 2.2km geodesic spatial offset.
 * Uses spherical destination-point trigonometry.
 */
export function applySpatialOffset(
  lat: number,
  lng: number,
  seedId?: string
): { latApprox: number; lngApprox: number } {
  if (!lat || !lng || isNaN(lat) || isNaN(lng)) {
    return { latApprox: lat || 0, lngApprox: lng || 0 };
  }

  const effectiveSeed = seedId || `coord_${lat.toFixed(4)}_${lng.toFixed(4)}`;
  const angleRatio = seedStringToRatio(effectiveSeed, 1337);
  const distanceRatio = seedStringToRatio(effectiveSeed, 42);

  // Offset distance between 1500 meters (1.5km) and 2200 meters (2.2km)
  const distanceMeters = 1500 + distanceRatio * 700;
  const bearingRadians = angleRatio * 2 * Math.PI;

  const EARTH_RADIUS_METERS = 6371000;
  const latRad = (lat * Math.PI) / 180;
  const lngRad = (lng * Math.PI) / 180;
  const angularDistance = distanceMeters / EARTH_RADIUS_METERS;

  const newLatRad = Math.asin(
    Math.sin(latRad) * Math.cos(angularDistance) +
      Math.cos(latRad) * Math.sin(angularDistance) * Math.cos(bearingRadians)
  );

  const newLngRad =
    lngRad +
    Math.atan2(
      Math.sin(bearingRadians) * Math.sin(angularDistance) * Math.cos(latRad),
      Math.cos(angularDistance) - Math.sin(latRad) * Math.sin(newLatRad)
    );

  const latApprox = Number(((newLatRad * 180) / Math.PI).toFixed(5));
  const lngApprox = Number(((newLngRad * 180) / Math.PI).toFixed(5));

  return { latApprox, lngApprox };
}

/**
 * Canvas Bounding-Box Plate and Face Redaction.
 * Draws opaque privacy banners over detected license plates and faces.
 */
export async function redactBoundingBoxes(
  imageDataUrl: string,
  boxes: Array<{ type: 'plate' | 'face'; box2d: [number, number, number, number] }>
): Promise<string> {
  if (!boxes || boxes.length === 0 || typeof document === 'undefined') {
    return imageDataUrl;
  }

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(imageDataUrl);
          return;
        }

        ctx.drawImage(img, 0, 0);

        boxes.forEach(({ type, box2d }) => {
          if (!box2d || box2d.length < 4) return;
          const [ymin, xmin, ymax, xmax] = box2d;
          const x = Math.max(0, Math.min(img.width, xmin * img.width));
          const y = Math.max(0, Math.min(img.height, ymin * img.height));
          const w = Math.max(10, Math.min(img.width - x, (xmax - xmin) * img.width));
          const h = Math.max(10, Math.min(img.height - y, (ymax - ymin) * img.height));

          ctx.save();
          ctx.fillStyle = '#0f0f0f';
          ctx.beginPath();
          const r = Math.min(8, w / 4, h / 4);
          if (typeof (ctx as any).roundRect === 'function') {
            (ctx as any).roundRect(x, y, w, h, r);
          } else {
            ctx.rect(x, y, w, h);
          }
          ctx.fill();

          ctx.fillStyle = '#ffffff';
          ctx.font = `bold ${Math.max(9, Math.floor(h * 0.35))}px sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(type === 'face' ? '• REDACTED •' : '• APEX PRIVACY •', x + w / 2, y + h / 2);
          ctx.restore();
        });

        resolve(canvas.toDataURL('image/jpeg', 0.9));
      } catch (err) {
        console.warn('Bounding box redaction failed, returning original:', err);
        resolve(imageDataUrl);
      }
    };
    img.onerror = () => resolve(imageDataUrl);
    img.src = imageDataUrl;
  });
}

/**
 * Calculates delayed dispatch timestamp (15 minutes from scan time)
 */
export function getDelayedDispatchTimestamp(scanTimestamp: string, delayMinutes: number = 15): string {
  const date = new Date(scanTimestamp);
  date.setMinutes(date.getMinutes() + delayMinutes);
  return date.toISOString();
}
