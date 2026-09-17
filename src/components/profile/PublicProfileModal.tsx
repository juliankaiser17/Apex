import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, 
  UserPlus, 
  UserCheck, 
  MessageSquare, 
  MapPin, 
  Clock, 
  Calendar, 
  Grid, 
  ShieldCheck, 
  Check,
  ShieldAlert
} from 'lucide-react';
import { useApexStore } from '../../store/useApexStore';
import { supabase } from '../../lib/supabase';
import { sounds } from '../../utils/audio';
import { RARITY_CONFIG } from '../../utils/rarity';
import { ProfileDossierSkeleton } from '../common/Skeleton';
import { ModerationModal } from '../moderation/ModerationModal';
import type { CarCard } from '../../types/apex';

interface PublicProfileModalProps {
  userId?: string | null;
  username?: string | null;
  isOpen: boolean;
  onClose: () => void;
  onOpenConversation?: (recipient: { id: string; username: string; displayName: string; avatarUrl: string; level: number }) => void;
  onOpenCardDetail?: (card: CarCard) => void;
}

interface PublicUserData {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string;
  level: number;
  xp: number;
  totalSpots: number;
  rarestFind: string;
  city: string;
  country: string;
  createdAt: string;
}

export const PublicProfileModal: React.FC<PublicProfileModalProps> = ({
  userId,
  username,
  isOpen,
  onClose,
  onOpenConversation,
  onOpenCardDetail
}) => {
  const currentUser = useApexStore(s => s.user);

  const [profile, setProfile] = useState<PublicUserData | null>(null);
  const [publicCars, setPublicCars] = useState<CarCard[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFollowing, setIsFollowing] = useState(false);
  const [friendStatus, setFriendStatus] = useState<'none' | 'pending_sent' | 'pending_received' | 'friends'>('none');
  const [pendingRequestId, setPendingRequestId] = useState<string | null>(null);
  const [actionInProgress, setActionInProgress] = useState(false);
  const [showModeration, setShowModeration] = useState(false);

  const isSelf = Boolean(
    currentUser.id && profile?.id && currentUser.id === profile.id
  ) || Boolean(
    currentUser.username && profile?.username && 
    currentUser.username.toLowerCase() === profile.username.toLowerCase()
  );

  // ─── 1. FETCH PUBLIC PROFILE DATA & RELATIONSHIPS ───
  useEffect(() => {
    if (!isOpen || (!userId && !username)) {
      setProfile(null);
      setPublicCars([]);
      return;
    }

    let isMounted = true;
    setIsLoading(true);

    const loadData = async () => {
      try {
        const isUuid = Boolean(userId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId));
        let profileData: any = null;

        if (isUuid) {
          const { data, error } = await supabase
            .from('profiles')
            .select('id, username, display_name, avatar_url, level, xp, total_spots, rarest_find, created_at')
            .eq('id', userId!)
            .maybeSingle();
          if (!error && data) profileData = data;
        } else if (username) {
          const clean = username.replace(/^@/, '').trim();
          const { data, error } = await supabase
            .from('profiles')
            .select('id, username, display_name, avatar_url, level, xp, total_spots, rarest_find, created_at')
            .ilike('username', clean)
            .maybeSingle();
          if (!error && data) profileData = data;
        }

        if (!profileData) {
          // Graceful fallback for sample or offline spotter
          const cleanName = (username || userId || 'spotter').replace(/^@/, '').replace(/^usr-/, '').replace(/-\d+$/, '');
          const formatted = cleanName.split(/[_-\s]/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
          const fallbackUser: PublicUserData = {
            id: userId || `usr-${cleanName.toLowerCase()}`,
            username: (username || cleanName).replace(/^@/, '').toLowerCase(),
            displayName: formatted || 'Apex Spotter',
            avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&h=200&fit=crop',
            level: 8,
            xp: 2800,
            totalSpots: 14,
            rarestFind: 'Porsche 911 GT3 RS',
            city: 'Yokohama',
            country: 'Japan',
            createdAt: '2025'
          };
          if (isMounted) {
            setProfile(fallbackUser);
            setIsLoading(false);
          }
          return;
        }

        const publicUser: PublicUserData = {
          id: profileData.id,
          username: profileData.username,
          displayName: profileData.display_name || profileData.username,
          avatarUrl: profileData.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&h=200&fit=crop',
          level: profileData.level || 1,
          xp: profileData.xp || 0,
          totalSpots: profileData.total_spots || 0,
          rarestFind: profileData.rarest_find || 'None',
          city: profileData.city || 'Local Area',
          country: profileData.country || 'Global',
          createdAt: new Date(profileData.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short' })
        };

        if (isMounted) setProfile(publicUser);

        // Fetch user's public garage spots
        const { data: garageData } = await supabase
          .from('garage')
          .select('*')
          .eq('user_id', publicUser.id)
          .order('scanned_at', { ascending: false })
          .limit(12);

        if (isMounted && garageData) {
          const mappedCards: CarCard[] = garageData.map((c: any) => ({
            id: c.id,
            cardNumber: c.card_number || '#APX-0000',
            make: c.make,
            model: c.model,
            yearEstimate: c.year_estimate || '2024',
            color: c.color || 'Unknown',
            rarity: c.rarity || 'common',
            rarityScore: 75,
            imageUrl: c.image_url,
            city: c.city || 'Local Area',
            country: c.country || 'Global',
            latApprox: 0,
            lngApprox: 0,
            horsepower: c.horsepower || 0,
            topSpeedKmH: c.top_speed_kmh || 0,
            xpEarned: c.xp_earned || 0,
            scanValidated: true,
            isPublic: true,
            huntTriggered: false,
            privacyLevel: 'public_blurred',
            aiConfidence: 0.99,
            createdAt: c.scanned_at,
            bodyStyle: 'Coupe',
            originCountry: 'Unknown',
            interestingFact: '',
            briefHistory: '',
            modsDetected: [],
            marketValueLowUsd: 0,
            marketValueHighUsd: 0
          }));
          setPublicCars(mappedCards);
        }

        // Fetch follow & friendship status if logged in and not self
        if (currentUser.id && currentUser.id !== publicUser.id) {
          const isTargetUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(publicUser.id);
          const isUserUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(currentUser.id);

          if (!isTargetUuid || !isUserUuid) {
            try {
              const follows = JSON.parse(localStorage.getItem(`apex_local_follows_${currentUser.id}`) || '[]');
              if (isMounted) setIsFollowing(follows.includes(publicUser.id));
            } catch {}
            if (isMounted) setIsLoading(false);
            return;
          }

          // Check follow status
          const { data: followData } = await supabase
            .from('follows')
            .select('follower_id')
            .eq('follower_id', currentUser.id)
            .eq('following_id', publicUser.id)
            .maybeSingle();

          if (isMounted) setIsFollowing(Boolean(followData));

          // Check friend requests
          const { data: friendReqs } = await supabase
            .from('friend_requests')
            .select('id, sender_id, receiver_id, status')
            .or(`and(sender_id.eq.${currentUser.id},receiver_id.eq.${publicUser.id}),and(sender_id.eq.${publicUser.id},receiver_id.eq.${currentUser.id})`);

          if (isMounted && friendReqs && friendReqs.length > 0) {
            const accepted = friendReqs.find((r: any) => r.status === 'accepted');
            if (accepted) {
              setFriendStatus('friends');
            } else {
              const pending = friendReqs.find((r: any) => r.status === 'pending');
              if (pending) {
                setPendingRequestId(pending.id);
                if (pending.sender_id === currentUser.id) {
                  setFriendStatus('pending_sent');
                } else {
                  setFriendStatus('pending_received');
                }
              } else {
                setFriendStatus('none');
              }
            }
          } else if (isMounted) {
            setFriendStatus('none');
          }
        }
      } catch (err) {
        console.warn('Error loading public profile modal:', err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    loadData();

  }, [isOpen, userId, username, currentUser.id]);

  // ─── 1b. REALTIME SUBSCRIPTION FOR FRIEND REQUESTS & FOLLOWS ───
  useEffect(() => {
    if (!isOpen || !profile?.id || !currentUser?.id) return;
    const isTargetUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(profile.id);
    const isUserUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(currentUser.id);
    if (!isTargetUuid || !isUserUuid) return;

    const channel = supabase
      .channel(`profile_rel_${profile.id}_${currentUser.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'friend_requests'
        },
        (payload) => {
          const row = (payload.new || payload.old) as any;
          if (!row) return;
          const isRelated = (row.sender_id === currentUser.id && row.receiver_id === profile.id) ||
                            (row.sender_id === profile.id && row.receiver_id === currentUser.id);
          if (!isRelated) return;

          if (payload.eventType === 'DELETE') {
            setFriendStatus('none');
            setPendingRequestId(null);
          } else if (row.status === 'accepted') {
            setFriendStatus('friends');
            setPendingRequestId(null);
            sounds.playXpPop();
          } else if (row.status === 'pending') {
            setPendingRequestId(row.id);
            if (row.sender_id === currentUser.id) {
              setFriendStatus('pending_sent');
            } else {
              setFriendStatus('pending_received');
              sounds.playXpPop();
            }
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'follows',
          filter: `follower_id=eq.${currentUser.id}`
        },
        (payload) => {
          const row = (payload.new || payload.old) as any;
          if (row && row.following_id === profile.id) {
            setIsFollowing(payload.eventType !== 'DELETE');
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isOpen, profile?.id, currentUser?.id]);

  // ─── 2. TOGGLE FOLLOW ACTION ───
  const handleToggleFollow = useCallback(async () => {
    if (!profile || isSelf || actionInProgress || !currentUser.id) return;
    sounds.playTargetLock();

    const previousState = isFollowing;
    setIsFollowing(!previousState);
    setActionInProgress(true);

    const isTargetUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(profile.id);
    const isUserUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(currentUser.id);

    if (!isTargetUuid || !isUserUuid) {
      // Local persistence for sample/mock spotters
      try {
        const key = `apex_local_follows_${currentUser.id}`;
        const existing = JSON.parse(localStorage.getItem(key) || '[]');
        if (!previousState) {
          localStorage.setItem(key, JSON.stringify([...new Set([...existing, profile.id])]));
        } else {
          localStorage.setItem(key, JSON.stringify(existing.filter((id: string) => id !== profile.id)));
        }
      } catch {}
      setActionInProgress(false);
      return;
    }

    try {
      if (!previousState) {
        // Create follow relation
        const { error } = await supabase
          .from('follows')
          .insert([{ follower_id: currentUser.id, following_id: profile.id }]);
        if (error) throw error;
      } else {
        // Delete follow relation
        const { error } = await supabase
          .from('follows')
          .delete()
          .eq('follower_id', currentUser.id)
          .eq('following_id', profile.id);
        if (error) throw error;
      }
    } catch (err) {
      console.warn('Follow action failed, reverting state:', err);
      setIsFollowing(previousState);
    } finally {
      setActionInProgress(false);
    }
  }, [profile, isSelf, actionInProgress, currentUser.id, isFollowing]);

  // ─── 3. FRIEND REQUEST ACTIONS ───
  const handleFriendAction = useCallback(async () => {
    if (!profile || isSelf || actionInProgress || !currentUser.id) return;
    sounds.playTargetLock();
    setActionInProgress(true);

    const isTargetUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(profile.id);
    const isUserUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(currentUser.id);

    if (!isTargetUuid || !isUserUuid) {
      if (friendStatus === 'none') {
        setFriendStatus('pending_sent');
      } else {
        setFriendStatus('none');
      }
      setActionInProgress(false);
      return;
    }

    try {
      if (friendStatus === 'none') {
        // Send request
        setFriendStatus('pending_sent');
        const { data, error } = await supabase
          .from('friend_requests')
          .insert([{
            sender_id: currentUser.id,
            receiver_id: profile.id,
            status: 'pending'
          }])
          .select('id')
          .single();

        if (error) throw error;
        if (data) setPendingRequestId(data.id);
      } else if (friendStatus === 'pending_received' && pendingRequestId) {
        // Accept request
        setFriendStatus('friends');
        const { error } = await supabase
          .from('friend_requests')
          .update({ status: 'accepted', updated_at: new Date().toISOString() })
          .eq('id', pendingRequestId);

        if (error) throw error;
      } else if (friendStatus === 'pending_sent' && pendingRequestId) {
        // Cancel request
        setFriendStatus('none');
        const { error } = await supabase
          .from('friend_requests')
          .delete()
          .eq('id', pendingRequestId);

        if (error) throw error;
        setPendingRequestId(null);
      } else if (friendStatus === 'friends') {
        // Remove friend
        if (window.confirm(`Remove @${profile.username} from your friends?`)) {
          setFriendStatus('none');
          await supabase
            .from('friend_requests')
            .delete()
            .or(`and(sender_id.eq.${currentUser.id},receiver_id.eq.${profile.id}),and(sender_id.eq.${profile.id},receiver_id.eq.${currentUser.id})`);
        }
      }
    } catch (err) {
      console.warn('Friend request action failed:', err);
      // Reload status
    } finally {
      setActionInProgress(false);
    }
  }, [profile, isSelf, actionInProgress, currentUser.id, friendStatus, pendingRequestId]);

  if (!isOpen) return null;

  return createPortal(
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] bg-black/85 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 select-none font-sans">
        {/* Backdrop dismiss */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0"
        />

        {/* Modal Container */}
        <motion.div
          initial={{ y: '100%', opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: '100%', opacity: 0 }}
          transition={{ type: 'spring', damping: 26, stiffness: 300 }}
          className="relative z-10 w-full max-w-lg bg-[#111111] border border-white/15 rounded-t-[28px] sm:rounded-2xl max-h-[90dvh] flex flex-col overflow-hidden shadow-2xl"
          style={{
            paddingBottom: 'max(14px, env(safe-area-inset-bottom, 14px))'
          }}
        >
          {/* Header */}
          <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between bg-[#141414] shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold tracking-wider text-white/50 uppercase">
                Spotter Dossier
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              {!isSelf && profile && (
                <button
                  onClick={() => setShowModeration(true)}
                  className="w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 text-white/50 hover:text-amber-400 transition-colors flex items-center justify-center"
                  title="Report or Block Spotter"
                  aria-label="Report or Block Spotter"
                >
                  <ShieldAlert className="w-4 h-4" />
                </button>
              )}
              <button
                onClick={onClose}
                className="w-10 h-10 rounded-full bg-white/10 text-white/60 hover:text-white transition-colors flex items-center justify-center min-h-[44px] min-w-[44px]"
                aria-label="Close dossier"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Profile Body */}
          <div className="flex-1 overflow-y-auto p-5 space-y-5 no-scrollbar">
            {isLoading ? (
              <ProfileDossierSkeleton />
            ) : !profile ? (
              <div className="text-center py-16 text-white/40 space-y-2">
                <p className="font-display text-lg text-white">PROFILE NOT FOUND</p>
                <p className="text-xs">This spotter profile does not exist or has been removed.</p>
              </div>
            ) : (
              <>
                {/* User Identity Header Card */}
                <div className="flex items-start gap-4">
                  <div className="relative">
                    <img
                      src={profile.avatarUrl}
                      alt={profile.username}
                      className="w-18 h-18 rounded-2xl object-cover border-2 border-white/20 shadow-xl"
                    />
                    <span 
                      className="absolute -bottom-2 -right-1 text-[9px] font-bold px-2 py-0.5 rounded-full text-white shadow-md border border-white/20"
                      style={{ backgroundColor: 'var(--accent-color, #E50914)' }}
                    >
                      LVL {profile.level}
                    </span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <h2 className="text-lg font-black text-white truncate leading-tight">
                      {profile.displayName}
                    </h2>
                    <p className="text-xs font-bold text-[#E50914] truncate mb-1">
                      @{profile.username}
                    </p>
                    <div className="flex items-center gap-3 text-[11px] text-white/60">
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-white/40" />
                        <span>{profile.city}</span>
                      </span>
                      <span>·</span>
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-white/40" />
                        <span>Joined {profile.createdAt}</span>
                      </span>
                    </div>
                  </div>
                </div>

                {/* Interactive Action Buttons (If not viewing self) */}
                {!isSelf && currentUser.id && (
                  <div className="grid grid-cols-3 gap-2.5">
                    {/* Follow / Following Button */}
                    <button
                      onClick={handleToggleFollow}
                      disabled={actionInProgress}
                      className={`py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all active:scale-95 min-h-[44px] ${
                        isFollowing
                          ? 'bg-white/10 text-white border border-white/20'
                          : 'bg-[#E50914] text-white shadow-lg shadow-red-950/60 hover:bg-[#ff1a25]'
                      }`}
                    >
                      {isFollowing ? (
                        <>
                          <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Following</span>
                        </>
                      ) : (
                        <>
                          <UserPlus className="w-3.5 h-3.5" />
                          <span>Follow</span>
                        </>
                      )}
                    </button>

                    {/* Friend Request Button */}
                    <button
                      onClick={handleFriendAction}
                      disabled={actionInProgress}
                      className={`py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all active:scale-95 border min-h-[44px] ${
                        friendStatus === 'friends'
                          ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
                          : friendStatus === 'pending_received'
                          ? 'bg-amber-950/40 border-amber-500/40 text-amber-300'
                          : friendStatus === 'pending_sent'
                          ? 'bg-white/5 border-white/20 text-white/60'
                          : 'bg-[#1e1e1e] border-white/15 text-white/90 hover:border-white/30'
                      }`}
                    >
                      {friendStatus === 'friends' ? (
                        <>
                          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Friends</span>
                        </>
                      ) : friendStatus === 'pending_received' ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-amber-400" />
                          <span>Accept</span>
                        </>
                      ) : friendStatus === 'pending_sent' ? (
                        <>
                          <Clock className="w-3.5 h-3.5" />
                          <span>Pending</span>
                        </>
                      ) : (
                        <>
                          <UserPlus className="w-3.5 h-3.5 text-[#E50914]" />
                          <span>Add Friend</span>
                        </>
                      )}
                    </button>

                    {/* Direct Message Button */}
                    <button
                      onClick={() => {
                        sounds.playTargetLock();
                        onClose();
                        onOpenConversation?.({
                          id: profile.id,
                          username: profile.username,
                          displayName: profile.displayName,
                          avatarUrl: profile.avatarUrl,
                          level: profile.level
                        });
                      }}
                      className="py-2.5 px-3 rounded-xl bg-[#1e1e1e] border border-white/15 hover:border-white/30 text-white active:scale-95 text-xs font-bold flex items-center justify-center gap-1.5 transition-all min-h-[44px]"
                    >
                      <MessageSquare className="w-3.5 h-3.5 text-[#E50914]" />
                      <span>Message</span>
                    </button>
                  </div>
                )}

                {/* 3 Stats Grid */}
                <div className="grid grid-cols-3 gap-2.5">
                  <div className="p-3 rounded-2xl bg-[#181818] border border-white/10 text-center">
                    <span className="text-[10px] font-bold text-white/50 uppercase block mb-1">
                      Total Spots
                    </span>
                    <span className="text-base font-black text-white">
                      {profile.totalSpots}
                    </span>
                  </div>

                  <div className="p-3 rounded-2xl bg-[#181818] border border-white/10 text-center">
                    <span className="text-[10px] font-bold text-white/50 uppercase block mb-1">
                      Rarest Find
                    </span>
                    <span className="text-xs font-black text-[#E50914] uppercase truncate block">
                      {profile.rarestFind}
                    </span>
                  </div>

                  <div className="p-3 rounded-2xl bg-[#181818] border border-white/10 text-center">
                    <span className="text-[10px] font-bold text-white/50 uppercase block mb-1">
                      Total XP
                    </span>
                    <span className="text-base font-black text-white">
                      {profile.xp.toLocaleString()}
                    </span>
                  </div>
                </div>

                {/* Public Garage / Discoveries Grid */}
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-white/70 flex items-center gap-1.5">
                      <Grid className="w-3.5 h-3.5 text-[#E50914]" />
                      <span>Public Collection ({publicCars.length})</span>
                    </h4>
                  </div>

                  {publicCars.length === 0 ? (
                    <div className="p-8 rounded-2xl bg-[#161616] border border-white/10 text-center text-white/40 text-xs space-y-2">
                      <Grid className="w-8 h-8 text-white/20 mx-auto" />
                      <p className="font-semibold text-white/70">No vehicles exhibited yet</p>
                      <p className="text-[11px] text-white/40">Spots shared publicly by this driver will appear here.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 gap-2.5">
                      {publicCars.map((car) => {
                        const conf = RARITY_CONFIG[car.rarity] || RARITY_CONFIG.rare;
                        return (
                          <div
                            key={car.id}
                            onClick={() => {
                              sounds.playTargetLock();
                              onOpenCardDetail?.(car);
                            }}
                            className="aspect-square rounded-xl overflow-hidden bg-[#161616] border border-white/10 hover:border-[#E50914] relative cursor-pointer active:scale-95 transition-all group"
                          >
                            <img
                              src={car.imageUrl}
                              alt={car.model}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-80" />
                            <div className="absolute bottom-1.5 left-1.5 right-1.5">
                              <span className="text-[10px] font-bold text-white truncate block drop-shadow">
                                {car.model}
                              </span>
                              <span className={`text-[8px] font-bold px-1.5 py-0.2 rounded border shadow ${conf.badgeBg}`}>
                                {conf.label.toUpperCase()}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </motion.div>
      </div>

      {showModeration && profile && (
        <ModerationModal
          isOpen={true}
          targetType="user"
          targetId={profile.id}
          targetUserId={profile.id}
          targetUsername={profile.username}
          onClose={() => setShowModeration(false)}
          onActionComplete={() => {
            setShowModeration(false);
            onClose();
          }}
        />
      )}
    </AnimatePresence>,
    document.body
  );
};
