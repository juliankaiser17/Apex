import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Send, Heart, MessageSquare } from 'lucide-react';
import { useApexStore } from '../../store/useApexStore';
import type { FeedPost, PostComment } from '../../types/apex';
import { RARITY_CONFIG } from '../../utils/rarity';
import { sounds } from '../../utils/audio';
import { supabase } from '../../lib/supabase';
import { CommentRowSkeleton } from '../common/Skeleton';

interface CommentsModalProps {
  post: FeedPost | null;
  onClose: () => void;
  onOpenProfile?: (userId: string, username: string) => void;
}

export const CommentsModal: React.FC<CommentsModalProps> = ({
  post,
  onClose,
  onOpenProfile
}) => {
  const user = useApexStore(s => s.user);
  const addCommentToPost = useApexStore(s => s.addCommentToPost);
  const toggleLikeComment = useApexStore(s => s.toggleLikeComment);

  const [commentText, setCommentText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [remoteComments, setRemoteComments] = useState<PostComment[]>([]);
  const [isLoadingComments, setIsLoadingComments] = useState(false);
  const [keyboardOffset, setKeyboardOffset] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);
  const commentsEndRef = useRef<HTMLDivElement>(null);

  // ─── 1. FETCH COMMENTS FROM SUPABASE WITH LOCAL STORE FALLBACK ───
  useEffect(() => {
    if (!post?.id) {
      setRemoteComments([]);
      return;
    }

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(post.id);

    // Load locally saved comments for this post if any
    try {
      const cached = localStorage.getItem(`apex_comments_${post.id}`);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setRemoteComments(parsed);
        }
      } else {
        setRemoteComments(post.comments || []);
      }
    } catch {
      setRemoteComments(post.comments || []);
    }

    let isMounted = true;
    let realtimeChannel: any = null;

    if (!isUuid) {
      // Sample post — non-UUID post ID, fully served by local state/localStorage
      setIsLoadingComments(false);
      return;
    }

    setIsLoadingComments(true);

    const fetchComments = async () => {
      try {
        const { data, error } = await supabase
          .from('post_comments')
          .select(`
            id, content, likes_count, created_at,
            profiles ( id, username, avatar_url, level )
          `)
          .eq('post_id', post.id)
          .order('created_at', { ascending: true });

        if (error) {
          console.warn('Could not fetch remote comments:', error.message);
          return;
        }

        if (isMounted && data && data.length > 0) {
          const mapped: PostComment[] = data.map((c: any) => ({
            id: c.id,
            user: {
              id: c.profiles?.id || 'unknown',
              username: c.profiles?.username || 'spotter',
              avatarUrl: c.profiles?.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop',
              level: c.profiles?.level || 1
            },
            text: c.content,
            createdAt: new Date(c.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            likesCount: c.likes_count || 0,
            isLiked: false
          }));
          setRemoteComments(mapped);
          try {
            localStorage.setItem(`apex_comments_${post.id}`, JSON.stringify(mapped));
          } catch {}
        }
      } catch (e) {
        console.warn('Comments fetch error:', e);
      } finally {
        if (isMounted) setIsLoadingComments(false);
      }
    };

    fetchComments();

    // ─── Real-Time Comment Delivery via Supabase Realtime ───
    realtimeChannel = supabase
      .channel(`post_comments_${post.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'post_comments',
          filter: `post_id=eq.${post.id}`
        },
        async (payload) => {
          const newRow = payload.new as any;
          if (!newRow || !isMounted) return;

          setRemoteComments(prev => {
            // Avoid duplicate rendering
            if (prev.some(c => c.id === newRow.id || (c.text === newRow.content && c.user.id === newRow.user_id))) {
              return prev.map(c => (c.text === newRow.content && c.user.id === newRow.user_id) ? { ...c, id: newRow.id } : c);
            }

            const incoming: PostComment = {
              id: newRow.id,
              user: {
                id: newRow.user_id,
                username: 'spotter',
                avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop',
                level: 1
              },
              text: newRow.content,
              createdAt: 'Just now',
              likesCount: newRow.likes_count || 0,
              isLiked: false
            };

            // Enrich author profile metadata asynchronously
            supabase
              .from('profiles')
              .select('username, avatar_url, level')
              .eq('id', newRow.user_id)
              .single()
              .then(({ data: prof }) => {
                if (prof && isMounted) {
                  setRemoteComments(curr => curr.map(item => item.id === newRow.id ? {
                    ...item,
                    user: {
                      ...item.user,
                      username: prof.username || item.user.username,
                      avatarUrl: prof.avatar_url || item.user.avatarUrl,
                      level: prof.level || item.user.level
                    }
                  } : item));
                }
              });

            return [...prev, incoming];
          });
        }
      )
      .subscribe();

    return () => {
      isMounted = false;
      if (realtimeChannel) {
        supabase.removeChannel(realtimeChannel);
      }
    };
  }, [post?.id]);

  // ─── 2. VIRTUAL KEYBOARD & SAFE AREA INSETS (VISUAL VIEWPORT) ───
  useEffect(() => {
    if (!post) return;

    const handleViewportChange = () => {
      if (!window.visualViewport) return;
      const vv = window.visualViewport;
      // Calculate how much the keyboard is pushing up
      const offset = window.innerHeight - (vv.height + vv.offsetTop);
      setKeyboardOffset(Math.max(0, offset));
    };

    window.visualViewport?.addEventListener('resize', handleViewportChange);
    window.visualViewport?.addEventListener('scroll', handleViewportChange);

    return () => {
      window.visualViewport?.removeEventListener('resize', handleViewportChange);
      window.visualViewport?.removeEventListener('scroll', handleViewportChange);
    };
  }, [post]);

  // ─── 3. HARDWARE BACK BUTTON & ESCAPE KEY DISMISSAL ───
  useEffect(() => {
    if (!post) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (document.activeElement === inputRef.current) {
          inputRef.current?.blur();
        } else {
          onClose();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [post, onClose]);

  // ─── 4. COMMENT SUBMISSION HANDLER ───
  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanText = commentText.trim();
    if (!cleanText || isSubmitting || !post) return;

    sounds.playXpPop();
    setIsSubmitting(true);
    setCommentText('');

    // Optimistic comment
    const optimisticComment: PostComment = {
      id: `temp-${Date.now()}`,
      user: {
        id: user.id,
        username: user.username || 'driver',
        avatarUrl: user.avatarUrl,
        level: user.level || 1
      },
      text: cleanText,
      createdAt: 'Just now',
      likesCount: 0,
      isLiked: false
    };

    setRemoteComments(prev => [...prev, optimisticComment]);
    addCommentToPost(post.id, cleanText);

    // Scroll to bottom smoothly
    setTimeout(() => {
      commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(post.id);

    if (!isUuid) {
      // Local/sample post persistence
      try {
        const updated = [...remoteComments, optimisticComment];
        localStorage.setItem(`apex_comments_${post.id}`, JSON.stringify(updated));
      } catch {}
      setIsSubmitting(false);
      return;
    }

    try {
      // Server-authoritative insertion
      const { data, error } = await supabase
        .from('post_comments')
        .insert([{
          post_id: post.id,
          user_id: user.id,
          content: cleanText,
          likes_count: 0
        }])
        .select('id, created_at')
        .single();

      if (error) {
        console.warn('Server comment persistence error:', error.message);
        // Rollback optimistic comment on network or authorization failure
        setRemoteComments(prev => prev.filter(c => c.id !== optimisticComment.id));
        setCommentText(cleanText); // Restore input so user doesn't lose text
      } else if (data) {
        // Update temp ID with authoritative DB ID
        setRemoteComments(prev => {
          const updated = prev.map(c => c.id === optimisticComment.id ? { ...c, id: data.id } : c);
          try {
            localStorage.setItem(`apex_comments_${post.id}`, JSON.stringify(updated));
          } catch {}
          return updated;
        });
      }
    } catch (err) {
      console.warn('Network error saving comment:', err);
      // Rollback optimistic comment on catch
      setRemoteComments(prev => prev.filter(c => c.id !== optimisticComment.id));
      setCommentText(cleanText);
    } finally {
      setIsSubmitting(false);
    }
  }, [commentText, isSubmitting, post, user, addCommentToPost, remoteComments]);

  if (!post) return null;

  const rarityConf = post.card?.rarity ? (RARITY_CONFIG[post.card.rarity] || RARITY_CONFIG.rare) : RARITY_CONFIG.rare;
  const postThumbnail = post.card?.imageUrl || post.thumbnailUrl || post.mediaUrl || 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=200&fit=crop';
  const postTitle = post.card ? `${post.card.make} ${post.card.model}` : (post.caption ? post.caption.slice(0, 32) : 'Apex Spot');

  const content = (
    <AnimatePresence>
      <div 
        className="fixed inset-0 z-[100] flex flex-col justify-end select-none pointer-events-auto" 
        style={{ fontFamily: 'DM Sans' }}
      >
        {/* Backdrop dismiss */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={() => {
            if (document.activeElement === inputRef.current) {
              inputRef.current?.blur();
            }
            onClose();
          }}
          className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        />

        {/* Bottom Sheet Container */}
        <motion.div
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 28, stiffness: 320, mass: 0.8 }}
          className="relative z-10 w-full max-w-lg mx-auto bg-[#101010] border-t border-x border-white/10 rounded-t-[28px] flex flex-col shadow-2xl overflow-hidden"
          style={{
            height: '90dvh',
            maxHeight: '92dvh',
            marginBottom: `${keyboardOffset}px`,
            transition: keyboardOffset > 0 ? 'none' : 'margin-bottom 0.25s cubic-bezier(0.16, 1, 0.3, 1)'
          }}
        >
          {/* Top Drag Indicator Notch */}
          <div className="pt-2.5 pb-1 flex justify-center bg-[#101010]">
            <div className="w-10 h-1 rounded-full bg-white/25" />
          </div>

          {/* Sheet Header */}
          <div className="px-4 py-3 border-b border-white/[0.08] flex items-center justify-between bg-[#101010] shrink-0">
            <div className="flex items-center gap-2">
              <div 
                className="w-8 h-8 rounded-xl flex items-center justify-center border border-white/10"
                style={{ backgroundColor: 'rgba(229,9,20,0.15)' }}
              >
                <MessageSquare className="w-4 h-4 text-[#E50914]" />
              </div>
              <div>
                <h3 className="font-display text-base font-bold text-white tracking-wide flex items-center gap-2">
                  <span>SPOTTER DISCUSSION</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-white/10 text-white/70 font-sans">
                    {remoteComments.length}
                  </span>
                </h3>
              </div>
            </div>
            <button
              onClick={onClose}
              aria-label="Close comments"
              className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 text-white/70 hover:text-white flex items-center justify-center transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Post Summary Preview Banner */}
          <div className="px-4 py-2.5 bg-[#161616] border-b border-white/[0.08] flex items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-3 overflow-hidden">
              <img
                src={postThumbnail}
                alt={postTitle}
                className="w-11 h-11 rounded-xl object-cover border border-white/15 shrink-0"
              />
              <div className="truncate">
                <h4 className="font-bold text-xs text-white truncate">{postTitle}</h4>
                <div className="flex items-center gap-1.5 text-[11px] text-white/60">
                  <span>Spotted by</span>
                  <button
                    onClick={() => onOpenProfile?.(post.user.id, post.user.username)}
                    className="font-semibold text-white/90 hover:text-[#E50914] underline underline-offset-2 transition-colors truncate"
                  >
                    @{post.user.username}
                  </button>
                </div>
              </div>
            </div>

            {post.card && (
              <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${rarityConf.badgeBg}`}>
                {rarityConf.label.toUpperCase()}
              </span>
            )}
          </div>

          {/* Scrollable Comments Stream */}
          <div 
            className="flex-1 min-h-0 p-4 overflow-y-auto space-y-3 overscroll-contain no-scrollbar"
            tabIndex={0}
          >
            {isLoadingComments && remoteComments.length === 0 ? (
              <div className="space-y-4 py-2">
                <CommentRowSkeleton />
                <CommentRowSkeleton />
                <CommentRowSkeleton />
              </div>
            ) : remoteComments.length === 0 ? (
              <div className="text-center py-16 text-white/40 space-y-2.5">
                <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto text-white/30">
                  <MessageSquare className="w-5 h-5" />
                </div>
                <div>
                  <p className="font-display text-sm font-bold text-white tracking-wide">NO DISCUSSION YET</p>
                  <p className="text-xs text-white/50 max-w-xs mx-auto mt-0.5">Start the conversation on this spot.</p>
                </div>
              </div>
            ) : (
              remoteComments.map((c) => (
                <div 
                  key={c.id} 
                  className="p-3 rounded-2xl bg-[#181818] border border-white/[0.06] space-y-2 transition-all"
                >
                  <div className="flex items-center justify-between">
                    <button
                      onClick={() => onOpenProfile?.(c.user.id, c.user.username)}
                      className="flex items-center gap-2 text-left group"
                    >
                      <img 
                        src={c.user.avatarUrl} 
                        alt={c.user.username} 
                        className="w-7 h-7 rounded-full object-cover border border-white/20 group-hover:border-[#E50914] transition-colors" 
                      />
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-white group-hover:text-[#E50914] transition-colors">
                          @{c.user.username}
                        </span>
                        <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-white/10 text-white/70 border border-white/10">
                          Lvl {c.user.level || 1}
                        </span>
                      </div>
                    </button>

                    <div className="flex items-center gap-2.5">
                      <span className="text-[10px] text-white/40 font-mono">{c.createdAt}</span>
                      <button
                        onClick={() => toggleLikeComment(post.id, c.id)}
                        className={`p-1.5 rounded-full transition-colors flex items-center gap-1 text-[10px] ${
                          c.isLiked 
                            ? 'text-[#E50914]' 
                            : 'text-white/40 hover:text-white/70'
                        }`}
                      >
                        <Heart className={`w-3.5 h-3.5 ${c.isLiked ? 'fill-current' : ''}`} />
                        {c.likesCount > 0 && <span>{c.likesCount}</span>}
                      </button>
                    </div>
                  </div>

                  <p className="text-xs text-white/90 leading-relaxed pl-9">
                    {c.text}
                  </p>
                </div>
              ))
            )}
            <div ref={commentsEndRef} />
          </div>

          {/* Bottom Pinned Composer Bar */}
          <form 
            onSubmit={handleSubmit}
            className="p-3 bg-[#0d0d0d] border-t border-white/10 flex items-center gap-2.5 shrink-0"
            style={{
              paddingBottom: keyboardOffset > 0 ? '12px' : 'max(14px, env(safe-area-inset-bottom, 14px))'
            }}
          >
            <img
              src={user.avatarUrl}
              alt={user.username}
              className="w-8 h-8 rounded-full object-cover border border-white/20 shrink-0"
            />
            <input
              ref={inputRef}
              type="text"
              placeholder={`Add a comment as @${user.username}...`}
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              className="flex-1 bg-[#1a1a1a] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-white/40 focus:outline-none focus:border-[#E50914] focus:ring-1 focus:ring-[#E50914] transition-all"
              maxLength={1000}
            />
            <button
              type="submit"
              disabled={!commentText.trim() || isSubmitting}
              className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all active:scale-95 shrink-0 ${
                commentText.trim() && !isSubmitting
                  ? 'bg-[#E50914] hover:bg-[#DC2626] text-white shadow-lg shadow-red-950/40'
                  : 'bg-white/10 text-white/30 cursor-not-allowed'
              }`}
            >
              <Send className={`w-4 h-4 transition-transform ${isSubmitting ? 'translate-x-0.5 -translate-y-0.5 opacity-70' : ''}`} />
            </button>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );

  return createPortal(content, document.body);
};
