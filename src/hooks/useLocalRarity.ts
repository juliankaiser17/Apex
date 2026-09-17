/**
 * APEX — Production-Grade Local Rarity Location Hook
 * 
 * Strict Privacy & Google Play Compliance:
 * - One-time foreground location sampling only upon explicit scan / user action.
 * - Zero background location watchers or continuous tracking services.
 * - Coordinates immediately encoded to coarse 5-char geohashes (~25 km² area).
 * - Location is strictly OPTIONAL: if denied, scanning proceeds with 100% global rarity.
 */

import { useState, useCallback, useEffect } from 'react';
import { Geolocation } from '@capacitor/geolocation';
import { Capacitor } from '@capacitor/core';
import { encodeCoarseGeohash, getCoarseAreaName } from '../utils/localRarityEngine';
import { useApexStore } from '../store/useApexStore';
import { localRarityTracer } from '../ai-engine/observability/localRarityTracer';
import { featureFlags } from '../utils/featureFlags';

export type LocationPermissionState = 
  | 'unknown' 
  | 'granted' 
  | 'denied' 
  | 'unavailable' 
  | 'restricted';

export interface CoarseLocationSample {
  geoBucket: string | null;
  coarseAreaName: string;
  isGranted: boolean;
}

export function useLocalRarity() {
  const user = useApexStore(s => s.user);
  const localRarityEnabled = useApexStore(s => s.localRarityEnabled !== false);
  const setLocalRarityEnabled = useApexStore(s => s.setLocalRarityEnabled);

  const [permissionState, setPermissionState] = useState<LocationPermissionState>('unknown');
  const [cachedBucket, setCachedBucket] = useState<string | null>(null);
  const [cachedAreaName, setCachedAreaName] = useState<string>('Your Area');
  const [isSampling, setIsSampling] = useState<boolean>(false);

  // Check initial permission status passively on mount
  useEffect(() => {
    let isMounted = true;

    async function checkPermission() {
      if (Capacitor.isNativePlatform()) {
        try {
          const status = await Geolocation.checkPermissions();
          if (isMounted) {
            if (status.location === 'granted' || status.coarseLocation === 'granted') {
              setPermissionState('granted');
            } else if (status.location === 'denied' || status.coarseLocation === 'denied') {
              setPermissionState('denied');
            } else {
              setPermissionState('unknown');
            }
          }
        } catch {
          if (isMounted) setPermissionState('unavailable');
        }
      } else if (typeof navigator !== 'undefined' && 'permissions' in navigator) {
        try {
          const status = await navigator.permissions.query({ name: 'geolocation' as PermissionName });
          if (isMounted) {
            if (status.state === 'granted') setPermissionState('granted');
            else if (status.state === 'denied') setPermissionState('denied');
            else setPermissionState('unknown');
          }
        } catch {
          if (isMounted) setPermissionState('unknown');
        }
      }
    }

    checkPermission();
    return () => { isMounted = false; };
  }, []);

  /**
   * One-time foreground sample of coarse location.
   * NEVER throws an error; returns null bucket on denial so scanner continues normally.
   */
  const sampleCoarseLocation = useCallback(async (): Promise<CoarseLocationSample> => {
    // 1. If feature is disabled by flag or user preference, immediately return fallback
    if (!featureFlags.isLocalRarityEnabled() || !localRarityEnabled) {
      return {
        geoBucket: null,
        coarseAreaName: getCoarseAreaName(user.city, user.country),
        isGranted: false
      };
    }

    // 2. Return cached bucket if sampled within past 10 minutes
    if (cachedBucket) {
      localRarityTracer.recordCache(true);
      return {
        geoBucket: cachedBucket,
        coarseAreaName: cachedAreaName,
        isGranted: true
      };
    }

    localRarityTracer.recordCache(false);
    setIsSampling(true);
    let lat = 0;
    let lng = 0;
    let granted = false;

    // 3. Native Capacitor Geolocation
    if (Capacitor.isNativePlatform()) {
      try {
        let permStatus = await Geolocation.checkPermissions();
        if (permStatus.location !== 'granted' && permStatus.coarseLocation !== 'granted') {
          permStatus = await Geolocation.requestPermissions({ permissions: ['coarseLocation', 'location'] });
        }

        if (permStatus.location === 'granted' || permStatus.coarseLocation === 'granted') {
          granted = true;
          setPermissionState('granted');

          // Bounded 5s one-time fix
          const pos = await Geolocation.getCurrentPosition({
            enableHighAccuracy: false, // Coarse network is faster and sufficient for ~25km² geohash
            timeout: 5000,
            maximumAge: 600000 // 10 minutes cache
          });
          lat = pos.coords.latitude;
          lng = pos.coords.longitude;
        } else {
          setPermissionState('denied');
        }
      } catch (err: any) {
        if (err?.message?.includes('denied')) {
          setPermissionState('denied');
        } else {
          setPermissionState('unavailable');
        }
      }
    }

    // 4. Web browser fallback (also used in Android WebView)
    if (!granted && typeof navigator !== 'undefined' && navigator.geolocation) {
      try {
        const getPos = (): Promise<GeolocationPosition> =>
          new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              enableHighAccuracy: false,
              timeout: 4000,
              maximumAge: 600000
            });
          });

        const pos = await getPos();
        lat = pos.coords.latitude;
        lng = pos.coords.longitude;
        granted = true;
        setPermissionState('granted');
      } catch (err: any) {
        if (err?.code === 1) { // PERMISSION_DENIED
          setPermissionState('denied');
        } else {
          setPermissionState('unavailable');
        }
      }
    }

    setIsSampling(false);

    // 5. If valid fix obtained, compute coarse privacy geohash-5
    if (granted && lat !== 0 && lng !== 0) {
      const bucket = encodeCoarseGeohash(lat, lng, 5);
      const area = getCoarseAreaName(user.city, user.country, bucket);
      setCachedBucket(bucket);
      setCachedAreaName(area);

      return {
        geoBucket: bucket,
        coarseAreaName: area,
        isGranted: true
      };
    }

    // 6. Graceful Fallback: Location denied or unavailable -> Global rarity continues normally
    const fallbackArea = getCoarseAreaName(user.city, user.country);
    return {
      geoBucket: null,
      coarseAreaName: fallbackArea,
      isGranted: false
    };
  }, [localRarityEnabled, cachedBucket, cachedAreaName, user.city, user.country]);

  const optOut = useCallback(() => {
    setLocalRarityEnabled(false);
    setCachedBucket(null);
  }, [setLocalRarityEnabled]);

  return {
    localRarityEnabled,
    setLocalRarityEnabled,
    permissionState,
    isSampling,
    sampleCoarseLocation,
    optOut,
    cachedBucket,
    cachedAreaName
  };
}
