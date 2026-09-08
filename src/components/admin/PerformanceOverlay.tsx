import React, { useState, useEffect, useRef } from 'react';
import { Activity, Zap, AlertTriangle, ChevronUp } from 'lucide-react';
import { getDevicePerformanceProfile } from '../../utils/performanceMode';
import { getPerformanceToggle, setPerformanceToggle } from '../../utils/performanceToggles';

export const PerformanceOverlay: React.FC = () => {
  const [fps, setFps] = useState(60);
  const [frameTimeMs, setFrameTimeMs] = useState(16.6);
  const [droppedFrames, setDroppedFrames] = useState(0);
  const [memoryMb, setMemoryMb] = useState<number | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isLongFrame, setIsLongFrame] = useState(false);
  const [, setForceUpdate] = useState(0);

  const frameCountRef = useRef(0);
  const lastTimeRef = useRef(performance.now());
  const lastFpsUpdateRef = useRef(performance.now());
  const droppedFramesCountRef = useRef(0);
  const profile = useRef(getDevicePerformanceProfile()).current;

  useEffect(() => {
    let animId: number;

    const tick = (now: number) => {
      const delta = now - lastTimeRef.current;
      lastTimeRef.current = now;
      frameCountRef.current++;

      // Detect dropped frame (> 16.67ms budget)
      if (delta > 18) {
        droppedFramesCountRef.current++;
        setIsLongFrame(true);
        setTimeout(() => setIsLongFrame(false), 200);
      }

      // Update FPS stats every 400ms
      if (now - lastFpsUpdateRef.current >= 400) {
        const elapsedSec = (now - lastFpsUpdateRef.current) / 1000;
        const currentFps = Math.min(120, Math.round(frameCountRef.current / elapsedSec));
        setFps(currentFps);
        setFrameTimeMs(Number((1000 / Math.max(1, currentFps)).toFixed(1)));
        setDroppedFrames(droppedFramesCountRef.current);
        frameCountRef.current = 0;
        lastFpsUpdateRef.current = now;

        // Sample JS Heap Memory if available
        if (typeof window !== 'undefined' && (performance as any).memory) {
          const heap = (performance as any).memory.usedJSHeapSize;
          setMemoryMb(Math.round(heap / (1024 * 1024)));
        }
      }

      animId = requestAnimationFrame(tick);
    };

    animId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animId);
  }, []);

  const getFpsColor = () => {
    if (fps >= 58) return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30';
    if (fps >= 45) return 'text-amber-400 bg-amber-500/10 border-amber-500/30';
    return 'text-red-400 bg-red-500/15 border-red-500/40';
  };

  return (
    <div className="fixed top-12 left-2 z-[9999] font-mono select-none pointer-events-auto">
      {/* Compact Mini Badge */}
      {!isExpanded ? (
        <button
          onClick={() => setIsExpanded(true)}
          className={`flex items-center gap-1.5 px-2 py-0.8 rounded-full border shadow-lg text-[10px] font-bold backdrop-blur-none transition-all ${getFpsColor()} ${
            isLongFrame ? 'ring-2 ring-red-500 animate-pulse' : ''
          }`}
          title="Open Performance HUD"
        >
          <Activity className="w-3 h-3" />
          <span>{fps} FPS</span>
          <span className="text-white/40">·</span>
          <span>{frameTimeMs}ms</span>
          {isLongFrame && <AlertTriangle className="w-2.5 h-2.5 text-red-400 shrink-0" />}
        </button>
      ) : (
        /* Expanded Telemetry Card */
        <div className="w-56 p-2.5 rounded-2xl bg-[#0e0e0e]/95 border border-white/15 shadow-2xl text-[11px] text-white space-y-2">
          <div className="flex items-center justify-between pb-1.5 border-b border-white/10">
            <div className="flex items-center gap-1.5 font-bold text-white/90">
              <Zap className="w-3.5 h-3.5 text-[#E50914]" />
              <span>APEX HUD</span>
              <span className="text-[9px] px-1.5 py-0.2 rounded bg-white/10 text-white/60 uppercase">
                {profile.tier}
              </span>
            </div>
            <button
              onClick={() => setIsExpanded(false)}
              className="p-1 rounded-md text-white/50 hover:text-white"
            >
              <ChevronUp className="w-3 h-3" />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-1.5 text-[10px]">
            <div className="p-1.5 rounded-lg bg-white/[0.04] border border-white/[0.06]">
              <span className="text-white/40 block text-[9px]">FRAME RATE</span>
              <span className={`font-bold text-xs ${fps >= 55 ? 'text-emerald-400' : 'text-amber-400'}`}>
                {fps} FPS
              </span>
            </div>

            <div className="p-1.5 rounded-lg bg-white/[0.04] border border-white/[0.06]">
              <span className="text-white/40 block text-[9px]">FRAME TIME</span>
              <span className={`font-bold text-xs ${frameTimeMs <= 16.7 ? 'text-emerald-400' : 'text-red-400'}`}>
                {frameTimeMs} ms
              </span>
            </div>

            <div className="p-1.5 rounded-lg bg-white/[0.04] border border-white/[0.06]">
              <span className="text-white/40 block text-[9px]">BUDGET FAILS</span>
              <span className={`font-bold text-xs ${droppedFrames > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                {droppedFrames}
              </span>
            </div>

            <div className="p-1.5 rounded-lg bg-white/[0.04] border border-white/[0.06]">
              <span className="text-white/40 block text-[9px]">JS MEMORY</span>
              <span className="font-bold text-xs text-white/80">
                {memoryMb !== null ? `${memoryMb} MB` : 'N/A'}
              </span>
            </div>
          </div>

          {/* Development Performance Toggles */}
          <div className="pt-1.5 border-t border-white/10 space-y-1">
            <div className="text-[9px] font-bold text-white/50 tracking-wider">PROFILING TOGGLES</div>
            <div className="grid grid-cols-2 gap-1 text-[9px]">
              <button
                onClick={() => {
                  const curr = getPerformanceToggle('CONFETTI_ENABLED');
                  setPerformanceToggle('CONFETTI_ENABLED', !curr);
                  setForceUpdate(n => n + 1);
                }}
                className={`px-1.5 py-1 rounded border text-left font-mono ${
                  getPerformanceToggle('CONFETTI_ENABLED')
                    ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400'
                    : 'bg-white/5 border-white/10 text-white/40'
                }`}
              >
                CONFETTI: {getPerformanceToggle('CONFETTI_ENABLED') ? 'ON' : 'OFF'}
              </button>
              <button
                onClick={() => {
                  const curr = getPerformanceToggle('NOTIFICATION_BACKDROP_ENABLED');
                  setPerformanceToggle('NOTIFICATION_BACKDROP_ENABLED', !curr);
                  setForceUpdate(n => n + 1);
                }}
                className={`px-1.5 py-1 rounded border text-left font-mono ${
                  getPerformanceToggle('NOTIFICATION_BACKDROP_ENABLED')
                    ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400'
                    : 'bg-white/5 border-white/10 text-white/40'
                }`}
              >
                BACKDROP: {getPerformanceToggle('NOTIFICATION_BACKDROP_ENABLED') ? 'ON' : 'OFF'}
              </button>
            </div>
          </div>

          <div className="text-[9px] text-white/40 pt-1 border-t border-white/05 flex items-center justify-between">
            <span>Budget: 16.67ms (60 FPS)</span>
            <span className={frameTimeMs <= 16.7 ? 'text-emerald-400' : 'text-red-400'}>
              {frameTimeMs <= 16.7 ? 'STABLE' : 'DROPPING'}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
