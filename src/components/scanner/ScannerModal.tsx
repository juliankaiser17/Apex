import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { X, Camera, ShieldAlert, Settings, RefreshCw, AlertTriangle, RotateCw, CornerDownRight } from 'lucide-react';
import { useApexStore } from '../../store/useApexStore';
import type { CarCard } from '../../types/apex';
import { sounds } from '../../utils/audio';
import { applySpatialOffset } from '../../utils/privacyPipeline';
import { calculateRegionalRarity } from '../../utils/regionalRarityEngine';
import { SMART_CAR_DATABASE } from '../../services/aiVisionService';
import { UnboxingReveal } from './UnboxingReveal';
import { PostScanHuntModal } from '../hunts/PostScanHuntModal';

export const ScannerModal: React.FC = () => {
  const { scannerOpen, setScannerOpen, addCardToGarage, user, triggerMockHunt } = useApexStore();
  const [phase, setPhase] = useState<'camera' | 'analyzing' | 'select_vehicle' | 'rejected' | 'hunt_prompt' | 'unboxing'>('camera');
  const [permissionState, setPermissionState] = useState<'granted' | 'denied' | 'requesting'>('requesting');
  const [capturedPhotoUrl, setCapturedPhotoUrl] = useState<string | null>(null);
  const [analysisTextIndex, setAnalysisTextIndex] = useState(0);
  const [authenticityError, setAuthenticityError] = useState<string | null>(null);
  const [angleInstruction, setAngleInstruction] = useState<string | null>(null);
  const [createdCard, setCreatedCard] = useState<CarCard | null>(null);
  const [shutterFlash, setShutterFlash] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const dataUrl = event.target?.result as string;
        setCapturedPhotoUrl(dataUrl);
        stopCameraStream();
        setPhase('analyzing');
      };
      reader.readAsDataURL(file);
    }
  };

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

  const handleConfirmVehicleSelection = (selectedKey?: string, customMakeInput?: string, customModelInput?: string) => {
    sounds.playTargetLock();

    let make = 'Toyota';
    let model = 'GR Supra 3.0 (A90)';
    let generation = 'MK5';
    let trim = 'Inline-6 Turbo';
    let yearEstimate = '2021';
    let color = 'Ice Cap White';
    let rarity: any = 'epic';
    let topSpeedKmH = 250;
    let horsepower = 382;
    let engine = '3.0L B58 Turbo I6';
    let zeroToHundredSec = 3.9;
    let torqueNm = 500;
    let kerbWeightKg = 1540;
    let originCountry = 'Japan';
    let bodyStyle: any = 'Coupe';
    let interestingFact = 'Double-bubble roof design lowers aerodynamic drag without sacrificing driver headroom.';
    let briefHistory = 'Co-developed with BMW, featuring the legendary B58 engine and 50:50 weight distribution.';
    let productionYears = '2019–Present';
    let modsDetected: any[] = [
      { part: 'Titanium Exhaust', description: 'Akrapovič slip-on titanium exhaust', confidence: 0.95 }
    ];

    if (selectedKey && SMART_CAR_DATABASE[selectedKey]) {
      const preset = SMART_CAR_DATABASE[selectedKey];
      make = preset.make;
      model = preset.model;
      generation = preset.generation;
      trim = preset.trim || 'Factory Spec';
      yearEstimate = preset.year_estimate;
      color = preset.color;
      rarity = preset.rarity;
      topSpeedKmH = preset.top_speed_kmh;
      horsepower = preset.horsepower;
      engine = preset.engine;
      zeroToHundredSec = preset.zero_to_hundred_seconds;
      torqueNm = preset.torque_nm;
      kerbWeightKg = preset.kerb_weight_kg;
      originCountry = preset.origin_country;
      bodyStyle = preset.body_style;
      interestingFact = preset.interesting_facts;
      briefHistory = preset.historical_information;
      productionYears = preset.production_years;
      modsDetected = preset.aftermarket_parts_detected.map(p => ({
        part: p.part_name,
        description: p.description,
        confidence: p.confidence
      }));
    } else if (customMakeInput && customModelInput) {
      make = customMakeInput.trim();
      model = customModelInput.trim();
      trim = 'Custom Spec';
      yearEstimate = '2023';
      color = 'Custom Spec';
      rarity = 'rare';
      topSpeedKmH = 280;
      horsepower = 420;
      engine = 'V8 Twin-Turbo';
      zeroToHundredSec = 4.0;
      productionYears = '2020–Present';
    }

    const offset = applySpatialOffset(22.2950, 114.1720);
    const rarityEngineResult = calculateRegionalRarity({
      make,
      model,
      city: 'Hong Kong',
      country: 'Hong Kong'
    });

    const newCard: CarCard = {
      id: `card-${Date.now()}`,
      cardNumber: `#APX-${Math.floor(1000 + Math.random() * 9000)}`,
      make,
      model,
      generation,
      trim,
      yearEstimate,
      releasedYear: yearEstimate,
      productionYears,
      discontinuedStatus: productionYears.includes('Present') ? 'ACTIVE PRODUCTION' : 'DISCONTINUED',
      color,
      bodyStyle,
      rarity: rarityEngineResult.rarity || rarity,
      rarityScore: rarityEngineResult.rarityScore || 85,
      topSpeedKmH,
      horsepower,
      engine,
      zeroToHundredSec,
      torqueNm,
      kerbWeightKg,
      originCountry,
      interestingFact,
      briefHistory,
      modsDetected,
      imageUrl: capturedPhotoUrl || 'https://images.unsplash.com/photo-1544829099-b9a0c07fad1a?q=80&w=1200',
      latApprox: offset.latApprox,
      lngApprox: offset.lngApprox,
      city: 'Hong Kong',
      stateRegion: 'Kowloon',
      country: 'Hong Kong',
      xpEarned: 150,
      marketValueLowUsd: 60000,
      marketValueHighUsd: 120000,
      scanValidated: true,
      isPublic: user.defaultPrivacyLevel === 'public_blurred',
      huntTriggered: false,
      privacyLevel: user.defaultPrivacyLevel,
      aiConfidence: 0.99,
      createdAt: new Date().toISOString(),
      spottedDateFormatted: 'TODAY',
      isFirstCityScan: true
    };

    setCreatedCard(newCard);

    if (
      user.defaultPrivacyLevel === 'no_hunt_private' ||
      !user.allowHunts ||
      newCard.rarity === 'common'
    ) {
      setPhase('unboxing');
    } else {
      setPhase('hunt_prompt');
    }
  };

  useEffect(() => {
    if (phase === 'analyzing') {
      const interval = setInterval(() => {
        setAnalysisTextIndex(i => (i + 1) % analysisMessages.length);
      }, 700);

      const timer = setTimeout(() => {
        setPhase('select_vehicle');
      }, 600);

      return () => {
        clearInterval(interval);
        clearTimeout(timer);
      };
    }
  }, [phase]);

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

  const handleUnboxingComplete = () => {
    if (createdCard) {
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
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelect}
            accept="image/*"
            className="hidden"
          />

          <div className="w-20 h-20 rounded-full bg-[#1A1A1A] border border-[#FF4500] flex items-center justify-center text-[#FF4500] glow-orange">
            <ShieldAlert className="w-10 h-10" />
          </div>

          <div className="space-y-2">
            <h2 className="font-display text-4xl text-[#F0EBE3]">CAMERA ACCESS</h2>
            <p className="text-sm text-[#9A9088] leading-relaxed">
              Scan with your live camera or upload a car photo from your device gallery.
            </p>
          </div>

          <div className="w-full space-y-3">
            <button
              onClick={initHardwareCamera}
              className="w-full py-4 rounded-xl bg-[#FF4500] text-[#F0EBE3] font-display text-xl tracking-wider glow-orange flex items-center justify-center gap-2"
            >
              <Settings className="w-5 h-5" /> TRY LIVE CAMERA AGAIN
            </button>

            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full py-3.5 rounded-xl bg-[#1A1A1A] hover:bg-[#2C2C2C] text-[#F0EBE3] font-display text-base tracking-wider border border-[#2C2C2C] flex items-center justify-center gap-2"
            >
              <Camera className="w-5 h-5 text-[#FF4500]" /> UPLOAD PHOTO FROM GALLERY / CAMERA
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
            muted
            className="absolute inset-0 w-full h-full object-cover"
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

          {/* Hidden File Input */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelect}
            accept="image/*"
            className="hidden"
          />

          {/* Bottom Shutter Bar */}
          <div className="relative z-30 pb-10 flex flex-col items-center gap-3">
            <span className="text-[11px] font-data text-[#9A9088] bg-[#080808]/70 px-3 py-1 rounded-full border border-[#2C2C2C] backdrop-blur-md">
              GEMINI 2.0 FLASH AI VISION
            </span>

            <div className="flex items-center gap-6">
              {/* Gallery Upload Button */}
              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-4 py-2 rounded-xl bg-[#1A1A1A] border border-[#2C2C2C] text-xs font-data text-[#F0EBE3] hover:border-[#FF4500] flex items-center gap-2"
              >
                <span>🖼️ UPLOAD PHOTO</span>
              </button>

              {/* Shutter Button (72px ring + 60px inner fill) */}
              <motion.button
                onClick={handleShutterCapture}
                whileTap={{ scale: 0.88 }}
                className="w-[72px] h-[72px] rounded-full border-2 border-[#F0EBE3]/60 bg-[#080808] flex items-center justify-center glow-orange shrink-0"
              >
                <div className="w-[60px] h-[60px] rounded-full bg-[#F0EBE3] flex items-center justify-center">
                  <Camera className="w-7 h-7 text-[#080808]" />
                </div>
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
              {/* Radar Sweep Animation */}
              <div className="relative w-36 h-36 mx-auto rounded-full border border-[#F0EBE3]/20 flex items-center justify-center p-2">
                <div className="absolute inset-0 rounded-full border border-[#FF4500] animate-ping opacity-30" />
                <div className="w-full h-full rounded-full border-t-2 border-r-2 border-[#FF4500] animate-radar" />
                <RefreshCw className="w-10 h-10 text-[#FF4500] animate-spin" />
              </div>

              <div>
                <h3 className="font-display text-3xl text-[#F0EBE3]">ANALYZING VEHICLE...</h3>
                <p className="text-[#FF4500] font-data text-sm mt-1 transition-all">
                  {analysisMessages[analysisTextIndex]}
                </p>
              </div>

              <div className="w-64 h-1.5 bg-[#1A1A1A] rounded-full overflow-hidden mx-auto border border-[#2C2C2C]">
                <div className="h-full bg-[#FF4500] rounded-full animate-pulse w-4/5" />
              </div>
            </div>
          )}
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
              setAuthenticityError(null);
            }}
            className="w-full py-4 rounded-xl bg-[#FF4500] text-[#F0EBE3] font-display text-xl tracking-wider glow-orange flex items-center justify-center gap-2"
          >
            <RotateCw className="w-5 h-5" /> TRY AGAIN WITH LIVE CAMERA
          </button>
        </div>
      )}

      {/* VEHICLE SELECTION SCREEN (Guaranteeing 100% accurate make & model) */}
      {phase === 'select_vehicle' && (
        <div className="relative flex-1 flex flex-col justify-between p-5 overflow-y-auto max-w-md mx-auto w-full text-[#F0EBE3]">
          <div className="space-y-3 z-10 pt-2">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full bg-[#FF4500]/20 text-[#FF4500] border border-[#FF4500]/40 font-data text-[10px] font-bold tracking-wider">
                STEP 2 OF 2
              </span>
            </div>
            <h2 className="font-display text-3xl tracking-wide text-[#F0EBE3]">
              IDENTIFY SPOTTED CAR
            </h2>
            <p className="text-xs font-data text-[#9A9088]">
              Select your exact car model from the verified database or type a custom make & model below:
            </p>
          </div>

          {/* Quick Preset Grid */}
          <div className="grid grid-cols-1 gap-2 my-4 max-h-64 overflow-y-auto pr-1 no-scrollbar z-10">
            {[
              { key: 'supra', label: '🏎️ Toyota GR Supra 3.0 (A90)', sub: 'Japan · EPIC' },
              { key: 'porsche997', label: '🏎️ Porsche 911 Carrera S (997)', sub: 'Germany · RARE' },
              { key: 'porsche996', label: '🏎️ Porsche 911 Cabriolet (996)', sub: 'Germany · RARE' },
              { key: 'bmw_m3', label: '🏎️ BMW M3 Competition (G80)', sub: 'Germany · EPIC' },
              { key: 'mclaren650s', label: '🏎️ McLaren 650S', sub: 'UK · LEGENDARY' },
              { key: 'ferrari458', label: '🏎️ Ferrari 458 Spider', sub: 'Italy · LEGENDARY' },
              { key: 'lamborghini_huracan', label: '🏎️ Lamborghini Huracán LP610-4', sub: 'Italy · LEGENDARY' },
              { key: 'gtr', label: '🏎️ Nissan GT-R Nismo (R35)', sub: 'Japan · LEGENDARY' },
              { key: 'dc_avanti', label: '🏎️ DC Avanti', sub: 'India · RARE' },
            ].map(item => (
              <button
                key={item.key}
                onClick={() => handleConfirmVehicleSelection(item.key)}
                className="w-full p-3 rounded-xl bg-[#141414] border border-[#2C2C2C] hover:border-[#FF4500] hover:bg-[#FF4500]/10 transition-all text-left flex items-center justify-between group"
              >
                <div>
                  <span className="font-display text-base text-[#F0EBE3] group-hover:text-[#FF4500] transition-colors block">
                    {item.label}
                  </span>
                  <span className="text-[10px] font-data text-[#9A9088]">{item.sub}</span>
                </div>
                <CornerDownRight className="w-4 h-4 text-[#9A9088] group-hover:text-[#FF4500]" />
              </button>
            ))}
          </div>

          {/* Or Custom Make/Model Input */}
          <div className="p-4 rounded-2xl bg-[#111111] border border-[#2C2C2C] space-y-3 z-10">
            <span className="text-xs font-display text-[#F0EBE3] tracking-wider block">
              OR TYPE CUSTOM VEHICLE MODEL:
            </span>
            <div className="grid grid-cols-2 gap-2">
              <input
                id="customMakeInput"
                type="text"
                placeholder="Make (e.g. BMW)"
                className="w-full bg-[#080808] border border-[#2C2C2C] rounded-xl px-3 py-2 text-xs text-[#F0EBE3] focus:border-[#FF4500] focus:outline-none"
              />
              <input
                id="customModelInput"
                type="text"
                placeholder="Model (e.g. M5 CS)"
                className="w-full bg-[#080808] border border-[#2C2C2C] rounded-xl px-3 py-2 text-xs text-[#F0EBE3] focus:border-[#FF4500] focus:outline-none"
              />
            </div>
            <button
              onClick={() => {
                const makeVal = (document.getElementById('customMakeInput') as HTMLInputElement)?.value;
                const modelVal = (document.getElementById('customModelInput') as HTMLInputElement)?.value;
                if (makeVal && modelVal) {
                  handleConfirmVehicleSelection(undefined, makeVal, modelVal);
                }
              }}
              className="w-full py-2.5 rounded-xl bg-[#FF4500] hover:bg-[#FF6A00] text-[#F0EBE3] font-display text-sm tracking-wider glow-orange transition-all"
            >
              GENERATE CUSTOM CARD →
            </button>
          </div>
        </div>
      )}

      {/* PHASE 3: AUTOMATED UNBOXING & REVEAL PIPELINE */}
      {phase === 'unboxing' && createdCard && (
        <UnboxingReveal card={createdCard} onComplete={handleUnboxingComplete} />
      )}
    </div>
  );
};
