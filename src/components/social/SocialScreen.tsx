import React, { useState, useEffect, useMemo } from 'react';
import { 
  Flame, 
  Trophy, 
  Users, 
  User, 
  Zap, 
  Crown, 
  Award, 
  Search, 
  Target, 
  Flag, 
  Globe, 
  UserPlus, 
  X, 
  Check, 
  UserCheck, 
  AlertCircle,
  Clock,
  Plus
} from 'lucide-react';
import { useApexStore, SAMPLE_FEED_POSTS } from '../../store/useApexStore';
import type { FeedPost, CarCard, LeaderboardEntry } from '../../types/apex';
import { Card3DDetail } from '../garage/Card3DDetail';
import { CommentsModal } from './CommentsModal';
import { PaperThrowFeed } from './PaperThrowFeed';
import { MediaPostComposerModal } from './MediaPostComposerModal';
import { PublicProfileModal } from '../profile/PublicProfileModal';
import { DirectMessageModal } from './DirectMessageModal';
import { sounds } from '../../utils/audio';
import { getProgressToNextLevel } from '../../utils/mastery';

export const SocialScreen: React.FC = () => {
  const user = useApexStore(s => s.user);
  const garage = useApexStore(s => s.garage);
  const feedPosts = useApexStore(s => s.feedPosts);
  const leaderboards = useApexStore(s => s.leaderboards);
  const badges = useApexStore(s => s.badges);
  const friends = useApexStore(s => s.friends);
  const removeFriend = useApexStore(s => s.removeFriend);
  const setScannerOpen = useApexStore(s => s.setScannerOpen);
  const incomingRequests = useApexStore(s => s.incomingRequests);
  const outgoingRequests = useApexStore(s => s.outgoingRequests);
  const fetchFriendRequests = useApexStore(s => s.fetchFriendRequests);
  const sendFriendRequest = useApexStore(s => s.sendFriendRequest);
  const acceptFriendRequest = useApexStore(s => s.acceptFriendRequest);
  const denyFriendRequest = useApexStore(s => s.denyFriendRequest);
  const cancelFriendRequest = useApexStore(s => s.cancelFriendRequest);

  const [subTab, setSubTab] = useState<'activity' | 'leaderboard' | 'friends' | 'profile'>('activity');
  const [selectedCard, setSelectedCard] = useState<CarCard | null>(null);
  const [selectedPostForComments, setSelectedPostForComments] = useState<FeedPost | null>(null);
  const [leaderboardFilter, setLeaderboardFilter] = useState<'global' | 'city' | 'country' | 'friends'>('global');
  const [friendSearch, setFriendSearch] = useState('');
  
  // New Social Flow States
  const [isMediaComposerOpen, setIsMediaComposerOpen] = useState(false);
  const [selectedUserForProfile, setSelectedUserForProfile] = useState<{ userId?: string; username?: string } | null>(null);
  const [activeConversationUser, setActiveConversationUser] = useState<{ id: string; username: string; displayName: string; avatarUrl: string; level: number } | null>(null);

  // Add Friend Modal State
  const [isAddFriendModalOpen, setIsAddFriendModalOpen] = useState(false);
  const [targetUsernameInput, setTargetUsernameInput] = useState('');
  const [friendModalFeedback, setFriendModalFeedback] = useState<{ type: 'success' | 'error' | ''; message: string }>({ type: '', message: '' });
  const [isSearchingFriend, setIsSearchingFriend] = useState(false);

  // Filter leaderboard by scope (Global, City, Country, Friends)
  const filteredLeaderboard = useMemo(() => {
    let list = [...leaderboards];

    if (leaderboardFilter === 'friends') {
      const friendHandles = new Set(friends.map(f => f.username.toLowerCase()));
      list = list.filter(entry => 
        entry.isUser || 
        entry.username.toLowerCase() === (user.username || '').toLowerCase() || 
        friendHandles.has(entry.username.toLowerCase())
      );
    } else if (leaderboardFilter === 'city') {
      const userCity = (user.city || '').toLowerCase();
      if (userCity) {
        list = list.filter(entry => (entry.city || '').toLowerCase() === userCity || entry.isUser);
      }
    } else if (leaderboardFilter === 'country') {
      const userCountry = (user.country || '').toLowerCase();
      if (userCountry) {
        list = list.filter(entry => (entry.country || '').toLowerCase() === userCountry || entry.isUser);
      }
    }

    return list.map((entry, idx) => ({
      ...entry,
      scopedRank: idx + 1,
      isFriend: friends.some(f => f.username.toLowerCase() === entry.username.toLowerCase())
    }));
  }, [leaderboards, leaderboardFilter, user.city, user.country, user.username, friends]);

  // Poll / refresh friend requests when opening friends tab
  useEffect(() => {
    fetchFriendRequests();
  }, [subTab, fetchFriendRequests]);

  const handleSendFriendRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanHandle = targetUsernameInput.trim().replace(/^@/, '').toLowerCase();
    if (!cleanHandle) return;

    sounds.playTargetLock();
    setIsSearchingFriend(true);
    setFriendModalFeedback({ type: '', message: '' });

    try {
      const res = await sendFriendRequest(cleanHandle);
      if (res.success) {
        sounds.playXpPop();
        setFriendModalFeedback({ type: 'success', message: res.message });
        setTargetUsernameInput('');
        setTimeout(() => {
          setIsAddFriendModalOpen(false);
          setFriendModalFeedback({ type: '', message: '' });
        }, 2200);
      } else {
        setFriendModalFeedback({ type: 'error', message: res.message });
      }
    } catch (err: any) {
      setFriendModalFeedback({ 
        type: 'error', 
        message: err?.message || `Failed to send friend request to @${cleanHandle}.` 
      });
    } finally {
      setIsSearchingFriend(false);
    }
  };

  // ─── 1. FULL-SCREEN DISCOVERY FEED (SUB-TAB: ACTIVITY) ───
  if (subTab === 'activity') {
    const activeFeedPosts = (feedPosts && feedPosts.length > 0) ? feedPosts : SAMPLE_FEED_POSTS;
    return (
      <div className="fixed inset-0 top-[calc(var(--sat,28px)+54px)] bottom-[74px] z-10 w-full bg-black overflow-hidden select-none font-sans">
        {/* Floating Top 4-Way Segmented Navigation Bar + New Post + Button */}
        <div className="absolute top-2.5 left-3 right-3 z-50 max-w-sm mx-auto flex items-center gap-2">
          <div className="flex-1 flex bg-black/85 backdrop-blur-2xl p-1 rounded-2xl border border-white/20 shadow-2xl">
            {[
              { id: 'activity', label: 'Activity', icon: Flame, badge: 0 },
              { id: 'leaderboard', label: 'Ranks', icon: Trophy, badge: 0 },
              { id: 'friends', label: 'Friends', icon: Users, badge: incomingRequests.length },
              { id: 'profile', label: 'Profile', icon: User, badge: 0 },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = subTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    sounds.playTargetLock();
                    setSubTab(tab.id as any);
                  }}
                  className={`flex-1 py-1.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all relative active:scale-95 ${
                    isActive
                      ? 'text-white shadow-lg font-bold'
                      : 'text-white/60 hover:text-white'
                  }`}
                  style={isActive ? {
                    backgroundColor: 'var(--accent-color)',
                    boxShadow: '0 2px 12px var(--accent-glow)'
                  } : undefined}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{tab.label}</span>
                  {tab.badge > 0 && (
                    <span 
                      className="w-4 h-4 rounded-full bg-white text-[9px] font-bold flex items-center justify-center"
                      style={{ color: 'var(--accent-color)' }}
                    >
                      {tab.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* + Button for Standalone Media Post Creation */}
          <button
            onClick={() => {
              sounds.playTargetLock();
              setIsMediaComposerOpen(true);
            }}
            aria-label="Create Post"
            className="w-10 h-10 rounded-2xl flex items-center justify-center text-white shadow-xl active:scale-90 transition-all border border-white/20 shrink-0 hover:scale-105"
            style={{
              backgroundColor: 'var(--accent-color)',
              boxShadow: '0 2px 14px var(--accent-glow)'
            }}
            title="Create Post"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>

        {/* Full-Screen Reels Discovery Feed */}
        <PaperThrowFeed
          posts={activeFeedPosts}
          onOpenCardDetail={(card) => setSelectedCard(card)}
          onOpenComments={(post) => setSelectedPostForComments(post)}
          onOpenProfile={(userId, username) => setSelectedUserForProfile({ userId, username })}
          onOpenScanner={() => setScannerOpen(true)}
        />

        {/* Global 3D Detail Modal */}
        <Card3DDetail
          card={selectedCard}
          onClose={() => setSelectedCard(null)}
        />

        {/* Global Comments Modal */}
        <CommentsModal
          post={selectedPostForComments}
          onClose={() => setSelectedPostForComments(null)}
          onOpenProfile={(userId, username) => setSelectedUserForProfile({ userId, username })}
        />

        {/* Media Post Composer Modal */}
        <MediaPostComposerModal
          isOpen={isMediaComposerOpen}
          onClose={() => setIsMediaComposerOpen(false)}
        />

        {/* Public Profile Modal */}
        <PublicProfileModal
          userId={selectedUserForProfile?.userId}
          username={selectedUserForProfile?.username}
          isOpen={Boolean(selectedUserForProfile)}
          onClose={() => setSelectedUserForProfile(null)}
          onOpenConversation={(recipient) => setActiveConversationUser(recipient)}
          onOpenCardDetail={(card) => setSelectedCard(card)}
        />

        {/* Direct Message Modal */}
        <DirectMessageModal
          recipient={activeConversationUser}
          isOpen={Boolean(activeConversationUser)}
          onClose={() => setActiveConversationUser(null)}
          onOpenProfile={(userId, username) => setSelectedUserForProfile({ userId, username })}
        />
      </div>
    );
  }

  // ─── 2. STANDARD SCROLLABLE VIEW (LEADERBOARD / FRIENDS / PROFILE) ───
  return (
    <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 pb-28 font-sans max-w-md mx-auto">
      {/* Top 4-Way Segmented Tabs + New Post Button */}
      <div className="flex items-center gap-2">
        <div className="flex-1 flex bg-[#141414] p-1 rounded-2xl border border-white/[0.08]">
          {[
            { id: 'activity', label: 'Activity', icon: Flame, badge: 0 },
            { id: 'leaderboard', label: 'Ranks', icon: Trophy, badge: 0 },
            { id: 'friends', label: 'Friends', icon: Users, badge: incomingRequests.length },
            { id: 'profile', label: 'Profile', icon: User, badge: 0 },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = subTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setSubTab(tab.id as any)}
                className={`flex-1 py-2 rounded-xl text-xs font-medium flex items-center justify-center gap-1.5 transition-colors relative ${
                  isActive
                    ? 'text-white font-semibold'
                    : 'text-white/50 hover:text-white'
                }`}
                style={isActive ? {
                  backgroundColor: 'var(--accent-color)',
                  boxShadow: '0 2px 10px var(--accent-glow)'
                } : undefined}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
                {tab.badge > 0 && (
                  <span 
                    className="w-4 h-4 rounded-full bg-white text-[9px] font-bold flex items-center justify-center"
                    style={{ color: 'var(--accent-color)' }}
                  >
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* + Button for Standalone Media Post Creation */}
        <button
          onClick={() => {
            sounds.playTargetLock();
            setIsMediaComposerOpen(true);
          }}
          aria-label="Create Post"
          className="w-10 h-10 rounded-2xl flex items-center justify-center text-white shadow-xl active:scale-90 transition-all border border-white/20 shrink-0 hover:scale-105"
          style={{
            backgroundColor: 'var(--accent-color)',
            boxShadow: '0 2px 14px var(--accent-glow)'
          }}
          title="Create Post"
        >
          <Plus className="w-5 h-5" />
        </button>
      </div>

      {/* SUB-TAB 2: LEADERBOARD */}
      {subTab === 'leaderboard' && (
        <div className="space-y-4">
          {/* Leaderboard Scope Filters */}
          <div className="grid grid-cols-4 gap-1.5">
            {[
              { id: 'global', label: 'Global' },
              { id: 'city', label: user.city || 'City' },
              { id: 'country', label: user.country || 'Country' },
              { id: 'friends', label: `Friends (${friends.length})` }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setLeaderboardFilter(tab.id as any)}
                className={`py-2 px-1 rounded-lg text-[11px] font-data uppercase border transition-all text-center truncate ${
                  leaderboardFilter === tab.id 
                    ? 'bg-black/60 text-[#FFA500] border-[#FFA500]/60 font-bold shadow-[0_0_12px_rgba(255,165,0,0.2)]' 
                    : 'bg-[#111111] text-[#9A9088] border-white/10 hover:border-white/20'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="bg-[#111111] border border-white/10 rounded-xl p-3 space-y-2">
            {filteredLeaderboard.length === 0 ? (
              <div className="text-center py-8 text-[#9A9088] font-data text-xs space-y-2">
                <p>No spotters in this ranking yet.</p>
                {leaderboardFilter === 'friends' && (
                  <p className="text-[11px] text-[#FF4500]">
                    Add friends in the Friends tab to compete against them!
                  </p>
                )}
              </div>
            ) : (
              filteredLeaderboard.map((entry: LeaderboardEntry & { scopedRank: number; isFriend?: boolean }) => {
                const isMe = entry.isUser || entry.username.toLowerCase() === (user.username || '').toLowerCase();
                return (
                  <div
                    key={entry.username}
                    onClick={() => {
                      if (!isMe) {
                        sounds.playTargetLock();
                        setSelectedUserForProfile({ username: entry.username });
                      }
                    }}
                    className={`p-3 rounded-lg flex items-center justify-between border transition-all ${
                      isMe 
                        ? 'bg-black/60 border-[#FF4500] glow-orange' 
                        : 'bg-black/20 border-white/5 hover:border-white/15 cursor-pointer active:scale-[0.99]'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className={`font-display text-lg w-6 text-center ${
                        entry.scopedRank === 1 ? 'text-[#FFA500] font-bold' :
                        entry.scopedRank === 2 ? 'text-[#F0EBE3]' :
                        entry.scopedRank === 3 ? 'text-[#E8A020]' : 'text-[#5A5550]'
                      }`}>
                        #{entry.scopedRank}
                      </span>

                      <img src={entry.avatarUrl} alt={entry.displayName} className="w-10 h-10 rounded-full object-cover border border-[#2C2C2C]" />

                      <div>
                        <h4 className="text-sm font-semibold text-[#F0EBE3] flex items-center gap-1.5">
                          {entry.displayName} 
                          {isMe && <span className="text-[10px] text-[#FF4500] font-data font-semibold">(YOU)</span>}
                          {entry.isFriend && !isMe && (
                            <span className="text-[9px] bg-[#3B82F6]/20 text-[#60A5FA] border border-[#3B82F6]/40 px-1.5 py-0.5 rounded font-data font-semibold">
                              FRIEND
                            </span>
                          )}
                        </h4>
                        <p className="text-[10px] text-[#9A9088] font-data">
                          Level {entry.level} · {entry.city || 'Global'} · Rarest: {entry.rarestCard}
                        </p>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="text-sm font-data font-semibold text-[#FF4500] block">{entry.xp.toLocaleString()} XP</span>
                      <span className="text-[9px] font-data text-[#2ECC71]">Rank #{entry.scopedRank}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* SUB-TAB 3: FRIENDS & FRIEND REQUESTS */}
      {subTab === 'friends' && (
        <div className="space-y-4">
          {/* Top action bar: Filter + Add Friend Button */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9A9088]" />
              <input
                type="text"
                placeholder="Filter your friends list..."
                value={friendSearch}
                onChange={(e) => setFriendSearch(e.target.value)}
                className="w-full bg-[#111111] border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-xs text-[#F0EBE3] placeholder-[#5A5550] focus:border-[#FF4500] outline-none font-data"
              />
            </div>
            <button
              onClick={() => {
                sounds.playTargetLock();
                setIsAddFriendModalOpen(true);
              }}
              className="px-4 py-2.5 rounded-xl bg-[#FF4500] text-white font-data text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 shadow-[0_0_12px_rgba(255,69,0,0.3)] hover:bg-[#FF5500] transition-colors shrink-0"
            >
              <UserPlus className="w-4 h-4" /> ADD FRIEND
            </button>
          </div>

          {/* 1. INCOMING FRIEND REQUESTS SECTION */}
          {incomingRequests.length > 0 && (
            <div className="p-4 rounded-2xl bg-[#141414] border border-[#FF4500]/40 space-y-3 shadow-[0_0_20px_rgba(255,69,0,0.15)]">
              <div className="flex items-center justify-between pb-1 border-b border-white/10">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-[#FF4500]/20 flex items-center justify-center text-[#FF4500]">
                    <Users className="w-3.5 h-3.5" />
                  </div>
                  <h4 className="font-display text-sm text-[#F0EBE3] tracking-wide">
                    INCOMING FRIEND REQUESTS ({incomingRequests.length})
                  </h4>
                </div>
                <span className="text-[10px] font-data text-[#FF4500] font-semibold uppercase">Action Required</span>
              </div>

              <div className="space-y-2.5">
                {incomingRequests.map((req) => (
                  <div 
                    key={req.id}
                    className="p-3 rounded-xl bg-[#0D0D0D] border border-white/10 flex items-center justify-between gap-3"
                  >
                    <div 
                      onClick={() => {
                        sounds.playTargetLock();
                        setSelectedUserForProfile({ userId: req.fromUserId, username: req.fromUsername });
                      }}
                      className="flex items-center gap-2.5 min-w-0 cursor-pointer group"
                    >
                      <img
                        src={req.fromAvatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=400'}
                        alt={req.fromUsername}
                        className="w-10 h-10 rounded-full object-cover border border-[#FF4500]/60 group-hover:border-white transition-colors shrink-0"
                      />
                      <div className="min-w-0">
                        <h5 className="text-xs font-semibold text-[#F0EBE3] group-hover:text-[#FF4500] transition-colors truncate">
                          {req.fromDisplayName || req.fromUsername}
                        </h5>
                        <p className="text-[10px] font-data text-[#9A9088] truncate">
                          @{req.fromUsername} · Level {req.fromLevel}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={async () => {
                          await acceptFriendRequest(req.id);
                        }}
                        className="px-3 py-1.5 rounded-xl bg-[#2ECC71] hover:bg-[#27ae60] text-black font-data text-xs font-bold flex items-center gap-1 shadow-md transition-colors"
                      >
                        <Check className="w-3.5 h-3.5" /> Accept
                      </button>
                      <button
                        onClick={async () => {
                          sounds.playTargetLock();
                          await denyFriendRequest(req.id);
                        }}
                        className="px-2.5 py-1.5 rounded-xl bg-[#1F1F1F] hover:bg-rose-950/60 border border-white/10 hover:border-rose-600/50 text-[#9A9088] hover:text-rose-300 font-data text-xs transition-colors"
                      >
                        <X className="w-3.5 h-3.5" /> Deny
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 2. PENDING SENT REQUESTS SECTION */}
          {outgoingRequests.length > 0 && (
            <div className="p-3.5 rounded-2xl bg-[#111111] border border-white/10 space-y-2.5">
              <div className="flex items-center gap-2 pb-1 border-b border-white/5">
                <Clock className="w-3.5 h-3.5 text-[#9A9088]" />
                <h5 className="font-display text-xs text-[#9A9088] tracking-wider uppercase">
                  SENT REQUESTS PENDING ({outgoingRequests.length})
                </h5>
              </div>
              <div className="space-y-1.5">
                {outgoingRequests.map((req) => (
                  <div
                    key={req.id}
                    className="p-2.5 rounded-xl bg-black/40 border border-white/5 flex items-center justify-between text-xs"
                  >
                    <div>
                      <span className="text-[#F0EBE3] font-semibold">@{req.toUsername}</span>
                      <span className="text-[10px] text-[#9A9088] font-data ml-2">Waiting for approval</span>
                    </div>
                    <button
                      onClick={async () => {
                        sounds.playTargetLock();
                        await cancelFriendRequest(req.id);
                      }}
                      className="text-[10px] font-data text-rose-400 hover:text-rose-300 px-2 py-0.5 rounded bg-rose-950/20 border border-rose-900/40"
                    >
                      Cancel
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 3. CONFIRMED FRIENDS LIST */}
          <div className="space-y-2">
            <div className="flex items-center justify-between px-1">
              <span className="text-[11px] font-data font-semibold text-[#9A9088] uppercase tracking-wider">
                MY FRIENDS ({friends.length})
              </span>
            </div>

            {friends.length > 0 ? (
              <div className="space-y-2">
                {friends
                  .filter(f => f.username.toLowerCase().includes(friendSearch.toLowerCase()) || f.displayName.toLowerCase().includes(friendSearch.toLowerCase()))
                  .map((friend) => (
                    <div
                      key={friend.username}
                      className="p-3 rounded-2xl bg-[#111111] border border-white/10 flex items-center justify-between shadow-lg"
                    >
                      <div 
                        onClick={() => {
                          sounds.playTargetLock();
                          setSelectedUserForProfile({ userId: friend.id, username: friend.username });
                        }}
                        className="flex items-center gap-3 cursor-pointer group"
                      >
                        <img
                          src={friend.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=400'}
                          alt={friend.username}
                          className="w-10 h-10 rounded-full object-cover border border-[#FF4500]/60 group-hover:border-white transition-colors"
                        />
                        <div>
                          <h4 className="text-xs font-semibold text-[#F0EBE3] group-hover:text-[#FF4500] transition-colors">{friend.displayName}</h4>
                          <p className="text-[10px] font-data text-[#9A9088]">
                            @{friend.username} · Level {friend.level} {friend.city ? `· ${friend.city}` : ''}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-data text-[#2ECC71] bg-[#2ECC71]/10 px-2 py-0.5 rounded border border-[#2ECC71]/30 font-semibold flex items-center gap-1">
                          <Check className="w-3 h-3" /> FRIEND
                        </span>
                        <button
                          onClick={() => {
                            if (window.confirm(`Remove @${friend.username} from your friends?`)) {
                              sounds.playTargetLock();
                              removeFriend(friend.username);
                            }
                          }}
                          className="text-[10px] font-data text-rose-400 hover:text-rose-300 p-1"
                          title="Remove Friend"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            ) : (
              <div className="text-center py-12 px-6 space-y-4 bg-[#111111] rounded-2xl border border-white/10 shadow-2xl">
                <div className="w-14 h-14 rounded-full bg-black/60 border border-[#FF4500] flex items-center justify-center mx-auto text-[#FF4500] shadow-[0_0_20px_rgba(255,69,0,0.3)]">
                  <Users className="w-7 h-7" />
                </div>
                <div className="space-y-1">
                  <h4 className="font-display text-2xl text-[#F0EBE3]">NO FRIENDS ADDED YET</h4>
                  <p className="text-xs text-[#9A9088] leading-relaxed max-w-xs mx-auto pb-2">
                    Send a friend request to any real registered user by their username. Once they accept, they will appear here.
                  </p>
                </div>
                
                <button
                  onClick={() => {
                    sounds.playTargetLock();
                    setIsAddFriendModalOpen(true);
                  }}
                  className="py-3 px-8 rounded-xl bg-[#FF4500] text-[#F0EBE3] font-display text-lg tracking-wider shadow-[0_0_15px_rgba(255,69,0,0.4)] inline-flex items-center gap-2"
                >
                  <UserPlus className="w-5 h-5" /> + SEND FRIEND REQUEST
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* SUB-TAB 4: USER PROFILE */}
      {subTab === 'profile' && (() => {
        const mastery = getProgressToNextLevel(user.level, user.xp);
        const totalCarsSpotted = user.totalSpots || garage.length;
        const uniqueCarsCount = new Set(garage.map(c => `${c.make}_${c.model}`.toLowerCase())).size;
        const rareCount = garage.filter(c => c.rarity === 'rare').length;
        const epicCount = garage.filter(c => c.rarity === 'epic').length;
        const legendaryCount = garage.filter(c => c.rarity === 'legendary' || c.rarity === 'mythic').length;

        return (
          <div className="space-y-4">
            {/* Main Profile Header Card */}
            <div 
              className="p-6 rounded-2xl bg-[#111111] border text-center space-y-4 relative overflow-hidden transition-colors"
              style={{ borderColor: user.cardThemeColor ? `${user.cardThemeColor}30` : 'rgba(255,255,255,0.1)' }}
            >
              {/* Ambient Glow */}
              <div 
                className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-24 blur-3xl pointer-events-none rounded-full opacity-25"
                style={{ backgroundColor: user.cardThemeColor || '#E50914' }}
              />

              <div className="relative inline-block mx-auto">
                <img 
                  src={user.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=400'} 
                  alt={user.username} 
                  className="w-20 h-20 rounded-full border-2 object-cover mx-auto shadow-xl" 
                  style={{ borderColor: 'var(--accent-color)', boxShadow: '0 0 16px var(--accent-glow)' }}
                />
                <span className={`absolute -bottom-2 left-1/2 -translate-x-1/2 px-2.5 py-0.5 rounded-full text-[9px] font-bold tracking-wider uppercase border shadow-md whitespace-nowrap ${mastery.tierConfig.badgeBg} ${mastery.tierConfig.badgeBorder} ${mastery.tierConfig.textColor}`}>
                  {mastery.tierConfig.label}
                </span>
              </div>
              
              <div className="pt-1 space-y-1">
                <div className="flex items-center justify-center gap-2">
                  <h2 className="text-2xl font-bold text-white tracking-tight">{user.displayName || 'Apex Member'}</h2>
                  {user.driverTitle && (
                    <span 
                      className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border"
                      style={{ 
                        color: 'var(--accent-color)',
                        backgroundColor: 'var(--accent-subtle)',
                        borderColor: 'var(--accent-border)'
                      }}
                    >
                      {user.driverTitle}
                    </span>
                  )}
                </div>

                <p className="text-xs text-white/50 font-data">
                  @{user.username || 'driver'} · {user.city || 'Global'}
                </p>

                {user.bio && (
                  <p className="text-xs text-white/80 italic mt-1 max-w-sm mx-auto">
                    "{user.bio}"
                  </p>
                )}

                {(user.favoriteCar || user.favoriteBrand) && (
                  <div className="flex items-center justify-center gap-3 pt-1.5 text-[11px] text-white/60">
                    <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-white/[0.04] border border-white/[0.06]">
                      🏎️ <span className="text-white/40">Dream Car:</span> <strong className="text-white font-medium">{[user.favoriteBrand, user.favoriteCar].filter(Boolean).join(' ')}</strong>
                    </span>
                  </div>
                )}

                {user.email && (
                  <p className="text-[11px] font-medium pt-0.5" style={{ color: 'var(--accent-color)' }}>
                    {user.email}
                  </p>
                )}
              </div>

              {/* ─── SPOTTER LEVEL & MASTERY PROGRESSION ─── */}
              <div className="p-4 rounded-xl bg-black/60 border border-white/[0.08] space-y-3 text-left">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-bold text-white/40 tracking-[0.2em] uppercase block">
                      SPOTTER LEVEL
                    </span>
                    <div className="flex items-baseline gap-2 mt-0.5">
                      <span className="text-2xl font-black text-white tracking-tight font-display">
                        LEVEL {mastery.level}
                      </span>
                      <span className={`text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded-full border ${mastery.tierConfig.badgeBg} ${mastery.tierConfig.badgeBorder} ${mastery.tierConfig.textColor}`}>
                        {mastery.tierConfig.label}
                      </span>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-xs font-bold text-white font-data">
                      {mastery.isMaxLevel ? 'MAX' : `${mastery.percentage}%`}
                    </span>
                    <span className="text-[10px] text-white/40 block">
                      {mastery.isMaxLevel ? 'Level 100 Reached' : `to Level ${mastery.level + 1}`}
                    </span>
                  </div>
                </div>

                {/* Progress Bar to Next Level */}
                <div>
                  <div className="w-full h-2.5 bg-white/[0.06] rounded-full overflow-hidden p-0.5 border border-white/[0.08]">
                    <div 
                      className="h-full rounded-full transition-all duration-500 shadow-sm"
                      style={{ 
                        width: `${mastery.percentage}%`,
                        backgroundColor: 'var(--accent-color)',
                        boxShadow: '0 0 8px var(--accent-color)'
                      }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-white/50 font-data mt-1.5">
                    <span>Progress to Next Level</span>
                    <span className="font-semibold text-white/80">
                      {mastery.currentXp.toLocaleString()} / {mastery.requiredXp.toLocaleString()} XP
                    </span>
                  </div>
                </div>
              </div>

              {/* ─── 5-METRIC DISCOVERY STATS GRID ─── */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-1 text-left font-data">
                <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                  <span className="text-white/40 text-[10px] block uppercase font-medium">Cars Spotted</span>
                  <span className="text-white font-bold text-lg">{totalCarsSpotted}</span>
                </div>
                <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                  <span className="text-white/40 text-[10px] block uppercase font-medium">Unique Cars</span>
                  <span className="text-[#FF4500] font-bold text-lg">{uniqueCarsCount}</span>
                </div>
                <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                  <span className="text-white/40 text-[10px] block uppercase font-medium">Rare Finds</span>
                  <span className="text-blue-400 font-bold text-lg">{rareCount}</span>
                </div>
                <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                  <span className="text-white/40 text-[10px] block uppercase font-medium">Epic Finds</span>
                  <span className="text-purple-400 font-bold text-lg">{epicCount}</span>
                </div>
                <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] col-span-2 sm:col-span-1">
                  <span className="text-white/40 text-[10px] block uppercase font-medium">Legendary Finds</span>
                  <span className="text-amber-400 font-bold text-lg">{legendaryCount}</span>
                </div>
              </div>
            </div>

            {/* Badges Showcase */}
            <div className="bg-[#111111] border border-white/10 rounded-xl p-5 space-y-3">
            <h3 className="font-display text-xl text-[#F0EBE3] flex items-center gap-2">
              <Award className="w-5 h-5 text-[#FFA500]" /> BADGES UNLOCKED ({badges.filter(b => b.isUnlocked).length})
            </h3>

            <div className="grid grid-cols-3 gap-3">
              {badges.map((badge) => {
                const IconComponent = 
                  badge.icon === 'Target' ? Target :
                  badge.icon === 'Zap' ? Zap :
                  badge.icon === 'Flag' ? Flag :
                  badge.icon === 'Crown' ? Crown :
                  badge.icon === 'Flame' ? Flame :
                  badge.icon === 'Globe' ? Globe : Award;
                  
                return (
                  <div
                    key={badge.id}
                    className={`p-3 rounded-xl border flex flex-col items-center text-center space-y-1 ${
                      badge.isUnlocked 
                        ? 'bg-black/60 border-[#FFA500]/40' 
                        : 'bg-black/20 border-white/5 opacity-40 grayscale'
                    }`}
                  >
                    <IconComponent className="w-8 h-8 mb-1 text-[#FFA500]" />
                    <h4 className="font-display text-xs text-[#F0EBE3] truncate w-full">{badge.name}</h4>
                    <span className="text-[9px] font-data text-[#FFA500]">+{badge.xpBonus} XP</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      );
    })()}

      {/* 3D Card Detail Modal */}
      <Card3DDetail card={selectedCard} onClose={() => setSelectedCard(null)} />

      {/* Comments Discussion Modal */}
      <CommentsModal
        post={selectedPostForComments}
        onClose={() => setSelectedPostForComments(null)}
        onOpenProfile={(userId, username) => setSelectedUserForProfile({ userId, username })}
      />

      {/* Media Post Composer Modal */}
      <MediaPostComposerModal
        isOpen={isMediaComposerOpen}
        onClose={() => setIsMediaComposerOpen(false)}
      />

      {/* Public Profile Modal */}
      <PublicProfileModal
        userId={selectedUserForProfile?.userId}
        username={selectedUserForProfile?.username}
        isOpen={Boolean(selectedUserForProfile)}
        onClose={() => setSelectedUserForProfile(null)}
        onOpenConversation={(recipient) => setActiveConversationUser(recipient)}
        onOpenCardDetail={(card) => setSelectedCard(card)}
      />

      {/* Direct Message Modal */}
      <DirectMessageModal
        recipient={activeConversationUser}
        isOpen={Boolean(activeConversationUser)}
        onClose={() => setActiveConversationUser(null)}
        onOpenProfile={(userId, username) => setSelectedUserForProfile({ userId, username })}
      />

      {/* ADD NEW FRIEND / SEND FRIEND REQUEST MODAL */}
      {isAddFriendModalOpen && (
        <div className="fixed inset-0 z-50 bg-[#080808]/90 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-[#111111] border border-white/15 rounded-3xl p-6 space-y-4 shadow-2xl relative">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-[#FF4500]/10 border border-[#FF4500]/30 flex items-center justify-center text-[#FF4500]">
                  <UserPlus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-display text-xl text-[#F0EBE3] leading-tight">SEND FRIEND REQUEST</h3>
                  <span className="text-[10px] font-data text-[#9A9088] uppercase tracking-wider block">
                    CONNECT WITH REAL REGISTERED USERS
                  </span>
                </div>
              </div>
              <button
                onClick={() => {
                  setIsAddFriendModalOpen(false);
                  setFriendModalFeedback({ type: '', message: '' });
                }}
                className="w-8 h-8 rounded-full bg-[#1A1A1A] border border-white/10 flex items-center justify-center text-[#9A9088] hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSendFriendRequest} className="space-y-3.5">
              <div>
                <label className="text-[10px] font-data font-semibold text-[#9A9088] uppercase tracking-wider block mb-1">
                  ENTER REGISTERED @USERNAME
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-3 text-[#FF4500] font-data text-xs">@</span>
                  <input
                    type="text"
                    required
                    autoFocus
                    value={targetUsernameInput}
                    onChange={(e) => setTargetUsernameInput(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                    placeholder="e.g. speed_demon"
                    className="w-full h-11 bg-[#1A1A1A] border border-white/10 rounded-xl pl-8 pr-4 text-xs text-white focus:border-[#FF4500] outline-none font-data"
                  />
                </div>
                <p className="text-[10px] text-[#9A9088] mt-1.5">
                  The recipient must be a registered APEX user and will receive a request to accept or deny.
                </p>
              </div>

              {friendModalFeedback.message && (
                <div className={`p-3 rounded-xl border text-xs flex items-start gap-2.5 ${
                  friendModalFeedback.type === 'success'
                    ? 'bg-[#2ECC71]/10 border-[#2ECC71]/30 text-[#2ECC71]'
                    : 'bg-rose-950/40 border-rose-600/40 text-rose-300'
                }`}>
                  {friendModalFeedback.type === 'success' ? (
                    <Check className="w-4 h-4 shrink-0 mt-0.5 text-[#2ECC71]" />
                  ) : (
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
                  )}
                  <span className="leading-snug">{friendModalFeedback.message}</span>
                </div>
              )}

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSearchingFriend || !targetUsernameInput.trim()}
                  className="w-full h-12 rounded-xl bg-[#FF4500] hover:bg-[#FF5500] disabled:opacity-50 text-white font-sans font-semibold text-sm shadow-[0_4px_20px_rgba(255,69,0,0.4)] flex items-center justify-center gap-2 transition-all"
                >
                  <UserCheck className="w-4 h-4" />
                  <span>{isSearchingFriend ? 'Sending Request...' : 'Send Friend Request'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
