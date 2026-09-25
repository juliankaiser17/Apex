import { useState, useRef, useEffect, useCallback } from 'react';
import { Camera as CapCamera } from '@capacitor/camera';
import { Capacitor } from '@capacitor/core';
import { hapticTap, hapticImpact } from '../utils/haptics';

export interface FocusPoint {
  x: number;
  y: number;
  normX: number;
  normY: number;
  timestamp: number;
}

export interface UseNativeCameraOptions {
  enabled?: boolean;
  defaultFacing?: 'environment' | 'user';
  onCameraReady?: () => void;
  onError?: (err: Error) => void;
}

export function useNativeCamera({
  enabled = true,
  defaultFacing = 'environment',
  onCameraReady,
  onError
}: UseNativeCameraOptions = {}) {
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>(defaultFacing);
  const [isStreaming, setIsStreaming] = useState(false);
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [maxZoom, setMaxZoom] = useState<number>(5);
  const [minZoom, setMinZoom] = useState<number>(1);
  const [hasTorch, setHasTorch] = useState<boolean>(false);
  const [torchOn, setTorchOn] = useState<boolean>(false);
  const [focusPoint, setFocusPoint] = useState<FocusPoint | null>(null);
  const [exposureValue, setExposureValue] = useState<number>(0); // -2.0 to +2.0 EV
  const [hasHardwareExposure, setHasHardwareExposure] = useState<boolean>(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const isAcquiringRef = useRef<boolean>(false);
  const pinchStartDistRef = useRef<number | null>(null);
  const pinchStartZoomRef = useRef<number>(1);
  const focusTimeoutRef = useRef<any>(null);

  // Stop active hardware stream completely and release sensor
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      try {
        streamRef.current.getTracks().forEach((t) => {
          try {
            t.stop();
          } catch {
            // Ignore track stop error
          }
        });
      } catch (err) {
        console.warn('[NativeCamera] Error stopping tracks:', err);
      }
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsStreaming(false);
    setTorchOn(false);
  }, []);

  // Find the true physical rear or front camera device ID from system device enumeration
  const findMatchingDeviceId = useCallback(async (targetFacing: 'environment' | 'user'): Promise<string | null> => {
    try {
      if (!navigator.mediaDevices?.enumerateDevices) return null;
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter((d) => d.kind === 'videoinput');
      if (videoDevices.length === 0) return null;

      if (targetFacing === 'environment') {
        // Find back/rear cameras. Prioritize primary/main over ultrawide/macro
        const backCams = videoDevices.filter((d) => {
          const lbl = (d.label || '').toLowerCase();
          return (
            lbl.includes('back') ||
            lbl.includes('rear') ||
            lbl.includes('environment') ||
            lbl.includes('facing back') ||
            lbl.includes('camera 0') ||
            (lbl.includes('0') && !lbl.includes('front'))
          );
        });

        // Filter out ultrawide, macro, depth, telephoto lenses to pick the primary main sensor
        const primaryBack = backCams.find((d) => {
          const lbl = d.label.toLowerCase();
          return !lbl.includes('wide') && !lbl.includes('ultra') && !lbl.includes('macro') && !lbl.includes('depth');
        });

        if (primaryBack) return primaryBack.deviceId;
        if (backCams.length > 0) return backCams[0].deviceId;
      } else {
        // Find front/selfie cameras
        const frontCams = videoDevices.filter((d) => {
          const lbl = (d.label || '').toLowerCase();
          return lbl.includes('front') || lbl.includes('user') || lbl.includes('selfie') || lbl.includes('camera 1');
        });
        if (frontCams.length > 0) return frontCams[0].deviceId;
      }

      return null;
    } catch (err) {
      console.warn('[NativeCamera] Device enumeration error:', err);
      return null;
    }
  }, []);

  // Inspect capabilities of active video track (zoom, torch, exposure)
  const probeTrackCapabilities = useCallback((track: MediaStreamTrack) => {
    try {
      const caps: any = track.getCapabilities ? track.getCapabilities() : {};
      
      // Torch capability
      if (typeof caps.torch === 'boolean' || caps.torch) {
        setHasTorch(true);
      } else {
        setHasTorch(false);
      }

      // Hardware zoom capability
      if (caps.zoom) {
        const minZ = caps.zoom.min || 1;
        const maxZ = Math.min(caps.zoom.max || 5, 8);
        setMinZoom(minZ);
        setMaxZoom(maxZ);
      } else {
        setMinZoom(1);
        setMaxZoom(5);
      }

      // Hardware exposure compensation capability
      if (caps.exposureCompensation) {
        setHasHardwareExposure(true);
      } else {
        setHasHardwareExposure(false);
      }
    } catch (err) {
      console.warn('[NativeCamera] Error probing track capabilities:', err);
    }
  }, []);

  // Initialize camera with exact facing and fallbacks
  const startCamera = useCallback(
    async (targetFacing: 'environment' | 'user' = facingMode) => {
      if (isAcquiringRef.current) return;
      isAcquiringRef.current = true;

      try {
        stopCamera();

        // 1. Request native camera permissions via Capacitor
        if (Capacitor.isNativePlatform()) {
          try {
            const perm = await CapCamera.requestPermissions();
            if (perm.camera !== 'granted' && perm.camera !== 'prompt-with-rationale') {
              console.warn('[NativeCamera] Camera permission not granted:', perm.camera);
            }
          } catch (e) {
            console.warn('[NativeCamera] Native permission check error:', e);
          }
        }

        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error('Camera API (getUserMedia) not supported in this environment.');
        }

        // 2. Discover best device ID for the target facing
        let preferredDeviceId = await findMatchingDeviceId(targetFacing);
        let stream: MediaStream | null = null;

        // Strategy A: Exact Device ID if known
        if (preferredDeviceId) {
          try {
            stream = await navigator.mediaDevices.getUserMedia({
              video: {
                deviceId: { exact: preferredDeviceId },
                width: { ideal: 1920 },
                height: { ideal: 1080 }
              },
              audio: false
            });
          } catch (err) {
            console.warn('[NativeCamera] Strategy A (exact deviceId) failed, trying facingMode:', err);
            stream = null;
          }
        }

        // Strategy B: Exact facingMode
        if (!stream) {
          try {
            stream = await navigator.mediaDevices.getUserMedia({
              video: {
                facingMode: { exact: targetFacing },
                width: { ideal: 1920 },
                height: { ideal: 1080 }
              },
              audio: false
            });
          } catch (err) {
            console.warn('[NativeCamera] Strategy B (exact facingMode) failed, trying ideal:', err);
            stream = null;
          }
        }

        // Strategy C: Ideal facingMode
        if (!stream) {
          try {
            stream = await navigator.mediaDevices.getUserMedia({
              video: {
                facingMode: { ideal: targetFacing },
                width: { ideal: 1920 },
                height: { ideal: 1080 }
              },
              audio: false
            });
          } catch (err) {
            console.warn('[NativeCamera] Strategy C (ideal facingMode) failed, trying plain video:', err);
            stream = null;
          }
        }

        // Strategy D: Plain video constraint fallback
        if (!stream) {
          stream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false
          });
        }

        if (!stream) {
          throw new Error('Unable to obtain camera stream.');
        }

        // 3. Post-acquisition verification: Confirm facingMode wasn't flipped by WebView
        const activeTrack = stream.getVideoTracks()[0];
        if (activeTrack) {
          const settings = activeTrack.getSettings ? activeTrack.getSettings() : ({} as any);
          const actualFacing = settings.facingMode;

          // If we requested rear (environment) but got front (user), re-enumerate and force rear device
          if (targetFacing === 'environment' && actualFacing === 'user') {
            console.warn('[NativeCamera] Stream returned user camera instead of environment. Re-probing devices...');
            const backId = await findMatchingDeviceId('environment');
            if (backId && backId !== settings.deviceId) {
              activeTrack.stop();
              stream = await navigator.mediaDevices.getUserMedia({
                video: { deviceId: { exact: backId }, width: { ideal: 1920 }, height: { ideal: 1080 } },
                audio: false
              });
            }
          }

          const confirmedTrack = stream.getVideoTracks()[0];
          if (confirmedTrack) {
            probeTrackCapabilities(confirmedTrack);
          }
        }

        streamRef.current = stream;

        // 4. Attach stream to HTMLVideoElement
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          try {
            await videoRef.current.play();
          } catch (playErr) {
            console.warn('[NativeCamera] Video play error (will retry on interaction):', playErr);
          }
        }

        setFacingMode(targetFacing);
        setIsStreaming(true);
        setZoomLevel(1);
        setExposureValue(0);
        onCameraReady?.();
      } catch (err: any) {
        console.error('[NativeCamera] Camera initialization failed:', err);
        onError?.(err);
      } finally {
        isAcquiringRef.current = false;
      }
    },
    [facingMode, findMatchingDeviceId, onCameraReady, onError, probeTrackCapabilities, stopCamera]
  );

  // Apply Hardware / Software Zoom
  const setZoom = useCallback(
    async (targetZoom: number) => {
      const clamped = Math.max(minZoom, Math.min(maxZoom, targetZoom));
      setZoomLevel(clamped);

      const track = streamRef.current?.getVideoTracks()[0];
      if (track) {
        try {
          const caps: any = track.getCapabilities ? track.getCapabilities() : {};
          if (caps.zoom) {
            await track.applyConstraints({
              advanced: [{ zoom: clamped } as any]
            });
          }
        } catch {
          // Hardware zoom unsupported; visual canvas crop handles zoom cleanly
        }
      }
    },
    [maxZoom, minZoom]
  );

  // Toggle Torch / Flashlight
  const toggleTorch = useCallback(async () => {
    if (!hasTorch || facingMode !== 'environment') return;
    const nextState = !torchOn;
    const track = streamRef.current?.getVideoTracks()[0];
    if (track) {
      try {
        await track.applyConstraints({
          advanced: [{ torch: nextState } as any]
        });
        setTorchOn(nextState);
        hapticTap();
      } catch (err) {
        console.warn('[NativeCamera] Torch toggle failed:', err);
      }
    }
  }, [facingMode, hasTorch, torchOn]);

  // Switch between front and rear cameras cleanly without race conditions
  const switchCamera = useCallback(async () => {
    hapticImpact('medium');
    const nextFacing = facingMode === 'environment' ? 'user' : 'environment';
    stopCamera();
    // Allow Android Camera HAL 60ms to fully release the physical sensor
    await new Promise((r) => setTimeout(r, 60));
    await startCamera(nextFacing);
  }, [facingMode, startCamera, stopCamera]);

  // Tap-to-focus handler mapping screen coordinates to camera sensor
  const handleTapToFocus = useCallback(
    async (clientX: number, clientY: number) => {
      if (!containerRef.current || !videoRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const tapX = clientX - rect.left;
      const tapY = clientY - rect.top;

      // Normalization relative to container
      const normX = Math.max(0, Math.min(1, tapX / rect.width));
      const normY = Math.max(0, Math.min(1, tapY / rect.height));

      setFocusPoint({
        x: tapX,
        y: tapY,
        normX,
        normY,
        timestamp: Date.now()
      });

      hapticTap();

      // Clear previous auto-dismiss timer
      if (focusTimeoutRef.current) clearTimeout(focusTimeoutRef.current);
      focusTimeoutRef.current = setTimeout(() => {
        setFocusPoint(null);
      }, 2500);

      // Apply hardware autofocus point if supported
      const track = streamRef.current?.getVideoTracks()[0];
      if (track) {
        try {
          const caps: any = track.getCapabilities ? track.getCapabilities() : {};
          if (caps.focusMode && (caps.focusMode.includes('single-shot') || caps.focusMode.includes('manual'))) {
            await track.applyConstraints({
              advanced: [
                {
                  focusMode: 'single-shot',
                  pointsOfInterest: [{ x: normX, y: normY }]
                } as any
              ]
            });
            // Revert back to continuous autofocus after 1.5s
            setTimeout(() => {
              track
                .applyConstraints({
                  advanced: [{ focusMode: 'continuous' } as any]
                })
                .catch(() => {});
            }, 1500);
          }
        } catch {
          // Focus mode not supported on this OEM camera driver
        }
      }
    },
    []
  );

  // Exposure adjustment (-2 to +2 EV)
  const setExposure = useCallback(
    async (ev: number) => {
      const clamped = Math.max(-2, Math.min(2, Number(ev.toFixed(2))));
      setExposureValue(clamped);

      const track = streamRef.current?.getVideoTracks()[0];
      if (track && hasHardwareExposure) {
        try {
          await track.applyConstraints({
            advanced: [{ exposureCompensation: clamped } as any]
          });
        } catch {
          // Hardware exposure failed; visual CSS brightness fallback takes effect
        }
      }
    },
    [hasHardwareExposure]
  );

  // Touch handlers for multi-touch pinch to zoom
  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (e.touches.length === 2) {
        const t1 = e.touches[0];
        const t2 = e.touches[1];
        const dist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
        pinchStartDistRef.current = dist;
        pinchStartZoomRef.current = zoomLevel;
      }
    },
    [zoomLevel]
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (e.touches.length === 2 && pinchStartDistRef.current !== null) {
        const t1 = e.touches[0];
        const t2 = e.touches[1];
        const dist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
        const scale = dist / pinchStartDistRef.current;
        const newZoom = pinchStartZoomRef.current * scale;
        setZoom(newZoom);
      }
    },
    [setZoom]
  );

  const handleTouchEnd = useCallback(() => {
    pinchStartDistRef.current = null;
  }, []);

  // Frame Capture: captures the exact visible viewfinder region, respecting unmirrored rear orientation & zoom
  const captureFrame = useCallback(async (): Promise<string | null> => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const container = containerRef.current;

    if (!video || !canvas || video.videoWidth === 0 || video.videoHeight === 0) {
      return null;
    }

    const videoW = video.videoWidth;
    const videoH = video.videoHeight;
    const containerW = container?.clientWidth || videoW;
    const containerH = container?.clientHeight || videoH;

    // Calculate crop rectangle matching object-fit: cover
    const scaleFactor = Math.max(containerW / videoW, containerH / videoH);
    const visibleVideoW = containerW / scaleFactor;
    const visibleVideoH = containerH / scaleFactor;

    // Compensate for digital zoom
    const cropW = visibleVideoW / zoomLevel;
    const cropH = visibleVideoH / zoomLevel;
    const startX = Math.max(0, (videoW - cropW) / 2);
    const startY = Math.max(0, (videoH - cropH) / 2);

    // Target dimensions: bounded to max 1280px for instant cloudflare vision latency
    const maxDim = 1280;
    let targetW = maxDim;
    let targetH = Math.round((cropH * maxDim) / cropW);
    if (targetH > maxDim) {
      targetW = Math.round((cropW * maxDim) / cropH);
      targetH = maxDim;
    }

    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    // Apply exposure compensation brightness filter if adjusted
    if (exposureValue !== 0) {
      const brightnessFactor = 1 + exposureValue * 0.25;
      ctx.filter = `brightness(${brightnessFactor})`;
    } else {
      ctx.filter = 'none';
    }

    // NEVER MIRROR REAR CAMERA.
    // If front camera, mirror horizontally so captured photo matches selfie viewfinder.
    const isFrontCamera = facingMode === 'user';
    if (isFrontCamera) {
      ctx.save();
      ctx.translate(targetW, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(video, startX, startY, cropW, cropH, 0, 0, targetW, targetH);
      ctx.restore();
    } else {
      ctx.drawImage(video, startX, startY, cropW, cropH, 0, 0, targetW, targetH);
    }

    return canvas.toDataURL('image/jpeg', 0.85);
  }, [exposureValue, facingMode, zoomLevel]);

  // Lifecycle: start camera when enabled, stop when disabled
  useEffect(() => {
    if (enabled) {
      startCamera(defaultFacing);
    } else {
      stopCamera();
    }

    return () => {
      stopCamera();
    };
  }, [enabled, defaultFacing]); // Deliberately do NOT include facingMode here to prevent double-fire on switch

  // App Lifecycle: Handle Background / Foreground visibility change
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // App went to background: release physical camera
        stopCamera();
      } else if (enabled) {
        // App returned to foreground: re-acquire camera
        startCamera(facingMode);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [enabled, facingMode, startCamera, stopCamera]);

  return {
    videoRef,
    canvasRef,
    containerRef,
    facingMode,
    isStreaming,
    isRearCamera: facingMode === 'environment',
    isMirrored: facingMode === 'user',
    zoomLevel,
    minZoom,
    maxZoom,
    setZoom,
    hasTorch,
    torchOn,
    toggleTorch,
    switchCamera,
    focusPoint,
    handleTapToFocus,
    exposureValue,
    setExposure,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    captureFrame,
    startCamera,
    stopCamera
  };
}
