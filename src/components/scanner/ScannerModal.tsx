import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Camera as CapCamera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Capacitor } from '@capacitor/core';
import { AlertTriangle, SwitchCamera, X, RotateCcw, RefreshCw } from 'lucide-react';
import { useApexStore } from '../../store/useApexStore';
import type { CarCard } from '../../types/apex';
import { sounds } from '../../utils/audio';
import { applySpatialOffset } from '../../utils/privacyPipeline';
import { calculateRegionalRarity } from '../../utils/regionalRarityEngine';
import { identifyVehicleWithAi } from '../../services/aiVisionService';
import { hunterSceneEngine } from '../../services/hunterSceneEngine';
import { offlineRecognitionEngine } from '../../services/offlineRecognitionEngine';
import { useScannerStateMachine } from '../../hooks/useScannerStateMachine';
import { HunterOverlay } from './HunterOverlay';
import { ProgressiveAnalysisOverlay } from './ProgressiveAnalysisOverlay';
import { DiscoveryReveal } from './DiscoveryReveal';

export const ScannerModal: React.FC = () => {
  const { scannerOpen, setScannerOpen, user } = useApexStore();
  const [shutterFlash, setShutterFlash] = useState(false);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [zoomLevel, setZoomLevel] = useState<number>(1);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const sceneLoopRef = useRef<number | null>(null);
  const activeScanIdRef = useRef<string | null>(null);

  // State Machine Hook
  const {
    phase,
    hasVehicle,
    createdCard,
    capturedPhotoUrl,
    errorMessage,
    pipelineStages,
    currentStageIndex,
    onVehicleDetectedChange,
    startSearching,
    selectTarget,
    startCapturing,
    setCapturedPhoto,
    submitForAnalysis,
    onAnalysisStageResolved,
    onIdentificationSuccess,
    onIdentificationFailed,
    retryAnalysis,
    retakePhoto,
    continueHunting,
    resetScanner
  } = useScannerStateMachine();

  // Stop active hardware stream
  const stopCameraStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (sceneLoopRef.current) {
      cancelAnimationFrame(sceneLoopRef.current);
      sceneLoopRef.current = null;
    }
  }, []);

  // 1. Initialize Hardware Camera Stream
  const initHardwareCamera = useCallback(async (mode: 'environment' | 'user' = facingMode) => {
    try {
      stopCameraStream();

      try {
        const permStatus = await CapCamera.requestPermissions();
        if (permStatus.camera !== 'granted' && permStatus.camera !== 'prompt-with-rationale') {
          console.warn('Native camera permission status:', permStatus.camera);
        }
      } catch (e) {
        console.log('Capacitor camera request or web platform:', e);
      }

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        startSearching();
        return;
      }

      let stream: MediaStream | null = null;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: mode },
            width: { ideal: 1920 },
            height: { ideal: 1080 }
          },
          audio: false
        });
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false
        });
      }

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(e => console.warn('Video play error:', e));
      }
      startSearching();
    } catch (err) {
      console.warn('Camera stream fallback active:', err);
      startSearching();
    }
  }, [facingMode, startSearching, stopCameraStream]);

  // Apply Hardware Zoom if supported
  const applyZoom = useCallback(async (newZoom: number) => {
    setZoomLevel(newZoom);
    if (streamRef.current) {
      const track = streamRef.current.getVideoTracks()[0];
      if (track) {
        try {
          const capabilities: any = track.getCapabilities ? track.getCapabilities() : {};
          if (capabilities.zoom) {
            const minZ = capabilities.zoom.min || 1;
            const maxZ = capabilities.zoom.max || 5;
            const targetZ = Math.min(maxZ, Math.max(minZ, newZoom));
            await track.applyConstraints({
              advanced: [{ zoom: targetZ } as any]
            });
          }
        } catch (e) {
          // Hardware zoom not supported, CSS scale fallback handles visual zoom
        }
      }
    }
  }, []);

  // Toggle Camera Front / Back
  const handleToggleCamera = useCallback(() => {
    sounds.playTargetLock();
    const nextMode = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(nextMode);
    initHardwareCamera(nextMode);
  }, [facingMode, initHardwareCamera]);

  useEffect(() => {
    if (scannerOpen) {
      initHardwareCamera(facingMode);
    } else {
      stopCameraStream();
    }
    return () => {
      stopCameraStream();
    };
  }, [scannerOpen, initHardwareCamera, stopCameraStream, facingMode]);

  // 2. Optical Real-Time Vision Loop disabled for locked 60fps performance and clean viewfinder
  useEffect(() => {
    if (!scannerOpen) return;
    onVehicleDetectedChange(true, true);
  }, [scannerOpen, onVehicleDetectedChange]);

  const extractOpticalFeaturesFromDataUrl = (dataUrl: string): Promise<any> => {
    return new Promise((resolve) => {
      try {
        const img = new Image();
        img.onload = () => {
          try {
            const offscreenCanvas = document.createElement('canvas');
            offscreenCanvas.width = 64;
            offscreenCanvas.height = 36;
            const ctx = offscreenCanvas.getContext('2d');
            if (ctx) {
              ctx.drawImage(img, 0, 0, 64, 36);
              const features = offlineRecognitionEngine.extractFeatures(offscreenCanvas, ctx, 64, 36);
              const result = offlineRecognitionEngine.matchVehicle(features);
              resolve(result);
              return;
            }
          } catch (e) {
            console.warn('[Apex Scanner] Optical extraction canvas error:', e);
          }
          resolve(null);
        };
        img.onerror = () => resolve(null);
        img.src = dataUrl;
      } catch {
        resolve(null);
      }
    });
  };

  // 3. Fast Optical Feature Extraction & Progressive Verification Pipeline
  const executeInferencePipeline = async (photoDataUrl: string, fileName?: string, captureMs: number = 0) => {
    // 0. Ensure fresh isolated state and unique scan ID per scan
    const currentScanId = `scan_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    activeScanIdRef.current = currentScanId;
    offlineRecognitionEngine.reset();
    submitForAnalysis(photoDataUrl);
    const tAiStart = performance.now();

    onAnalysisStageResolved(0, 'Visual Geometry Captured');
    onAnalysisStageResolved(1, 'Analyzing Vehicle Characteristics');

    try {
      // 1. Perform AI vehicle vision analysis first
      const aiPromise = identifyVehicleWithAi(photoDataUrl, false, fileName);
      const timeoutPromise = new Promise<null>((_, reject) => 
        setTimeout(() => reject(new Error('Analysis timed out. Please check network connection and retry.')), 25000)
      );

      let aiResult: any = null;
      try {
        aiResult = await Promise.race([aiPromise, timeoutPromise]);
      } catch (err) {
        console.warn('[Apex Scanner] AI identification network/timeout error:', err);
      }

      const tAiEnd = performance.now();
      const uploadAndAiMs = Math.round(tAiEnd - tAiStart);
      const totalMs = captureMs + uploadAndAiMs;

      // Guard against race condition: check if a newer scan was initiated while waiting
      if (activeScanIdRef.current !== currentScanId) {
        console.log(`[Apex Scanner] Discarding stale scan response (${currentScanId}). Active scan is: ${activeScanIdRef.current}`);
        return;
      }

      console.log(`[Apex Scan Timing Instrumentation]`, {
        scan_id: currentScanId,
        capture_ms: captureMs,
        upload_and_ai_ms: uploadAndAiMs,
        total_ms: totalMs
      });

      // ── STRICT HIERARCHICAL PRECEDENCE GATES ──
      // Gate A: REMOTE REJECTED / NOT A CAR -> Respect rejection immediately (Never force local guess!)
      if (aiResult && (aiResult.status === 'rejected' || aiResult.is_car === false)) {
        onIdentificationFailed(
          aiResult.rejection_reason ||
          aiResult.reason ||
          'No automobile detected in frame. Please photograph a real motor vehicle.'
        );
        return;
      }

      // Gate B: REMOTE FAILURE (Network down / offline) -> Optional local optical fallback
      if (!aiResult) {
        let localResult: any = null;
        if (canvasRef.current && canvasRef.current.width > 0) {
          const ctx = canvasRef.current.getContext('2d');
          if (ctx) {
            const features = offlineRecognitionEngine.extractFeatures(canvasRef.current, ctx, 64, 36);
            localResult = offlineRecognitionEngine.matchVehicle(features, true);
          }
        }
        if (!localResult) {
          localResult = await extractOpticalFeaturesFromDataUrl(photoDataUrl);
        }

        if (localResult && localResult.vehicle && localResult.confidence >= 0.65) {
          console.log('[Apex Scanner] Offline optical fallback match:', localResult.vehicle.model);
          aiResult = {
            is_car: true,
            status: 'probable',
            make: localResult.vehicle.manufacturer,
            model: localResult.vehicle.model,
            generation: localResult.vehicle.generation,
            trim: localResult.vehicle.trim || null,
            horsepower: localResult.vehicle.horsepower,
            top_speed_kmh: localResult.vehicle.topSpeedKmH,
            engine: localResult.vehicle.engine,
            zero_to_hundred_seconds: localResult.vehicle.zeroToHundredSec,
            production_years: localResult.vehicle.productionYears,
            origin_country: localResult.vehicle.originCountry,
            body_style: localResult.vehicle.bodyStyle,
            color: localResult.matchedColor || 'Silver',
            rarity: localResult.vehicle.baselineRarity
          };
        } else {
          onIdentificationFailed(
            'Connection unavailable and vehicle could not be recognized offline. Please connect to internet or try another angle.'
          );
          return;
        }
      }

      // 3. Bind to resolved vehicle specifications
      const make = aiResult?.make || 'Unknown Make';
      const model = aiResult?.model || 'Unknown Model';

      // Guard: Reject non-vehicles or obscure scans resulting in unknown make & model
      const isMakeUnknown = !make || make.trim() === '' || make.toLowerCase().includes('unknown');
      const isModelUnknown = !model || model.trim() === '' || model.toLowerCase().includes('unknown');
      if (isMakeUnknown && isModelUnknown) {
        onIdentificationFailed(
          'Vehicle could not be clearly identified. Please retake the photo with better lighting or vehicle angle.'
        );
        return;
      }

      const generation = aiResult?.generation || 'Current';
      const trim = aiResult?.trim || undefined;
      const horsepower = aiResult?.horsepower || 300;
      const topSpeed = aiResult?.top_speed_kmh || 250;
      const engine = aiResult?.engine || 'High-Output Engine';
      const zeroToHundred = aiResult?.zero_to_hundred_seconds || 4.2;
      const productionYears = aiResult?.production_years || '2023';
      const originCountry = aiResult?.origin_country || 'Global';
      const bodyStyle = aiResult?.body_style || 'Coupe';
      const color = aiResult?.color || 'Silver';

      onAnalysisStageResolved(0, 'Framing & Viewpoint Confirmed');

      const featuresSummary = aiResult?.visual_evidence?.grille 
        ? `${aiResult.visual_evidence.grille.slice(0, 32)}…`
        : `${horsepower} HP • ${bodyStyle} Silhouette`;
      onAnalysisStageResolved(1, featuresSummary);

      onAnalysisStageResolved(2, `${make} ${model} Confirmed`);

      const candidateSummary = aiResult?.status === 'uncertain'
        ? 'Variant Uncertain — Preserving Base Model'
        : trim
        ? `${trim} Verified`
        : 'Model Family Architecture Confirmed';
      onAnalysisStageResolved(3, candidateSummary);

      const userLat = user.latitude || 35.6762;
      const userLng = user.longitude || 139.6503;
      const offset = applySpatialOffset(userLat, userLng);
      const rarityEngineResult = calculateRegionalRarity({
        make,
        model,
        city: user.city || 'Tokyo',
        country: user.country || 'Japan'
      });

      const newCard: CarCard = {
        id: `card-${Date.now()}`,
        cardNumber: `#APX-${Math.floor(1000 + Math.random() * 9000)}`,
        make,
        model,
        generation,
        trim,
        yearEstimate: String(aiResult?.year_estimate || 2023),
        releasedYear: String(aiResult?.year_estimate || 2023),
        productionYears,
        discontinuedStatus: productionYears.includes('Present') ? 'ACTIVE PRODUCTION' : 'DISCONTINUED',
        color,
        bodyStyle: (bodyStyle as any) || 'Coupe',
        rarity: rarityEngineResult.rarity || aiResult?.rarity || 'legendary',
        rarityScore: rarityEngineResult.rarityScore || 88,
        topSpeedKmH: topSpeed,
        horsepower,
        engine,
        zeroToHundredSec: zeroToHundred,
        torqueNm: aiResult?.torque_nm || 465,
        kerbWeightKg: aiResult?.kerb_weight_kg || 1450,
        originCountry,
        interestingFact: aiResult?.interesting_facts || 'Engineered for precision performance.',
        briefHistory: aiResult?.brief_history || 'Iconic sports car heritage.',
        modsDetected: aiResult?.mods_detected || [],
        imageUrl: photoDataUrl,
        latApprox: offset.latApprox,
        lngApprox: offset.lngApprox,
        city: user.city || 'Tokyo',
        country: user.country || 'Japan',
        xpEarned: calculateRegionalRarity({ make, model, city: user.city || 'Tokyo', country: user.country || 'Japan' }).rarityScore * 10,
        marketValueLowUsd: aiResult?.market_value_low_usd || 120000,
        marketValueHighUsd: aiResult?.market_value_high_usd || 180000,
        scanValidated: true,
        isPublic: true,
        huntTriggered: false,
        privacyLevel: 'public_blurred',
        aiConfidence: aiResult?.confidence || 0.95,
        identificationStatus: aiResult?.status || 'identified',
        specificityLevel: aiResult?.specificity_level || (trim ? 'variant' : 'model_family'),
        identificationReason: aiResult?.reason || (aiResult?.status === 'uncertain' ? 'Variant uncertain. Try another angle.' : undefined),
        createdAt: new Date().toISOString(),
        isFirstGlobalScan: aiResult?.is_first_global || false,
        isFirstCityScan: aiResult?.is_first_city || false
      };

      onAnalysisStageResolved(4, `Certainty: ${(newCard.identificationStatus || 'identified').toUpperCase()}`);
      onIdentificationSuccess(newCard, false);

    } catch (err: any) {
      console.warn('Inference pipeline error:', err);
      onIdentificationFailed(err?.message || 'Vehicle identification failed. Please retry.');
    }
  };

  // 4. Handle Shutter Button Capture (Capture First -> Render Frozen Image -> Analyze Second)
  const handleShutterCapture = async () => {
    const tCaptureStart = performance.now();
    sounds.playShutter();
    setShutterFlash(true);
    setTimeout(() => setShutterFlash(false), 70);
    startCapturing();

    let photoDataUrl: string | null = null;

    // 1. Native Capacitor Camera attempt
    if (Capacitor.isNativePlatform()) {
      try {
        const image = await CapCamera.getPhoto({
          quality: 88,
          allowEditing: false,
          resultType: CameraResultType.DataUrl,
          source: CameraSource.Camera
        });
        if (image && image.dataUrl) {
          photoDataUrl = image.dataUrl;
        }
      } catch (err: any) {
        if (err.message && err.message.toLowerCase().includes('cancel')) {
          startSearching();
          return;
        }
      }
    }

    // 2. Web / Canvas Capture with Zoom Crop
    if (!photoDataUrl) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (video && canvas && video.videoWidth > 0) {
        const maxDim = 800;
        let fullW = video.videoWidth;
        let fullH = video.videoHeight;

        // Calculate zoomed crop box
        const cropW = fullW / zoomLevel;
        const cropH = fullH / zoomLevel;
        const startX = (fullW - cropW) / 2;
        const startY = (fullH - cropH) / 2;

        let targetW = maxDim;
        let targetH = Math.round((cropH * maxDim) / cropW);

        canvas.width = targetW;
        canvas.height = targetH;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(video, startX, startY, cropW, cropH, 0, 0, targetW, targetH);
          photoDataUrl = canvas.toDataURL('image/jpeg', 0.85);
        }
      }
    }

    const tCaptureEnd = performance.now();
    const captureMs = Math.round(tCaptureEnd - tCaptureStart);

    if (photoDataUrl) {
      // Step 2 & 3: Immediately freeze hardware stream and display confirmed image
      stopCameraStream();
      setCapturedPhoto(photoDataUrl);
      // Step 4: Now that photo is visibly confirmed, begin AI analysis
      executeInferencePipeline(photoDataUrl, undefined, captureMs);
      return;
    }

    // 3. Fallback Camera File Capture
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };


  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      executeInferencePipeline(reader.result as string, file.name);
    };
    reader.readAsDataURL(file);
  };

  const handleCloseScanner = () => {
    activeScanIdRef.current = null;
    stopCameraStream();
    resetScanner();
    setScannerOpen(false);
  };

  if (!scannerOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col justify-between overflow-hidden select-none font-sans">
      <canvas ref={canvasRef} className="hidden" />
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileUpload}
        className="hidden"
      />

      {shutterFlash && <div className="absolute inset-0 z-50 bg-white" />}

      {/* 1. LIVE HARDWARE CAMERA STREAM */}
      <div className="relative flex-1 flex flex-col justify-between w-full h-full bg-black overflow-hidden">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          controls={false}
          disablePictureInPicture
          disableRemotePlayback
          poster="data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg'/>"
          className="absolute inset-0 w-full h-full object-cover pointer-events-none transition-transform duration-200"
          style={{ 
            background: '#000000',
            transform: `scale(${zoomLevel})`,
            transformOrigin: 'center center'
          }}
        />

        {/* Ambient Viewfinder Vignette */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_transparent_40%,_black_95%)] pointer-events-none z-0" />

        {/* TOP CAMERA CONTROLS: FLIP CAMERA */}
        <div className="absolute top-4 right-4 z-40">
          <button
            onClick={handleToggleCamera}
            className="w-10 h-10 rounded-full bg-black/60 backdrop-blur-md border border-white/15 flex items-center justify-center text-white/80 hover:text-white transition-colors"
            title="Switch Camera (Front/Back)"
          >
            <SwitchCamera className="w-5 h-5" />
          </button>
        </div>

        {/* ZOOM LEVEL CONTROLS (1x, 2x, 3x, 5x) — Positioned clearly above shutter button */}
        {(phase === 'SEARCHING' || phase === 'CAR_DETECTED' || phase === 'POTENTIAL_DISCOVERY' || phase === 'TRACKING') && (
          <div className="absolute bottom-[calc(var(--sab,16px)+115px)] left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 bg-black/70 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-white/15 shadow-2xl">
            {[1, 2, 3, 5].map((z) => (
              <button
                key={z}
                onClick={() => applyZoom(z)}
                className={`w-7 h-7 rounded-full text-xs font-semibold transition-all ${
                  zoomLevel === z 
                    ? 'bg-[#E50914] text-white shadow-md' 
                    : 'text-white/60 hover:text-white bg-white/5'
                }`}
              >
                {z}x
              </button>
            ))}
          </div>
        )}

        {/* 2. HUNTER OVERLAY (Strictly during active camera / targeting / shutter press) */}
        {(phase === 'SEARCHING' || phase === 'CAR_DETECTED' || phase === 'POTENTIAL_DISCOVERY' || phase === 'TRACKING' || phase === 'LOCKING' || phase === 'LOCKED' || phase === 'CAPTURING') && (
          <HunterOverlay
            phase={phase}
            hasVehicle={hasVehicle}
            candidates={[]}
            primaryTarget={null}
            guidance={{ type: 'none', instruction: '', severity: 'info' }}
            onSelectTarget={(targetId) => {
              hunterSceneEngine.selectTarget(targetId);
              selectTarget(targetId);
            }}
            onShutterPress={handleShutterCapture}
            onClose={handleCloseScanner}
          />
        )}

        {/* 3. PROGRESSIVE ANALYSIS OVERLAY (Over frozen captured photograph) */}
        {(phase === 'CAPTURED' || phase === 'ANALYZING' || phase === 'IDENTIFYING' || phase === 'VERIFYING') && (
          <ProgressiveAnalysisOverlay
            photoUrl={capturedPhotoUrl}
            stages={pipelineStages}
            currentStageIndex={currentStageIndex}
            previewCard={createdCard || null}
          />
        )}

        {/* 4. DISCOVERY REVEAL & COLLECTIBLE CARD */}
        {(phase === 'REVEALING' || phase === 'DISCOVERED' || phase === 'ALREADY_COLLECTED') && createdCard && (
          <DiscoveryReveal
            card={createdCard}
            isDuplicate={phase === 'ALREADY_COLLECTED'}
            onContinueHunt={() => {
              continueHunting();
              initHardwareCamera(facingMode);
            }}
            onClose={handleCloseScanner}
          />
        )}

        {/* 5. ERROR OVERLAY (Preserves captured image; offers retry without retaking) */}
        {phase === 'ERROR' && (
          <div className="absolute inset-0 z-50 flex flex-col justify-between p-6 select-none font-sans overflow-hidden">
            {/* Background Frozen Image */}
            {capturedPhotoUrl && (
              <img
                src={capturedPhotoUrl}
                alt="Captured attempt"
                className="absolute inset-0 w-full h-full object-cover"
              />
            )}
            <div className="absolute inset-0 bg-black/80 backdrop-blur-md" />

            {/* Header */}
            <div className="relative z-20 w-full flex justify-end pt-safe">
              <button
                onClick={handleCloseScanner}
                className="w-10 h-10 rounded-full bg-white/[0.08] flex items-center justify-center text-white hover:bg-white/[0.16] transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Center Error Details */}
            <div className="relative z-20 my-auto max-w-xs mx-auto text-center space-y-3">
              <div className="w-14 h-14 rounded-full bg-red-500/15 border border-red-500/30 flex items-center justify-center text-[#E50914] mx-auto shadow-lg">
                <AlertTriangle className="w-7 h-7" />
              </div>
              <h3 className="text-xl font-bold text-white tracking-tight">Identification Failed</h3>
              <p className="text-xs text-white/70 leading-relaxed">
                {errorMessage || 'Unable to identify a motor vehicle in this frame. Please check vehicle angle and lighting.'}
              </p>
            </div>

            {/* Bottom Actions: Retry Analysis (Without Retaking) & Retake Photo */}
            <div className="relative z-20 pb-safe max-w-xs mx-auto w-full space-y-2.5">
              {capturedPhotoUrl && (
                <button
                  onClick={() => {
                    sounds.playTargetLock();
                    retryAnalysis();
                    executeInferencePipeline(capturedPhotoUrl);
                  }}
                  className="w-full py-3.5 rounded-2xl bg-[#E50914] hover:bg-[#DC2626] active:scale-98 text-white font-semibold text-xs transition-all shadow-lg flex items-center justify-center gap-2 cursor-pointer min-h-[46px]"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>Retry Analysis (Same Photo)</span>
                </button>
              )}

              <button
                onClick={() => {
                  sounds.playTargetAcquired();
                  retakePhoto();
                  initHardwareCamera(facingMode);
                }}
                className="w-full py-3 rounded-2xl bg-white/[0.08] hover:bg-white/[0.14] border border-white/[0.1] active:scale-98 text-white/90 font-semibold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer min-h-[44px]"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Retake Photo</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
