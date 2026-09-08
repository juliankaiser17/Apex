import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, X, Zap, Trash2, ChevronRight, Compass, Award } from 'lucide-react';
import { useApexStore } from '../../store/useApexStore';
import { sounds } from '../../utils/audio';
import { getPerformanceToggle } from '../../utils/performanceToggles';

export const NotificationCenterModal: React.FC = () => {
  const notificationModalOpen = useApexStore(s => s.notificationModalOpen);
  const setNotificationModalOpen = useApexStore(s => s.setNotificationModalOpen);
  const notifications = useApexStore(s => s.notifications);
  const markNotificationAsRead = useApexStore(s => s.markNotificationAsRead);
  const clearAllNotifications = useApexStore(s => s.clearAllNotifications);
  const setActiveTab = useApexStore(s => s.setActiveTab);
  const setStreakModalOpen = useApexStore(s => s.setStreakModalOpen);

  const [activeFilter, setActiveFilter] = useState<'all' | 'hunts' | 'rewards'>('all');
  const [renderAll, setRenderAll] = useState(false);

  // Staged mounting: render first 8 notifications during slide animation, defer remainder
  useEffect(() => {
    if (notificationModalOpen) {
      const timer = setTimeout(() => setRenderAll(true), 240);
      return () => clearTimeout(timer);
    } else {
      setRenderAll(false);
    }
  }, [notificationModalOpen]);

  const filteredNotifications = useMemo(() => {
    if (!notificationModalOpen) return [];
    if (activeFilter === 'hunts') return notifications.filter(n => n.type === 'hunt');
    if (activeFilter === 'rewards') return notifications.filter(n => n.type === 'reward' || n.type === 'system');
    return notifications;
  }, [notificationModalOpen, notifications, activeFilter]);

  const visibleNotifications = useMemo(() => {
    if (!renderAll && filteredNotifications.length > 8) {
      return filteredNotifications.slice(0, 8);
    }
    return filteredNotifications;
  }, [filteredNotifications, renderAll]);

  const unreadCount = useMemo(() => {
    return notifications.filter(n => !n.read).length;
  }, [notifications]);

  const handleNotificationClick = (item: typeof notifications[0]) => {
    sounds.playTargetLock();
    markNotificationAsRead(item.id);
    setNotificationModalOpen(false);

    // If streak or daily reward notification, directly open Daily Streak & XP claim modal
    if (
      item.id === 'notif-streak-1' || 
      item.type === 'reward' || 
      item.title.toLowerCase().includes('streak') || 
      item.title.toLowerCase().includes('daily')
    ) {
      setStreakModalOpen(true);
      return;
    }

    if (item.actionTab) {
      setActiveTab(item.actionTab);
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'hunt':
        return <Compass className="w-4 h-4 text-[#E50914]" />;
      case 'reward':
        return <Award className="w-4 h-4 text-[#FF4500]" />;
      case 'system':
        return <Zap className="w-4 h-4 text-amber-400" />;
      default:
        return <Bell className="w-4 h-4 text-white/70" />;
    }
  };

  return (
    <AnimatePresence>
      {notificationModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 select-none">
          {/* Lightweight Solid Translucent Backdrop (Zero expensive live blur) */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={() => setNotificationModalOpen(false)}
            className={`absolute inset-0 ${getPerformanceToggle('NOTIFICATION_BACKDROP_ENABLED') ? 'bg-black/85' : 'bg-transparent'}`}
            style={{ willChange: 'opacity' }}
          />

          {/* Modal Sheet Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 15 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="relative w-full max-w-md rounded-3xl bg-[#121212] border border-white/[0.1] shadow-xl p-5 font-sans overflow-hidden flex flex-col max-h-[82vh]"
            style={{ contain: 'paint layout', willChange: 'transform, opacity' }}
          >
          {/* Minimal Clean Header */}
          <div className="flex items-center justify-between pb-3 border-b border-white/[0.08]">
            <div className="flex items-center gap-2.5">
              <div className="w-2 h-2 rounded-full bg-[#E50914]" />
              <h3 className="text-base font-bold text-white tracking-tight">
                Activity & Alerts
              </h3>
              {unreadCount > 0 && (
                <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-[#E50914] text-white">
                  {unreadCount} NEW
                </span>
              )}
            </div>

            <button
              onClick={() => setNotificationModalOpen(false)}
              className="w-7 h-7 rounded-full bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.08] flex items-center justify-center text-white/60 hover:text-white transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Clean Minimal Segmented Tabs */}
          <div className="flex items-center gap-1.5 my-3 p-1 rounded-2xl bg-[#181818] border border-white/[0.06]">
            {[
              { id: 'all' as const, label: 'All Alerts' },
              { id: 'hunts' as const, label: 'Radar Hunts' },
              { id: 'rewards' as const, label: 'Rewards' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => {
                  sounds.playTargetLock();
                  setActiveFilter(tab.id);
                }}
                className={`flex-1 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                  activeFilter === tab.id
                    ? 'bg-[#E50914] text-white shadow-md'
                    : 'text-white/50 hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Clean Notification List */}
          <div className="flex-1 overflow-y-auto space-y-2 pr-1 -mr-1">
            {visibleNotifications.length > 0 ? (
              visibleNotifications.map((n) => (
                <div
                  key={n.id}
                  onClick={() => handleNotificationClick(n)}
                  className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-start gap-3 relative ${
                    !n.read
                      ? 'bg-red-500/[0.08] border-red-500/25 hover:border-red-500/40'
                      : 'bg-[#181818] border-white/[0.06] hover:border-white/[0.12]'
                  }`}
                >
                  <div className={`p-2 rounded-xl shrink-0 mt-0.5 ${
                    !n.read ? 'bg-red-500/20 border border-red-500/30' : 'bg-white/[0.04] border border-white/[0.06]'
                  }`}>
                    {getIcon(n.type)}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <h4 className={`text-xs font-bold truncate ${!n.read ? 'text-white' : 'text-white/80'}`}>
                        {n.title}
                      </h4>
                      <span className="text-[10px] text-white/40 shrink-0 font-data">{n.timestamp}</span>
                    </div>

                    <p className="text-xs text-white/55 mt-0.5 line-clamp-2 leading-relaxed">
                      {n.message}
                    </p>

                    {n.type === 'hunt' && (
                      <div className="mt-2 flex items-center justify-between">
                        <span className="text-[9px] font-bold text-[#E50914] bg-red-500/10 px-2 py-0.5 rounded-md border border-red-500/20 font-data">
                          +{n.xpReward || 750} XP
                        </span>
                        <span className="text-[11px] font-semibold text-[#E50914] flex items-center gap-0.5 hover:underline">
                          View Radar <ChevronRight className="w-3 h-3" />
                        </span>
                      </div>
                    )}
                  </div>

                  {!n.read && (
                    <div className="w-1.5 h-1.5 rounded-full bg-[#E50914] shrink-0 mt-1.5" />
                  )}
                </div>
              ))
            ) : (
              <div className="text-center py-12 text-white/40 space-y-1.5">
                <Bell className="w-6 h-6 mx-auto opacity-30 text-white/40" />
                <p className="text-xs">No alerts in this view.</p>
              </div>
            )}
          </div>

          {/* Footer Actions */}
          {notifications.length > 0 && (
            <div className="pt-3 mt-2 border-t border-white/[0.08] flex items-center justify-between text-xs">
              <button
                onClick={() => {
                  sounds.playTargetLock();
                  clearAllNotifications();
                }}
                className="text-white/40 hover:text-white flex items-center gap-1 transition-colors"
              >
                <Trash2 className="w-3 h-3" /> Clear
              </button>

              <button
                onClick={() => {
                  sounds.playTargetLock();
                  notifications.forEach(n => markNotificationAsRead(n.id));
                }}
                className="text-[#E50914] hover:underline font-semibold"
              >
                Mark all read
              </button>
            </div>
          )}
        </motion.div>
      </div>
      )}
    </AnimatePresence>
  );
};
