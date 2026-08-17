import { useState, useCallback, useRef, useEffect } from 'react';
import type { CarCard } from '../types/apex';
import { sounds } from '../utils/audio';

export type ScannerPhase =
  | 'IDLE'
  | 'SEARCHING'
  | 'SCENE_ANALYZING'
  | 'TARGETS_DETECTED'
  | 'TARGET_SELECTED'
  | 'TRACKING'
  | 'TARGET_LOST'
  | 'TARGET_REACQUIRED'
  | 'LOCKING'
  | 'LOCKED'
  | 'ANALYZING'
  | 'IDENTIFYING'
  | 'VERIFYING'
  | 'REVEALING'
  | 'DISCOVERED'
  | 'ALREADY_COLLECTED'
  | 'SYNC_PENDING'
  | 'ERROR';

export interface PipelineStageInfo {
  index: number;
  label: string;
  detail: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
}

export interface ScannerStateMachineResult {
  phase: ScannerPhase;
  createdCard: CarCard | null;
  capturedPhotoUrl: string | null;
  errorMessage: string | null;
  pipelineStages: PipelineStageInfo[];
  currentStageIndex: number;
  
  // Actions
  startSearching: () => void;
  selectTarget: (targetId: string) => void;
  triggerLock: () => void;
  submitForAnalysis: (photoUrl: string) => void;
  onAnalysisStageResolved: (stageIdx: number, detail?: string) => void;
  onIdentificationSuccess: (card: CarCard, isDuplicate?: boolean) => void;
  onIdentificationFailed: (reason: string) => void;
  continueHunting: () => void;
  resetScanner: () => void;
}

const INITIAL_PIPELINE_STAGES: PipelineStageInfo[] = [
  { index: 0, label: 'OPTICAL FEATURES', detail: 'Contours, aero lines, wheel geometry', status: 'pending' },
  { index: 1, label: 'MANUFACTURER IDENTIFICATION', detail: 'Badge & silhouette recognition', status: 'pending' },
  { index: 2, label: 'MODEL SPECIFICATION', detail: 'Engine, horsepower, zero-to-hundred', status: 'pending' },
  { index: 3, label: 'GENERATION & TRIM', detail: 'Body code, aero package, trim tier', status: 'pending' },
  { index: 4, label: 'REGIONAL RARITY & MINT', detail: 'Scarcity validation & collectible mint', status: 'pending' },
];

export function useScannerStateMachine(): ScannerStateMachineResult {
  const [phase, setPhase] = useState<ScannerPhase>('SEARCHING');
  const [createdCard, setCreatedCard] = useState<CarCard | null>(null);
  const [capturedPhotoUrl, setCapturedPhotoUrl] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pipelineStages, setPipelineStages] = useState<PipelineStageInfo[]>(INITIAL_PIPELINE_STAGES);
  const [currentStageIndex, setCurrentStageIndex] = useState<number>(0);

  const lockTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const startSearching = useCallback(() => {
    setPhase('SEARCHING');
    setErrorMessage(null);
    setPipelineStages(INITIAL_PIPELINE_STAGES);
    setCurrentStageIndex(0);
  }, []);

  const selectTarget = useCallback((_targetId: string) => {
    sounds.playTargetAcquired();
    setPhase('TARGET_SELECTED');
    setTimeout(() => {
      setPhase('TRACKING');
    }, 150);
  }, []);

  const triggerLock = useCallback(() => {
    sounds.playFrequencyResonanceLock();
    setPhase('LOCKING');
    
    if (lockTimerRef.current) clearTimeout(lockTimerRef.current);
    lockTimerRef.current = setTimeout(() => {
      sounds.playTargetLock();
      setPhase('LOCKED');
    }, 200);
  }, []);

  const submitForAnalysis = useCallback((photoUrl: string) => {
    setCapturedPhotoUrl(photoUrl);
    setPhase('ANALYZING');
    setCurrentStageIndex(0);
    setPipelineStages(stages => stages.map((s, i) => ({
      ...s,
      status: i === 0 ? 'in_progress' : 'pending'
    })));
  }, []);

  const onAnalysisStageResolved = useCallback((stageIdx: number, detail?: string) => {
    sounds.playPipelineStageComplete();
    setPipelineStages(prev => prev.map((stage, idx) => {
      if (idx === stageIdx) {
        return {
          ...stage,
          status: 'completed',
          detail: detail || stage.detail
        };
      }
      if (idx === stageIdx + 1) {
        return { ...stage, status: 'in_progress' };
      }
      return stage;
    }));
    setCurrentStageIndex(stageIdx + 1);

    if (stageIdx === 1) setPhase('IDENTIFYING');
    if (stageIdx === 3) setPhase('VERIFYING');
  }, []);

  const onIdentificationSuccess = useCallback((card: CarCard, isDuplicate: boolean = false) => {
    setCreatedCard(card);
    setPipelineStages(stages => stages.map(s => ({ ...s, status: 'completed' })));
    setPhase('REVEALING');

    setTimeout(() => {
      sounds.playRarityReveal(card.rarity);
      setPhase(isDuplicate ? 'ALREADY_COLLECTED' : 'DISCOVERED');
    }, 900);
  }, []);

  const onIdentificationFailed = useCallback((reason: string) => {
    setErrorMessage(reason);
    setPhase('ERROR');
  }, []);

  const continueHunting = useCallback(() => {
    sounds.playTargetAcquired();
    setCreatedCard(null);
    setCapturedPhotoUrl(null);
    setErrorMessage(null);
    setPipelineStages(INITIAL_PIPELINE_STAGES);
    setCurrentStageIndex(0);
    setPhase('SEARCHING');
  }, []);

  const resetScanner = useCallback(() => {
    setPhase('IDLE');
    setCreatedCard(null);
    setCapturedPhotoUrl(null);
    setErrorMessage(null);
    setPipelineStages(INITIAL_PIPELINE_STAGES);
    setCurrentStageIndex(0);
  }, []);

  useEffect(() => {
    return () => {
      if (lockTimerRef.current) clearTimeout(lockTimerRef.current);
    };
  }, []);

  return {
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
  };
}
