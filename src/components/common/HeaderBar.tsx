import React, { useMemo } from 'react';
import { useApexStore } from '../../store/useApexStore';
import { getProgressToNextLevel } from '../../utils/mastery';
import { sounds } from '../../utils/audio';
import { hapticTap } from '../../utils/haptics';
import { Header } from '../ui/Header';

export const HeaderBar: React.FC = React.memo(() => {
  const userCity = useApexStore(s => s.user.city);
  const userLevel = useApexStore(s => s.user.level);
  const userXp = useApexStore(s => s.user.xp);
  const userStreakDays = useApexStore(s => s.user.streakDays);
  const notifications = useApexStore(s => s.notifications);

  const setActiveTab = useApexStore(s => s.setActiveTab);
  const setNotificationModalOpen = useApexStore(s => s.setNotificationModalOpen);

  const { level, percentage } = useMemo(() => {
    return getProgressToNextLevel(userLevel, userXp);
  }, [userLevel, userXp]);

  const unreadNotifs = useMemo(() => {
    return notifications.filter(n => !n.read).length;
  }, [notifications]);

  return (
    <Header
      onOpenProfile={() => {
        hapticTap();
        sounds.playTargetLock();
        setActiveTab('profile' as any);
      }}
      onOpenCitySelector={() => {
        hapticTap();
        sounds.playTargetLock();
        setActiveTab('map');
      }}
      onOpenNotifications={() => {
        hapticTap();
        sounds.playTargetLock();
        setNotificationModalOpen(true);
      }}
      currentCity={userCity || 'Lucknow'}
      streakDays={userStreakDays || 1}
      unreadNotificationsCount={unreadNotifs}
      level={level}
      levelProgressPct={Math.round(percentage)}
    />
  );
});

HeaderBar.displayName = 'HeaderBar';
