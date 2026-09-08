import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Heart, 
  MessageSquare, 
  Share2, 
  Trash2, 
  Box, 
  UserPlus, 
  Zap, 
  Gauge, 
  Timer, 
  Award,
  Search,
  Sparkles,
  ChevronUp,
  ChevronDown,
  MapPin
} from 'lucide-react';
import { useApexStore } from '../../store/useApexStore';
import type { FeedPost, CarCard } from '../../types/apex';
import { RARITY_CONFIG } from '../../utils/rarity';
import { sounds } from '../../utils/audio';
import { getOptimizedImageUrl, imagePrefetchCache } from '../../utils/imageUrl';

interface PaperThrowFeedProps {
  posts: FeedPost[];
  onOpenCardDetail: (card: CarCard) => void;
  onOpenComments: (post: FeedPost) => void;
  onOpenScanner: () => void;
  onOpenProfile?: (userId: string, username: string) => void;
}

export const PaperThrowFeed: React.FC<PaperThrowFeedProps> = ({
  posts,
  onOpenCardDetail,
  onOpenComments,
  onOpenScanner,
  onOpenProfile
}) => {
  const { 
    user, 
    friends, 
    toggleLikePost, 
    deletePost, 
    sendFriendRequest 
  } = useApexStore();

  const [currentIndex, setCurrentIndex] = useState(0);
  const [likeBurst, setLikeBurst] = useState<{ id: string; x: number; y: number } | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const prevLayerRef = useRef<HTMLDivElement>(null);
  const currentLayerRef = useRef<HTMLDivElement>(null);
  const nextLayerRef = useRef<HTMLDivElement>(null);

  // Gesture state refs (direct DOM manipulation for 120 FPS locked response with 0 React re-renders during drag)
  const isInteractingRef = useRef(false);
  const isDraggingRef = useRef(false);
  const isSettlingRef = useRef(false);
  const touchStartYRef = useRef(0);
  const lastTouchYRef = useRef(0);
  const lastTimeRef = useRef(0);
  const velocityRef = useRef(0);
  const settleTimeoutRef = useRef<any>(null);

  // Preload adjacent images with bounded deduplicated LRU cache
  useEffect(() => {
    const nextPost = posts[currentIndex + 1];
    if (nextPost?.card?.imageUrl) {
      imagePrefetchCache.prefetch(nextPost.card.imageUrl, 'feed');
    }
    const prevPost = posts[currentIndex - 1];
    if (prevPost?.card?.imageUrl) {
      imagePrefetchCache.prefetch(prevPost.card.imageUrl, 'feed');
    }
  }, [currentIndex, posts]);

  // Clean up timeouts
  useEffect(() => {
    return () => {
      if (settleTimeoutRef.current) clearTimeout(settleTimeoutRef.current);
    };
  }, []);

  // Helper to reset all layer styles to default idle positions
  const resetLayerStyles = useCallback(() => {
    if (prevLayerRef.current) {
      prevLayerRef.current.style.transition = 'none';
      prevLayerRef.current.style.transform = 'translate3d(0, -100%, 0)';
      prevLayerRef.current.style.display = 'none';
      prevLayerRef.current.style.zIndex = '25';
    }
    if (currentLayerRef.current) {
      currentLayerRef.current.style.transition = 'none';
      currentLayerRef.current.style.transform = 'translate3d(0, 0, 0)';
      currentLayerRef.current.style.opacity = '1';
      currentLayerRef.current.style.zIndex = '20';
      currentLayerRef.current.style.display = 'block';
    }
    if (nextLayerRef.current) {
      nextLayerRef.current.style.transition = 'none';
      nextLayerRef.current.style.transform = 'translate3d(0, 0, 0) scale(0.96)';
      nextLayerRef.current.style.opacity = '0.85';
      nextLayerRef.current.style.zIndex = '10';
      nextLayerRef.current.style.display = 'block';
    }
  }, []);

  // Reset styles when currentIndex changes
  useEffect(() => {
    resetLayerStyles();
  }, [currentIndex, resetLayerStyles]);

  // Double tap to like
  const lastTapRef = useRef<number>(0);
  const handleDoubleTap = (e: React.MouseEvent | React.TouchEvent, post: FeedPost) => {
    const now = Date.now();
    if (now - lastTapRef.current < 300) {
      sounds.playTargetLock();
      if (!post.isLiked) {
        toggleLikePost(post.id);
      }
      const rect = containerRef.current?.getBoundingClientRect();
      const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
      setLikeBurst({
        id: post.id,
        x: rect ? clientX - rect.left : 180,
        y: rect ? clientY - rect.top : 280
      });
      setTimeout(() => setLikeBurst(null), 900);
    }
    lastTapRef.current = now;
  };

  const handleShare = async (post: FeedPost) => {
    sounds.playTargetLock();
    if (navigator.share) {
      try {
        const title = post.card ? `APEX — ${post.card.make} ${post.card.model}` : `APEX — Discovery by @${post.user.username}`;
        const text = post.card
          ? `Check out this ${post.card.rarity.toUpperCase()} spot on APEX: ${post.card.make} ${post.card.model}!`
          : `Check out this spot on APEX by @${post.user.username}: ${post.caption || 'Car Discovery'}!`;
        await navigator.share({
          title,
          text,
          url: window.location.href,
        });
      } catch (err) {
        console.log('Error sharing:', err);
      }
    }
  };

  // ─── COMMIT TRANSITIONS (FORWARD & BACKWARD) ───

  const commitForward = useCallback(() => {
    if (isSettlingRef.current) return;
    if (currentIndex >= posts.length - 1) {
      // At bottom of feed: snap back
      if (currentLayerRef.current) {
        currentLayerRef.current.style.transition = 'transform 0.22s cubic-bezier(0.16, 1, 0.3, 1)';
        currentLayerRef.current.style.transform = 'translate3d(0, 0, 0)';
      }
      return;
    }

    isSettlingRef.current = true;
    sounds.playPaperThrow();

    const transitionStyle = 'transform 0.24s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.24s ease';

    if (currentLayerRef.current) {
      currentLayerRef.current.style.transition = transitionStyle;
      currentLayerRef.current.style.transform = 'translate3d(0, -102%, 0)';
      currentLayerRef.current.style.opacity = '0.9';
    }
    if (nextLayerRef.current) {
      nextLayerRef.current.style.transition = transitionStyle;
      nextLayerRef.current.style.transform = 'translate3d(0, 0, 0) scale(1)';
      nextLayerRef.current.style.opacity = '1';
    }

    settleTimeoutRef.current = setTimeout(() => {
      setCurrentIndex(prev => Math.min(posts.length - 1, prev + 1));
      isSettlingRef.current = false;
      isDraggingRef.current = false;
      isInteractingRef.current = false;
    }, 240);
  }, [currentIndex, posts.length]);

  const commitBackward = useCallback(() => {
    if (isSettlingRef.current) return;
    if (currentIndex <= 0) {
      // At top of feed: snap back
      if (currentLayerRef.current) {
        currentLayerRef.current.style.transition = 'transform 0.22s cubic-bezier(0.16, 1, 0.3, 1)';
        currentLayerRef.current.style.transform = 'translate3d(0, 0, 0)';
      }
      return;
    }

    isSettlingRef.current = true;
    sounds.playPaperThrow();

    const transitionStyle = 'transform 0.24s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.24s ease';

    if (prevLayerRef.current) {
      prevLayerRef.current.style.transition = transitionStyle;
      prevLayerRef.current.style.transform = 'translate3d(0, 0, 0)';
      prevLayerRef.current.style.opacity = '1';
    }
    if (currentLayerRef.current) {
      currentLayerRef.current.style.transition = transitionStyle;
      currentLayerRef.current.style.transform = 'translate3d(0, 0, 0) scale(0.96)';
      currentLayerRef.current.style.opacity = '0.85';
    }

    settleTimeoutRef.current = setTimeout(() => {
      setCurrentIndex(prev => Math.max(0, prev - 1));
      isSettlingRef.current = false;
      isDraggingRef.current = false;
      isInteractingRef.current = false;
    }, 240);
  }, [currentIndex]);

  const cancelTransition = useCallback(() => {
    isSettlingRef.current = true;
    const transitionStyle = 'transform 0.2s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.2s ease';

    if (currentLayerRef.current) {
      currentLayerRef.current.style.transition = transitionStyle;
      currentLayerRef.current.style.transform = 'translate3d(0, 0, 0)';
      currentLayerRef.current.style.opacity = '1';
    }
    if (prevLayerRef.current) {
      prevLayerRef.current.style.transition = transitionStyle;
      prevLayerRef.current.style.transform = 'translate3d(0, -100%, 0)';
    }
    if (nextLayerRef.current) {
      nextLayerRef.current.style.transition = transitionStyle;
      nextLayerRef.current.style.transform = 'translate3d(0, 0, 0) scale(0.96)';
      nextLayerRef.current.style.opacity = '0.85';
    }

    settleTimeoutRef.current = setTimeout(() => {
      if (prevLayerRef.current) prevLayerRef.current.style.display = 'none';
      isSettlingRef.current = false;
      isDraggingRef.current = false;
      isInteractingRef.current = false;
    }, 200);
  }, []);

  // ─── DIRECT POINTER MANIPULATION (1:1 CONTINUOUS TOUCH TRACKING) ───

  const cachedHeightRef = useRef(650);

  const onPointerDown = (e: React.PointerEvent) => {
    if (isSettlingRef.current) return;
    if (e.button !== 0 && e.pointerType === 'mouse') return;

    cachedHeightRef.current = containerRef.current?.clientHeight || 650;
    touchStartYRef.current = e.clientY;
    lastTouchYRef.current = e.clientY;
    lastTimeRef.current = Date.now();
    velocityRef.current = 0;
    isInteractingRef.current = true;
    isDraggingRef.current = false;
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!isInteractingRef.current || isSettlingRef.current) return;

    const dy = e.clientY - touchStartYRef.current;
    const height = cachedHeightRef.current;

    // Small deadzone to differentiate tap from intentional drag
    if (!isDraggingRef.current && Math.abs(dy) < 6) {
      return;
    }

    if (!isDraggingRef.current) {
      isDraggingRef.current = true;
      try {
        (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
      } catch {}
      // Remove any leftover transitions for 1:1 direct tracking
      if (currentLayerRef.current) currentLayerRef.current.style.transition = 'none';
      if (prevLayerRef.current) prevLayerRef.current.style.transition = 'none';
      if (nextLayerRef.current) nextLayerRef.current.style.transition = 'none';
    }

    // Velocity computation
    const now = Date.now();
    const dt = Math.max(1, now - lastTimeRef.current);
    velocityRef.current = (e.clientY - lastTouchYRef.current) / dt;
    lastTouchYRef.current = e.clientY;
    lastTimeRef.current = now;

    // ─── CASE A: DRAGGING UPWARD (Current car moves up toward next) ───
    if (dy < 0) {
      if (prevLayerRef.current) prevLayerRef.current.style.display = 'none';

      let clampedDy = dy;
      if (currentIndex >= posts.length - 1) {
        clampedDy = dy * 0.25; // Rubber band at bottom
      }

      const progress = Math.min(1.0, Math.max(0, -clampedDy / height));

      if (currentLayerRef.current) {
        currentLayerRef.current.style.zIndex = '20';
        currentLayerRef.current.style.transform = `translate3d(0, ${clampedDy}px, 0)`;
      }

      if (nextLayerRef.current) {
        nextLayerRef.current.style.display = 'block';
        nextLayerRef.current.style.zIndex = '10';
        nextLayerRef.current.style.transform = `translate3d(0, 0, 0) scale(${0.96 + progress * 0.04})`;
        nextLayerRef.current.style.opacity = String(0.85 + progress * 0.15);
      }
    } 
    // ─── CASE B: DRAGGING DOWNWARD (Previous car pulled down into view) ───
    else if (dy > 0) {
      if (currentIndex > 0 && prevLayerRef.current) {
        prevLayerRef.current.style.display = 'block';
        prevLayerRef.current.style.zIndex = '25';

        const progress = Math.min(1.0, Math.max(0, dy / height));

        prevLayerRef.current.style.transform = `translate3d(0, calc(-100% + ${dy}px), 0)`;

        if (currentLayerRef.current) {
          currentLayerRef.current.style.zIndex = '15';
          currentLayerRef.current.style.transform = `translate3d(0, 0, 0) scale(${1 - progress * 0.04})`;
          currentLayerRef.current.style.opacity = String(1 - progress * 0.15);
        }
      } else {
        // At top of feed: rubber band bounce
        if (currentLayerRef.current) {
          currentLayerRef.current.style.transform = `translate3d(0, ${dy * 0.25}px, 0)`;
        }
      }
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    if (!isInteractingRef.current || isSettlingRef.current) return;
    isInteractingRef.current = false;

    try {
      (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
    } catch {}

    if (!isDraggingRef.current) {
      return;
    }

    const totalDy = e.clientY - touchStartYRef.current;
    const vy = velocityRef.current; // pixels/ms

    // Decide commit vs cancel based on displacement and release velocity
    if (totalDy < -75 || vy < -0.35) {
      commitForward();
    } else if ((totalDy > 75 || vy > 0.35) && currentIndex > 0) {
      commitBackward();
    } else {
      cancelTransition();
    }
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isSettlingRef.current) return;
      if (e.key === 'ArrowDown' || e.key === 'PageDown' || e.key === ' ') {
        e.preventDefault();
        commitForward();
      } else if (e.key === 'ArrowUp' || e.key === 'PageUp') {
        e.preventDefault();
        commitBackward();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [commitForward, commitBackward]);

  // Wheel listener
  const wheelLockRef = useRef(false);
  const handleWheel = (e: React.WheelEvent) => {
    if (wheelLockRef.current || isSettlingRef.current) return;
    if (e.deltaY > 30) {
      wheelLockRef.current = true;
      commitForward();
      setTimeout(() => { wheelLockRef.current = false; }, 320);
    } else if (e.deltaY < -30 && currentIndex > 0) {
      wheelLockRef.current = true;
      commitBackward();
      setTimeout(() => { wheelLockRef.current = false; }, 320);
    }
  };

  const effectivePosts = (posts && posts.length > 0) ? posts : [];
  if (effectivePosts.length === 0) {
    return (
      <div className="text-center py-24 px-6 space-y-5 bg-[#111111] rounded-3xl border border-white/10 shadow-2xl max-w-sm mx-auto my-12">
        <div className="w-16 h-16 rounded-full bg-black/60 border border-[#E50914] flex items-center justify-center mx-auto text-[#E50914] shadow-lg">
          <Search className="w-8 h-8" />
        </div>
        <div className="space-y-2">
          <h3 className="font-display text-3xl text-white tracking-wide">NO DISCOVERIES YET</h3>
          <p className="text-xs text-white/60 leading-relaxed max-w-xs mx-auto">
            The feed contains real vehicle spots. Spot your first car and post it to make history on APEX.
          </p>
        </div>
        <button
          onClick={onOpenScanner}
          className="py-3.5 px-6 rounded-2xl bg-[#E50914] text-white font-bold text-sm tracking-wider shadow-lg hover:bg-[#DC2626] active:scale-95 transition-all inline-flex items-center gap-2"
        >
          <Sparkles className="w-4 h-4" /> OPEN VISION SCANNER
        </button>
      </div>
    );
  }

  const safeIndex = Math.min(currentIndex, effectivePosts.length - 1);
  const currentPost = effectivePosts[safeIndex] || effectivePosts[0];
  const nextPost = safeIndex < effectivePosts.length - 1 ? effectivePosts[safeIndex + 1] : null;
  const prevPost = safeIndex > 0 ? effectivePosts[safeIndex - 1] : null;

  return (
    <div 
      ref={containerRef}
      onWheel={handleWheel}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      className="relative w-full h-full select-none overflow-hidden touch-none bg-black"
      style={{ perspective: 1200 }}
    >
      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* LAYER 1: PREVIOUS SHEET (Top layer during downward pull)          */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {prevPost && (
        <div
          ref={prevLayerRef}
          className="absolute inset-0 w-full h-full overflow-hidden"
          style={{
            zIndex: 25,
            transform: 'translateY(-100%)',
            display: 'none',
            willChange: 'transform',
            contain: 'layout paint style'
          }}
        >
          <DiscoverySheetContent
            post={prevPost}
            user={user}
            isNextUnderneath={false}
            hasPrevious={safeIndex - 1 > 0}
            onOpenCardDetail={onOpenCardDetail}
            onOpenComments={onOpenComments}
            onOpenProfile={onOpenProfile}
            onShare={handleShare}
            onDoubleTap={handleDoubleTap}
            toggleLikePost={toggleLikePost}
            deletePost={deletePost}
            sendFriendRequest={sendFriendRequest}
            isFriend={friends.some(f => f.username.toLowerCase() === prevPost.user.username.toLowerCase())}
          />
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* LAYER 2: CURRENT SHEET (Active stationary / grabbed sheet)        */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      <div
        ref={currentLayerRef}
        className="absolute inset-0 w-full h-full overflow-hidden"
        style={{
          zIndex: 20,
          transform: 'translate3d(0, 0, 0)',
          willChange: 'transform, opacity',
          contain: 'layout paint style'
        }}
      >
        <DiscoverySheetContent
          post={currentPost}
          user={user}
          isNextUnderneath={false}
          hasPrevious={safeIndex > 0}
          onOpenCardDetail={onOpenCardDetail}
          onOpenComments={onOpenComments}
          onOpenProfile={onOpenProfile}
          onShare={handleShare}
          onDoubleTap={handleDoubleTap}
          toggleLikePost={toggleLikePost}
          deletePost={deletePost}
          sendFriendRequest={sendFriendRequest}
          isFriend={friends.some(f => f.username.toLowerCase() === currentPost.user.username.toLowerCase())}
        />
      </div>

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* LAYER 3: NEXT SHEET (Underneath layer during upward throw)        */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {nextPost && (
        <div
          ref={nextLayerRef}
          className="absolute inset-0 w-full h-full overflow-hidden pointer-events-none"
          style={{
            zIndex: 10,
            transform: 'translate3d(0, 0, 0) scale(0.96)',
            opacity: 0.85,
            willChange: 'transform, opacity',
            contain: 'layout paint style'
          }}
        >
          <DiscoverySheetContent
            post={nextPost}
            user={user}
            isNextUnderneath={true}
            hasPrevious={false}
            onOpenCardDetail={onOpenCardDetail}
            onOpenComments={onOpenComments}
            onOpenProfile={onOpenProfile}
            onShare={handleShare}
            onDoubleTap={handleDoubleTap}
            toggleLikePost={toggleLikePost}
            deletePost={deletePost}
            sendFriendRequest={sendFriendRequest}
            isFriend={friends.some(f => f.username.toLowerCase() === nextPost.user.username.toLowerCase())}
          />
        </div>
      )}

      {/* ─── DOUBLE TAP HEART BURST ANIMATION ─── */}
      <AnimatePresence>
        {likeBurst && (
          <motion.div
            initial={{ scale: 0, opacity: 0, y: 0 }}
            animate={{ scale: [0, 1.4, 1.1], opacity: [0, 1, 0], y: -40 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
            className="absolute z-50 pointer-events-none text-[#E50914] drop-shadow-[0_0_24px_rgba(229,9,20,0.9)]"
            style={{ left: likeBurst.x - 40, top: likeBurst.y - 40 }}
          >
            <Heart className="w-20 h-20 fill-current" />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

/* ══════════════════════════════════════════════════════════════════ */
/* FULL SCREEN DISCOVERY SHEET CONTENT                                */
/* ══════════════════════════════════════════════════════════════════ */

interface DiscoverySheetContentProps {
  post: FeedPost;
  user: any;
  isNextUnderneath: boolean;
  hasPrevious?: boolean;
  onOpenCardDetail: (card: CarCard) => void;
  onOpenComments: (post: FeedPost) => void;
  onOpenProfile?: (userId: string, username: string) => void;
  onShare: (post: FeedPost) => void;
  onDoubleTap: (e: React.MouseEvent | React.TouchEvent, post: FeedPost) => void;
  toggleLikePost: (postId: string) => void;
  deletePost: (postId: string) => void;
  sendFriendRequest: (username: string) => Promise<any>;
  isFriend: boolean;
}

const DiscoverySheetContent = React.memo<DiscoverySheetContentProps>(({
  post,
  user,
  isNextUnderneath,
  hasPrevious = false,
  onOpenCardDetail,
  onOpenComments,
  onOpenProfile,
  onShare,
  onDoubleTap,
  toggleLikePost,
  deletePost,
  sendFriendRequest,
  isFriend
}) => {
  const rarityConf = (post.card && RARITY_CONFIG[post.card.rarity]) || RARITY_CONFIG.rare;
  const isMe = post.user.id === user?.id || post.user.username === user?.username;
  const [friendRequested, setFriendRequested] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Viewport-aware video playback: only play when active and in front
  useEffect(() => {
    if (post.mediaType === 'video' && videoRef.current) {
      if (!isNextUnderneath) {
        videoRef.current.play().catch(() => {});
      } else {
        videoRef.current.pause();
      }
    }
  }, [isNextUnderneath, post.mediaType]);

  const handleAddFriend = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isMe || isFriend || friendRequested) return;
    sounds.playTargetLock();
    setFriendRequested(true);
    await sendFriendRequest(post.user.username);
  };

  const optimizedHeroUrl = post.card?.imageUrl
    ? getOptimizedImageUrl(post.card.imageUrl, 'feed')
    : (post.thumbnailUrl || post.mediaUrl || '');

  return (
    <div 
      onClick={(e) => onDoubleTap(e, post)}
      className="relative w-full h-full bg-[#080808] overflow-hidden select-none"
      style={{ contain: 'content' }}
    >
      {/* ─── 1. FULL SCREEN HERO VEHICLE PHOTOGRAPH OR VIDEO ─── */}
      {post.mediaType === 'video' && post.mediaUrl ? (
        <video
          ref={videoRef}
          src={post.mediaUrl}
          poster={post.thumbnailUrl || optimizedHeroUrl}
          playsInline
          muted
          loop
          preload="metadata"
          className="absolute inset-0 w-full h-full object-cover pointer-events-none z-0"
        />
      ) : (
        <img
          src={post.mediaUrl || optimizedHeroUrl}
          alt={post.card?.model || 'Apex Discovery'}
          className="absolute inset-0 w-full h-full object-cover pointer-events-none z-0"
          loading={isNextUnderneath ? "lazy" : "eager"}
          fetchPriority={isNextUnderneath ? "low" : "high"}
          decoding="async"
        />
      )}

      {/* ─── 2. SEAMLESS REELS GRADIENTS ─── */}
      {/* Top Header Vignette */}
      <div className="absolute top-0 left-0 right-0 h-44 bg-gradient-to-b from-black/85 via-black/35 to-transparent pointer-events-none z-10" />
      {/* Bottom Content Upward Vignette */}
      <div className="absolute bottom-0 left-0 right-0 h-3/5 bg-gradient-to-t from-black via-black/60 via-45% to-transparent pointer-events-none z-10" />

      {/* ─── 3. UPPER PORTION: COMPACT INTEGRATED METADATA (CAR POSTS) ─── */}
      {post.card && (
        <div className="absolute top-16 left-4 right-4 z-20 flex items-center justify-between pointer-events-none">
          <div className="flex items-center gap-2">
            {/* Integrated Rarity Badge */}
            <span className={`text-[10px] font-bold tracking-wider px-2.5 py-0.5 rounded-full border shadow-md ${rarityConf.badgeBg}`}>
              {rarityConf.label.toUpperCase()}
            </span>

            {/* Year & Make Tag */}
            <span className="text-[11px] font-semibold text-white/90 drop-shadow">
              {post.card.yearEstimate || '2024'} {post.card.make}
            </span>
          </div>

          {/* Location Tag */}
          <span className="text-[11px] font-medium text-white/70 drop-shadow flex items-center gap-1">
            <MapPin className="w-3 h-3 text-white/60 shrink-0" />
            <span>{post.card.city || 'Global'}</span>
          </span>
        </div>
      )}

      {/* ─── 4. RIGHT SIDE ACTION RAIL (SINGLE VERTICAL AXIS) ─── */}
      <div 
        onClick={(e) => e.stopPropagation()} 
        onPointerDown={(e) => e.stopPropagation()}
        className="absolute right-3.5 bottom-6 z-30 flex flex-col items-center gap-3.5 pointer-events-auto"
      >
        {/* Avatar + Follow/Add Friend Button (Clickable to open profile) */}
        <div className="relative flex flex-col items-center">
          <button
            onClick={() => onOpenProfile?.(post.user.id, post.user.username)}
            className="rounded-full active:scale-95 transition-transform"
          >
            <img
              src={post.user.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=400'}
              alt={post.user.username}
              className="w-11 h-11 rounded-full object-cover border-2 border-white/40 shadow-xl hover:border-[#E50914] transition-colors"
            />
          </button>
          {!isMe && !isFriend && (
            <button
              onClick={handleAddFriend}
              className={`absolute -bottom-1.5 w-5 h-5 rounded-full flex items-center justify-center shadow-lg transition-transform active:scale-90 ${
                friendRequested
                  ? 'bg-emerald-500 text-white'
                  : 'bg-[#E50914] hover:bg-[#DC2626] text-white'
              }`}
              title="Add Friend"
            >
              <UserPlus className="w-3 h-3" />
            </button>
          )}
        </div>

        {/* Like Button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            sounds.playTargetLock();
            toggleLikePost(post.id);
          }}
          className="flex flex-col items-center group active:scale-90 transition-transform"
        >
          <div className={`w-11 h-11 rounded-full flex items-center justify-center border transition-all ${
            post.isLiked
              ? 'bg-[#E50914] border-[#E50914] text-white shadow-lg shadow-red-950/60'
              : 'bg-[#161616]/90 border-white/15 text-white/90 group-hover:text-white group-hover:border-white/30'
          }`}>
            <Heart className={`w-5 h-5 ${post.isLiked ? 'fill-current' : ''}`} />
          </div>
          <span className="text-[10px] font-bold text-white drop-shadow mt-1">
            {post.likesCount}
          </span>
        </button>

        {/* Comment Button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            sounds.playTargetLock();
            onOpenComments(post);
          }}
          className="flex flex-col items-center group active:scale-90 transition-transform"
        >
          <div className="w-11 h-11 rounded-full bg-[#161616]/90 border border-white/15 flex items-center justify-center text-white/90 group-hover:text-white group-hover:border-white/30 transition-all">
            <MessageSquare className="w-5 h-5" />
          </div>
          <span className="text-[10px] font-bold text-white drop-shadow mt-1">
            {post.commentsCount}
          </span>
        </button>

        {/* 3D Card Detail Inspect Button (Visible only when post is linked to a car card) */}
        {post.card && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              sounds.playTargetLock();
              onOpenCardDetail(post.card!);
            }}
            className="flex flex-col items-center group active:scale-90 transition-transform"
            title="Inspect 3D Card"
          >
            <div className="w-11 h-11 rounded-full bg-[#161616]/90 border border-white/15 flex items-center justify-center text-white/90 group-hover:text-white group-hover:border-[#E50914] transition-all">
              <Box className="w-5 h-5 text-[#E50914]" />
            </div>
            <span className="text-[9px] font-bold text-white/90 drop-shadow mt-1">
              3D Card
            </span>
          </button>
        )}

        {/* Share Button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onShare(post);
          }}
          className="flex flex-col items-center group active:scale-90 transition-transform"
        >
          <div className="w-11 h-11 rounded-full bg-[#161616]/90 border border-white/15 flex items-center justify-center text-white/80 group-hover:text-white transition-all">
            <Share2 className="w-4 h-4" />
          </div>
          <span className="text-[9px] font-bold text-white/80 drop-shadow mt-1">
            Share
          </span>
        </button>

        {/* Delete Button (Author Only) */}
        {isMe && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (window.confirm('Delete this discovery from feed?')) {
                deletePost(post.id);
              }
            }}
            className="w-10 h-10 rounded-full bg-[#1f0d0d]/90 border border-red-500/30 flex items-center justify-center text-red-400 hover:text-red-300 transition-all active:scale-90 mt-1"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* ─── 5. BOTTOM-LEFT DISCOVERY HIERARCHY ─── */}
      <div 
        onClick={(e) => e.stopPropagation()}
        className="absolute bottom-5 left-4 right-20 z-20 space-y-1.5 pointer-events-auto"
      >
        {/* User Identity Line (Clickable Username -> Public Profile) */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => onOpenProfile?.(post.user.id, post.user.username)}
            className="text-xs font-bold text-white drop-shadow hover:text-[#E50914] hover:underline transition-colors"
          >
            @{post.user.username}
          </button>
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-white/[0.12] text-white/80 border border-white/10">
            Lvl {post.user.level || 1}
          </span>
          <span className="text-[10px] text-white/50 drop-shadow">
            · {post.createdAt || 'Just now'}
          </span>
        </div>

        {/* Model Title & Category (or Standalone Media Post Tag) */}
        {post.card ? (
          <div>
            <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight leading-tight drop-shadow-md">
              {post.card.model}
            </h2>
            <p className="text-xs font-semibold text-[#E50914] tracking-wide drop-shadow">
              {post.card.make} · {post.card.bodyStyle}
            </p>
          </div>
        ) : (
          <div>
            <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-md text-white border border-white/20 drop-shadow">
              {post.mediaType === 'video' ? '🎬 CAR EDIT / VIDEO' : '📸 APEX SPOT'}
            </span>
          </div>
        )}

        {/* Caption */}
        {post.caption && (
          <p className="text-xs text-white/90 leading-relaxed drop-shadow line-clamp-2 max-w-[280px]">
            {post.caption}
          </p>
        )}

        {/* Key Specifications Row (Rendered if post is linked to a car card) */}
        {post.card && (
          <div className="flex items-center gap-2 pt-1 flex-wrap">
            <div className="flex items-center gap-1 bg-[#161616]/90 border border-white/10 px-2 py-0.5 rounded-lg text-[10px] font-bold text-white">
              <Zap className="w-3 h-3 text-[#E50914]" />
              <span>{post.card.horsepower || 500} HP</span>
            </div>

            <div className="flex items-center gap-1 bg-[#161616]/90 border border-white/10 px-2 py-0.5 rounded-lg text-[10px] font-bold text-white">
              <Gauge className="w-3 h-3 text-[#E50914]" />
              <span>{post.card.topSpeedKmH || 310} KM/H</span>
            </div>

            <div className="flex items-center gap-1 bg-[#161616]/90 border border-white/10 px-2 py-0.5 rounded-lg text-[10px] font-bold text-white">
              <Timer className="w-3 h-3 text-[#E50914]" />
              <span>{post.card.zeroToHundredSec || 3.4}s</span>
            </div>

            <div className="flex items-center gap-1 bg-[#161616]/90 border border-white/10 px-2 py-0.5 rounded-lg text-[10px] font-bold text-white">
              <Award className="w-3 h-3 text-[#E50914]" />
              <span>{post.card.rarityScore || 85} PTS</span>
            </div>
          </div>
        )}

        {/* Subtle Gesture Guidance Cues */}
        {!isNextUnderneath && (
          <div className="pt-1 flex items-center gap-2 text-white/40 text-[9px] font-semibold tracking-wider uppercase">
            <div className="flex items-center gap-1">
              <ChevronUp className="w-3 h-3 text-[#E50914] animate-bounce" />
              <span>Swipe up for next</span>
            </div>
            {hasPrevious && (
              <>
                <span className="text-white/20">·</span>
                <div className="flex items-center gap-1 text-white/30">
                  <ChevronDown className="w-3 h-3" />
                  <span>Swipe down for prev</span>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}, (prevProps, nextProps) => {
  return (
    prevProps.post.id === nextProps.post.id &&
    prevProps.post.isLiked === nextProps.post.isLiked &&
    prevProps.post.likesCount === nextProps.post.likesCount &&
    prevProps.post.commentsCount === nextProps.post.commentsCount &&
    prevProps.post.card?.imageUrl === nextProps.post.card?.imageUrl &&
    prevProps.post.mediaUrl === nextProps.post.mediaUrl &&
    prevProps.isNextUnderneath === nextProps.isNextUnderneath &&
    prevProps.hasPrevious === nextProps.hasPrevious &&
    prevProps.isFriend === nextProps.isFriend &&
    prevProps.user?.id === nextProps.user?.id
  );
});
