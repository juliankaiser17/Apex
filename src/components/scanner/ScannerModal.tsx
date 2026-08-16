import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { X, Camera, RefreshCw, AlertTriangle, RotateCw, CornerDownRight, Check, Image as ImageIcon } from 'lucide-react';
import { useApexStore } from '../../store/useApexStore';
import type { CarCard } from '../../types/apex';
import { sounds } from '../../utils/audio';
import { applySpatialOffset } from '../../utils/privacyPipeline';
import { calculateRegionalRarity } from '../../utils/regionalRarityEngine';
import { identifyVehicleWithAi } from '../../services/aiVisionService';
import { UnboxingReveal } from './UnboxingReveal';
import { Camera as CapCamera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Capacitor } from '@capacitor/core';

export const ScannerModal: React.FC = () => {
  const { scannerOpen, setScannerOpen, addCardToGarage, user } = useApexStore();
  const [phase, setPhase] = useState<'camera' | 'analyzing' | 'analyzing_success' | 'rejected' | 'hunt_prompt' | 'unboxing'>('camera');
  const [permissionState, setPermissionState] = useState<'granted' | 'denied' | 'requesting'>('requesting');
  const [capturedPhotoUrl, setCapturedPhotoUrl] = useState<string | null>(null);
  const [capturedFileName, setCapturedFileName] = useState<string | null>(null);
  const [analysisTextIndex, setAnalysisTextIndex] = useState(0);
  const [authenticityError, setAuthenticityError] = useState<string | null>(null);
  const [angleInstruction, setAngleInstruction] = useState<string | null>(null);
  const [createdCard, setCreatedCard] = useState<CarCard | null>(null);
  const [shutterFlash, setShutterFlash] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const analysisMessages = [
    'Processing image metadata...',
    'Extracting vehicle specifications...',
    'Applying spatial location privacy...',
    'Calculating regional rarity score...'
  ];

  // Initialize Hardware Rear Camera Stream with fallbacks
  const initHardwareCamera = async () => {
    setPermissionState('requesting');
    try {
      try {
        const permStatus = await CapCamera.requestPermissions();
        if (permStatus.camera !== 'granted' && permStatus.camera !== 'prompt-with-rationale') {
          console.warn('Native camera permission not granted:', permStatus.camera);
        }
      } catch (e) {
        console.log('Capacitor camera request failed or running in web', e);
      }

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setPermissionState('granted');
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
      setPermissionState('granted');
    } catch (err) {
      console.warn('Hardware camera init fallback:', err);
      setPermissionState('granted');
    }
  };

  useEffect(() => {
    if (scannerOpen && phase === 'camera') {
      initHardwareCamera();
    } else {
      stopCameraStream();
    }
    return () => {
      stopCameraStream();
    };
  }, [scannerOpen, phase]);

  const stopCameraStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
  };

  useEffect(() => {
    if (phase === 'analyzing') {
      const startTime = Date.now();
      const interval = setInterval(() => {
        setAnalysisTextIndex(i => (i + 1) % analysisMessages.length);
      }, 700);

      const processScan = async () => {
        const aiResult = await identifyVehicleWithAi(capturedPhotoUrl || '', false, capturedFileName || undefined);
        
        if (!aiResult.is_car) {
          clearInterval(interval);
          setAuthenticityError(aiResult.rejection_reason || 'This image does not contain a vehicle. APEX only accepts automobile photographs.');
          setPhase('rejected');
          return;
        }

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
          imageUrl: capturedPhotoUrl || 'https://images.unsplash.com/photo-1544829099-b9a0c07fad1a?q=80&w=1200',
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

        const elapsedTime = Date.now() - startTime;
        const remainingWait = Math.max(0, 1500 - elapsedTime);

        setTimeout(() => {
          setCreatedCard(newCard);
          sounds.playXpPop();
          setPhase('analyzing_success');
          
          setTimeout(() => {
            setPhase('unboxing');
          }, 1500);
        }, remainingWait);
      };

      processScan();

      return () => {
        clearInterval(interval);
      };
    }
  }, [phase, capturedPhotoUrl, user]);

  if (!scannerOpen) return null;

  const handleShutterCapture = async () => {
    sounds.playShutter();
    setShutterFlash(true);
    setTimeout(() => setShutterFlash(false), 80);

    // 1. If native platform, prioritize native Camera for ultra-sharp auto-focus
    if (Capacitor.isNativePlatform()) {
      try {
        const image = await CapCamera.getPhoto({
          quality: 92,
          allowEditing: false,
          resultType: CameraResultType.DataUrl,
          source: CameraSource.Camera
        });
        if (image && image.dataUrl) {
          setCapturedPhotoUrl(image.dataUrl);
          stopCameraStream();
          setPhase('analyzing');
          return;
        }
      } catch (err: any) {
        console.warn('Native camera capture error or cancelled:', err);
        if (err.message && err.message.toLowerCase().includes('cancel')) {
          return;
        }
      }
    }

    // 2. Web / Canvas capture fallback from live video element
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (video && canvas && video.videoWidth > 0) {
      canvas.width = video.videoWidth || 1920;
      canvas.height = video.videoHeight || 1080;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const photoDataUrl = canvas.toDataURL('image/jpeg', 0.95);
        setCapturedPhotoUrl(photoDataUrl);
        stopCameraStream();
        setPhase('analyzing');
        return;
      }
    }

    // 3. If stream is not active, trigger file / camera picker directly
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleGalleryPick = async () => {
    sounds.playTargetLock();
    try {
      const image = await CapCamera.getPhoto({
        quality: 90,
        allowEditing: false,
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Photos
      });
      if (image && image.dataUrl) {
        setCapturedPhotoUrl(image.dataUrl);
        stopCameraStream();
        setPhase('analyzing');
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
    setCapturedFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      setCapturedPhotoUrl(reader.result as string);
      stopCameraStream();
      setPhase('analyzing');
    };
    reader.readAsDataURL(file);
  };

  const handleUnboxingComplete = (postedToFeed?: boolean) => {
    if (createdCard && !postedToFeed) {
      addCardToGarage(createdCard);
    }
    setScannerOpen(false);
    setPhase('camera');
    setCreatedCard(null);
    setCapturedPhotoUrl(null);
    setAuthenticityError(null);
    setAngleInstruction(null);
  };

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

      {/* Top Header Controls */}
      {phase !== 'unboxing' && phase !== 'hunt_prompt' && (
        <div className="absolute top-4 left-4 right-4 z-40 flex items-center justify-between pointer-events-auto">
          <button
            onClick={() => {
              setScannerOpen(false);
              setPhase('camera');
              setCreatedCard(null);
              setCapturedPhotoUrl(null);
              setAuthenticityError(null);
              setAngleInstruction(null);
            }}
            className="w-11 h-11 rounded-full bg-[#080808]/80 backdrop-blur-md border border-[#2C2C2C] flex items-center justify-center text-[#F0EBE3] hover:bg-[#1A1A1A] transition-colors"
          >
            <X className="w-6 h-6" />
          </button>

          <span className="font-display text-2xl tracking-widest text-[#FF4500]">
            VISION SCANNER
          </span>

          <div className="w-11 h-11" />
        </div>
      )}

      {/* PHASE 1: LIVE CAMERA VIEWFINDER WITH ASPHALT TARGETING RETICLE */}
      {permissionState === 'granted' && phase === 'camera' && (
        <div className="relative flex-1 flex flex-col justify-between w-full h-full bg-[#0d0d0d]">
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

          {/* Fallback Viewfinder Grid Overlay if video takes a second */}
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_transparent_30%,_#080808_95%)] pointer-events-none" />

          {/* ANGLE INSTRUCTION OVERLAY BANNER IF APPLICABLE */}
          {angleInstruction && (
            <div className="absolute top-20 left-4 right-4 z-40 p-4 rounded-xl bg-[#1F1508]/90 backdrop-blur-xl border border-[#FFA500]/50 text-[#FFA500] text-xs font-data flex items-center gap-3 shadow-lg">
              <CornerDownRight className="w-5 h-5 text-[#FFA500] shrink-0 animate-bounce" />
              <div>
                <span className="font-semibold text-[#FFA500] uppercase tracking-wider block">RETAKE WITH BETTER ANGLE:</span>
                <span>{angleInstruction}</span>
              </div>
            </div>
          )}

          {/* ASPHALT CIRCULAR TARGETING RETICLE */}
          <div className="relative z-20 my-auto mx-auto w-72 h-72 pointer-events-none flex items-center justify-center">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 720, ease: 'linear' }}
              className="absolute inset-0 flex items-center justify-center"
            >
              <div className="w-[220px] h-[220px] rounded-full border border-[#F0EBE3]/25 relative">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-5 h-1 bg-[#080808]" />
                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 w-5 h-1 bg-[#080808]" />
                <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1/2 h-5 w-1 bg-[#080808]" />
                <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 h-5 w-1 bg-[#080808]" />
              </div>

              <div className="absolute w-[120px] h-[120px] rounded-full border border-[#F0EBE3]/40" />

              <div className="absolute w-5 h-[1.5px] bg-[#F0EBE3]/40 left-8" />
              <div className="absolute w-5 h-[1.5px] bg-[#F0EBE3]/40 right-8" />
              <div className="absolute h-5 w-[1.5px] bg-[#F0EBE3]/40 top-8" />
              <div className="absolute h-5 w-[1.5px] bg-[#F0EBE3]/40 bottom-8" />
            </motion.div>

            <div className="w-2.5 h-2.5 rounded-full bg-[#FF4500] z-10 shadow-[0_0_10px_#FF4500]" />

            <div className="absolute -bottom-10 inset-x-0 flex items-center justify-center">
              <span className="text-xs font-data text-[#F0EBE3]/90 bg-[#080808]/80 px-4 py-1.5 rounded-full border border-[#2C2C2C] backdrop-blur-md">
                POINT CAMERA AT REAL CAR
              </span>
            </div>
          </div>

          {/* Bottom Shutter Bar */}
          <div className="relative z-30 pb-10 flex flex-col items-center gap-3">
            <span className="text-[11px] font-data text-[#9A9088] bg-[#080808]/80 px-3.5 py-1 rounded-full border border-[#2C2C2C] backdrop-blur-md">
              GEMINI 2.0 FLASH AI VISION
            </span>

            <div className="flex items-center gap-6">
              {/* Photo Gallery Picker Button */}
              <button
                onClick={handleGalleryPick}
                className="w-12 h-12 rounded-full bg-[#111111]/90 border border-[#2C2C2C] flex items-center justify-center text-[#F0EBE3] hover:border-[#FF4500] transition-colors"
                title="Select Photo from Device Gallery"
              >
                <ImageIcon className="w-5 h-5 text-[#FF4500]" />
              </button>

              {/* Shutter Button (74px ring + 62px inner fill) */}
              <motion.button
                onClick={handleShutterCapture}
                whileTap={{ scale: 0.82, transition: { duration: 0.08 } }}
                className="w-[76px] h-[76px] rounded-full border-2 border-[#F0EBE3]/60 bg-[#080808] flex items-center justify-center shrink-0 shadow-2xl"
              >
                <motion.div
                  className="w-[62px] h-[62px] rounded-full bg-[#F0EBE3] flex items-center justify-center"
                  whileTap={{ scale: 0.88, transition: { duration: 0.06 } }}
                >
                  <Camera className="w-7 h-7 text-[#080808]" />
                </motion.div>
              </motion.button>

              {/* Retry / Switch Camera Button */}
              <button
                onClick={initHardwareCamera}
                className="w-12 h-12 rounded-full bg-[#111111]/90 border border-[#2C2C2C] flex items-center justify-center text-[#F0EBE3] hover:border-[#FF4500] transition-colors"
                title="Refresh Live Camera"
              >
                <RefreshCw className="w-5 h-5 text-[#9A9088]" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PHASE 2: RADAR ANALYZING STATE */}
      {(phase === 'analyzing' || phase === 'hunt_prompt' || phase === 'analyzing_success') && capturedPhotoUrl && (
        <div className="relative flex-1 flex flex-col justify-center items-center p-6 text-center">
          <img src={capturedPhotoUrl} alt="Captured Photo" className="absolute inset-0 w-full h-full object-cover filter blur-sm brightness-40" />
          <div className="absolute inset-0 bg-[#080808]/75" />

          {phase === 'analyzing' && (
            <div className="relative z-10 space-y-6">
              <div className="w-24 h-24 rounded-full border-2 border-[#FF4500] flex items-center justify-center mx-auto relative animate-spin">
                <div className="absolute w-3 h-3 bg-[#FF4500] rounded-full top-0 -translate-y-1/2" />
              </div>

              <div className="space-y-2">
                <h3 className="font-display text-4xl text-[#F0EBE3] tracking-wide">ANALYZING SPEC</h3>
                <p className="text-sm font-data text-[#FF4500] animate-pulse">
                  {analysisMessages[analysisTextIndex]}
                </p>
              </div>
            </div>
          )}

          {phase === 'analyzing_success' && (
            <div className="relative z-10 space-y-4">
              <div className="w-20 h-20 rounded-full bg-[#2ECC71]/20 border-2 border-[#2ECC71] flex items-center justify-center mx-auto text-[#2ECC71]">
                <Check className="w-10 h-10" />
              </div>
              <h3 className="font-display text-3xl text-[#F0EBE3]">VEHICLE IDENTIFIED</h3>
              <p className="text-xs font-data text-[#9A9088]">Preparing collectible mint card...</p>
            </div>
          )}
        </div>
      )}

      {/* PHASE 3: REJECTION MODAL */}
      {phase === 'rejected' && (
        <div className="flex-1 flex flex-col justify-center items-center p-6 text-center space-y-6 max-w-md mx-auto">
          <div className="w-20 h-20 rounded-full bg-[#E74C3C]/20 border border-[#E74C3C] flex items-center justify-center text-[#E74C3C]">
            <AlertTriangle className="w-10 h-10" />
          </div>

          <div className="space-y-2">
            <h3 className="font-display text-3xl text-[#F0EBE3]">AUTHENTICITY GATE</h3>
            <p className="text-sm text-[#9A9088] leading-relaxed">
              {authenticityError || 'This image does not contain a recognized automobile.'}
            </p>
          </div>

          <button
            onClick={() => {
              setPhase('camera');
              setCapturedPhotoUrl(null);
              setAuthenticityError(null);
            }}
            className="w-full py-4 rounded-xl bg-[#FF4500] text-[#F0EBE3] font-display text-xl tracking-wider glow-orange flex items-center justify-center gap-2"
          >
            <RotateCw className="w-5 h-5" /> RETAKE REAL VEHICLE
          </button>
        </div>
      )}

      {/* PHASE 4: 3D UNBOXING REVEAL */}
      {phase === 'unboxing' && createdCard && (
        <UnboxingReveal card={createdCard} onComplete={handleUnboxingComplete} />
      )}
    </div>
  );
};
