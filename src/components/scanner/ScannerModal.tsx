import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { X, Camera, ShieldAlert, Settings, RefreshCw, AlertTriangle, RotateCw, CornerDownRight, Check } from 'lucide-react';
import { useApexStore } from '../../store/useApexStore';
import type { CarCard } from '../../types/apex';
import { sounds } from '../../utils/audio';
import { applySpatialOffset } from '../../utils/privacyPipeline';
import { calculateRegionalRarity } from '../../utils/regionalRarityEngine';
import { identifyVehicleWithAi } from '../../services/aiVisionService';
import { UnboxingReveal } from './UnboxingReveal';
import { PostScanHuntModal } from '../hunts/PostScanHuntModal';
import { Camera as CapCamera } from '@capacitor/camera';

export const ScannerModal: React.FC = () => {
  const { scannerOpen, setScannerOpen, addCardToGarage, user, triggerMockHunt } = useApexStore();
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
      // 1. Request native camera permissions via Capacitor
      try {
        const permStatus = await CapCamera.requestPermissions();
        if (permStatus.camera !== 'granted' && permStatus.camera !== 'prompt-with-rationale') {
          console.warn('Native camera permission not granted:', permStatus.camera);
        }
      } catch (e) {
        console.log('Capacitor camera request failed or running in web', e);
      }

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setPermissionState('denied');
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
      console.warn('Hardware camera init failed:', err);
      setPermissionState('denied');
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
        
        // CAR-ONLY GATE: If the AI says it's not a car, reject immediately
        if (!aiResult.is_car) {
          clearInterval(interval);
          setAuthenticityError(aiResult.rejection_reason || 'This image does not contain a vehicle. APEX only accepts automobile photographs.');
          setPhase('rejected');
          return;
        }

        const userLat = user.latitude || 0;
        const userLng = user.longitude || 0;
        const offset = applySpatialOffset(userLat, userLng);
        const rarityEngineResult = calculateRegionalRarity({
          make: aiResult.make,
          model: aiResult.model,
          city: user.city || 'Local Area',
          country: user.country || 'Your Country'
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
          city: user.city || 'Local Area',
          stateRegion: user.country || 'Your Region',
          country: user.country || 'Your Country',
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

  const handleShutterCapture = () => {
    if (!videoRef.current || !canvasRef.current) return;

    sounds.playShutter();
    setShutterFlash(true);
    setTimeout(() => setShutterFlash(false), 80);

    const video = videoRef.current;
    const canvas = canvasRef.current;

    canvas.width = video.videoWidth || 1920;
    canvas.height = video.videoHeight || 1080;

    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const photoDataUrl = canvas.toDataURL('image/jpeg', 0.95);
      setCapturedPhotoUrl(photoDataUrl);
    }

    stopCameraStream();
    setPhase('analyzing');
  };

  const handleStartHunt = () => {
    if (createdCard) {
      triggerMockHunt(createdCard);
    }
    setPhase('unboxing');
  };

  const handleJustSave = () => {
    setPhase('unboxing');
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

      {shutterFlash && <div className="absolute inset-0 z-50 bg-white" />}

      {/* Top Header Controls */}
      {phase !== 'unboxing' && phase !== 'hunt_prompt' && (
        <div className="absolute top-4 left-4 right-4 z-40 flex items-center justify-between">
          <button
            onClick={() => {
              setScannerOpen(false);
              setPhase('camera');
              setCreatedCard(null);
              setCapturedPhotoUrl(null);
              setAuthenticityError(null);
              setAngleInstruction(null);
            }}
            className="w-10 h-10 rounded-full bg-[#080808]/70 backdrop-blur-md border border-[#2C2C2C] flex items-center justify-center text-[#F0EBE3] hover:bg-[#1A1A1A] transition-colors"
          >
            <X className="w-6 h-6" />
          </button>

          <span className="font-display text-2xl tracking-widest text-[#FF4500]">
            VISION SCANNER
          </span>

          <div className="w-10 h-10" />
        </div>
      )}

      {/* PERMISSION DENIED FULL-SCREEN PROMPT */}
      {permissionState === 'denied' && phase === 'camera' && (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-6 max-w-md mx-auto">

          <div className="w-20 h-20 rounded-full bg-[#1A1A1A] border border-[#FF4500] flex items-center justify-center text-[#FF4500] glow-orange">
            <ShieldAlert className="w-10 h-10" />
          </div>

          <div className="space-y-2">
            <h2 className="font-display text-4xl text-[#F0EBE3]">CAMERA ACCESS</h2>
            <p className="text-sm text-[#9A9088] leading-relaxed">
              Scan real cars with your live camera to earn XP.
            </p>
          </div>

          <div className="w-full space-y-3">
            <button
              onClick={initHardwareCamera}
              className="w-full py-4 rounded-xl bg-[#FF4500] text-[#F0EBE3] font-display text-xl tracking-wider glow-orange flex items-center justify-center gap-2"
            >
              <Settings className="w-5 h-5" /> TRY LIVE CAMERA AGAIN
            </button>
          </div>
        </div>
      )}

      {/* PHASE 1: LIVE CAMERA VIEWFINDER WITH ASPHALT TARGETING RETICLE */}
      {permissionState === 'granted' && phase === 'camera' && (
        <div className="relative flex-1 flex flex-col justify-between w-full h-full">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            controls={false}
            muted
            disablePictureInPicture
            className="absolute inset-0 w-full h-full object-cover pointer-events-none"
            style={{ WebkitTransform: 'translateZ(0)' }} // Force hardware acceleration to prevent native player fallback
          />

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
            {/* Rotating Reticle */}
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 720, ease: 'linear' }}
              className="absolute inset-0 flex items-center justify-center"
            >
              {/* Outer 220px circle */}
              <div className="w-[220px] h-[220px] rounded-full border border-[#F0EBE3]/20 relative">
                {/* Crosshair compass gaps */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-5 h-1 bg-[#080808]" />
                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 w-5 h-1 bg-[#080808]" />
                <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1/2 h-5 w-1 bg-[#080808]" />
                <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 h-5 w-1 bg-[#080808]" />
              </div>

              {/* Inner 120px circle */}
              <div className="absolute w-[120px] h-[120px] rounded-full border border-[#F0EBE3]/35" />

              {/* Crosshair lines */}
              <div className="absolute w-5 h-[1.5px] bg-[#F0EBE3]/40 left-8" />
              <div className="absolute w-5 h-[1.5px] bg-[#F0EBE3]/40 right-8" />
              <div className="absolute h-5 w-[1.5px] bg-[#F0EBE3]/40 top-8" />
              <div className="absolute h-5 w-[1.5px] bg-[#F0EBE3]/40 bottom-8" />
            </motion.div>

            {/* Center dot */}
            <div className="w-2 h-2 rounded-full bg-[#FF4500] z-10 shadow-[0_0_8px_#FF4500]" />

            {/* Tap instruction */}
            <div className="absolute -bottom-10 inset-x-0 flex items-center justify-center">
              <span className="text-xs font-data text-[#F0EBE3]/90 bg-[#080808]/75 px-4 py-1.5 rounded-full border border-[#2C2C2C] backdrop-blur-md">
                POINT CAMERA AT REAL CAR
              </span>
            </div>
          </div>


          {/* Bottom Shutter Bar */}
          <div className="relative z-30 pb-10 flex flex-col items-center gap-3">
            <span className="text-[11px] font-data text-[#9A9088] bg-[#080808]/70 px-3 py-1 rounded-full border border-[#2C2C2C] backdrop-blur-md">
              GEMINI 2.0 FLASH AI VISION
            </span>

            <div className="flex items-center gap-6">
              {/* Empty placeholder for alignment */}
              <div className="w-28" />

              {/* Shutter Button (72px ring + 60px inner fill) */}
              <motion.button
                onClick={handleShutterCapture}
                whileTap={{ scale: 0.82, transition: { duration: 0.08 } }}
                className="w-[72px] h-[72px] rounded-full border-2 border-[#F0EBE3]/50 bg-[#080808] flex items-center justify-center shrink-0"
              >
                <motion.div
                  className="w-[60px] h-[60px] rounded-full bg-[#F0EBE3]/90 flex items-center justify-center"
                  whileTap={{ scale: 0.88, transition: { duration: 0.06 } }}
                >
                  <Camera className="w-7 h-7 text-[#080808]" />
                </motion.div>
              </motion.button>

              <div className="w-28" />
            </div>
          </div>
        </div>
      )}

      {/* PHASE 2: RADAR ANALYZING STATE (FROZEN PHOTO PREVIEW) */}
      {(phase === 'analyzing' || phase === 'hunt_prompt') && capturedPhotoUrl && (
        <div className="relative flex-1 flex flex-col justify-center items-center p-6 text-center">
          <img src={capturedPhotoUrl} alt="Captured Photo" className="absolute inset-0 w-full h-full object-cover filter blur-sm brightness-40" />
          <div className="absolute inset-0 bg-[#080808]/70" />

          {phase === 'analyzing' && (
            <div className="relative z-10 space-y-6">
              {/* Radar Sweep — Angular conic-gradient sweep */}
              <div className="relative w-40 h-40 mx-auto flex items-center justify-center">
                {/* Outer ring */}
                <div className="absolute inset-0 rounded-full" style={{ background: 'rgba(240,235,227,0.15)', border: '1.5px solid rgba(240,235,227,0.4)' }} />
                {/* Rotating sweep */}
                <motion.div
                  className="absolute inset-0 rounded-full"
                  animate={{ rotate: 360 }}
                  transition={{ repeat: Infinity, duration: 1.4, ease: 'linear' }}
                  style={{
                    background: 'conic-gradient(from 0deg, transparent 0deg, transparent 240deg, rgba(255,69,0,0.4) 300deg, rgba(255,69,0,0) 360deg)',
                    maskImage: 'radial-gradient(circle, transparent 30%, black 31%, black 98%, transparent 100%)',
                    WebkitMaskImage: 'radial-gradient(circle, transparent 30%, black 31%, black 98%, transparent 100%)'
                  }}
                />
                {/* Crosshair lines */}
                <div className="absolute w-4 h-[1px] bg-[#F0EBE3]/30 left-4 top-1/2" />
                <div className="absolute w-4 h-[1px] bg-[#F0EBE3]/30 right-4 top-1/2" />
                <div className="absolute h-4 w-[1px] bg-[#F0EBE3]/30 top-4 left-1/2" />
                <div className="absolute h-4 w-[1px] bg-[#F0EBE3]/30 bottom-4 left-1/2" />
                {/* Center dot */}
                <div className="w-2 h-2 rounded-full bg-[#FF4500] z-10" />
              </div>

              <div>
                <h3 className="font-display text-3xl text-[#F0EBE3]">ANALYZING VEHICLE...</h3>
                <p className="text-[#FF4500] font-data text-sm mt-1 transition-all">
                  {analysisMessages[analysisTextIndex]}
                </p>
              </div>

              {/* Thin progress bar at bottom */}
              <div className="w-64 h-[2px] bg-[#1A1A1A] rounded-full overflow-hidden mx-auto">
                <motion.div
                  className="h-full bg-[#FF4500] rounded-full"
                  initial={{ width: '0%' }}
                  animate={{ width: '90%' }}
                  transition={{ duration: 6, ease: 'linear' }}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* PHASE 2.5: AI IDENTIFIED CAR NAME */}
      {phase === 'analyzing_success' && capturedPhotoUrl && createdCard && (
        <div className="relative flex-1 flex flex-col justify-center items-center p-6 text-center">
          <img src={capturedPhotoUrl} alt="Captured Photo" className="absolute inset-0 w-full h-full object-cover filter blur-sm brightness-40" />
          <div className="absolute inset-0 bg-[#080808]/70" />

          <motion.div 
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="relative z-10 space-y-6"
          >
            <div className="w-20 h-20 mx-auto rounded-full bg-[#3DAA6A]/10 flex items-center justify-center border border-[#3DAA6A]/40 shadow-[0_0_20px_rgba(61,170,106,0.3)]">
              <Check className="w-10 h-10 text-[#3DAA6A]" />
            </div>
            
            <div>
              <h3 className="font-display text-[11px] text-[#3DAA6A] tracking-[0.2em] font-semibold border border-[#3DAA6A]/30 bg-[#3DAA6A]/10 px-3 py-1 rounded-full inline-block mb-3">
                VEHICLE IDENTIFIED
              </h3>
              <p className="text-[#F0EBE3] font-display text-4xl mt-2 tracking-wide uppercase leading-tight drop-shadow-lg">
                {createdCard.make}<br />{createdCard.model}
              </p>
            </div>

            <div className="pt-4 flex flex-col items-center gap-3">
              <RefreshCw className="w-5 h-5 text-[#FF4500] animate-spin opacity-80" />
              <p className="text-[#9A9088] font-data text-[10px] tracking-widest uppercase">
                PREPARING COLLECTIBLE CARD...
              </p>
            </div>
          </motion.div>
        </div>
      )}

      {/* POST-SCAN HUNT PROMPT BOTTOM SHEET */}
      <PostScanHuntModal
        card={createdCard}
        isOpen={phase === 'hunt_prompt'}
        onStartHunt={handleStartHunt}
        onJustSave={handleJustSave}
      />

      {/* AUTHENTICITY REJECTION SCREEN */}
      {phase === 'rejected' && (
        <div className="relative flex-1 flex flex-col items-center justify-center p-6 text-center space-y-6 max-w-md mx-auto">
          <div className="w-20 h-20 rounded-full bg-[#1F0500] border-2 border-[#FF2200] flex items-center justify-center text-[#FF2200] glow-fire">
            <AlertTriangle className="w-10 h-10" />
          </div>

          <div className="space-y-2">
            <span className="text-xs font-data font-semibold uppercase text-[#FF2200] bg-[#1F0500] px-3 py-1 rounded-full border border-[#FF2200]/40">
              AUTHENTICITY CHECK FAILED
            </span>
            <h2 className="font-display text-3xl text-[#F0EBE3]">SCAN REJECTED</h2>
            <p className="text-sm text-[#9A9088] font-data leading-relaxed bg-[#111111] p-4 rounded-xl border border-[#2C2C2C]">
              "{authenticityError || 'Image failed authenticity verification.'}"
            </p>
            <p className="text-xs text-[#5A5550]">
              No XP was deducted. Please take a live photo of a real car in the real world.
            </p>
          </div>

          <button
            onClick={() => {
              setPhase('camera');
              setCapturedPhotoUrl(null);
              setCapturedFileName(null);
              setAuthenticityError(null);
            }}
            className="w-full py-4 rounded-xl bg-[#FF4500] text-[#F0EBE3] font-display text-xl tracking-wider glow-orange flex items-center justify-center gap-2"
          >
            <RotateCw className="w-5 h-5" /> TRY AGAIN WITH LIVE CAMERA
          </button>
        </div>
      )}

      {/* PHASE 3: AUTOMATED UNBOXING & REVEAL PIPELINE */}
      {phase === 'unboxing' && createdCard && (
        <UnboxingReveal card={createdCard} onComplete={handleUnboxingComplete} />
      )}
    </div>
  );
};
