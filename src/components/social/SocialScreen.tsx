import React, { useState } from 'react';
import { Flame, Trophy, Users, User, Zap, Crown, Award, Search, MessageSquare, Heart, Share2, Target, Flag, Globe } from 'lucide-react';
import { useApexStore } from '../../store/useApexStore';
import type { FeedPost, CarCard } from '../../types/apex';
import { Card3DDetail } from '../garage/Card3DDetail';
import { CommentsModal } from './CommentsModal';
import { RARITY_CONFIG } from '../../utils/rarity';

export const SocialScreen: React.FC = () => {
  const { 
    user, 
    feedPosts, 
    leaderboards, 
    badges, 
    toggleLikePost, 
    toggleEnthusiastModal,
    setScannerOpen
  } = useApexStore();

  const [subTab, setSubTab] = useState<'activity' | 'leaderboard' | 'friends' | 'profile'>('activity');
  const [selectedCard, setSelectedCard] = useState<CarCard | null>(null);
  const [selectedPostForComments, setSelectedPostForComments] = useState<FeedPost | null>(null);
  const [leaderboardFilter, setLeaderboardFilter] = useState<'city' | 'country' | 'global'>('global');
  const [friendSearch, setFriendSearch] = useState('');

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
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9A9088]" />
            <input
              type="text"
              placeholder="Search friends by username..."
              value={friendSearch}
              onChange={(e) => setFriendSearch(e.target.value)}
              className="w-full bg-[#111111] border border-white/10 rounded-xl pl-9 pr-4 py-2.5 text-xs text-[#F0EBE3] placeholder-[#5A5550] focus:outline-none"
            />
          </div>

          <div className="text-center py-12 px-6 space-y-4 bg-[#111111] rounded-2xl border border-white/10">
            <div className="w-14 h-14 rounded-full bg-black/60 border border-[#FF4500] flex items-center justify-center mx-auto text-[#FF4500] glow-orange">
              <Zap className="w-7 h-7" />
            </div>
            <div className="space-y-1">
              <h4 className="font-display text-2xl text-[#F0EBE3]">NO FRIENDS ADDED YET</h4>
              <p className="text-xs text-[#9A9088] leading-relaxed max-w-xs mx-auto pb-4">
                Connect with other real car spotters in your city to compare cards and start 7-day XP races.
              </p>
            </div>
            
            <button className="py-3 px-8 rounded-xl bg-[#FF4500] text-[#F0EBE3] font-display text-lg tracking-wider glow-orange inline-flex items-center gap-2">
              <Crown className="w-5 h-5" /> + ADD NEW FRIEND
            </button>
          </div>
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
    </div>
  );
};
