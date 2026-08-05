import React from 'react';
import { Flame, Zap, Settings } from 'lucide-react';
import { useApexStore } from '../../store/useApexStore';
import { getLevelFromXp } from '../../utils/rarity';

export const HeaderBar: React.FC = () => {
  const { user, setActiveTab, setSettingsModalOpen } = useApexStore();
  const { level, progressPercent } = getLevelFromXp(user.xp);

  return (
    <>
      {/* Top HUD Bar — Frosted Glass */}
      <header className="sticky top-0 z-30 w-full backdrop-blur-xl border-b border-white/5"
        style={{ background: 'rgba(8,8,8,0.65)' }}>
        <div className="max-w-md mx-auto px-4 pt-3 pb-5">
          <div className="flex items-center justify-between">
            {/* Left: APEX wordmark (Clickable to go Home) */}
            <div onClick={() => setActiveTab('home')} className="cursor-pointer flex items-center gap-1 group">
              <span className="font-display text-[24px] tracking-[3px] group-hover:text-[#FF4500] transition-colors" style={{ color: '#F0EBE3' }}>
                APEX
              </span>
            </div>

            {/* Center: Streak */}
            {user.streakDays > 0 && (
              <div className="flex items-center gap-1.5">
                <Flame className="w-[18px] h-[18px]" style={{ color: '#FF4500' }} />
                <span className="font-data text-[20px] font-semibold" style={{ color: '#F0EBE3' }}>
                  {user.streakDays}
                </span>
              </div>
            )}

            {/* Right: XP counter & Settings Gear */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <Zap className="w-4 h-4" style={{ color: '#FF4500' }} />
                <span className="font-data text-[16px] font-medium" style={{ color: '#F0EBE3' }}>
                  {user.xp.toLocaleString()}
                </span>
              </div>

              {/* Profile Settings Gear Icon */}
              <button
                onClick={() => setSettingsModalOpen(true)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-[#FF4500]/20 flex items-center justify-center text-[#F0EBE3] hover:text-[#FF4500] transition-colors border border-white/10"
                title="Profile & Privacy Settings"
              >
                <Settings className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* XP Progress Bar — thin, premium */}
      <div className="sticky z-30 w-full" style={{ top: '52px' }}>
        <div className="max-w-md mx-auto relative">
          <div className="h-[3px] w-full" style={{ background: '#2C2C2C' }}>
            <div className="h-full relative transition-all duration-700 ease-out"
              style={{ width: `${progressPercent}%`, background: '#FF4500' }}>
              {/* Leading bright edge */}
              <div className="absolute right-0 top-0 bottom-0 w-[6px]"
                style={{ background: 'rgba(255,255,255,0.8)', borderRadius: '0 2px 2px 0' }} />
            </div>
          </div>
          {/* Level label */}
          <div className="absolute right-4 -bottom-4">
            <span className="text-[10px] font-medium" style={{ color: '#5A5550', fontFamily: 'DM Sans' }}>
              LVL {level}
            </span>
          </div>
        </div>
      </div>
    </>
  );
};
