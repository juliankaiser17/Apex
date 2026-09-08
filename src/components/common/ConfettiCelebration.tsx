/**
 * APEX — Ultra-Lightweight GPU Composited Confetti Celebration
 * 
 * Replaces heavy HTML5 canvas loops and per-frame CPU JS physics with
 * hardware-accelerated CSS transforms (translate3d/rotate/opacity).
 * 
 * Performance characteristics on Samsung Galaxy A54 5G (Mali-G68 GPU):
 * 1. Zero 2D Canvas context allocation / state thrashing.
 * 2. Strict 18 DOM particle budget.
 * 3. 100% Compositor-thread driven keyframe animations.
 * 4. Zero React re-renders during flight.
 * 5. Automatic DOM detachment on animationend.
 * 6. Respects prefers-reduced-motion.
 */

import React, { useRef, useEffect } from 'react';
import { getPerformanceToggle } from '../../utils/performanceToggles';

const CONFETTI_COLORS = ['#E50914', '#FF5722', '#F59E0B', '#10B981', '#06B6D4', '#FFFFFF'];
const PARTICLE_COUNT = 18;

export interface ConfettiCelebrationRef {
  trigger: () => void;
}

interface ConfettiCelebrationProps {
  onComplete?: () => void;
}

export const ConfettiCelebration = React.forwardRef<ConfettiCelebrationRef, ConfettiCelebrationProps>(
  ({ onComplete }, ref) => {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const isPlayingRef = useRef<boolean>(false);
    const lastTriggerRef = useRef<number>(0);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const trigger = () => {
      if (!getPerformanceToggle('CONFETTI_ENABLED')) {
        onComplete?.();
        return;
      }

      const now = Date.now();
      // Reentrant debounce: drop rapid spam clicks within 1500ms
      if (isPlayingRef.current || now - lastTriggerRef.current < 1500) {
        return;
      }
      lastTriggerRef.current = now;
      isPlayingRef.current = true;

      const container = containerRef.current;
      if (!container) return;

      // Clear any existing children
      container.replaceChildren();

      // Check prefers-reduced-motion
      const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (prefersReduced) {
        isPlayingRef.current = false;
        onComplete?.();
        return;
      }

      const fragment = document.createDocumentFragment();

      for (let i = 0; i < PARTICLE_COUNT; i++) {
        const span = document.createElement('span');
        
        // Compute burst trajectory
        const angle = -Math.PI / 2 + (Math.random() - 0.5) * (Math.PI * 0.85); // Upward cone
        const distance = 100 + Math.random() * 160;
        const tx = Math.cos(angle) * distance;
        const ty = Math.sin(angle) * distance + 50; // gravity drift
        const rot = (Math.random() - 0.5) * 540;
        const color = CONFETTI_COLORS[i % CONFETTI_COLORS.length];
        const width = 6 + Math.floor(Math.random() * 5);
        const height = 10 + Math.floor(Math.random() * 6);
        const delayMs = Math.floor(Math.random() * 60);

        span.className = 'apex-confetti-piece';
        span.style.setProperty('--tx', `${Math.round(tx)}px`);
        span.style.setProperty('--ty', `${Math.round(ty)}px`);
        span.style.setProperty('--rot', `${Math.round(rot)}deg`);
        span.style.setProperty('--color', color);
        span.style.setProperty('--w', `${width}px`);
        span.style.setProperty('--h', `${height}px`);
        span.style.setProperty('--delay', `${delayMs}ms`);

        fragment.appendChild(span);
      }

      container.appendChild(fragment);

      // Clean up after animation finishes (1100ms)
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        if (containerRef.current) {
          containerRef.current.replaceChildren();
        }
        isPlayingRef.current = false;
        onComplete?.();
      }, 1150);
    };

    React.useImperativeHandle(ref, () => ({
      trigger,
    }));

    useEffect(() => {
      return () => {
        isPlayingRef.current = false;
        if (timerRef.current) clearTimeout(timerRef.current);
        if (containerRef.current) containerRef.current.replaceChildren();
      };
    }, []);

    return (
      <>
        {/* Scoped lightweight GPU keyframes */}
        <style>{`
          .apex-confetti-container {
            position: fixed;
            inset: 0;
            pointer-events: none;
            z-index: 60;
            overflow: hidden;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .apex-confetti-piece {
            position: absolute;
            width: var(--w);
            height: var(--h);
            background-color: var(--color);
            border-radius: 2px;
            will-change: transform, opacity;
            animation: apex-confetti-burst 1.1s cubic-bezier(0.22, 1, 0.36, 1) var(--delay) forwards;
          }
          @keyframes apex-confetti-burst {
            0% {
              transform: translate3d(0, 0, 0) rotate(0deg) scale(0.6);
              opacity: 1;
            }
            70% {
              opacity: 1;
            }
            100% {
              transform: translate3d(var(--tx), var(--ty), 0) rotate(var(--rot)) scale(0.85);
              opacity: 0;
            }
          }
          @media (prefers-reduced-motion: reduce) {
            .apex-confetti-piece {
              animation: none !important;
              display: none !important;
            }
          }
        `}</style>
        <div ref={containerRef} className="apex-confetti-container" />
      </>
    );
  }
);

ConfettiCelebration.displayName = 'ConfettiCelebration';
