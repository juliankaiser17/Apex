import React, { useState, useMemo } from 'react';
import { Flame, Zap, Settings, Bell, Cpu } from 'lucide-react';
import { useApexStore } from '../../store/useApexStore';
import { getProgressToNextLevel } from '../../utils/mastery';
import { sounds } from '../../utils/audio';
import { AiControlCenterModal } from '../admin/AiControlCenterModal';

export const HeaderBar: React.FC = React.memo(() => {
  // Fine-grained atomic store selectors (Shields HeaderBar from coordinate / garage churn)
  const userCity = useApexStore(s => s.user.city);
  const userLevel = useApexStore(s => s.user.level);
  const userXp = useApexStore(s => s.user.xp);
  const userStreakDays = useApexStore(s => s.user.streakDays);
  const notifications = useApexStore(s => s.notifications);

  const setActiveTab = useApexStore(s => s.setActiveTab);
  const setSettingsModalOpen = useApexStore(s => s.setSettingsModalOpen);
  const setStreakModalOpen = useApexStore(s => s.setStreakModalOpen);
  const setNotificationModalOpen = useApexStore(s => s.setNotificationModalOpen);

  const [isAiControlOpen, setIsAiControlOpen] = useState(false);

  const { level, tierConfig } = useMemo(() => {
    return getProgressToNextLevel(userLevel, userXp);
  }, [userLevel, userXp]);

  const unreadNotifs = useMemo(() => {
    return notifications.filter(n => !n.read).length;
  }, [notifications]);

  return (
    <>
      {/* Top Sleek Mobile Header (Solid high-performance dark surface, zero live blur convolution) */}
      <header className="sticky top-0 z-30 w-full pt-safe border-b border-white/[0.07] bg-[#0c0c0c]/96 select-none font-sans" style={{ willChange: 'transform' }}>
        <div className="px-4 py-2.5">
          <div className="flex items-center justify-between">
            {/* Left: APEX Logo */}
            <div 
              onClick={() => {
                sounds.playTargetLock();
                setActiveTab('home');
              }} 
              className="cursor-pointer flex items-center gap-2 group"
            >
              <div 
                className="w-2 h-2 rounded-full" 
                style={{ backgroundColor: 'var(--accent-color)', boxShadow: '0 0 8px var(--accent-color)' }}
              />
              <span className="text-xl font-bold tracking-tight text-white group-hover:text-white/90 transition-colors">
                APEX
              </span>
              <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-white/[0.06] text-white/60 border border-white/[0.08] ml-0.5">
                {userCity || 'Map'}
              </span>
            </div>

            {/* Right Controls: Streak, Notifications, Level/XP, Settings */}
            <div className="flex items-center gap-1.5">
              {/* Daily Streak Button */}
              <button
                onClick={() => {
                  sounds.playTargetLock();
                  setStreakModalOpen(true);
                }}
                className="flex items-center gap-1 px-2.5 py-1 rounded-full transition-all active:scale-95 group border"
                style={{
                  backgroundColor: 'var(--accent-subtle)',
                  borderColor: 'var(--accent-border)'
                }}
                title="Daily Streak & Rewards"
              >
                <Flame 
                  className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" 
                  style={{ color: 'var(--accent-color)', fill: 'var(--accent-subtle)' }}
                />
                <span className="text-xs font-bold text-white">
                  {userStreakDays || 1}d
                </span>
              </button>

              {/* Notifications Button with Unread Badge */}
              <button
                onClick={() => {
                  sounds.playTargetLock();
                  setNotificationModalOpen(true);
                }}
                className="relative w-8 h-8 rounded-full bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.08] flex items-center justify-center text-white/70 hover:text-white transition-colors active:scale-95"
                title="Notifications & Hunts"
              >
                <Bell className="w-3.5 h-3.5" />
                {unreadNotifs > 0 && (
                  <span 
                    className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-full text-white text-[8px] font-bold flex items-center justify-center border-2 border-black"
                    style={{ backgroundColor: 'var(--accent-color)' }}
                  >
                    {unreadNotifs}
                  </span>
                )}
              </button>

              {/* Level & Mastery Tier Pill */}
              <div className="hidden sm:flex items-center gap-1.5 bg-white/[0.06] border border-white/[0.08] px-2.5 py-1 rounded-full">
                <span className="text-xs font-semibold text-white">Lvl {level}</span>
                <div className="w-1 h-1 rounded-full bg-white/20" />
                <span className={`text-[10px] font-bold tracking-wider uppercase ${tierConfig.textColor}`}>
                  {tierConfig.label}
                </span>
                <div className="w-1 h-1 rounded-full bg-white/20" />
                <Zap className="w-3 h-3" style={{ color: 'var(--accent-color)' }} />
                <span className="text-xs font-semibold text-white/90">
                  {userXp.toLocaleString()} XP
                </span>
              </div>

              {/* AI Fleet Control Center Button */}
              <button
                onClick={() => {
                  sounds.playTargetLock();
                  setIsAiControlOpen(true);
                }}
                className="w-8 h-8 rounded-full border flex items-center justify-center transition-colors active:scale-95 shadow-sm"
                style={{
                  backgroundColor: 'var(--accent-subtle)',
                  borderColor: 'var(--accent-border)',
                  color: 'var(--accent-color)'
                }}
                title="AI Fleet Control Center"
              >
                <Cpu className="w-3.5 h-3.5" />
              </button>

              {/* Profile & Privacy Settings Button */}
              <button
                onClick={() => {
                  sounds.playTargetLock();
                  setSettingsModalOpen(true);
                }}
                className="w-8 h-8 rounded-full bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.08] flex items-center justify-center text-white/70 hover:text-white transition-colors active:scale-95"
                title="Settings & Privacy"
              >
                <Settings className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* AI Fleet Control Center Modal */}
      <AiControlCenterModal
        isOpen={isAiControlOpen}
        onClose={() => setIsAiControlOpen(false)}
      />
    </>
  );
});

HeaderBar.displayName = 'HeaderBar';
