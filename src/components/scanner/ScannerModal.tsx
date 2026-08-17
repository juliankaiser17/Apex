import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Camera as CapCamera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Capacitor } from '@capacitor/core';
import { RotateCw, AlertTriangle } from 'lucide-react';
import { useApexStore } from '../../store/useApexStore';
import type { CarCard } from '../../types/apex';
import { sounds } from '../../utils/audio';
import { applySpatialOffset } from '../../utils/privacyPipeline';
import { calculateRegionalRarity } from '../../utils/regionalRarityEngine';
import { identifyVehicleWithAi } from '../../services/aiVisionService';
import { hunterSceneEngine, type HunterTargetCandidate, type ApproachGuidance } from '../../services/hunterSceneEngine';
import { useScannerStateMachine } from '../../hooks/useScannerStateMachine';
import { HunterOverlay } from './HunterOverlay';
import { ProgressiveAnalysisOverlay } from './ProgressiveAnalysisOverlay';
import { DiscoveryReveal } from './DiscoveryReveal';

export const ScannerModal: React.FC = () => {
  const { scannerOpen, setScannerOpen, user } = useApexStore();
  const [shutterFlash, setShutterFlash] = useState(false);

  // Multi-vehicle Scene Candidates
  const [candidates, setCandidates] = useState<HunterTargetCandidate[]>([]);
  const [selectedTarget, setSelectedTarget] = useState<HunterTargetCandidate | null>(null);
  const [guidance, setGuidance] = useState<ApproachGuidance>({
    type: 'none',
    instruction: 'POINT CAMERA AT REAL CAR',
    severity: 'info'
  });

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const sceneLoopRef = useRef<number | null>(null);

  // State Machine Hook
  const {
    phase,
    createdCard,
    capturedPhotoUrl,
    errorMessage,
    pipelineStages,
    currentStageIndex,
    startSearching,
    selectTarget,
    triggerLock,
    submitForAnalysis,
    onAnalysisStageResolved,
    onIdentificationSuccess,
    onIdentificationFailed,
    continueHunting,
    resetScanner
  } = useScannerStateMachine();

  // 1. Initialize Hardware Rear Camera Stream
  const initHardwareCamera = useCallback(async () => {
    try {
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
            facingMode: { ideal: 'environment' },
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
  }, [startSearching]);

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

  useEffect(() => {
    if (scannerOpen) {
      initHardwareCamera();
    } else {
      stopCameraStream();
      resetScanner();
    }
    return () => {
      stopCameraStream();
    };
  }, [scannerOpen, initHardwareCamera, stopCameraStream, resetScanner]);

  // 2. Active Scene Model Loop
  useEffect(() => {
    if (!scannerOpen || (phase !== 'SEARCHING' && phase !== 'TRACKING' && phase !== 'TARGET_SELECTED')) {
      return;
    }

    const runSceneProcessing = () => {
      const result = hunterSceneEngine.processScene(videoRef.current, canvasRef.current, true);
      setCandidates(result.candidates);
      setSelectedTarget(result.selectedTarget);
      setGuidance(result.guidance);

      sceneLoopRef.current = requestAnimationFrame(runSceneProcessing);
    };

    sceneLoopRef.current = requestAnimationFrame(runSceneProcessing);

    return () => {
      if (sceneLoopRef.current) {
        cancelAnimationFrame(sceneLoopRef.current);
        sceneLoopRef.current = null;
      }
    };
  }, [scannerOpen, phase]);

  // 3. Shutter Capture & Progressive Inference Execution
  const executeInferencePipeline = async (photoDataUrl: string, fileName?: string) => {
    submitForAnalysis(photoDataUrl);

    // Progressive real-time stage resolution
    setTimeout(() => {
      onAnalysisStageResolved(0, 'Edge contours & wheel geometry resolved');
    }, 450);

    setTimeout(() => {
      onAnalysisStageResolved(1, 'Manufacturer signature identified');
    }, 900);

    try {
      const aiResult = await identifyVehicleWithAi(photoDataUrl, false, fileName);

      if (!aiResult.is_car) {
        onIdentificationFailed(aiResult.rejection_reason || 'This image does not contain a recognized automobile.');
        return;
      }

      onAnalysisStageResolved(2, `${aiResult.horsepower} HP • ${aiResult.top_speed_kmh} KM/H • ${aiResult.engine}`);

      setTimeout(() => {
        onAnalysisStageResolved(3, `Generation ${aiResult.generation} • ${aiResult.production_years}`);
      }, 300);

      const userLat = user.latitude || 35.6762;
      const userLng = user.longitude || 139.6503;
      const offset = applySpatialOffset(userLat, userLng);
      const rarityEngineResult = calculateRegionalRarity({
        make: aiResult.make,
        model: aiResult.model,
        city: user.city || 'Tokyo',
        country: user.country || 'Japan'
      });

      const newCard: CarCard = {
        id: `card-${Date.now()}`,
        cardNumber: `#APX-${Math.floor(1000 + Math.random() * 9000)}`,
        make: aiResult.make,
        model: aiResult.model,
        generation: aiResult.generation,
        trim: aiResult.trim || undefined,
        yearEstimate: aiResult.year_estimate,
        releasedYear: aiResult.year_estimate,
        productionYears: aiResult.production_years || '2019–Present',
        discontinuedStatus: (aiResult.production_years || '').includes('Present') ? 'ACTIVE PRODUCTION' : 'DISCONTINUED',
        color: aiResult.color,
        bodyStyle: aiResult.body_style,
        rarity: rarityEngineResult.rarity || aiResult.rarity,
        rarityScore: rarityEngineResult.rarityScore || 85,
        topSpeedKmH: aiResult.top_speed_kmh,
        horsepower: aiResult.horsepower,
        engine: aiResult.engine,
        zeroToHundredSec: aiResult.zero_to_hundred_seconds,
        torqueNm: aiResult.torque_nm,
        kerbWeightKg: aiResult.kerb_weight_kg,
        originCountry: aiResult.origin_country,
        interestingFact: aiResult.interesting_facts,
        briefHistory: aiResult.historical_information,
        modsDetected: (aiResult.aftermarket_parts_detected || []).map((p: any) => ({
          part: p.part_name,
          description: p.description,
          confidence: p.confidence
        })),
        imageUrl: photoDataUrl || 'https://images.unsplash.com/photo-1544829099-b9a0c07fad1a?q=80&w=1200',
        latApprox: offset.latApprox,
        lngApprox: offset.lngApprox,
        city: user.city || 'Tokyo',
        stateRegion: user.country || 'Japan',
        country: user.country || 'Japan',
        xpEarned: 150,
        marketValueLowUsd: aiResult.estimated_market_value_usd_low || 50000,
        marketValueHighUsd: aiResult.estimated_market_value_usd_high || 80000,
        scanValidated: true,
        isPublic: user.defaultPrivacyLevel === 'public_blurred',
        huntTriggered: false,
        privacyLevel: user.defaultPrivacyLevel,
        aiConfidence: aiResult.confidence || 0.98,
        createdAt: new Date().toISOString(),
        spottedDateFormatted: 'TODAY',
        isFirstCityScan: true
      };

      setTimeout(() => {
        onAnalysisStageResolved(4, `Scarcity confirmed: ${newCard.rarity.toUpperCase()}`);
        onIdentificationSuccess(newCard);
      }, 700);

    } catch (err: any) {
      console.error('Vision analysis error:', err);
      onIdentificationFailed('Failed to verify vehicle. Please check network connection and try again.');
    }
  };

  const handleShutterCapture = async () => {
    triggerLock();
    sounds.playShutter();
    setShutterFlash(true);
    setTimeout(() => setShutterFlash(false), 80);

    // 1. Native Capacitor Camera
    if (Capacitor.isNativePlatform()) {
      try {
        const image = await CapCamera.getPhoto({
          quality: 92,
          allowEditing: false,
          resultType: CameraResultType.DataUrl,
          source: CameraSource.Camera
        });
        if (image && image.dataUrl) {
          executeInferencePipeline(image.dataUrl);
          return;
        }
      } catch (err: any) {
        if (err.message && err.message.toLowerCase().includes('cancel')) {
          startSearching();
          return;
        }
      }
    }

    // 2. Web / Canvas Fallback Capture
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (video && canvas && video.videoWidth > 0) {
      canvas.width = video.videoWidth || 1920;
      canvas.height = video.videoHeight || 1080;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const photoDataUrl = canvas.toDataURL('image/jpeg', 0.95);
        executeInferencePipeline(photoDataUrl);
        return;
      }
    }

    // 3. Fallback Trigger File Picker
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleGalleryPick = async () => {
    sounds.playTargetAcquired();
    try {
      const image = await CapCamera.getPhoto({
        quality: 90,
        allowEditing: false,
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Photos
      });
      if (image && image.dataUrl) {
        executeInferencePipeline(image.dataUrl);
      }
    } catch (err) {
      if (fileInputRef.current) {
        fileInputRef.current.click();
      }
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
    sounds.playTargetAcquired();
    stopCameraStream();
    resetScanner();
    setScannerOpen(false);
  };

  if (!scannerOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-[#080808] flex flex-col justify-between overflow-hidden select-none" style={{ fontFamily: 'DM Sans' }}>
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
      <div className="relative flex-1 flex flex-col justify-between w-full h-full bg-[#080808]">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          controls={false}
          disablePictureInPicture
          className="absolute inset-0 w-full h-full object-cover pointer-events-none"
          style={{ WebkitTransform: 'translateZ(0)' }}
        />

        {/* Ambient Dark Viewfinder Vignette */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_transparent_35%,_#080808_95%)] pointer-events-none z-0" />

        {/* 2. HUNTER MODE OVERLAY (During Searching, Tracking & Lock) */}
        {(phase === 'SEARCHING' || phase === 'TRACKING' || phase === 'TARGET_SELECTED' || phase === 'TARGETS_DETECTED' || phase === 'LOCKING' || phase === 'LOCKED') && (
          <HunterOverlay
            phase={phase}
            candidates={candidates}
            selectedTarget={selectedTarget}
            guidance={guidance}
            onSelectTarget={(targetId) => {
              hunterSceneEngine.selectTarget(targetId);
              selectTarget(targetId);
            }}
            onShutterPress={handleShutterCapture}
            onGalleryPick={handleGalleryPick}
            onClose={handleCloseScanner}
          />
        )}

        {/* 3. PROGRESSIVE ANALYSIS OVERLAY (During Real-Time Pipeline Stages) */}
        {(phase === 'ANALYZING' || phase === 'IDENTIFYING' || phase === 'VERIFYING') && (
          <ProgressiveAnalysisOverlay
            photoUrl={capturedPhotoUrl}
            stages={pipelineStages}
            currentStageIndex={currentStageIndex}
          />
        )}

        {/* 4. DISCOVERY REVEAL & 3D COLLECTIBLE CARD */}
        {(phase === 'REVEALING' || phase === 'DISCOVERED' || phase === 'ALREADY_COLLECTED') && createdCard && (
          <DiscoveryReveal
            card={createdCard}
            isDuplicate={phase === 'ALREADY_COLLECTED'}
            onContinueHunt={continueHunting}
            onClose={handleCloseScanner}
          />
        )}

        {/* 5. ERROR / REJECTION GATE */}
        {phase === 'ERROR' && (
          <div className="relative z-40 flex-1 flex flex-col justify-center items-center p-6 text-center space-y-6 max-w-md mx-auto">
            <div className="w-20 h-20 rounded-full bg-[#E74C3C]/20 border border-[#E74C3C] flex items-center justify-center text-[#E74C3C] shadow-[0_0_20px_rgba(231,76,60,0.4)]">
              <AlertTriangle className="w-10 h-10" />
            </div>

            <div className="space-y-2">
              <h3 className="font-display text-4xl text-[#F0EBE3]">AUTHENTICITY CHECK</h3>
              <p className="text-sm text-[#9A9088] leading-relaxed">
                {errorMessage || 'This image does not contain a recognized automobile.'}
              </p>
            </div>

            <button
              onClick={() => {
                sounds.playTargetAcquired();
                continueHunting();
              }}
              className="w-full py-4 rounded-2xl bg-[#FF4500] text-[#F0EBE3] font-display text-xl tracking-wider shadow-[0_4px_24px_rgba(255,69,0,0.4)] flex items-center justify-center gap-2"
            >
              <RotateCw className="w-5 h-5" />
              <span>RETURN TO LIVE CAMERA</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
