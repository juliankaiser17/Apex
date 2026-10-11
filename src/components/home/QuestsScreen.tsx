import React, { useState, useMemo } from 'react';
import { CheckCircle2, Clock, Zap, Flame, ChevronRight, X } from 'lucide-react';
import { useApexStore } from '../../store/useApexStore';
import type { DailyQuest, Mission } from '../../types/apex';
import { sounds } from '../../utils/audio';
import { hapticTap, hapticSuccess } from '../../utils/haptics';
import { ProgressTicks } from '../ui/ProgressTicks';
import { Button } from '../ui/Button';
import { BottomSheet } from '../ui/BottomSheet';

export const QuestsScreen: React.FC<{ isOpen: boolean; onClose: () => void }> = ({
  isOpen,
  onClose,
}) => {
  const dailyQuests = useApexStore(s => s.dailyQuests);
  const dailyMissions = useApexStore(s => s.dailyMissions);
  const setScannerOpen = useApexStore(s => s.setScannerOpen);
  const claimMissionReward = useApexStore(s => s.claimMissionReward);

  const [activeTab, setActiveTab] = useState<'quests' | 'missions'>('quests');
  const [selectedQuest, setSelectedQuest] = useState<DailyQuest | null>(null);
  const [isCompletedCollapsed, setIsCompletedCollapsed] = useState(true);

  // Group Quests: Active vs Completed
  const { normalQuests, hardQuests, extremeQuests, completedQuests } = useMemo(() => {
    const uncompleted = dailyQuests.filter(q => !q.isCompleted);
    const completed = dailyQuests.filter(q => q.isCompleted);

    return {
      normalQuests: uncompleted.filter(q => (q as any).tier === 'NORMAL' || !(q as any).tier),
      hardQuests: uncompleted.filter(q => (q as any).tier === 'HARD'),
      extremeQuests: uncompleted.filter(q => (q as any).tier === 'EXTREME'),
      completedQuests: completed,
    };
  }, [dailyQuests]);

  const handleMissionClick = async (m: Mission) => {
    if (m.completed) return;
    hapticTap();
    sounds.playTargetLock();

    if (m.type === 'login') {
      const res = await claimMissionReward(m.id);
      if (res.success) {
        hapticSuccess();
        sounds.playXpPop();
      }
    } else {
      onClose();
      setScannerOpen(true);
    }
  };

  const renderQuestRow = (quest: DailyQuest) => {
    return (
      <div
        key={quest.id}
        onClick={() => {
          hapticTap();
          sounds.playTargetLock();
          setSelectedQuest(quest);
        }}
        className={`p-3.5 rounded-[var(--radius-panel)] border border-[var(--color-line)] transition-all cursor-pointer select-none ${
          quest.isCompleted
            ? 'bg-[var(--color-panel)]/40 opacity-70'
            : 'bg-[var(--color-panel)] hover:border-[var(--color-text-3)] active:scale-[0.99]'
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1.5 flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-semibold text-[var(--color-text-3)] uppercase tracking-wider">
                {(quest as any).tier || 'Normal'}
              </span>
              {(quest as any).targetCity && (
                <span className="text-[10px] font-mono text-[var(--color-text-3)] px-1.5 py-0.5 rounded-[var(--radius-chip)] bg-[var(--color-panel-2)] border border-[var(--color-line)]">
                  {(quest as any).targetCity}
                </span>
              )}
              {(quest as any).windowMinutes && (
                <span className="text-[10px] font-mono text-amber-300 px-1.5 py-0.5 rounded-[var(--radius-chip)] bg-amber-500/10 border border-amber-500/20 flex items-center gap-1">
                  <Clock size={10} /> {(quest as any).windowMinutes}m
                </span>
              )}
            </div>

            <h4 className="text-secondary font-bold text-[var(--color-text)] truncate">
              {quest.title}
            </h4>
            <p className="text-caption text-[var(--color-text-3)] line-clamp-1">
              {quest.description}
            </p>

            <div className="pt-1">
              <ProgressTicks
                current={quest.currentCount}
                total={quest.targetCount}
                label="Target"
              />
            </div>
          </div>

          <div className="text-right shrink-0">
            <span className="font-mono text-secondary font-bold text-[var(--color-xp)] tabular-nums block">
              +{quest.xpReward} XP
            </span>
            {quest.coinReward > 0 && (
              <span className="font-mono text-caption text-[var(--color-text-3)] tabular-nums block">
                +{quest.coinReward} Coins
              </span>
            )}
            {quest.isCompleted && (
              <span className="text-[10px] font-bold text-[var(--color-ok)] uppercase tracking-wider mt-1 block">
                Done
              </span>
            )}
          </div>
        </div>
      </div>
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-[var(--color-void)] text-[var(--color-text)] flex flex-col font-sans select-none overflow-hidden">
      {/* Top Header */}
      <div className="sticky top-0 z-40 bg-[var(--color-void)]/95 backdrop-blur-md border-b border-[var(--color-line)] pt-safe px-4 py-3 flex items-center justify-between">
        <div>
          <h2 className="font-display text-display-l text-[var(--color-text)] uppercase leading-none">
            Quests & Missions
          </h2>
          <p className="font-mono text-caption text-[var(--color-text-3)] mt-0.5">
            Authoritative Spotting Objectives
          </p>
        </div>
        <button
          onClick={onClose}
          aria-label="Close quests"
          className="w-9 h-9 rounded-full bg-[var(--color-panel-2)] border border-[var(--color-line)] flex items-center justify-center text-[var(--color-text-2)] hover:text-[var(--color-text)] cursor-pointer"
        >
          <X size={18} />
        </button>
      </div>

      {/* Segmented Switcher: Quests vs Daily Missions */}
      <div className="px-4 pt-3 pb-2 shrink-0 max-w-lg mx-auto w-full">
        <div className="flex bg-[var(--color-panel-2)] p-1 rounded-[var(--radius-button)] border border-[var(--color-line)]">
          <button
            onClick={() => setActiveTab('quests')}
            className={`flex-1 py-2 text-secondary font-semibold rounded-[var(--radius-chip)] transition-all cursor-pointer ${
              activeTab === 'quests'
                ? 'bg-[var(--color-panel)] text-[var(--color-text)] shadow-sm'
                : 'text-[var(--color-text-3)] hover:text-[var(--color-text)]'
            }`}
          >
            Quests ({dailyQuests.length})
          </button>
          <button
            onClick={() => setActiveTab('missions')}
            className={`flex-1 py-2 text-secondary font-semibold rounded-[var(--radius-chip)] transition-all cursor-pointer ${
              activeTab === 'missions'
                ? 'bg-[var(--color-panel)] text-[var(--color-text)] shadow-sm'
                : 'text-[var(--color-text-3)] hover:text-[var(--color-text)]'
            }`}
          >
            Daily Missions ({dailyMissions.filter(m => m.completed).length}/{dailyMissions.length})
          </button>
        </div>
      </div>

      {/* Content Viewport */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-6 max-w-lg mx-auto w-full pb-28 no-scrollbar">
        {activeTab === 'quests' ? (
          <div className="space-y-6">
            {/* Normal Tier */}
            {normalQuests.length > 0 && (
              <div className="space-y-2.5">
                <div className="flex items-center gap-1.5 text-caption font-semibold text-[var(--color-text-3)] uppercase tracking-wider">
                  <CheckCircle2 size={13} className="text-[var(--color-ok)]" />
                  <span>Normal Objectives ({normalQuests.length})</span>
                </div>
                <div className="space-y-2.5">{normalQuests.map(renderQuestRow)}</div>
              </div>
            )}

            {/* Hard Tier */}
            {hardQuests.length > 0 && (
              <div className="space-y-2.5">
                <div className="flex items-center gap-1.5 text-caption font-semibold text-[var(--color-text-3)] uppercase tracking-wider">
                  <Zap size={13} className="text-amber-400" />
                  <span>Hard Objectives ({hardQuests.length})</span>
                </div>
                <div className="space-y-2.5">{hardQuests.map(renderQuestRow)}</div>
              </div>
            )}

            {/* Extreme Tier */}
            {extremeQuests.length > 0 && (
              <div className="space-y-2.5">
                <div className="flex items-center gap-1.5 text-caption font-semibold text-[var(--color-text-3)] uppercase tracking-wider">
                  <Flame size={13} className="text-[var(--color-danger)]" />
                  <span>Extreme Objectives ({extremeQuests.length})</span>
                </div>
                <div className="space-y-2.5">{extremeQuests.map(renderQuestRow)}</div>
              </div>
            )}

            {/* Completed Quests Collapsible (Sink to bottom per Section 6.2) */}
            {completedQuests.length > 0 && (
              <div className="space-y-2.5 pt-2 border-t border-[var(--color-line)]">
                <button
                  onClick={() => setIsCompletedCollapsed(prev => !prev)}
                  className="w-full flex items-center justify-between text-caption font-semibold text-[var(--color-text-3)] uppercase tracking-wider py-1 cursor-pointer"
                >
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 size={13} className="text-[var(--color-ok)]" />
                    <span>Completed Quests ({completedQuests.length})</span>
                  </div>
                  <ChevronRight
                    size={14}
                    className={`transition-transform duration-200 ${
                      isCompletedCollapsed ? '' : 'rotate-90'
                    }`}
                  />
                </button>

                {!isCompletedCollapsed && (
                  <div className="space-y-2.5">{completedQuests.map(renderQuestRow)}</div>
                )}
              </div>
            )}
          </div>
        ) : (
          /* Daily Missions */
          <div className="space-y-2.5">
            {dailyMissions.map((mission) => (
              <div
                key={mission.id}
                onClick={() => handleMissionClick(mission)}
                className={`p-3.5 rounded-[var(--radius-panel)] border border-[var(--color-line)] flex items-center justify-between transition-all cursor-pointer ${
                  mission.completed
                    ? 'bg-[var(--color-panel)]/40 opacity-60'
                    : 'bg-[var(--color-panel)] hover:border-[var(--color-text-3)] active:scale-[0.99]'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-5 h-5 rounded-full flex items-center justify-center border ${
                      mission.completed
                        ? 'border-[var(--color-ok)] bg-[var(--color-ok)]/20 text-[var(--color-ok)]'
                        : 'border-[var(--color-line)] text-transparent'
                    }`}
                  >
                    <CheckCircle2 size={12} className={mission.completed ? 'opacity-100' : 'opacity-0'} />
                  </div>
                  <div>
                    <span
                      className={`text-secondary font-semibold ${
                        mission.completed ? 'line-through text-[var(--color-text-3)]' : 'text-[var(--color-text)]'
                      }`}
                    >
                      {mission.title}
                    </span>
                  </div>
                </div>

                <span className="font-mono text-secondary font-bold text-[var(--color-xp)] tabular-nums">
                  +{mission.xpReward} XP
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quest Detail BottomSheet */}
      <BottomSheet
        isOpen={selectedQuest !== null}
        onClose={() => setSelectedQuest(null)}
        title={selectedQuest?.title}
      >
        {selectedQuest && (
          <div className="space-y-4">
            <p className="text-secondary text-[var(--color-text-2)] leading-relaxed">
              {selectedQuest.description}
            </p>

            <div className="bg-[var(--color-panel-2)] p-4 rounded-[var(--radius-panel)] border border-[var(--color-line)] space-y-3">
              <ProgressTicks
                current={selectedQuest.currentCount}
                total={selectedQuest.targetCount}
                label="Required Count"
              />

              <div className="flex items-center justify-between pt-2 border-t border-[var(--color-line)] font-mono text-secondary">
                <span className="text-[var(--color-text-3)] font-sans">Reward</span>
                <span className="font-bold text-[var(--color-xp)]">
                  +{selectedQuest.xpReward} XP {selectedQuest.coinReward > 0 ? `+ ${selectedQuest.coinReward} Coins` : ''}
                </span>
              </div>
            </div>

            <Button
              variant="primary"
              className="w-full"
              onClick={() => {
                setSelectedQuest(null);
                onClose();
                setScannerOpen(true);
              }}
            >
              Scan Vehicles for Objective
            </Button>
          </div>
        )}
      </BottomSheet>
    </div>
  );
};

QuestsScreen.displayName = 'QuestsScreen';
