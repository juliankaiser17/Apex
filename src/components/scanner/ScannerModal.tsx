import React, { useState, useRef, useEffect } from 'react';
import { Camera as CapCamera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Capacitor } from '@capacitor/core';
import { AlertTriangle, X, RotateCcw, RefreshCw } from 'lucide-react';
import { useApexStore } from '../../store/useApexStore';
import type { CarCard, RarityTier, LocalRarityInfo } from '../../types/apex';
import { sounds } from '../../utils/audio';
import { applySpatialOffset } from '../../utils/privacyPipeline';
import { calculateLocalRarity, localRarityCache } from '../../utils/localRarityEngine';
import { useLocalRarity } from '../../hooks/useLocalRarity';
import { identifyVehicleWithAi, getAuthoritativeAccessToken } from '../../services/aiVisionService';
import { hunterSceneEngine } from '../../services/hunterSceneEngine';
import { offlineRecognitionEngine } from '../../services/offlineRecognitionEngine';
import { useScannerStateMachine } from '../../hooks/useScannerStateMachine';
import { useNativeCamera } from '../../hooks/useNativeCamera';
import { HunterOverlay } from './HunterOverlay';
import { FocusExposureReticle } from './FocusExposureReticle';
import { ProgressiveAnalysisOverlay } from './ProgressiveAnalysisOverlay';
import { DiscoveryReveal } from './DiscoveryReveal';
import { computeImageSha256 } from '../../ai-engine/crypto/sha256';
import { getEstimatedMarketValue } from '../../utils/marketValuation';
import { resolveCanonicalVehicleSpecs } from '../../utils/vehicleSpecs';

export const ScannerModal: React.FC = () => {
  const { scannerOpen, setScannerOpen, user, onScanCompleted } = useApexStore();
  const { sampleCoarseLocation } = useLocalRarity();
  const [shutterFlash, setShutterFlash] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
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

  // Native camera hook: real rear camera by default, unmirrored, tap-to-focus, exposure, pinch-zoom, torch
  const isCameraPhase =
    scannerOpen &&
    (phase === 'SEARCHING' ||
      phase === 'CAR_DETECTED' ||
      phase === 'POTENTIAL_DISCOVERY' ||
      phase === 'TRACKING');

  const {
    videoRef,
    canvasRef,
    containerRef,
    isRearCamera,
    isMirrored,
    zoomLevel,
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
  } = useNativeCamera({
    enabled: isCameraPhase,
    defaultFacing: 'environment',
    onCameraReady: () => {
      startSearching();
    },
    onError: (err) => {
      console.warn('[ScannerModal] Camera error, searching state active:', err);
      startSearching();
    }
  });

  // Proactive Auth Readiness Preflight on scanner open
  useEffect(() => {
    if (scannerOpen) {
      getAuthoritativeAccessToken(false)
        .then((auth) => {
          if (!auth.hasSession) {
            console.log('[Scanner Preflight] User is guest / unauthenticated');
          } else if (
            auth.expiresAtSec &&
            auth.expiresAtSec - Math.floor(Date.now() / 1000) <= 120
          ) {
            console.log(
              '[Scanner Preflight] Session near expiry, proactively refreshing in background...'
            );
            getAuthoritativeAccessToken(true).catch(() => {});
          }
        })
        .catch(() => {});
    }
  }, [scannerOpen]);

  // Optical Real-Time Vision Loop disabled for locked 60fps performance and clean viewfinder
  useEffect(() => {
    if (!scannerOpen) return;
    onVehicleDetectedChange(true, true);
  }, [scannerOpen, onVehicleDetectedChange]);

  const extractOpticalFeaturesFromDataUrl = (dataUrl: string): Promise<any> => {
    return new Promise((resolve) => {
      try {
        const img = new Image();
        img.onload = () => {
          const offCanvas = document.createElement('canvas');
          offCanvas.width = 64;
          offCanvas.height = 36;
          const offCtx = offCanvas.getContext('2d');
          if (offCtx) {
            offCtx.drawImage(img, 0, 0, 64, 36);
            const features = offlineRecognitionEngine.extractFeatures(offCanvas, offCtx, 64, 36);
            const match = offlineRecognitionEngine.matchVehicle(features, true);
            resolve(match);
            return;
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

  // Helper: Fast Client-Side Image Downscaler (Downscales to 768px for optimal Cloudflare vision latency)
  const optimizeScanImage = async (dataUrl: string, maxDimension = 768, quality = 0.82): Promise<string> => {
    return new Promise((resolve) => {
      if (!dataUrl || !dataUrl.startsWith('data:image')) {
        resolve(dataUrl);
        return;
      }
      const img = new Image();
      img.onload = () => {
        try {
          let { width, height } = img;
          if (width <= maxDimension && height <= maxDimension && dataUrl.length < 800000) {
            resolve(dataUrl);
            return;
          }
          if (width > height) {
            if (width > maxDimension) {
              height = Math.round((height * maxDimension) / width);
              width = maxDimension;
            }
          } else {
            if (height > maxDimension) {
              width = Math.round((width * maxDimension) / height);
              height = maxDimension;
            }
          }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(dataUrl);
            return;
          }
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', quality));
        } catch {
          resolve(dataUrl);
        }
      };
      img.onerror = () => resolve(dataUrl);
      img.src = dataUrl;
    });
  };

  // 3. Fast Optical Feature Extraction & Progressive Verification Pipeline
  const executeInferencePipeline = async (photoDataUrl: string, fileName?: string, captureMs: number = 0) => {
    // Fast pre-compression to prevent heavy mobile uploads
    const readyPhotoDataUrl = await optimizeScanImage(photoDataUrl);

    // 0. Ensure fresh isolated state and unique scan ID per scan
    const currentScanId = `scan_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    activeScanIdRef.current = currentScanId;
    offlineRecognitionEngine.reset();
    submitForAnalysis(readyPhotoDataUrl);
    const tAiStart = performance.now();

    onAnalysisStageResolved(0, 'Visual Geometry Captured');
    onAnalysisStageResolved(1, 'Analyzing Vehicle Characteristics');

    try {
      // 1. Perform AI vehicle vision analysis first
      const aiPromise = identifyVehicleWithAi(readyPhotoDataUrl, false, fileName);
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
      // Gate 0: Infrastructure / Network / Auth / Provider Errors (Intercepted FIRST with truthful UI)
      const infraReason = (aiResult?.rejection_reason || '').toUpperCase();
      if (aiResult && (
        infraReason === 'BACKEND_UNREACHABLE' ||
        infraReason === 'BACKEND_ERROR' ||
        infraReason === 'SERVICE_UNAVAILABLE' ||
        infraReason === 'RATE_LIMIT_EXCEEDED' ||
        infraReason === 'NETWORK_TIMEOUT' ||
        infraReason === 'RATE_LIMITED' ||
        infraReason === 'AUTH_REQUIRED' ||
        infraReason === 'AUTH_SESSION_EXPIRED' ||
        infraReason === 'AUTH_REFRESH_FAILED' ||
        infraReason === 'VISION_PROVIDER_UNAVAILABLE' ||
        aiResult.rejection_reason === 'actual_device_offline' ||
        (aiResult.status as string) === 'provider_unavailable'
      )) {
        onIdentificationFailed(
          aiResult.reason ||
          (infraReason === 'AUTH_REQUIRED' ? 'Please sign in to scan and collect vehicles.' :
           infraReason === 'AUTH_SESSION_EXPIRED' ? 'Authentication session expired. Please sign in to scan.' :
           infraReason === 'AUTH_REFRESH_FAILED' ? 'Unable to refresh authentication session. Please sign in.' :
           (infraReason === 'RATE_LIMITED' || infraReason === 'RATE_LIMIT_EXCEEDED') ? 'Apex is temporarily rate-limited. Please try again shortly.' :
           infraReason === 'NETWORK_TIMEOUT' ? 'The vision request timed out. Please retry.' :
           aiResult.rejection_reason === 'actual_device_offline' ? 'You’re offline, so Apex is using offline identification.' :
           'Apex’s vision service is temporarily unreachable. Please retry.')
        );
        return;
      }

      // Gate A: REMOTE REJECTED / NOT A CAR -> Respect rejection immediately (Never force local guess!)
      if (aiResult && (aiResult.status === 'rejected' || aiResult.is_car === false)) {
        onIdentificationFailed(
          aiResult.rejection_reason ||
          aiResult.reason ||
          'No automobile detected in frame. Please photograph a real motor vehicle.'
        );
        return;
      }

      // Gate B: NO RESULT & OFFLINE ONLY -> Optional conservative local optical fallback
      if (!aiResult) {
        const isDeviceOffline = typeof navigator !== 'undefined' && !navigator.onLine;
        if (isDeviceOffline) {
          let localResult: any = null;
          if (canvasRef.current && canvasRef.current.width > 0) {
            const ctx = canvasRef.current.getContext('2d');
            if (ctx) {
              const features = offlineRecognitionEngine.extractFeatures(canvasRef.current, ctx, 64, 36);
              localResult = offlineRecognitionEngine.matchVehicle(features, true);
            }
          }
          if (!localResult) {
            localResult = await extractOpticalFeaturesFromDataUrl(readyPhotoDataUrl);
          }

          if (localResult && localResult.vehicle && localResult.confidence >= 0.80) {
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
          }
        }

        if (!aiResult) {
          if (isDeviceOffline) {
            onIdentificationFailed(
              'You’re offline, so Apex is using offline identification. Please capture closer framing or connect to internet.'
            );
          } else {
            onIdentificationFailed(
              'Apex’s vision service is temporarily unreachable. Please retry.'
            );
          }
          return;
        }
      }

      // 3. Bind to resolved vehicle specifications
      const make = aiResult?.make || 'Unknown Make';
      let model = aiResult?.model || 'Unknown Model';
      if (make && model && model.toLowerCase().startsWith(make.toLowerCase() + ' ')) {
        model = model.slice(make.length + 1).trim();
      }

      // Guard: Reject non-vehicles or obscure scans resulting in unknown make & model
      const isMakeUnknown = !make || make.trim() === '' || make.toLowerCase().includes('unknown');
      const isModelUnknown = !model || model.trim() === '' || model.toLowerCase().includes('unknown');
      if (isMakeUnknown && isModelUnknown) {
        const isQuota = aiResult?.reason?.includes('VISION_QUOTA_EXHAUSTED') ||
          aiResult?.rejection_reason?.includes('VISION_QUOTA_EXHAUSTED') ||
          aiResult?.angle_instruction?.includes('Vision quota');
        const userFacingMessage = isQuota
          ? 'Vehicle identification temporarily unavailable. Vision quota has been reached. Please try again later.'
          : (aiResult?.angle_instruction ||
             aiResult?.rejection_reason ||
             'Vehicle could not be clearly identified. Please retake the photo with better lighting or vehicle angle.');
        onIdentificationFailed(userFacingMessage);
        return;
      }

      const specResolution = resolveCanonicalVehicleSpecs({
        make,
        model,
        generation: aiResult?.generation,
        trim: aiResult?.trim,
        canonicalVehicleId: aiResult?.canonical_vehicle_id
      });

      const finalMake = specResolution.isVerified ? specResolution.make : make;
      const finalModel = specResolution.isVerified ? specResolution.model : model;
      const generation = specResolution.generation || aiResult?.generation || 'Current';
      const trim = specResolution.trim || aiResult?.trim || undefined;
      const horsepower = specResolution.horsepower ?? (aiResult?.horsepower || undefined);
      const topSpeed = specResolution.topSpeedKmH ?? (aiResult?.top_speed_kmh || undefined);
      const engine = specResolution.engine || aiResult?.engine || (specResolution.isVerified ? 'Verified Engine' : 'Uncatalogued');
      const zeroToHundred = specResolution.zeroToHundredSec ?? (aiResult?.zero_to_hundred_seconds || undefined);
      const torqueNm = specResolution.torqueNm ?? (aiResult?.torque_nm || undefined);
      const kerbWeightKg = specResolution.kerbWeightKg ?? (aiResult?.kerb_weight_kg || undefined);
      const productionYears = specResolution.productionYears !== 'N/A' ? specResolution.productionYears : (aiResult?.production_years || 'N/A');
      const originCountry = specResolution.originCountry !== 'Global' ? specResolution.originCountry : (aiResult?.origin_country || 'Global');
      const bodyStyle = specResolution.bodyStyle || aiResult?.body_style || 'Coupe';
      const color = aiResult?.color || 'Unknown';

      onAnalysisStageResolved(0, 'Framing & Viewpoint Confirmed');

      const featuresSummary = aiResult?.visual_evidence?.grille 
        ? `${aiResult.visual_evidence.grille.slice(0, 32)}…`
        : horsepower
        ? `${horsepower} HP • ${bodyStyle} Silhouette`
        : `${bodyStyle} Silhouette`;
      onAnalysisStageResolved(1, featuresSummary);

      onAnalysisStageResolved(2, `${finalMake} ${finalModel} Confirmed`);

      const candidateSummary = aiResult?.status === 'uncertain'
        ? 'Variant Uncertain — Preserving Base Model'
        : trim
        ? `${trim} Verified`
        : 'Model Family Architecture Confirmed';
      onAnalysisStageResolved(3, candidateSummary);

      const locationSample = await sampleCoarseLocation();
      const userLat = user.latitude || 35.6762;
      const userLng = user.longitude || 139.6503;
      const offset = applySpatialOffset(userLat, userLng);

      const canonicalVehicleId = (aiResult?.canonical_vehicle_id || specResolution.canonicalId || `${make}-${model}`)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-');
      const globalRarityTier: RarityTier = (specResolution.rarity || aiResult?.rarity || 'rare') as RarityTier;

      const cachedCalc = localRarityCache.get(canonicalVehicleId, locationSample.geoBucket || 'global');
      const localCalc = cachedCalc || calculateLocalRarity({
        canonicalVehicleId,
        globalRarity: globalRarityTier,
        localObservationMass: 0,
        bucketTotalMass: 0,
        uniqueContributors: 0,
        geographyBucketId: locationSample.geoBucket || undefined,
        coarseAreaName: locationSample.coarseAreaName
      });

      const localRarityData: LocalRarityInfo = {
        localRarityTier: localCalc.localRarityTier,
        localRarityScore: localCalc.localRarityScore,
        globalRarityTier: localCalc.globalRarityTier,
        globalRarityScore: localCalc.globalRarityScore,
        confidenceState: localCalc.confidenceState,
        coarseAreaName: locationSample.coarseAreaName,
        localXpModifier: localCalc.localXpModifier,
        localBonusXp: 0,
        explanation: localCalc.explanation,
        explanationDebug: localCalc.debug
      };

      const imageHash = computeImageSha256(photoDataUrl);
      const valuation = getEstimatedMarketValue({
        make,
        model,
        rarity: globalRarityTier,
        marketValueLowUsd: aiResult?.market_value_low_usd,
        marketValueHighUsd: aiResult?.market_value_high_usd
      });

      const newCard: CarCard = {
        id: `card-${Date.now()}`,
        cardNumber: `#APX-${Math.floor(1000 + Math.random() * 9000)}`,
        make: finalMake,
        model: finalModel,
        generation,
        trim,
        yearEstimate: specResolution.productionYears && specResolution.productionYears !== 'N/A'
          ? specResolution.productionYears.split('–')[0]
          : String(aiResult?.year_estimate || 2023),
        releasedYear: specResolution.productionYears && specResolution.productionYears !== 'N/A'
          ? specResolution.productionYears.split('–')[0]
          : String(aiResult?.year_estimate || 2023),
        productionYears,
        discontinuedStatus: productionYears.includes('Present') ? 'ACTIVE PRODUCTION' : 'DISCONTINUED',
        color,
        bodyStyle: (bodyStyle as any) || 'Coupe',
        rarity: globalRarityTier,
        rarityScore: localCalc.globalRarityScore,
        topSpeedKmH: topSpeed,
        horsepower,
        engine,
        zeroToHundredSec: zeroToHundred,
        torqueNm,
        kerbWeightKg,
        originCountry,
        interestingFact: specResolution.interestingFact || aiResult?.interesting_facts || 'Engineered with precision.',
        briefHistory: specResolution.briefHistory || aiResult?.brief_history || `${make} ${model}`,
        modsDetected: aiResult?.mods_detected || [],
        imageUrl: photoDataUrl,
        imageHash,
        latApprox: offset.latApprox,
        lngApprox: offset.lngApprox,
        city: user.city || 'Tokyo',
        country: user.country || 'Japan',
        xpEarned: Math.round(localCalc.globalRarityScore * 10 * localCalc.localXpModifier),
        marketValueLowUsd: valuation.lowUsd,
        marketValueHighUsd: valuation.highUsd,
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
        isFirstCityScan: aiResult?.is_first_city || false,
        localRarity: localRarityData
      };
      (newCard as any).geoBucket = locationSample.geoBucket;
      (newCard as any).canonicalVehicleId = canonicalVehicleId;

      if (import.meta.env.DEV) {
        console.log('[Apex Diagnostic Log] Scan Pipeline:', {
          requestId: currentScanId,
          traceId: aiResult?.trace_id || 'none',
          canonicalId: canonicalVehicleId,
          imageAssetId: imageHash,
          renderedCanonicalId: (newCard as any).canonicalVehicleId
        });
      }

      onAnalysisStageResolved(4, `Certainty: ${(newCard.identificationStatus || 'identified').toUpperCase()}`);
      onScanCompleted(newCard);
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

    // 1. Primary: Instant In-Viewfinder Canvas Frame Capture with Zoom Crop & Proper Orientation
    photoDataUrl = await captureFrame();

    // 2. Secondary: Native Capacitor Camera attempt with bounded dimensions
    if (!photoDataUrl && Capacitor.isNativePlatform()) {
      try {
        const image = await CapCamera.getPhoto({
          quality: 80,
          width: 1280,
          height: 1280,
          allowEditing: false,
          correctOrientation: true,
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

    const tCaptureEnd = performance.now();
    const captureMs = Math.round(tCaptureEnd - tCaptureStart);

    if (photoDataUrl) {
      // Step 2 & 3: Immediately freeze hardware stream and display confirmed image
      stopCamera();
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
    stopCamera();
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

      {/* 1. LIVE HARDWARE CAMERA STREAM WITH GOOGLE LENS CONTROLS */}
      <div
        ref={containerRef}
        onClick={(e) => handleTapToFocus(e.clientX, e.clientY)}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className="relative flex-1 flex flex-col justify-between w-full h-full bg-black overflow-hidden cursor-crosshair touch-none"
      >
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          controls={false}
          disablePictureInPicture
          disableRemotePlayback
          poster="data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg'/>"
          className="absolute inset-0 w-full h-full object-cover pointer-events-none transition-transform duration-100 ease-out"
          style={{ 
            background: '#000000',
            transform: `${isMirrored ? 'scaleX(-1)' : 'scaleX(1)'} scale(${zoomLevel})`,
            transformOrigin: 'center center',
            filter: exposureValue !== 0 ? `brightness(${1 + exposureValue * 0.25})` : 'none'
          }}
        />

        {/* Ambient Viewfinder Vignette */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_transparent_40%,_black_95%)] pointer-events-none z-0" />

        {/* Google Lens Tap-to-Focus Reticle and Exposure Slider */}
        <FocusExposureReticle
          focusPoint={focusPoint}
          exposureValue={exposureValue}
          onExposureChange={setExposure}
        />

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
            onSwitchCamera={switchCamera}
            onToggleTorch={toggleTorch}
            hasTorch={hasTorch}
            torchOn={torchOn}
            isRearCamera={isRearCamera}
            zoomLevel={zoomLevel}
            onSelectZoom={setZoom}
            onOpenGallery={() => fileInputRef.current?.click()}
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
              startCamera('environment');
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
                  startCamera('environment');
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
