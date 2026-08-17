import React, { useState } from 'react';
import { Flame, Trophy, Users, User, Zap, Crown, Award, Search, MessageSquare, Heart, Share2, Target, Flag, Globe, UserPlus, X, Check, UserCheck, AlertCircle } from 'lucide-react';
import { useApexStore } from '../../store/useApexStore';
import type { FeedPost, CarCard, FriendUser } from '../../types/apex';
import { Card3DDetail } from '../garage/Card3DDetail';
import { CommentsModal } from './CommentsModal';
import { RARITY_CONFIG } from '../../utils/rarity';
import { sounds } from '../../utils/audio';
import { supabase } from '../../lib/supabase';

export const SocialScreen: React.FC = () => {
  const { 
    user, 
    feedPosts, 
    leaderboards, 
    badges, 
    friends,
    addFriend,
    removeFriend,
    toggleLikePost, 
    toggleEnthusiastModal,
    setScannerOpen
  } = useApexStore();

  const [subTab, setSubTab] = useState<'activity' | 'leaderboard' | 'friends' | 'profile'>('activity');
  const [selectedCard, setSelectedCard] = useState<CarCard | null>(null);
  const [selectedPostForComments, setSelectedPostForComments] = useState<FeedPost | null>(null);
  const [leaderboardFilter, setLeaderboardFilter] = useState<'city' | 'country' | 'global'>('global');
  const [friendSearch, setFriendSearch] = useState('');
  
  // Add Friend Modal State
  const [isAddFriendModalOpen, setIsAddFriendModalOpen] = useState(false);
  const [targetUsernameInput, setTargetUsernameInput] = useState('');
  const [friendModalFeedback, setFriendModalFeedback] = useState<{ type: 'success' | 'error' | ''; message: string }>({ type: '', message: '' });
  const [isSearchingFriend, setIsSearchingFriend] = useState(false);

  const handleShare = async (post: FeedPost) => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `APEX — ${post.card.make} ${post.card.model}`,
          text: `Check out this ${post.card.rarity.toUpperCase()} spot on APEX: ${post.card.make} ${post.card.model}!`,
          url: window.location.href,
        });
      } catch (err) {
        console.log('Error sharing:', err);
      }
    }
  };

  const handleFollowOrAddFriend = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanHandle = targetUsernameInput.trim().replace(/^@/, '').toLowerCase();
    if (!cleanHandle) return;

    if (cleanHandle === user.username.toLowerCase()) {
      setFriendModalFeedback({ type: 'error', message: "You cannot add yourself as a friend." });
      return;
    }

    if (friends.some(f => f.username.toLowerCase() === cleanHandle)) {
      setFriendModalFeedback({ type: 'error', message: `@${cleanHandle} is already in your friends list.` });
      return;
    }

    sounds.playTargetLock();
    setIsSearchingFriend(true);
    setFriendModalFeedback({ type: '', message: '' });

    try {
      // 1. Try to find remote user in Supabase
      const { data: remoteUser } = await supabase
        .from('profiles')
        .select('*')
        .eq('username', cleanHandle)
        .maybeSingle();

      const newFriend: FriendUser = {
        id: remoteUser?.id || `friend-${Date.now()}`,
        username: cleanHandle,
        displayName: remoteUser?.display_name || cleanHandle,
        avatarUrl: remoteUser?.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=400',
        level: remoteUser?.level || 1,
        city: remoteUser?.city || 'Tokyo',
        country: remoteUser?.country || 'Japan',
        totalSpots: remoteUser?.total_spots || 0,
        isFollowing: true
      };

      addFriend(newFriend);
      setFriendModalFeedback({ type: 'success', message: `Successfully added @${cleanHandle} as a friend!` });
      setTargetUsernameInput('');
      setTimeout(() => {
        setIsAddFriendModalOpen(false);
        setFriendModalFeedback({ type: '', message: '' });
      }, 1200);
    } catch (err) {
      // Offline fallback: Add friend directly by handle
      const newFriend: FriendUser = {
        id: `friend-${Date.now()}`,
        username: cleanHandle,
        displayName: cleanHandle,
        avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=400',
        level: 1,
        isFollowing: true
      };
      addFriend(newFriend);
      setFriendModalFeedback({ type: 'success', message: `Added @${cleanHandle} to your friends!` });
      setTargetUsernameInput('');
      setTimeout(() => {
        setIsAddFriendModalOpen(false);
        setFriendModalFeedback({ type: '', message: '' });
      }, 1200);
    } finally {
      setIsSearchingFriend(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 pb-28">
      {/* Top 4-Way Segmented Tabs */}
      <div className="flex bg-[#111111] p-1 rounded-xl border border-white/10">
        {[
          { id: 'activity', label: 'Activity', icon: Flame },
          { id: 'leaderboard', label: 'Ranks', icon: Trophy },
          { id: 'friends', label: 'Friends', icon: Users },
          { id: 'profile', label: 'Profile', icon: User },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = subTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setSubTab(tab.id as any)}
              className={`flex-1 py-2 rounded-lg text-xs font-data flex items-center justify-center gap-1.5 transition-all ${
                isActive
                  ? 'bg-[#FF4500] text-[#F0EBE3] font-semibold glow-orange'
                  : 'text-[#9A9088] hover:text-[#F0EBE3]'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* SUB-TAB 1: LIVE COMMUNITY ACTIVITY FEED */}
      {subTab === 'activity' && (
        <div className="space-y-4">
          {feedPosts.map((post) => (
            <div key={post.id} className="bg-[#111111] border border-white/10 rounded-2xl overflow-hidden shadow-2xl space-y-3 p-4">
              {/* User Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <img src={post.user.avatarUrl} alt={post.user.username} className="w-8 h-8 rounded-full object-cover border border-[#FF4500]" />
                  <div>
                    <h4 className="text-xs font-semibold text-[#F0EBE3]">@{post.user.username}</h4>
                    <p className="text-[10px] font-data text-[#9A9088]">Level {post.user.level} · {post.createdAt}</p>
                  </div>
                </div>

                <span 
                  className="text-[9px] font-data font-bold uppercase px-2 py-0.5 rounded border"
                  style={{
                    color: RARITY_CONFIG[post.card.rarity]?.color || '#FFA500',
                    borderColor: `${RARITY_CONFIG[post.card.rarity]?.color || '#FFA500'}40`,
                    backgroundColor: `${RARITY_CONFIG[post.card.rarity]?.color || '#FFA500'}10`
                  }}
                >
                  {post.card.rarity}
                </span>
              </div>

              {/* Vehicle Photograph Preview Card */}
              <div 
                onClick={() => setSelectedCard(post.card)}
                className="relative aspect-video rounded-xl overflow-hidden cursor-pointer group border border-white/5"
              >
                <img 
                  src={post.card.imageUrl} 
                  alt={post.card.model} 
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
                />
                
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex flex-col justify-end p-3">
                  <span className="text-[10px] font-data text-[#FF4500] font-semibold">{post.card.yearEstimate} {post.card.make}</span>
                  <h3 className="font-display text-xl text-[#F0EBE3] tracking-wide leading-tight">{post.card.model}</h3>
                  <p className="text-[10px] font-data text-[#9A9088]">{post.card.city}, {post.card.country}</p>
                </div>
              </div>

              {/* Caption */}
              {post.caption && (
                <p className="text-xs text-[#F0EBE3] leading-relaxed pt-1">
                  {post.caption}
                </p>
              )}

              {/* Social Engagement Actions */}
              <div className="flex items-center justify-between pt-2 border-t border-[#2C2C2C] text-xs font-data">
                <div className="flex items-center gap-4">
                  <button 
                    onClick={() => toggleLikePost(post.id)}
                    className={`flex items-center gap-1.5 transition-colors ${post.isLiked ? 'text-[#FF4500]' : 'text-[#9A9088] hover:text-[#F0EBE3]'}`}
                  >
                    <Heart className={`w-4 h-4 ${post.isLiked ? 'fill-current' : ''}`} />
                    <span>{post.likesCount}</span>
                  </button>

                  <button 
                    onClick={() => setSelectedPostForComments(post)}
                    className="flex items-center gap-1.5 text-[#9A9088] hover:text-[#F0EBE3] transition-colors"
                  >
                    <MessageSquare className="w-4 h-4" />
                    <span>{post.commentsCount}</span>
                  </button>
                </div>

                <button 
                  onClick={() => handleShare(post)}
                  className="text-[#9A9088] hover:text-[#FF4500] transition-colors"
                >
                  <Share2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}

          {feedPosts.length === 0 && (
            <div className="text-center py-16 px-6 space-y-5 bg-[#111111] rounded-2xl border border-white/10 shadow-2xl">
              <div className="w-16 h-16 rounded-full bg-black/60 border border-[#FF4500] flex items-center justify-center mx-auto text-[#FF4500] glow-orange">
                <Search className="w-8 h-8" />
              </div>
              <div className="space-y-2">
                <h3 className="font-display text-3xl text-[#F0EBE3] tracking-wide">NO DISCOVERIES YET</h3>
                <p className="text-xs text-[#9A9088] leading-relaxed max-w-xs mx-auto">
                  The community feed is pristine. Spot a car and post your first discovery to make history on APEX.
                </p>
              </div>
              <button
                onClick={() => setScannerOpen(true)}
                className="py-3.5 px-6 rounded-xl bg-[#FF4500] text-[#F0EBE3] font-display text-lg tracking-wider glow-orange inline-flex items-center gap-2"
              >
                OPEN VISION SCANNER →
              </button>
            </div>
          )}
        </div>
      )}

      {/* SUB-TAB 2: LEADERBOARD */}
      {subTab === 'leaderboard' && (
        <div className="space-y-4">
          {/* Leaderboard Scope Filters */}
          <div className="flex gap-2">
            {(['city', 'country', 'global'] as const).map((filter) => (
              <button
                key={filter}
                onClick={() => setLeaderboardFilter(filter)}
                className={`flex-1 py-1.5 rounded-lg text-xs font-data uppercase border transition-all ${
                  leaderboardFilter === filter 
                    ? 'bg-black/60 text-[#FFA500] border-[#FFA500]/50 font-semibold' 
                    : 'bg-[#111111] text-[#9A9088] border-white/10'
                }`}
              >
                {filter}
              </button>
            ))}
          </div>

          <div className="bg-[#111111] border border-white/10 rounded-xl p-4 space-y-2">
            {leaderboards.map((entry) => {
              const isMe = entry.username === user.username;
              return (
                <div
                  key={entry.username}
                  className={`p-3 rounded-lg flex items-center justify-between border transition-all ${
                    isMe 
                      ? 'bg-black/60 border-[#FF4500] glow-orange' 
                      : 'bg-black/20 border-white/5'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className={`font-display text-xl w-6 text-center ${
                      entry.rank === 1 ? 'text-[#FFA500] font-bold' :
                      entry.rank === 2 ? 'text-[#F0EBE3]' :
                      entry.rank === 3 ? 'text-[#E8A020]' : 'text-[#5A5550]'
                    }`}>
                      #{entry.rank}
                    </span>

                    <img src={entry.avatarUrl} alt={entry.displayName} className="w-10 h-10 rounded-full object-cover border border-[#2C2C2C]" />

                    <div>
                      <h4 className="text-sm font-semibold text-[#F0EBE3] flex items-center gap-1">
                        {entry.displayName} {isMe && <span className="text-[10px] text-[#FF4500] font-data font-semibold">(YOU)</span>}
                      </h4>
                      <p className="text-[10px] text-[#9A9088] font-data">Level {entry.level} · Rarest: {entry.rarestCard}</p>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-sm font-data font-semibold text-[#FF4500] block">{entry.xp.toLocaleString()} XP</span>
                    <span className="text-[9px] font-data text-[#2ECC71]">↑ +{entry.changeAmount || 1} ranks</span>
                  </div>
                </div>
              );
            })}
          </div>

          <button className="w-full py-4 rounded-xl bg-[#FF4500] text-[#F0EBE3] font-display text-lg tracking-wider flex items-center justify-center gap-2 glow-orange mt-2">
            <Zap className="w-5 h-5" /> INVITE TO RACE
          </button>
        </div>
      )}

      {/* SUB-TAB 3: FRIENDS & CHALLENGES */}
      {subTab === 'friends' && (
        <div className="space-y-4">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9A9088]" />
              <input
                type="text"
                placeholder="Filter your friends..."
                value={friendSearch}
                onChange={(e) => setFriendSearch(e.target.value)}
                className="w-full bg-[#111111] border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-xs text-[#F0EBE3] placeholder-[#5A5550] focus:border-[#FF4500] outline-none"
              />
            </div>
            <button
              onClick={() => setIsAddFriendModalOpen(true)}
              className="px-4 py-2.5 rounded-xl bg-[#FF4500] text-white font-data text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 shadow-[0_0_12px_rgba(255,69,0,0.3)] hover:bg-[#FF5500] transition-colors shrink-0"
            >
              <UserPlus className="w-4 h-4" /> ADD FRIEND
            </button>
          </div>

          {/* Friends List */}
          {friends.length > 0 ? (
            <div className="space-y-2">
              {friends
                .filter(f => f.username.toLowerCase().includes(friendSearch.toLowerCase()) || f.displayName.toLowerCase().includes(friendSearch.toLowerCase()))
                .map((friend) => (
                  <div
                    key={friend.username}
                    className="p-3 rounded-2xl bg-[#111111] border border-white/10 flex items-center justify-between shadow-lg"
                  >
                    <div className="flex items-center gap-3">
                      <img
                        src={friend.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=400'}
                        alt={friend.username}
                        className="w-10 h-10 rounded-full object-cover border border-[#FF4500]/60"
                      />
                      <div>
                        <h4 className="text-xs font-semibold text-[#F0EBE3]">{friend.displayName}</h4>
                        <p className="text-[10px] font-data text-[#9A9088]">
                          @{friend.username} · Level {friend.level} {friend.city ? `· ${friend.city}` : ''}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-data text-[#2ECC71] bg-[#2ECC71]/10 px-2 py-0.5 rounded border border-[#2ECC71]/30 font-semibold">
                        FOLLOWING
                      </span>
                      <button
                        onClick={() => {
                          sounds.playTargetLock();
                          removeFriend(friend.username);
                        }}
                        className="text-[10px] font-data text-rose-400 hover:text-rose-300 p-1"
                        title="Unfollow"
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
                  Add friends by username to compare garage collections and see their real-world vehicle spots.
                </p>
              </div>
              
              <button
                onClick={() => setIsAddFriendModalOpen(true)}
                className="py-3 px-8 rounded-xl bg-[#FF4500] text-[#F0EBE3] font-display text-lg tracking-wider shadow-[0_0_15px_rgba(255,69,0,0.4)] inline-flex items-center gap-2"
              >
                <UserPlus className="w-5 h-5" /> + ADD NEW FRIEND
              </button>
            </div>
          )}
        </div>
      )}

      {/* SUB-TAB 4: USER PROFILE */}
      {subTab === 'profile' && (
        <div className="space-y-4">
          {/* Profile Card */}
          <div className="p-5 rounded-xl bg-[#111111] border border-white/10 text-center space-y-3 relative overflow-hidden">
            <img src={user.avatarUrl} alt={user.username} className="w-24 h-24 rounded-full border-2 border-[#FF4500] object-cover mx-auto glow-orange" />
            
            <div>
              <h2 className="font-display text-3xl text-[#F0EBE3]">{user.displayName || 'Apex Member'}</h2>
              <p className="text-xs font-data text-[#FF4500]">
                @{user.username || 'user'} · Level {user.level} {user.persona === 'finder' ? 'Spotter' : user.persona === 'spotter' ? 'Hunter' : user.persona === 'love_of_cars' ? 'Purist' : 'Member'}
              </p>
            </div>

            <div className="grid grid-cols-3 gap-2 py-3 border-y border-[#2C2C2C] text-center font-data text-xs">
              <div>
                <span className="text-[#9A9088] block text-[10px]">TOTAL SPOTS</span>
                <span className="text-[#F0EBE3] font-semibold text-base">{user.totalSpots}</span>
              </div>
              <div>
                <span className="text-[#9A9088] block text-[10px]">STREAK</span>
                <span className="text-[#FF4500] font-semibold text-base flex items-center justify-center gap-1">
                  <Flame className="w-4 h-4" /> {user.streakDays}d
                </span>
              </div>
              <div>
                <span className="text-[#9A9088] block text-[10px]">RAREST</span>
                <span className="text-[#FF2200] font-semibold text-base uppercase">{user.rarestFind}</span>
              </div>
            </div>

            {/* Enthusiast Banner Upgrade CTA */}
            <button
              onClick={() => toggleEnthusiastModal(true)}
              className="w-full py-3 rounded-xl bg-[#FF4500] text-[#F0EBE3] font-display text-lg tracking-wider font-semibold glow-orange flex items-center justify-center gap-2"
            >
              <Crown className="w-5 h-5" /> UPGRADE TO ENTHUSIAST MODE
            </button>
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
      )}

      {/* 3D Card Detail Modal */}
      <Card3DDetail card={selectedCard} onClose={() => setSelectedCard(null)} />

      {/* Comments Discussion Modal */}
      <CommentsModal
        post={selectedPostForComments}
        onClose={() => setSelectedPostForComments(null)}
      />

      {/* ADD NEW FRIEND MODAL */}
      {isAddFriendModalOpen && (
        <div className="fixed inset-0 z-50 bg-[#080808]/90 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-[#111111] border border-white/15 rounded-3xl p-6 space-y-4 shadow-2xl relative">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-[#FF4500]/10 border border-[#FF4500]/30 flex items-center justify-center text-[#FF4500]">
                  <UserPlus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-display text-xl text-[#F0EBE3] leading-tight">ADD SPOTTER</h3>
                  <span className="text-[10px] font-data text-[#9A9088] uppercase tracking-wider block">
                    CONNECT BY USERNAME
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

            <form onSubmit={handleFollowOrAddFriend} className="space-y-3.5">
              <div>
                <label className="text-[10px] font-data font-semibold text-[#9A9088] uppercase tracking-wider block mb-1">
                  ENTER @USERNAME
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-3 text-[#FF4500] font-data text-xs">@</span>
                  <input
                    type="text"
                    required
                    autoFocus
                    value={targetUsernameInput}
                    onChange={(e) => setTargetUsernameInput(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                    placeholder="e.g. tokyo_drifter"
                    className="w-full h-11 bg-[#1A1A1A] border border-white/10 rounded-xl pl-8 pr-4 text-xs text-white focus:border-[#FF4500] outline-none font-data"
                  />
                </div>
              </div>

              {friendModalFeedback.message && (
                <div className={`p-2.5 rounded-xl border text-xs flex items-center gap-2 ${
                  friendModalFeedback.type === 'success'
                    ? 'bg-[#2ECC71]/10 border-[#2ECC71]/30 text-[#2ECC71]'
                    : 'bg-rose-950/40 border-rose-600/40 text-rose-300'
                }`}>
                  {friendModalFeedback.type === 'success' ? <Check className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
                  <span>{friendModalFeedback.message}</span>
                </div>
              )}

              {/* Suggested Spotters to follow */}
              <div className="space-y-1.5 pt-1">
                <span className="text-[10px] font-data text-[#9A9088] uppercase tracking-wider block">
                  SUGGESTED SPOTTERS
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {['tokyo_drifter', 'monaco_spotter', 'nurburg_hunter', 'dubai_exotics'].map((suggested) => (
                    <button
                      key={suggested}
                      type="button"
                      onClick={() => setTargetUsernameInput(suggested)}
                      className="text-[10px] font-data px-2.5 py-1 rounded-lg bg-[#1A1A1A] border border-white/10 text-[#9A9088] hover:border-[#FF4500] hover:text-[#FF4500] transition-colors"
                    >
                      @{suggested}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSearchingFriend || !targetUsernameInput.trim()}
                  className="w-full h-12 rounded-xl bg-[#FF4500] hover:bg-[#FF5500] disabled:opacity-50 text-white font-sans font-semibold text-sm shadow-[0_4px_20px_rgba(255,69,0,0.4)] flex items-center justify-center gap-2 transition-all"
                >
                  <UserCheck className="w-4 h-4" />
                  <span>{isSearchingFriend ? 'Searching...' : 'Add as Friend'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
