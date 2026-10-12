import React from 'react';
import { 
  X, 
  Clock, 
  Camera, 
  ShieldAlert 
} from 'lucide-react';
import type { DailyQuest } from '../../types/apex';
import { hapticTap, hapticSuccess } from '../../utils/haptics';
import { sounds } from '../../utils/audio';

interface TimedQuestConfirmModalProps {
  quest: DailyQuest | null;
  isOpen: boolean;
  onClose: () => void;
  onStartQuest: (questId: string) => void;
}

export const TimedQuestConfirmModal: React.FC<TimedQuestConfirmModalProps> = ({
  quest,
  isOpen,
  onClose,
  onStartQuest
}) => {
  if (!isOpen || !quest) return null;

  const isTimed = Boolean(quest.windowMinutes);
  const tier = quest.tier || 'NORMAL';

  const tierColors = {
    NORMAL: {
      accent: '#10B981',
      badge: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
      gradient: 'from-emerald-500/20 to-transparent'
    },
    HARD: {
      accent: '#F59E0B',
      badge: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
      gradient: 'from-amber-500/20 to-transparent'
    },
    EXTREME: {
      accent: '#EF4444',
      badge: 'bg-red-500/20 text-red-400 border-red-500/30',
      gradient: 'from-red-500/20 to-transparent'
    }
  }[tier] || {
    accent: '#10B981',
    badge: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    gradient: 'from-emerald-500/20 to-transparent'
  };

  const handleStart = () => {
    hapticSuccess();
    sounds.playTargetAcquired();
    onStartQuest(quest.id);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md select-none font-sans">
      <div 
        className="w-full max-w-sm bg-[#111111] border border-white/15 rounded-3xl overflow-hidden shadow-2xl flex flex-col animate-in fade-in zoom-in-95 duration-200"
        style={{ borderColor: `${tierColors.accent}40` }}
      >
        {/* Header Ribbon */}
        <div className={`px-5 py-4 border-b border-white/10 bg-gradient-to-r ${tierColors.gradient} flex items-center justify-between`}>
          <div className="flex items-center gap-2">
            <span className={`text-[10px] font-extrabold uppercase tracking-widest px-2.5 py-0.5 rounded-full border ${tierColors.badge}`}>
              {tier} CHALLENGE
            </span>
            {isTimed && (
              <span className="text-[10px] font-bold text-amber-300 bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 rounded-full flex items-center gap-1 font-mono">
                <Clock className="w-3 h-3" /> {quest.windowMinutes} MINS
              </span>
            )}
          </div>
          <button
            onClick={() => {
              hapticTap();
              onClose();
            }}
            className="p-1.5 rounded-xl text-white/50 hover:text-white hover:bg-white/[0.08] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 space-y-4 text-left">
          <div>
            <h3 className="text-base font-bold text-white tracking-tight leading-snug">
              {quest.title}
            </h3>
            <p className="text-xs text-white/70 mt-1 leading-relaxed">
              {quest.description}
            </p>
          </div>

          {/* Objective Telemetry Box */}
          <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/10 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-white/50 uppercase font-data text-[10px] tracking-wider">Required Target</span>
              <span className="font-bold text-white font-data">
                {quest.targetCount} Verified {quest.targetCount === 1 ? 'Scan' : 'Scans'}
              </span>
            </div>

            {isTimed && (
              <div className="flex items-center justify-between text-xs pt-1 border-t border-white/[0.06]">
                <span className="text-white/50 uppercase font-data text-[10px] tracking-wider">Countdown Window</span>
                <span className="font-bold text-amber-400 font-mono">
                  {quest.windowMinutes} Minutes from Start
                </span>
              </div>
            )}

            <div className="flex items-center justify-between text-xs pt-1 border-t border-white/[0.06]">
              <span className="text-white/50 uppercase font-data text-[10px] tracking-wider">Completion Reward</span>
              <div className="flex items-center gap-2 font-data font-bold">
                <span className="text-emerald-400">+{quest.xpReward} XP</span>
                {quest.coinReward > 0 && (
                  <span className="text-amber-400">+{quest.coinReward} Coins</span>
                )}
              </div>
            </div>
          </div>

          {/* Challenge Advisory */}
          <div className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-200/90 text-[11px] leading-relaxed">
            <ShieldAlert className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
            <span>
              {isTimed
                ? `Tapping start initiates the ${quest.windowMinutes}-minute countdown and opens the camera. A HUD timer will track your progress live!`
                : 'Tapping start opens the camera immediately to begin tracking your objective in the wild.'}
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="p-4 border-t border-white/10 bg-black/40 flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => {
              hapticTap();
              onClose();
            }}
            className="flex-1 py-2.5 rounded-xl border border-white/10 text-xs font-semibold text-white/60 hover:text-white hover:bg-white/[0.04] transition-all"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleStart}
            className="flex-[2] py-2.5 rounded-xl text-xs font-bold text-white shadow-xl flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer"
            style={{ 
              backgroundColor: tierColors.accent, 
              boxShadow: `0 4px 20px ${tierColors.accent}50` 
            }}
          >
            <Camera className="w-4 h-4" />
            <span>{isTimed ? 'START QUEST & OPEN CAMERA' : 'OPEN CAMERA & SPOT'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
